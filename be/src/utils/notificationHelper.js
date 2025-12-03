import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { getSocketIo } from '../config/socket.js';

/**
 * Tạo thông báo cho người dùng
 * @param {Object} options - Các tùy chọn
 * @param {string} options.userId - ID người nhận thông báo
 * @param {string} options.actorId - ID người thực hiện hành động
 * @param {string} options.type - Loại thông báo (like_post, comment_post, follow)
 * @param {string} options.linkUrl - URL liên kết đến nội dung
 * @param {string} options.message - Nội dung thông báo (tiếng Việt)
 */
export const createNotification = async ({ userId, actorId, type, linkUrl, message }) => {
  try {
    // Không tạo thông báo nếu người dùng tự thực hiện hành động với chính mình (trừ system notification)
    if (actorId && String(userId) === String(actorId)) {
      return null;
    }

    // Tạo thông báo
    const notification = await Notification.create({
      userId,
      actorId,
      type,
      linkUrl,
      message,
      isRead: false,
    });

    // Populate actorId để lấy thông tin người thực hiện hành động
    const populatedNotification = await Notification.findById(notification._id)
      .populate('actorId', 'username displayName avatarUrl')
      .lean();

    // Emit thông báo qua socket.io cho người nhận
    try {
      const io = getSocketIo();
      io.to(String(userId)).emit('notification:new', populatedNotification);
    } catch (socketErr) {
      // Chỉ log, không fail nếu socket không khả dụng
      console.warn('[Notification] Không thể emit qua socket:', socketErr?.message);
    }

    return populatedNotification;
  } catch (error) {
    console.error('[Notification] Lỗi khi tạo thông báo:', error);
    return null;
  }
};

/**
 * Tạo thông báo khi có người like bài đăng
 */
export const notifyPostLiked = async (postOwnerId, likerId, postId) => {
  try {
    const liker = await User.findById(likerId).select('displayName username').lean();
    if (!liker) return null;

    const message = `${liker.displayName || liker.username} đã thích bài đăng của bạn`;
    const linkUrl = `/posts/${postId}`;

    return await createNotification({
      userId: postOwnerId,
      actorId: likerId,
      type: 'like_post',
      linkUrl,
      message,
    });
  } catch (error) {
    console.error('[Notification] Lỗi khi tạo thông báo like post:', error);
    return null;
  }
};

/**
 * Tạo thông báo khi có người comment bài đăng
 */
export const notifyPostCommented = async (postOwnerId, commenterId, postId) => {
  try {
    const commenter = await User.findById(commenterId).select('displayName username').lean();
    if (!commenter) return null;

    const message = `${commenter.displayName || commenter.username} đã bình luận bài đăng của bạn`;
    const linkUrl = `/posts/${postId}`;

    return await createNotification({
      userId: postOwnerId,
      actorId: commenterId,
      type: 'comment_post',
      linkUrl,
      message,
    });
  } catch (error) {
    console.error('[Notification] Lỗi khi tạo thông báo comment post:', error);
    return null;
  }
};

/**
 * Tạo thông báo khi có người follow
 */
export const notifyUserFollowed = async (followedUserId, followerId) => {
  try {
    const follower = await User.findById(followerId).select('displayName username').lean();
    if (!follower) return null;

    const message = `${follower.displayName || follower.username} đã theo dõi bạn`;
    const linkUrl = `/users/${followerId}`;

    return await createNotification({
      userId: followedUserId,
      actorId: followerId,
      type: 'follow',
      linkUrl,
      message,
    });
  } catch (error) {
    console.error('[Notification] Lỗi khi tạo thông báo follow:', error);
    return null;
  }
};

/**
 * Thông báo cho admin khi có lick mới được upload (ở trạng thái pending)
 * - type: lick_pending_review
 * - userId (người nhận): admin
 * - actorId (người thực hiện): user upload lick
 */
export const notifyAdminLickPending = async ({
  lickId,
  uploaderId,
}) => {
  try {
    // Tìm tất cả admin (roleId = 'admin')
    const admins = await User.find({ roleId: 'admin' }).select('_id').lean();
    if (!admins || admins.length === 0) {
      console.warn('[Notification] Không tìm thấy admin (roleId=admin) để gửi thông báo lick pending');
      return null;
    }

    const uploader = await User.findById(uploaderId)
      .select('displayName username')
      .lean();

    const displayName = uploader?.displayName || uploader?.username || 'Người dùng';

    const message = `${displayName} đã upload một lick mới cần duyệt`;
    const linkUrl = `/admin/lick-approvement`; // Trang quản lý duyệt lick

    // Gửi thông báo cho tất cả admin
    const results = await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin._id,
          actorId: uploaderId,
          type: 'lick_pending_review',
          linkUrl,
          message,
        })
      )
    );

    return results;
  } catch (error) {
    console.error('[Notification] Lỗi khi tạo thông báo lick pending:', error);
    return null;
  }
};

/**
 * Thông báo cho chủ sở hữu lick khi admin đã duyệt lick
 * - type: lick_approved
 * - userId: chủ sở hữu lick
 * - actorId: admin duyệt
 */
export const notifyUserLickApproved = async ({
  lickId,
  lickOwnerId,
  adminId,
}) => {
  try {
    const admin = await User.findById(adminId)
      .select('displayName username')
      .lean();

    const adminName = admin?.displayName || admin?.username || 'Admin';

    const message = `Lick của bạn đã được ${adminName} duyệt và công khai`;
    const linkUrl = `/licks/${lickId}`;

    return await createNotification({
      userId: lickOwnerId,
      actorId: adminId,
      type: 'lick_approved',
      linkUrl,
      message,
    });
  } catch (error) {
    console.error('[Notification] Lỗi khi tạo thông báo lick approved:', error);
    return null;
  }
};

/**
 * Thông báo cho chủ sở hữu lick khi admin từ chối lick
 * - type: lick_rejected
 * - userId: chủ sở hữu lick
 * - actorId: admin từ chối
 */
export const notifyUserLickRejected = async ({
  lickId,
  lickOwnerId,
  adminId,
}) => {
  try {
    const admin = await User.findById(adminId)
      .select('displayName username')
      .lean();

    const adminName = admin?.displayName || admin?.username || 'Admin';

    const message = `Lick của bạn đã bị ${adminName} từ chối phê duyệt`;
    const linkUrl = `/licks/${lickId}`;

    return await createNotification({
      userId: lickOwnerId,
      actorId: adminId,
      type: 'lick_rejected',
      linkUrl,
      message,
    });
  } catch (error) {
    console.error('[Notification] Lỗi khi tạo thông báo lick rejected:', error);
    return null;
  }
};

/**
 * Thông báo cho admin khi có report post mới
 * - type: post_reported
 * - userId: admin
 * - actorId: người report
 */
export const notifyAdminsPostReported = async ({
  postId,
  reporterId,
  reason,
}) => {
  try {
    const admins = await User.find({ roleId: 'admin' }).select('_id').lean();
    if (!admins || admins.length === 0) {
      console.warn('[Notification] Không tìm thấy admin (roleId=admin) để gửi thông báo report post');
      return null;
    }

    const reporter = await User.findById(reporterId)
      .select('displayName username')
      .lean();

    const displayName = reporter?.displayName || reporter?.username || 'Người dùng';

    const reasonMap = {
      spam: 'Spam / Quảng cáo',
      inappropriate: 'Nội dung không phù hợp',
      copyright: 'Vi phạm bản quyền',
      harassment: 'Quấy rối / công kích',
      other: 'Lý do khác',
    };

    const reasonText = reasonMap[reason] || 'Nội dung bị báo cáo';

    const message = `${displayName} đã báo cáo một bài viết: ${reasonText}`;
    const linkUrl = `/admin/reports-management`; // Trang quản lý report

    const results = await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin._id,
          actorId: reporterId,
          type: 'post_reported',
          linkUrl,
          message,
        })
      )
    );

    return results;
  } catch (error) {
    console.error('[Notification] Lỗi khi tạo thông báo report post cho admin:', error);
    return null;
  }
};



