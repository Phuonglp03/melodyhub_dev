import express from 'express';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  deleteNotification
} from '../controllers/notificationController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Tất cả các route đều yêu cầu authentication
router.use(verifyToken);

// GET /api/notifications - Lấy danh sách thông báo
router.get('/', getNotifications);

// GET /api/notifications/unread/count - Lấy số lượng thông báo chưa đọc
router.get('/unread/count', getUnreadNotificationCount);

// PUT /api/notifications/:notificationId/read - Đánh dấu thông báo là đã đọc
router.put('/:notificationId/read', markNotificationAsRead);

// PUT /api/notifications/read-all - Đánh dấu tất cả thông báo là đã đọc
router.put('/read-all', markAllNotificationsAsRead);

// DELETE /api/notifications/:notificationId - Xóa thông báo
router.delete('/:notificationId', deleteNotification);

export default router;



