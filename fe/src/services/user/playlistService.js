import api from "../api";

// Get community playlists (public playlists)
export const getCommunityPlaylists = async (params = {}) => {
  try {
    const {
      search = "",
      sortBy = "newest",
      page = 1,
      limit = 20,
    } = params;

    const queryParams = {
      page,
      limit,
      sortBy,
    };

    if (search) queryParams.search = search;

    const { data } = await api.get('/playlists/community', { params: queryParams });
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

    const queryParams = {
      page,
      limit,
    };

    if (search) queryParams.search = search;
    if (isPublic !== undefined) queryParams.isPublic = isPublic;

    const res = await api.get('/playlists/me', { params: queryParams });
    return res.data;
  } catch (error) {
    console.error("Error fetching playlists:", error);
    throw error;
  }
};

// Get playlist by ID with all licks
export const getPlaylistById = async (playlistId) => {
  try {
    const res = await api.get(`/playlists/${playlistId}`);
    return res.data;
  } catch (error) {
    console.error("Error fetching playlist:", error);
    throw error;
  }
};

// Create a new playlist
export const createPlaylist = async (playlistData) => {
  try {
    const res = await api.post("/playlists", playlistData);
    return res.data;
  } catch (error) {
    console.error("Error creating playlist:", error);
    throw error;
  }
};

// Update playlist
export const updatePlaylist = async (playlistId, playlistData) => {
  try {
    const res = await api.put(`/playlists/${playlistId}`, playlistData);
    return res.data;
  } catch (error) {
    console.error("Error updating playlist:", error);
    throw error;
  }
};

// Delete playlist
export const deletePlaylist = async (playlistId) => {
  try {
    const res = await api.delete(`/playlists/${playlistId}`);
    return res.data;
  } catch (error) {
    console.error("Error deleting playlist:", error);
    throw error;
  }
};

// Add lick to playlist
export const addLickToPlaylist = async (playlistId, lickId) => {
  try {
    const res = await api.post(`/playlists/${playlistId}/licks/${lickId}`);
    return res.data;
  } catch (error) {
    console.error("Error adding lick to playlist:", error);
    throw error;
  }
};

// Remove lick from playlist
export const removeLickFromPlaylist = async (playlistId, lickId) => {
  try {
    const res = await api.delete(`/playlists/${playlistId}/licks/${lickId}`);
    return res.data;
  } catch (error) {
    console.error("Error removing lick from playlist:", error);
    throw error;
  }
};

// Reorder licks in playlist
export const reorderPlaylistLicks = async (playlistId, lickIds) => {
  try {
    const res = await api.put(`/playlists/${playlistId}/reorder`, { lickIds });
    return res.data;
  } catch (error) {
    console.error("Error reordering playlist licks:", error);
    throw error;
  }
};
