import Post from '../models/Post.js';
import PostComment from '../models/PostComment.js';
import { getSocketIo } from '../config/socket.js';
import { notifyPostCommented } from '../utils/notificationHelper.js';

// Create a new comment on a post
export const createPostComment = async (req, res) => {
  try {
    const userId = req.userId;
    const { postId } = req.params;
    const { comment, parentCommentId } = req.body || {};

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Comment is required' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (parentCommentId) {
      const parent = await PostComment.findById(parentCommentId);
      if (!parent || String(parent.postId) !== String(postId)) {
        return res.status(400).json({ success: false, message: 'Invalid parentCommentId' });
      }
    }

    const doc = await PostComment.create({ postId, userId, comment: comment.trim(), parentCommentId });

    const populated = await PostComment.findById(doc._id)
      .populate('userId', 'username displayName avatarUrl')
      .lean();

    // Tạo thông báo cho chủ bài đăng (nếu không phải tự comment)
    if (String(post.userId) !== String(userId)) {
      notifyPostCommented(post.userId, userId, postId).catch(err => {
        console.error('Lỗi khi tạo thông báo comment:', err);
      });
    }

    // Emit realtime event to all clients joined to this post room
    try {
      const io = getSocketIo();
      io.to(`post:${postId}`).emit('post:comment:new', {
        postId,
        comment: populated,
      });
    } catch (emitErr) {
      // Only log; don't fail the request if socket unavailable
      console.warn('[socket] emit post:comment:new failed:', emitErr?.message);
    }

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('createPostComment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create comment' });
  }
};

// Get comments of a post (optionally by parentCommentId for replies)
export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { parentCommentId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const filter = { postId };
    if (parentCommentId) {
      filter.parentCommentId = parentCommentId;
    } else {
      filter.parentCommentId = { $exists: false };
    }

    const [items, total] = await Promise.all([
      PostComment.find(filter)
        .populate('userId', 'username displayName avatarUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PostComment.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);
    return res.status(200).json({
      success: true,
      data: {
        comments: items,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('getPostComments error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch comments' });
  }
};

// Delete a comment (owner or admin)
export const deletePostComment = async (req, res) => {
  try {
    const requesterId = req.userId;
    const requesterRole = req.userRole;
    const { postId, commentId } = req.params;

    const comment = await PostComment.findById(commentId);
    if (!comment || String(comment.postId) !== String(postId)) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const isOwner = String(comment.userId) === String(requesterId);
    const isAdmin = requesterRole === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Also delete direct replies of this comment (optional basic cascade)
    await Promise.all([
      PostComment.deleteOne({ _id: commentId }),
      PostComment.deleteMany({ parentCommentId: commentId })
    ]);

    return res.status(200).json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('deletePostComment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete comment' });
  }
};


