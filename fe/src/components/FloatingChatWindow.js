import React, { useState, useEffect, useRef } from 'react';
import { Avatar, Input, Button, Badge, Spin, message } from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  VideoCameraOutlined,
  MinusOutlined,
  CloseOutlined,
  SmileOutlined,
  LikeOutlined,
  CheckOutlined
} from '@ant-design/icons';
import useDMConversationMessages from '../hooks/useDMConversationMessages';
import { acceptConversation, declineConversation } from '../services/dmService';
import { getProfileById } from '../services/user/profile';
import './FloatingChatWindow.css';

const { TextArea } = Input;

const FloatingChatWindow = ({ conversation, currentUserId, onClose, onMinimize, isMinimized, onMaximize, position, onConversationUpdate }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const windowRef = useRef(null);
  const [peerInfo, setPeerInfo] = useState(null);

  // Get peer info
  const getPeer = (conv) => {
    if (!conv?.participants || !currentUserId) return null;
    const peer = conv.participants.find((p) => {
      const pid = typeof p === 'object' ? (p._id || p.id) : p;
      const cid = typeof currentUserId === 'object' ? (currentUserId._id || currentUserId.id) : currentUserId;
      return String(pid) !== String(cid);
    });
    return peer;
  };

  const peer = getPeer(conversation);
  
  // Fetch peer info if missing avatar
  useEffect(() => {
    const fetchPeerInfo = async () => {
      if (!peer || !conversation) return;
      
      const peerId = typeof peer === 'object' ? (peer._id || peer.id) : peer;
      if (!peerId) return;
      
      // If already has avatarUrl, use it
      if (typeof peer === 'object' && peer.avatarUrl) {
        setPeerInfo({
          displayName: peer.displayName,
          username: peer.username,
          avatarUrl: peer.avatarUrl,
        });
        return;
      }
      
      // Fetch from API
      try {
        const profile = await getProfileById(peerId);
        const user = profile?.data?.user || profile?.user || profile?.data;
        if (user) {
          setPeerInfo({
            displayName: user.displayName,
            username: user.username,
            avatarUrl: user.avatarUrl,
          });
        }
      } catch (e) {
        console.error('Error fetching peer info:', e);
      }
    };
    
    fetchPeerInfo();
  }, [peer, conversation]);

  const peerName = peerInfo?.displayName || peer?.displayName || peerInfo?.username || peer?.username || 'Người dùng';
  const peerAvatar = peerInfo?.avatarUrl || peer?.avatarUrl;

  // Check if current user is requester
  const isRequester = conversation?.requestedBy && String(conversation.requestedBy) === String(currentUserId);

  // Messages hook
  const {
    messages,
    loading: messagesLoading,
    send,
    typing,
    peerTyping
  } = useDMConversationMessages(conversation?._id);

  // Auto scroll to bottom
  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

  // Format time
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Format last activity time
  const formatLastActivity = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `Hoạt động ${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hoạt động ${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `Hoạt động ${days} ngày trước`;
  };

  // Handle send message
  const handleSend = () => {
    if (!inputText.trim() || !conversation?._id) return;
    const canSend = conversation?.status === 'active' || (conversation?.status === 'pending' && String(conversation.requestedBy) === String(currentUserId));
    if (!canSend) return;
    send(inputText);
    setInputText('');
    typing.stop();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Handle typing
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    const canType = conversation?._id && (conversation?.status === 'active' || (conversation?.status === 'pending' && String(conversation.requestedBy) === String(currentUserId)));
    if (canType) {
      typing.start();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        typing.stop();
      }, 2000);
    }
  };

  // Get unread count for bubble
  const getUnreadCount = () => {
    if (!conversation?.unreadCounts || !currentUserId) return 0;
    const uid = String(currentUserId);
    return Number(conversation.unreadCounts.get?.(uid) || conversation.unreadCounts[uid] || 0);
  };

  const unreadCount = getUnreadCount();

  // Group messages by time (simplified - just show messages with time dividers)
  const groupMessages = (msgs) => {
    if (!msgs || msgs.length === 0) return [];
    return msgs;
  };

  const groupedMessages = groupMessages(messages);

  // If minimized, show circular avatar with online status indicator and close button
  if (isMinimized) {
    const bubbleStyle = position ? {
      bottom: `${position.bottom}px`,
      right: `${position.right}px`
    } : {
      bottom: '20px',
      right: '20px'
    };

    // Check if user is online (active within last 5 minutes)
    const isOnline = () => {
      if (!conversation?.lastMessageAt) return false;
      const lastActivity = new Date(conversation.lastMessageAt);
      const now = new Date();
      const diffMinutes = (now - lastActivity) / (1000 * 60);
      return diffMinutes <= 5; // Consider online if active within 5 minutes
    };

    const online = isOnline();

    return (
      <div
        className="floating-chat-avatar-bubble"
        style={bubbleStyle}
      >
        <div
          className="floating-chat-avatar-wrapper"
          onClick={onMaximize}
        >
          <Avatar
            src={peerAvatar}
            icon={<UserOutlined />}
            size={56}
            className="floating-chat-minimized-avatar"
          />
          {online && (
            <div className="floating-chat-online-indicator" />
          )}
        </div>
        <button
          className="floating-chat-close-button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Đóng"
        >
          ×
        </button>
      </div>
    );
  }

  // Full window
  const windowStyle = position ? {
    bottom: position.bottom ? `${position.bottom}px` : undefined,
    top: position.top ? `${position.top}px` : undefined,
    right: `${position.right}px`
  } : {
    bottom: '20px',
    right: '20px'
  };

  return (
    <div className="floating-chat-window" ref={windowRef} style={windowStyle}>
      {/* Header */}
      <div className="floating-chat-header">
        <div className="floating-chat-header-left">
          <Avatar
            src={peerAvatar}
            icon={<UserOutlined />}
            size={40}
          />
          <div className="floating-chat-header-info">
            <div className="floating-chat-header-name">{peerName}</div>
            <div className="floating-chat-header-status">
              {peerTyping ? 'Đang gõ...' : formatLastActivity(conversation?.lastMessageAt)}
            </div>
          </div>
        </div>
        <div className="floating-chat-header-right">
          <Button
            type="text"
            icon={<PhoneOutlined />}
            className="floating-chat-header-icon"
          />
          <Button
            type="text"
            icon={<VideoCameraOutlined />}
            className="floating-chat-header-icon"
          />
          <Button
            type="text"
            icon={<MinusOutlined />}
            onClick={onMinimize}
            className="floating-chat-header-icon"
          />
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={onClose}
            className="floating-chat-header-icon"
          />
        </div>
      </div>

      {/* Pending banner for receiver */}
      {(conversation?.status === 'pending' && !isRequester) && (
        <div className="floating-chat-pending-banner">
          <div className="floating-chat-pending-banner-content">
            <div className="floating-chat-pending-banner-text">
              <div className="floating-chat-pending-banner-title">Yêu cầu tin nhắn</div>
              <div className="floating-chat-pending-banner-subtitle">Bạn có muốn chấp nhận yêu cầu này không?</div>
            </div>
            <div className="floating-chat-pending-banner-actions">
              {/* <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={async () => {
                  try {
                    await acceptConversation(conversation._id);
                    message.success('Đã chấp nhận');
                    if (onConversationUpdate) {
                      onConversationUpdate();
                    }
                  } catch (e) {
                    message.error(e.message || 'Lỗi');
                  }
                }}
                className="floating-chat-accept-button"
              >
                Chấp nhận
              </Button> */}
              <Button                 
                icon={<CheckOutlined />}
                onClick={async () => {
                  try {
                    await acceptConversation(conversation._id);
                    message.success('Đã chấp nhận');
                    if (onConversationUpdate) {
                      onConversationUpdate();
                    }
                  } catch (e) {
                    message.error(e.message || 'Lỗi');
                  }
                }}
                className="floating-chat-accept-button"
              >
                Chấp nhận 
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={async () => {
                  try {
                    await declineConversation(conversation._id);
                    message.success('Đã từ chối');
                    if (onClose) {
                      onClose();
                    }
                  } catch (e) {
                    message.error(e.message || 'Lỗi');
                  }
                }}
                className="floating-chat-decline-button"
              >
                Từ chối
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="floating-chat-messages">
        {messagesLoading && messages.length === 0 ? (
          <div className="floating-chat-loading">
            <Spin size="large" />
          </div>
        ) : groupedMessages.length === 0 ? (
          <div className="floating-chat-empty">
            <p>Chưa có tin nhắn</p>
          </div>
        ) : (
          groupedMessages.map((msg, index) => {
            const isMe = String(msg.senderId?._id || msg.senderId) === String(currentUserId);
            const msgTime = formatTime(msg.createdAt);
            const prevMsg = index > 0 ? groupedMessages[index - 1] : null;
            const showTime = !prevMsg ||
              Math.abs(new Date(msg.createdAt) - new Date(prevMsg.createdAt)) > 300000; // 5 minutes
            const isLastInGroup = index === groupedMessages.length - 1 ||
              (groupedMessages[index + 1] && String(groupedMessages[index + 1].senderId?._id || groupedMessages[index + 1].senderId) !== String(msg.senderId?._id || msg.senderId));

            return (
              <React.Fragment key={msg._id}>
                {showTime && index > 0 && (
                  <div className="floating-chat-time-divider">
                    <span>{msgTime}</span>
                  </div>
                )}
                <div
                  className={`floating-chat-message ${isMe ? 'sent' : 'received'}`}
                >
                  {!isMe && (
                    <Avatar
                      src={msg.senderId?.avatarUrl}
                      icon={<UserOutlined />}
                      size={32}
                      className="floating-chat-message-avatar"
                    />
                  )}
                  <div className="floating-chat-message-content">
                    <div className="floating-chat-message-bubble">
                      {msg.textPreview || msg.text || ''}
                    </div>
                    {isLastInGroup && (
                      <div className="floating-chat-message-time">{msgTime}</div>
                    )}
                  </div>
                  {isMe && isLastInGroup && (
                    <Avatar
                      src={msg.senderId?.avatarUrl}
                      icon={<UserOutlined />}
                      size={16}
                      className="floating-chat-message-read-avatar"
                    />
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="floating-chat-input-area">
        <TextArea
          value={inputText}
          onChange={handleInputChange}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Aa"
          autoSize={{ minRows: 1, maxRows: 4 }}
          rows={1}
          className="floating-chat-input"
          disabled={conversation?.status === 'pending' && String(conversation.requestedBy) !== String(currentUserId)}
        />
        <div className="floating-chat-input-right">
          <Button
            type="text"
            icon={<SmileOutlined />}
            className="floating-chat-input-icon"
            title="Emoji"
            style={{ fontSize: 20 }}
          />
          <Button
            type="text"
            icon={<LikeOutlined />}
            className="floating-chat-input-icon"
            onClick={() => {
              send('👍');
            }}
            title="Like"
            style={{ fontSize: 20 }}
          />
        </div>
      </div>
    </div>
  );
};

export default FloatingChatWindow;

