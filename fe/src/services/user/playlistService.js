import { API_CONFIG } from "../../config/api";
import http from "../../services/http";

const API_BASE_URL = API_CONFIG.API_BASE_URL;
const API_BASE = (() => {
  const t = (API_BASE_URL || "").replace(/\/$/, "");
  return t.endsWith("/api") ? t : `${t}/api`;
})();

// Get community playlists (public playlists)
export const getCommunityPlaylists = async (params = {}) => {
  try {
    const {
      search = "",
      sortBy = "newest",
      page = 1,
      limit = 20,
    } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
    });

    if (search) queryParams.append("search", search);

    const response = await fetch(`${API_BASE}/playlists/community?${queryParams}`, {
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
    console.error("Error fetching community playlists:", error);
    throw error;
  }
};

// Get user's playlists
export const getMyPlaylists = async (params = {}) => {
  try {
    const {
      search = "",
      isPublic,
      page = 1,
      limit = 20,
    } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (search) queryParams.append("search", search);
    if (isPublic !== undefined) queryParams.append("isPublic", isPublic.toString());

    const res = await http.get(`/playlists/me?${queryParams}`);
    return res.data;
  } catch (error) {
    console.error("Error fetching playlists:", error);
    throw error;
  }
};

// Get playlist by ID with all licks
export const getPlaylistById = async (playlistId) => {
  try {
    const res = await http.get(`/playlists/${playlistId}`);
    return res.data;
  } catch (error) {
    console.error("Error fetching playlist:", error);
    throw error;
  }
};

// Create a new playlist
export const createPlaylist = async (playlistData) => {
  try {
    const res = await http.post("/playlists", playlistData);
    return res.data;
  } catch (error) {
    console.error("Error creating playlist:", error);
    throw error;
  }
};

// Update playlist
export const updatePlaylist = async (playlistId, playlistData) => {
  try {
    const res = await http.put(`/playlists/${playlistId}`, playlistData);
    return res.data;
  } catch (error) {
    console.error("Error updating playlist:", error);
    throw error;
  }
};

// Delete playlist
export const deletePlaylist = async (playlistId) => {
  try {
    const res = await http.delete(`/playlists/${playlistId}`);
    return res.data;
  } catch (error) {
    console.error("Error deleting playlist:", error);
    throw error;
  }
};

// Add lick to playlist
export const addLickToPlaylist = async (playlistId, lickId) => {
  try {
    const res = await http.post(`/playlists/${playlistId}/licks/${lickId}`);
    return res.data;
  } catch (error) {
    console.error("Error adding lick to playlist:", error);
    throw error;
  }
};

// Remove lick from playlist
export const removeLickFromPlaylist = async (playlistId, lickId) => {
  try {
    const res = await http.delete(`/playlists/${playlistId}/licks/${lickId}`);
    return res.data;
  } catch (error) {
    console.error("Error removing lick from playlist:", error);
    throw error;
  }
};

// Reorder licks in playlist
export const reorderPlaylistLicks = async (playlistId, lickIds) => {
  try {
    const res = await http.put(`/playlists/${playlistId}/reorder`, { lickIds });
    return res.data;
  } catch (error) {
    console.error("Error reordering playlist licks:", error);
    throw error;
  }
};

