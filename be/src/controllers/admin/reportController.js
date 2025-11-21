import ContentReport from '../../models/ContentReport.js';
import Post from '../../models/Post.js';
import PostLike from '../../models/PostLike.js';
import PostComment from '../../models/PostComment.js';
import mongoose from 'mongoose';
import { createNotification } from '../../utils/notificationHelper.js';
import { getSocketIo } from '../../config/socket.js';

/**
 * Report a post
 * POST /api/reports/posts/:postId
 */
export const reportPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason, description } = req.body;
    const reporterId = req.userId;

    // Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check if user is trying to report their own post
    const postAuthorId = post.userId.toString();
    if (postAuthorId === reporterId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot report your own post',
      });
    }

    // Validate reason
    const validReasons = ['spam', 'inappropriate', 'copyright', 'harassment', 'other'];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reason. Must be one of: spam, inappropriate, copyright, harassment, other',
      });
    }

    // Check if user has already reported this post
    const existingReport = await ContentReport.findOne({
      reporterId,
      targetContentType: 'post',
      targetContentId: postId,
      status: 'pending',
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: 'You have already reported this post',
      });
    }

    // Create report
    const report = new ContentReport({
      reporterId,
      targetContentType: 'post',
      targetContentId: postId,
      reason,
      description: description || '',
      status: 'pending',
    });

    await report.save();

    // Check if post has 2 or more pending reports
    const pendingReportsCount = await ContentReport.countDocuments({
      targetContentType: 'post',
      targetContentId: postId,
      status: 'pending',
    });

    // If 2 or more reports, automatically archive the post
    if (pendingReportsCount >= 2 && !post.archived) {
      post.archived = true;
      post.archivedAt = new Date();
      post.archivedByReports = true; // Mark as archived by reports
      await post.save();

      // Send notification to post owner
      const postOwnerId = post.userId.toString();
      await createNotification({
        userId: postOwnerId,
        actorId: null, // System notification
        type: 'system',
        linkUrl: `/archived-posts`,
        message: `Bài viết của bạn đã bị ẩn do nhận được ${pendingReportsCount} báo cáo. Vui lòng liên hệ admin nếu bạn muốn khôi phục.`,
      });

      // Emit socket event to remove post from feed in realtime
      try {
        const io = getSocketIo();
        const postIdStr = postId.toString();
        console.log('[Report] Emitting post:archived event for postId:', postIdStr);
        // Emit to post room (for users viewing the post)
        io.to(`post:${postIdStr}`).emit('post:archived', { postId: postIdStr });
        // Emit to post owner
        io.to(postOwnerId).emit('post:archived', { postId: postIdStr });
        // Emit globally so all feeds can update
        io.emit('post:archived', { postId: postIdStr });
        console.log('[Report] Socket event emitted successfully');
      } catch (socketErr) {
        console.error('[Report] Không thể emit socket event:', socketErr?.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Post reported successfully',
      data: report,
    });
  } catch (error) {
    console.error('Error reporting post:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to report post',
    });
  }
};

/**
 * Get reports for a specific post (admin only)
 * GET /api/reports/posts/:postId
 */
export const getPostReports = async (req, res) => {
  try {
    const { postId } = req.params;

    // Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Get all reports for this post
    const reports = await ContentReport.find({
      targetContentType: 'post',
      targetContentId: postId,
    })
      .populate('reporterId', 'username displayName avatarUrl')
      .populate('resolvedBy', 'username displayName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: reports,
    });
  } catch (error) {
    console.error('Error getting post reports:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get post reports',
    });
  }
};

/**
 * Check if current user has reported a post
 * GET /api/reports/posts/:postId/check
 */
export const checkPostReport = async (req, res) => {
  try {
    const { postId } = req.params;
    const reporterId = req.userId;

    // Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }

    // Check if user has reported this post
    const report = await ContentReport.findOne({
      reporterId,
      targetContentType: 'post',
      targetContentId: postId,
    });

    res.status(200).json({
      success: true,
      data: {
        hasReported: !!report,
        report: report || null,
      },
    });
  } catch (error) {
    console.error('Error checking post report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check post report',
    });
  }
};

/**
 * Get all reports (admin only)
 * GET /api/reports/all
 */
export const getAllReports = async (req, res) => {
  try {
    // Get all reports, populate reporter and resolvedBy info
    const reports = await ContentReport.find({})
      .populate('reporterId', 'username displayName avatarUrl')
      .populate('resolvedBy', 'username displayName')
      .sort({ createdAt: -1 });

    // For post reports, also populate post info
    const reportsWithDetails = await Promise.all(
      reports.map(async (report) => {
        const reportObj = report.toObject();
        
        // If it's a post report, get post details
        if (report.targetContentType === 'post') {
          const post = await Post.findById(report.targetContentId)
            .populate('userId', 'username displayName')
            .populate('attachedLicks');
          
          if (post) {
            reportObj.post = {
              _id: post._id,
              textContent: post.textContent,
              postType: post.postType,
              author: post.userId,
              createdAt: post.createdAt,
              attachedLicks: post.attachedLicks || [],
              media: post.media || [],
              linkPreview: post.linkPreview || null,
              archived: post.archived,
              archivedByReports: post.archivedByReports || false,
            };
          }
        }
        
        return reportObj;
      })
    );

    res.status(200).json({
      success: true,
      data: reportsWithDetails,
    });
  } catch (error) {
    console.error('Error getting all reports:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get reports',
    });
  }
};

/**
 * Admin restore post (admin only)
 * POST /api/reports/posts/:postId/restore
 */
export const adminRestorePost = async (req, res) => {
  try {
    const { postId } = req.params;

    // Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    if (!post.archived) {
      return res.status(400).json({
        success: false,
        message: 'Post is not archived',
      });
    }

    // Restore the post
    post.archived = false;
    post.archivedAt = null;
    post.archivedByReports = false;
    await post.save();

    // Mark all reports related to this post as resolved
    const adminId = req.userId;
    const resolvedReports = await ContentReport.updateMany(
      {
        targetContentType: 'post',
        targetContentId: postId,
        status: 'pending',
      },
      {
        status: 'resolved',
        resolvedBy: adminId,
        resolvedAt: new Date(),
      }
    );
    console.log(`[Report] Marked ${resolvedReports.modifiedCount} reports as resolved for restored post ${postId}`);

    // Send notification to post owner
    const postOwnerId = post.userId.toString();
    await createNotification({
      userId: postOwnerId,
      actorId: null,
      type: 'system',
      linkUrl: `/`,
      message: 'Bài viết của bạn đã được admin khôi phục.',
    });

    res.status(200).json({
      success: true,
      message: 'Post restored successfully',
      data: {
        resolvedReportsCount: resolvedReports.modifiedCount,
      },
    });
  } catch (error) {
    console.error('Error restoring post:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to restore post',
    });
  }
};

/**
 * Admin permanently delete post (admin only)
 * DELETE /api/reports/posts/:postId
 */
export const adminDeletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    console.log('[AdminDeletePost] Received delete request for postId:', postId);
    console.log('[AdminDeletePost] User ID:', req.userId);

    // Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      console.log('[AdminDeletePost] Invalid postId format');
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      console.log('[AdminDeletePost] Post not found');
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }
    console.log('[AdminDeletePost] Post found:', post._id);

    const adminId = req.userId;

    // Mark all reports related to this post as resolved before deleting
    await ContentReport.updateMany(
      {
        targetContentType: 'post',
        targetContentId: postId,
        status: 'pending',
      },
      {
        status: 'resolved',
        resolvedBy: adminId,
        resolvedAt: new Date(),
      }
    );

    // Delete related data
    await Promise.all([
      PostLike.deleteMany({ postId }),
      PostComment.deleteMany({ postId }),
      ContentReport.deleteMany({ 
        targetContentType: 'post',
        targetContentId: postId 
      }),
    ]);

    // Delete the post
    await Post.findByIdAndDelete(postId);
    console.log('[AdminDeletePost] Post deleted successfully');

    // Send notification to post owner
    const postOwnerId = post.userId.toString();
    try {
      await createNotification({
        userId: postOwnerId,
        actorId: null,
        type: 'system',
        linkUrl: `/archived-posts`,
        message: 'Bài viết của bạn đã bị xóa vĩnh viễn do vi phạm quy định cộng đồng.',
      });
      console.log('[AdminDeletePost] Notification sent');
    } catch (notifError) {
      console.error('[AdminDeletePost] Error sending notification:', notifError);
      // Don't fail the request if notification fails
    }

    // Emit socket event to remove post from archived posts in realtime
    try {
      const io = getSocketIo();
      const postIdStr = postId.toString();
      console.log('[AdminDeletePost] Emitting post:deleted event for postId:', postIdStr);
      // Emit to post owner's room
      io.to(postOwnerId).emit('post:deleted', { postId: postIdStr });
      // Emit globally so archived posts page can update
      io.emit('post:deleted', { postId: postIdStr });
      console.log('[AdminDeletePost] Socket event emitted successfully');
    } catch (socketErr) {
      console.error('[AdminDeletePost] Không thể emit socket event:', socketErr?.message);
    }

    console.log('[AdminDeletePost] Successfully completed delete operation');
    res.status(200).json({
      success: true,
      message: 'Post permanently deleted',
    });
  } catch (error) {
    console.error('[AdminDeletePost] Error deleting post:', error);
    console.error('[AdminDeletePost] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete post',
    });
  }
};

