import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import LiveRoom from '../../models/LiveRoom.js';
import UserFollow from '../../models/UserFollow.js';
import ContentReport from '../../models/ContentReport.js';
import { getSocketIo } from '../../config/socket.js';
import RoomChat from '../../models/RoomChat.js';
import User from '../../models/User.js';

export const createLiveStream = async (req, res) => {
  const { title, description, privacyType } = req.body;
  const hostId = req.userId;

  try {
    // Kiểm tra xem user có bị cấm livestream không
    const user = await User.findById(hostId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }
    
    if (user.livestreamBanned) {
      return res.status(403).json({ 
        message: 'Bạn đã bị cấm phát livestream do vi phạm quy định cộng đồng.',
        banned: true,
        bannedAt: user.livestreamBannedAt,
        reason: user.livestreamBannedReason || 'Vi phạm quy định cộng đồng'
      });
    }

    const streamKey = uuidv4();

    const newRoom = new LiveRoom({
      hostId,
      title: title || null,
      description: description || null,
      streamKey,
      status: 'waiting',
      privacyType: privacyType || 'public',
    });

    await newRoom.save();
    
    const result = await LiveRoom.findById(newRoom._id).populate('hostId', 'displayName avatarUrl');

    res.status(201).json({
      message: 'Tạo phòng live thành công. Hãy dùng stream key để bắt đầu.',
      room: result
    });

  } catch (err) {
    console.error('Lỗi khi tạo live stream:', err);
    res.status(500).json({ message: 'Lỗi server khi tạo phòng.' });
  }
};

/**
 * Check if current user is banned from livestreaming
 * GET /api/livestreams/ban-status
 */
export const checkLivestreamBanStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    res.status(200).json({
      banned: user.livestreamBanned || false,
      bannedAt: user.livestreamBannedAt || null,
      reason: user.livestreamBannedReason || null
    });
  } catch (err) {
    console.error('Lỗi khi kiểm tra trạng thái ban:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

export const getLiveStreamById = async (req, res) => {
  try {
    const { id } = req.params;
    // Use req.userId from optionalVerifyToken middleware (will be undefined if not logged in)
    const currentUserId = req.userId;
    const stream = await LiveRoom.findById(id)
      .populate('hostId', 'displayName username avatarUrl')
      .populate('bannedUsers', 'displayName username avatarUrl');

    if (!stream || stream.status === 'ended') {
      return res.status(404).json({ message: 'Không tìm thấy phòng live hoặc phòng đã kết thúc.' });
    }
    
    const hostId = stream.hostId._id.toString();
    const isHost = currentUserId && currentUserId === hostId;
    let isFollowing = false;

    if (!isHost) {
      if (stream.privacyType === 'follow_only') {
        if (!currentUserId) {
          return res.status(401).json({ message: 'Vui lòng đăng nhập để xem stream này.' });
        }

        const followRelation = await UserFollow.findOne({ 
          followerId: currentUserId, 
          followingId: hostId 
        });
        
        isFollowing = !!followRelation;
        
        if (!isFollowing) {
          return res.status(403).json({ message: 'Stream này chỉ dành cho người theo dõi.' });
        }

      } else if (currentUserId) {
        // Check follow status for public streams too
        const followRelation = await UserFollow.findOne({ 
          followerId: currentUserId, 
          followingId: hostId 
        });
        isFollowing = !!followRelation;
      }
      
      if (!['live', 'ended'].includes(stream.status)) {
        return res.status(404).json({ message: 'Livestream không hoạt động hoặc đã kết thúc.' });
      }
    }

    const playbackBaseUrl = process.env.MEDIA_SERVER_HTTP_URL || 'http://localhost:8000';
    const currentVmIp = process.env.CURRENT_VM_PUBLIC_IP || 'localhost';
    
    // Lấy số người xem từ socket room
    let currentViewers = 0;
    try {
      const io = getSocketIo();
      const roomSockets = await io.in(id).fetchSockets();
      currentViewers = roomSockets.length;
    } catch (e) {
      // Nếu lỗi thì giữ nguyên 0
    }
    
    res.status(200).json({
      ...stream.toObject(),
      rtmpUrl: `rtmp://${currentVmIp}:1935/live`,
      playbackUrls: {
        hls: `${playbackBaseUrl}/live/${stream.streamKey}/index.m3u8`,
        flv: `${playbackBaseUrl}/live/${stream.streamKey}.flv`
      },
      isHost,
      isFollowing,
      currentViewers
    });

  } catch (err) {
    console.error('Lỗi khi lấy stream by id:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

export const updatePrivacy = async (req, res) => {
  const hostId = req.userId;
  const { id } = req.params;
  const { privacyType } = req.body; 

  if (!['public', 'follow_only'].includes(privacyType)) {
    return res.status(400).json({ message: 'Trạng thái riêng tư không hợp lệ.' });
  }

  try {
    const room = await LiveRoom.findOne({ _id: id, hostId: hostId });

    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng hoặc bạn không có quyền.' });
    }

    if (!['waiting', 'preview', 'live'].includes(room.status)) {
      return res.status(400).json({ message: 'Chỉ có thể đổi trạng thái khi đang chuẩn bị hoặc đang live.' });
    }

    room.privacyType = privacyType;
    await room.save();
    const io = getSocketIo();
    io.to(room._id.toString()).emit('stream-privacy-updated', { privacyType: room.privacyType });

    res.status(200).json({ message: 'Cập nhật quyền riêng tư thành công.', privacyType: room.privacyType });

  } catch (err) {
    console.error('Lỗi khi cập nhật privacy:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

export const goLive = async (req, res) => {
  const hostId = req.userId; 
  try {
    const { id } = req.params;
    const room = await LiveRoom.findOne({ _id: id, hostId: hostId });

    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng live hoặc bạn không có quyền.' });
    }

    if (room.status !== 'preview') {
      return res.status(400).json({ message: 'Stream chưa sẵn sàng (chưa ở trạng thái preview).' });
    }

    if (!room.title || room.title.trim() === '') {
      return res.status(400).json({ message: 'Tiêu đề là bắt buộc để phát trực tiếp.' });
    }
    room.status = 'live';
    room.startedAt = new Date(); 
    await room.save();
    
    const result = await LiveRoom.findById(room._id).populate('hostId', 'displayName avatarUrl');
    // Thông báo cho TOÀN BỘ SERVER biết stream này BẮT ĐẦU
    const io = getSocketIo();
    io.emit('stream-started', result); 
    io.to(room._id.toString()).emit('stream-status-live', { startedAt: room.startedAt });
    res.status(200).json({ message: 'Phát trực tiếp thành công!', room: result });

  } catch (err) {
    console.error('Lỗi khi go-live:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};


export const endLiveStream = async (req, res) => {
  const hostId = req.userId;
  
  try {
    const { id } = req.params;
    const room = await LiveRoom.findOne({ _id: id, hostId: hostId });

    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng live hoặc bạn không có quyền.' });
    }
    
    if (room.status === 'ended') {
       return res.status(400).json({ message: 'Stream đã kết thúc.' });
    }
    
    const wasLive = room.status === 'live';


    room.status = 'ended';
    room.endedAt = new Date();
    await room.save();


    const io = getSocketIo();

    if (wasLive) {
        io.emit('stream-ended', { roomId: room._id, title: room.title });
    }
    io.to(room._id.toString()).emit('stream-status-ended'); 
    res.status(200).json({ message: 'Đã kết thúc livestream.', room });
    


  } catch (err) {
    console.error('Lỗi khi end-live:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

export const updateLiveStreamDetails = async (req, res) => {
  const hostId = req.userId;
  const { id } = req.params;
  const { title, description } = req.body;

  try {
    const room = await LiveRoom.findOne({ _id: id, hostId: hostId });

    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng live hoặc bạn không có quyền.' });
    }
    
    if (room.status !== 'live' && room.status !== 'preview' && room.status !== 'waiting') {
      return res.status(400).json({ message: 'Chỉ có thể cập nhật khi đang ở chế độ xem trước hoặc đang live.' });
    }
    
    if (title) room.title = title;
    if (description !== undefined) room.description = description;
    
    await room.save();
    
    const updatedDetails = {
      roomId: room._id,
      title: room.title,
      description: room.description
    };

    const io = getSocketIo();
    io.to(room._id.toString()).emit('stream-details-updated', updatedDetails);
    
    // io.emit('stream-details-updated-global', updatedDetails);

    res.status(200).json({ message: 'Cập nhật thành công', details: updatedDetails });

  } catch (err) {
    console.error('Lỗi khi cập nhật chi tiết stream:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};
export const getActiveLiveStreams = async (req, res) => {
  try {
    const currentUserId = req.userId; // Từ optionalVerifyToken (có thể undefined)
    
    // 1. Tìm tất cả các phòng có status là 'live'
    const streams = await LiveRoom.find({ status: 'live' })
      .populate('hostId', 'displayName username avatarUrl') 
      .sort({ startedAt: -1 }); 

    // 2. Lấy danh sách người mà currentUser đang follow
    let followingIds = [];
    if (currentUserId) {
      const followings = await UserFollow.find({ followerId: currentUserId });
      followingIds = followings.map(f => f.followingId.toString());
    }

    // 3. Lọc và thêm thông tin cho mỗi stream
    const io = getSocketIo();
    const result = [];
    
    for (const stream of streams) {
      const hostId = stream.hostId?._id?.toString();
      const isFollowing = followingIds.includes(hostId);
      
      // Nếu stream là follow_only và user không follow host -> ẩn
      if (stream.privacyType === 'follow_only') {
        // Nếu chưa đăng nhập hoặc không follow -> bỏ qua stream này
        if (!currentUserId || !isFollowing) {
          continue;
        }
      }
      
      // Lấy số người xem từ socket room
      let currentViewers = 0;
      try {
        const roomSockets = await io.in(stream._id.toString()).fetchSockets();
        currentViewers = roomSockets.length;
      } catch (e) {
        // Nếu lỗi thì giữ nguyên 0
      }
      
      result.push({
        ...stream.toObject(),
        isFollowing,
        currentViewers
      });
    }

    res.status(200).json(result);

  } catch (err) {
    console.error('Lỗi khi lấy active streams:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

export const getChatHistory = async (req, res) => {
  const { roomId } = req.params;
  try {
    const messages = await RoomChat.find({ roomId })
      .sort({ sentAt: 1 })
      .populate('userId', 'displayName avatarUrl');

    res.status(200).json(messages);
  } catch (err) {
    console.error('Lỗi khi lấy chat history:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

export const banUser = async (req, res) => {
  const { roomId, userId } = req.params;
  const { messageId } = req.body;
  const hostId = req.userId;

  try {
    const room = await LiveRoom.findOne({ _id: roomId, hostId });
    if (!room) return res.status(404).json({ message: 'Không tìm thấy phòng hoặc bạn không phải host.' });

    // Ban user khỏi room (giữ lại để backward compatibility - chỉ ban trong phòng này)
    if (!room.bannedUsers.includes(userId)) {
      room.bannedUsers.push(userId);
      await room.save();
    }

    /**
     * Ban user khỏi chat trong các phòng của host này
     * User bị ban vẫn có thể xem stream nhưng không thể chat trong phòng của host này
     * User vẫn có thể chat trong phòng của host khác
     */
    const bannedUser = await User.findById(userId);
    if (bannedUser) {
      // Thêm hostId vào danh sách chatBannedByHosts nếu chưa có
      const hostIdObj = new mongoose.Types.ObjectId(hostId);
      if (!bannedUser.chatBannedByHosts || !bannedUser.chatBannedByHosts.includes(hostIdObj)) {
        if (!bannedUser.chatBannedByHosts) {
          bannedUser.chatBannedByHosts = [];
        }
        bannedUser.chatBannedByHosts.push(hostIdObj);
        await bannedUser.save();
      }
    }

    const io = getSocketIo();
    io.to(roomId).emit('user-banned', { userId });
    // Emit to user để họ biết bị ban chat trong phòng của host này
    io.to(userId).emit('chat-banned', { 
      message: `Bạn đã bị cấm chat trong các phòng livestream của ${room.hostId?.displayName || 'host này'}`,
      hostId: hostId.toString()
    });

    if (messageId) {
      const chat = await RoomChat.findOne({ _id: messageId, roomId, userId });
      if (chat) {
        chat.deleted = true;
        await chat.save();
        io.to(roomId).emit('message-removed', { messageId });
      }
    }

    res.status(200).json({ message: 'Đã ban user khỏi chat.' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

export const unbanUser = async (req, res) => {
  const { roomId, userId } = req.params;
  const hostId = req.userId;

  try {
    const room = await LiveRoom.findOne({ _id: roomId, hostId });
    if (!room) return res.status(404).json({ message: 'Không tìm thấy phòng hoặc bạn không phải host.' });

    // Unban user khỏi room (backward compatibility - chỉ unban trong phòng này)
    room.bannedUsers = room.bannedUsers.filter(id => id.toString() !== userId);
    await room.save();

    /**
     * Unban user khỏi chat trong các phòng của host này
     * User này có thể chat lại trong phòng của host này
     */
    const bannedUser = await User.findById(userId);
    if (bannedUser && bannedUser.chatBannedByHosts) {
      const hostIdObj = new mongoose.Types.ObjectId(hostId);
      bannedUser.chatBannedByHosts = bannedUser.chatBannedByHosts.filter(
        id => id.toString() !== hostId.toString()
      );
      await bannedUser.save();
    }

    const io = getSocketIo();
    io.to(roomId).emit('user-unbanned', { userId });
    // Emit to user để họ biết được unban chat trong phòng của host này
    io.to(userId).emit('chat-unbanned', { 
      message: `Bạn đã được gỡ cấm chat trong các phòng livestream của ${room.hostId?.displayName || 'host này'}`,
      hostId: hostId.toString()
    });

    res.status(200).json({ message: 'Đã unban user khỏi chat.' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

export const getRoomViewers = async (req, res) => {
  const { roomId } = req.params;
  const hostId = req.userId;

  try {
    const room = await LiveRoom.findOne({ _id: roomId, hostId });
    if (!room) return res.status(404).json({ message: 'Không tìm thấy phòng hoặc bạn không phải host.' });

    // Get viewer IDs from socket tracking
    const io = getSocketIo();
    const roomSockets = await io.in(roomId).fetchSockets();
    
    // Extract unique user IDs
    const userIds = new Set();
    roomSockets.forEach(socket => {
      const userId = socket.handshake.query.userId;
      if (userId && userId !== hostId) {
        userIds.add(userId);
      }
    });

    // Get user details
    const viewers = await User.find({ _id: { $in: Array.from(userIds) } })
      .select('displayName username avatarUrl')
      .lean();

    // Get message counts for each viewer in this room
    const viewersWithStats = await Promise.all(
      viewers.map(async (viewer) => {
        const messageCount = await RoomChat.countDocuments({
          roomId,
          userId: viewer._id
        });
        return {
          ...viewer,
          messageCount
        };
      })
    );

    res.status(200).json({
      viewers: viewersWithStats,
      totalCount: viewersWithStats.length
    });
  } catch (err) {
    console.error('Lỗi khi lấy viewers:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

// ============ USER REPORT FUNCTIONS ============

/**
 * Report a livestream room (User)
 * POST /api/livestreams/:roomId/report
 */
export const reportLivestream = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { reason, description } = req.body;
    const reporterId = req.userId;

    // Validate roomId
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ message: 'ID phòng không hợp lệ.' });
    }

    // Check if room exists
    const room = await LiveRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng livestream.' });
    }

    // Check if user is trying to report their own room
    const hostId = room.hostId.toString();
    if (hostId === reporterId.toString()) {
      return res.status(400).json({ message: 'Bạn không thể báo cáo phòng livestream của chính mình.' });
    }

    // Validate reason
    const validReasons = ['spam', 'inappropriate', 'copyright', 'harassment', 'other'];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({ 
        message: 'Lý do không hợp lệ. Phải là: spam, inappropriate, copyright, harassment, other' 
      });
    }

    // Check if user has already reported this room
    const existingReport = await ContentReport.findOne({
      reporterId,
      targetContentType: 'room',
      targetContentId: roomId,
      status: 'pending',
    });

    if (existingReport) {
      return res.status(400).json({ message: 'Bạn đã báo cáo phòng livestream này rồi.' });
    }

    // Create report (không gửi notification)
    const report = new ContentReport({
      reporterId,
      targetContentType: 'room',
      targetContentId: roomId,
      reason,
      description: description || '',
      status: 'pending',
    });

    await report.save();

    // Emit socket event for admin to receive real-time updates
    try {
      const io = getSocketIo();
      
      // Populate report with full info for admin panel
      const populatedReport = await ContentReport.findById(report._id)
        .populate('reporterId', 'displayName username avatarUrl')
        .lean();
      
      // Get room details
      const roomDetails = await LiveRoom.findById(roomId)
        .populate('hostId', 'displayName username avatarUrl')
        .lean();
      
      // Count total pending reports for this room
      const reportCount = await ContentReport.countDocuments({
        targetContentType: 'room',
        targetContentId: roomId,
        status: 'pending'
      });

      const reportData = {
        ...populatedReport,
        room: roomDetails ? {
          _id: roomDetails._id,
          title: roomDetails.title,
          description: roomDetails.description,
          status: roomDetails.status,
          privacyType: roomDetails.privacyType,
          hostId: roomDetails.hostId,
          startedAt: roomDetails.startedAt,
          currentViewers: 0,
          moderationStatus: roomDetails.moderationStatus || 'active'
        } : null,
        reportCount
      };

      console.log('[ReportLivestream] Emitting new:livestream-report event for reportId:', report._id);
      io.emit('new:livestream-report', { report: reportData });
      console.log('[ReportLivestream] Socket event emitted successfully');
    } catch (socketErr) {
      console.error('[ReportLivestream] Không thể emit socket event:', socketErr?.message);
    }

    res.status(201).json({
      success: true,
      message: 'Báo cáo đã được gửi thành công.',
      data: report,
    });
  } catch (error) {
    console.error('Lỗi khi báo cáo livestream:', error);
    res.status(500).json({ message: error.message || 'Lỗi khi gửi báo cáo.' });
  }
};

/**
 * Check if current user has reported a livestream
 * GET /api/livestreams/:roomId/report/check
 */
export const checkLivestreamReport = async (req, res) => {
  try {
    const { roomId } = req.params;
    const reporterId = req.userId;

    // Validate roomId
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ message: 'ID phòng không hợp lệ.' });
    }

    // Check if user has reported this room
    const report = await ContentReport.findOne({
      reporterId,
      targetContentType: 'room',
      targetContentId: roomId,
    });

    res.status(200).json({
      success: true,
      data: {
        hasReported: !!report,
        report: report || null,
      },
    });
  } catch (error) {
    console.error('Lỗi khi kiểm tra báo cáo:', error);
    res.status(500).json({ message: error.message || 'Lỗi khi kiểm tra báo cáo.' });
  }
};