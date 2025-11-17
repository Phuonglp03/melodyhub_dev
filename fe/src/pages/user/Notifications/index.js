import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Typography, Empty, Spin, Button, Space, Avatar, Divider, Tabs, Badge } from 'antd';
import { CheckOutlined, DeleteOutlined, BellOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from '../../../services/user/notificationService';
import { onNotificationNew, offNotificationNew } from '../../../services/user/socketService';
import userLayout from '../../../layouts/userLayout';
import './Notifications.css';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Lấy danh sách thông báo
  const fetchNotifications = useCallback(async (pageNum = 1, append = false, isRead = null) => {
    try {
      setLoading(true);
      const params = { page: pageNum, limit: 20 };
      if (isRead !== null) {
        params.isRead = isRead;
      }
      
      const result = await getNotifications(params);
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

  // Load more
  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      const isRead = activeTab === 'unread' ? false : activeTab === 'read' ? true : null;
      fetchNotifications(nextPage, true, isRead);
    }
  };

  // Đánh dấu thông báo là đã đọc
  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Lỗi khi đánh dấu thông báo:', error);
    }
  };

  // Đánh dấu tất cả là đã đọc
  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Lỗi khi đánh dấu tất cả thông báo:', error);
    }
  };

  // Xóa thông báo
  const handleDelete = async (notificationId) => {
    try {
      await deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
    } catch (error) {
      console.error('Lỗi khi xóa thông báo:', error);
    }
  };

  // Xử lý click vào thông báo
  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification._id);
    }
    
    if (notification.linkUrl) {
      navigate(notification.linkUrl);
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
    };

    onNotificationNew(handleNewNotification);

    return () => {
      offNotificationNew(handleNewNotification);
    };
  }, []);

  // Load dữ liệu khi tab thay đổi
  useEffect(() => {
    setPage(1);
    const isRead = activeTab === 'unread' ? false : activeTab === 'read' ? true : null;
    fetchNotifications(1, false, isRead);
  }, [activeTab, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const readCount = notifications.filter(n => n.isRead).length;

  return (
    <Content className="notifications-page">
      <div className="notifications-container">
        <div className="notifications-header">
          <Space align="center">
            <BellOutlined style={{ fontSize: 24, color: '#3b82f6' }} />
            <Title level={2} style={{ margin: 0, color: '#fff' }}>
              Thông báo
            </Title>
          </Space>
          {unreadCount > 0 && (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleMarkAllAsRead}
            >
              Đánh dấu tất cả đã đọc
            </Button>
          )}
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="notifications-tabs"
        >
          <TabPane
            tab={
              <span>
                Tất cả
                {notifications.length > 0 && (
                  <Badge count={notifications.length} style={{ marginLeft: 8 }} />
                )}
              </span>
            }
            key="all"
          />
          <TabPane
            tab={
              <span>
                Chưa đọc
                {unreadCount > 0 && (
                  <Badge count={unreadCount} style={{ marginLeft: 8 }} />
                )}
              </span>
            }
            key="unread"
          />
          <TabPane
            tab={
              <span>
                Đã đọc
                {readCount > 0 && (
                  <Badge count={readCount} style={{ marginLeft: 8 }} />
                )}
              </span>
            }
            key="read"
          />
        </Tabs>

        <div className="notifications-content">
          {loading && notifications.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <Spin size="large" />
            </div>
          ) : notifications.length === 0 ? (
            <Empty
              description={
                activeTab === 'unread'
                  ? 'Không có thông báo chưa đọc'
                  : activeTab === 'read'
                  ? 'Không có thông báo đã đọc'
                  : 'Chưa có thông báo'
              }
              style={{ color: '#9ca3af', padding: '60px' }}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <>
              <div className="notifications-list">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`notification-card ${!notification.isRead ? 'unread' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="notification-card-content">
                      <div className="notification-icon-large">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="notification-card-body">
                        <div className="notification-card-header">
                          {notification.actorId && (
                            <Space>
                              <Avatar
                                src={notification.actorId.avatarUrl}
                                size={40}
                              />
                              <div>
                                <Text strong style={{ color: '#fff', fontSize: 15 }}>
                                  {notification.actorId.displayName || notification.actorId.username}
                                </Text>
                              </div>
                            </Space>
                          )}
                          <Text style={{ color: '#9ca3af', fontSize: 13 }}>
                            {formatTime(notification.createdAt)}
                          </Text>
                        </div>
                        <Text style={{ color: '#e5e7eb', fontSize: 14, display: 'block', marginTop: 8 }}>
                          {notification.message}
                        </Text>
                      </div>
                    </div>
                    <div className="notification-card-actions">
                      {!notification.isRead && (
                        <Button
                          type="text"
                          icon={<CheckOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification._id);
                          }}
                          title="Đánh dấu đã đọc"
                        />
                      )}
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(notification._id);
                        }}
                        title="Xóa"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Button
                    type="primary"
                    onClick={loadMore}
                    loading={loading}
                  >
                    Xem thêm
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Content>
  );
};

export default userLayout(NotificationsPage);



