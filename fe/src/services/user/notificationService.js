import http from '../http';

/**
 * Lấy danh sách thông báo
 * @param {Object} params - { page, limit, isRead }
 */
export const getNotifications = async ({ page = 1, limit = 20, isRead } = {}) => {
  const params = { page, limit };
  if (isRead !== undefined) {
    params.isRead = isRead;
  }
  const { data } = await http.get('/notifications', { params });
  return data;
};

/**
 * Lấy số lượng thông báo chưa đọc
 */
export const getUnreadNotificationCount = async () => {
  const { data } = await http.get('/notifications/unread/count');
  return data;
};

/**
 * Đánh dấu thông báo là đã đọc
 * @param {string} notificationId
 */
export const markNotificationAsRead = async (notificationId) => {
  const { data } = await http.put(`/notifications/${notificationId}/read`);
  return data;
};

/**
 * Đánh dấu tất cả thông báo là đã đọc
 */
export const markAllNotificationsAsRead = async () => {
  const { data } = await http.put('/notifications/read-all');
  return data;
};

/**
 * Xóa thông báo
 * @param {string} notificationId
 */
export const deleteNotification = async (notificationId) => {
  const { data } = await http.delete(`/notifications/${notificationId}`);
  return data;
};



