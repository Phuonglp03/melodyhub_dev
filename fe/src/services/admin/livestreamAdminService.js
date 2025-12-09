// src/services/admin/livestreamAdminService.js
import api from '../api';

/**
 * Get all active livestreams (Admin only)
 */
export const getActiveLivestreams = async () => {
  const { data } = await api.get('/reports/livestreams/active');
  return data;
};

/**
 * Get all livestream reports (Admin only)
 */
export const getLivestreamReports = async (params = {}) => {
  const { status, page = 1, limit = 20 } = params;
  const queryParams = new URLSearchParams();
  
  if (status) queryParams.append('status', status);
  queryParams.append('page', page);
  queryParams.append('limit', limit);
  
  const { data } = await api.get(`/reports/livestreams/reports?${queryParams.toString()}`);
  return data;
};


/**
 * Resolve a report (Admin only)
 */
export const resolveReport = async (reportId) => {
  const { data } = await api.patch(`/reports/resolve/${reportId}`);
  return data;
};

/**
 * Dismiss a report (Admin only)
 */
export const dismissReport = async (reportId) => {
  const { data } = await api.patch(`/reports/dismiss/${reportId}`);
  return data;
};

/**
 * Admin end a livestream
 */
export const adminEndLivestream = async (roomId) => {
  const { data } = await api.post(`/reports/livestreams/${roomId}/end`);
  return data;
};

/**
 * Admin ban a livestream + ban user from livestreaming
 */
export const adminBanLivestream = async (roomId, options = {}) => {
  const { resolveReports = true, banUser = true, reason = 'Vi phạm quy định cộng đồng' } = options;
  const { data } = await api.post(`/reports/livestreams/${roomId}/ban`, { 
    resolveReports, 
    banUser, 
    reason 
  });
  return data;
};

/**
 * Admin unban user from livestreaming
 */
export const adminUnbanUser = async (userId) => {
  const { data } = await api.post(`/reports/users/${userId}/unban-livestream`);
  return data;
};

/**
 * Get all users banned from livestreaming
 */
export const getBannedLivestreamUsers = async (params = {}) => {
  const { page = 1, limit = 20 } = params;
  const queryParams = new URLSearchParams();
  queryParams.append('page', page);
  queryParams.append('limit', limit);
  
  const { data } = await api.get(`/reports/users/banned-livestream?${queryParams.toString()}`);
  return data;
};

export const livestreamAdminService = {
  getActiveLivestreams,
  getLivestreamReports,
  resolveReport,
  dismissReport,
  adminEndLivestream,
  adminBanLivestream,
  adminUnbanUser,
  getBannedLivestreamUsers
};

