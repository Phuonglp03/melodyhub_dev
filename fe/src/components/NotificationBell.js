import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Badge,
  Popover,
  Empty,
  Spin,
  Button,
  Typography,
  Avatar,
  Space,
  Divider,
} from "antd";
import { BellOutlined, CheckOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  acceptProjectInvitation,
  declineProjectInvitation,
} from "../services/user/notificationService";
import {
  onNotificationNew,
  offNotificationNew,
} from "../services/user/socketService";
import "./NotificationBell.css";

const { Text } = Typography;

const NotificationBell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const hasInitializedUnread = useRef(false);

  // Gửi notification cho toast container (qua window event)
  const showToast = useCallback((notification) => {
    try {
      if (!notification) return;
      window.dispatchEvent(
        new CustomEvent("notification:toast", {
          detail: notification,
        })
      );
    } catch (e) {
    }
  }, []);

  // Lấy số lượng thông báo chưa đọc (chủ yếu để cập nhật badge; nếu socket lỗi sẽ dùng để bắn toast fallback)
  const fetchUnreadCount = useCallback(async () => {
    try {
      const result = await getUnreadNotificationCount();
      const serverUnread =
        result?.data?.unreadCount || result?.unreadCount || 0;

      // Lần đầu chỉ đồng bộ badge, không hiển thị toast cho thông báo cũ
      if (!hasInitializedUnread.current) {
        hasInitializedUnread.current = true;
        setUnreadCount(serverUnread);
        return;
      }

      setUnreadCount((prev) => {
        if (serverUnread > prev) {
          // Fallback: lấy thông báo mới nhất và bắn toast nếu socket chưa cập nhật
          getNotifications({ page: 1, limit: 1 })
            .then((res) => {
              const newest =
                res?.data?.notifications?.[0] || res?.notifications?.[0];
              if (newest) {
                showToast(newest);
              }
            })
            .catch((err) => {
            });
        }
        return serverUnread;
      });
    } catch (error) {
      console.error("Lỗi khi lấy số lượng thông báo chưa đọc:", error);
      setUnreadCount(0);
    }
  }, [showToast]);

  // Lấy danh sách thông báo
  const fetchNotifications = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        setLoading(true);
        const result = await getNotifications({ page: pageNum, limit: 10 });
        // Handle different response structures
        const newNotifications =
          result?.data?.notifications || result?.notifications || [];

        if (append) {
          setNotifications((prev) => [...prev, ...newNotifications]);
        } else {
          setNotifications(newNotifications);
        }

        setHasMore(
          result?.data?.pagination?.hasNextPage ||
            result?.pagination?.hasNextPage ||
            false
        );
      } catch (error) {
        console.error("Lỗi khi lấy danh sách thông báo:", error);
        // Reset to empty array on error to prevent infinite loading
        if (!append) {
          setNotifications([]);
        }
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Load more notifications
  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNotifications(nextPage, true);
    }
  };

  // Đánh dấu thông báo là đã đọc
  const handleMarkAsRead = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Lỗi khi đánh dấu thông báo:", error);
    }
  };

  // Đánh dấu tất cả là đã đọc
  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Lỗi khi đánh dấu tất cả thông báo:", error);
    }
  };

  // Handle accept invitation
  const handleAcceptInvitation = async (notification, e) => {
    e.stopPropagation();
    try {
      const projectId = extractProjectId(notification.linkUrl);
      if (!projectId) {
        console.error("Could not extract projectId from notification");
        return;
      }

      await acceptProjectInvitation(projectId);

      // Mark notification as read but keep it in the list
      await markNotificationAsRead(notification._id);

      // Update notification state - mark as read but keep in list
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notification._id ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Show success message and navigate to project
      navigate(`/projects/${projectId}`);
      setVisible(false);
    } catch (error) {
      console.error("Error accepting invitation:", error);
      alert(error?.response?.data?.message || "Failed to accept invitation");
    }
  };

  // Handle decline invitation
  const handleDeclineInvitation = async (notification, e) => {
    e.stopPropagation();
    try {
      const projectId = extractProjectId(notification.linkUrl);
      if (!projectId) {
        console.error("Could not extract projectId from notification");
        return;
      }

      await declineProjectInvitation(projectId);

      // Mark notification as read but keep it in the list
      await markNotificationAsRead(notification._id);

      // Update notification state - mark as read but keep in list
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notification._id ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error declining invitation:", error);
      alert(error?.response?.data?.message || "Failed to decline invitation");
    }
  };

  // Extract projectId from linkUrl
  const extractProjectId = (linkUrl) => {
    if (!linkUrl) return null;
    const match = linkUrl.match(/\/projects\/([^/]+)/);
    return match ? match[1] : null;
  };

  // Xử lý click vào thông báo
  const handleNotificationClick = (notification) => {
    // Don't navigate for project_invite - user should use accept/decline buttons
    if (notification.type === "project_invite") {
      return;
    }

    if (!notification.isRead) {
      handleMarkAsRead(notification._id, { stopPropagation: () => {} });
    }

    // Nếu là thông báo về bài đăng, navigate đến NewsFeed và mở modal
    if (
      notification.type === "like_post" ||
      notification.type === "comment_post"
    ) {
      if (notification.linkUrl) {
        // Extract postId from linkUrl (format: /posts/{postId})
        const match = notification.linkUrl.match(/\/posts\/([^/]+)/);
        if (match && match[1]) {
          const postId = match[1];
          setVisible(false);

          // Nếu đang ở trang NewsFeed, chỉ cần trigger event để mở modal
          if (location.pathname === "/") {
            // Dispatch custom event để NewsFeed component lắng nghe
            window.dispatchEvent(
              new CustomEvent("openPostCommentModal", { detail: { postId } })
            );
          } else {
            // Navigate đến NewsFeed với postId trong state
            navigate("/", { state: { openCommentModal: true, postId } });
          }
          return;
        }
      }
    }

    // Các loại thông báo khác (follow) thì navigate
    if (notification.linkUrl) {
      navigate(notification.linkUrl);
      setVisible(false);
    }
  };

  // Format thời gian
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Vừa xong";
    if (minutes < 60) return `${minutes} phút trước`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;

    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Lấy icon theo loại thông báo
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like_post':
        return '❤️';
      case 'comment_post':
        return '💬';
      case 'follow':
        return '👤';
      case 'lick_pending_review':
        return '🎸';
      case 'lick_approved':
        return '✅';
      case 'lick_rejected':
        return '❌';
      case 'post_reported':
        return '🚩';
      case "project_invite":
        return "🎵";
      default:
        return "🔔";
    }
  };

  // Lắng nghe thông báo mới từ socket
  useEffect(() => {
    const handleNewNotification = (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
      // Hiển thị toast ngay khi có notification qua socket
      showToast(notification);
    };

    onNotificationNew(handleNewNotification);

    return () => {
      offNotificationNew(handleNewNotification);
    };
  }, [showToast]);

  // Load dữ liệu khi mở popover
  useEffect(() => {
    if (visible) {
      fetchNotifications(1, false);
      setPage(1);
    }
  }, [visible, fetchNotifications]);

  // Load unread count khi component mount
  useEffect(() => {
    fetchUnreadCount();
    // Refresh unread count định kỳ (backup nếu socket lỗi)
    const interval = setInterval(fetchUnreadCount, 3000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const content = (
    <div className="notification-popover">
      {/* Header */}
      <div className="notification-header">
        <Text strong style={{ color: "#fff", fontSize: 16 }}>
          Thông báo
        </Text>
        {unreadCount > 0 && (
          <Button
            type="text"
            size="small"
            icon={<CheckOutlined />}
            onClick={handleMarkAllAsRead}
            style={{ color: "#3b82f6" }}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        )}
      </div>

      <Divider style={{ margin: "8px 0", borderColor: "#2a2a2a" }} />

      {/* Notifications List */}
      <div className="notification-list">
        {loading && notifications.length === 0 ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "40px",
            }}
          >
            <Spin size="large" />
          </div>
        ) : notifications.length === 0 ? (
          <Empty
            description="Chưa có thông báo"
            style={{ color: "#9ca3af", padding: "40px" }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <>
            {notifications.map((notification) => (
              <div
                key={notification._id}
                className={`notification-item ${
                  !notification.isRead ? "unread" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-content">
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-body">
                    <div className="notification-message">
                      {notification.actorId ? (
                        <Space>
                          <Avatar
                            src={notification.actorId.avatarUrl}
                            size={24}
                            style={{ flexShrink: 0 }}
                          />
                          <Text style={{ color: "#fff", fontSize: 14 }}>
                            {notification.message}
                          </Text>
                        </Space>
                      ) : (
                        <Text style={{ color: "#fff", fontSize: 14 }}>
                          {notification.message}
                        </Text>
                      )}
                    </div>
                    <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                      {formatTime(notification.createdAt)}
                    </Text>
                  </div>
                </div>
                {notification.type === "project_invite" ? (
                  // Only show buttons if notification is not read (invitation not yet responded)
                  !notification.isRead ? (
                    <div
                      className="notification-actions"
                      style={{ display: "flex", gap: "8px" }}
                    >
                      <Button
                        type="primary"
                        size="small"
                        onClick={(e) => handleAcceptInvitation(notification, e)}
                        style={{
                          background: "#10b981",
                          borderColor: "#10b981",
                          fontSize: "12px",
                          height: "28px",
                          padding: "0 12px",
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        type="default"
                        size="small"
                        onClick={(e) =>
                          handleDeclineInvitation(notification, e)
                        }
                        style={{
                          background: "#374151",
                          borderColor: "#4b5563",
                          color: "#fff",
                          fontSize: "12px",
                          height: "28px",
                          padding: "0 12px",
                        }}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : (
                    // Show status badge if already responded
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        background: "#10b981",
                        color: "#fff",
                      }}
                    >
                      Responded
                    </span>
                  )
                ) : (
                  !notification.isRead && (
                    <Button
                      type="text"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={(e) => handleMarkAsRead(notification._id, e)}
                      className="notification-mark-read"
                    />
                  )
                )}
              </div>
            ))}
            {hasMore && (
              <div style={{ textAlign: "center", padding: "12px" }}>
                <Button
                  type="text"
                  onClick={loadMore}
                  loading={loading}
                  style={{ color: "#3b82f6" }}
                >
                  Xem thêm
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <Divider style={{ margin: "8px 0", borderColor: "#2a2a2a" }} />
      <div style={{ textAlign: "center", padding: "8px" }}>
        {/* <Button
          type="text"
          onClick={() => {
            setVisible(false);
            navigate("/notifications");
          }}
          style={{ color: "#3b82f6" }}
        >
          Xem tất cả thông báo
        </Button> */}
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      title={null}
      trigger="click"
      open={visible}
      onOpenChange={setVisible}
      placement="bottomRight"
      overlayStyle={{ paddingTop: 0 }}
      styles={{
        body: { padding: 0, background: "#1a1a1a" },
      }}
      zIndex={1000}
    >
      <Badge count={unreadCount} offset={[-5, 5]}>
        <BellOutlined className="app-header__icon" />
      </Badge>
    </Popover>
  );
};

export default NotificationBell;
