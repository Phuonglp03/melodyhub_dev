import api from "../api";

// Get community licks with search, filter, sort, and pagination
export const getCommunityLicks = async (params = {}) => {
  try {
    const {
      search = "",
      tags = "",
      sortBy = "newest",
      page = 1,
      limit = 20,
    } = params;

    const queryParams = {
      search,
      tags,
      sortBy,
      page,
      limit,
    };

    const { data } = await api.get('/licks/community', { params: queryParams });
    return data;
  } catch (error) {
    console.error("Error fetching community licks:", error);
    throw error;
  }
};

export const getMyLicks = async (params = {}) => {
  try {
    const queryParams = { page: 1, limit: 50, ...params };
    const res = await api.get(`/licks/user/me`, { params: queryParams });
    return res.data;
  } catch (error) {
    console.error("Error fetching my licks:", error);
    throw error;
  }
};

// Get lick by ID with full details
export const getLickById = async (lickId) => {
  try {
    const { data } = await api.get(`/licks/${lickId}`);
    return data;
  } catch (error) {
    console.error("Error fetching lick by ID:", error);
    throw error;
  }
};

// Like/Unlike a lick
export const toggleLickLike = async (lickId, userId) => {
  try {
    const res = await api.post(`/licks/${lickId}/like`, { userId });
    return res.data;
  } catch (error) {
    console.error("Error toggling lick like:", error);
    throw error;
  }
};

// Get comments for a lick
export const getLickComments = async (lickId, page = 1, limit = 10) => {
  try {
    const queryParams = {
      page,
      limit,
    };

    const { data } = await api.get(`/licks/${lickId}/comments`, { params: queryParams });
    return data;
  } catch (error) {
    console.error("Error fetching lick comments:", error);
    throw error;
  }
};

// Add comment to a lick
export const addLickComment = async (lickId, commentData) => {
  try {
    const { userId, comment, parentCommentId, timestamp } = commentData;
    const res = await api.post(`/licks/${lickId}/comments`, {
      userId,
      comment,
      parentCommentId,
      timestamp,
    });
    return res.data;
  } catch (error) {
    console.error("Error adding lick comment:", error);
    throw error;
  }
};

// Update a lick comment
export const updateLickComment = async (lickId, commentId, comment) => {
  try {
    const res = await api.put(`/licks/${lickId}/comments/${commentId}`, { comment });
    return res.data;
  } catch (error) {
    console.error("Error updating lick comment:", error);
    throw error;
  }
};

// Delete a lick comment
export const deleteLickComment = async (lickId, commentId) => {
  try {
    const res = await api.delete(`/licks/${lickId}/comments/${commentId}`);
    return res.data;
  } catch (error) {
    console.error("Error deleting lick comment:", error);
    throw error;
  }
};

// Play Lick Audio - Get audio URL for playback
export const playLickAudio = async (lickId, userId = null) => {
  try {
    const params = userId ? { userId } : {};
    const { data } = await api.get(`/licks/${lickId}/play`, { params });
    return data;
  } catch (error) {
    console.error("Error playing lick audio:", error);
    throw error;
  }
};

// Create a new lick with audio file
export const createLick = async (formData) => {
  try {
    const res = await api.post(`/licks`, formData);
    return res.data;
  } catch (error) {
    console.error("Error creating lick:", error);
    throw error;
  }
};

// Update a lick
export const updateLick = async (lickId, lickData) => {
  try {
    const { data } = await api.put(`/licks/${lickId}`, lickData);
    return data;
  } catch (error) {
    console.error("Error updating lick:", error);
    throw error;
  }
};

// Delete a lick
export const deleteLick = async (lickId) => {
  try {
    const { data } = await api.delete(`/licks/${lickId}`);
    return data;
  } catch (error) {
    console.error("Error deleting lick:", error);
    throw error;
  }
};
