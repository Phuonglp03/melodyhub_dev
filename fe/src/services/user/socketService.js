import { io } from "socket.io-client";
import { store } from "../../redux/store";
// URL của server (cổng Express/Socket.IO)
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || "";
console.log("[Socket.IO] SOCKET_URL resolved to:", SOCKET_URL);

let socket;

export const initSocket = (explicitUserId) => {
  if (socket) {
    socket.disconnect();
  }
  const userId = explicitUserId || store.getState().auth.user?.user?.id;
  if (userId) {
    console.log("[Socket.IO] Attempting connection to:", SOCKET_URL);
    socket = io(SOCKET_URL, {
      query: { userId: userId },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("[Socket.IO] Đã kết nối:", socket.id, "as user", userId);
      // Re-setup any pending listeners when socket connects
      if (socket._pendingPostArchivedCallbacks) {
        socket._pendingPostArchivedCallbacks.forEach((cb) => {
          socket.on("post:archived", cb);
        });
        socket._pendingPostArchivedCallbacks = [];
      }
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket.IO] connect_error", err?.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket.IO] Đã ngắt kết nối:", reason);
    });
  } else {
    console.warn(
      "[Socket.IO] Người dùng chưa đăng nhập, không kết nối socket."
    );
  }
};

export const getSocket = () => {
  // Sửa: Phải kiểm tra 'socket' có tồn tại không trước khi dùng
  if (!socket) {
    // Nếu chưa init (ví dụ: F5 trang), hãy init
    initSocket();
  }
  // Có thể vẫn là null nếu user không đăng nhập
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// --- Emitters (Gửi sự kiện) ---
export const joinRoom = (roomId) => {
  getSocket().emit("join-room", roomId);
};

export const sendMessage = (roomId, message) => {
  getSocket().emit("send-message-liveroom", { roomId, message });
};

// --- Listeners (Lắng nghe sự kiện) ---
const safeOn = (event, callback) => {
  const s = getSocket();
  if (s) {
    s.on(event, callback);
  } else {
    console.warn(
      `[Socket.IO] Bỏ qua lắng nghe '${event}' vì socket chưa sẵn sàng.`
    );
  }
};

export const onStreamPreviewReady = (callback) => {
  safeOn("stream-preview-ready", callback);
};

export const onStreamStatusLive = (callback) => {
  safeOn("stream-status-live", callback);
};

export const onStreamEnded = (callback) => {
  safeOn("stream-status-ended", callback);
};

export const onStreamDetailsUpdated = (callback) => {
  safeOn("stream-details-updated", callback);
};

export const onNewMessage = (callback) => {
  safeOn("new-message-liveroom", callback);
};

export const onStreamPrivacyUpdated = (callback) => {
  safeOn("stream-privacy-updated", callback);
};
export const onUserBanned = (callback) => {
  safeOn("user-banned", callback);
};
export const onMessageRemoved = (callback) => {
  safeOn("message-removed", callback);
};
export const onViewerCountUpdate = (callback) => {
  safeOn("viewer-count-update", callback);
};
export const onChatError = (callback) => {
  safeOn("chat-error", callback);
};
export const onChatBanned = (callback) => {
  safeOn('chat-banned', callback);
};
export const onChatUnbanned = (callback) => {
  safeOn('chat-unbanned', callback);
};

// ---- Admin Livestream Realtime Events ----
// Khi có livestream mới bắt đầu (global event)
export const onStreamStarted = (callback) => {
  console.log("[Socket] listen stream-started");
  const socket = getSocket();
  if (socket) {
    const wrappedCallback = (payload) => {
      console.log("[Socket] Received stream-started event:", payload);
      callback(payload);
    };
    socket.on("stream-started", wrappedCallback);
    if (!socket._streamStartedCallbacks) {
      socket._streamStartedCallbacks = [];
    }
    socket._streamStartedCallbacks.push({ original: callback, wrapped: wrappedCallback });
  }
};
export const offStreamStarted = (callback) => {
  console.log("[Socket] off stream-started");
  const socket = getSocket();
  if (socket && socket._streamStartedCallbacks) {
    const found = socket._streamStartedCallbacks.find(cb => cb.original === callback);
    if (found) {
      socket.off("stream-started", found.wrapped);
      socket._streamStartedCallbacks = socket._streamStartedCallbacks.filter(cb => cb !== found);
    } else {
      socket.off("stream-started", callback);
    }
  } else if (socket) {
    socket.off("stream-started", callback);
  }
};

// Khi livestream kết thúc (global event)
export const onGlobalStreamEnded = (callback) => {
  console.log("[Socket] listen stream-ended (global)");
  const socket = getSocket();
  if (socket) {
    const wrappedCallback = (payload) => {
      console.log("[Socket] Received stream-ended (global) event:", payload);
      callback(payload);
    };
    socket.on("stream-ended", wrappedCallback);
    if (!socket._globalStreamEndedCallbacks) {
      socket._globalStreamEndedCallbacks = [];
    }
    socket._globalStreamEndedCallbacks.push({ original: callback, wrapped: wrappedCallback });
  }
};
export const offGlobalStreamEnded = (callback) => {
  console.log("[Socket] off stream-ended (global)");
  const socket = getSocket();
  if (socket && socket._globalStreamEndedCallbacks) {
    const found = socket._globalStreamEndedCallbacks.find(cb => cb.original === callback);
    if (found) {
      socket.off("stream-ended", found.wrapped);
      socket._globalStreamEndedCallbacks = socket._globalStreamEndedCallbacks.filter(cb => cb !== found);
    } else {
      socket.off("stream-ended", callback);
    }
  } else if (socket) {
    socket.off("stream-ended", callback);
  }
};

// Khi có báo cáo livestream mới (cho admin)
export const onNewLivestreamReport = (callback) => {
  console.log("[Socket] listen new:livestream-report");
  const socket = getSocket();
  if (socket) {
    const wrappedCallback = (payload) => {
      console.log("[Socket] Received new:livestream-report event:", payload);
      callback(payload);
    };
    socket.on("new:livestream-report", wrappedCallback);
    if (!socket._newLivestreamReportCallbacks) {
      socket._newLivestreamReportCallbacks = [];
    }
    socket._newLivestreamReportCallbacks.push({ original: callback, wrapped: wrappedCallback });
  }
};
export const offNewLivestreamReport = (callback) => {
  console.log("[Socket] off new:livestream-report");
  const socket = getSocket();
  if (socket && socket._newLivestreamReportCallbacks) {
    const found = socket._newLivestreamReportCallbacks.find(cb => cb.original === callback);
    if (found) {
      socket.off("new:livestream-report", found.wrapped);
      socket._newLivestreamReportCallbacks = socket._newLivestreamReportCallbacks.filter(cb => cb !== found);
    } else {
      socket.off("new:livestream-report", callback);
    }
  } else if (socket) {
    socket.off("new:livestream-report", callback);
  }
};

// ---- Posts / Comments realtime ----
export const onPostCommentNew = (callback) => {
  getSocket()?.on("post:comment:new", callback);
};
export const offPostCommentNew = (callback) => {
  getSocket()?.off("post:comment:new", callback);
};

// Post archived event
export const onPostArchived = (callback) => {
  const socket = getSocket();
  if (socket) {
    console.log(
      "[Socket] Setting up post:archived listener, socket connected:",
      socket.connected
    );
    const wrappedCallback = (payload) => {
      console.log("[Socket] Received post:archived event:", payload);
      callback(payload);
    };

    // Always setup listener (socket.io will queue events if not connected)
    socket.on("post:archived", wrappedCallback);

    // Store callback reference for cleanup
    if (!socket._postArchivedCallbacks) {
      socket._postArchivedCallbacks = [];
    }
    socket._postArchivedCallbacks.push({
      original: callback,
      wrapped: wrappedCallback,
    });
  } else {
    console.warn(
      "[Socket] Cannot setup post:archived listener - socket not available"
    );
  }
};
export const offPostArchived = (callback) => {
  const socket = getSocket();
  if (socket) {
    console.log("[Socket] Removing post:archived listener");
    if (socket._postArchivedCallbacks) {
      const found = socket._postArchivedCallbacks.find(
        (cb) => cb.original === callback
      );
      if (found) {
        socket.off("post:archived", found.wrapped);
        socket._postArchivedCallbacks = socket._postArchivedCallbacks.filter(
          (cb) => cb !== found
        );
      } else {
        socket.off("post:archived", callback);
      }
    } else {
      socket.off("post:archived", callback);
    }
  }
};

// Post deleted event (admin deleted permanently)
export const onPostDeleted = (callback) => {
  const socket = getSocket();
  if (socket) {
    console.log(
      "[Socket] Setting up post:deleted listener, socket connected:",
      socket.connected
    );
    const wrappedCallback = (payload) => {
      console.log("[Socket] Received post:deleted event:", payload);
      callback(payload);
    };

    // Always setup listener (socket.io will queue events if not connected)
    socket.on("post:deleted", wrappedCallback);

    // Store callback reference for cleanup
    if (!socket._postDeletedCallbacks) {
      socket._postDeletedCallbacks = [];
    }
    socket._postDeletedCallbacks.push({
      original: callback,
      wrapped: wrappedCallback,
    });
  } else {
    console.warn(
      "[Socket] Cannot setup post:deleted listener - socket not available"
    );
  }
};

export const offPostDeleted = (callback) => {
  const socket = getSocket();
  if (socket) {
    console.log("[Socket] Removing post:deleted listener");
    if (socket._postDeletedCallbacks) {
      const found = socket._postDeletedCallbacks.find(
        (cb) => cb.original === callback
      );
      if (found) {
        socket.off("post:deleted", found.wrapped);
        socket._postDeletedCallbacks = socket._postDeletedCallbacks.filter(
          (cb) => cb !== found
        );
      } else {
        socket.off("post:deleted", callback);
      }
    } else {
      socket.off("post:deleted", callback);
    }
  }
};

// ---- Notifications realtime ----
export const onNotificationNew = (callback) => {
  console.log("[Notification] listen notification:new");
  getSocket()?.on("notification:new", callback);
};
export const offNotificationNew = (callback) => {
  console.log("[Notification] off notification:new");
  getSocket()?.off("notification:new", callback);
};

// ---- Reports realtime ----
export const onNewReport = (callback) => {
  console.log("[Report] listen new:report");
  const socket = getSocket();
  if (socket) {
    const wrappedCallback = (payload) => {
      console.log("[Report] Received new:report event:", payload);
      callback(payload);
    };
    socket.on("new:report", wrappedCallback);
    // Store wrapped callback for cleanup
    if (!socket._newReportCallbacks) {
      socket._newReportCallbacks = [];
    }
    socket._newReportCallbacks.push({ original: callback, wrapped: wrappedCallback });
  }
};
export const offNewReport = (callback) => {
  console.log("[Report] off new:report");
  const socket = getSocket();
  if (socket && socket._newReportCallbacks) {
    const found = socket._newReportCallbacks.find(cb => cb.original === callback);
    if (found) {
      socket.off("new:report", found.wrapped);
      socket._newReportCallbacks = socket._newReportCallbacks.filter(cb => cb !== found);
    } else {
      socket.off("new:report", callback);
    }
  } else if (socket) {
    socket.off("new:report", callback);
  }
};

// Hủy tất cả lắng nghe (dùng khi unmount)
export const offSocketEvents = () => {
  const s = getSocket();
  if (!s) return;
  s.off("stream-preview-ready");
  s.off("stream-status-live");
  s.off("stream-status-ended");
  s.off("stream-details-updated");
  s.off("new-message-liveroom");
  s.off("stream-privacy-updated");
  s.off("viewer-count-update");
  s.off("chat-error");
  s.off("chat-banned");
  s.off("chat-unbanned");
  s.off("post:comment:new");
  s.off("notification:new");
};

// ========== DM helpers ==========
export const dmJoin = (conversationId) => {
  console.log("[DM] emit dm:join", conversationId);
  getSocket()?.emit("dm:join", conversationId);
};

export const dmTyping = (conversationId, typing) => {
  console.log("[DM] emit dm:typing", { conversationId, typing });
  getSocket()?.emit("dm:typing", { conversationId, typing: !!typing });
};

export const dmSend = (conversationId, text) => {
  console.log("[DM] emit dm:send", { conversationId, text });
  getSocket()?.emit("dm:send", { conversationId, text });
};

export const dmSeen = (conversationId) => {
  console.log("[DM] emit dm:seen", { conversationId });
  getSocket()?.emit("dm:seen", { conversationId });
};

export const onDmNew = (callback) => {
  console.log("[DM] listen dm:new");
  getSocket()?.on("dm:new", callback);
};

export const onDmTyping = (callback) => {
  console.log("[DM] listen dm:typing");
  getSocket()?.on("dm:typing", callback);
};

export const onDmSeen = (callback) => {
  console.log("[DM] listen dm:seen");
  getSocket()?.on("dm:seen", callback);
};

export const onDmBadge = (callback) => {
  console.log("[DM] listen dm:badge");
  getSocket()?.on("dm:badge", callback);
};

export const onDmConversationUpdated = (callback) => {
  console.log("[DM] listen dm:conversation:updated");
  getSocket()?.on("dm:conversation:updated", callback);
};

// DM request status events (accepted / declined)
export const onDmRequestAccepted = (callback) => {
  console.log('[DM] listen dm:request:accepted');
  const socket = getSocket();
  if (socket) {
    const wrappedCallback = (payload) => {
      console.log('[DM] Received dm:request:accepted event:', payload);
      callback(payload);
    };
    socket.on('dm:request:accepted', wrappedCallback);
    // Store wrapped callback for cleanup
    if (!socket._dmRequestAcceptedCallbacks) {
      socket._dmRequestAcceptedCallbacks = [];
    }
    socket._dmRequestAcceptedCallbacks.push({ original: callback, wrapped: wrappedCallback });
  }
};
export const offDmRequestAccepted = (callback) => {
  console.log('[DM] off dm:request:accepted');
  const socket = getSocket();
  if (socket && socket._dmRequestAcceptedCallbacks) {
    const found = socket._dmRequestAcceptedCallbacks.find(cb => cb.original === callback);
    if (found) {
      socket.off('dm:request:accepted', found.wrapped);
      socket._dmRequestAcceptedCallbacks = socket._dmRequestAcceptedCallbacks.filter(cb => cb !== found);
    } else {
      socket.off('dm:request:accepted', callback);
    }
  } else if (socket) {
    socket.off('dm:request:accepted', callback);
  }
};

export const onDmRequestDeclined = (callback) => {
  console.log('[DM] listen dm:request:declined');
  const socket = getSocket();
  if (socket) {
    const wrappedCallback = (payload) => {
      console.log('[DM] Received dm:request:declined event:', payload);
      callback(payload);
    };
    socket.on('dm:request:declined', wrappedCallback);
    // Store wrapped callback for cleanup
    if (!socket._dmRequestDeclinedCallbacks) {
      socket._dmRequestDeclinedCallbacks = [];
    }
    socket._dmRequestDeclinedCallbacks.push({ original: callback, wrapped: wrappedCallback });
  }
};
export const offDmRequestDeclined = (callback) => {
  console.log('[DM] off dm:request:declined');
  const socket = getSocket();
  if (socket && socket._dmRequestDeclinedCallbacks) {
    const found = socket._dmRequestDeclinedCallbacks.find(cb => cb.original === callback);
    if (found) {
      socket.off('dm:request:declined', found.wrapped);
      socket._dmRequestDeclinedCallbacks = socket._dmRequestDeclinedCallbacks.filter(cb => cb !== found);
    } else {
      socket.off('dm:request:declined', callback);
    }
  } else if (socket) {
    socket.off('dm:request:declined', callback);
  }
};

export const offDmNew = (callback) => {
  console.log("[DM] off dm:new");
  getSocket()?.off("dm:new", callback);
};

export const offDmTyping = (callback) => {
  console.log("[DM] off dm:typing");
  getSocket()?.off("dm:typing", callback);
};

export const offDmSeen = (callback) => {
  console.log("[DM] off dm:seen");
  getSocket()?.off("dm:seen", callback);
};

export const offDmBadge = (callback) => {
  console.log("[DM] off dm:badge");
  getSocket()?.off("dm:badge", callback);
};

export const offDmConversationUpdated = (callback) => {
  console.log("[DM] off dm:conversation:updated");
  getSocket()?.off("dm:conversation:updated", callback);
};
