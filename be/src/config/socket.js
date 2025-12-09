import { Server } from "socket.io";
import RoomChat from "../models/RoomChat.js";
import Conversation from "../models/Conversation.js";
import DirectMessage from "../models/DirectMessage.js";
import LiveRoom from "../models/LiveRoom.js";
import Project from "../models/Project.js";
import ProjectCollaborator from "../models/ProjectCollaborator.js";
import User from "../models/User.js";
import {
  uploadMessageText,
  downloadMessageText,
} from "../services/messageStorageService.js";
import {
  applyOperation,
  getCollabState,
  getMissingOps,
} from "../services/collabStateService.js";
import {
  addCollaboratorPresence,
  removeCollaboratorPresence,
  listCollaborators,
  updateCursorPosition,
  heartbeatPresence,
} from "../services/collabPresenceService.js";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { recordCollabMetric } from "../utils/collabMetrics.js";
let io;

const COLLAB_V2_ENABLED = process.env.COLLAB_V2 !== "off";

// Track viewers per room: { roomId: Set of userIds }
const roomViewers = new Map();

export const socketServer = (httpServer) => {
  const originsEnv =
    process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || "*";
  const allowedOrigins = originsEnv
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  console.log(
    "[Socket.IO] Allowed CORS origins:",
    allowedOrigins.length ? allowedOrigins : ["*"]
  );

  io = new Server(httpServer, {
    cors: {
      origin:
        allowedOrigins.length === 1 && allowedOrigins[0] === "*"
          ? "*"
          : allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Redis Adapter - only if REDIS_URL is provided
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && process.env.REDIS_ENABLED !== "false" && process.env.DISABLE_REDIS !== "true") {
  const pubClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.error("[Socket.IO] Redis Adapter: Max reconnection attempts reached");
            return false;
          }
          return Math.min(retries * 500, 2000);
        },
        connectTimeout: 5000,
      },
  });
  const subClient = pubClient.duplicate();
    
  Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log("[Socket.IO] Đã kết nối Redis Adapter thành công");
    })
    .catch((err) => {
        console.error("[Socket.IO] Lỗi kết nối Redis Adapter:", err.message);
        console.log("[Socket.IO] Tiếp tục chạy KHÔNG có Redis Adapter (single-server mode)");
    });
  } else {
    console.log("[Socket.IO] Redis Adapter disabled hoặc không có REDIS_URL");
    console.log("[Socket.IO] Chạy ở single-server mode (không hỗ trợ horizontal scaling)");
  }

  io.engine.on("connection_error", (err) => {
    console.error("[Socket.IO] connection_error:", {
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client kết nối: ${socket.id}`);

    const tempUserId = socket.handshake.query.userId;
    if (tempUserId) {
      console.log(`[Socket.IO] User ID (tạm thời): ${tempUserId}`);
      socket.join(tempUserId);
    }
    socket.on("join-room", async (roomId) => {
      socket.join(roomId);
      console.log(
        `[Socket.IO] Client ${socket.id} (user: ${tempUserId}) đã tham gia phòng ${roomId}`
      );

      // Track viewer (exclude host) - only for LiveRooms, not posts
      if (tempUserId && roomId && !roomId.startsWith("post:")) {
        socket.currentRoomId = roomId; // Store for disconnect

        try {
          // Check if user is host
          const room = await LiveRoom.findById(roomId);
          const isHost = room && String(room.hostId) === String(tempUserId);

          if (!isHost) {
            // Only track non-host viewers
            if (!roomViewers.has(roomId)) {
              roomViewers.set(roomId, new Map());
            }
            const viewers = roomViewers.get(roomId);

            // Store user info with socket id
            if (!viewers.has(tempUserId)) {
              viewers.set(tempUserId, new Set());
            }
            viewers.get(tempUserId).add(socket.id);

            const currentCount = viewers.size;
            const viewerList = Array.from(viewers.keys());

            // Emit viewer count update
            io.to(roomId).emit("viewer-count-update", {
              roomId,
              currentViewers: currentCount,
              viewerIds: viewerList,
            });

            console.log(
              `[Socket.IO] Room ${roomId} now has ${currentCount} viewers (excluding host)`
            );
          } else {
            console.log(
              `[Socket.IO] Host joined room ${roomId}, not counted as viewer`
            );
          }
        } catch (err) {
          console.error("[Socket.IO] Error checking host:", err);
        }
      }
    });

    socket.on('send-message-liveroom', async ({ roomId, message }) => {
      if (!tempUserId) {
        return socket.emit('chat-error', 'Xác thực không hợp lệ.');
      }
      
      try {
        const room = await LiveRoom.findById(roomId);
        if (!room) {
          return socket.emit('chat-error', 'Phòng không tồn tại.');
        }

        const user = await User.findById(tempUserId);
        if (!user) {
          return socket.emit('chat-error', 'Người dùng không tồn tại.');
        }
        
        // Check xem user có bị ban chat bởi host của phòng này không
        if (user.chatBannedByHosts && user.chatBannedByHosts.length > 0) {
          const isBannedByHost = user.chatBannedByHosts.some(
            bannedHostId => bannedHostId.toString() === room.hostId.toString()
          );
          if (isBannedByHost) {
            return socket.emit('chat-error', 'Bạn đã bị cấm chat trong các phòng livestream của host này.');
          }
        }
        
        const chat = new RoomChat({
          roomId,
          userId: tempUserId, 
          message,
          messageType: 'text'
        });
        
        const savedChat = await chat.save();
        const result = await RoomChat.findById(savedChat._id).populate('userId', 'displayName avatarUrl');
        io.to(roomId).emit('new-message-liveroom', result);

      } catch (err) {
        console.error(`[Socket.IO] Lỗi khi gửi tin nhắn: ${err.message}`);
        socket.emit('chat-error', 'Không thể gửi tin nhắn.');
      }
    });

    // --- DM events ---
    socket.on("dm:join", (conversationId) => {
      if (!conversationId) return;
      socket.join(conversationId);
      console.log(`[Socket.IO] ${socket.id} dm:join ${conversationId}`);
    });

    socket.on("dm:typing", ({ conversationId, typing }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit("dm:typing", {
        conversationId,
        typing: !!typing,
        userId: tempUserId,
      });
      console.log(
        `[Socket.IO] dm:typing from ${tempUserId} -> room ${conversationId} typing=${!!typing}`
      );
    });

    socket.on("dm:send", async ({ conversationId, text }) => {
      try {
        if (!tempUserId) return socket.emit("dm:error", "Unauthorized");
        if (!conversationId || !text || !text.trim()) return;

        const convo = await Conversation.findById(conversationId);
        if (!convo) return socket.emit("dm:error", "Conversation not found");
        const isParticipant = convo.participants.some(
          (p) => String(p) === String(tempUserId)
        );
        if (!isParticipant) return socket.emit("dm:error", "Not a participant");
        if (convo.status !== "active") {
          const isRequester =
            String(convo.requestedBy || "") === String(tempUserId);
          if (!(convo.status === "pending" && isRequester)) {
            return socket.emit(
              "dm:error",
              "Conversation not active (only requester can send while pending)"
            );
          }
        }

        // Upload text to storage (Cloudinary if long, MongoDB if short)
        const messageId = `msg_${Date.now()}_${tempUserId}`;
        const storageResult = await uploadMessageText(text.trim(), messageId);

        // Create message with storage info
        const msg = await DirectMessage.create({
          conversationId,
          senderId: tempUserId,
          text: storageResult.text || null,
          textStorageId: storageResult.storageId || null,
          textStorageType: storageResult.storageType,
          textPreview: storageResult.textPreview,
        });

        const populatedMsg = await DirectMessage.findById(msg._id)
          .populate("senderId", "displayName username avatarUrl")
          .lean();

        // Download full text nếu lưu trong Cloudinary
        if (
          populatedMsg.textStorageType === "cloudinary" &&
          populatedMsg.textStorageId
        ) {
          populatedMsg.text = await downloadMessageText(
            populatedMsg.textStorageType,
            populatedMsg.textStorageId,
            populatedMsg.textPreview
          );
        } else {
          populatedMsg.text =
            populatedMsg.text || populatedMsg.textPreview || "";
        }

        const peer = convo.participants.find(
          (p) => String(p) !== String(tempUserId)
        );
        convo.lastMessage = storageResult.textPreview;
        convo.lastMessageAt = msg.createdAt;
        const currentUnread = Number(
          convo.unreadCounts?.get(String(peer)) || 0
        );
        convo.unreadCounts.set(String(peer), currentUnread + 1);
        await convo.save();

        console.log(
          `[Socket.IO] dm:send saved -> emit dm:new to room ${conversationId} and users ${tempUserId} / ${peer}`
        );
        io.to(conversationId).emit("dm:new", {
          conversationId,
          message: populatedMsg,
        });
        if (peer) {
          io.to(String(peer)).emit("dm:new", {
            conversationId,
            message: populatedMsg,
          });
          io.to(String(peer)).emit("dm:badge", { conversationId });
        }
        io.to(String(tempUserId)).emit("dm:badge", { conversationId });
      } catch (err) {
        console.error("[Socket.IO] dm:send error:", err.message);
        socket.emit("dm:error", "Cannot send message");
      }
    });

    socket.on("dm:seen", async ({ conversationId }) => {
      try {
        if (!tempUserId || !conversationId) return;
        const convo = await Conversation.findById(conversationId);
        if (!convo) return;
        const isParticipant = convo.participants.some(
          (p) => String(p) === String(tempUserId)
        );
        if (!isParticipant) return;
        convo.unreadCounts.set(String(tempUserId), 0);
        await convo.save();
        socket
          .to(conversationId)
          .emit("dm:seen", { conversationId, userId: tempUserId });
      } catch (err) {
        console.error("[Socket.IO] dm:seen error:", err.message);
      }
    });

    // ========== PROJECT COLLABORATION EVENTS ==========
    socket.on("project:join", async ({ projectId, userId }) => {
      console.log(`[Socket.IO] project:join event received:`, {
        projectId,
        userId,
        socketId: socket.id,
      });

      if (!projectId || !userId) {
        console.log(`[Socket.IO] project:join - Missing projectId or userId`);
        return socket.emit("project:error", {
          message: "Missing projectId or userId",
        });
      }

      try {
        // Security: Check if user has access to this project
        const project = await Project.findById(projectId);
        if (!project) {
          return socket.emit("project:error", { message: "Project not found" });
        }

        // Check if user is owner or collaborator
        const isOwner = String(project.creatorId) === String(userId);
        const collaborator = await ProjectCollaborator.findOne({
          projectId,
          userId,
          role: { $in: ["admin", "contributor", "viewer"] },
          status: "accepted",
        });
        const hasAccess = isOwner || !!collaborator;

        if (!hasAccess) {
          return socket.emit("project:error", { message: "Access denied" });
        }

        // CRITICAL: If socket is already in this project room, leave first to ensure clean state
        // This handles the case when user leaves and rejoins the same project
        const isRejoin = socket.data.projectId === projectId;
        if (isRejoin) {
          console.log(
            `[Socket.IO] Socket ${socket.id} REJOINING project ${projectId}, leaving first for clean rejoin`
          );
          socket.leave(`project:${projectId}`);
          // Clear socket.data before rejoining
          socket.data.projectId = null;
          socket.data.userId = null;
        }

        // Join project room and set socket data IMMEDIATELY
        // This ensures socket.data is set before any async operations
        // so that project:action events can be processed correctly
        // Note: socket.join() is idempotent - safe to call multiple times
        socket.join(`project:${projectId}`);
        socket.data.projectId = projectId;
        socket.data.userId = userId;

        // Get current version to sync client immediately
        // This prevents version gap issues when client receives updates
        let currentVersion = 0;
        if (COLLAB_V2_ENABLED) {
          try {
            const collabState = await getCollabState(projectId);
            currentVersion = collabState?.version || 0;
          } catch (err) {
            console.warn(
              `[Socket.IO] Failed to get version for project ${projectId}:`,
              err.message
            );
            // Continue with version 0 if we can't fetch it
          }
        }

        // Emit join confirmation IMMEDIATELY so client knows it's safe to send actions
        // ALWAYS emit this, even if socket was already in room (for rejoin case)
        // This must happen BEFORE any async operations to ensure client receives it
        // Include currentVersion so client can sync immediately and avoid version gaps
        const confirmationPayload = { projectId, userId, version: currentVersion };
        socket.emit("project:joined", confirmationPayload);
        
        console.log(
          `[Socket.IO] Socket ${socket.id} ${isRejoin ? 'REJOINED' : 'joined'} project room project:${projectId}, socket.data set, confirmation emitted:`,
          confirmationPayload
        );

        const user = await User.findById(userId).select(
          "displayName username avatarUrl"
        );

        if (!user) {
          socket.leave(`project:${projectId}`);
          socket.data.projectId = null;
          socket.data.userId = null;
          return socket.emit("project:error", { message: "User not found" });
        }

        const presencePayload = {
          _id: user._id,
          displayName: user.displayName || user.username,
          username: user.username,
          avatarUrl: user.avatarUrl,
        };

        if (COLLAB_V2_ENABLED) {
          try {
            await addCollaboratorPresence(
              projectId,
              userId,
              presencePayload,
              socket.id
            );
            console.log(
              `[Socket.IO] Added presence for user ${userId} in project ${projectId}`
            );
          } catch (err) {
            console.error(
              `[Socket.IO] Failed to add presence for user ${userId}:`,
              err.message
            );
            // Continue even if Redis fails - we'll still emit presence events
          }

          const activeCollaborators = await listCollaborators(projectId);
          console.log(
            `[Socket.IO] Retrieved ${activeCollaborators.length} active collaborators for project ${projectId}`
          );

          // Notify other users about the new join
          socket.to(`project:${projectId}`).emit("project:presence", {
            type: "JOIN",
            userId,
            user: presencePayload,
          });

          // Send current collaborators list to the joining user
          socket.emit("project:presence", {
            type: "SYNC",
            collaborators: activeCollaborators,
          });

          console.log(
            `[Socket.IO] User ${userId} joined project ${projectId} - sent SYNC with ${activeCollaborators.length} collaborators:`,
            activeCollaborators.map((c) => ({
              userId: c.userId,
              username: c.user?.username,
            }))
          );
        } else {
          console.log(
            `[Socket.IO] User ${userId} joined project ${projectId} - COLLAB_V2_ENABLED is false`
          );
        }

        console.log(`[Socket.IO] User ${userId} joined project ${projectId}`);
      } catch (err) {
        console.error("[Socket.IO] project:join error:", err);
        socket.emit("project:error", { message: "Failed to join project" });
      }
    });

    socket.on("project:action", async (payload = {}) => {
      const { projectId, userId } = socket.data;
      console.log(
        `[Socket.IO] project:action received from socket ${socket.id}:`,
        {
          type: payload.type,
          socketDataProjectId: projectId,
          socketDataUserId: userId,
          payloadProjectId: payload.projectId,
          hasProjectId: !!projectId,
          hasUserId: !!userId,
        }
      );
      
      if (!projectId || !userId) {
        console.warn(
          `[Socket.IO] ⚠️ project:action rejected - socket.data not set:`,
          {
            socketId: socket.id,
            socketData: socket.data,
            payloadProjectId: payload.projectId,
          }
        );
        return socket.emit("project:error", {
          message: "Not in a project room",
        });
      }
      const payloadBytes = payload?.data
        ? Buffer.byteLength(JSON.stringify(payload.data))
        : 0;
      recordCollabMetric("project_action_received", {
        projectId,
        userId,
        type: payload.type,
        collabOpId: payload.collabOpId,
        payloadBytes,
      });

      if (!COLLAB_V2_ENABLED) {
        const broadcastPayload = {
          ...payload,
          senderId: userId,
          timestamp: Date.now(),
        };
        socket
          .to(`project:${projectId}`)
          .emit("project:update", broadcastPayload);
        recordCollabMetric("project_action_broadcast", {
          projectId,
          userId,
          type: payload.type,
          collabOpId: payload.collabOpId,
        });
        return;
      }

      try {
        const operationResult = await applyOperation(
          projectId,
          {
            type: payload.type,
            payload: payload.data,
            collabOpId: payload.collabOpId,
          },
          {
            senderId: userId,
            snapshot: payload.snapshot,
            collabOpId: payload.collabOpId,
          }
        );

        const broadcastPayload = {
          type: payload.type,
          data: payload.data,
          senderId: userId,
          timestamp: operationResult.op.timestamp,
          version: operationResult.version,
          collabOpId:
            payload.collabOpId || operationResult.op.collabOpId || null,
        };

        console.log(
          `[Socket.IO] ✅ Broadcasting project:update to room project:${projectId}:`,
          {
            type: payload.type,
            senderId: userId,
            version: operationResult.version,
            collabOpId: broadcastPayload.collabOpId,
            socketId: socket.id,
          }
        );
        
        socket
          .to(`project:${projectId}`)
          .emit("project:update", broadcastPayload);
        socket.emit("project:ack", {
          type: payload.type,
          version: operationResult.version,
          collabOpId: broadcastPayload.collabOpId,
        });
        recordCollabMetric("project_action_broadcast", {
          projectId,
          userId,
          type: payload.type,
          version: operationResult.version,
          collabOpId: broadcastPayload.collabOpId,
          payloadBytes,
        });

        console.log(
          `[Socket.IO] project:action ${payload.type} v${operationResult.version} from ${userId} in project ${projectId}`
        );
      } catch (err) {
        console.error("[Socket.IO] project:action error:", err);
        socket.emit("project:error", {
          message: "Failed to apply collaboration action",
        });
      }
    });

    socket.on("project:cursor", (data) => {
      const { projectId, userId } = socket.data;
      if (!projectId || !userId) return;

      const run = async () => {
        if (COLLAB_V2_ENABLED) {
          await updateCursorPosition(projectId, userId, data);
        }
        // Broadcast cursor update with x, y coordinates
        socket.to(`project:${projectId}`).emit("project:cursor_update", {
          userId,
          sectionId: data.sectionId,
          barIndex: data.barIndex,
          x: data.x,
          y: data.y,
        });
      };
      run().catch((err) =>
        console.error("[Socket.IO] project:cursor error:", err)
      );
    });

    socket.on("project:editing_activity", (data) => {
      const { projectId, userId } = socket.data;
      if (!projectId || !userId) return;

      // Broadcast editing activity to others
      socket.to(`project:${projectId}`).emit("project:editing_activity", {
        userId,
        itemId: data.itemId,
        isEditing: data.isEditing,
      });
    });

    socket.on("project:leave", async ({ projectId }) => {
      if (!projectId) return;
      socket.leave(`project:${projectId}`);

      const { userId } = socket.data;
      if (userId) {
        if (COLLAB_V2_ENABLED) {
          const remaining = await removeCollaboratorPresence(
            projectId,
            userId,
            socket.id
          );
          if (!remaining) {
            socket.to(`project:${projectId}`).emit("project:presence", {
              type: "LEAVE",
              userId,
            });
          }
        } else {
          socket.to(`project:${projectId}`).emit("project:presence", {
            type: "LEAVE",
            userId,
          });
        }
      }
      
      // Clear socket.data when leaving project to prevent stale state
      // This ensures clean state when user joins a different project or rejoins
      if (socket.data.projectId === projectId) {
        socket.data.projectId = null;
        socket.data.userId = null;
        console.log(
          `[Socket.IO] Socket ${socket.id} left project ${projectId}, socket.data cleared`
        );
      }
    });

    socket.on("project:heartbeat", () => {
      const { projectId, userId } = socket.data;
      if (!projectId || !userId || !COLLAB_V2_ENABLED) return;
      recordCollabMetric("project_heartbeat", {
        projectId,
        userId,
        socketId: socket.id,
      });
      heartbeatPresence(projectId, userId).catch((err) =>
        console.error("[Socket.IO] project:heartbeat error:", err)
      );
    });

    socket.on(
      "project:presence:request",
      async ({ projectId: requestedProjectId }) => {
        const { projectId, userId } = socket.data;
        const targetProjectId = requestedProjectId || projectId;

        if (!targetProjectId || !COLLAB_V2_ENABLED) {
          console.log(
            "[Socket.IO] project:presence:request - missing projectId or V2 disabled"
          );
          return;
        }

        try {
          // Verify user has access to this project
          const project = await Project.findById(targetProjectId);
          if (!project) {
            return socket.emit("project:error", {
              message: "Project not found",
            });
          }

          const isOwner =
            String(project.creatorId) === String(userId || socket.data.userId);
          const collaborator = await ProjectCollaborator.findOne({
            projectId: targetProjectId,
            userId: userId || socket.data.userId,
            role: { $in: ["admin", "contributor", "viewer"] },
            status: "accepted",
          });
          const hasAccess = isOwner || !!collaborator;

          if (!hasAccess) {
            return socket.emit("project:error", { message: "Access denied" });
          }

          // Get current list of collaborators
          const activeCollaborators = await listCollaborators(targetProjectId);

          console.log(
            `[Socket.IO] project:presence:request - sending ${activeCollaborators.length} collaborators for project ${targetProjectId}`
          );

          // Send current presence state
          socket.emit("project:presence", {
            type: "SYNC",
            collaborators: activeCollaborators,
          });
        } catch (err) {
          console.error("[Socket.IO] project:presence:request error:", err);
          socket.emit("project:error", { message: "Failed to get presence" });
        }
      }
    );

    socket.on("project:resync", async ({ projectId, fromVersion }, reply) => {
      if (!projectId) {
        if (typeof reply === "function") {
          reply({ success: false, message: "projectId required" });
        }
        return;
      }

      if (!COLLAB_V2_ENABLED) {
        if (typeof reply === "function") {
          reply({
            success: false,
            message: "Collaboration v2 is disabled",
          });
        } else {
          socket.emit("project:error", {
            message: "Collaboration resync not available",
          });
        }
        return;
      }

      recordCollabMetric("resync_request", {
        projectId,
        socketId: socket.id,
        fromVersion,
      });

      try {
        const state = await getCollabState(projectId);
        const ops = await getMissingOps(projectId, fromVersion || 0);
        const payload = {
          success: true,
          projectId,
          version: state.version,
          snapshot: state.snapshot,
          ops,
        };
        recordCollabMetric("resync_success", {
          projectId,
          socketId: socket.id,
          fromVersion,
          version: state.version,
          ops: ops.length,
        });
        if (typeof reply === "function") {
          reply(payload);
        } else {
          socket.emit("project:resync:response", payload);
        }
      } catch (err) {
        console.error("[Socket.IO] project:resync error:", err);
        if (typeof reply === "function") {
          reply({ success: false, message: err.message });
        } else {
          socket.emit("project:error", {
            message: "Failed to fetch collaboration state",
          });
        }
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client ngắt kết nối: ${socket.id}`);

      // Remove viewer from tracking
      if (tempUserId && socket.currentRoomId) {
        const roomId = socket.currentRoomId;
        const viewers = roomViewers.get(roomId);

        if (viewers && viewers.has(tempUserId)) {
          const userSockets = viewers.get(tempUserId);
          userSockets.delete(socket.id);

          // If user has no more sockets, remove them
          if (userSockets.size === 0) {
            viewers.delete(tempUserId);
          }

          // Emit updated count
          const currentCount = viewers.size;
          const viewerList = Array.from(viewers.keys());
          io.to(roomId).emit("viewer-count-update", {
            roomId,
            currentViewers: currentCount,
            viewerIds: viewerList,
          });

          console.log(
            `[Socket.IO] Room ${roomId} now has ${currentCount} viewers (user left)`
          );

          // Clean up empty room
          if (viewers.size === 0) {
            roomViewers.delete(roomId);
          }
        }
      }

      // Handle project collaboration disconnect
      const { projectId, userId } = socket.data;
      if (projectId && userId && COLLAB_V2_ENABLED) {
        removeCollaboratorPresence(projectId, userId, socket.id)
          .then((remaining) => {
            if (!remaining) {
              socket.to(`project:${projectId}`).emit("project:presence", {
                type: "LEAVE",
                userId,
              });
            }
          })
          .catch((err) =>
            console.error("[Socket.IO] presence cleanup error:", err)
          );
      }
      
      // Clear socket.data to prevent stale state on reconnect
      // New socket connection will need to join project again
      socket.data.projectId = null;
      socket.data.userId = null;
    });
  });

  return io;
};

export const getSocketIo = () => {
  if (!io) {
    throw new Error("Socket.io chưa được khởi tạo!");
  }
  return io;
};
