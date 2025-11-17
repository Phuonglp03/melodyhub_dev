import express from "express";
import {
  getMyPlaylists,
  getPlaylistById,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addLickToPlaylist,
  removeLickFromPlaylist,
  reorderPlaylistLicks,
  getCommunityPlaylists,
} from "../controllers/playlistController.js";
import { verifyToken, optionalVerifyToken } from "../middleware/auth.js";

const router = express.Router();
const jsonParser = express.json({ limit: "2mb" });

// UC-16, Screen 30: Create a new playlist
// POST /api/playlists - Create playlist (authenticated)
// IMPORTANT: Must be defined BEFORE /:playlistId routes
router.post("/", verifyToken, jsonParser, createPlaylist);

// Get community playlists (public playlists)
// GET /api/playlists/community - Get public playlists (optional auth)
router.get("/community", optionalVerifyToken, getCommunityPlaylists);

// UC-15, Screen 29: Get user's playlists (My Playlists)
// GET /api/playlists/me - Get current user's playlists (authenticated)
router.get("/me", verifyToken, getMyPlaylists);

// GET /api/playlists/user/:userId - Get specific user's playlists (optional auth)
router.get("/user/:userId", optionalVerifyToken, getMyPlaylists);

// Screen 31: Get playlist detail with all licks
// GET /api/playlists/:playlistId - Get playlist by ID (public if isPublic=true, or owner)
router.get("/:playlistId", optionalVerifyToken, getPlaylistById);

// UC-17, Screen 32: Update playlist
// PUT /api/playlists/:playlistId - Update playlist (authenticated, owner only)
router.put("/:playlistId", verifyToken, jsonParser, updatePlaylist);

// Screen 33: Delete playlist
// DELETE /api/playlists/:playlistId - Delete playlist (authenticated, owner only)
router.delete("/:playlistId", verifyToken, deletePlaylist);

// Screen 24: Add lick to playlist
// POST /api/playlists/:playlistId/licks/:lickId - Add lick to playlist (authenticated, owner only)
router.post(
  "/:playlistId/licks/:lickId",
  verifyToken,
  jsonParser,
  addLickToPlaylist
);

// Remove lick from playlist
// DELETE /api/playlists/:playlistId/licks/:lickId - Remove lick from playlist (authenticated, owner only)
router.delete(
  "/:playlistId/licks/:lickId",
  verifyToken,
  removeLickFromPlaylist
);

// Reorder licks in playlist
// PUT /api/playlists/:playlistId/reorder - Reorder licks in playlist (authenticated, owner only)
router.put("/:playlistId/reorder", verifyToken, jsonParser, reorderPlaylistLicks);

export default router;

