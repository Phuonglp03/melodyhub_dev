// src/hooks/useProjectCollaboration.js
// Phase 2: Frontend Middleware - The Sync Bridge
// For ProjectDetailPage only
import { useEffect, useRef, useCallback } from "react";
import { getSocket, initSocket } from "../services/user/socketService";
import { fetchCollabState } from "../services/user/collabService";
import { collabChannel } from "../utils/collabChannel";
import { nanoid } from "nanoid";

// Helper function to safely call nanoid (handles hot reload and module resolution issues)
const generateId = () => {
  try {
    if (typeof nanoid === 'function') {
      return nanoid();
    }
    // Fallback if nanoid is not a function (hot reload issue)
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  } catch (error) {
    // Last resort fallback
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};

const HEARTBEAT_INTERVAL =
  Number(process.env.REACT_APP_COLLAB_HEARTBEAT_MS) || 15000;
const RESYNC_RETRY_MS = Number(process.env.REACT_APP_COLLAB_RESYNC_MS) || 5000;
const STALE_RESYNC_MS = Number(process.env.REACT_APP_COLLAB_STALE_MS) || 45000;
const ACTIVITY_CHECK_INTERVAL =
  Number(process.env.REACT_APP_COLLAB_ACTIVITY_MS) || 15000;
const COLLAB_DEBUG =
  (process.env.REACT_APP_COLLAB_DEBUG || "").toLowerCase() === "true";
// Optimized throttle constants for responsiveness
// Continuous events (dragging/resizing) use trailing edge throttling
// Discrete events (clicks/mutes/drops) bypass throttling entirely
const BROADCAST_THROTTLE = {
  TIMELINE_ITEM_POSITION_UPDATE: 30, // Faster drag (30ms = ~30fps)
  TIMELINE_ITEM_UPDATE: 50, // Faster resize
  CHORD_PROGRESSION_UPDATE: 100, // Keep chord typing debounced
  // All other events (LICK_ADD_TO_TIMELINE, TRACK_UPDATE, etc.) are NOT throttled
};

const REMOTE_EVENT_MAP = {
  CHORD_PROGRESSION_UPDATE: "project:remote:chordProgression",
  LICK_ADD_TO_TIMELINE: "project:remote:lickAdd",
  TIMELINE_ITEM_UPDATE: "project:remote:timelineUpdate",
  TIMELINE_ITEM_DELETE: "project:remote:timelineDelete",
  TIMELINE_ITEMS_BULK_UPDATE: "project:remote:timelineBulkUpdate",
  TIMELINE_ITEM_POSITION_UPDATE: "project:remote:timelinePositionUpdate",
  PROJECT_SETTINGS_UPDATE: "project:remote:settingsUpdate",
  TRACK_ADD: "project:remote:trackAdd",
  TRACK_UPDATE: "project:remote:trackUpdate",
  TRACK_DELETE: "project:remote:trackDelete",
};

export const useProjectCollaboration = (projectId, user) => {
  const isRemoteUpdate = useRef(false);
  const socketRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const isJoinConfirmedRef = useRef(false);
  const currentProjectIdRef = useRef(null);
  const currentUserIdRef = useRef(null);
  const versionRef = useRef(0);
  const heartbeatTimerRef = useRef(null);
  const resyncTimeoutRef = useRef(null);
  const resyncInFlightRef = useRef(false);
  const throttleTimersRef = useRef({});
  const throttlePayloadRef = useRef({});
  const lastActivityRef = useRef(Date.now());
  const activityIntervalRef = useRef(null);
  const debugEventsRef = useRef([]);
  const resolvedUserId =
    user?._id ??
    user?.id ??
    user?.user?._id ??
    user?.user?.id ??
    user?.userId ??
    user?.user?.userId ??
    null;

  const emitChannelEvent = useCallback((event, detail) => {
    collabChannel.emit(event, detail);
  }, []);

  const recordDebugEvent = useCallback((label, data = {}) => {
    if (!COLLAB_DEBUG) return;
    const entry = {
      ts: new Date().toISOString(),
      label,
      ...data,
    };
    debugEventsRef.current = [...debugEventsRef.current.slice(-99), entry];
    if (typeof window !== "undefined") {
      window.__COLLAB_DEBUG_LOGS__ = debugEventsRef.current;
    }
    // eslint-disable-next-line no-console
    console.log("[CollabDebug]", label, data);
  }, []);

  const cleanupHeartbeat = () => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  };

  const cleanupActivityWatcher = () => {
    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current);
      activityIntervalRef.current = null;
    }
  };

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const startHeartbeat = () => {
    cleanupHeartbeat();
    heartbeatTimerRef.current = setInterval(() => {
      if (socketRef.current?.connected && projectId && resolvedUserId) {
        socketRef.current.emit("project:heartbeat", { projectId });
      }
    }, HEARTBEAT_INTERVAL);
  };

  // OPTIMIZED: Resync only when absolutely necessary
  const performResync = useCallback(async () => {
    if (!projectId) return;
    if (resyncInFlightRef.current) return;
    if (resyncTimeoutRef.current) {
      clearTimeout(resyncTimeoutRef.current);
      resyncTimeoutRef.current = null;
    }
    resyncInFlightRef.current = true;
    const resyncStartedAt = performance.now();

    if (COLLAB_DEBUG) {
      recordDebugEvent("resync:start", {
        projectId,
        fromVersion: versionRef.current,
        viaSocket: !!socketRef.current?.connected,
      });
    }

    const fromVersion = versionRef.current;
    let result = null;

    const socket = socketRef.current;

    if (socket?.connected) {
      result = await new Promise((resolve) => {
        try {
          socket
            .timeout(4000)
            .emit("project:resync", { projectId, fromVersion }, (response) => {
              resolve(response);
            });
        } catch (err) {
          if (COLLAB_DEBUG) {
            console.error("[Collaboration] resync request failed:", err);
            recordDebugEvent("resync:error", {
              projectId,
              source: "socket",
              error: err?.message,
            });
          }
          resolve(null);
        }
      });
    }

    if (!result?.success) {
      try {
        const apiData = await fetchCollabState(projectId, fromVersion);
        if (apiData) {
          result = {
            success: true,
            version: apiData.version,
            snapshot: apiData.snapshot,
            ops: apiData.ops,
            source: "rest",
          };
        }
      } catch (err) {
        if (COLLAB_DEBUG) {
          console.error("[Collaboration] REST resync failed:", err);
          recordDebugEvent("resync:error", {
            projectId,
            source: "rest",
            error: err?.message,
          });
        }
      }
    }

    if (result?.success) {
      if (result.snapshot) {
        emitChannelEvent("project:remote:snapshot", result.snapshot);
      }
      if (result.version && result.version > versionRef.current) {
        versionRef.current = result.version;
      }
      if (Array.isArray(result.ops)) {
        result.ops.forEach((op) => {
          if (!op || op.version <= versionRef.current) return;
          versionRef.current = op.version;
          if (op.senderId === resolvedUserId) return;
          emitChannelEvent(REMOTE_EVENT_MAP[op.type] ?? op.type, op.payload);
        });
      }
      markActivity();

      if (COLLAB_DEBUG) {
        recordDebugEvent("resync:success", {
          projectId,
          source: result.source || (socket?.connected ? "socket" : "rest"),
          version: result.version,
          opsApplied: result.ops?.length || 0,
          durationMs: Math.round(performance.now() - resyncStartedAt),
        });
      }
    } else {
      if (COLLAB_DEBUG) {
        recordDebugEvent("resync:failed", {
          projectId,
          durationMs: Math.round(performance.now() - resyncStartedAt),
        });
      }
    }

    resyncInFlightRef.current = false;
  }, [
    emitChannelEvent,
    projectId,
    resolvedUserId,
    markActivity,
    recordDebugEvent,
  ]);

  const scheduleResync = useCallback(() => {
    if (resyncInFlightRef.current) return;
    if (resyncTimeoutRef.current) return;
    resyncTimeoutRef.current = setTimeout(() => {
      resyncTimeoutRef.current = null;
      performResync();
    }, RESYNC_RETRY_MS);
    if (COLLAB_DEBUG) {
      recordDebugEvent("resync:scheduled", {
        projectId,
        delayMs: RESYNC_RETRY_MS,
      });
    }
  }, [performResync, projectId, recordDebugEvent]);

  const applyRemotePayload = useCallback(
    (payload) => {
      if (!payload?.type) return;
      const eventName = REMOTE_EVENT_MAP[payload.type];
      if (!eventName) {
        console.warn("[Collaboration] Unknown update type:", payload.type);
        return;
      }
      isRemoteUpdate.current = true;
      try {
        emitChannelEvent(eventName, payload.data);
      } catch (err) {
        console.error("[Collaboration] Error applying remote update:", err);
      } finally {
        isRemoteUpdate.current = false;
      }
    },
    [emitChannelEvent]
  );

  useEffect(() => {
    console.log("[Collaboration] useEffect triggered:", {
      projectId,
      resolvedUserId,
      hasProjectId: !!projectId,
      hasResolvedUserId: !!resolvedUserId,
    });

    if (!projectId || !resolvedUserId) {
      console.log(
        "[Collaboration] Skipping - missing projectId or resolvedUserId"
      );
      // Reset state when projectId is missing (user left project)
      hasJoinedRef.current = false;
      isJoinConfirmedRef.current = false;
      // DON'T clear currentProjectIdRef here - keep it to detect rejoin
      return;
    }

    // Make sure socket is initialized with the current user so realtime works
    let socket = getSocket();
    if (!socket) {
      initSocket(resolvedUserId);
      socket = getSocket();
    } else if (
      resolvedUserId &&
      socket.io?.opts?.query?.userId &&
      String(socket.io.opts.query.userId) !== String(resolvedUserId)
    ) {
      // Re-init if the existing socket was created for another user
      initSocket(resolvedUserId);
      socket = getSocket();
    } else if (socket && !socket.connected) {
      // If socket exists but got disconnected, try reconnecting
      socket.connect();
    }
    if (!socket) {
      console.warn("[Collaboration] Socket not available");
      if (COLLAB_DEBUG) {
        console.warn("[Collaboration] Socket not available");
      }
      return;
    }

    console.log("[Collaboration] Socket obtained:", {
      socketId: socket.id,
      connected: socket.connected,
    });

    // Always reset join state when projectId changes or socket changes
    // This ensures clean state when user leaves and rejoins a project
    const previousProjectId = currentProjectIdRef.current;
    const isRejoin = previousProjectId === projectId;
    
    // CRITICAL: Remove ALL old listeners FIRST to prevent duplicate listeners
    // This is especially important when projectId changes or useEffect re-runs
    socket.off("project:update");
    socket.off("project:joined");
    socket.off("project:presence");
    socket.off("project:cursor_update");
    socket.off("project:editing_activity");
    socket.off("project:error");
    socket.off("project:resync:response");
    socket.off("project:ack");
    socket.off("connect");
    socket.off("disconnect");

    socketRef.current = socket;
    
    // Always update refs to current values first
    currentProjectIdRef.current = projectId;
    currentUserIdRef.current = resolvedUserId;
    
    // Track if we should skip joining (already confirmed and joined)
    let shouldSkipJoin = false;
    
    // CRITICAL: When rejoining the same project, check if we need to rejoin
    if (isRejoin && socketRef.current?.connected) {
      // If already confirmed and joined, skip rejoin (useEffect just re-ran)
      if (isJoinConfirmedRef.current && hasJoinedRef.current) {
        console.log(
          "[Collaboration] Already confirmed and joined for same project, skipping rejoin:",
          projectId
        );
        shouldSkipJoin = true;
      } else {
        // Need to rejoin - leave first
        console.log(
          "[Collaboration] Rejoining same project, leaving first:",
          projectId,
          "currentConfirmed:",
          isJoinConfirmedRef.current,
          "currentJoined:",
          hasJoinedRef.current
        );
        socketRef.current.emit("project:leave", { projectId });
        // Reset all state for clean rejoin
        hasJoinedRef.current = false;
        isJoinConfirmedRef.current = false;
      }
    } else if (previousProjectId && previousProjectId !== projectId && socketRef.current?.connected && hasJoinedRef.current) {
      // Different project - leave previous one
      console.log(
        "[Collaboration] Leaving previous project before join:",
        previousProjectId,
        "new project:",
        projectId
      );
      socketRef.current.emit("project:leave", { projectId: previousProjectId });
      // Reset join state immediately
      hasJoinedRef.current = false;
      isJoinConfirmedRef.current = false;
    } else if (!previousProjectId) {
      // First time joining - reset state
      hasJoinedRef.current = false;
      isJoinConfirmedRef.current = false;
    }

    // CRITICAL: Setup ALL listeners BEFORE defining joinProject
    // This ensures listeners are ready to catch events immediately

    // Setup project:joined listener FIRST to catch confirmation immediately
    // CRITICAL: Use refs instead of closure values to handle rejoin correctly
    socket.on("project:joined", ({ projectId: joinedProjectId, userId: joinedUserId, version: joinedVersion }) => {
      console.log(
        "[Collaboration] Received project:joined event:",
        {
          joinedProjectId,
          joinedUserId,
          joinedVersion,
          currentProjectIdRef: currentProjectIdRef.current,
          resolvedUserId,
          socketId: socket.id,
          currentVersion: versionRef.current,
        }
      );
      
      // Always check against refs to handle rejoin correctly
      // This ensures we accept confirmation even if values changed during rejoin
      const currentProjectId = currentProjectIdRef.current;
      const currentUserId = currentUserIdRef.current; // Use ref instead of closure value
      
      const projectIdMatch = String(joinedProjectId) === String(currentProjectId);
      const userIdMatch = String(joinedUserId) === String(currentUserId);
      
      console.log(
        "[Collaboration] Checking confirmation match:",
        {
          projectIdMatch,
          userIdMatch,
          joinedProjectId,
          currentProjectId,
          joinedUserId,
          currentUserId,
          joinedVersion,
          currentVersion: versionRef.current,
        }
      );
      
      if (projectIdMatch && userIdMatch) {
        const wasConfirmed = isJoinConfirmedRef.current;
        isJoinConfirmedRef.current = true;
        hasJoinedRef.current = true; // Always set hasJoined when confirmed
        
        // CRITICAL: Sync version immediately to prevent version gap issues
        // This ensures that when we receive project:update events, they won't be rejected
        // as "version gap" and trigger unnecessary resyncs
        if (typeof joinedVersion === "number" && joinedVersion > versionRef.current) {
          console.log(
            "[Collaboration] 🔄 Syncing version from server:",
            {
              oldVersion: versionRef.current,
              newVersion: joinedVersion,
            }
          );
          versionRef.current = joinedVersion;
        }
        
        console.log(
          "[Collaboration] ✅ Join confirmed by server for project:",
          currentProjectId,
          "socket:",
          socket.id,
          "wasConfirmed:",
          wasConfirmed,
          "nowConfirmed:",
          isJoinConfirmedRef.current,
          "hasJoined:",
          hasJoinedRef.current,
          "version:",
          versionRef.current
        );
        
        // Clear any pending confirmation timeouts
        if (socketRef.current?._confirmationTimeouts) {
          socketRef.current._confirmationTimeouts.forEach(timeout => clearTimeout(timeout));
          socketRef.current._confirmationTimeouts = [];
        }
        
        if (COLLAB_DEBUG) {
          recordDebugEvent("recv:project:joined", { projectId: joinedProjectId, version: joinedVersion });
        }
      } else {
        console.warn(
          "[Collaboration] ⚠️ Ignoring project:joined confirmation - mismatch:",
          { 
            joinedProjectId, 
            currentProjectId, 
            projectIdMatch,
            joinedUserId, 
            currentUserId,
            userIdMatch,
            resolvedUserId
          }
        );
      }
    });

    // Define joinProject function AFTER listeners are setup
    const joinProject = () => {
      if (!socket || !projectId || !resolvedUserId) {
        console.log("[Collaboration] Cannot join - missing:", {
          socket: !!socket,
          projectId,
          resolvedUserId,
        });
        return;
      }

      // CRITICAL: Don't join if already confirmed for this project AND already joined
      // This prevents duplicate joins when useEffect runs multiple times
      // But allow rejoin if hasJoined is false (e.g., after leave)
      if (isJoinConfirmedRef.current && hasJoinedRef.current && currentProjectIdRef.current === projectId) {
        console.log(
          "[Collaboration] Already confirmed and joined for project, skipping join:",
          projectId
        );
        return;
      }

      if (socket.connected) {
        console.log("[Collaboration] Emitting project:join:", {
          projectId,
          userId: resolvedUserId,
          socketId: socket.id,
          previousProjectId,
          isRejoin: previousProjectId === projectId,
        });

        if (COLLAB_DEBUG) {
          console.log("[Collaboration] Joining project:", projectId);
        }
        console.log("[Collaboration] About to emit project:join, current state:", {
          projectId,
          currentProjectIdRef: currentProjectIdRef.current,
          hasJoined: hasJoinedRef.current,
          isConfirmed: isJoinConfirmedRef.current,
          socketId: socket.id,
        });
        
        socket.emit("project:join", { projectId, userId: resolvedUserId });
        hasJoinedRef.current = true;
        // CRITICAL: Don't reset isJoinConfirmedRef if already confirmed for this project
        // This prevents race condition where confirmation arrives before we reset it
        if (currentProjectIdRef.current !== projectId) {
          isJoinConfirmedRef.current = false; // Reset only if project changed
        }
        startHeartbeat();

        // Fallback: If we don't receive confirmation within 1.5 seconds, assume we're joined
        // This handles cases where confirmation might be missed due to timing issues
        const confirmationTimeoutRef = setTimeout(() => {
          if (!isJoinConfirmedRef.current && socket.connected && currentProjectIdRef.current === projectId) {
            console.warn(
              "[Collaboration] Join confirmation timeout after 1.5s, assuming joined for project:",
              projectId,
              "currentProjectIdRef:",
              currentProjectIdRef.current
            );
            isJoinConfirmedRef.current = true;
          }
        }, 1500);

        // Store timeout ref for cleanup
        if (!socketRef.current._confirmationTimeouts) {
          socketRef.current._confirmationTimeouts = [];
        }
        socketRef.current._confirmationTimeouts.push(confirmationTimeoutRef);

        // Request initial presence after joining
        // Some servers may not automatically send presence on join
        setTimeout(() => {
          if (socket.connected && projectId && currentProjectIdRef.current === projectId) {
            console.log("[Collaboration] Requesting presence after join");
            socket.emit("project:presence:request", { projectId });
          }
        }, 500);

        // Perform initial resync after joining to get latest state
        // This ensures new users receive all changes made before they joined
        setTimeout(() => {
          if (socket.connected && projectId && currentProjectIdRef.current === projectId) {
            console.log("[Collaboration] Performing initial resync after join");
            performResync();
          }
        }, 800);
      } else {
        console.log("[Collaboration] Cannot join - socket not connected");
      }
    };

    // Setup remaining listeners
    socket.on("project:update", (payload) => {
      markActivity();
      
      console.log(
        "[Collaboration] 📥 Received project:update:",
        {
          type: payload?.type,
          senderId: payload?.senderId,
          currentUserId: resolvedUserId,
          version: payload?.version,
          currentVersion: versionRef.current,
          collabOpId: payload?.collabOpId,
          isOwnAction: payload?.senderId === resolvedUserId,
        }
      );
      
      if (COLLAB_DEBUG) {
        recordDebugEvent("recv:project:update", {
          type: payload?.type,
          version: payload?.version,
          collabOpId: payload?.collabOpId,
        });
      }
      // Some servers (COLLAB_V2 disabled) may not send version.
      // If missing, just apply with a synthetic increment to keep flow alive.
      const incomingVersion =
        typeof payload?.version === "number"
          ? payload.version
          : versionRef.current + 1;
      const currentVersion = versionRef.current;
      
      if (incomingVersion <= currentVersion) {
        console.log(
          "[Collaboration] ⏭️ Skipping project:update - version too old:",
          { incomingVersion, currentVersion }
        );
        return;
      }

      // Only resync if version gap is significant (>1)
      if (incomingVersion > currentVersion + 1) {
        console.warn(
          "[Collaboration] ⚠️ Version gap detected, requesting resync",
          { currentVersion, incomingVersion }
        );
        if (COLLAB_DEBUG) {
          recordDebugEvent("recv:project:update:gap", {
            currentVersion,
            incomingVersion,
          });
        }
        performResync();
        return;
      }

      versionRef.current = incomingVersion;
      if (payload.senderId === resolvedUserId) {
        console.log(
          "[Collaboration] ⏭️ Skipping project:update - own action",
          { senderId: payload.senderId, currentUserId: resolvedUserId }
        );
        return;
      }
      
      console.log(
        "[Collaboration] ✅ Applying remote payload:",
        { type: payload?.type, senderId: payload?.senderId }
      );
      applyRemotePayload(payload);
    });

    socket.on("project:ack", ({ version, collabOpId }) => {
      markActivity();
      if (COLLAB_DEBUG) {
        recordDebugEvent("recv:project:ack", {
          version,
          collabOpId,
        });
      }
      if (typeof version === "number") {
        versionRef.current = Math.max(versionRef.current, version);
      }
    });

    socket.on("project:presence", (data) => {
      markActivity();
      console.log("[Collaboration] Socket received project:presence:", {
        type: data?.type,
        userId: data?.userId,
        collaboratorsCount: data?.collaborators?.length,
        collaborators: data?.collaborators?.map((c) => ({
          userId: c.userId,
          username: c.user?.username,
          displayName: c.user?.displayName,
        })),
        fullData: data,
      });

      if (COLLAB_DEBUG) {
        recordDebugEvent("recv:project:presence", {
          type: data?.type,
          count: data?.collaborators?.length,
        });
      }
      emitChannelEvent("project:remote:presence", data);
    });

    socket.on("project:cursor_update", (data) => {
      if (data.userId !== resolvedUserId) {
        emitChannelEvent("project:remote:cursor", data);
      }
      markActivity();
      if (COLLAB_DEBUG) {
        recordDebugEvent("recv:project:cursor", {
          userId: data?.userId,
        });
      }
    });

    socket.on("project:editing_activity", (data) => {
      if (data.userId !== resolvedUserId) {
        emitChannelEvent("project:remote:editingActivity", data);
      }
      markActivity();
      if (COLLAB_DEBUG) {
        recordDebugEvent("recv:project:editing_activity", data);
      }
    });

    socket.on("project:error", (error) => {
      emitChannelEvent("project:remote:error", { error, projectId });
      if (COLLAB_DEBUG) {
        recordDebugEvent("recv:project:error", error);
      }
    });

    socket.on("project:resync:response", (payload) => {
      if (!payload?.success) return;
      if (payload.version && payload.version > versionRef.current) {
        versionRef.current = payload.version;
      }
      if (Array.isArray(payload.ops)) {
        payload.ops.forEach((op) => {
          if (!op || op.senderId === resolvedUserId) return;
          emitChannelEvent(REMOTE_EVENT_MAP[op.type] ?? op.type, op.payload);
        });
      }
      markActivity();
      if (COLLAB_DEBUG) {
        recordDebugEvent("recv:project:resync:response", {
          version: payload.version,
          ops: payload.ops?.length,
        });
      }
    });

    socket.on("connect", () => {
      if (COLLAB_DEBUG) {
        console.log("[Collaboration] Socket connected");
      }
      emitChannelEvent("project:remote:connection", {
        connected: true,
      });
      markActivity();
      if (COLLAB_DEBUG) {
        recordDebugEvent("socket:connect", { socketId: socket.id });
      }

      // Always rejoin project on reconnect, even if hasJoinedRef is true
      // because the new socket connection needs to join the room again
      if (projectId && resolvedUserId) {
        if (COLLAB_DEBUG) {
          console.log(
            "[Collaboration] Socket connected, joining project:",
            projectId
          );
        }
        // Reset join state - new socket needs to join again
        hasJoinedRef.current = false;
        isJoinConfirmedRef.current = false;
        joinProject();
      }
    });

    socket.on("disconnect", (reason) => {
      if (COLLAB_DEBUG) {
        console.log("[Collaboration] Socket disconnected:", reason);
      }
      hasJoinedRef.current = false;
      isJoinConfirmedRef.current = false;
      // Don't clear currentProjectIdRef on disconnect - it will be set on reconnect
      cleanupHeartbeat();
      cleanupActivityWatcher();
      emitChannelEvent("project:remote:connection", {
        connected: false,
      });
      scheduleResync();
      if (COLLAB_DEBUG) {
        recordDebugEvent("socket:disconnect", { reason });
      }
    });

    // Now that ALL listeners are setup, we can safely join the project
    // This ensures we don't miss the project:joined confirmation event
    if (socket.connected) {
      emitChannelEvent("project:remote:connection", {
        connected: true,
      });
      markActivity();
      if (COLLAB_DEBUG) {
        recordDebugEvent("socket:connected-initial", { socketId: socket.id });
      }
      // Join project AFTER all listeners are setup
      // Skip if already confirmed and joined (useEffect just re-ran)
      if (shouldSkipJoin) {
        console.log("[Collaboration] Skipping join - already confirmed and joined");
        return;
      }
      
      // If rejoin, add small delay to ensure leave completes
      if (isRejoin) {
        setTimeout(() => {
          if (socket.connected && currentProjectIdRef.current === projectId) {
            console.log("[Collaboration] Rejoin delay complete, joining project");
            joinProject();
          }
        }, 150);
      } else {
        joinProject();
      }
    }

    // Listen for presence requests from other parts of the app
    const handlePresenceRequest = () => {
      if (socket.connected && projectId) {
        console.log("[Collaboration] Requesting presence via socket");
        socket.emit("project:presence:request", { projectId });
      }
    };

    const presenceRequestUnsub = collabChannel.on(
      "project:presence:request",
      handlePresenceRequest
    );

    cleanupActivityWatcher();
    activityIntervalRef.current = setInterval(() => {
      if (!socketRef.current?.connected) return;
      if (Date.now() - lastActivityRef.current >= STALE_RESYNC_MS) {
        if (COLLAB_DEBUG) {
          recordDebugEvent("resync:idle-trigger", {
            idleMs: Date.now() - lastActivityRef.current,
          });
        }
        performResync();
      }
    }, ACTIVITY_CHECK_INTERVAL);

    return () => {
      cleanupHeartbeat();
      cleanupActivityWatcher();
      if (resyncTimeoutRef.current) {
        clearTimeout(resyncTimeoutRef.current);
        resyncTimeoutRef.current = null;
      }
      if (hasJoinedRef.current && currentProjectIdRef.current) {
        socket.emit("project:leave", { projectId: currentProjectIdRef.current });
        hasJoinedRef.current = false;
        isJoinConfirmedRef.current = false;
        // DON'T clear currentProjectIdRef here - we need it to detect rejoin
        // It will be updated when new projectId is set in next useEffect
      }
      Object.values(throttleTimersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
      throttleTimersRef.current = {};
      throttlePayloadRef.current = {};
      if (presenceRequestUnsub) presenceRequestUnsub();
      socket.off("project:update");
      socket.off("project:joined");
      socket.off("project:presence");
      socket.off("project:cursor_update");
      socket.off("project:editing_activity");
      socket.off("project:error");
      socket.off("project:resync:response");
      socket.off("project:ack");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [
    projectId,
    resolvedUserId,
    applyRemotePayload,
    emitChannelEvent,
    performResync,
    scheduleResync,
    markActivity,
    recordDebugEvent,
  ]);

  // OPTIMIZED: Direct Send (No Throttling Logic Overhead)
  const sendAction = useCallback(
    (type, data, options = {}) => {
      const currentProjectId = currentProjectIdRef.current;
      const currentUserId = currentUserIdRef.current;
      
      if (!socketRef.current?.connected) {
        console.warn(
          "[Collaboration] ⚠️ Cannot broadcast - socket not connected",
          { type, currentProjectId }
        );
        return;
      }
      
      // Wait for join confirmation before allowing broadcasts
      // This ensures socket.data is set on server side
      if (!isJoinConfirmedRef.current) {
        console.warn(
          "[Collaboration] ⚠️ Cannot broadcast - join not confirmed yet",
          {
            type,
            currentProjectId,
            isConfirmed: isJoinConfirmedRef.current,
            hasJoined: hasJoinedRef.current,
            socketConnected: socketRef.current?.connected,
            socketId: socketRef.current?.id,
          }
        );
        return;
      }
      
      // Double-check that we're still in the same project
      // Use currentProjectIdRef instead of projectId from closure to avoid stale values
      if (!currentProjectId) {
        console.warn(
          "[Collaboration] ⚠️ Cannot broadcast - no current project",
          { type }
        );
        return;
      }
      
      markActivity();
      
      // Always log for debugging during this issue
      console.log(
        "[Collaboration] ✅ Broadcasting project:action:",
        {
          type,
          projectId: currentProjectId,
          userId: currentUserId,
          socketId: socketRef.current?.id,
          isConfirmed: isJoinConfirmedRef.current,
          hasJoined: hasJoinedRef.current,
        }
      );
      
      if (COLLAB_DEBUG) {
        recordDebugEvent("emit:project:action", {
          type,
          payloadBytes: data ? JSON.stringify(data).length : 0,
        });
      }
      const collabOpId = options.collabOpId || generateId();
      socketRef.current.emit("project:action", {
        type,
        data,
        projectId: currentProjectId,
        collabOpId,
      });
      return collabOpId;
    },
    [markActivity, recordDebugEvent]
  );

  // OPTIMIZED: Smart Broadcast with Trailing Edge Throttling
  const broadcast = useCallback(
    (type, data) => {
      if (isRemoteUpdate.current) return;

      const throttleMs = BROADCAST_THROTTLE[type];

      // 1. Immediate Send (Discrete Events)
      // If no throttle is defined, send INSTANTLY.
      // This fixes the "click delay" on buttons, mutes, drops, etc.
      if (!throttleMs) {
        sendAction(type, data);
        return;
      }

      // 2. Throttled Send (Continuous Events like Dragging)
      // We store the *latest* data in the ref so when the timer fires,
      // it sends the most recent state, not the stale one.
      // This is "trailing edge" throttling - we always send the latest value.
      throttlePayloadRef.current[type] = {
        data,
        collabOpId: generateId(),
      };

      if (throttleTimersRef.current[type]) return; // Timer already running

      throttleTimersRef.current[type] = setTimeout(() => {
        // Flush the LATEST data
        const payload = throttlePayloadRef.current[type];
        if (payload) {
          sendAction(type, payload.data, { collabOpId: payload.collabOpId });
        }

        // Cleanup
        delete throttlePayloadRef.current[type];
        throttleTimersRef.current[type] = null;
      }, throttleMs);
    },
    [sendAction]
  );

  const broadcastCursor = useCallback((sectionId, barIndex, x, y) => {
    if (!socketRef.current?.connected) {
      if (COLLAB_DEBUG) {
        console.warn(
          "[Collaboration] Cannot broadcast cursor - socket not connected"
        );
      }
      return;
    }

    socketRef.current.emit("project:cursor", {
      sectionId,
      barIndex,
      x,
      y,
    });
  }, []);

  const broadcastEditingActivity = useCallback(
    (itemId, isEditing) => {
      if (!socketRef.current?.connected || isRemoteUpdate.current) {
        if (COLLAB_DEBUG) {
          console.warn(
            "[Collaboration] Cannot broadcast editing activity - socket not connected"
          );
        }
        return;
      }

      socketRef.current.emit("project:editing_activity", {
        itemId,
        isEditing,
        projectId,
      });
    },
    [projectId]
  );

  return { broadcast, broadcastCursor, broadcastEditingActivity };
};
