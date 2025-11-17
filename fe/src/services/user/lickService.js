import { API_CONFIG } from "../../config/api";
import http from "../../services/http";

const API_BASE_URL = API_CONFIG.API_BASE_URL;
// Normalize to always include '/api'
const API_BASE = (() => {
  const t = (API_BASE_URL || "").replace(/\/$/, "");
  return t.endsWith("/api") ? t : `${t}/api`;
})();

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

    const queryParams = new URLSearchParams({
      search,
      tags,
      sortBy,
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await fetch(`${API_BASE}/licks/community?${queryParams}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching community licks:", error);
    throw error;
  }
};

export const getMyLicks = async (params = {}) => {
  try {
    const queryParams = { page: 1, limit: 50, ...params };
    const res = await http.get(`/licks/user/me`, { params: queryParams });
    return res.data;
  } catch (error) {
    console.error("Error fetching my licks:", error);
    throw error;
  }
};

// Get lick by ID with full details
export const getLickById = async (lickId) => {
  try {
    const response = await fetch(`${API_BASE}/licks/${lickId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching lick by ID:", error);
    throw error;
  }
};

// Like/Unlike a lick
export const toggleLickLike = async (lickId, userId) => {
  try {
    // Use shared axios client to include Authorization header
    const res = await http.post(`/licks/${lickId}/like`, { userId });
    return res.data;
  } catch (error) {
    console.error("Error toggling lick like:", error);
    throw error;
  }
};

// Get comments for a lick
export const getLickComments = async (lickId, page = 1, limit = 10) => {
  try {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await fetch(
      `${API_BASE}/licks/${lickId}/comments?${queryParams}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
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
    // Use axios client to include Authorization
    const res = await http.post(`/licks/${lickId}/comments`, {
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
    const res = await http.put(`/licks/${lickId}/comments/${commentId}`, { comment });
    return res.data;
  } catch (error) {
    console.error("Error updating lick comment:", error);
    throw error;
  }
};

// Delete a lick comment
export const deleteLickComment = async (lickId, commentId) => {
  try {
    const res = await http.delete(`/licks/${lickId}/comments/${commentId}`);
    return res.data;
  } catch (error) {
    console.error("Error deleting lick comment:", error);
    throw error;
  }
};

// Play Lick Audio - Get audio URL for playback
export const playLickAudio = async (lickId, userId = null) => {
  try {
    const queryParams = userId
      ? new URLSearchParams({ userId: userId.toString() })
      : "";

    const response = await fetch(
      `${API_BASE}/licks/${lickId}/play${queryParams ? `?${queryParams}` : ""}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error playing lick audio:", error);
    throw error;
  }
};

// Create a new lick with audio file
export const createLick = async (formData) => {
  try {
    // Use shared axios client so Authorization header is attached
    const res = await http.post(`/licks`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch (error) {
    console.error("Error creating lick:", error);
    throw error;
  }
};

// Update a lick
export const updateLick = async (lickId, lickData) => {
  try {
    const response = await fetch(`${API_BASE}/licks/${lickId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(lickData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || `HTTP error! status: ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating lick:", error);
    throw error;
  }
};

// Delete a lick
export const deleteLick = async (lickId) => {
  try {
    const response = await fetch(`${API_BASE}/licks/${lickId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || `HTTP error! status: ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error deleting lick:", error);
    throw error;
  }
};
