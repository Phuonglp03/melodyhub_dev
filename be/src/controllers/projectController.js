import mongoose from "mongoose";
import Project from "../models/Project.js";
import ProjectTrack from "../models/ProjectTrack.js";
import ProjectTimelineItem from "../models/ProjectTimelineItem.js";
import ProjectCollaborator from "../models/ProjectCollaborator.js";
import User from "../models/User.js";
import Lick from "../models/Lick.js";
import Instrument from "../models/Instrument.js";
import PlayingPattern from "../models/PlayingPattern.js";
import { uploadToCloudinary } from "../middleware/file.js";
import { notifyProjectCollaboratorInvited } from "../utils/notificationHelper.js";
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

// Helper: Convert bandSettings.style to rhythm pattern noteEvents
// Maps style names to the hardcoded patterns from frontend ProjectBandEngine.js
const styleToRhythmPattern = (style) => {
  const stylePatterns = {
    Swing: {
      piano: [0, 2],
      bass: [0, 2],
      drums: { kick: [0], snare: [1, 3], hihat: [0, 1, 2, 3] },
    },
    Bossa: {
      piano: [0, 1.5, 3],
      bass: [0, 1.5, 2, 3.5],
      drums: {
        kick: [0, 2],
        snare: [],
        hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
      },
    },
    Latin: {
      piano: [0, 0.5, 1.5, 2, 3],
      bass: [0, 1, 2, 3],
      drums: {
        kick: [0, 2.5],
        snare: [1, 3],
        hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
      },
    },
    Ballad: {
      piano: [0],
      bass: [0, 2],
      drums: { kick: [0], snare: [2], hihat: [0, 1, 2, 3] },
    },
    Funk: {
      piano: [0, 0.5, 1.5, 2.5, 3],
      bass: [0, 0.75, 1.5, 2, 2.75, 3.5],
      drums: {
        kick: [0, 1.5, 2.5],
        snare: [1, 3],
        hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
      },
    },
    Rock: {
      piano: [0, 2],
      bass: [0, 1, 2, 3],
      drums: {
        kick: [0, 2],
        snare: [1, 3],
        hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
      },
    },
  };

  const pattern = stylePatterns[style] || stylePatterns.Swing;

  // Convert pattern to noteEvents format for comping/rhythm instruments
  // Use piano pattern as default rhythm pattern
  const noteEvents = pattern.piano.map((beat) => ({
    beat: Math.floor(beat),
    subdivision: beat % 1,
    velocity: 0.8,
    duration: 0.5,
    noteOffset: 0,
  }));

  return { noteEvents, beatsPerPattern: 4, patternType: "style" };
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
      status: "accepted",
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
// Also returns pending invitations separately for the "Collaborations" tab
export const getUserProjects = async (req, res) => {
  try {
    const userId = req.userId;
    const { filter = "all" } = req.query; // "all", "my-projects", "collaborations"
    const { status } = req.query; // Optional status filter: "draft", "active", "completed", "inactive"

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Load all collaboration links for this user once so we can:
    // - Treat accepted collabs as real projects
    // - Surface pending invitations separately
    const collaborations = await ProjectCollaborator.find({
      userId: userObjectId,
    }).select("projectId role status");

    const acceptedProjectIds = collaborations
      .filter((c) => c.status === "accepted")
      .map((c) => c.projectId);

    const pendingProjectIds = collaborations
      .filter((c) => c.status === "pending")
      .map((c) => c.projectId);

    // Check for data integrity issues: pending collaborations for projects the user owns
    if (pendingProjectIds.length > 0) {
      const ownedProjectsWithPending = await Project.find({
        _id: { $in: pendingProjectIds },
        creatorId: userObjectId,
      }).select("_id title").lean();
      
      if (ownedProjectsWithPending.length > 0) {
        console.warn("(IS $) [Projects:getUserProjects] DATA INTEGRITY ISSUE: Found pending collaborations for projects user owns:", {
          userId,
          ownedProjectsWithPending: ownedProjectsWithPending.map(p => ({
            projectId: p._id.toString(),
            title: p.title,
          })),
        });
      }
    }

    console.log("(IS $) [Projects:getUserProjects] Collaborations snapshot:", {
      userId,
      filter,
      totalLinks: collaborations.length,
      acceptedCount: acceptedProjectIds.length,
      pendingCount: pendingProjectIds.length,
    });

    let matchQuery = {};

    if (filter === "my-projects") {
      // Only projects where user is the owner
      matchQuery = { creatorId: userObjectId };
    } else if (filter === "collaborations") {
      // Only projects where user is an accepted collaborator but not owner
      matchQuery = {
        _id: { $in: acceptedProjectIds },
        creatorId: { $ne: userObjectId },
      };
    } else {
      // All projects (owner or accepted collaborator)
      matchQuery = {
        $or: [
          { creatorId: userObjectId },
          { _id: { $in: acceptedProjectIds } },
        ],
      };
    }

    // Add status filter if provided
    // When using $or, we need to use $and to combine with status filter
    if (status) {
      if (matchQuery.$or) {
        // If we have $or, wrap it with $and to combine with status
        matchQuery = {
          $and: [matchQuery, { status }],
        };
      } else {
        // Otherwise, just add status directly
        matchQuery.status = status;
      }
    }

    const projects = await Project.find(matchQuery)
      .populate("creatorId", "username displayName avatarUrl")
      .sort({ updatedAt: -1 });

    // Fetch project details for pending invitations so the UI can render cards
    // IMPORTANT: Exclude projects where the user is the owner (owners shouldn't see invitations to their own projects)
    let pendingInvitations = [];
    if (pendingProjectIds.length > 0) {
      const pendingProjects = await Project.find({
        _id: { $in: pendingProjectIds },
        creatorId: { $ne: userObjectId }, // Exclude projects owned by the user
      })
        .populate("creatorId", "username displayName avatarUrl")
        .sort({ updatedAt: -1 });

      const pendingById = new Map(
        collaborations
          .filter((c) => c.status === "pending")
          .map((c) => [String(c.projectId), c])
      );

      pendingInvitations = pendingProjects
        .filter((project) => {
          // Double-check: ensure user is not the owner (safety check)
          const isOwner = project.creatorId?._id?.toString() === userId || 
                         project.creatorId?.toString() === userId;
          if (isOwner) {
            console.warn("(IS $) [Projects:getUserProjects] Filtered out owned project from pending invitations:", {
              projectId: project._id.toString(),
              userId,
              creatorId: project.creatorId?._id?.toString() || project.creatorId?.toString(),
            });
          }
          return !isOwner;
        })
        .map((project) => {
          const collab = pendingById.get(String(project._id));
          return {
            _id: project._id,
            title: project.title || project.name || "Untitled Project",
            description: project.description || "",
            status: project.status,
            creatorId: project.creatorId,
            invitationRole: collab?.role || "contributor",
            updatedAt: project.updatedAt,
            createdAt: project.createdAt,
          };
        });
    }

    res.json({
      success: true,
      data: projects.map((project) => normalizeProjectResponse(project)),
      pendingInvitations,
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

// Get full project timeline for audio export (tracks + timeline items)
export const getProjectTimelineForExport = async (req, res) => {
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

    // Debug: Log chord progression from database
    console.log("(IS $) [FullMixExport] Project chord progression from DB:", {
      projectId: project._id.toString(),
      hasChordProgression: !!project.chordProgression,
      chordProgressionType: Array.isArray(project.chordProgression)
        ? "array"
        : typeof project.chordProgression,
      chordProgressionLength: Array.isArray(project.chordProgression)
        ? project.chordProgression.length
        : 0,
      chordProgression: project.chordProgression,
    });

    const isOwner = project.creatorId.toString() === userId;
    const collaborator = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!isOwner && (!collaborator || collaborator.role === "viewer")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to export this project",
      });
    }

    const tracks = await ProjectTrack.find({ projectId: project._id })
      .sort({ trackOrder: 1, _id: 1 })
      .lean();

    const trackIds = tracks.map((t) => t._id);

    console.log("(IS $) [FullMixExport] Found tracks:", {
      count: tracks.length,
      tracks: tracks.map((t) => ({
        _id: String(t._id),
        trackName: t.trackName,
        trackType: t.trackType,
        isBackingTrack: t.isBackingTrack,
      })),
      trackIds: trackIds.map((id) => String(id)),
    });

    const items = await ProjectTimelineItem.find({
      trackId: { $in: trackIds },
    })
      .populate("lickId", "title audioUrl duration waveformData")
      .sort({ startTime: 1, _id: 1 })
      .lean();

    console.log("(IS $) [FullMixExport] Found items:", {
      count: items.length,
      itemsByTrack: items.reduce((acc, item) => {
        const trackId = String(item.trackId);
        if (!acc[trackId]) acc[trackId] = [];
        acc[trackId].push({
          itemId: String(item._id),
          type: item.type,
          hasAudioUrl: !!item.audioUrl,
          hasLickId: !!item.lickId,
        });
        return acc;
      }, {}),
    });

    // Group items by trackId for easier consumption on the frontend
    const itemsByTrackId = {};
    let maxEndTime = 0;

    // Debug: Log track IDs and item track IDs for matching
    console.log(
      "(IS $) [FullMixExport] Track IDs:",
      trackIds.map((id) => String(id))
    );
    console.log(
      "(IS $) [FullMixExport] Item track IDs:",
      items.map((item) => ({
        itemId: item._id,
        trackId: String(item.trackId),
        type: item.type,
        hasAudioUrl: !!item.audioUrl,
      }))
    );

    for (const item of items) {
      const key = String(item.trackId);
      if (!itemsByTrackId[key]) {
        itemsByTrackId[key] = [];
      }
      const start = Number(item.startTime) || 0;
      const duration = Number(item.duration) || 0;
      const end = Math.max(0, start + duration);
      if (end > maxEndTime) {
        maxEndTime = end;
      }

      // Only include fields relevant for audio export to keep payload lean
      itemsByTrackId[key].push({
        _id: item._id,
        trackId: item.trackId,
        startTime: start,
        duration,
        offset: Number(item.offset) || 0,
        loopEnabled: Boolean(item.loopEnabled),
        playbackRate: Number(item.playbackRate) || 1,
        type: item.type,
        // If lickId is populated, include minimal nested audio info so the
        // frontend full-mix exporter can resolve audio clips.
        lickId: item.lickId
          ? {
              _id: item.lickId._id,
              audioUrl: item.lickId.audioUrl || null,
              waveformData: item.lickId.waveformData,
              duration:
                typeof item.lickId.duration === "number"
                  ? item.lickId.duration
                  : undefined,
            }
          : undefined,
        sourceDuration:
          typeof item.sourceDuration === "number"
            ? item.sourceDuration
            : undefined,
        chordName: item.chordName,
        rhythmPatternId: item.rhythmPatternId,
        isCustomized: Boolean(item.isCustomized),
        customMidiEvents: Array.isArray(item.customMidiEvents)
          ? item.customMidiEvents
          : [],
        audioUrl: item.audioUrl || null,
        waveformData: item.waveformData || null,
      });
    }

    // Debug: Check items with licks that don't have audio
    const itemsWithLicksNoAudio = items.filter(
      (item) =>
        item.lickId &&
        (!item.lickId.audioUrl || item.lickId.audioUrl.trim() === "")
    );

    if (itemsWithLicksNoAudio.length > 0) {
      console.warn(
        "(IS $) [FullMixExport] Found items with licks missing audioUrl:",
        {
          count: itemsWithLicksNoAudio.length,
          itemIds: itemsWithLicksNoAudio.map((i) => i._id),
          lickIds: itemsWithLicksNoAudio
            .map((i) => i.lickId?._id)
            .filter(Boolean),
        }
      );
    }

    console.log("(IS $) [FullMixExport] Loaded timeline for project:", {
      projectId: project._id.toString(),
      trackCount: tracks.length,
      itemCount: items.length,
      itemsWithLicks: items.filter((i) => i.lickId).length,
      itemsWithLicksNoAudio: itemsWithLicksNoAudio.length,
      itemsByTrackIdKeys: Object.keys(itemsByTrackId),
      itemsByTrackIdCounts: Object.entries(itemsByTrackId).map(
        ([key, items]) => ({
          trackId: key,
          count: items.length,
          types: items.map((i) => i.type),
        })
      ),
      durationSeconds: maxEndTime,
    });

    // Ensure chordProgression is included (convert to plain object to ensure all fields are included)
    const projectData = project.toObject ? project.toObject() : project;

    // Explicitly get chordProgression - try multiple ways to access it
    const chordProgression =
      projectData.chordProgression ||
      project.chordProgression ||
      (project.get ? project.get("chordProgression") : null) ||
      [];

    console.log(
      "(IS $) [FullMixExport] Preparing response with chordProgression:",
      {
        hasInPlain: !!projectData.chordProgression,
        hasInDoc: !!project.chordProgression,
        chordProgressionLength: Array.isArray(chordProgression)
          ? chordProgression.length
          : 0,
        chordProgression: chordProgression,
        projectDataKeys: Object.keys(projectData).filter(
          (k) => k.includes("chord") || k.includes("Chord")
        ),
      }
    );

    // Include band settings in response
    const projectPlain = project.toObject ? project.toObject() : project;

    const responseData = {
      success: true,
      data: {
        project: {
          id: project._id,
          title: project.title,
          tempo: project.tempo,
          key: project.key,
          timeSignature: project.timeSignature,
          status: project.status,
          chordProgression: chordProgression, // Explicitly include
          swingAmount: project.swingAmount,
          bandSettings:
            projectPlain.bandSettings || project.bandSettings || null,
        },
        timeline: {
          durationSeconds: maxEndTime,
          tracks,
          itemsByTrackId,
        },
      },
    };

    console.log("(IS $) [FullMixExport] Response project object:", {
      hasChordProgression: !!responseData.data.project.chordProgression,
      chordProgressionLength: Array.isArray(
        responseData.data.project.chordProgression
      )
        ? responseData.data.project.chordProgression.length
        : 0,
      chordProgression: responseData.data.project.chordProgression,
    });

    return res.json(responseData);
  } catch (error) {
    console.error("Error loading project timeline for export:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load project timeline for export",
      error: error.message,
    });
  }
};

// Save exported project audio metadata (audioUrl, waveformData, duration)
export const exportProjectAudio = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;
    const { audioUrl, audioDuration, waveformData } = req.body || {};

    if (!audioUrl || typeof audioUrl !== "string") {
      return res.status(400).json({
        success: false,
        message: "audioUrl is required and must be a string",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
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

    if (!isOwner && (!collaborator || collaborator.role === "viewer")) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to save export data for this project",
      });
    }

    // Apply metadata to project
    project.audioUrl = audioUrl;

    if (typeof audioDuration === "number" && audioDuration > 0) {
      project.audioDuration = audioDuration;
    }

    if (Array.isArray(waveformData) && waveformData.length) {
      project.waveformData = waveformData.map((v) => Number(v) || 0);
    }

    project.exportedAt = new Date();

    await project.save();

    console.log("(IS $) [ProjectExport] Saved export metadata:", {
      projectId: project._id.toString(),
      hasAudioUrl: !!project.audioUrl,
      hasWaveform: Array.isArray(project.waveformData),
      audioDuration: project.audioDuration,
      exportedAt: project.exportedAt,
    });

    return res.status(200).json({
      success: true,
      message: "Project export metadata saved successfully",
      data: {
        projectId: project._id,
        audioUrl: project.audioUrl,
        audioDuration: project.audioDuration,
        waveformData: project.waveformData,
        exportedAt: project.exportedAt,
      },
    });
  } catch (error) {
    console.error("Error saving project export metadata:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save project export metadata",
      error: error.message,
    });
  }
};

// Lightweight collaboration state for a project (used by routes `/collab/state`)
export const getProjectCollabState = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

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

    const collaborators = await ProjectCollaborator.find({
      projectId: project._id,
    })
      .populate("userId", "username displayName avatarUrl")
      .lean();

    const isOwner = project.creatorId?._id?.toString() === userId;
    const currentUserCollab = collaborators.find(
      (c) => c.userId && c.userId._id.toString() === userId
    );

    const role = isOwner ? "owner" : currentUserCollab?.role || "viewer";

    const response = {
      project: {
        id: project._id,
        title: project.title,
        status: project.status,
        isPublic: project.isPublic,
      },
      currentUser: {
        userId,
        isOwner,
        role,
      },
      collaborators: collaborators.map((c) => ({
        id: c._id,
        role: c.role,
        user: c.userId
          ? {
              id: c.userId._id,
              username: c.userId.username,
              displayName: c.userId.displayName || c.userId.username,
              avatarUrl: c.userId.avatarUrl,
            }
          : null,
      })),
    };

    console.log("(IS $) [CollabState] Project collaboration state:", {
      projectId: project._id.toString(),
      currentUserId: userId,
      isOwner,
      collaboratorCount: collaborators.length,
      role,
    });

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error getting project collaboration state:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load project collaboration state",
      error: error.message,
    });
  }
};

// Debug endpoint for project collaboration state
export const getProjectCollabDebug = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    const project = await Project.findById(projectId).populate(
      "creatorId",
      "username displayName email avatarUrl"
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const collaborators = await ProjectCollaborator.find({
      projectId: project._id,
    })
      .populate("userId", "username displayName email avatarUrl")
      .lean();

    const currentUserCollab = collaborators.find(
      (c) => c.userId && c.userId._id.toString() === userId
    );

    const isOwner = project.creatorId?._id?.toString() === userId;

    const debugPayload = {
      project: {
        id: project._id,
        title: project.title,
        status: project.status,
        isPublic: project.isPublic,
        creator: project.creatorId
          ? {
              id: project.creatorId._id,
              username: project.creatorId.username,
              displayName:
                project.creatorId.displayName || project.creatorId.username,
              email: project.creatorId.email,
            }
          : null,
      },
      collaborators: collaborators.map((c) => ({
        id: c._id,
        role: c.role,
        user: c.userId
          ? {
              id: c.userId._id,
              username: c.userId.username,
              displayName: c.userId.displayName || c.userId.username,
              email: c.userId.email,
            }
          : null,
      })),
      currentUser: {
        userId,
        isOwner,
        role: isOwner ? "owner" : currentUserCollab?.role || "none",
      },
    };

    console.log("(IS $) [CollabDebug] Project collaboration debug:", {
      projectId: project._id.toString(),
      currentUserId: userId,
      isOwner,
      collaboratorCount: collaborators.length,
      currentUserRole: debugPayload.currentUser.role,
    });

    return res.status(200).json({
      success: true,
      data: debugPayload,
    });
  } catch (error) {
    console.error("Error getting project collaboration debug info:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load project collaboration debug info",
      error: error.message,
    });
  }
};

// Handle uploaded full-mix audio file for a project
export const uploadProjectAudioFile = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No audio file provided",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
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

    if (!isOwner && (!collaborator || collaborator.role === "viewer")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to upload audio for this project",
      });
    }

    console.log("(NO $) [DEBUG][ProjectExportUpload] Incoming audio file:", {
      projectId,
      userId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    const folder = `melodyhub/projects/${projectId}/exports`;
    let uploadResult;

    try {
      uploadResult = await uploadToCloudinary(req.file.buffer, folder, "video");
    } catch (err) {
      console.error(
        "(IS $) [ProjectExportUpload] Cloudinary upload failed:",
        err
      );
      return res.status(500).json({
        success: false,
        message: "Failed to upload audio to cloud storage",
        error: err.message,
      });
    }

    console.log("(IS $) [ProjectExportUpload] Uploaded audio to Cloudinary:", {
      projectId,
      publicId: uploadResult.public_id,
      secureUrl: uploadResult.secure_url,
      duration: uploadResult.duration,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      resourceType: uploadResult.resource_type,
    });

    return res.status(201).json({
      success: true,
      message: "Project audio uploaded successfully",
      data: {
        publicId: uploadResult.public_id,
        url: uploadResult.secure_url,
        secure_url: uploadResult.secure_url,
        cloudinaryUrl: uploadResult.secure_url,
        duration: uploadResult.duration,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        resourceType: uploadResult.resource_type,
      },
    });
  } catch (error) {
    console.error("Error uploading project audio file:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload project audio file",
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

    // Require bandSettings for audio generation
    if (generateAudio) {
      const hasBandSettings =
        project.bandSettings?.members &&
        project.bandSettings.members.length > 0;

      if (!hasBandSettings) {
        return res.status(400).json({
          success: false,
          message:
            "bandSettings with at least one member is required for backing track audio generation. Please configure your band settings first.",
        });
      }

      // Require bandSettings.style for rhythm pattern
      if (!project.bandSettings?.style) {
        return res.status(400).json({
          success: false,
          message:
            "bandSettings.style is required for backing track audio generation. Please set a style (Swing, Bossa, Latin, Ballad, Funk, or Rock).",
        });
      }
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

      // bandSettings is required for audio generation (validated above)
      // Extract instruments from band members
      let finalInstrumentId = null; // Will be extracted per-member
      let finalRhythmPatternId = null; // Will come from bandSettings.style
      let finalInstrumentProgram = instrumentProgram;

      const hasBandSettings =
        project.bandSettings?.members &&
        project.bandSettings.members.length > 0;

      console.log(
        "(IS $) [Backing Track] Using bandSettings - extracting instruments from members"
      );

      // Extract from band members
      if (hasBandSettings) {
        console.log(
          "(IS $) [Backing Track] Extracting settings from band members..."
        );

        // Find comping or rhythm member (typically used for backing track)
        const compingMember = project.bandSettings.members.find(
          (m) => m.role === "comping" || m.role === "rhythm"
        );

        if (compingMember) {
          console.log(
            `(IS $) [Backing Track] Found comping/rhythm member: ${compingMember.name} (${compingMember.type}, ${compingMember.role})`
          );

          // Extract instrument from band member
          if (compingMember.soundBank) {
            try {
              const Instrument = (await import("../models/Instrument.js"))
                .default;
              const foundInstrument = await Instrument.findOne({
                soundfontKey: compingMember.soundBank,
              });
              if (foundInstrument) {
                finalInstrumentId = foundInstrument._id;
                console.log(
                  `(IS $) [Backing Track] ✓ Extracted instrument from band: ${foundInstrument.name} (${compingMember.soundBank})`
                );
              }
            } catch (err) {
              console.warn(
                "(IS $) [Backing Track] Could not lookup instrument from soundBank:",
                err.message
              );
            }
          }

          // Extract rhythm pattern if member has one
          // Note: Band members might have rhythmPatternId stored, but we'll use the project's default
          // or look for it in the member's properties if available
        }

        // Convert bandSettings.style to rhythm pattern if available
        if (project.bandSettings?.style && !finalRhythmPatternId) {
          const stylePattern = styleToRhythmPattern(project.bandSettings.style);
          console.log(
            `(IS $) [Backing Track] Converted style "${project.bandSettings.style}" to rhythm pattern with ${stylePattern.noteEvents.length} events`
          );
          // Style pattern will be passed via bandSettings to audio generator
        }

        // If no comping member, try to get from first non-muted member
        if (!compingMember) {
          const activeMember = project.bandSettings.members.find(
            (m) => !m.isMuted
          );
          if (activeMember && activeMember.soundBank) {
            try {
              const Instrument = (await import("../models/Instrument.js"))
                .default;
              const foundInstrument = await Instrument.findOne({
                soundfontKey: activeMember.soundBank,
              });
              if (foundInstrument) {
                finalInstrumentId = foundInstrument._id;
                console.log(
                  `(IS $) [Backing Track] ✓ Extracted instrument from first active member: ${foundInstrument.name}`
                );
              }
            } catch (err) {
              console.warn(
                "(IS $) [Backing Track] Could not lookup instrument:",
                err.message
              );
            }
          }
        }
      }

      // Define activeBandMembers (non-muted members) for audio generation
      const activeBandMembers =
        project.bandSettings?.members?.filter((m) => !m.isMuted) || [];

      // Log band settings and project settings
      console.log(
        "(IS $) [Backing Track] Project settings for audio generation:",
        {
          projectId: project._id.toString(),
          tempo: project.tempo || 120,
          key: project.key,
          timeSignature: project.timeSignature,
          swingAmount: project.swingAmount,
          bandSettings: project.bandSettings || null,
          bandSettingsStyle: project.bandSettings?.style,
          bandSettingsSwingAmount: project.bandSettings?.swingAmount,
          bandSettingsMembers: project.bandSettings?.members?.length || 0,
          activeBandMembers: activeBandMembers.length,
          bandMembers: activeBandMembers.map((m) => ({
            type: m.type,
            role: m.role,
            soundBank: m.soundBank,
            name: m.name,
            volume: m.volume,
          })),
          chordCount: chords.length,
          chordDuration,
        }
      );

      try {
        console.log(
          "[Backing Track] Generating individual backing tracks for each chord, then consolidating..."
        );
        const { convertMIDIToAudioAuto } = await import(
          "../utils/midiToAudioConverter.js"
        );
        const { consolidateAudioFiles } = await import(
          "../utils/audioConsolidator.js"
        );

        // Build audio generation params - bandSettings is required, so never include instrumentId/rhythmPatternId
        const audioGenParams = {
          tempo: project.tempo || 120,
          chordDuration,
          sampleRate: 44100,
          uploadToCloud: true,
          cloudinaryFolder,
          projectId: project._id.toString(),
          instrumentProgram: finalInstrumentProgram,
          // bandSettings is required for audio generation
          bandSettings: project.bandSettings,
          swingAmount:
            project.swingAmount ||
            project.bandSettings?.swingAmount ||
            undefined,
        };

        console.log("(IS $) [Backing Track] Audio generation parameters:", {
          ...audioGenParams,
          bandSettings: audioGenParams.bandSettings ? "present" : "missing",
          bandSettingsMembers:
            audioGenParams.bandSettings?.members?.length || 0,
          bandMembersDetails: audioGenParams.bandSettings?.members?.map(
            (m) => ({
              type: m.type,
              role: m.role,
              soundBank: m.soundBank,
            })
          ),
        });

        // Generate backing track for EACH chord, with EACH band member mixed together
        console.log(
          `(IS $) [Backing Track] Generating ${chords.length} chords × ${
            activeBandMembers.length
          } members = ${
            chords.length * activeBandMembers.length
          } individual tracks...`
        );
        const chordAudioFiles = [];

        // Import chord name to MIDI converter
        const { chordNameToMidiNotes } = await import(
          "../utils/midiToAudioConverter.js"
        );

        for (let i = 0; i < chords.length; i++) {
          const chord = chords[i];
          // Ensure chord has chordName - chords array might just be strings
          const chordName =
            typeof chord === "string"
              ? chord
              : chord.chordName || chord.name || `Chord ${i + 1}`;

          // Convert string chord to object with MIDI notes
          let chordObj;
          if (typeof chord === "string") {
            // Convert chord name to MIDI notes
            const midiNotes = chordNameToMidiNotes(chordName);
            chordObj = {
              chordName: chordName,
              name: chordName,
              midiNotes: midiNotes,
            };
            console.log(
              `(IS $) [Backing Track] Converted chord "${chordName}" to MIDI notes:`,
              midiNotes
            );
          } else {
            // Ensure existing chord object has MIDI notes
            if (!chordObj.midiNotes || chordObj.midiNotes.length === 0) {
              const midiNotes = chordNameToMidiNotes(chordName);
              chordObj = { ...chord, midiNotes: midiNotes };
              console.log(
                `(IS $) [Backing Track] Added MIDI notes to chord "${chordName}":`,
                midiNotes
              );
            } else {
              chordObj = chord;
            }
          }

          console.log(
            `(IS $) [Backing Track] Processing chord ${i + 1}/${
              chords.length
            }: ${chordName}`
          );

          // Generate audio for each band member for this chord
          const memberAudioFiles = [];

          for (let j = 0; j < activeBandMembers.length; j++) {
            const member = activeBandMembers[j];
            console.log(
              `(IS $) [Backing Track]   Generating track for member ${j + 1}/${
                activeBandMembers.length
              }: ${member.name} (${member.type}, ${member.role}, soundBank: ${
                member.soundBank
              })`
            );

            try {
              // Look up instrument from soundBank
              let memberInstrumentId = null;
              let memberInstrumentProgram = 0;

              if (member.soundBank) {
                try {
                  const Instrument = (await import("../models/Instrument.js"))
                    .default;
                  const foundInstrument = await Instrument.findOne({
                    soundfontKey: member.soundBank,
                  });
                  if (foundInstrument) {
                    memberInstrumentId = foundInstrument._id;
                    memberInstrumentProgram = foundInstrument.program || 0;
                    console.log(
                      `(IS $) [Backing Track]     Found instrument: ${foundInstrument.name} (program: ${memberInstrumentProgram})`
                    );
                  }
                } catch (err) {
                  console.warn(
                    `(IS $) [Backing Track]     Could not lookup instrument for ${member.soundBank}:`,
                    err.message
                  );
                }
              }

              // Generate audio for this chord + member combination
              const memberAudio = await convertMIDIToAudioAuto([chordObj], {
                tempo: project.tempo || 120,
                chordDuration,
                sampleRate: 44100,
                uploadToCloud: true,
                cloudinaryFolder: `${cloudinaryFolder}/chords/${i}/members`, // Organize by chord and member
                projectId: project._id.toString(),
                // Don't pass rhythmPatternId when using style-based pattern
                rhythmPatternId: project.bandSettings?.style
                  ? null
                  : finalRhythmPatternId,
                instrumentId: memberInstrumentId || finalInstrumentId,
                instrumentProgram:
                  memberInstrumentProgram || finalInstrumentProgram,
                bandSettings: project.bandSettings || undefined,
                swingAmount:
                  project.swingAmount ||
                  project.bandSettings?.swingAmount ||
                  undefined,
                // Apply member volume
                volume: member.volume || 0.8,
              });

              if (
                memberAudio &&
                (memberAudio.url || memberAudio.cloudinaryUrl)
              ) {
                memberAudioFiles.push({
                  url: memberAudio.url,
                  cloudinaryUrl: memberAudio.cloudinaryUrl || memberAudio.url,
                  memberName: member.name,
                  memberType: member.type,
                  memberRole: member.role,
                  volume: member.volume || 0.8,
                });
                console.log(
                  `(IS $) [Backing Track]     ✓ Generated ${member.name} track for ${chordName}`
                );
              } else {
                console.warn(
                  `(IS $) [Backing Track]     ✗ Failed to generate ${member.name} track for ${chordName}`
                );
              }
            } catch (memberError) {
              console.error(
                `(IS $) [Backing Track]     Error generating ${member.name} track:`,
                memberError.message
              );
            }
          }

          // Mix all member tracks for this chord into one
          if (memberAudioFiles.length > 0) {
            console.log(
              `(IS $) [Backing Track]   Mixing ${memberAudioFiles.length} member tracks for ${chordName}...`
            );
            try {
              const { consolidateAudioFiles } = await import(
                "../utils/audioConsolidator.js"
              );
              const mixedChordAudio = await consolidateAudioFiles(
                memberAudioFiles.map((m, idx) => ({
                  ...m,
                  chordName: `${chordName} - ${m.memberName}`,
                  index: idx,
                })),
                {
                  cloudinaryFolder: `${cloudinaryFolder}/chords`,
                  projectId: project._id.toString(),
                  tempo: project.tempo || 120,
                  chordDuration,
                  mixMode: true, // Mix mode: overlay all tracks instead of sequential
                }
              );

              if (
                mixedChordAudio &&
                (mixedChordAudio.url || mixedChordAudio.cloudinaryUrl)
              ) {
                chordAudioFiles.push({
                  url: mixedChordAudio.url,
                  cloudinaryUrl:
                    mixedChordAudio.cloudinaryUrl || mixedChordAudio.url,
                  chordName: chordName,
                  index: i,
                });
                console.log(
                  `(IS $) [Backing Track]   ✓ Mixed ${memberAudioFiles.length} members into chord ${chordName} track`
                );
              }
            } catch (mixError) {
              console.error(
                `(IS $) [Backing Track]   Error mixing members for ${chordName}:`,
                mixError.message
              );
            }
          }
        }

        console.log(
          `(IS $) [Backing Track] Generated ${chordAudioFiles.length}/${chords.length} chord backing tracks`
        );

        // Consolidate all chord audio files into one
        if (chordAudioFiles.length > 0) {
          console.log(
            `(IS $) [Backing Track] Consolidating ${chordAudioFiles.length} chord backing tracks into one file...`
          );
          audioFile = await consolidateAudioFiles(chordAudioFiles, {
            cloudinaryFolder,
            projectId: project._id.toString(),
            tempo: project.tempo || 120,
            chordDuration,
          });
          console.log(
            `(IS $) [Backing Track] ✓ Consolidated backing track created: ${
              audioFile?.cloudinaryUrl || audioFile?.url || "N/A"
            }`
          );
        } else {
          // Fallback: generate all chords together if individual generation failed
          console.warn(
            "(IS $) [Backing Track] No individual chord tracks generated, falling back to single file generation..."
          );
          audioFile = await convertMIDIToAudioAuto(chords, audioGenParams);
        }

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

// Invite collaborator by email
export const inviteCollaborator = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { email, role = "contributor" } = req.body;
    const inviterId = req.userId;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const isOwner = project.creatorId.toString() === inviterId;
    const inviterCollab = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: inviterId,
    });

    const inviterRole = isOwner ? "owner" : inviterCollab?.role;
    if (!isOwner && inviterRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only the project owner or an admin can invite collaborators",
      });
    }

    const targetUser = await User.findOne({ email: normalizedEmail });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User with this email was not found",
      });
    }

    if (targetUser._id.toString() === inviterId) {
      return res.status(400).json({
        success: false,
        message: "You cannot invite yourself as a collaborator",
      });
    }

    // Check if target user is the project owner (they're already a collaborator)
    if (targetUser._id.toString() === project.creatorId.toString()) {
      return res.status(400).json({
        success: false,
        message: "The project owner is already a collaborator",
      });
    }

    let collaborator = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: targetUser._id,
    });

    const previousStatus = collaborator ? collaborator.status : null;

    if (!collaborator) {
      collaborator = new ProjectCollaborator({
        projectId: project._id,
        userId: targetUser._id,
        role,
        status: "pending",
      });
    } else {
      collaborator.role = role;
      if (collaborator.status !== "accepted") {
        collaborator.status = "pending";
      }
    }

    await collaborator.save();
    await collaborator.populate(
      "userId",
      "username displayName avatarUrl email"
    );

    if (previousStatus !== "accepted") {
      const projectTitle =
        project.title ||
        project.name ||
        project.projectName ||
        "Dự án chưa đặt tên";
      
      // Debug logging to verify correct user IDs
      console.log("(IS $) [CollabInvite] Sending notification:", {
        projectId: project._id.toString(),
        projectTitle,
        inviterId: inviterId.toString(),
        inviterEmail: (await User.findById(inviterId).select('email').lean())?.email,
        invitedUserId: targetUser._id.toString(),
        invitedUserEmail: targetUser.email,
        projectOwnerId: project.creatorId.toString(),
        isInviterOwner: inviterId.toString() === project.creatorId.toString(),
        isInvitedOwner: targetUser._id.toString() === project.creatorId.toString(),
      });
      
      await notifyProjectCollaboratorInvited({
        projectId: project._id,
        projectTitle,
        inviterId,
        invitedUserId: targetUser._id,
      });
    }

    console.log("(IS $) [CollabInvite] Collaborator invited/updated:", {
      projectId: project._id.toString(),
      inviterId,
      invitedUserId: targetUser._id.toString(),
      role: collaborator.role,
      status: collaborator.status,
    });

    return res.status(200).json({
      success: true,
      message: `Đã gửi lời mời cộng tác đến ${
        targetUser.displayName || targetUser.username || normalizedEmail
      }`,
      data: collaborator,
    });
  } catch (error) {
    console.error("Error inviting collaborator:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to invite collaborator",
      error: error.message,
    });
  }
};

// Remove collaborator from project
export const removeCollaborator = async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const requesterId = req.userId;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const isOwner = project.creatorId.toString() === requesterId;
    const requesterCollab = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: requesterId,
    });

    const requesterRole = isOwner ? "owner" : requesterCollab?.role;
    if (!isOwner && requesterRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only the project owner or an admin can remove collaborators",
      });
    }

    if (userId === project.creatorId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot remove the project owner",
      });
    }

    const collab = await ProjectCollaborator.findOneAndDelete({
      projectId: project._id,
      userId,
    });

    if (!collab) {
      return res.status(404).json({
        success: false,
        message: "Collaborator not found on this project",
      });
    }

    console.log("(IS $) [CollabInvite] Collaborator removed:", {
      projectId: project._id.toString(),
      removedUserId: userId,
      requesterId,
    });

    return res.json({
      success: true,
      message: "Collaborator removed successfully",
      data: { userId },
    });
  } catch (error) {
    console.error("Error removing collaborator:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove collaborator",
      error: error.message,
    });
  }
};

// Accept invitation
export const acceptInvitation = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;

    const collab = await ProjectCollaborator.findOne({
      projectId,
      userId,
    });

    if (!collab) {
      return res.status(404).json({
        success: false,
        message: "Invitation not found",
      });
    }

    collab.status = "accepted";
    await collab.save();

    console.log("(IS $) [CollabInvite] Invitation accepted:", {
      projectId,
      userId,
    });

    return res.json({
      success: true,
      message: "Invitation accepted",
      data: collab,
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to accept invitation",
      error: error.message,
    });
  }
};

// Decline invitation
export const declineInvitation = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;

    const collab = await ProjectCollaborator.findOne({
      projectId,
      userId,
    });

    if (!collab) {
      return res.status(404).json({
        success: false,
        message: "Invitation not found",
      });
    }

    collab.status = "declined";
    await collab.save();

    console.log("(IS $) [CollabInvite] Invitation declined:", {
      projectId,
      userId,
    });

    return res.json({
      success: true,
      message: "Invitation declined",
      data: collab,
    });
  } catch (error) {
    console.error("Error declining invitation:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to decline invitation",
      error: error.message,
    });
  }
};
