import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import "express-async-errors";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import cookieParser from "cookie-parser";
import cors from "cors";

import { corsMiddleware } from "./config/cors.js";
import { connectToDatabase } from "./config/db.js";
import { socketServer } from "./config/socket.js";
import { nodeMediaServer } from "./config/media.js";
import { deleteOldArchivedPosts } from "./services/postArchiveService.js";
// Import all models to ensure they are registered with Mongoose
import "./models/User.js";
import "./models/Role.js";
import "./models/Chord.js";
import "./models/ContentReport.js";
import "./models/ContentTag.js";
import "./models/Instrument.js";
import "./models/Lick.js";
import "./models/LickComment.js";
import "./models/LickLike.js";
import "./models/LickTag.js";
import "./models/LiveRoom.js";
import "./models/Notification.js";
import "./models/PlayingPattern.js";
import "./models/Playlist.js";
import "./models/PlaylistLick.js";
import "./models/Post.js";
import "./models/PostComment.js";
import "./models/PostLike.js";
import "./models/Project.js";
import "./models/ProjectCollaborator.js";
import "./models/ProjectComment.js";
import "./models/ProjectLike.js";
import "./models/ProjectTimelineItem.js";
import "./models/ProjectTrack.js";
import "./models/RoomChat.js";
import "./models/Tag.js";
import "./models/UserFollow.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import lickRoutes from "./routes/lickRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import tagRoutes from "./routes/tagRoutes.js";
import playlistRoutes from "./routes/playlistRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import chordRoutes from "./routes/chordRoutes.js";

import userManageRoute from "./routes/admin/userManageRoute.js";
import createAdminRoute from "./routes/admin/createAdminRoute.js";
import liveroomRoutes from "./routes/user/liveroomRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import dmRoutes from "./routes/dmRoutes.js";
import reportRoutes from "./routes/admin/reportRoutes.js";
import approveLickRoute from "./routes/admin/approveLickRoute.js";
const app = express();
const httpServer = http.createServer(app);

// Middleware
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  })
);
app.use(corsMiddleware());
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Socket.io setup
socketServer(httpServer);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Static file serving
const uploadDir = process.env.UPLOAD_DIR || "uploads";
app.use("/static", express.static(path.join(__dirname, "..", uploadDir)));
app.use(express.static(path.join(__dirname, "..", "public")));

// Health check
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "melodyhub-be",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/licks", approveLickRoute);
app.use("/api/licks", lickRoutes);
app.use("/api/livestreams", liveroomRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dm", dmRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/chords", chordRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/locations", locationRoutes);

app.use('/api/admin', userManageRoute);
app.use('/api/admin', createAdminRoute);
// 404 handler - must be after all routes
app.use((req, res, next) => {
    res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Global error handler - must be last
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);

  // Multer errors
  if (err.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: err.message,
      error: err.code,
    });
  }

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      error: err.message,
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

const port = Number(process.env.PORT) || 9999;

// Start server
async function start() {
  try {
    await connectToDatabase();
    httpServer.listen(port, () => {
      console.log(`melodyhub-be listening on port ${port}`);
      nodeMediaServer();
      
      // Schedule job to delete old archived posts (run daily at 2 AM)
      // Run immediately on startup, then schedule daily
      deleteOldArchivedPosts().catch((err) => {
        console.error('[PostArchive] Error in initial cleanup:', err);
      });
      
      // Run daily at 2 AM
      const scheduleDailyCleanup = () => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(2, 0, 0, 0);
        
        const msUntil2AM = tomorrow.getTime() - now.getTime();
        
        setTimeout(() => {
          // Run cleanup
          deleteOldArchivedPosts().catch((err) => {
            console.error('[PostArchive] Error in scheduled cleanup:', err);
          });
          
          // Schedule next run (24 hours later)
          setInterval(() => {
            deleteOldArchivedPosts().catch((err) => {
              console.error('[PostArchive] Error in scheduled cleanup:', err);
            });
          }, 24 * 60 * 60 * 1000); // 24 hours
        }, msUntil2AM);
      };
      
      scheduleDailyCleanup();
      console.log('[PostArchive] Scheduled job initialized - will delete archived posts older than 30 days daily at 2 AM');
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
