import api from "../api";

// Create a new project
export const createProject = async (projectData) => {
  try {
    const res = await api.post("/projects", projectData);
    return res.data;
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
};

// Get all projects for the current user
export const getUserProjects = async (filter = "all") => {
  try {
    const res = await api.get("/projects", {
      params: { filter },
    });
    return res.data;
  } catch (error) {
    console.error("Error fetching user projects:", error);
    throw error;
  }
};

// Get project by ID with full details
export const getProjectById = async (projectId) => {
  try {
    const res = await api.get(`/projects/${projectId}`);
    return res.data;
  } catch (error) {
    console.error("Error fetching project:", error);
    throw error;
  }
};

// Update project
export const updateProject = async (projectId, projectData) => {
  try {
    const res = await api.put(`/projects/${projectId}`, projectData);
    return res.data;
  } catch (error) {
    console.error("Error updating project:", error);
    throw error;
  }
};

// Delete project
export const deleteProject = async (projectId) => {
  try {
    const res = await api.delete(`/projects/${projectId}`);
    return res.data;
  } catch (error) {
    console.error("Error deleting project:", error);
    throw error;
  }
};

// Add lick to timeline
export const addLickToTimeline = async (projectId, timelineData) => {
  try {
    const res = await api.post(
      `/projects/${projectId}/timeline/items`,
      timelineData
    );
    return res.data;
  } catch (error) {
    console.error("Error adding lick to timeline:", error);
    throw error;
  }
};

// Update timeline item
export const updateTimelineItem = async (projectId, itemId, updateData) => {
  try {
    const res = await api.put(
      `/projects/${projectId}/timeline/items/${itemId}`,
      updateData
    );
    return res.data;
  } catch (error) {
    console.error("Error updating timeline item:", error);
    throw error;
  }
};

// Delete timeline item
export const deleteTimelineItem = async (projectId, itemId) => {
  try {
    const res = await api.delete(
      `/projects/${projectId}/timeline/items/${itemId}`
    );
    return res.data;
  } catch (error) {
    console.error("Error deleting timeline item:", error);
    throw error;
  }
};

// Update chord progression
export const updateChordProgression = async (projectId, chordProgression) => {
  try {
    const res = await api.put(`/projects/${projectId}/chords`, {
      chordProgression,
    });
    return res.data;
  } catch (error) {
    console.error("Error updating chord progression:", error);
    throw error;
  }
};

// Add track to project
export const addTrack = async (projectId, trackData) => {
  try {
    const res = await api.post(`/projects/${projectId}/tracks`, trackData);
    return res.data;
  } catch (error) {
    console.error("Error adding track:", error);
    throw error;
  }
};

// Update track
export const updateTrack = async (projectId, trackId, trackData) => {
  try {
    const res = await api.put(
      `/projects/${projectId}/tracks/${trackId}`,
      trackData
    );
    return res.data;
  } catch (error) {
    console.error("Error updating track:", error);
    throw error;
  }
};

// Delete track
export const deleteTrack = async (projectId, trackId) => {
  try {
    const res = await api.delete(`/projects/${projectId}/tracks/${trackId}`);
    return res.data;
  } catch (error) {
    console.error("Error deleting track:", error);
    throw error;
  }
};

// Get available instruments
export const getInstruments = async () => {
  try {
    const res = await api.get("/projects/instruments");
    return res.data;
  } catch (error) {
    console.error("Error fetching instruments:", error);
    throw error;
  }
};
