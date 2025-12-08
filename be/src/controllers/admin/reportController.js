import ContentReport from '../../models/ContentReport.js';
import Post from '../../models/Post.js';
import PostLike from '../../models/PostLike.js';
import PostComment from '../../models/PostComment.js';
import LiveRoom from '../../models/LiveRoom.js';
import User from '../../models/User.js';
import mongoose from 'mongoose';
import { createNotification, notifyAdminsPostReported } from '../../utils/notificationHelper.js';
import { getSocketIo } from '../../config/socket.js';
import { getReportLimit } from '../../services/reportSettingService.js';

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

    // Gửi thông báo cho admin biết có report mới
    try {
      await notifyAdminsPostReported({
        postId,
        reporterId,
        reason,
      });
    } catch (notifErr) {
      console.warn('[ReportPost] Lỗi khi gửi thông báo report post cho admin:', notifErr?.message);
    }

    // Emit socket event để admin panel cập nhật real-time
    try {
      const io = getSocketIo();
      
      // Populate report với đầy đủ thông tin giống như getAllReports
      const populatedReport = await ContentReport.findById(report._id)
        .populate('reporterId', 'username displayName avatarUrl')
        .populate('resolvedBy', 'username displayName')
        .lean();
      
      // Nếu là post report, populate post info
      if (populatedReport.targetContentType === 'post') {
        const postData = await Post.findById(populatedReport.targetContentId)
          .populate('userId', 'username displayName')
          .populate('attachedLicks')
          .lean();
        
        if (postData) {
          populatedReport.post = {
            _id: postData._id,
            textContent: postData.textContent,
            postType: postData.postType,
            author: postData.userId,
            createdAt: postData.createdAt,
            attachedLicks: postData.attachedLicks || [],
            media: postData.media || [],
            linkPreview: postData.linkPreview || null,
            archived: postData.archived,
            archivedByReports: postData.archivedByReports || false,
          };
        }
      }
      
      // Emit đến tất cả admin (có thể filter ở frontend hoặc tạo admin room)
      console.log('[ReportPost] Emitting new:report event for reportId:', report._id);
      io.emit('new:report', {
        report: populatedReport,
      });
      console.log('[ReportPost] Socket event emitted successfully');
    } catch (socketErr) {
      console.error('[ReportPost] Không thể emit socket event:', socketErr?.message);
    }

    // Check current pending reports count
    const pendingReportsCount = await ContentReport.countDocuments({
      targetContentType: 'post',
      targetContentId: postId,
      status: 'pending',
    });

    const reportLimit = await getReportLimit();

    // Automatically archive the post when reaching report limit
    if (pendingReportsCount >= reportLimit && !post.archived) {
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
    // Get only post reports, populate reporter and resolvedBy info
    const reports = await ContentReport.find({ targetContentType: 'post' })
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

/**
 * Get all active livestreams for admin (all rooms with status 'live')
 * GET /api/reports/livestreams/active
 */
export const getActiveLivestreamsAdmin = async (req, res) => {
  try {
    const io = getSocketIo();
    
    // Get all rooms with status 'live'
    const streams = await LiveRoom.find({ status: 'live' })
      .populate('hostId', 'displayName username avatarUrl')
      .sort({ startedAt: -1 });

    const playbackBaseUrl = process.env.MEDIA_SERVER_HTTP_URL || 'http://localhost:8000';
    
    // Get current viewers for each stream
    const result = await Promise.all(streams.map(async (stream) => {
      let currentViewers = 0;
      try {
        const roomSockets = await io.in(stream._id.toString()).fetchSockets();
        currentViewers = roomSockets.length;
      } catch (e) {
        // Ignore
      }
      return {
        ...stream.toObject(),
        playbackUrls: {
          hls: `${playbackBaseUrl}/live/${stream.streamKey}/index.m3u8`,
          flv: `${playbackBaseUrl}/live/${stream.streamKey}.flv`
        },
        currentViewers
      };
    }));

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting active livestreams:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get active livestreams'
    });
  }
};

/**
 * Get all livestream reports (Admin only)
 * GET /api/reports/livestreams/reports
 */
export const getLivestreamReports = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = { targetContentType: 'room' };
    if (status && ['pending', 'resolved', 'dismissed'].includes(status)) {
      query.status = status;
    }

    // Get reports with room and reporter info
    const reports = await ContentReport.find(query)
      .populate('reporterId', 'displayName username avatarUrl')
      .populate('resolvedBy', 'displayName username')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const playbackBaseUrl = process.env.MEDIA_SERVER_HTTP_URL || 'http://localhost:8000';
    
    // Get room details for each report
    const reportsWithRoomDetails = await Promise.all(
      reports.map(async (report) => {
        const room = await LiveRoom.findById(report.targetContentId)
          .populate('hostId', 'displayName username avatarUrl');
        
        // Count total reports for this room
        const reportCount = await ContentReport.countDocuments({
          targetContentType: 'room',
          targetContentId: report.targetContentId,
          status: 'pending'
        });

        return {
          ...report.toObject(),
          room: room ? {
            _id: room._id,
            title: room.title,
            description: room.description,
            status: room.status,
            privacyType: room.privacyType,
            hostId: room.hostId,
            startedAt: room.startedAt,
            streamKey: room.streamKey,
            playbackUrls: {
              hls: `${playbackBaseUrl}/live/${room.streamKey}/index.m3u8`,
              flv: `${playbackBaseUrl}/live/${room.streamKey}.flv`
            },
            currentViewers: room.currentViewers || 0,
            moderationStatus: room.moderationStatus || 'active'
          } : null,
          reportCount // Số lượng báo cáo cho room này
        };
      })
    );

    const total = await ContentReport.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        reports: reportsWithRoomDetails,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting livestream reports:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get livestream reports'
    });
  }
};

/**
 * Resolve a report (Admin only)
 * PATCH /api/reports/resolve/:reportId
 */
export const resolveReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const adminId = req.userId;

    const report = await ContentReport.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    report.status = 'resolved';
    report.resolvedBy = adminId;
    report.resolvedAt = new Date();
    await report.save();

    // Optionally resolve all pending reports for the same content
    await ContentReport.updateMany(
      {
        targetContentType: report.targetContentType,
        targetContentId: report.targetContentId,
        status: 'pending'
      },
      {
        status: 'resolved',
        resolvedBy: adminId,
        resolvedAt: new Date()
      }
    );

    res.status(200).json({
      success: true,
      message: 'Report resolved successfully',
      data: report
    });
  } catch (error) {
    console.error('Error resolving report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to resolve report'
    });
  }
};

/**
 * Dismiss a report (Admin only)
 * PATCH /api/reports/dismiss/:reportId
 */
export const dismissReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const adminId = req.userId;

    const report = await ContentReport.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    report.status = 'dismissed';
    report.resolvedBy = adminId;
    report.resolvedAt = new Date();
    await report.save();

    res.status(200).json({
      success: true,
      message: 'Report dismissed successfully',
      data: report
    });
  } catch (error) {
    console.error('Error dismissing report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to dismiss report'
    });
  }
};

/**
 * Admin end a livestream
 * POST /api/reports/livestreams/:roomId/end
 */
export const adminEndLivestream = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const room = await LiveRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Livestream not found'
      });
    }

    if (room.status === 'ended') {
      return res.status(400).json({
        success: false,
        message: 'Livestream already ended'
      });
    }

    room.status = 'ended';
    room.endedAt = new Date();
    await room.save();

    // Notify via socket
    const io = getSocketIo();
    io.to(roomId).emit('stream-status-ended', { 
      reason: 'admin',
      message: 'Livestream đã bị admin dừng.'
    });

    // Notify host
    try {
      await createNotification({
        userId: room.hostId,
        actorId: null,
        type: 'system',
        linkUrl: `/livestream/history`,
        message: 'Livestream của bạn đã bị admin dừng do vi phạm quy định.'
      });
    } catch (e) {
      console.error('Error sending notification:', e);
    }

    res.status(200).json({
      success: true,
      message: 'Livestream ended by admin',
      data: room
    });
  } catch (error) {
    console.error('Error ending livestream:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to end livestream'
    });
  }
};

/**
 * Admin ban a livestream (end + mark as banned + ban user from livestreaming)
 * POST /api/reports/livestreams/:roomId/ban
 */
export const adminBanLivestream = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { resolveReports = true, banUser = true, reason = 'Vi phạm quy định cộng đồng' } = req.body;
    const adminId = req.userId;
    
    const room = await LiveRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy livestream'
      });
    }

    // End stream if still live
    if (room.status !== 'ended') {
      room.status = 'ended';
      room.endedAt = new Date();
    }
    
    room.moderationStatus = 'banned';
    await room.save();

    // Ban user from livestreaming if banUser is true
    let userBanned = false;
    if (banUser) {
      const user = await User.findById(room.hostId);
      if (user) {
        user.livestreamBanned = true;
        user.livestreamBannedAt = new Date();
        user.livestreamBannedReason = reason;
        await user.save();
        userBanned = true;
      }
    }

    // Notify via socket
    const io = getSocketIo();
    io.to(roomId).emit('stream-status-ended', { 
      reason: 'banned',
      message: 'Livestream đã bị cấm do vi phạm quy định cộng đồng.'
    });

    // Resolve all pending reports for this room
    if (resolveReports) {
      await ContentReport.updateMany(
        {
          targetContentType: 'room',
          targetContentId: roomId,
          status: 'pending'
        },
        {
          status: 'resolved',
          resolvedBy: adminId,
          resolvedAt: new Date()
        }
      );
    }

    // Notify host
    try {
      await createNotification({
        userId: room.hostId,
        actorId: null,
        type: 'system',
        linkUrl: `/support`,
        message: userBanned 
          ? `Bạn đã bị cấm phát livestream do: ${reason}. Liên hệ hỗ trợ nếu bạn cho rằng đây là nhầm lẫn.`
          : 'Livestream của bạn đã bị cấm do vi phạm quy định cộng đồng.'
      });
    } catch (e) {
      console.error('Error sending notification:', e);
    }

    res.status(200).json({
      success: true,
      message: userBanned 
        ? 'Đã cấm livestream và cấm người dùng phát livestream'
        : 'Đã cấm livestream',
      data: {
        room,
        userBanned
      }
    });
  } catch (error) {
    console.error('Error banning livestream:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi cấm livestream'
    });
  }
};

/**
 * Admin unban user from livestreaming
 * POST /api/reports/users/:userId/unban-livestream
 */
export const adminUnbanUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    if (!user.livestreamBanned) {
      return res.status(400).json({
        success: false,
        message: 'Người dùng này không bị cấm livestream'
      });
    }

    user.livestreamBanned = false;
    user.livestreamBannedAt = null;
    user.livestreamBannedReason = null;
    await user.save();

    // Notify user
    try {
      await createNotification({
        userId: userId,
        actorId: null,
        type: 'system',
        linkUrl: `/livestream/create`,
        message: 'Bạn đã được gỡ cấm phát livestream. Bạn có thể tạo phòng livestream mới.'
      });
    } catch (e) {
      console.error('Error sending notification:', e);
    }

    res.status(200).json({
      success: true,
      message: 'Đã gỡ cấm phát livestream cho người dùng',
      data: {
        userId,
        displayName: user.displayName
      }
    });
  } catch (error) {
    console.error('Error unbanning user from livestream:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi gỡ cấm'
    });
  }
};

/**
 * Get all users banned from livestreaming (Admin only)
 * GET /api/reports/users/banned-livestream
 */
export const getBannedLivestreamUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const users = await User.find({ livestreamBanned: true })
      .select('displayName username avatarUrl livestreamBanned livestreamBannedAt livestreamBannedReason')
      .sort({ livestreamBannedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments({ livestreamBanned: true });

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting banned users:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy danh sách người dùng bị cấm'
    });
  }
};

