import http from "../http";

export const getStoredUserId = () => {
  if (typeof window === "undefined") return undefined;
  try {
    const storedUserRaw = localStorage.getItem("user");
    const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
    // Backend stores `id` in auth responses; fallback to `_id` if present
    return (
      storedUser?.user?.id ||
      storedUser?.user?._id ||
      storedUser?.id ||
      storedUser?._id ||
      undefined
    );
  } catch {
    return undefined;
  }
};

export const listPosts = async ({ page = 1, limit = 10 } = {}) => {
  const { data } = await http.get("/posts", { params: { page, limit } });
  return data;
};

export const listMyPosts = async ({ page = 1, limit = 10 } = {}) => {
  const userId = getStoredUserId();
  if (!userId) {
    // Fallback to public posts if no user in localStorage
    const { data } = await http.get("/posts", { params: { page, limit } });
    return data;
  }
  const { data } = await http.get(`/posts/user/${userId}`, {
    params: { page, limit },
  });
  return data;
};

export const getPostById = async (postId) => {
  const { data } = await http.get(`/posts/${postId}`);
  return data;
};

export const listPostsByUser = async (
  userId,
  { page = 1, limit = 10 } = {}
) => {
  const { data } = await http.get(`/posts/user/${userId}`, {
    params: { page, limit },
  });
  return data;
};

export const createPost = async (payload) => {
  // payload can be FormData for media upload or JSON for text-only
  const isFormData =
    typeof FormData !== "undefined" && payload instanceof FormData;
  // Ensure userId exists by defaulting from localStorage if missing
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
  const { data } = await http.post("/posts", finalPayload);
  return data;
};

export const updatePost = async (postId, payload) => {
  // Let Axios set correct headers when payload is FormData
  const { data } = await http.put(`/posts/${postId}`, payload);
  return data;
};

export const deletePost = async (postId) => {
  const { data } = await http.delete(`/posts/${postId}`);
  return data;
};

export const restorePost = async (postId) => {
  const { data } = await http.post(`/posts/${postId}/restore`);
  return data;
};

export const listArchivedPosts = async ({ page = 1, limit = 10 } = {}) => {
  const { data } = await http.get("/posts/archived", { params: { page, limit } });
  return data;
};

export const permanentlyDeletePost = async (postId) => {
  const { data } = await http.delete(`/posts/${postId}/permanent`);
  return data;
};

// ---- Likes ----
export const likePost = async (postId) => {
  const { data } = await http.post(`/posts/${postId}/like`);
  return data;
};

export const unlikePost = async (postId) => {
  const { data } = await http.delete(`/posts/${postId}/like`);
  return data;
};

// ---- Comments ----
export const createPostComment = async (
  postId,
  { comment, parentCommentId } = {}
) => {
  const payload = { comment };
  if (parentCommentId) payload.parentCommentId = parentCommentId;
  const { data } = await http.post(`/posts/${postId}/comments`, payload);
  return data;
};

export const getPostComments = async (
  postId,
  { parentCommentId, page = 1, limit = 10 } = {}
) => {
  const params = { page, limit };
  if (parentCommentId) params.parentCommentId = parentCommentId;
  const { data } = await http.get(`/posts/${postId}/comments`, { params });
  return data;
};

// Stats
export const getPostStats = async (postId) => {
  const { data } = await http.get(`/posts/${postId}/stats`);
  return data;
};

// Get list of users who liked a post
export const getPostLikes = async (postId, { page = 1, limit = 50 } = {}) => {
  const { data } = await http.get(`/posts/${postId}/likes`, { params: { page, limit } });
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
