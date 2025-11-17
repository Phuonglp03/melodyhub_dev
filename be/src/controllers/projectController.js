import mongoose from "mongoose";
import Project from "../models/Project.js";
import ProjectTrack from "../models/ProjectTrack.js";
import ProjectTimelineItem from "../models/ProjectTimelineItem.js";
import ProjectCollaborator from "../models/ProjectCollaborator.js";
import User from "../models/User.js";
import Lick from "../models/Lick.js";
import Instrument from "../models/Instrument.js";

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

    // Create default backing track (if needed)
    // Create a default track for the project
    const defaultTrack = new ProjectTrack({
      projectId: project._id,
      trackName: "01: Backing Track",
      trackOrder: 0,
      volume: 1.0,
      pan: 0.0,
      muted: false,
      solo: false,
    });
    await defaultTrack.save();

    // Create melody track
    const melodyTrack = new ProjectTrack({
      projectId: project._id,
      trackName: "01 Melody",
      trackOrder: 1,
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
    const { title, description, tempo, key, timeSignature, isPublic, status, backingInstrumentId } =
      req.body;

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
        const instrument = await Instrument.findById(backingInstrumentId);
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

// Add lick to timeline
export const addLickToTimeline = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { trackId, lickId, startTime, duration } = req.body;
    const userId = req.userId;

    // Validate required fields
    if (!trackId || !lickId || startTime === undefined || !duration) {
      return res.status(400).json({
        success: false,
        message: "trackId, lickId, startTime, and duration are required",
      });
    }

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

    if (!isOwner && !collaborator) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project",
      });
    }

    // Check if track exists
    const track = await ProjectTrack.findById(trackId);
    if (!track || track.projectId.toString() !== projectId) {
      return res.status(404).json({
        success: false,
        message: "Track not found",
      });
    }

    // Check if lick exists
    const lick = await Lick.findById(lickId);
    if (!lick) {
      return res.status(404).json({
        success: false,
        message: "Lick not found",
      });
    }

    // Create timeline item
    const timelineItem = new ProjectTimelineItem({
      trackId,
      lickId,
      userId,
      startTime,
      duration,
    });

    await timelineItem.save();

    // Populate for response
    await timelineItem.populate(
      "lickId",
      "title audioUrl duration waveformData"
    );
    await timelineItem.populate("userId", "username displayName avatarUrl");

    res.status(201).json({
      success: true,
      message: "Lick added to timeline successfully",
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
    const { startTime, duration, trackId } = req.body;
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
    await timelineItem.populate(
      "lickId",
      "title audioUrl duration waveformData"
    );
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
    const { chordProgression } = req.body; // Array of chord strings like ["Am7", "G", "Cmaj7"]
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

    // Update chord progression (store as JSON string)
    project.chordProgression = JSON.stringify(chordProgression || []);
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
    const { trackName } = req.body;
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

    // Get max track order
    const maxOrder = await ProjectTrack.findOne({ projectId: project._id })
      .sort({ trackOrder: -1 })
      .select("trackOrder");

    const newTrack = new ProjectTrack({
      projectId: project._id,
      trackName: trackName || `Track ${(maxOrder?.trackOrder || 0) + 1}`,
      trackOrder: (maxOrder?.trackOrder || 0) + 1,
      volume: 1.0,
      pan: 0.0,
      muted: false,
      solo: false,
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
    const { trackName, volume, pan, muted, solo, trackOrder } = req.body;
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
