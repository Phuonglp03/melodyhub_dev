import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout, Input, Button, Typography, Modal, Avatar,
  Popover, Badge, Spin, Empty, Dropdown, Drawer, AutoComplete
} from 'antd';
import {
  FireOutlined, MessageOutlined, SearchOutlined,
  UserOutlined, LogoutOutlined, FolderOutlined, MenuOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../redux/authSlice';
import { livestreamService } from '../services/user/livestreamService';
import useDMConversations from '../hooks/useDMConversations';
import FloatingChatWindow from './FloatingChatWindow';
import NotificationBell from './NotificationBell'; 
import { onDmNew, offDmNew, onDmConversationUpdated, offDmConversationUpdated } from '../services/user/socketService';
import { searchUsers } from '../services/user/profile';
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

  const getIsMobile = () => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  };

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [chatPopoverVisible, setChatPopoverVisible] = useState(false);
  const [chatFilter, setChatFilter] = useState('all'); // 'all', 'unread', 'groups'
  const [chatSearchText, setChatSearchText] = useState('');
  const [activeChatWindows, setActiveChatWindows] = useState([]); // { id, conversation, isMinimized, position }
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const { conversations, loading, refresh } = useDMConversations();
  const [isMobile, setIsMobile] = useState(getIsMobile);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modal, contextHolder] = Modal.useModal();

  // Tính toán vị trí cửa sổ chat
  const getNewWindowPosition = useCallback((isMinimized = false, windowsArray = null, targetIndex = null) => {
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
  }, [activeChatWindows]);

  const recalculatePositions = useCallback((windows) => {
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
  }, [getNewWindowPosition]);

  const openChatWindow = useCallback((conversation) => {
    if (!conversation?._id) return;

    setActiveChatWindows((prev) => {
      const existing = prev.find((w) => w.conversation?._id === conversation._id);
      if (existing) {
        if (existing.isMinimized) {
          const updated = prev.map((w) =>
            w.id === existing.id ? { ...w, isMinimized: false } : w
          );
          return recalculatePositions(updated);
        }
        return prev;
      }

      const position = getNewWindowPosition(false, prev);
      const newWindow = {
        id: `chat-${conversation._id}-${Date.now()}`,
        conversation,
        isMinimized: false,
        position,
      };
      return [...prev, newWindow];
    });
  }, [getNewWindowPosition, recalculatePositions]);

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

  // Cập nhật conversation trong cửa sổ chat khi có tin mới hoặc conversation được update
  useEffect(() => {
    setActiveChatWindows((prev) =>
      prev.map((window) => {
        const updated = conversations.find((c) => c._id === window.conversation._id);
        return updated ? { ...window, conversation: updated } : window;
      })
    );
  }, [conversations]);

  // Lắng nghe event dm:conversation:updated để cập nhật conversation trong cửa sổ chat realtime
  useEffect(() => {
    const handleConversationUpdated = ({ conversationId, conversation }) => {
      console.log('[Header] Received dm:conversation:updated for conversation', conversationId, 'status:', conversation?.status);
      console.log('[Header] Full conversation data:', conversation);
      setActiveChatWindows((prev) => {
        const updated = prev.map((window) => {
          const windowConvId = window.conversation?._id || window.conversation?.id;
          if (String(windowConvId) === String(conversationId)) {
            console.log('[Header] Updating conversation in window:', windowConvId, 'new status:', conversation?.status);
            return { 
              ...window, 
              conversation: { 
                ...window.conversation, 
                ...conversation, 
                status: conversation.status || window.conversation.status 
              } 
            };
          }
          return window;
        });
        console.log('[Header] Updated chat windows:', updated.map(w => ({ id: w.conversation?._id, status: w.conversation?.status })));
        return updated;
      });
    };
    onDmConversationUpdated(handleConversationUpdated);
    return () => {
      offDmConversationUpdated(handleConversationUpdated);
    };
  }, []);

  // Cho phép mở chat từ component khác (rất tiện)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.conversation) openChatWindow(e.detail.conversation);
    };
    window.addEventListener('openChatWindow', handler);
    return () => window.removeEventListener('openChatWindow', handler);
  }, [openChatWindow]);

  useEffect(() => {
    if (!currentUserId) return;

    const handleIncomingMessage = ({ conversationId, message }) => {
      if (!conversationId || !message) return;
      const senderInfo = typeof message.senderId === 'object' ? message.senderId : null;
      const senderId = senderInfo?._id || senderInfo?.id || message.senderId;
      if (!senderId || String(senderId) === String(currentUserId)) return;
      if (isChatPage) return;

      const matchedConversation = conversations.find((conv) => conv._id === conversationId);
      const fallbackConversation = matchedConversation || {
        _id: conversationId,
        participants: [
          senderInfo
            ? {
                _id: senderId,
                displayName: senderInfo.displayName,
                username: senderInfo.username,
                avatarUrl: senderInfo.avatarUrl,
              }
            : null,
          { _id: currentUserId },
        ].filter(Boolean),
        lastMessage: message.textPreview || message.text || '',
        lastMessageAt: message.createdAt,
        status: 'active',
        unreadCounts: {
          [currentUserId]: 1,
        },
      };

      setChatPopoverVisible(false);
      openChatWindow(fallbackConversation);
    };

    onDmNew(handleIncomingMessage);
    return () => offDmNew(handleIncomingMessage);
  }, [conversations, currentUserId, isChatPage, openChatWindow]);

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
  const handleLiveStreamClick = () => {
    if (isMobile) setIsMobileMenuOpen(false);
    setIsModalVisible(true);
  };
  const handleConfirm = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      // Kiểm tra ban status trước
      const banStatus = await livestreamService.checkLivestreamBanStatus();
      if (banStatus.banned) {
        setIsModalVisible(false);
        modal.error({ 
          title: 'Tài khoản bị cấm Livestream',
          content: `Bạn đã bị cấm phát livestream do: ${banStatus.reason || 'Vi phạm quy định cộng đồng'}.`,
          okText: 'Đóng'
        });
        setIsCreating(false);
        return;
      }

      const { room } = await livestreamService.createLiveStream();
      setIsModalVisible(false);
      navigate(`/livestream/setup/${room._id}`);
    } catch (err) {
      console.error('Lỗi khi tạo phòng:', err);
      // Kiểm tra nếu lỗi là do bị ban
      if (err.response?.data?.banned) {
        modal.error({ 
          title: 'Tài khoản bị cấm Livestream',
          content: `Bạn đã bị cấm phát livestream do: ${err.response.data.reason || 'Vi phạm quy định cộng đồng'}. Vui lòng liên hệ hỗ trợ nếu bạn cho rằng đây là nhầm lẫn.`,
          okText: 'Đóng'
        });
      } else {
        modal.error({ title: 'Lỗi', content: 'Không thể tạo phòng, vui lòng thử lại.' });
      }
    } finally {
      setIsCreating(false);
    }
  };
  const handleCancel = () => !isCreating && setIsModalVisible(false);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleLogout = useCallback(() => {
    dispatch(logout());
    navigate('/login');
    closeMobileMenu();
  }, [dispatch, navigate]);

  const handleNavigate = useCallback((path) => {
    navigate(path);
    if (isMobile) closeMobileMenu();
  }, [navigate, isMobile]);

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

  const renderNavLinks = (variant = 'default') => (
    <div className={`app-header__nav ${variant === 'stacked' ? 'app-header__nav--stacked' : ''}`}>
      <Text className="app-header__nav-item" onClick={() => handleNavigate('/live')}>
        Phòng Live
      </Text>
      <Text
        className="app-header__nav-item app-header__nav-link"
        onClick={() => handleNavigate('/library/my-licks')}
      >
        Thư viện
      </Text>
    </div>
  );

  const renderActionButtons = (variant = 'default') => (
    <div className={`app-header__actions ${variant === 'stacked' ? 'app-header__actions--stacked' : ''}`}>
      <NotificationBell />

      {!isChatPage && (
        isMobile ? (
          <Badge count={totalUnreadCount} offset={[-5, 5]}>
            <MessageOutlined
              className="app-header__icon"
              onClick={() => {
                if (isMobile) {
                  closeMobileMenu();
                }
                navigate('/chat');
              }}
            />
          </Badge>
        ) : (
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
                {['all', 'unread'].map((f) => (
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
                    {f === 'all' ? 'Tất cả' : 'Chưa đọc'}
                  </Button>
                ))}
              </div>

              {/* Danh sách */}
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
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

              <div
                style={{
                  padding: '12px 16px 16px',
                  borderTop: '1px solid #2a2a2a',
                  background: '#111827',
                  textAlign: 'center',
                }}
              >
                <button
                  type="button"
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    borderRadius: 999,
                    padding: '8px 16px',
                    background: '#1d4ed8',
                    color: '#f9fafb',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '0 6px 18px rgba(37,99,235,0.55)',
                    transition: 'background 0.15s, transform 0.1s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 10px 22px rgba(37,99,235,0.65)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#1d4ed8';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(37,99,235,0.55)';
                  }}
                  onClick={() => {
                    // Đóng popover trước
                    setChatPopoverVisible(false);
                    // Điều hướng bằng react-router
                    try {
                      navigate('/chat');
                    } catch (e) {
                      // Fallback trong trường hợp hook navigate không hoạt động
                      window.location.href = '/chat';
                    }
                  }}
                >
                  Xem tất cả 
                </button>
              </div>
            </div>
          }
          title={null}
          trigger="click"
          open={chatPopoverVisible}
          onOpenChange={setChatPopoverVisible}
          placement="bottomRight"
          overlayStyle={{ paddingTop: 0 }}
          overlayInnerStyle={{
            padding: 0,
            background: '#111827',
            borderRadius: 12,
            boxShadow: '0 12px 30px rgba(0,0,0,0.65)',
            overflow: 'hidden',
          }}
          zIndex={1000}
        >
          <Badge count={totalUnreadCount} offset={[-5, 5]}>
            <MessageOutlined className="app-header__icon" />
          </Badge>
        </Popover>
        )
      )}

      <Dropdown menu={{ items: avatarMenuItems }} trigger={['click']} placement="bottomRight">
        {userInfo?.avatarUrl ? (
          <Avatar src={userInfo.avatarUrl} size={28} className="app-header__avatar" style={{ cursor: 'pointer' }} />
        ) : (
          <UserOutlined className="app-header__icon" style={{ cursor: 'pointer' }} />
        )}
      </Dropdown>

      <Button className="app-header__cta" icon={<FireOutlined />} onClick={handleLiveStreamClick}>
        Phát Trực Tiếp
      </Button>

      <Button className="app-header__cta app-header__cta--secondary" onClick={() => handleNavigate('/projects')}>
      Tạo Bản Nhạc
      </Button>
    </div>
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(getIsMobile());
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) setIsMobileMenuOpen(false);
  }, [isMobile]);

  // Search users functionality
  const handleSearch = useCallback(async (value) => {
    setSearchQuery(value);
    const query = value?.trim() || '';
    
    if (!query || query.length < 1) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await searchUsers(query, 10);
      if (response?.success && response?.data) {
        setSearchResults(response.data);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleUserSelect = (userId) => {
    setSearchQuery('');
    setSearchResults([]);
    navigate(`/users/${userId}/newfeeds`);
  };

  return (
    <>
      {/* Context holder cho Modal.useModal() hook - cần thiết để modal hiển thị */}
      {contextHolder}
      
      <Header className="app-header">
        <div className="app-header__content">
          <Text className="app-header__logo" onClick={() => handleNavigate('/')}>
            MelodyHub
          </Text>

          {isMobile && (
            <Button
              type="default"
              size="large"
              className="app-header__menu-toggle"
              icon={<MenuOutlined />}
              onClick={() => setIsMobileMenuOpen(true)}
            />
          )}

          {!isMobile && renderNavLinks()}

          <div className="app-header__spacer" />

          <AutoComplete
            className="app-header__search"
            value={searchQuery}
            onChange={setSearchQuery}
            onSelect={(value) => handleUserSelect(value)}
            filterOption={false}
            options={searchResults.map((user) => ({
              value: user.id,
              label: (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '4px 0',
                  }}
                >
                  <Avatar
                    src={user.avatarUrl}
                    icon={<UserOutlined />}
                    size={32}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: '#fff',
                        fontWeight: 500,
                        fontSize: 14,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.displayName || user.username}
                    </div>
                    <div
                      style={{
                        color: '#9ca3af',
                        fontSize: 12,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      @{user.username}
                    </div>
                  </div>
                </div>
              ),
            }))}
            notFoundContent={searchLoading ? <Spin size="small" /> : searchQuery ? 'Không tìm thấy người dùng' : null}
            placeholder="Tìm kiếm người dùng"
            allowClear
            style={{ flex: 1, maxWidth: 600 }}
            dropdownStyle={{
              background: '#111213',
              borderRadius: 8,
              border: '1px solid #2a2a2a',
              maxHeight: 400,
              overflowY: 'auto',
            }}
            dropdownMatchSelectWidth={true}
          >
            <Input
              prefix={<SearchOutlined />}
              allowClear
            />
          </AutoComplete>

          {!isMobile && renderActionButtons()}
        </div>
      </Header>

      <Drawer
        placement="right"
        open={isMobileMenuOpen}
        onClose={closeMobileMenu}
        className="app-header__drawer"
        title="Menu"
      >
        <div className="app-header__drawer-content">
          {renderNavLinks('stacked')}
          {renderActionButtons('stacked')}
        </div>
      </Drawer>

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
        (isMobile ? activeChatWindows.filter((w) => !w.isMinimized) : activeChatWindows).map((window) => (
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

      {isMobile && !isChatPage && activeChatWindows.some((w) => w.isMinimized) && (
        <div className="chat-dock">
          <div className="chat-dock__scroll">
            {activeChatWindows
              .filter((w) => w.isMinimized)
              .map((window) => (
                <FloatingChatWindow
                  key={`dock-${window.id}`}
                  conversation={window.conversation}
                  currentUserId={currentUserId}
                  isMinimized
                  position={window.position}
                  dockMode
                  minimizedStyle={{}}
                  onClose={() => closeChatWindow(window.id)}
                  onMinimize={() => minimizeChatWindow(window.id)}
                  onMaximize={() => maximizeChatWindow(window.id)}
                  onConversationUpdate={refresh}
                />
              ))}
          </div>
        </div>
      )}
    </>
  );
};

export default AppHeader;