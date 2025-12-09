import api from "../api";

/**
 * Report a post
 * @param {string} postId - ID of the post to report
 * @param {object} reportData - Report data
 * @param {string} reportData.reason - Reason for reporting (spam, inappropriate, copyright, harassment, other)
 * @param {string} [reportData.description] - Optional description
 * @returns {Promise<object>} Response data
 */
export const reportPost = async (postId, reportData) => {
  const res = await api.post(`/reports/posts/${postId}`, reportData);
  return res.data;
};

/**
 * Get reports for a post (admin only)
 * @param {string} postId - ID of the post
 * @returns {Promise<object>} Response data with reports array
 */
export const getPostReports = async (postId) => {
  const res = await api.get(`/reports/posts/${postId}`);
  return res.data;
};

/**
 * Check if current user has reported a post
 * @param {string} postId - ID of the post
 * @returns {Promise<object>} Response data with hasReported boolean
 */
export const checkPostReport = async (postId) => {
  const res = await api.get(`/reports/posts/${postId}/check`);
  return res.data;
};

/**
 * Get all reports (admin only)
 * @returns {Promise<object>} Response data with reports array
 */
export const getAllReports = async () => {
  const res = await api.get(`/reports/all`);
  return res.data;
};

/**
 * Admin restore post (admin only)
 * @param {string} postId - ID of the post to restore
 * @returns {Promise<object>} Response data
 */
export const adminRestorePost = async (postId) => {
  const res = await api.post(`/reports/posts/${postId}/restore`);
  return res.data;
};

/**
 * Admin delete post (admin only)
 * @param {string} postId - ID of the post to delete
 * @returns {Promise<object>} Response data
 */
export const adminDeletePost = async (postId) => {
  const res = await api.delete(`/reports/posts/${postId}`);
  return res.data;
};

/**
 * Get current report limit setting (admin only)
 * @returns {Promise<object>} Response data with limit
 */
export const getReportLimitSetting = async () => {
  const res = await api.get(`/reports/settings/report-limit`);
  return res.data;
};

/**
 * Update report limit setting (admin only)
 * @param {number} limit - New report limit
 * @returns {Promise<object>} Response data with updated limit
 */
export const updateReportLimitSetting = async (limit) => {
  const res = await api.put(`/reports/settings/report-limit`, { limit });
  return res.data;
};


/**
 * Report a livestream
 * @param {string} roomId - ID of the livestream room to report
 * @param {object} reportData - Report data
 * @param {string} reportData.reason - Reason for reporting (spam, inappropriate, copyright, harassment, other)
 * @param {string} [reportData.description] - Optional description
 * @returns {Promise<object>} Response data
 */
export const reportLivestream = async (roomId, reportData) => {
  // Changed: endpoint moved to liveroomRoutes
  const res = await api.post(`/livestreams/${roomId}/report`, reportData);
  return res.data;
};

/**
 * Check if current user has reported a livestream
 * @param {string} roomId - ID of the livestream room
 * @returns {Promise<object>} Response data with hasReported boolean
 */
export const checkLivestreamReport = async (roomId) => {
  // Changed: endpoint moved to liveroomRoutes
  const res = await api.get(`/livestreams/${roomId}/report/check`);
  return res.data;
};


