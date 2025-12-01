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
import {
  normalizeKeyPayload,
  normalizeTimeSignaturePayload,
  clampSwingAmount,
  DEFAULT_KEY,
  DEFAULT_TIME_SIGNATURE,
} from "../utils/musicTheory.js";

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

const ensureProjectCoreFields = (project) => {
  if (!project) return;

  const needsKeyNormalization =
    !project.key ||
    typeof project.key !== "object" ||
    typeof project.key.root !== "number" ||
    project.key.root < 0 ||
    project.key.root > 11 ||
    typeof project.key.scale !== "string";

  if (needsKeyNormalization) {
    project.key = normalizeKeyPayload(project.key);
  }

  const needsTimeSignatureNormalization =
    !project.timeSignature ||
    typeof project.timeSignature !== "object" ||
    typeof project.timeSignature.numerator !== "number" ||
    typeof project.timeSignature.denominator !== "number";

  if (needsTimeSignatureNormalization) {
    project.timeSignature = normalizeTimeSignaturePayload(
      project.timeSignature
    );
  }
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

const clampTempo = (value, fallback = 120) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(300, Math.max(40, Math.round(numeric)));
};

const normalizeProjectResponse = (projectDoc) => {
  if (!projectDoc) return projectDoc;
  const plain =
    typeof projectDoc.toObject === "function"
      ? projectDoc.toObject()
      : { ...projectDoc };
  plain.key = normalizeKeyPayload(plain.key ?? DEFAULT_KEY);
  plain.timeSignature = normalizeTimeSignaturePayload(
    plain.timeSignature ?? DEFAULT_TIME_SIGNATURE
  );
  plain.swingAmount = clampSwingAmount(
    plain.swingAmount !== undefined ? plain.swingAmount : 0
  );
  return plain;
};

// Create a new project
export const createProject = async (req, res) => {
  try {
    const {
      title,
      description,
      tempo,
      key,
      timeSignature,
      isPublic,
      swingAmount,
    } = req.body;
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
      tempo: clampTempo(tempo),
      key: normalizeKeyPayload(key),
      timeSignature: normalizeTimeSignaturePayload(timeSignature),
      swingAmount: clampSwingAmount(
        swingAmount !== undefined ? swingAmount : 0
      ),
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
      data: normalizeProjectResponse(project),
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
      data: projects.map((project) => normalizeProjectResponse(project)),
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
        project: normalizeProjectResponse(project),
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
    if (tempo !== undefined) {
      project.tempo = clampTempo(tempo, project.tempo || 120);
    }
    if (key !== undefined) {
      project.key = normalizeKeyPayload(key);
    }
    if (timeSignature !== undefined) {
      project.timeSignature = normalizeTimeSignaturePayload(timeSignature);
    }
    if (req.body.swingAmount !== undefined) {
      project.swingAmount = clampSwingAmount(req.body.swingAmount);
    }
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

    ensureProjectCoreFields(project);
    await project.save();

    res.json({
      success: true,
      message: "Project updated successfully",
      data: normalizeProjectResponse(project),
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

export const patchProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;
    const updates = { ...req.body };

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: "No updates provided",
      });
    }

    const clientVersion = updates.__version;
    if (clientVersion !== undefined) {
      delete updates.__version;
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (project.creatorId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the project owner can update the project",
      });
    }

    // Normalize and validate music theory fields before updating
    if (updates.tempo !== undefined) {
      updates.tempo = clampTempo(updates.tempo, project.tempo || 120);
    }
    if (updates.key !== undefined) {
      updates.key = normalizeKeyPayload(updates.key);
    }
    if (updates.timeSignature !== undefined) {
      updates.timeSignature = normalizeTimeSignaturePayload(
        updates.timeSignature
      );
    }
    if (updates.swingAmount !== undefined) {
      updates.swingAmount = clampSwingAmount(updates.swingAmount);
    }

    let updatedProject;
    if (clientVersion !== undefined) {
      updatedProject = await Project.findOneAndUpdate(
        { _id: projectId, version: clientVersion },
        { $set: updates, $inc: { version: 1 } },
        { new: true }
      );
      if (!updatedProject) {
        return res.status(409).json({
          success: false,
          message: "Project version mismatch",
        });
      }
    } else {
      updatedProject = await Project.findByIdAndUpdate(
        projectId,
        { $set: updates, $inc: { version: 1 } },
        { new: true }
      );
    }

    res.json({
      success: true,
      message: "Project updated successfully",
      data: normalizeProjectResponse(updatedProject),
    });
  } catch (error) {
    console.error("Error patching project:", error);
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

    ensureProjectCoreFields(project);
    project.chordProgression = normalizedChords;
    await project.save();

    res.json({
      success: true,
      message: "Chord progression updated successfully",
      data: normalizeProjectResponse(project),
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

    // Find or create backing track - use dedicated fields only (no regex fallback)
    let backingTrack = await ProjectTrack.findOne({
      projectId: project._id,
      $or: [{ trackType: "backing" }, { isBackingTrack: true }],
    });

    console.log(
      `[Backing Track] Found existing backing track: ${!!backingTrack}, instrumentId provided: ${instrumentId}`
    );

    if (!backingTrack) {
      console.log(
        `[Backing Track] Creating new backing track with instrumentId: ${instrumentId}`
      );
      backingTrack = new ProjectTrack({
        projectId: project._id,
        trackName: "Backing Track",
        trackType: "backing",
        isBackingTrack: true,
        trackOrder: 0,
        volume: 1.0,
        pan: 0.0,
        muted: false,
        solo: false,
        instrument: instrumentId ? { instrumentId } : undefined,
        defaultRhythmPatternId: rhythmPatternId || undefined,
      });
      await backingTrack.save();
      console.log(
        `[Backing Track] Created new backing track with ID: ${
          backingTrack._id
        }, instrument: ${JSON.stringify(backingTrack.instrument)}`
      );
    } else {
      // Always update instrument and pattern if provided (even if backing track already exists)
      let needsUpdate = false;
      if (instrumentId) {
        console.log(
          `[Backing Track] Updating instrument from ${JSON.stringify(
            backingTrack.instrument
          )} to { instrumentId: ${instrumentId} }`
        );
        backingTrack.instrument = { instrumentId };
        needsUpdate = true;
      }
      if (rhythmPatternId) {
        backingTrack.defaultRhythmPatternId = rhythmPatternId;
        needsUpdate = true;
      }
      if (needsUpdate) {
        await backingTrack.save();
        console.log(
          `[Backing Track] Updated backing track. New instrument: ${JSON.stringify(
            backingTrack.instrument
          )}`
        );
      }
    }

    // Get instrument for MIDI program number
    let instrumentProgram = 0; // Default: Acoustic Grand Piano
    let instrumentDetails = null;
    if (instrumentId) {
      instrumentDetails = await Instrument.findById(instrumentId);
      if (instrumentDetails) {
        // Comprehensive map of soundfont keys to MIDI program numbers
        const programMap = {
          // Piano family (0-7)
          acoustic_grand_piano: 0,
          bright_acoustic_piano: 1,
          electric_grand_piano: 2,
          honky_tonk_piano: 3,
          electric_piano: 4,
          electric_piano_1: 4,
          electric_piano_2: 5,
          electric_piano_dx7: 5,
          clavinet: 7,

          // Organ family (16-23)
          drawbar_organ: 16,
          hammond_organ: 16,
          percussive_organ: 17,
          rock_organ: 18,
          church_organ: 19,

          // Guitar family (24-31)
          acoustic_guitar_nylon: 24,
          acoustic_guitar_steel: 25,
          electric_guitar_jazz: 26,
          electric_guitar_clean: 27,
          electric_guitar_muted: 28,
          overdriven_guitar: 29,
          distorted_guitar: 30,
          guitar_harmonics: 31,

          // Bass family (32-39)
          acoustic_bass: 32,
          electric_bass_finger: 33,
          electric_bass_pick: 34,
          fretless_bass: 35,
          slap_bass_1: 36,
          slap_bass_2: 37,
          synth_bass_1: 38,
          synth_bass_2: 39,

          // Strings family (40-47)
          violin: 40,
          viola: 41,
          cello: 42,
          contrabass: 43,
          tremolo_strings: 44,
          pizzicato_strings: 45,
          orchestral_harp: 46,
          string_ensemble_1: 48,
          string_ensemble_2: 49,
          slow_strings: 50,
          synth_strings_1: 51,
          synth_strings_2: 52,
          timpani: 47,

          // Brass family (56-63)
          trumpet: 56,
          trombone: 57,
          tuba: 58,
          muted_trumpet: 59,
          french_horn: 60,
          brass_section: 61,
          synth_brass_1: 62,
          synth_brass_2: 63,

          // Synth Lead (80-87)
          synth_lead: 80,
          synth_lead_1: 80,
          lead_1_square: 80,
          synth_lead_2: 81,
          lead_2_sawtooth: 81,
          synth_lead_3: 82,
          lead_3_calliope: 82,
          synth_lead_4: 83,
          lead_4_chiff: 83,
          lead_5_charang: 84,
          lead_6_voice: 85,
          lead_7_fifths: 86,
          lead_8_bass_lead: 87,

          // Synth Pad (88-95)
          percussion_standard: -1,
          percussion_room: -1,
          standard: -1,
          drum_kit: -1,
          drumset: -1,
          synth_pad_1: 88,
          pad_1_new_age: 88,
          synth_pad_2: 89,
          pad_2_warm: 89,
          synth_pad_3: 90,
          pad_3_polysynth: 90,
          synth_pad_4: 91,
          pad_4_choir: 91,
          synth_pad_5: 92,
          pad_5_bowed: 92,
          synth_pad_6: 93,
          pad_6_metallic: 93,
          synth_pad_7: 94,
          pad_7_halo: 94,
          synth_pad_8: 95,
          pad_8_sweep: 95,
          ambient_pad: 92,
          airy_pad: 92,
          warm_pad: 89,
          drone_pad: 92,
          atmosphere_pad: 94,
          halo_pad: 95,
          sweep_pad: 95,
          texture_pad: 92,
          ambient_drone: 92,
          dark_drone: 95,
          soundscape_pad: 94,
        };

        // Try to match by soundfontKey first
        if (instrumentDetails.soundfontKey) {
          const normalizedKey = instrumentDetails.soundfontKey.toLowerCase();
          const key = normalizedKey.replace(/[^a-z0-9_]/g, "_");
          instrumentProgram =
            programMap[key] ||
            programMap[instrumentDetails.soundfontKey] ||
            (normalizedKey.includes("pad") ||
            normalizedKey.includes("drone") ||
            normalizedKey.includes("ambient") ||
            normalizedKey.includes("atmosphere")
              ? 92
              : normalizedKey.includes("drum") ||
                normalizedKey.includes("perc") ||
                normalizedKey.includes("standard")
              ? -1
              : 0);
        }

        // Fallback: try to match by instrument name if soundfontKey didn't match
        if (instrumentProgram === 0 && instrumentDetails.name) {
          const nameLower = instrumentDetails.name.toLowerCase();

          // Piano detection
          if (nameLower.includes("piano")) {
            if (nameLower.includes("electric")) {
              instrumentProgram = 4;
            } else {
              instrumentProgram = 0;
            }
          }
          // Guitar detection
          else if (nameLower.includes("guitar")) {
            if (nameLower.includes("acoustic")) {
              instrumentProgram = 25;
            } else if (
              nameLower.includes("electric") ||
              nameLower.includes("clean")
            ) {
              instrumentProgram = 27;
            } else if (
              nameLower.includes("distort") ||
              nameLower.includes("overdrive")
            ) {
              instrumentProgram = 30;
            } else {
              instrumentProgram = 27;
            }
          }
          // Bass detection
          else if (nameLower.includes("bass")) {
            if (nameLower.includes("acoustic")) {
              instrumentProgram = 32;
            } else if (nameLower.includes("electric")) {
              instrumentProgram = 33;
            } else if (nameLower.includes("synth")) {
              instrumentProgram = 38;
            } else {
              instrumentProgram = 32;
            }
          }
          // Pad / Drone detection
          else if (
            nameLower.includes("pad") ||
            nameLower.includes("drone") ||
            nameLower.includes("atmosphere") ||
            nameLower.includes("ambient")
          ) {
            instrumentProgram = 92;
          }
          // Organ detection
          else if (
            nameLower.includes("drum") ||
            nameLower.includes("kit") ||
            nameLower.includes("percussion")
          ) {
            instrumentProgram = -1;
          } else if (nameLower.includes("organ")) {
            instrumentProgram = 16;
          }
          // Strings detection
          else if (
            nameLower.includes("violin") ||
            nameLower.includes("string")
          ) {
            instrumentProgram = 40;
          }
          // Brass detection
          else if (
            nameLower.includes("trumpet") ||
            nameLower.includes("brass")
          ) {
            instrumentProgram = 56;
          }
          // Synth detection
          else if (nameLower.includes("synth")) {
            if (nameLower.includes("pad")) {
              instrumentProgram = 92;
            } else if (nameLower.includes("lead")) {
              instrumentProgram = 80;
            } else {
              instrumentProgram = 80;
            }
          }
        }

        console.log(
          `[Backing Track] Instrument mapping: ${instrumentDetails.name} (soundfontKey: ${instrumentDetails.soundfontKey}) -> MIDI Program ${instrumentProgram}`
        );
        if (instrumentProgram === -1) {
          console.log(
            "[Backing Track] Instrument identified as percussion/drum kit"
          );
        }
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
    // Currently we use the existing JS synth-based renderer (midiToAudioConverter).
    // Soundfont-based rendering is disabled because the required npm packages
    // are not reliably available in the current environment.
    let audioFile = null;
    if (generateAudio) {
      const cloudinaryFolder = `projects/${projectId}/backing_tracks`;
      try {
        console.log(
          "[Backing Track] Using legacy waveform renderer (midiToAudioConverter)..."
        );
        const { convertMIDIToAudioAuto } = await import(
          "../utils/midiToAudioConverter.js"
        );
        audioFile = await convertMIDIToAudioAuto(chords, {
          tempo: project.tempo || 120,
          chordDuration,
          sampleRate: 44100,
          uploadToCloud: true,
          cloudinaryFolder,
          projectId: project._id.toString(),
          rhythmPatternId,
          instrumentId,
          instrumentProgram,
        });
        console.log(
          `[Backing Track] Audio generation completed. Success: ${!!audioFile}, URL: ${
            audioFile?.cloudinaryUrl || audioFile?.url || "N/A"
          }`
        );
      } catch (conversionError) {
        console.error(
          "[Backing Track] Audio generation failed:",
          conversionError
        );
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

    // Ensure backing track instrument is included in response
    const backingTrackResponse = backingTrack.toObject();
    console.log(`[Backing Track] Returning backing track with instrument:`, {
      instrument: backingTrackResponse.instrument,
      instrumentId: backingTrackResponse.instrument?.instrumentId,
    });

    res.status(201).json({
      success: true,
      message:
        generateAudio && audioFile
          ? `Backing track audio generated with ${chords.length} chord clips`
          : `Backing track ${audioFile ? "audio" : "MIDI"} generated with ${
              chords.length
            } chord clips`,
      data: {
        track: backingTrackResponse,
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
