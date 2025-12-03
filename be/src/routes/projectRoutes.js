import express from "express";
import { body, validationResult } from "express-validator";
import {
  createProject,
  getUserProjects,
  getProjectById,
  updateProject,
  patchProject,
  deleteProject,
  addLickToTimeline,
  updateTimelineItem,
  bulkUpdateTimelineItems,
  deleteTimelineItem,
  updateChordProgression,
  addTrack,
  updateTrack,
  deleteTrack,
  getInstruments,
  getRhythmPatterns,
  applyRhythmPattern,
  generateBackingTrack,
  inviteCollaborator,
  acceptInvitation,
  declineInvitation,
  removeCollaborator,
  getProjectCollabState,
  getProjectCollabDebug,
  exportProjectAudio,
  uploadProjectAudioFile,
  getProjectTimelineForExport,
} from "../controllers/projectController.js";
import { generateAIBackingTrack } from "../controllers/sunoAIController.js";
import middlewareController from "../middleware/auth.js";
import { handleAudioUpload } from "../middleware/file.js";
const { verifyToken } = middlewareController;

const router = express.Router();

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

// All routes require authentication
router.use(verifyToken);

// Project CRUD routes
router.post(
  "/",
  [
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Project title is required")
      .isLength({ min: 1, max: 200 })
      .withMessage("Title must be between 1 and 200 characters"),
    body("description").optional().isLength({ max: 1000 }),
    body("tempo").optional().isInt({ min: 20, max: 300 }),
    body("timeSignature")
      .optional()
      .matches(/^\d+\/\d+$/),
  ],
  validate,
  createProject
);

router.get("/", getUserProjects);

// Get available instruments - MUST be before /:projectId route
router.get("/instruments", getInstruments);

// Get rhythm patterns - MUST be before /:projectId route
router.get("/rhythm-patterns", getRhythmPatterns);

// Invite collaborator - MUST be before /:projectId route
router.post(
  "/:projectId/invite",
  [
    body("email").trim().isEmail().withMessage("Valid email is required"),
    body("role")
      .optional()
      .isIn(["viewer", "contributor", "admin"])
      .withMessage("Role must be viewer, contributor, or admin"),
  ],
  validate,
  inviteCollaborator
);

// Accept/Decline invitation routes - MUST be before /:projectId route
router.post("/:projectId/invite/accept", acceptInvitation);
router.post("/:projectId/invite/decline", declineInvitation);

// Remove collaborator route - MUST be before /:projectId route
router.delete("/:projectId/collaborators/:userId", removeCollaborator);

router.get("/:projectId/collab/state", getProjectCollabState);
router.get("/:projectId/collab/debug", getProjectCollabDebug);

router.get("/:projectId", getProjectById);

// Full-project timeline for audio export (tracks + timeline items)
router.get("/:projectId/export-timeline", getProjectTimelineForExport);

// Save exported audio metadata for a project
router.post(
  "/:projectId/export-audio/upload",
  handleAudioUpload,
  uploadProjectAudioFile
);
router.post("/:projectId/export-audio", exportProjectAudio);

router.put(
  "/:projectId",
  [
    body("title").optional().trim().isLength({ min: 1, max: 200 }),
    body("description").optional().isLength({ max: 1000 }),
    body("tempo").optional().isInt({ min: 20, max: 300 }),
    body("timeSignature")
      .optional()
      .matches(/^\d+\/\d+$/),
    body("status").optional().isIn(["draft", "active", "inactive"]),
  ],
  validate,
  updateProject
);

router.patch("/:projectId", patchProject);

router.delete("/:projectId", deleteProject);

// Timeline operations
router.post(
  "/:projectId/timeline/items",
  [
    body("trackId")
      .notEmpty()
      .withMessage("trackId is required")
      .isMongoId()
      .withMessage("trackId must be a valid MongoDB ID"),
    body("lickId")
      .notEmpty()
      .withMessage("lickId is required")
      .isMongoId()
      .withMessage("lickId must be a valid MongoDB ID"),
    body("startTime")
      .isFloat({ min: 0 })
      .withMessage("startTime must be a non-negative number"),
    body("duration")
      .isFloat({ min: 0.1 })
      .withMessage("duration must be a positive number"),
  ],
  validate,
  addLickToTimeline
);

// Bulk update timeline items (for buffered autosave) - MUST be before /:itemId route
router.put(
  "/:projectId/timeline/items/bulk",
  [
    body("items")
      .isArray()
      .withMessage("items must be an array")
      .notEmpty()
      .withMessage("items array cannot be empty"),
    // Each item should have either _id or itemId (handled in controller)
    body("items.*._id").optional().isMongoId(),
    body("items.*.itemId").optional().isMongoId(),
  ],
  validate,
  bulkUpdateTimelineItems
);

router.put(
  "/:projectId/timeline/items/:itemId",
  [
    body("startTime").optional().isNumeric(),
    body("duration").optional().isNumeric(),
    body("trackId").optional().notEmpty(),
  ],
  validate,
  updateTimelineItem
);

router.delete("/:projectId/timeline/items/:itemId", deleteTimelineItem);

// Chord progression
router.put(
  "/:projectId/chords",
  [
    body("chordProgression")
      .isArray()
      .withMessage("chordProgression must be an array"),
  ],
  validate,
  updateChordProgression
);

// Track operations
router.post(
  "/:projectId/tracks",
  [body("trackName").optional().trim().isLength({ min: 1, max: 100 })],
  validate,
  addTrack
);

router.put(
  "/:projectId/tracks/:trackId",
  [
    body("trackName").optional().trim().isLength({ min: 1, max: 100 }),
    body("volume").optional().isFloat({ min: 0, max: 1 }),
    body("pan").optional().isFloat({ min: -1, max: 1 }),
    body("muted").optional().isBoolean(),
    body("solo").optional().isBoolean(),
    body("trackOrder").optional().isInt({ min: 0 }),
  ],
  validate,
  updateTrack
);

router.delete("/:projectId/tracks/:trackId", deleteTrack);

router.put(
  "/:projectId/timeline/items/:itemId/apply-pattern",
  [body("rhythmPatternId").optional().isString()],
  validate,
  applyRhythmPattern
);

// Backing track generation
router.post(
  "/:projectId/generate-backing",
  [
    body("chords")
      .isArray()
      .withMessage("chords must be an array")
      .notEmpty()
      .withMessage("chords array cannot be empty"),
    body("instrumentId").optional().isMongoId(),
    body("rhythmPatternId").optional().isString(),
    body("chordDuration").optional().isInt({ min: 1, max: 16 }),
  ],
  validate,
  generateBackingTrack
);

// Generate AI backing track with Suno
router.post("/:projectId/generate-ai-backing", generateAIBackingTrack);

export default router;
