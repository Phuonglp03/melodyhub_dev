import express from 'express';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  deleteNotification
} from '../controllers/notificationController.js';
import { verifyToken, optionalVerifyToken } from '../middleware/auth.js';

const router = express.Router();

// Route đếm thông báo chưa đọc:
// - Nếu có token hợp lệ: trả về số lượng chưa đọc của user đó.
// - Nếu không có / token không hợp lệ: không ném lỗi, chỉ trả unreadCount = 0.
router.get('/unread/count', optionalVerifyToken, getUnreadNotificationCount);

// Tất cả các route còn lại đều yêu cầu authentication
router.use(verifyToken);

// GET /api/notifications - Lấy danh sách thông báo
router.get('/', getNotifications);

// PUT /api/notifications/:notificationId/read - Đánh dấu thông báo là đã đọc
router.put('/:notificationId/read', markNotificationAsRead);

// PUT /api/notifications/read-all - Đánh dấu tất cả thông báo là đã đọc
router.put('/read-all', markAllNotificationsAsRead);

// DELETE /api/notifications/:notificationId - Xóa thông báo
router.delete('/:notificationId', deleteNotification);

export default router;



