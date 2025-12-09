import api from './api';

// Create or get conversation with a peer
export const ensureConversationWith = async (peerId) => {
  if (!peerId) throw new Error('peerId is required');
  const res = await api.post(`/dm/conversations/${peerId}`);
  return res.data?.data;
};

// Accept message request
export const acceptConversation = async (conversationId) => {
  if (!conversationId) throw new Error('conversationId is required');
  const res = await api.post(`/dm/conversations/${conversationId}/accept`);
  return res.data?.data;
};

// Decline message request
export const declineConversation = async (conversationId) => {
  if (!conversationId) throw new Error('conversationId is required');
  const res = await api.post(`/dm/conversations/${conversationId}/decline`);
  return res.data;
};

// List conversations
export const listConversations = async () => {
  const res = await api.get('/dm/conversations');
  return res.data?.data || [];
};

// List messages (paginated by time)
export const listMessages = async (conversationId, { before, limit = 30 } = {}) => {
  if (!conversationId) throw new Error('conversationId is required');
  const params = {};
  if (before) params.before = before;
  if (limit) params.limit = limit;
  const res = await api.get(`/dm/conversations/${conversationId}/messages`, { params });
  return res.data?.data || [];
};

// Send message (REST fallback)
export const sendMessage = async (conversationId, text) => {
  if (!conversationId) throw new Error('conversationId is required');
  const res = await api.post(`/dm/conversations/${conversationId}/messages`, { text });
  return res.data?.data;
};

// Mark seen
export const markSeen = async (conversationId) => {
  if (!conversationId) throw new Error('conversationId is required');
  const res = await api.post(`/dm/conversations/${conversationId}/seen`);
  return res.data;
};

const dmService = {
  ensureConversationWith,
  acceptConversation,
  declineConversation,
  listConversations,
  listMessages,
  sendMessage,
  markSeen,
};

export default dmService;





