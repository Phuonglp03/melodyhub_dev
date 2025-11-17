import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Avatar, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import './NotificationToast.css';

const { Text } = Typography;

const NotificationToast = ({ notification, onClose, duration = 10000 }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 300); // Đợi animation fade out
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = (e) => {
    if (e) e.stopPropagation();
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
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
    
    return date.toLocaleDateString('vi-VN');
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

  const handleClick = () => {
    // Khi click vào toast, trigger event để mở modal (giống như trong NotificationBell)
    if (notification.type === 'like_post' || notification.type === 'comment_post') {
      if (notification.linkUrl) {
        const match = notification.linkUrl.match(/\/posts\/([^\/]+)/);
        if (match && match[1]) {
          const postId = match[1];
          handleClose();
          // Nếu đang ở trang NewsFeed, chỉ cần trigger event
          if (location.pathname === '/') {
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
      handleClose();
      navigate(notification.linkUrl);
    }
  };

  return (
    <div className={`notification-toast ${isClosing ? 'closing' : ''}`} onClick={handleClick}>
      <div className="notification-toast-content">
        <div className="notification-toast-avatar-wrapper">
          {notification.actorId?.avatarUrl ? (
            <Avatar
              src={notification.actorId.avatarUrl}
              size={48}
              style={{ background: '#555' }}
            />
          ) : (
            <Avatar size={48} style={{ background: '#555' }}>
              {notification.actorId?.displayName?.[0] || notification.actorId?.username?.[0] || 'U'}
            </Avatar>
          )}
          <div className="notification-toast-icon-badge">
            {getNotificationIcon(notification.type)}
          </div>
        </div>
        
        <div className="notification-toast-body">
          <Text className="notification-toast-title">Thông báo mới</Text>
          <Text className="notification-toast-message">
            {notification.message || 'Bạn có thông báo mới'}
          </Text>
          <Text className="notification-toast-time">
            {formatTime(notification.createdAt)}
          </Text>
        </div>

        <button
          className="notification-toast-close"
          onClick={handleClose}
          aria-label="Đóng"
        >
          <CloseOutlined />
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;

