import express from "express";
import {
  getCommunityLicks,
  getTopLicksByLikes,
  getMyLicks,
  getLickById,
  toggleLickLike,
  createLick,
  updateLick,
  deleteLick,
  playLickAudio,
  generateTab,
  getLickComments,
  addLickComment,
  updateLickComment,
  deleteLickComment,
  // getLickComments,
  // addLickComment,
} from "../controllers/lickController.js";
import { uploadAudio } from "../middleware/file.js";
import { verifyToken, optionalVerifyToken } from "../middleware/auth.js";

const jsonParser = express.json({ limit: "2mb" });

console.log("[LICK ROUTES] Loading lick routes...");
console.log("[LICK ROUTES] createLick function:", typeof createLick);
console.log("[LICK ROUTES] uploadAudio middleware:", typeof uploadAudio);

const router = express.Router();

// GET /api/licks/community - Get community licks with search, filter, sort, and pagination
router.get("/community", getCommunityLicks);

// GET /api/licks/leaderboard - Get top licks by likes
router.get("/leaderboard", getTopLicksByLikes);

// GET current user's licks (auth) - uses req.userId
router.get("/user/me", verifyToken, getMyLicks);

// GET /api/licks/user/:userId - fallback legacy route
router.get("/user/:userId", getMyLicks);

// POST /api/licks - Create a new lick (with audio file upload)
// IMPORTANT: This route must come BEFORE /:lickId routes
router.post("/", verifyToken, uploadAudio.single("audio"), createLick);

// POST /api/licks/generate-tab - Generate guitar tab from audio using AI
// IMPORTANT: Must come BEFORE /:lickId routes to avoid being caught by them
router.post("/generate-tab", uploadAudio.single("audio"), generateTab);

// GET /api/licks/:lickId/play - Play/stream lick audio
// Sử dụng optionalVerifyToken để cho phép owner nghe lick private/pending
router.get("/:lickId/play", optionalVerifyToken, playLickAudio);

// GET /api/licks/:lickId - Get lick by ID với đầy đủ thông tin
// Sử dụng optionalVerifyToken để owner vẫn xem được lick riêng tư
router.get("/:lickId", optionalVerifyToken, getLickById);

// POST /api/licks/:lickId/like - Like/Unlike a lick
router.post("/:lickId/like", verifyToken, jsonParser, toggleLickLike);

// PUT /api/licks/:lickId - Update a lick
router.put("/:lickId", jsonParser, updateLick);

// DELETE /api/licks/:lickId - Delete a lick
router.delete("/:lickId", deleteLick);

// Comments
router.get("/:lickId/comments", getLickComments);
router.post("/:lickId/comments", verifyToken, jsonParser, addLickComment);
router.put("/:lickId/comments/:commentId", verifyToken, jsonParser, updateLickComment);
router.delete("/:lickId/comments/:commentId", verifyToken, deleteLickComment);

console.log("[LICK ROUTES] All routes registered successfully");

export default router;
