import React, { useState, useEffect, useRef } from 'react';
import NotificationToast from './NotificationToast';
import { onNotificationNew, offNotificationNew } from '../services/user/socketService';

const NotificationToastContainer = () => {
  const [notifications, setNotifications] = useState([]);
  const shownIdsRef = useRef(new Set());

  useEffect(() => {
    const pushToast = (notification) => {
      if (!notification) return;

      // Dedupe theo _id/createdAt để tránh trùng giữa socket và polling
      const key =
        notification._id ||
        notification.id ||
        `${notification.type || 'unknown'}-${notification.createdAt || Date.now()}`;

      if (shownIdsRef.current.has(key)) {
        return;
      }
      shownIdsRef.current.add(key);

      console.log('[NotificationToast] Show toast:', notification);
      const toastId = Date.now() + Math.random();
      setNotifications((prev) => [...prev, { ...notification, toastId }]);
    };

    // Socket channel
    const handleSocketNotification = (notification) => {
      pushToast(notification);
    };
    onNotificationNew(handleSocketNotification);

    // Fallback channel từ các component khác (ví dụ NotificationBell qua polling)
    const handleWindowToast = (event) => {
      pushToast(event.detail);
    };
    window.addEventListener('notification:toast', handleWindowToast);

    return () => {
      offNotificationNew(handleSocketNotification);
      window.removeEventListener('notification:toast', handleWindowToast);
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

