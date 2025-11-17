import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Popover, Empty, Spin, Button, Typography, Avatar, Space, Divider } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, getUnreadNotificationCount } from '../services/user/notificationService';
import { onNotificationNew, offNotificationNew } from '../services/user/socketService';
import './NotificationBell.css';

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

  // Lấy số lượng thông báo chưa đọc
  const fetchUnreadCount = useCallback(async () => {
    try {
      const result = await getUnreadNotificationCount();
      setUnreadCount(result.data?.unreadCount || 0);
    } catch (error) {
      console.error('Lỗi khi lấy số lượng thông báo chưa đọc:', error);
    }
  }, []);

  // Lấy danh sách thông báo
  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    try {
      setLoading(true);
      const result = await getNotifications({ page: pageNum, limit: 10 });
      const newNotifications = result.data?.notifications || [];
      
      if (append) {
        setNotifications(prev => [...prev, ...newNotifications]);
      } else {
        setNotifications(newNotifications);
      }
      
      setHasMore(result.data?.pagination?.hasNextPage || false);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách thông báo:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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
      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Lỗi khi đánh dấu thông báo:', error);
    }
  };

  // Đánh dấu tất cả là đã đọc
  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Lỗi khi đánh dấu tất cả thông báo:', error);
    }
  };

  // Xử lý click vào thông báo
  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification._id, { stopPropagation: () => {} });
    }
    
    // Nếu là thông báo về bài đăng, navigate đến NewsFeed và mở modal
    if (notification.type === 'like_post' || notification.type === 'comment_post') {
      if (notification.linkUrl) {
        // Extract postId from linkUrl (format: /posts/{postId})
        const match = notification.linkUrl.match(/\/posts\/([^\/]+)/);
        if (match && match[1]) {
          const postId = match[1];
          setVisible(false);
          
          // Nếu đang ở trang NewsFeed, chỉ cần trigger event để mở modal
          if (location.pathname === '/') {
            // Dispatch custom event để NewsFeed component lắng nghe
            window.dispatchEvent(new CustomEvent('openPostCommentModal', { detail: { postId } }));
          } else {
            // Navigate đến NewsFeed với postId trong state
            navigate('/', { state: { openCommentModal: true, postId } });
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
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
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
      default:
        return '🔔';
    }
  };

  // Lắng nghe thông báo mới từ socket
  useEffect(() => {
    const handleNewNotification = (notification) => {
      console.log('[Notification] Nhận thông báo mới:', notification);
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    };

    onNotificationNew(handleNewNotification);

    return () => {
      offNotificationNew(handleNewNotification);
    };
  }, []);

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
    // Refresh unread count mỗi 30 giây
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const content = (
    <div className="notification-popover">
      {/* Header */}
      <div className="notification-header">
        <Text strong style={{ color: '#fff', fontSize: 16 }}>Thông báo</Text>
        {unreadCount > 0 && (
          <Button
            type="text"
            size="small"
            icon={<CheckOutlined />}
            onClick={handleMarkAllAsRead}
            style={{ color: '#3b82f6' }}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        )}
      </div>

      <Divider style={{ margin: '8px 0', borderColor: '#2a2a2a' }} />

      {/* Notifications List */}
      <div className="notification-list">
        {loading && notifications.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : notifications.length === 0 ? (
          <Empty
            description="Chưa có thông báo"
            style={{ color: '#9ca3af', padding: '40px' }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <>
            {notifications.map((notification) => (
              <div
                key={notification._id}
                className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
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
                          <Text style={{ color: '#fff', fontSize: 14 }}>
                            {notification.message}
                          </Text>
                        </Space>
                      ) : (
                        <Text style={{ color: '#fff', fontSize: 14 }}>
                          {notification.message}
                        </Text>
                      )}
                    </div>
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                      {formatTime(notification.createdAt)}
                    </Text>
                  </div>
                </div>
                {!notification.isRead && (
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={(e) => handleMarkAsRead(notification._id, e)}
                    className="notification-mark-read"
                  />
                )}
              </div>
            ))}
            {hasMore && (
              <div style={{ textAlign: 'center', padding: '12px' }}>
                <Button
                  type="text"
                  onClick={loadMore}
                  loading={loading}
                  style={{ color: '#3b82f6' }}
                >
                  Xem thêm
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <Divider style={{ margin: '8px 0', borderColor: '#2a2a2a' }} />
      <div style={{ textAlign: 'center', padding: '8px' }}>
        <Button
          type="text"
          onClick={() => {
            setVisible(false);
            navigate('/notifications');
          }}
          style={{ color: '#3b82f6' }}
        >
          Xem tất cả thông báo
        </Button>
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
      overlayInnerStyle={{ padding: 0, background: '#1a1a1a' }}
      zIndex={1000}
    >
      <Badge count={unreadCount} offset={[-5, 5]}>
        <BellOutlined className="app-header__icon" />
      </Badge>
    </Popover>
  );
};

export default NotificationBell;

