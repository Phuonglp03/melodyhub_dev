import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { Avatar, Button, Input, message, Badge, Spin, Empty, Typography } from 'antd';
import { 
  MessageOutlined, 
  CheckOutlined, 
  CloseOutlined,
  SendOutlined,
  UserOutlined,
  SearchOutlined,
  EditOutlined,
  MoreOutlined,
  PhoneOutlined,
  VideoCameraOutlined,
  InfoCircleOutlined,
  LikeOutlined,
  SmileOutlined
} from '@ant-design/icons';
import useDMConversations from '../../../hooks/useDMConversations';
import useDMConversationMessages from '../../../hooks/useDMConversationMessages';
import { initSocket } from '../../../services/user/socketService';
import { getFollowingList, getProfileById } from '../../../services/user/profile';
import './Chat.css';

const { TextArea } = Input;

const ChatPage = () => {
  const currentUser = useSelector((state) => state.auth.user);
  const currentUserId = currentUser?.id || currentUser?._id;
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { conversations, loading, accept, decline, ensureWith } = useDMConversations();
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'groups'
  const [peerInput, setPeerInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [requesterOverride, setRequesterOverride] = useState({}); // conversationId -> true if I just created/requested
  const [followingUsers, setFollowingUsers] = useState([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [peerInfoCache, setPeerInfoCache] = useState({}); // userId -> { displayName, username, avatarUrl }
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Init socket on mount
  useEffect(() => {
    if (currentUserId) {
      initSocket(currentUserId);
    }
  }, [currentUserId]);

  // Fetch following users when search text changes
  useEffect(() => {
    const fetchFollowing = async () => {
      if (!currentUserId) {
        setFollowingUsers([]);
        return;
      }
      try {
        setLoadingFollowing(true);
        // Always fetch, even if searchText is empty (will return all following)
        const res = await getFollowingList(searchText || '', 50);
        console.log('[Chat] getFollowingList response:', res);
        if (res?.success && Array.isArray(res.data)) {
          console.log('[Chat] Found following users:', res.data.length);
          setFollowingUsers(res.data);
        } else {
          console.log('[Chat] No following users found or invalid response');
          setFollowingUsers([]);
        }
      } catch (error) {
        console.error('Error fetching following users:', error);
        setFollowingUsers([]);
      } finally {
        setLoadingFollowing(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(fetchFollowing, 300);
    return () => clearTimeout(timeoutId);
  }, [searchText, currentUserId]);
  
  // Handle conversation query parameter from popover navigation
  useEffect(() => {
    const convIdFromUrl = searchParams.get('conversation');
    if (convIdFromUrl && conversations.length > 0) {
      const convExists = conversations.find(c => c._id === convIdFromUrl);
      if (convExists) {
        setSelectedConvId(convIdFromUrl);
        // Clear the query parameter
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, conversations, setSearchParams]);

  // Get selected conversation
  const selectedConv = conversations.find((c) => c._id === selectedConvId);
  
  // Get peer info from conversation
  const getPeer = (conv) => {
    if (!conv?.participants || !currentUserId) return null;
    
    const currentUserIdStr = String(
      typeof currentUserId === 'object' ? (currentUserId._id || currentUserId.id) : currentUserId
    );
    
    const peer = conv.participants.find((p) => {
      const pid = typeof p === 'object' ? (p._id || p.id) : p;
      return String(pid) !== currentUserIdStr;
    });
    
    if (!peer) return null;
    
    // If peer is just an ID string, try to get from cache
    if (typeof peer === 'string') {
      const cached = peerInfoCache[peer];
      if (cached) {
        return { _id: peer, id: peer, ...cached };
      }
      return { _id: peer, id: peer };
    }
    
    // If peer is object
    if (peer && typeof peer === 'object') {
      const peerId = String(peer._id || peer.id || '');
      
      // If already has displayName/username, return as is
      if (peer.displayName || peer.username) {
        return peer;
      }
      
      // Try to get from cache
      const cached = peerInfoCache[peerId];
      if (cached) {
        return { ...peer, ...cached };
      }
      
      // Return peer even without name (will be fetched)
      return peer;
    }
    
    return peer;
  };

  // Fetch peer info if missing
  useEffect(() => {
    const fetchPeerInfo = async () => {
      const toFetch = [];
      
      for (const conv of conversations) {
        const peer = conv.participants?.find((p) => {
          const pid = typeof p === 'object' ? (p._id || p.id) : p;
          const cid = typeof currentUserId === 'object' ? (currentUserId._id || currentUserId.id) : currentUserId;
          return String(pid) !== String(cid);
        });
        
        if (!peer) continue;
        
        // Extract peerId as string
        let peerId = null;
        if (typeof peer === 'string') {
          peerId = peer;
        } else if (typeof peer === 'object') {
          peerId = String(peer._id || peer.id || '');
        }
        
        if (!peerId || peerId === 'null' || peerId === 'undefined') continue;
        
        // If already have displayName/username, skip
        if (typeof peer === 'object' && (peer.displayName || peer.username)) continue;
        
        // If already in cache, skip
        if (peerInfoCache[peerId]) continue;
        
        // Add to fetch list (ensure it's a string)
        if (!toFetch.find(p => String(p) === String(peerId))) {
          toFetch.push(String(peerId));
        }
      }
      
      // Fetch all missing peer info
      console.log('[Chat] Fetching peer info for', toFetch.length, 'peers');
      for (const peerId of toFetch) {
        // Ensure peerId is a string before making API call
        const peerIdStr = String(peerId);
        if (!peerIdStr || peerIdStr === 'null' || peerIdStr === 'undefined') continue;
        
        try {
          console.log('[Chat] Fetching profile for peerId:', peerIdStr);
          const profile = await getProfileById(peerIdStr);
          console.log('[Chat] Profile response:', profile);
          const user = profile?.data?.user || profile?.user || profile?.data;
          if (user) {
            console.log('[Chat] Caching peer info:', {
              peerId: peerIdStr,
              displayName: user.displayName,
              username: user.username,
            });
            setPeerInfoCache((prev) => ({
              ...prev,
              [peerIdStr]: {
                displayName: user.displayName,
                username: user.username,
                avatarUrl: user.avatarUrl,
              },
            }));
          } else {
            console.warn('[Chat] No user data in profile response:', profile);
          }
        } catch (e) {
          console.error('[Chat] Error fetching peer info for', peerIdStr, e);
        }
      }
    };
    
    if (conversations.length > 0 && currentUserId) {
      fetchPeerInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, currentUserId]);

  // Filter conversations
  const filteredConvs = conversations.filter((c) => {
    // Search filter
    if (searchText) {
      const peer = getPeer(c);
      const peerName = peer?.displayName || peer?.username || '';
      if (!peerName.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }
    }
    
    // Status filter
    if (filter === 'unread') {
      return getUnreadCount(c) > 0;
    }
    if (filter === 'groups') {
      // For now, we'll treat all as individual chats. Can be extended later
      return false;
    }
    return true;
  });

  // Messages hook for selected conversation
  const { 
    messages, 
    loading: messagesLoading, 
    send, 
    typing, 
    peerTyping 
  } = useDMConversationMessages(selectedConvId);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const overrideIsRequester = selectedConvId && requesterOverride[selectedConvId];
  const isRequester = overrideIsRequester || (selectedConv?.requestedBy && String(selectedConv.requestedBy) === String(currentUserId));

  // Handle send message
  const handleSend = () => {
    if (!inputText.trim() || !selectedConvId) return;
    const canSend = selectedConv?.status === 'active' || (selectedConv?.status === 'pending' && isRequester);
    if (!canSend) return message.warning('Chỉ người gửi yêu cầu mới có thể nhắn khi đang chờ chấp nhận');
    send(inputText);
    setInputText('');
    typing.stop();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Handle send like
  const handleSendLike = () => {
    if (!selectedConvId) return;
    const canSend = selectedConv?.status === 'active' || (selectedConv?.status === 'pending' && isRequester);
    if (!canSend) return message.warning('Chỉ người gửi yêu cầu mới có thể nhắn khi đang chờ chấp nhận');
    send('👍');
  };

  // Handle typing
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    const canType = selectedConvId && (selectedConv?.status === 'active' || (selectedConv?.status === 'pending' && isRequester));
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

  // Format time
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

  // Get unread count
  const getUnreadCount = (conv) => {
    if (!conv?.unreadCounts || !currentUserId) return 0;
    const uid = String(currentUserId);
    return Number(conv.unreadCounts.get?.(uid) || conv.unreadCounts[uid] || 0);
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* Sidebar */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <div className="chat-sidebar-title">
              <div className="chat-sidebar-title-left">
                <div className="chat-icon-circle">
                  <MessageOutlined />
                </div>
                <Typography.Title level={4} className="chat-sidebar-title-text">Đoạn chat</Typography.Title>
              </div>
              <div className="chat-sidebar-title-right">
                <MoreOutlined className="chat-header-icon" />
                <EditOutlined className="chat-header-icon" />
              </div>
            </div>
            
            {/* Search Bar */}
            <div className="chat-search-container">
              <Input
                placeholder="Tìm kiếm trên Messenger"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="chat-search-input"
              />
            </div>
            
            {/* Filter Tabs */}
            <div className="chat-filters">
              <Button 
                className={`chat-filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                Tất cả
              </Button>
              <Button 
                className={`chat-filter-tab ${filter === 'unread' ? 'active' : ''}`}
                onClick={() => setFilter('unread')}
              >
                Chưa đọc
              </Button>
              <Button 
                className={`chat-filter-tab ${filter === 'groups' ? 'active' : ''}`}
                onClick={() => setFilter('groups')}
              >
                Nhóm
              </Button>
              <MoreOutlined className="chat-filter-more" />
            </div>
          </div>

          <div className="chat-conversations-list">
            {/* Show following users only when searching */}
            {searchText && (
              <div style={{ padding: '8px 16px', borderBottom: '1px solid #2a2a2a' }}>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
                  Tìm kiếm người bạn đang follow
                </div>
                {loadingFollowing ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                    <Spin size="small" />
                  </div>
                ) : followingUsers.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                    Không tìm thấy người nào
                  </div>
                ) : (
                  followingUsers.map((user) => {
                    // Check if conversation already exists with this user
                    const existingConv = conversations.find((c) => {
                      const peer = getPeer(c);
                      const peerId = peer?._id || peer?.id || peer;
                      return String(peerId) === String(user.id);
                    });

                    return (
                      <div
                        key={user.id}
                        className="chat-conv-item"
                        onClick={async () => {
                          if (existingConv) {
                            setSelectedConvId(existingConv._id);
                            setSearchText('');
                          } else {
                            // Create new conversation
                            try {
                              const newConv = await ensureWith(user.id);
                              const newConvId = newConv?._id || newConv?.id || newConv;
                              if (newConvId) {
                                setSelectedConvId(newConvId);
                                setRequesterOverride((prev) => ({ ...prev, [newConvId]: true }));
                                setSearchText('');
                              } else {
                                message.error('Không thể tạo cuộc trò chuyện');
                              }
                            } catch (error) {
                              console.error('Error creating conversation:', error);
                              message.error(error.message || 'Không thể tạo cuộc trò chuyện');
                            }
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <Avatar 
                          src={user.avatarUrl} 
                          icon={<UserOutlined />}
                          size={50}
                        />
                        <div className="chat-conv-info">
                          <div className="chat-conv-header">
                            <div className="chat-conv-name">{user.displayName || user.username}</div>
                          </div>
                          <div className="chat-conv-preview">
                            {existingConv ? 'Nhấn để mở cuộc trò chuyện' : 'Nhấn để bắt đầu trò chuyện'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            {/* Show conversations */}
            {loading ? (
              <div className="chat-loading"><Spin /></div>
            ) : filteredConvs.length === 0 && !searchText ? (
              <Empty description="Chưa có cuộc trò chuyện" />
            ) : (
              filteredConvs.map((conv) => {
                const peer = getPeer(conv);
                const unread = getUnreadCount(conv);
                const isSelected = conv._id === selectedConvId;
                
                // Debug: log peer info
                if (!peer?.displayName && !peer?.username) {
                  console.log('[Chat] Peer missing name:', {
                    convId: conv._id,
                    participants: conv.participants,
                    peer,
                    peerFromCache: peerInfoCache[peer?._id || peer?.id || peer],
                  });
                }
                
                const peerName = peer?.displayName || peer?.username || 'Người dùng';
                const peerAvatar = peer?.avatarUrl;

                return (
                  <div
                    key={conv._id}
                    className={`chat-conv-item ${isSelected ? 'selected' : ''} ${conv.status === 'pending' ? 'pending' : ''}`}
                    onClick={() => setSelectedConvId(conv._id)}
                  >
                    <Badge count={unread > 0 ? unread : 0} offset={[-5, 5]}>
                      <Avatar 
                        src={peerAvatar} 
                        icon={<UserOutlined />}
                        size={50}
                      />
                    </Badge>
                    <div className="chat-conv-info">
                      <div className="chat-conv-header">
                        <div className="chat-conv-name">{peerName}</div>
                        {conv.lastMessageAt && (
                          <div className="chat-conv-time">{formatTime(conv.lastMessageAt)}</div>
                        )}
                      </div>
                      <div className="chat-conv-preview">
                        {conv.status === 'pending' ? (
                          <span className="pending-badge">Yêu cầu tin nhắn</span>
                        ) : (
                          <span>{conv.lastMessage || 'Chưa có tin nhắn'}</span>
                        )}
                      </div>
                    </div>
                    {unread > 0 && (
                      <div className="chat-conv-unread-dot"></div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Box */}
        <div className="chat-box">
          {!selectedConvId ? (
            <div className="chat-empty">
              <MessageOutlined style={{ fontSize: 64, color: '#ccc' }} />
              <p>Chọn một cuộc trò chuyện để bắt đầu</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                {(() => {
                  const peer = getPeer(selectedConv);
                  return (
                    <>
                      <Avatar 
                        src={peer?.avatarUrl} 
                        icon={<UserOutlined />}
                        size={40}
                      />
                      <div className="chat-header-info">
                        <div className="chat-header-name">
                          {peer?.displayName || peer?.username || 'Người dùng'}
                        </div>
                        <div className="chat-header-status">
                          {peerTyping ? 'Đang gõ...' : formatTime(peer?.lastSeen || selectedConv?.lastMessageAt)}
                        </div>
                      </div>
                      <div className="chat-header-actions">
                        <PhoneOutlined className="chat-header-action-icon" />
                        <VideoCameraOutlined className="chat-header-action-icon" />
                        <InfoCircleOutlined className="chat-header-action-icon" />
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Pending banner for receiver */}
              {(selectedConv?.status === 'pending' && !isRequester) && (
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #e8e8e8',
                  background: '#fff7e6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Yêu cầu tin nhắn</div>
                    <div style={{ color: '#8c8c8c', fontSize: 13 }}>Bạn có muốn chấp nhận yêu cầu này không?</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={async () => {
                        try {
                          await accept(selectedConvId);
                          message.success('Đã chấp nhận');
                        } catch (e) {
                          message.error(e.message || 'Lỗi');
                        }
                      }}
                    >
                      Chấp nhận
                    </Button>
                    <Button
                      danger
                      icon={<CloseOutlined />}
                      onClick={async () => {
                        try {
                          await decline(selectedConvId);
                          message.success('Đã từ chối');
                          setSelectedConvId(null);
                        } catch (e) {
                          message.error(e.message || 'Lỗi');
                        }
                      }}
                    >
                      Từ chối
                    </Button>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="chat-messages">
                {messagesLoading && messages.length === 0 ? (
                  <div className="chat-loading"><Spin /></div>
                ) : messages.length === 0 ? (
                  <Empty description="Chưa có tin nhắn" />
                ) : (
                  messages.map((msg) => {
                    const isMe = String(msg.senderId?._id || msg.senderId) === String(currentUserId);
                    return (
                      <div
                        key={msg._id}
                        className={`chat-message ${isMe ? 'me' : 'peer'}`}
                      >
                        {!isMe && (
                          <Avatar 
                            src={msg.senderId?.avatarUrl} 
                            icon={<UserOutlined />}
                            size={32}
                          />
                        )}
                        <div className="chat-message-content">
                          <div className="chat-message-text">{msg.text}</div>
                          <div className="chat-message-time">
                            {formatTime(msg.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="chat-input">
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
                  className="chat-input-textarea"
                  disabled={selectedConv?.status === 'pending' && !isRequester}
                />
                <div className="chat-input-right">
                  <Button 
                    type="text" 
                    icon={<SmileOutlined />} 
                    className="chat-input-icon"
                    title="Emoji"
                    disabled={selectedConv?.status === 'pending' && !isRequester}
                  />
                  <Button 
                    type="text" 
                    icon={<LikeOutlined />} 
                    className="chat-input-icon"
                    onClick={handleSendLike}
                    title="Like"
                    disabled={selectedConv?.status === 'pending' && !isRequester}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;

