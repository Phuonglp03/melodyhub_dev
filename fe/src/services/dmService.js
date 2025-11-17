import http from './http';

// Create or get conversation with a peer
export const ensureConversationWith = async (peerId) => {
  if (!peerId) throw new Error('peerId is required');
  const { data } = await http.post(`/dm/conversations/${peerId}`);
  return data?.data;
};

// Accept message request
export const acceptConversation = async (conversationId) => {
  if (!conversationId) throw new Error('conversationId is required');
  const { data } = await http.post(`/dm/conversations/${conversationId}/accept`);
  return data?.data;
};

// Decline message request
export const declineConversation = async (conversationId) => {
  if (!conversationId) throw new Error('conversationId is required');
  const { data } = await http.post(`/dm/conversations/${conversationId}/decline`);
  return data;
};

// List conversations
export const listConversations = async () => {
  const { data } = await http.get('/dm/conversations');
  return data?.data || [];
};

// List messages (paginated by time)
export const listMessages = async (conversationId, { before, limit = 30 } = {}) => {
  if (!conversationId) throw new Error('conversationId is required');
  const params = {};
  if (before) params.before = before;
  if (limit) params.limit = limit;
  const { data } = await http.get(`/dm/conversations/${conversationId}/messages`, { params });
  return data?.data || [];
};

// Send message (REST fallback)
export const sendMessage = async (conversationId, text) => {
  if (!conversationId) throw new Error('conversationId is required');
  const { data } = await http.post(`/dm/conversations/${conversationId}/messages`, { text });
  return data?.data;
};

// Mark seen
export const markSeen = async (conversationId) => {
  if (!conversationId) throw new Error('conversationId is required');
  const { data } = await http.post(`/dm/conversations/${conversationId}/seen`);
  return data;
};

export default {
  ensureConversationWith,
  acceptConversation,
  declineConversation,
  listConversations,
  listMessages,
  sendMessage,
  markSeen,
};





