// src/services/livestreamService.js
import api from '../api';
import { store } from '../../redux/store';

const getUserIdFromStorage = () => {

  const state = store.getState();
  const user = state.auth?.user?.user;
  
  if (user) {
    return user._id || user.id || null;
  }
  return null;
};


const createLiveStream = async () => {
  const { data } = await api.post('/livestreams', {});
  return data;
};

const getLiveStreamById = async (roomId) => {
  const userId = getUserIdFromStorage();
  let url = `/livestreams/${roomId}`;
  if (userId) {
    url += `?userId=${userId}`;
  }
  const { data } = await api.get(url);
  return data; 
};


const banUser = async (roomId, userId, { messageId }) => {
  const { data } = await api.post(`/livestreams/${roomId}/ban/${userId}`, { messageId });
  return data;
};

const unbanUser = async (roomId, userId) => {
  const { data } = await api.post(`/livestreams/${roomId}/unban/${userId}`);
  return data;
};

const getChatHistory = async (roomId) => {
  const { data } = await api.get(`/livestreams/${roomId}/chat`);
  return data;
};
const updateLiveStreamDetails = async (roomId, details) => {
  const { data } = await api.patch(`/livestreams/${roomId}/details`, details);
  return data;
};
const updatePrivacy = async (roomId, privacyType) => {
  const { data } = await api.patch(`/livestreams/${roomId}/privacy`, { privacyType });
  return data;
};

const endLiveStream = async (roomId) => {
  const { data } = await api.patch(`/livestreams/${roomId}/end`);
  return data;
};

const goLive = async (roomId) => {
  const { data } = await api.patch(`/livestreams/${roomId}/go-live`);
  return data;
};

const getActiveLiveStreams = async () => {
  const { data } = await api.get('/livestreams'); 
  return data; 
};

const getRoomViewers = async (roomId) => {
  const { data} = await api.get(`/livestreams/${roomId}/viewers`);
  return data;
};

const checkLivestreamBanStatus = async () => {
  const { data } = await api.get('/livestreams/ban-status');
  return data;
};


export const livestreamService = {
  createLiveStream,
  getLiveStreamById,
  updateLiveStreamDetails,
  goLive,
  endLiveStream,
  updatePrivacy,
  getChatHistory,
  banUser,
  unbanUser,
  getActiveLiveStreams,
  getRoomViewers,
  checkLivestreamBanStatus,
};