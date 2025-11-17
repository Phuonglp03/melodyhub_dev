import React, { useState, useEffect } from 'react';
import NotificationToast from './NotificationToast';
import { onNotificationNew, offNotificationNew } from '../services/user/socketService';

const NotificationToastContainer = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const handleNewNotification = (notification) => {
      console.log('[NotificationToast] Nhận thông báo mới:', notification);
      
      // Chỉ hiển thị toast cho các thông báo mới (không phải khi load từ API)
      // Thêm notification vào queue
      const id = Date.now() + Math.random();
      setNotifications(prev => [...prev, { ...notification, toastId: id }]);
    };

    onNotificationNew(handleNewNotification);

    return () => {
      offNotificationNew(handleNewNotification);
    };
  }, []);

  const handleClose = (toastId) => {
    setNotifications(prev => prev.filter(n => n.toastId !== toastId));
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 80,
        right: 20,
        zIndex: 10000,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: '450px',
      }}
    >
      {notifications.map((notification) => (
        <div
          key={notification.toastId}
          style={{
            pointerEvents: 'auto',
          }}
        >
          <NotificationToast
            notification={notification}
            onClose={() => handleClose(notification.toastId)}
            duration={10000}
          />
        </div>
      ))}
    </div>
  );
};

export default NotificationToastContainer;

