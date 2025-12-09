import api from '../api';

/**
 * Lấy danh sách thông báo
 * @param {Object} params - { page, limit, isRead }
 */
export const getNotifications = async ({ page = 1, limit = 20, isRead } = {}) => {
  const params = { page, limit };
  if (isRead !== undefined) {
    params.isRead = isRead;
  }
  const res = await api.get('/notifications', { params });
  return res.data;
};

/**
 * Lấy số lượng thông báo chưa đọc
 */
export const getUnreadNotificationCount = async () => {
  const res = await api.get('/notifications/unread/count');
  return res.data;
};

/**
 * Đánh dấu thông báo là đã đọc
 * @param {string} notificationId
 */
export const markNotificationAsRead = async (notificationId) => {
  const res = await api.put(`/notifications/${notificationId}/read`);
  return res.data;
};

/**
 * Đánh dấu tất cả thông báo là đã đọc
 */
export const markAllNotificationsAsRead = async () => {
  const res = await api.put('/notifications/read-all');
  return res.data;
};

/**
 * Xóa thông báo
 * @param {string} notificationId
 */
export const deleteNotification = async (notificationId) => {
  const res = await api.delete(`/notifications/${notificationId}`);
  return res.data;
};

/**
 * Accept project invitation
 * @param {string} projectId
 */
export const acceptProjectInvitation = async (projectId) => {
  const res = await api.post(`/projects/${projectId}/invite/accept`);
  return res.data;
};

/**
 * Decline project invitation
 * @param {string} projectId
 */
export const declineProjectInvitation = async (projectId) => {
  const res = await api.post(`/projects/${projectId}/invite/decline`);
  return res.data;
};



