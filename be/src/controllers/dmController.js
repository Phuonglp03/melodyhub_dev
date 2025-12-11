import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import DirectMessage from '../models/DirectMessage.js';
import UserFollow from '../models/UserFollow.js';
import { getSocketIo } from '../config/socket.js';
import { uploadMessageText, downloadMessageText } from '../utils/messageStorageService.js';

const isObjectIdEqual = (a, b) => String(a) === String(b);

const getPeerId = (conversation, me) => {
  const [a, b] = conversation.participants;
  return isObjectIdEqual(a, me) ? b : a;
};

const hasFollow = async (fromUserId, toUserId) => {
  const follow = await UserFollow.findOne({ followerId: fromUserId, followingId: toUserId }).lean();
  return !!follow;
};

const hasMutualFollow = async (userA, userB) => {
  const [ab, ba] = await Promise.all([
    UserFollow.findOne({ followerId: userA, followingId: userB }).lean(),
    UserFollow.findOne({ followerId: userB, followingId: userA }).lean()
  ]);
  return !!(ab && ba);
};

const ensurePairOrder = (a, b) => {
  const ids = [String(a), String(b)].sort();
  return ids.map((id) => new mongoose.Types.ObjectId(id));
};

export const ensureConversationWith = async (req, res) => {
  try {
    const me = req.userId;
    const { peerId } = req.params;

    if (!mongoose.isValidObjectId(peerId)) {
      return res.status(400).json({ success: false, message: 'Invalid peerId' });
    }

    const [idA, idB] = ensurePairOrder(me, peerId);

    // Find existing conversation
    let convo = await Conversation.findOne({ participants: { $all: [idA, idB] } });
    if (convo) {
      // Fix legacy: pending convo without requestedBy -> assign to requester if me-follow-peer
      if (convo.status === 'pending' && !convo.requestedBy) {
        const meFollowsPeer = await hasFollow(me, peerId);
        if (meFollowsPeer) {
          convo.requestedBy = me;
          await convo.save();
        }
      }
      return res.json({ success: true, data: convo });
    }

    // Policy: allow request if me follows peer, but not mutual
    const meFollowsPeer = await hasFollow(me, peerId);
    if (!meFollowsPeer) {
      return res.status(403).json({ success: false, message: 'Follow required to send message request' });
    }

    const mutual = await hasMutualFollow(me, peerId);

    convo = await Conversation.create({
      participants: [idA, idB],
      status: mutual ? 'active' : 'pending',
      requestedBy: mutual ? undefined : me,
      acceptedBy: mutual ? me : undefined,
      lastMessage: undefined,
      lastMessageAt: undefined,
      unreadCounts: {}
    });

    return res.status(201).json({ success: true, data: convo });
  } catch (err) {
    console.error('ensureConversationWith error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const acceptRequest = async (req, res) => {
  try {
    const me = req.userId;
    const { id } = req.params;

    const convo = await Conversation.findById(id);
    if (!convo) return res.status(404).json({ success: false, message: 'Conversation not found' });

    if (convo.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Conversation is not pending' });
    }

    if (!convo.participants.some((p) => isObjectIdEqual(p, me))) {
      return res.status(403).json({ success: false, message: 'Not a participant' });
    }

    if (convo.requestedBy && isObjectIdEqual(convo.requestedBy, me)) {
      return res.status(403).json({ success: false, message: 'Requester cannot accept their own request' });
    }

    // Lưu lại requester trước khi cập nhật để dùng cho socket emit
    const requesterId = convo.requestedBy;

    convo.status = 'active';
    convo.acceptedBy = me;
    await convo.save();

    // Populate conversation before emitting
    const populatedConvo = await Conversation.findById(id)
      .populate('participants', 'displayName username avatarUrl')
      .lean();

    // Emit socket event to notify both participants about the status change
    try {
      const io = getSocketIo();
      const peer = getPeerId(convo, me);
      
      // Emit to conversation room
      io.to(String(id)).emit('dm:conversation:updated', { 
        conversationId: String(id), 
        conversation: populatedConvo 
      });
      
      // Emit to both participants to refresh their conversation lists
      if (peer) {
        io.to(String(peer)).emit('dm:badge', { conversationId: String(id) });
      }
      io.to(String(me)).emit('dm:badge', { conversationId: String(id) });

      // Thông báo realtime riêng cho người gửi yêu cầu rằng yêu cầu đã được chấp nhận
      if (requesterId) {
        io.to(String(requesterId)).emit('dm:request:accepted', {
          conversationId: String(id),
          acceptedBy: String(me),
        });
      }
      
      console.log(`[Socket.IO] Conversation ${id} accepted, notified participants ${me} and ${peer}`);
    } catch (socketErr) {
      console.error('[Socket.IO] Error emitting accept event:', socketErr);
      // Continue even if socket fails
    }

    return res.json({ success: true, data: populatedConvo || convo });
  } catch (err) {
    console.error('acceptRequest error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const declineRequest = async (req, res) => {
  try {
    const me = req.userId;
    const { id } = req.params;
    const convo = await Conversation.findById(id);
    if (!convo) return res.status(404).json({ success: false, message: 'Conversation not found' });

    if (convo.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Conversation is not pending' });
    }
    if (!convo.participants.some((p) => isObjectIdEqual(p, me))) {
      return res.status(403).json({ success: false, message: 'Not a participant' });
    }
    if (convo.requestedBy && isObjectIdEqual(convo.requestedBy, me)) {
      return res.status(403).json({ success: false, message: 'Requester cannot decline their own request' });
    }

    // Lưu lại thông tin trước khi cập nhật để emit socket
    const peer = getPeerId(convo, me);
    const requesterId = convo.requestedBy;

    // Thay vì xóa hẳn, đánh dấu trạng thái là 'declined' để phía requester vẫn thấy lịch sử + trạng thái
    convo.status = 'declined';
    await convo.save();

    // Populate lại để gửi cho FE (giống acceptRequest)
    const populatedConvo = await Conversation.findById(id)
      .populate('participants', 'displayName username avatarUrl')
      .lean();

    // Emit socket event để thông báo cho người gửi rằng yêu cầu đã bị từ chối
    try {
      const io = getSocketIo();

      // Cập nhật badge cho cả hai phía để list hội thoại luôn đúng
      if (peer) {
        io.to(String(peer)).emit('dm:badge', { conversationId: String(id) });
      }
      io.to(String(me)).emit('dm:badge', { conversationId: String(id) });

      // Thông báo cập nhật hội thoại cho cả hai phía
      const conversationUpdatePayload = {
        conversationId: String(id),
        conversation: populatedConvo || convo,
      };
      
      // Emit vào conversation room
      io.to(String(id)).emit('dm:conversation:updated', conversationUpdatePayload);
      
      // Emit vào room của từng participant để đảm bảo nhận được
      if (peer) {
        io.to(String(peer)).emit('dm:conversation:updated', conversationUpdatePayload);
        console.log(`[Socket.IO] Emitted dm:conversation:updated to peer ${peer} for conversation ${id}`);
      }
      if (requesterId) {
        const requesterIdStr = String(requesterId);
        io.to(requesterIdStr).emit('dm:conversation:updated', conversationUpdatePayload);
        console.log(`[Socket.IO] Emitted dm:conversation:updated to requester ${requesterIdStr} for conversation ${id}`);
        
        console.log(`[Socket.IO] Emitting dm:request:declined to requester ${requesterIdStr} for conversation ${id}`);
        io.to(requesterIdStr).emit('dm:request:declined', {
          conversationId: String(id),
          declinedBy: String(me),
        });
        console.log(`[Socket.IO] Emitted dm:request:declined event successfully`);
      } else {
        console.warn(`[Socket.IO] Cannot emit dm:request:declined: requesterId is missing for conversation ${id}`);
      }
    } catch (socketErr) {
      console.error('[Socket.IO] Error emitting decline event:', socketErr);
      // Không chặn response nếu socket lỗi
    }

    return res.json({ success: true, data: populatedConvo || convo, message: 'Request declined' });
  } catch (err) {
    console.error('declineRequest error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const listConversations = async (req, res) => {
  try {
    const me = req.userId;
    const convos = await Conversation.find({ participants: { $in: [me] } })
      .populate('participants', 'displayName username avatarUrl')
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();
    return res.json({ success: true, data: convos });
  } catch (err) {
    console.error('listConversations error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const listMessages = async (req, res) => {
  try {
    const me = req.userId;
    const { id } = req.params;
    const { before, limit = 30 } = req.query;

    const convo = await Conversation.findById(id);
    if (!convo) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (!convo.participants.some((p) => isObjectIdEqual(p, me))) {
      return res.status(403).json({ success: false, message: 'Not a participant' });
    }

    const query = { conversationId: id };
    if (before) query.createdAt = { $lt: new Date(before) };

    const msgs = await DirectMessage.find(query)
      .populate('senderId', 'displayName username avatarUrl')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    // Download full text từ Cloudinary cho các messages cần thiết
    const messagesWithText = await Promise.all(
      msgs.map(async (msg) => {
        // Nếu text đã có trong MongoDB (tin ngắn)
        if (msg.text) {
          return msg;
        }

        // Download từ Cloudinary nếu cần
        if (msg.textStorageId && msg.textStorageType === 'cloudinary') {
          msg.text = await downloadMessageText(
            msg.textStorageType,
            msg.textStorageId,
            msg.textPreview || ''
          );
        } else {
          // Fallback: dùng preview
          msg.text = msg.textPreview || '';
        }

        return msg;
      })
    );

    return res.json({ success: true, data: messagesWithText.reverse() });
  } catch (err) {
    console.error('listMessages error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const me = req.userId;
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Text required' });
    }

    const convo = await Conversation.findById(id);
    if (!convo) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (!convo.participants.some((p) => isObjectIdEqual(p, me))) {
      return res.status(403).json({ success: false, message: 'Not a participant' });
    }
    // Policy: allow pending only for requester (A can send to B before accept)
    if (convo.status !== 'active') {
      const isRequester = convo.requestedBy && isObjectIdEqual(convo.requestedBy, me);
      if (!(convo.status === 'pending' && isRequester)) {
        return res.status(403).json({ success: false, message: 'Conversation not active (only requester can send while pending)' });
      }
    }

    // Upload text to storage (Cloudinary if long, MongoDB if short)
    const messageId = `msg_${Date.now()}_${me}`;
    const storageResult = await uploadMessageText(text.trim(), messageId);

    // Create message with storage info
    const msg = await DirectMessage.create({
      conversationId: id,
      senderId: me,
      text: storageResult.text || null, // Full text nếu ngắn, null nếu dài
      textStorageId: storageResult.storageId || null, // Cloudinary URL nếu dài
      textStorageType: storageResult.storageType,
      textPreview: storageResult.textPreview
    });

    // Update conversation meta and unread for peer
    const peer = getPeerId(convo, me);
    convo.lastMessage = storageResult.textPreview; // Dùng preview cho sidebar
    convo.lastMessageAt = msg.createdAt;
    // Tăng unreadCount cho peer (người nhận)
    const currentUnread = Number(convo.unreadCounts?.get(String(peer)) || 0);
    convo.unreadCounts.set(String(peer), currentUnread + 1);
    // Reset unreadCount về 0 cho sender (người gửi) vì họ đã trả lời
    convo.unreadCounts.set(String(me), 0);
    await convo.save();

    const populated = await DirectMessage.findById(msg._id)
      .populate('senderId', 'displayName username avatarUrl')
      .lean();

    // Download full text nếu lưu trong Cloudinary
    if (populated.textStorageType === 'cloudinary' && populated.textStorageId) {
      populated.text = await downloadMessageText(
        populated.textStorageType,
        populated.textStorageId,
        populated.textPreview
      );
    } else {
      // Nếu lưu trong MongoDB, text đã có sẵn
      populated.text = populated.text || populated.textPreview || '';
    }

    // Emit realtime events so peers update without reload
    try {
      const io = getSocketIo();
      io.to(String(id)).emit('dm:new', { conversationId: String(id), message: populated });
      const peer = getPeerId(convo, me);
      if (peer) {
        io.to(String(peer)).emit('dm:new', { conversationId: String(id), message: populated });
        io.to(String(peer)).emit('dm:badge', { conversationId: String(id) });
      }
      // Also update sender's list so lastMessage reflects immediately
      io.to(String(me)).emit('dm:badge', { conversationId: String(id) });
    } catch {}

    return res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('sendMessage error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const markSeen = async (req, res) => {
  try {
    const me = req.userId;
    const { id } = req.params;

    const convo = await Conversation.findById(id);
    if (!convo) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (!convo.participants.some((p) => isObjectIdEqual(p, me))) {
      return res.status(403).json({ success: false, message: 'Not a participant' });
    }

    convo.unreadCounts.set(String(me), 0);
    await convo.save();

    return res.json({ success: true });
  } catch (err) {
    console.error('markSeen error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default {
  ensureConversationWith,
  acceptRequest,
  declineRequest,
  listConversations,
  listMessages,
  sendMessage,
  markSeen
};





