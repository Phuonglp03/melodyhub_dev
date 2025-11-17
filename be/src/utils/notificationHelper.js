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



