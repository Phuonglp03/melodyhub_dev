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
export const getUserProjects = async (filter = "all", status = null) => {
  try {
    const params = { filter };
    if (status) {
      params.status = status;
    }
    const res = await api.get("/projects", {
      params,
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

// Update project (partial)
export const updateProject = async (projectId, projectData) => {
  try {
    const res = await api.patch(`/projects/${projectId}`, projectData);
    return res.data;
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      "Failed to update project";
    console.error("Error updating project:", error?.response || error);
    throw new Error(message);
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

// Bulk update timeline items (buffered autosave)
export const bulkUpdateTimelineItems = async (projectId, items) => {
  try {
    const res = await api.put(`/projects/${projectId}/timeline/items/bulk`, {
      items,
    });
    return res.data;
  } catch (error) {
    console.error("Error bulk updating timeline items:", error);
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
    // Provide more specific error message
    const errorMessage =
      error?.response?.data?.message ||
      error?.message ||
      "Failed to fetch instruments";
    throw new Error(errorMessage);
  }
};

// Get rhythm patterns
export const getRhythmPatterns = async () => {
  try {
    const res = await api.get("/projects/rhythm-patterns");
    return res.data;
  } catch (error) {
    console.error("Error fetching rhythm patterns:", error);
    throw error;
  }
};

// Apply rhythm pattern to timeline item
export const applyRhythmPattern = async (
  projectId,
  itemId,
  rhythmPatternId
) => {
  try {
    const res = await api.put(
      `/projects/${projectId}/timeline/items/${itemId}/apply-pattern`,
      { rhythmPatternId }
    );
    return res.data;
  } catch (error) {
    console.error("Error applying rhythm pattern:", error);
    throw error;
  }
};

// Generate backing track from chord progression
export const generateBackingTrack = async (projectId, data) => {
  try {
    const res = await api.post(`/projects/${projectId}/generate-backing`, data);
    return res.data;
  } catch (error) {
    console.error("Error generating backing track:", error);
    throw error;
  }
};

// Generate AI backing track with Suno
export const generateAIBackingTrack = async (projectId, data) => {
  try {
    const res = await api.post(
      `/projects/${projectId}/generate-ai-backing`,
      data
    );
    return res.data;
  } catch (error) {
    console.error("Error generating AI backing track:", error);
    throw error;
  }
};

// Save exported project audio metadata (audioUrl, duration, waveformData)
export const saveProjectExport = async (projectId, data) => {
  try {
    // (NO $) [DEBUG][ProjectExport] Saving export metadata to backend
    console.log("(NO $) [DEBUG][ProjectExport] saveProjectExport:", {
      projectId,
      hasAudioUrl: !!data?.audioUrl,
      hasWaveform: Array.isArray(data?.waveformData),
      audioDuration: data?.audioDuration,
    });

    const res = await api.post(`/projects/${projectId}/export-audio`, data);
    return res.data;
  } catch (error) {
    console.error("Error saving project export:", error?.response || error);
    throw error;
  }
};

// Invite collaborator to project (backend expects email)
export const inviteCollaborator = async (
  projectId,
  email,
  role = "contributor"
) => {
  try {
    const res = await api.post(`/projects/${projectId}/invite`, {
      email: email.trim().toLowerCase(),
      role,
    });
    return res.data;
  } catch (error) {
    // Log full error for debugging
    console.error("Error inviting collaborator - Full error:", error);
    console.error("Error response:", error?.response?.data);

    // Extract error message from response
    // Check for validation errors first
    let message = "Failed to invite collaborator";

    if (error?.response?.data) {
      const errorData = error?.response?.data;

      // Handle validation errors
      if (errorData.errors && Array.isArray(errorData.errors)) {
        message = errorData.errors.map((e) => e.msg || e.message).join(", ");
      }
      // Handle regular error messages
      else if (errorData.message) {
        message = errorData.message;
      }
      // Handle error field
      else if (errorData.error) {
        message = errorData.error;
      }
    } else if (error?.message) {
      message = error.message;
    }

    throw new Error(message);
  }
};

// Remove collaborator from project
export const removeCollaborator = async (projectId, userId) => {
  try {
    const res = await api.delete(
      `/projects/${projectId}/collaborators/${userId}`
    );
    return res.data;
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      "Failed to remove collaborator";
    console.error("Error removing collaborator:", error?.response || error);
    throw new Error(message);
  }
};

// Get project collaborators (from project data - collaborators are included in getProjectById)
export const getProjectCollaborators = async (projectId) => {
  try {
    // Collaborators are included in project data from getProjectById
    const res = await api.get(`/projects/${projectId}`);
    if (res.data.success && res.data.data) {
      // Extract collaborators from project response
      const collaborators = res.data.data.collaborators || [];
      return {
        success: true,
        data: { collaborators },
      };
    }
    return { success: false, data: { collaborators: [] } };
  } catch (error) {
    console.error("Error fetching collaborators:", error);
    throw error;
  }
};
