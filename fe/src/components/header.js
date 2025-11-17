import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout, Input, Button, Space, Typography, Modal, Avatar,
  Popover, Badge, Spin, Empty, Dropdown
} from 'antd';
import {
  FireOutlined, BellOutlined, MessageOutlined, SearchOutlined,
  UserOutlined, EditOutlined, MoreOutlined, ExpandOutlined,
  LogoutOutlined, FolderOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../redux/authSlice';
import { livestreamService } from '../services/user/livestreamService';
import useDMConversations from '../hooks/useDMConversations';
import FloatingChatWindow from './FloatingChatWindow';
import NotificationBell from './NotificationBell'; 
import './header.css';

const { Header } = Layout;
const { Text } = Typography;

const AppHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const isChatPage = location.pathname === '/chat';

  // Dùng Redux – quan trọng nhất (không dùng localStorage như header1.js)
  const { user } = useSelector((state) => state.auth);
  const currentUserId = user?.user?.id || user?.id;
  const userInfo = user?.user || user;

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [chatPopoverVisible, setChatPopoverVisible] = useState(false);
  const [chatFilter, setChatFilter] = useState('all'); // 'all', 'unread', 'groups'
  const [chatSearchText, setChatSearchText] = useState('');
  const [activeChatWindows, setActiveChatWindows] = useState([]); // { id, conversation, isMinimized, position }

  const { conversations, loading, refresh } = useDMConversations();

  // Cập nhật conversation trong cửa sổ chat khi có tin mới
  useEffect(() => {
    setActiveChatWindows((prev) =>
      prev.map((window) => {
        const updated = conversations.find((c) => c._id === window.conversation._id);
        return updated ? { ...window, conversation: updated } : window;
      })
    );
  }, [conversations]);

  // Cho phép mở chat từ component khác (rất tiện)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.conversation) openChatWindow(e.detail.conversation);
    };
    window.addEventListener('openChatWindow', handler);
    return () => window.removeEventListener('openChatWindow', handler);
  }, []);

  // Tính toán vị trí cửa sổ chat
  const getNewWindowPosition = (isMinimized = false, windowsArray = null, targetIndex = null) => {
    const windowWidth = 340;
    const avatarSize = 56;
    const avatarSpacing = 12;
    const spacing = 10;
    const rightOffset = 20;
    const bottomOffset = 20;

    const windows = windowsArray || activeChatWindows;

    if (isMinimized) {
      const minimized = windows.filter((w) => w.isMinimized);
      const index = targetIndex !== null ? targetIndex : minimized.length;
      return { right: rightOffset, bottom: bottomOffset + index * (avatarSize + avatarSpacing) };
    } else {
      const open = windows.filter((w) => !w.isMinimized);
      const index = targetIndex !== null ? targetIndex : open.length;
      return { right: rightOffset + index * (windowWidth + spacing), bottom: 20 };
    }
  };

  const openChatWindow = (conversation) => {
    const existing = activeChatWindows.find((w) => w.conversation._id === conversation._id);
    if (existing) {
      if (existing.isMinimized) {
        setActiveChatWindows((prev) =>
          prev.map((w) => (w.id === existing.id ? { ...w, isMinimized: false } : w))
        );
      }
      return;
    }

    const position = getNewWindowPosition();
    const newWindow = {
      id: `chat-${conversation._id}-${Date.now()}`,
      conversation,
      isMinimized: false,
      position,
    };
    setActiveChatWindows((prev) => [...prev, newWindow]);
  };

  const closeChatWindow = (windowId) => {
    setActiveChatWindows((prev) => {
      const remaining = prev.filter((w) => w.id !== windowId);
      return recalculatePositions(remaining);
    });
  };

  const minimizeChatWindow = (windowId) => {
    setActiveChatWindows((prev) => {
      const updated = prev.map((w) => (w.id === windowId ? { ...w, isMinimized: true } : w));
      return recalculatePositions(updated);
    });
  };

  const maximizeChatWindow = (windowId) => {
    setActiveChatWindows((prev) => {
      const updated = prev.map((w) => (w.id === windowId ? { ...w, isMinimized: false } : w));
      return recalculatePositions(updated);
    });
  };

  const recalculatePositions = (windows) => {
    return windows.map((window) => {
      const minimized = windows.filter((w) => w.isMinimized);
      const open = windows.filter((w) => !w.isMinimized);

      if (window.isMinimized) {
        const index = minimized.findIndex((w) => w.id === window.id);
        return { ...window, position: getNewWindowPosition(true, windows, index) };
      } else {
        const index = open.findIndex((w) => w.id === window.id);
        return { ...window, position: getNewWindowPosition(false, windows, index) };
      }
    });
  };

  // Helper functions
  const getPeer = (conv) => {
    if (!conv?.participants || !currentUserId) return null;
    return conv.participants.find((p) => {
      const pid = typeof p === 'object' ? (p._id || p.id) : p;
      return String(pid) !== String(currentUserId);
    });
  };

  const getUnreadCount = (conv) => {
    if (!conv?.unreadCounts || !currentUserId) return 0;
    const uid = String(currentUserId);
    return Number(conv.unreadCounts.get?.(uid) || conv.unreadCounts[uid] || 0);
  };

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

  // Lọc cuộc trò chuyện
  const filteredConversations = conversations.filter((conv) => {
    if (chatSearchText) {
      const peer = getPeer(conv);
      const name = (peer?.displayName || peer?.username || '').toLowerCase();
      if (!name.includes(chatSearchText.toLowerCase())) return false;
    }
    if (chatFilter === 'unread') return getUnreadCount(conv) > 0;
    if (chatFilter === 'groups') return false;
    return true;
  });

  // UX tốt hơn: nếu search không ra gì → vẫn hiện danh sách (không để trống)
  const displayConversations =
    chatSearchText && filteredConversations.length === 0 && conversations.length > 0
      ? conversations.filter((conv) => (chatFilter === 'unread' ? getUnreadCount(conv) > 0 : true))
      : filteredConversations;

  const totalUnreadCount = conversations.reduce((sum, conv) => sum + getUnreadCount(conv), 0);

  // Livestream
  const handleLiveStreamClick = () => setIsModalVisible(true);
  const handleConfirm = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const { room } = await livestreamService.createLiveStream();
      setIsModalVisible(false);
      navigate(`/livestream/setup/${room._id}`);
    } catch (err) {
      console.error('Lỗi khi tạo phòng:', err);
      Modal.error({ title: 'Lỗi', content: 'Không thể tạo phòng, vui lòng thử lại.' });
    } finally {
      setIsCreating(false);
    }
  };
  const handleCancel = () => !isCreating && setIsModalVisible(false);

  const handleLogout = useCallback(() => {
    dispatch(logout());
    navigate('/login');
  }, [dispatch, navigate]);

  // Dropdown avatar
  const avatarMenuItems = [
    {
      key: 'profile',
      label: 'Hồ sơ của tôi',
      icon: <UserOutlined />,
      onClick: () => navigate(currentUserId ? `/users/${currentUserId}/newfeeds` : '/profile'),
    },
    {
      key: 'archived',
      label: 'Xem kho lưu trữ',
      icon: <FolderOutlined />,
      onClick: () => navigate('/archived-posts'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: 'Đăng xuất',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <>
      <Header className="app-header">
        <div className="app-header__content">
          <Text className="app-header__logo" onClick={() => navigate('/')}>
            MelodyHub
          </Text>

          <div className="app-header__nav">
            <Text className="app-header__nav-item" onClick={() => navigate('/live')}>
              Join Live
            </Text>
            <Text
              className="app-header__nav-item app-header__nav-link"
              onClick={() => navigate('/library/my-licks')}
            >
              Library
            </Text>
          </div>

          <div className="app-header__spacer" />

          <Input
            className="app-header__search"
            placeholder="Tìm kiếm"
            allowClear
            prefix={<SearchOutlined />}
          />

          <div className="app-header__actions">
            <NotificationBell />

            {!isChatPage && (
              <Popover
                content={
                  <div style={{ width: 400, maxHeight: 600, background: '#1a1a1a', color: '#fff' }}>
                    {/* Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px',
                        borderBottom: '1px solid #2a2a2a',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: '#3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                          }}
                        >
                          <MessageOutlined style={{ fontSize: 20 }} />
                        </div>
                        <Text style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>Đoạn chat</Text>
                      </div>
                      <Space>
                        <MoreOutlined style={{ color: '#9ca3af', fontSize: 16, cursor: 'pointer' }} />
                        <ExpandOutlined style={{ color: '#9ca3af', fontSize: 16, cursor: 'pointer' }} />
                        <EditOutlined
                          style={{ color: '#9ca3af', fontSize: 16, cursor: 'pointer' }}
                          onClick={() => {
                            setChatPopoverVisible(false);
                            navigate('/chat');
                          }}
                        />
                      </Space>
                    </div>

                    {/* Search */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2a2a' }}>
                      <Input
                        placeholder="Tìm kiếm trên Messenger"
                        prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                        value={chatSearchText}
                        onChange={(e) => setChatSearchText(e.target.value)}
                        style={{
                          background: '#111213',
                          borderColor: '#2a2a2a',
                          color: '#e5e7eb',
                          borderRadius: 8,
                        }}
                      />
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid #2a2a2a' }}>
                      {['all', 'unread', 'groups'].map((f) => (
                        <Button
                          key={f}
                          type={chatFilter === f ? 'primary' : 'text'}
                          size="small"
                          onClick={() => setChatFilter(f)}
                          style={{
                            color: chatFilter === f ? '#fff' : '#9ca3af',
                            background: chatFilter === f ? '#3b82f6' : 'transparent',
                            border: 'none',
                          }}
                        >
                          {f === 'all' ? 'Tất cả' : f === 'unread' ? 'Chưa đọc' : 'Nhóm'}
                        </Button>
                      ))}
                    </div>

                    {/* Danh sách */}
                    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                      {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                          <Spin size="large" />
                        </div>
                      ) : displayConversations.length === 0 ? (
                        <Empty description="Chưa có cuộc trò chuyện" style={{ color: '#9ca3af', padding: '40px' }} />
                      ) : (
                        displayConversations.map((conv) => {
                          const peer = getPeer(conv);
                          const unread = getUnreadCount(conv);
                          const peerName = peer?.displayName || peer?.username || 'Người dùng';
                          const peerAvatar = peer?.avatarUrl;
                          const lastMessage = conv.lastMessage || 'Chưa có tin nhắn';
                          const lastMessageTime = formatTime(conv.lastMessageAt);

                          return (
                            <div
                              key={conv._id}
                              onClick={() => {
                                setChatPopoverVisible(false);
                                openChatWindow(conv);
                              }}
                              style={{
                                display: 'flex',
                                gap: 12,
                                padding: '12px 16px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #2a2a2a',
                                transition: 'background 0.2s',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#252525')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <Badge count={unread} offset={[-5, 5]}>
                                <Avatar src={peerAvatar} icon={<UserOutlined />} size={50} />
                              </Badge>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <Text
                                    style={{
                                      color: '#fff',
                                      fontWeight: 600,
                                      fontSize: 14,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {peerName}
                                  </Text>
                                  {lastMessageTime && (
                                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>{lastMessageTime}</Text>
                                  )}
                                </div>
                                <div style={{ color: '#9ca3af', fontSize: 13 }}>
                                  {conv.status === 'pending' ? (
                                    <span style={{ color: '#fa8c16', fontWeight: 500 }}>Yêu cầu tin nhắn</span>
                                  ) : (
                                    lastMessage
                                  )}
                                </div>
                              </div>
                              {unread > 0 && (
                                <div
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: '#3b82f6',
                                    marginTop: 6,
                                  }}
                                />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div style={{ padding: '12px 16px', borderTop: '1px solid #2a2a2a', textAlign: 'center' }}>
                      <Text
                        style={{ color: '#3b82f6', cursor: 'pointer', fontSize: 14 }}
                        onClick={() => {
                          setChatPopoverVisible(false);
                          navigate('/chat');
                        }}
                      >
                        Xem tất cả trong Messenger
                      </Text>
                    </div>
                  </div>
                }
                title={null}
                trigger="click"
                open={chatPopoverVisible}
                onOpenChange={setChatPopoverVisible}
                placement="bottomRight"
                overlayStyle={{ paddingTop: 0 }}
                overlayInnerStyle={{ padding: 0, background: '#1a1a1a' }}
                zIndex={1000}
              >
                <Badge count={totalUnreadCount} offset={[-5, 5]}>
                  <MessageOutlined className="app-header__icon" />
                </Badge>
              </Popover>
            )}

            <Dropdown menu={{ items: avatarMenuItems }} trigger={['click']} placement="bottomRight">
              {userInfo?.avatarUrl ? (
                <Avatar src={userInfo.avatarUrl} size={28} className="app-header__avatar" style={{ cursor: 'pointer' }} />
              ) : (
                <UserOutlined className="app-header__icon" style={{ cursor: 'pointer' }} />
              )}
            </Dropdown>

            <Button className="app-header__cta" icon={<FireOutlined />} onClick={handleLiveStreamClick}>
              LiveStream
            </Button>

            <Button className="app-header__cta">Creat project</Button>
          </div>
        </div>
      </Header>

      {/* Modal Livestream */}
      <Modal
        title="Bắt đầu phát trực tiếp?"
        open={isModalVisible}
        onOk={handleConfirm}
        onCancel={handleCancel}
        closable={!isCreating}
        maskClosable={!isCreating}
        confirmLoading={isCreating}
        okText={isCreating ? 'Đang tạo...' : 'Có'}
        cancelText="Không"
      >
        <p>Bạn có chắc chắn muốn bắt đầu một buổi phát trực tiếp mới?</p>
      </Modal>

      {/* Floating Chat Windows */}
      {!isChatPage &&
        activeChatWindows.map((window) => (
          <FloatingChatWindow
            key={window.id}
            conversation={window.conversation}
            currentUserId={currentUserId}
            isMinimized={window.isMinimized}
            position={window.position}
            onClose={() => closeChatWindow(window.id)}
            onMinimize={() => minimizeChatWindow(window.id)}
            onMaximize={() => maximizeChatWindow(window.id)}
            onConversationUpdate={refresh} // Cập nhật lại danh sách khi gửi tin
          />
        ))}
    </>
  );
};

export default AppHeader;