import api from "../api";
import { store } from '../../redux/store';

// Get userId from Redux store
export const getStoredUserId = () => {
  try {
    const state = store.getState();
    const user = state.auth?.user?.user;
    return user?.id || user?._id || undefined;
  } catch {
    return undefined;
  }
};

export const listPosts = async ({ page = 1, limit = 10 } = {}) => {
  const { data } = await api.get("/posts", { params: { page, limit } });
  return data;
};

export const listMyPosts = async ({ page = 1, limit = 10 } = {}) => {
  const userId = getStoredUserId();
  if (!userId) {
    // Fallback to public posts if no user in store
    const { data } = await api.get("/posts", { params: { page, limit } });
    return data;
  }
  const { data } = await api.get(`/posts/user/${userId}`, {
    params: { page, limit },
  });
  return data;
};

export const getPostById = async (postId) => {
  const { data } = await api.get(`/posts/${postId}`);
  return data;
};

export const listPostsByUser = async (
  userId,
  { page = 1, limit = 10 } = {}
) => {
  const { data } = await api.get(`/posts/user/${userId}`, {
    params: { page, limit },
  });
  return data;
};

export const createPost = async (payload) => {
  // payload can be FormData for media upload or JSON for text-only
  const isFormData =
    typeof FormData !== "undefined" && payload instanceof FormData;
  // Ensure userId exists by defaulting from store if missing
  let finalPayload = payload;
  if (!isFormData) {
    const userId =
      payload && payload.userId ? payload.userId : getStoredUserId();
    finalPayload = { ...payload, userId };
  } else {
    // For FormData, only append if not already present
    const hasUserId = payload.has && payload.has("userId");
    if (!hasUserId) {
      const userId = getStoredUserId();
      if (userId) payload.append("userId", userId);
    }
  }
  // Do NOT set Content-Type manually for FormData; Axios will add boundary
  const { data } = await api.post("/posts", finalPayload);
  return data;
};

export const updatePost = async (postId, payload) => {
  // Let Axios set correct headers when payload is FormData
  const { data } = await api.put(`/posts/${postId}`, payload);
  return data;
};

export const deletePost = async (postId) => {
  const { data } = await api.delete(`/posts/${postId}`);
  return data;
};

export const restorePost = async (postId) => {
  const { data } = await api.post(`/posts/${postId}/restore`);
  return data;
};

export const listArchivedPosts = async ({ page = 1, limit = 10 } = {}) => {
  const { data } = await api.get("/posts/archived", { params: { page, limit } });
  return data;
};

export const permanentlyDeletePost = async (postId) => {
  const { data } = await api.delete(`/posts/${postId}/permanent`);
  return data;
};

// ---- Likes ----
export const likePost = async (postId) => {
  const { data } = await api.post(`/posts/${postId}/like`);
  return data;
};

export const unlikePost = async (postId) => {
  const { data } = await api.delete(`/posts/${postId}/like`);
  return data;
};

// ---- Comments ----
export const createPostComment = async (
  postId,
  { comment, parentCommentId } = {}
) => {
  const payload = { comment };
  if (parentCommentId) payload.parentCommentId = parentCommentId;
  const { data } = await api.post(`/posts/${postId}/comments`, payload);
  return data;
};

export const getPostComments = async (
  postId,
  { parentCommentId, page = 1, limit = 10 } = {}
) => {
  const params = { page, limit };
  if (parentCommentId) params.parentCommentId = parentCommentId;
  const { data } = await api.get(`/posts/${postId}/comments`, { params });
  return data;
};

// Stats
export const getPostStats = async (postId) => {
  const { data } = await api.get(`/posts/${postId}/stats`);
  return data;
};

// Get list of users who liked a post
export const getPostLikes = async (postId, { page = 1, limit = 50 } = {}) => {
  const { data } = await api.get(`/posts/${postId}/likes`, { params: { page, limit } });
  return data;
};

// Helper: fetch all comments (paginate until done)
export const getAllPostComments = async (postId, { parentCommentId } = {}) => {
  const all = [];
  let page = 1;
  // reasonable hard cap
  const limit = 50;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getPostComments(postId, { parentCommentId, page, limit });
    const items = res?.data?.comments || [];
    all.push(...items);
    const hasNext = res?.data?.pagination?.hasNextPage;
    if (!hasNext) break;
    page += 1;
  }
  return all;
};

export default {
  listPosts,
  listMyPosts,
  getPostById,
  listPostsByUser,
  createPost,
  updatePost,
  deletePost,
  restorePost,
  likePost,
  unlikePost,
  createPostComment,
  getPostComments,
  getPostStats,
  getPostLikes,
  getAllPostComments,
  getStoredUserId,
};
