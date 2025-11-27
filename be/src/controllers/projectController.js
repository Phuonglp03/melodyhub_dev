import mongoose from "mongoose";
import Project from "../models/Project.js";
import ProjectTrack from "../models/ProjectTrack.js";
import ProjectTimelineItem from "../models/ProjectTimelineItem.js";
import ProjectCollaborator from "../models/ProjectCollaborator.js";
import User from "../models/User.js";
import Lick from "../models/Lick.js";
import Instrument from "../models/Instrument.js";
import PlayingPattern from "../models/PlayingPattern.js";
import {
  getAllInstruments,
  getInstrumentById,
} from "../services/instrumentService.js";

const TRACK_TYPES = ["audio", "midi", "backing"];
const TIMELINE_ITEM_TYPES = ["lick", "chord", "midi"];

const normalizeTrackType = (value, fallback = "audio") => {
  if (typeof value !== "string") return fallback;
  const normalized = value.toLowerCase();
  return TRACK_TYPES.includes(normalized) ? normalized : fallback;
};

const normalizeTimelineItemType = (value, fallback = "lick") => {
  if (typeof value !== "string") return fallback;
  const normalized = value.toLowerCase();
  return TIMELINE_ITEM_TYPES.includes(normalized) ? normalized : fallback;
};

const sanitizeInstrumentPayload = (payload) => {
  if (!payload || typeof payload !== "object") return undefined;
  const { instrumentId, settings } = payload;
  const result = {};
  if (instrumentId) {
    result.instrumentId = instrumentId;
  }
  if (settings && typeof settings === "object") {
    result.settings = settings;
  }
  return Object.keys(result).length ? result : undefined;
};

const sanitizeMidiEvents = (events) => {
  if (!Array.isArray(events)) return [];
  return events
    .map((event) => {
      if (!event) return null;
      const pitch = Number(event.pitch);
      const startTime = Number(event.startTime);
      const duration = Number(event.duration);
      const velocity =
        event.velocity === undefined ? 0.8 : Number(event.velocity);
      if (
        !Number.isFinite(pitch) ||
        pitch < 0 ||
        pitch > 127 ||
        !Number.isFinite(startTime) ||
        startTime < 0 ||
        !Number.isFinite(duration) ||
        duration < 0
      ) {
        return null;
      }
      const clampedVelocity = velocity >= 0 && velocity <= 1 ? velocity : 0.8;
      return {
        pitch,
        startTime,
        duration,
        velocity: clampedVelocity,
      };
    })
    .filter(Boolean);
};

// Create a new project
export const createProject = async (req, res) => {
  try {
    const { title, description, tempo, key, timeSignature, isPublic } =
      req.body;
    const creatorId = req.userId;

    // Validate required fields (BR-21)
    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Project title is required",
      });
    }

    // Create project
    const project = new Project({
      creatorId,
      title,
      description: description || "",
      tempo: tempo || 120,
      key: key || "",
      timeSignature: timeSignature || "4/4",
      status: "draft",
      isPublic: isPublic || false,
    });

    await project.save();

    // Create default melody track only
    // Backing track will be created automatically when user generates backing track or adds chords
    const melodyTrack = new ProjectTrack({
      projectId: project._id,
      trackName: "01 Melody",
      trackOrder: 0,
      volume: 1.0,
      pan: 0.0,
      muted: false,
      solo: false,
    });
    await melodyTrack.save();

    // Add creator as admin collaborator
    const collaborator = new ProjectCollaborator({
      projectId: project._id,
      userId: creatorId,
      role: "admin",
    });
    await collaborator.save();

    // Populate creator info
    await project.populate("creatorId", "username displayName avatarUrl");

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create project",
      error: error.message,
    });
  }
};

// Get all projects for a user (owner or collaborator)
export const getUserProjects = async (req, res) => {
  try {
    const userId = req.userId;
    const { filter = "all" } = req.query; // "all", "my-projects", "collaborations"

    let matchQuery = {};

    if (filter === "my-projects") {
      // Only projects where user is the owner
      matchQuery = { creatorId: new mongoose.Types.ObjectId(userId) };
    } else if (filter === "collaborations") {
      // Only projects where user is a collaborator but not owner
      const collaborations = await ProjectCollaborator.find({
        userId: new mongoose.Types.ObjectId(userId),
      }).select("projectId");

      const projectIds = collaborations.map((c) => c.projectId);

      matchQuery = {
        _id: { $in: projectIds },
        creatorId: { $ne: new mongoose.Types.ObjectId(userId) },
      };
    } else {
      // All projects (owner or collaborator)
      const collaborations = await ProjectCollaborator.find({
        userId: new mongoose.Types.ObjectId(userId),
      }).select("projectId");

      const projectIds = collaborations.map((c) => c.projectId);

      matchQuery = {
        $or: [
          { creatorId: new mongoose.Types.ObjectId(userId) },
          { _id: { $in: projectIds } },
        ],
      };
    }

    const projects = await Project.find(matchQuery)
      .populate("creatorId", "username displayName avatarUrl")
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error("Error fetching user projects:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
      error: error.message,
    });
  }
};

// Get project by ID with full details
export const getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;

    // Check if user has access to this project
    const project = await Project.findById(projectId).populate(
      "creatorId",
      "username displayName avatarUrl"
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Check if user is owner or collaborator
    const isOwner = project.creatorId._id.toString() === userId;
    const isCollaborator = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!isOwner && !isCollaborator && !project.isPublic) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project",
      });
    }

    // Get tracks
    const tracks = await ProjectTrack.find({ projectId: project._id }).sort({
      trackOrder: 1,
    });

    // Get timeline items with lick details
    const timelineItems = await ProjectTimelineItem.find({
      trackId: { $in: tracks.map((t) => t._id) },
    })
      .populate("lickId", "title audioUrl duration waveformData")
      .populate("userId", "username displayName avatarUrl")
      .sort({ startTime: 1 });

    // Get collaborators
    const collaborators = await ProjectCollaborator.find({
      projectId: project._id,
    }).populate("userId", "username displayName avatarUrl");

    // Organize timeline items by track
    const tracksWithItems = tracks.map((track) => {
      const items = timelineItems.filter(
        (item) => item.trackId.toString() === track._id.toString()
      );
      return {
        ...track.toObject(),
        items: items,
      };
    });

    res.json({
      success: true,
      data: {
        project,
        tracks: tracksWithItems,
        collaborators,
        userRole: isOwner
          ? "owner"
          : isCollaborator
          ? isCollaborator.role
          : "viewer",
      },
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch project",
      error: error.message,
    });
  }
};

// Update project
export const updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;
    const {
      title,
      description,
      tempo,
      key,
      timeSignature,
      isPublic,
      status,
      backingInstrumentId,
    } = req.body;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Check if user is owner (only owner can update project)
    if (project.creatorId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the project owner can update the project",
      });
    }

    // Update fields
    if (title !== undefined) project.title = title;
    if (description !== undefined) project.description = description;
    if (tempo !== undefined) project.tempo = tempo;
    if (key !== undefined) project.key = key;
    if (timeSignature !== undefined) project.timeSignature = timeSignature;
    if (isPublic !== undefined) project.isPublic = isPublic;
    if (status !== undefined) project.status = status;
    if (backingInstrumentId !== undefined) {
      // Validate instrument exists
      if (backingInstrumentId) {
        const instrument = await getInstrumentById(backingInstrumentId);
        if (!instrument) {
          return res.status(400).json({
            success: false,
            message: "Invalid instrument ID",
          });
        }
      }
      project.backingInstrumentId = backingInstrumentId || null;
    }

    await project.save();

    res.json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update project",
      error: error.message,
    });
  }
};

// Get all available instruments
// export const getInstruments = async (req, res) => {
//   try {
//     const instruments = await getAllInstruments();

//     res.json({
//       success: true,
//       data: instruments,
//     });
//   } catch (error) {
//     console.error("Error fetching instruments:", error);
//     console.error("Error stack:", error.stack);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch instruments",
//       error: error.message || "Unknown error",
//     });
//   }
// };

// Delete project
export const deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Only owner can delete (BR-23)
    if (project.creatorId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the project owner can delete the project",
      });
    }

    // Get all track IDs first
    const trackIds = await ProjectTrack.find({
      projectId: project._id,
    }).distinct("_id");

    // Delete related data
    await ProjectTimelineItem.deleteMany({ trackId: { $in: trackIds } });
    await ProjectTrack.deleteMany({ projectId: project._id });
    await ProjectCollaborator.deleteMany({ projectId: project._id });

    // Delete project
    await Project.deleteOne({ _id: project._id });

    res.json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete project",
      error: error.message,
    });
  }
};

// Add clip to timeline
export const addLickToTimeline = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      trackId,
      lickId,
      startTime,
      duration,
      offset = 0,
      sourceDuration,
      loopEnabled = false,
      playbackRate = 1,
      type = "lick",
      chordName,
      rhythmPatternId,
      isCustomized = false,
      customMidiEvents,
    } = req.body;
    const userId = req.userId;

    if (!trackId || startTime === undefined || duration === undefined) {
      return res.status(400).json({
        success: false,
        message: "trackId, startTime, and duration are required",
      });
    }

    const normalizedType = normalizeTimelineItemType(type, "lick");
    if (normalizedType === "lick" && !lickId) {
      return res.status(400).json({
        success: false,
        message: "lickId is required when creating an audio clip",
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const isOwner = project.creatorId.toString() === userId;
    const collaborator = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!isOwner && !collaborator) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project",
      });
    }

    const track = await ProjectTrack.findById(trackId);
    if (!track || track.projectId.toString() !== projectId) {
      return res.status(404).json({
        success: false,
        message: "Track not found",
      });
    }

    let lick = null;
    if (lickId) {
      lick = await Lick.findById(lickId);
      if (!lick && normalizedType === "lick") {
        return res.status(404).json({
          success: false,
          message: "Lick not found",
        });
      }
    }

    const numericOffset = Math.max(0, Number(offset) || 0);
    const numericDuration = Math.max(0, Number(duration) || 0);
    if (numericDuration <= 0) {
      return res.status(400).json({
        success: false,
        message: "duration must be greater than zero",
      });
    }

    const requestedSourceDuration =
      typeof sourceDuration === "number" ? sourceDuration : undefined;
    const lickDuration =
      lick && typeof lick.duration === "number" ? lick.duration : undefined;
    const resolvedSourceDuration = Math.max(
      numericOffset + numericDuration,
      requestedSourceDuration || 0,
      lickDuration || 0
    );

    const sanitizedMidi = sanitizeMidiEvents(customMidiEvents);

    const timelineItem = new ProjectTimelineItem({
      trackId,
      userId,
      startTime,
      duration: numericDuration,
      offset: numericOffset,
      loopEnabled: Boolean(loopEnabled),
      playbackRate: Number(playbackRate) || 1,
      type: normalizedType === "lick" ? "lick" : normalizedType,
      lickId: lickId && normalizedType !== "chord" ? lickId : undefined,
      sourceDuration: resolvedSourceDuration,
      chordName:
        normalizedType === "chord"
          ? (chordName && chordName.trim()) || "Chord"
          : undefined,
      rhythmPatternId:
        normalizedType === "chord"
          ? rhythmPatternId || track.defaultRhythmPatternId || undefined
          : undefined,
      isCustomized: Boolean(isCustomized),
      customMidiEvents:
        sanitizedMidi.length && (normalizedType === "midi" || isCustomized)
          ? sanitizedMidi
          : [],
    });

    await timelineItem.save();

    if (timelineItem.lickId) {
      await timelineItem.populate(
        "lickId",
        "title audioUrl duration waveformData"
      );
    }
    await timelineItem.populate("userId", "username displayName avatarUrl");

    res.status(201).json({
      success: true,
      message: "Timeline item created successfully",
      data: timelineItem,
    });
  } catch (error) {
    console.error("Error adding lick to timeline:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add lick to timeline",
      error: error.message,
    });
  }
};

// Update timeline item
export const updateTimelineItem = async (req, res) => {
  try {
    const { projectId, itemId } = req.params;
    const {
      startTime,
      duration,
      trackId,
      offset,
      sourceDuration,
      loopEnabled,
      playbackRate,
      type,
      chordName,
      rhythmPatternId,
      isCustomized,
      customMidiEvents,
      lickId,
    } = req.body;
    const userId = req.userId;

    // Check if user has access to project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const isOwner = project.creatorId.toString() === userId;
    const collaborator = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!isOwner && (!collaborator || collaborator.role === "viewer")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this project",
      });
    }

    // Find and update timeline item
    const timelineItem = await ProjectTimelineItem.findById(itemId);
    if (!timelineItem) {
      return res.status(404).json({
        success: false,
        message: "Timeline item not found",
      });
    }

    // Verify item belongs to this project
    const track = await ProjectTrack.findById(timelineItem.trackId);
    if (!track || track.projectId.toString() !== projectId) {
      return res.status(404).json({
        success: false,
        message: "Timeline item does not belong to this project",
      });
    }

    // Update fields
    if (startTime !== undefined) timelineItem.startTime = startTime;
    if (duration !== undefined) timelineItem.duration = duration;
    if (offset !== undefined) {
      timelineItem.offset = Math.max(0, Number(offset) || 0);
    }
    if (loopEnabled !== undefined) {
      timelineItem.loopEnabled = Boolean(loopEnabled);
    }
    if (playbackRate !== undefined) {
      const rate = Number(playbackRate);
      timelineItem.playbackRate = Number.isFinite(rate) ? rate : 1;
    }
    if (type !== undefined) {
      timelineItem.type = normalizeTimelineItemType(type, timelineItem.type);
      if (timelineItem.type === "chord") {
        timelineItem.lickId = undefined;
      }
    }
    if (lickId !== undefined) {
      if (!lickId) {
        timelineItem.lickId = undefined;
      } else {
        const lick = await Lick.findById(lickId);
        if (!lick) {
          return res.status(404).json({
            success: false,
            message: "Lick not found",
          });
        }
        timelineItem.lickId = lickId;
        if (
          typeof lick.duration === "number" &&
          (!sourceDuration || sourceDuration < lick.duration)
        ) {
          timelineItem.sourceDuration = Math.max(
            timelineItem.offset + timelineItem.duration,
            lick.duration
          );
        }
      }
    }
    if (chordName !== undefined) {
      timelineItem.chordName =
        chordName && chordName.trim() ? chordName.trim() : undefined;
    }
    if (rhythmPatternId !== undefined) {
      timelineItem.rhythmPatternId = rhythmPatternId || undefined;
    }
    if (isCustomized !== undefined) {
      timelineItem.isCustomized = Boolean(isCustomized);
    }
    if (customMidiEvents !== undefined) {
      const sanitized = sanitizeMidiEvents(customMidiEvents);
      timelineItem.customMidiEvents = sanitized;
    }
    if (sourceDuration !== undefined) {
      const coerced = Math.max(
        Number(sourceDuration) || 0,
        timelineItem.offset + timelineItem.duration
      );
      timelineItem.sourceDuration = coerced;
    } else if (
      typeof timelineItem.sourceDuration !== "number" ||
      timelineItem.sourceDuration < timelineItem.offset + timelineItem.duration
    ) {
      timelineItem.sourceDuration = timelineItem.offset + timelineItem.duration;
    }
    if (trackId !== undefined) {
      // Verify new track belongs to project
      const newTrack = await ProjectTrack.findById(trackId);
      if (!newTrack || newTrack.projectId.toString() !== projectId) {
        return res.status(400).json({
          success: false,
          message: "Invalid track ID",
        });
      }
      timelineItem.trackId = trackId;
    }

    await timelineItem.save();

    // Populate for response
    if (timelineItem.lickId) {
      await timelineItem.populate(
        "lickId",
        "title audioUrl duration waveformData"
      );
    }
    await timelineItem.populate("userId", "username displayName avatarUrl");

    res.json({
      success: true,
      message: "Timeline item updated successfully",
      data: timelineItem,
    });
  } catch (error) {
    console.error("Error updating timeline item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update timeline item",
      error: error.message,
    });
  }
};

// Bulk update timeline items (for buffered autosave)
export const bulkUpdateTimelineItems = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { items } = req.body || {};
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({
        success: false,
        message: "items array is required",
      });
    }

    let project;
    try {
      project = await Project.findById(projectId);
    } catch (err) {
      console.error("Error finding project:", err);
      return res.status(500).json({
        success: false,
        message: "Database error finding project",
        error: err.message,
      });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const isOwner = project.creatorId.toString() === userId;
    let collaborator = null;

    if (!isOwner) {
      try {
        collaborator = await ProjectCollaborator.findOne({
          projectId: project._id,
          userId: new mongoose.Types.ObjectId(userId),
        });
      } catch (err) {
        console.error("Error checking collaborator:", err);
        // Continue as if not collaborator, will fail permission check below
      }
    }

    if (!isOwner && (!collaborator || collaborator.role === "viewer")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this project",
      });
    }

    const sanitizeOne = (payload = {}) => {
      const update = {};
      if (payload.startTime !== undefined) {
        update.startTime = Math.max(0, Number(payload.startTime) || 0);
      }
      if (payload.duration !== undefined) {
        update.duration = Math.max(0, Number(payload.duration) || 0);
      }
      if (payload.offset !== undefined) {
        update.offset = Math.max(0, Number(payload.offset) || 0);
      }
      if (payload.loopEnabled !== undefined) {
        update.loopEnabled = Boolean(payload.loopEnabled);
      }
      if (payload.playbackRate !== undefined) {
        update.playbackRate = Number(payload.playbackRate) || 1;
      }
      if (payload.sourceDuration !== undefined) {
        update.sourceDuration = Math.max(
          0,
          Number(payload.sourceDuration) || 0
        );
      }
      return update;
    };

    const results = await Promise.allSettled(
      items.map(async (raw) => {
        try {
          const { _id, itemId, trackId, ...rest } = raw || {};
          const resolvedId = itemId || _id;

          if (!resolvedId || !mongoose.Types.ObjectId.isValid(resolvedId)) {
            return {
              success: false,
              id: resolvedId,
              error: "Invalid or missing item ID",
            };
          }

          // We don't need to fetch the item if we just want to update it by ID
          // But we need to verify it belongs to the project.
          // Optimization: Fetch only trackId to verify project ownership
          const timelineItem = await ProjectTimelineItem.findById(
            resolvedId
          ).select("trackId");

          if (!timelineItem) {
            return {
              success: false,
              id: resolvedId,
              error: "Timeline item not found",
            };
          }

          const track = await ProjectTrack.findById(
            timelineItem.trackId
          ).select("projectId");
          if (!track || track.projectId.toString() !== projectId) {
            return {
              success: false,
              id: resolvedId,
              error: "Track not found or doesn't belong to project",
            };
          }

          const update = sanitizeOne(rest);
          if (!Object.keys(update).length) {
            return {
              success: false,
              id: resolvedId,
              error: "No valid fields to update",
            };
          }

          await ProjectTimelineItem.updateOne(
            { _id: resolvedId },
            { $set: update }
          );
          return { success: true, id: resolvedId };
        } catch (err) {
          return {
            success: false,
            id: raw?._id || raw?.itemId || null,
            error: err.message,
          };
        }
      })
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value?.success
    ).length;
    const failed = results.length - successful;

    if (failed > 0) {
      const errors = results
        .filter((r) => r.status === "rejected" || !r.value?.success)
        .map((r) =>
          r.status === "rejected"
            ? r.reason?.message || "Unknown error"
            : r.value?.error || "Update failed"
        );
      console.error("Some timeline items failed to update:", errors);
    }

    return res.json({
      success: true,
      message: `Timeline items updated: ${successful} successful, ${failed} failed`,
      updated: successful,
      failed,
    });
  } catch (error) {
    console.error("Error bulk updating timeline items:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update timeline items",
      error: error.message,
    });
  }
};

// Delete timeline item
export const deleteTimelineItem = async (req, res) => {
  try {
    const { projectId, itemId } = req.params;
    const userId = req.userId;

    // Check if user has access to project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const isOwner = project.creatorId.toString() === userId;
    const collaborator = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!isOwner && (!collaborator || collaborator.role === "viewer")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this project",
      });
    }

    // Find and delete timeline item
    const timelineItem = await ProjectTimelineItem.findById(itemId);
    if (!timelineItem) {
      return res.status(404).json({
        success: false,
        message: "Timeline item not found",
      });
    }

    // Verify item belongs to this project
    const track = await ProjectTrack.findById(timelineItem.trackId);
    if (!track || track.projectId.toString() !== projectId) {
      return res.status(404).json({
        success: false,
        message: "Timeline item does not belong to this project",
      });
    }

    await ProjectTimelineItem.deleteOne({ _id: itemId });

    res.json({
      success: true,
      message: "Timeline item deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting timeline item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete timeline item",
      error: error.message,
    });
  }
};

// Update chord progression
export const updateChordProgression = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { chordProgression } = req.body; // Array of chord strings OR chord objects
    const userId = req.userId;

    // Check if user has access to project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const isOwner = project.creatorId.toString() === userId;
    const collaborator = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!isOwner && (!collaborator || collaborator.role === "viewer")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this project",
      });
    }

    // Normalize and update chord progression.
    // We store only full chord names as strings, e.g. ["C", "Am", "G7"]
    const normalizedChords = Array.isArray(chordProgression)
      ? chordProgression
          .map((entry) => {
            if (!entry) return null;
            if (typeof entry === "string") return entry.trim();
            // Support objects coming from older clients: { chordName, name, label, ... }
            const name =
              entry.chordName || entry.name || entry.label || entry.fullName;
            return typeof name === "string" ? name.trim() : null;
          })
          .filter((name) => !!name)
      : [];

    project.chordProgression = normalizedChords;
    await project.save();

    res.json({
      success: true,
      message: "Chord progression updated successfully",
      data: project,
    });
  } catch (error) {
    console.error("Error updating chord progression:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update chord progression",
      error: error.message,
    });
  }
};

// Add track to project
export const addTrack = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      trackName,
      trackType,
      isBackingTrack,
      color,
      trackOrder,
      volume,
      pan,
      muted,
      solo,
      instrument,
      defaultRhythmPatternId,
    } = req.body;
    const userId = req.userId;

    // Check if user has access to project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const isOwner = project.creatorId.toString() === userId;
    const collaborator = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!isOwner && (!collaborator || collaborator.role === "viewer")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this project",
      });
    }

    const normalizedTrackType = normalizeTrackType(trackType, "audio");
    const wantsBackingTrack =
      isBackingTrack === true || normalizedTrackType === "backing";

    if (wantsBackingTrack) {
      const existingBacking = await ProjectTrack.findOne({
        projectId: project._id,
        $or: [{ isBackingTrack: true }, { trackType: "backing" }],
      });

      if (existingBacking) {
        return res.status(400).json({
          success: false,
          message:
            "This project already has a backing track. Remove it before creating another.",
        });
      }
    }

    // Determine track order
    let orderValue = Number(trackOrder);
    if (!Number.isFinite(orderValue)) {
      const maxOrder = await ProjectTrack.findOne({ projectId: project._id })
        .sort({ trackOrder: -1 })
        .select("trackOrder");
      orderValue = (maxOrder?.trackOrder || 0) + 1;
    }

    const newTrack = new ProjectTrack({
      projectId: project._id,
      trackName:
        trackName?.trim() || `Track ${String(orderValue).padStart(2, "0")}`,
      trackOrder: orderValue,
      trackType: wantsBackingTrack ? "backing" : normalizedTrackType,
      isBackingTrack: !!wantsBackingTrack,
      color: color || "#2563eb",
      volume: Number.isFinite(volume) ? volume : 1.0,
      pan: Number.isFinite(pan) ? pan : 0.0,
      muted: typeof muted === "boolean" ? muted : false,
      solo: typeof solo === "boolean" ? solo : false,
      instrument: sanitizeInstrumentPayload(instrument),
      defaultRhythmPatternId,
    });

    await newTrack.save();

    res.status(201).json({
      success: true,
      message: "Track added successfully",
      data: newTrack,
    });
  } catch (error) {
    console.error("Error adding track:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add track",
      error: error.message,
    });
  }
};

// Update track
export const updateTrack = async (req, res) => {
  try {
    const { projectId, trackId } = req.params;
    const {
      trackName,
      volume,
      pan,
      muted,
      solo,
      trackOrder,
      trackType,
      isBackingTrack,
      color,
      instrument,
      defaultRhythmPatternId,
    } = req.body;
    const userId = req.userId;

    // Check if user has access to project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const isOwner = project.creatorId.toString() === userId;
    const collaborator = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!isOwner && (!collaborator || collaborator.role === "viewer")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this project",
      });
    }

    // Find and update track
    const track = await ProjectTrack.findById(trackId);
    if (!track || track.projectId.toString() !== projectId) {
      return res.status(404).json({
        success: false,
        message: "Track not found",
      });
    }

    if (trackName !== undefined) track.trackName = trackName;
    if (volume !== undefined) track.volume = volume;
    if (pan !== undefined) track.pan = pan;
    if (muted !== undefined) track.muted = muted;
    if (solo !== undefined) track.solo = solo;
    if (trackOrder !== undefined) track.trackOrder = trackOrder;

    // Prevent multiple backing tracks when updating
    const normalizedIncomingType = normalizeTrackType(
      trackType,
      track.trackType || "audio"
    );
    const wantsBackingTrackUpdate =
      isBackingTrack === true || normalizedIncomingType === "backing";

    if (wantsBackingTrackUpdate && !track.isBackingTrack) {
      const existingBacking = await ProjectTrack.findOne({
        projectId: project._id,
        _id: { $ne: track._id },
        $or: [{ isBackingTrack: true }, { trackType: "backing" }],
      });

      if (existingBacking) {
        return res.status(400).json({
          success: false,
          message:
            "This project already has a backing track. Remove it before converting another track.",
        });
      }
    }

    if (trackType !== undefined) {
      track.trackType = normalizedIncomingType;
      track.isBackingTrack = normalizedIncomingType === "backing";
    }
    if (isBackingTrack !== undefined) {
      track.isBackingTrack = isBackingTrack;
      if (isBackingTrack && !track.trackType) {
        track.trackType = "backing";
      }
    }
    if (color !== undefined) {
      track.color = color;
    }
    if (instrument !== undefined) {
      track.instrument = sanitizeInstrumentPayload(instrument) || undefined;
    }
    if (defaultRhythmPatternId !== undefined) {
      track.defaultRhythmPatternId = defaultRhythmPatternId || undefined;
    }

    await track.save();

    res.json({
      success: true,
      message: "Track updated successfully",
      data: track,
    });
  } catch (error) {
    console.error("Error updating track:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update track",
      error: error.message,
    });
  }
};

// Delete track
export const deleteTrack = async (req, res) => {
  try {
    const { projectId, trackId } = req.params;
    const userId = req.userId;

    // Check if user has access to project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const isOwner = project.creatorId.toString() === userId;
    const collaborator = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!isOwner && (!collaborator || collaborator.role === "viewer")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this project",
      });
    }

    // Find and delete track
    const track = await ProjectTrack.findById(trackId);
    if (!track || track.projectId.toString() !== projectId) {
      return res.status(404).json({
        success: false,
        message: "Track not found",
      });
    }

    // Delete all timeline items on this track
    await ProjectTimelineItem.deleteMany({ trackId: track._id });

    // Delete track
    await ProjectTrack.deleteOne({ _id: trackId });

    res.json({
      success: true,
      message: "Track deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting track:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete track",
      error: error.message,
    });
  }
};

// Get all rhythm patterns
export const getRhythmPatterns = async (req, res) => {
  try {
    const PlayingPattern = (await import("../models/PlayingPattern.js"))
      .default;

    const patterns = await PlayingPattern.find({}).sort({ name: 1 });

    res.json({
      success: true,
      data: patterns,
    });
  } catch (error) {
    console.error("Error fetching rhythm patterns:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch rhythm patterns",
      error: error.message,
    });
  }
};

// Apply rhythm pattern to a timeline item
export const applyRhythmPattern = async (req, res) => {
  try {
    const { projectId, itemId } = req.params;
    const { rhythmPatternId } = req.body;
    const userId = req.userId;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const isOwner = project.creatorId.toString() === userId;
    const collaborator = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!isOwner && (!collaborator || collaborator.role === "viewer")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this project",
      });
    }

    const timelineItem = await ProjectTimelineItem.findById(itemId);
    if (!timelineItem) {
      return res.status(404).json({
        success: false,
        message: "Timeline item not found",
      });
    }

    const track = await ProjectTrack.findById(timelineItem.trackId);
    if (!track || track.projectId.toString() !== projectId) {
      return res.status(404).json({
        success: false,
        message: "Timeline item does not belong to this project",
      });
    }

    // Update the rhythm pattern
    timelineItem.rhythmPatternId = rhythmPatternId || undefined;
    await timelineItem.save();

    // Populate for response
    if (timelineItem.lickId) {
      await timelineItem.populate(
        "lickId",
        "title audioUrl duration waveformData"
      );
    }
    await timelineItem.populate("userId", "username displayName avatarUrl");

    res.json({
      success: true,
      message: "Rhythm pattern applied successfully",
      data: timelineItem,
    });
  } catch (error) {
    console.error("Error applying rhythm pattern:", error);
    res.status(500).json({
      success: false,
      message: "Failed to apply rhythm pattern",
      error: error.message,
    });
  }
};

// Generate backing track from chord progression
export const generateBackingTrack = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      chords,
      instrumentId,
      rhythmPatternId,
      chordDuration = 4, // duration in beats
      generateAudio = false, // Flag to generate audio files
    } = req.body;
    const userId = req.userId;

    if (!Array.isArray(chords) || chords.length === 0) {
      return res.status(400).json({
        success: false,
        message: "chords array is required and cannot be empty",
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const isOwner = project.creatorId.toString() === userId;
    const collaborator = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!isOwner && !collaborator) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project",
      });
    }

    // Find or create backing track
    let backingTrack = await ProjectTrack.findOne({
      projectId: project._id,
      trackType: "backing",
    });

    if (!backingTrack) {
      backingTrack = new ProjectTrack({
        projectId: project._id,
        trackName: "Backing Track",
        trackType: "backing",
        trackOrder: 0,
        volume: 1.0,
        pan: 0.0,
        muted: false,
        solo: false,
        instrument: instrumentId ? { instrumentId } : undefined,
        defaultRhythmPatternId: rhythmPatternId || undefined,
      });
      await backingTrack.save();
    } else if (instrumentId || rhythmPatternId) {
      // Update backing track instrument and pattern if provided
      if (instrumentId) {
        backingTrack.instrument = { instrumentId };
      }
      if (rhythmPatternId) {
        backingTrack.defaultRhythmPatternId = rhythmPatternId;
      }
      await backingTrack.save();
    }

    // Get instrument for MIDI program number
    let instrumentProgram = 0; // Default: Acoustic Grand Piano
    if (instrumentId) {
      const instrument = await Instrument.findById(instrumentId);
      if (instrument && instrument.soundfontKey) {
        // Map soundfont keys to MIDI program numbers
        const programMap = {
          acoustic_grand_piano: 0,
          electric_piano: 4,
          electric_guitar_clean: 27,
          acoustic_bass: 32,
          synth_lead: 80,
        };
        instrumentProgram = programMap[instrument.soundfontKey] || 0;
      }
    }

    // Generate MIDI file
    const { generateMIDIFile } = await import("../utils/midiGenerator.js");

    const midiFile = await generateMIDIFile(chords, {
      tempo: project.tempo || 120,
      chordDuration,
      instrumentProgram,
      projectId: project._id.toString(),
    });

    if (!midiFile.success) {
      throw new Error("Failed to generate MIDI file");
    }

    // Generate audio directly from chords if generateAudio flag is set
    // This is more efficient than converting MIDI to audio
    // The audio generator will convert chord names to MIDI notes if needed
    let audioFile = null;
    if (generateAudio) {
      try {
        console.log(
          `[Backing Track] Generating audio from ${chords.length} chords...`
        );
        const { convertMIDIToAudioAuto } = await import(
          "../utils/midiToAudioConverter.js"
        );
        // Pass all chords - the converter will handle chord name to MIDI conversion
        // Also pass rhythmPatternId to apply rhythm patterns
        audioFile = await convertMIDIToAudioAuto(chords, {
          tempo: project.tempo || 120,
          chordDuration,
          sampleRate: 44100,
          uploadToCloud: true, // Upload to Cloudinary
          cloudinaryFolder: `projects/${projectId}/backing_tracks`,
          projectId: project._id.toString(),
          rhythmPatternId: rhythmPatternId, // Pass rhythm pattern to apply timing
        });
        console.log(
          "[Backing Track] Audio generated and uploaded to Cloudinary:",
          audioFile.cloudinaryUrl || audioFile.url
        );
        console.log(
          "[Backing Track] Full audioFile object:",
          JSON.stringify(audioFile, null, 2)
        );
      } catch (conversionError) {
        console.error(
          "[Backing Track] Audio generation failed:",
          conversionError.message
        );
        console.error("[Backing Track] Error details:", conversionError);
        // Continue with MIDI file if conversion fails - frontend will handle it
        console.warn(
          "[Backing Track] Falling back to MIDI file (may not play in browser)"
        );
      }
    }

    // Delete ALL existing items on this backing track
    await ProjectTimelineItem.deleteMany({ trackId: backingTrack._id });

    const tempo = project.tempo || 120;
    const secondsPerBeat = 60 / tempo;
    const chordDurationSeconds = chordDuration * secondsPerBeat;
    const items = [];

    // Use Cloudinary URL if conversion succeeded, otherwise use MIDI URL
    const audioUrl = audioFile
      ? audioFile.cloudinaryUrl || audioFile.url
      : midiFile?.url || null;

    console.log(
      `[Backing Track] audioFile exists: ${!!audioFile}, midiFile.url: ${
        midiFile?.url
      }`
    );
    console.log(
      `[Backing Track] Final audioUrl to use: ${
        audioUrl || "NONE - THIS IS A PROBLEM!"
      }`
    );

    if (!audioUrl) {
      console.error(
        "[Backing Track] ERROR: No audioUrl available! Audio generation failed and MIDI URL is missing."
      );
      console.error(
        "[Backing Track] audioFile:",
        audioFile ? JSON.stringify(audioFile, null, 2) : "null"
      );
      console.error(
        "[Backing Track] midiFile:",
        midiFile ? JSON.stringify(midiFile, null, 2) : "null"
      );
    }

    // Create individual timeline items for each chord
    for (let i = 0; i < chords.length; i++) {
      const chord = chords[i];
      const startTime = i * chordDurationSeconds;

      const timelineItem = new ProjectTimelineItem({
        trackId: backingTrack._id,
        userId,
        startTime: startTime,
        duration: chordDurationSeconds,
        offset: i * chordDurationSeconds, // Offset into the full audio file
        loopEnabled: false,
        playbackRate: 1,
        type: "chord", // Use 'chord' type for backing track items
        chordName: chord.chordName || chord.name || `Chord ${i + 1}`,
        rhythmPatternId: rhythmPatternId || undefined,
        audioUrl: audioUrl || null, // Use audio URL if converted, otherwise MIDI (or null if both failed)
        isCustomized: false,
      });

      await timelineItem.save();

      // Log if audioUrl is missing
      if (!timelineItem.audioUrl) {
        console.warn(
          `[Backing Track] Timeline item ${timelineItem._id} (${
            chord.chordName || chord.name
          }) has no audioUrl!`
        );
      }

      items.push(timelineItem);
    }

    res.status(201).json({
      success: true,
      message:
        generateAudio && audioFile
          ? `Backing track audio generated with ${chords.length} chord clips`
          : `Backing track ${audioFile ? "audio" : "MIDI"} generated with ${
              chords.length
            } chord clips`,
      data: {
        track: backingTrack,
        items: items, // Return array of items for frontend
        midiFile: {
          filename: midiFile.filename,
          url: midiFile.url,
        },
        audioFile: audioFile
          ? {
              filename: audioFile.filename,
              url: audioFile.url,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error generating backing track:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate backing track",
      error: error.message,
    });
  }
};

// Get available instruments
export const getInstruments = async (req, res) => {
  try {
    const instruments = await Instrument.find().sort({ name: 1 });
    res.json({
      success: true,
      data: instruments,
    });
  } catch (error) {
    console.error("Error fetching instruments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch instruments",
      error: error.message,
    });
  }
};

// Get rhythm patterns
// export const getRhythmPatterns = async (req, res) => {
//   try {
//     const patterns = await PlayingPattern.find().sort({ name: 1 });
//     res.json({
//       success: true,
//       data: patterns,
//     });
//   } catch (error) {
//     console.error("Error fetching rhythm patterns:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch rhythm patterns",
//       error: error.message,
//     });
//   }
// };
