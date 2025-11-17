// src/pages/liveroom_live/index.js
// src/pages/liveroom_live/index.js
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import videojs from 'video.js';
import '../../../../node_modules/video.js/dist/video-js.css';
import { livestreamService } from '../../../services/user/livestreamService';
import {
  initSocket,
  joinRoom,
  sendMessage,
  onNewMessage,
  onStreamDetailsUpdated,
  onStreamPrivacyUpdated,
  onStreamEnded,
  offSocketEvents,
  disconnectSocket,
  onUserBanned,
  onMessageRemoved,
  onViewerCountUpdate,
  onChatError
} from '../../../services/user/socketService';
import { Dropdown, Button } from 'antd';
import { MoreOutlined, SendOutlined, SmileOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import EmojiPicker from 'emoji-picker-react';

const LiveStreamLive = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState(null);

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const [liveTitle, setLiveTitle] = useState("");
  const [liveDescription, setLiveDescription] = useState("");
  const [privacy, setPrivacy] = useState('public');

  // Popups
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [showViewersPopup, setShowViewersPopup] = useState(false);
  const [showBannedUsersPopup, setShowBannedUsersPopup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [descriptionText, setDescriptionText] = useState('');

  // Stats
  const [currentViewers, setCurrentViewers] = useState(0);
  const [viewers, setViewers] = useState([]);
  const [duration, setDuration] = useState(0); // in seconds
  const [bannedUsers, setBannedUsers] = useState([]);

  // Video.js refs
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const chatRef = useRef(null);

  useEffect(() => {
    initSocket();

    const fetchRoom = async () => {
      try {
        const roomData = await livestreamService.getLiveStreamById(roomId);
        const currentUserId = user?.user?.id;
        const hostId = roomData.hostId?._id;
        const history = await livestreamService.getChatHistory(roomId);
        if (hostId !== currentUserId) {
          setError("Bạn không có quyền truy cập vào trang này.");
          setLoading(false);
          return;
        }
        if (roomData.status === 'preview' || roomData.status === 'waiting') {
          navigate(`/livestream/setup/${roomId}`); return;
        }
        if (roomData.status === 'ended') {
          alert('Stream đã kết thúc.');
          navigate('/'); return;
        }
        setRoom(roomData);
        setLiveTitle(roomData.title);
        setLiveDescription(roomData.description || "");
        setPrivacy(roomData.privacyType);

        const hlsUrl = roomData.playbackUrls?.hls;
        console.log('[LiveStream] Playback URL:', hlsUrl);
        console.log('[LiveStream] Room status:', roomData.status);

        if (hlsUrl) {
          setPlaybackUrl(hlsUrl);
        } else {
          console.error('[LiveStream] No HLS URL available');
        }

        setLoading(false);
        joinRoom(roomId);
        setMessages(history.slice(-20));
        setBannedUsers(roomData.bannedUsers || []);
      } catch (err) {
        setError('Không tìm thấy phòng live hoặc stream đã kết thúc.');
        setLoading(false);
      }
    };

    fetchRoom();

    // Lắng nghe các sự kiện socket
    onNewMessage((message) => {
      setMessages(prev => {
        const newMessages = [...prev, message].slice(-20);
        return newMessages;
      });
    });

    onStreamEnded(() => {
      alert("Livestream đã kết thúc.");
      navigate('/');
    });

    onStreamDetailsUpdated((details) => {
      setLiveTitle(details.title);
      setLiveDescription(details.description || "");
    });
    
    onMessageRemoved((data) => {
      setMessages(prev => prev.map(msg =>
        msg._id === data.messageId ? { ...msg, message: 'Tin nhắn này đã bị gỡ', deleted: true } : msg
      ));
    });

    onStreamPrivacyUpdated((data) => {
      console.log('[Socket] Cập nhật privacy:', data.privacyType);
      setPrivacy(data.privacyType);
    });

    onViewerCountUpdate((data) => {
      console.log('[Socket] Cập nhật viewer count:', data);
      if (data.roomId === roomId) {
        setCurrentViewers(data.currentViewers || 0);
      }
    });

    onChatError((errorMsg) => {
      console.error('[Socket] Chat error:', errorMsg);
      alert(errorMsg || 'Không thể gửi tin nhắn.');
    });

    return () => {
      offSocketEvents();
      disconnectSocket();
      // Cleanup Video.js player
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [roomId, navigate, user?.user?.id]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Track livestream duration
  useEffect(() => {
    if (!room || !room.startedAt) return;

    const calculateDuration = () => {
      const start = new Date(room.startedAt);
      const now = new Date();
      const diff = Math.floor((now - start) / 1000); // seconds
      setDuration(diff);
    };

    calculateDuration(); // Initial calculation
    const interval = setInterval(calculateDuration, 1000); // Update every second

    return () => clearInterval(interval);
  }, [room]);

  // Initialize Video.js player when playback URL is available
  useEffect(() => {
    // Cleanup function
    const cleanup = () => {
      if (playerRef.current) {
        try {
          playerRef.current.dispose();
        } catch (e) {
          console.error('[Video.js] Dispose error:', e);
        }
        playerRef.current = null;
      }
    };

    if (playbackUrl && videoRef.current && !playerRef.current) {
      // Đợi một chút để DOM sẵn sàng
      setTimeout(() => {
        if (!videoRef.current) return;

        try {
          const player = videojs(videoRef.current, {
            autoplay: true,
            muted: true,
            controls: true,
            fluid: false,
            fill: true,
            liveui: true,
            liveTracker: {
              trackingThreshold: 20,
              liveTolerance: 15
            },
            controlBar: {
              progressControl: false,
              currentTimeDisplay: false,
              timeDivider: false,
              durationDisplay: false,
              remainingTimeDisplay: false,
              seekToLive: true
            },
            html5: {
              vhs: {
                enableLowInitialPlaylist: true,
                smoothQualityChange: true,
                overrideNative: true,
                bandwidth: 4194304,
                limitRenditionByPlayerDimensions: false
              },
              nativeAudioTracks: false,
              nativeVideoTracks: false
            }
          });

          player.src({
            src: playbackUrl,
            type: 'application/x-mpegURL'
          });

          playerRef.current = player;

          player.on('error', (e) => {
            const error = player.error();
            console.error('[Video.js] Error:', error);
            console.error('[Video.js] Error details:', {
              code: error?.code,
              message: error?.message,
              type: error?.type
            });
          });

          player.on('loadedmetadata', () => {
            console.log('[Video.js] Metadata loaded');
          });

          player.on('loadeddata', () => {
            console.log('[Video.js] Data loaded');
          });

          player.on('canplay', () => {
            console.log('[Video.js] Can play');
            player.play().catch(e => {
              console.error('[Video.js] Play error:', e);
            });
          });

          player.on('playing', () => {
            console.log('[Video.js] Playing');
          });

          player.on('waiting', () => {
            console.log('[Video.js] Waiting/Buffering');
          });

          // ✅ Track pause state để jump to live edge khi resume
          let wasPaused = false;
          
          player.on('pause', () => {
            wasPaused = true;
            console.log('[Video.js] Host paused video');
          });

          player.on('play', () => {
            if (wasPaused) {
              // Host ấn play sau khi pause → jump to live edge
              console.log('[Video.js] Resuming from pause, jumping to live edge');
              setTimeout(() => {
                const liveTracker = player.liveTracker;
                if (liveTracker && liveTracker.seekToLiveEdge) {
                  liveTracker.seekToLiveEdge();
                }
              }, 100);
              wasPaused = false;
            }
          });

          // Log player ready
          player.ready(() => {
            console.log('[Video.js] Player ready');
            console.log('[Video.js] Current source:', player.currentSrc());
          });

        } catch (error) {
          console.error('[Video.js] Initialization error:', error);
        }
      }, 100);
    }

    return cleanup;
  }, [playbackUrl]);

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendMessage(roomId, chatInput.trim());
      setChatInput("");
      setShowPicker(false); // Đóng emoji picker sau khi gửi
    }
  };

  const handleEndStream = async () => {
    if (window.confirm("Bạn có chắc muốn kết thúc livestream?")) {
      try {
        await livestreamService.endLiveStream(roomId);
        // onStreamEnded sẽ tự động được kích hoạt và chuyển hướng
      } catch (err) {
        alert("Lỗi khi kết thúc stream.");
      }
    }
  };

  const onEmojiClick = (emojiObject) => {
    setChatInput(prevInput => prevInput + emojiObject.emoji);
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBan = async (userId, messageId) => {
    try {
      await livestreamService.banUser(roomId, userId, { messageId });
      setMessages(prev => prev.map(msg =>
        msg._id === messageId ? { ...msg, message: 'Tin nhắn này đã bị gỡ', deleted: true } : msg
      ));
      // Add to banned list
      if (!bannedUsers.find(u => u._id === userId || u === userId)) {
        setBannedUsers(prev => [...prev, userId]);
      }
    } catch (err) {
      console.error('Lỗi ban:', err);
    }
  };

  const handleBanMute = async (userId) => {
    try {
      await livestreamService.banUser(roomId, userId, { messageId: null });
      // Add to banned list
      if (!bannedUsers.find(u => u._id === userId || u === userId)) {
        setBannedUsers(prev => [...prev, userId]);
      }
      alert('Đã chặn người dùng không cho bình luận.');
    } catch (err) {
      console.error('Lỗi ban:', err);
      alert('Không thể chặn người dùng.');
    }
  };

  const handleUnban = async (userId) => {
    try {
      await livestreamService.unbanUser(roomId, userId);
      setBannedUsers(prev => prev.filter(id => String(id._id || id) !== String(userId)));
      alert('Đã bỏ chặn người dùng.');
    } catch (err) {
      console.error('Lỗi unban:', err);
      alert('Không thể bỏ chặn người dùng.');
    }
  };

  const handleShowBannedUsers = async () => {
    setShowBannedUsersPopup(true);
  };

  const handleOpenEditPopup = () => {
    setDescriptionText(liveDescription || '');
    setShowEmojiPicker(false);
    setShowEditPopup(true);
  };

  const handleUpdateDetails = async ({ title, description }) => {
    setIsSubmitting(true);
    try {
      const { details } = await livestreamService.updateLiveStreamDetails(roomId, { title, description });
      setLiveTitle(details.title);
      setLiveDescription(details.description || "");
      setShowEditPopup(false);
    } catch (err) {
      console.error("Lỗi cập nhật:", err);
      alert("Không thể cập nhật thông tin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShowViewers = async () => {
    try {
      const data = await livestreamService.getRoomViewers(roomId);
      setViewers(data.viewers || []);
      setShowViewersPopup(true);
    } catch (err) {
      console.error('Lỗi khi lấy viewers:', err);
      alert('Không thể lấy danh sách người xem.');
    }
  };

  if (loading) return <div style={{ color: 'white' }}>Đang tải stream...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!room) return null;

  return (
    <>
      {/* ✅ CSS để đẩy volume và fullscreen button sang phải */}
      <style>{`
        .video-js .vjs-control-bar {
          display: flex !important;
        }
        .video-js .vjs-volume-panel {
          margin-right: auto !important;
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: '#18191a',
        color: 'white',
        padding: '0'
      }}>
        {/* Main Content */}
      <div style={{
        display: 'flex',
        gap: '0',
        minHeight: '100vh'
      }}>
        {/* Left Panel - Video */}
        <div style={{
          flex: 1,
          background: '#18191a',
          padding: '20px',
          overflowY: 'auto'
        }}>
          {/* Video Player */}
          <div style={{
            position: 'relative',
            background: 'black',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '20px',
            width: '80%',
            aspectRatio: '16/9'
          }}>
            {playbackUrl ? (
              <>
                <div data-vjs-player style={{
                  width: '100%',
                  height: '100%',
                  position: 'relative'
                }}>
                  <video
                    ref={videoRef}
                    className="video-js vjs-big-play-centered vjs-16-9"
                    playsInline
                    preload="auto"
                  />
                </div>
                {/* Live Badge */}
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  background: '#ff0000',
                  color: 'white',
                  padding: '6px 16px',
                  borderRadius: '4px',
                  fontWeight: '600',
                  fontSize: '14px',
                  zIndex: 1000,
                  pointerEvents: 'none'
                }}>
                  Trực Tiếp
                </div>
              </>
            ) : (
              <div style={{
                height: '100%',
                minHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#b0b3b8',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  border: '4px solid #3a3b3c',
                  borderTop: '4px solid #0084ff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <div>Đang tải video livestream...</div>
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}
          </div>


          {/* Stats and Details Row */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            {/* Thống kê */}
            <div style={{
              flex: 1,
              background: '#242526',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '17px',
                fontWeight: '600'
              }}>Thông tin chi tiết</h3>

              {/* Row 1: Người xem + Tin nhắn */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                {/* Người xem */}
                <div 
                  onClick={handleShowViewers}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: '#3a3b3c',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#4a4b4c'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#3a3b3c'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '18px' }}>👁️</div>
                    <div style={{ fontSize: '14px', color: '#e4e6eb' }}>Người xem</div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#e4e6eb' }}>
                    {currentViewers}
                  </div>
                </div>

                {/* Tin nhắn */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: '#3a3b3c',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '18px' }}>💬</div>
                    <div style={{ fontSize: '14px', color: '#e4e6eb' }}>Tin nhắn</div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#e4e6eb' }}>
                    {messages.length}
                  </div>
                </div>
              </div>

              {/* Row 2: Quyền riêng tư + Người bị chặn */}
              <div style={{ display: 'flex', gap: '12px' }}>
                {/* Quyền riêng tư */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: '#3a3b3c',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '18px' }}>
                      {privacy === 'public' ? '🌍' : '👥'}
                    </div>
                    <div style={{ fontSize: '14px', color: '#e4e6eb' }}>Quyền riêng tư</div>
                  </div>
                  <div style={{ fontSize: '13px', color: '#b0b3b8' }}>
                    {privacy === 'public' ? 'Công khai' : 'Người theo dõi'}
                  </div>
                </div>

                {/* Người bị chặn */}
                <div 
                  onClick={handleShowBannedUsers}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: '#3a3b3c',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#4a4b4c'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#3a3b3c'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '18px' }}>🚫</div>
                    <div style={{ fontSize: '14px', color: '#e4e6eb' }}>Người bị chặn</div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#ff4444' }}>
                    {bannedUsers.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Chi tiết bài viết */}
            <div style={{
              flex: 1,
              background: '#242526',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '17px',
                fontWeight: '600'
              }}>Chi tiết bài viết</h3>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <label style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#b0b3b8'
                  }}>Tiêu đề</label>
                  <button
                    onClick={handleOpenEditPopup}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#0084ff',
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Chỉnh sửa
                  </button>
                </div>
                <div style={{
                  fontSize: '15px',
                  color: '#e4e6eb',
                  fontWeight: '500'
                }}>
                  {liveTitle || 'Tiêu đề chưa có'}
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#b0b3b8',
                  marginBottom: '8px'
                }}>Mô tả</label>
                <div style={{
                  fontSize: '13px',
                  color: '#b0b3b8',
                  lineHeight: '1.5'
                }}>
                  {liveDescription || 'Chưa có mô tả'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Chat */}
        <div style={{
          width: '360px',
          background: '#18191a',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'sticky',
          top: 0,
          padding: '12px',
          gap: '12px'
        }}>
          {/* Chat Section */}
          <div style={{
            background: '#242526',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #3a3b3c'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '17px',
                fontWeight: '600'
              }}>Bình luận</h3>
            </div>

            <div className="chat-messages" ref={chatRef} style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              minHeight: '300px'
            }}>
              {messages.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: '#b0b3b8',
                  padding: '40px 20px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
                  <div style={{ fontSize: '15px' }}>Chưa có bình luận nào từ người xem</div>
                  <div style={{ fontSize: '13px', marginTop: '8px' }}>Bắt đầu cuộc trò chuyện</div>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div key={msg._id || index} style={{
                    marginBottom: '16px',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#3a3b3c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '16px'
                    }}>👤</div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#e4e6eb',
                        marginBottom: '4px'
                      }}>
                        {msg.userId?.displayName || 'Melodyhub'}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: msg.deleted ? '#65676b' : '#b0b3b8',
                        fontStyle: msg.deleted ? 'italic' : 'normal'
                      }}>
                        {msg.deleted ? 'Tin nhắn này đã bị gỡ' : msg.message}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#65676b',
                        marginTop: '4px',
                        display: 'flex',
                        gap: '12px'
                      }}>
                        <span style={{ cursor: 'pointer' }}></span>
                      </div>
                    </div>
                    {/* ✅ Fix: So sánh đúng với user?.user?.id */}
                    {room.hostId._id === user?.user?.id && msg.userId._id !== user?.user?.id && !msg.deleted && (
                      <Dropdown
                        menu={{
                          items: [
                            { key: 'ban-delete', label: 'Ban và gỡ tin nhắn', icon: '🗑️' },
                            { key: 'ban-mute', label: 'Ban không cho bình luận', icon: '🔇' },
                          ],
                          onClick: ({ key }) => {
                            if (key === 'ban-delete') {
                              handleBan(msg.userId._id, msg._id);
                            } else if (key === 'ban-mute') {
                              handleBanMute(msg.userId._id);
                            }
                          }
                        }}
                        trigger={['click']}
                        placement="bottomRight"
                      >
                        <Button 
                          type="text" 
                          icon={<MoreOutlined />} 
                          style={{ 
                            padding: '4px 8px',
                            color: '#b0b3b8',
                            fontSize: '16px'
                          }} 
                        />
                      </Dropdown>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{
              padding: '16px',
              borderTop: '1px solid #3a3b3c',
              position: 'relative'
            }}>
              {showPicker && (
                <div style={{ 
                  position: 'absolute', 
                  bottom: '70px', 
                  left: '16px',
                  right: '16px',
                  zIndex: 1000
                }}>
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    searchDisabled={true}
                    previewConfig={{ showPreview: false }}
                    height={350}
                    width="100%"
                    skinTonesDisabled
                  />
                </div>
              )}
              <form onSubmit={handleSendChat} style={{ 
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <button
                  type="button" 
                  onClick={() => setShowPicker(!showPicker)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '20px',
                    padding: '8px',
                    color: '#b0b3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <SmileOutlined />
                </button>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Viết bình luận..."
                  style={{
                    flex: 1,
                    padding: '10px 40px 10px 12px',
                    background: '#3a3b3c',
                    color: '#e4e6eb',
                    border: '1px solid #4a4b4c',
                    borderRadius: '20px',
                    fontSize: '15px',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '20px',
                    padding: '8px',
                    color: '#0084ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <SendOutlined />
                </button>
              </form>
            </div>
          </div>

          {/* End Stream Section */}
          <div style={{
            background: '#242526',
            borderRadius: '8px',
            padding: '12px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
              color: '#b0b3b8'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#3a3b3c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px'
              }}>⏱️</div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#e4e6eb' }}>{formatDuration(duration)}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#ff0000'
                }}></div>
                <span style={{ fontSize: '13px' }}>Đang ghi hình</span>
              </div>
            </div>
            <button
              onClick={handleEndStream}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#ff4444',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Kết thúc video trực tiếp
            </button>
          </div>
        </div>
      </div>

      {/* Edit Details Popup */}
      {showEditPopup && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          background: 'rgba(0,0,0,0.7)', 
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ 
            background: '#242526',
            padding: '24px',
            borderRadius: '8px',
            width: '500px',
            maxWidth: '90%'
          }}>
            <h3 style={{ 
              margin: '0 0 20px 0',
              fontSize: '20px',
              fontWeight: '600',
              color: '#e4e6eb'
            }}>Chỉnh sửa chi tiết</h3>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateDetails({ 
                title: e.target.title.value, 
                description: descriptionText 
              });
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#e4e6eb'
                }}>Tiêu đề</label>
                <input
                  name="title"
                  defaultValue={liveTitle}
                  placeholder="Tiêu đề (bắt buộc)"
                  required
                  style={{ 
                    width: '100%',
                    padding: '10px 12px',
                    background: '#3a3b3c',
                    color: '#e4e6eb',
                    border: '1px solid #4a4b4c',
                    borderRadius: '6px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px', position: 'relative' }}>
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <label style={{ 
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#e4e6eb'
                  }}>Mô tả</label>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '20px',
                      padding: '4px 8px',
                      color: '#b0b3b8'
                    }}
                    title="Thêm emoji"
                  >
                    <SmileOutlined />
                  </button>
                </div>
                <textarea
                  name="description"
                  value={descriptionText}
                  onChange={(e) => setDescriptionText(e.target.value)}
                  placeholder="Mô tả"
                  style={{ 
                    width: '100%',
                    padding: '10px 12px',
                    background: '#3a3b3c',
                    color: '#e4e6eb',
                    border: '1px solid #4a4b4c',
                    borderRadius: '6px',
                    fontSize: '15px',
                    minHeight: '100px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
                {showEmojiPicker && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: '0',
                    zIndex: 1000,
                    marginTop: '8px'
                  }}>
                    <EmojiPicker
                      onEmojiClick={(emojiObject) => {
                        setDescriptionText(descriptionText + emojiObject.emoji);
                      }}
                      theme="dark"
                      width={300}
                      height={400}
                    />
                  </div>
                )}
              </div>

              <div style={{ 
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button 
                  type="button"
                  onClick={() => {
                    setShowEditPopup(false);
                    setShowEmojiPicker(false);
                  }}
                  style={{
                    padding: '10px 24px',
                    background: '#3a3b3c',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#e4e6eb',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 24px',
                    background: isSubmitting ? '#4a4a4a' : '#0084ff',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewers Popup */}
      {showViewersPopup && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          background: 'rgba(0,0,0,0.7)', 
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ 
            background: '#242526',
            padding: '24px',
            borderRadius: '8px',
            width: '400px',
            maxWidth: '90%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ 
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                color: '#e4e6eb'
              }}>Người xem • {viewers.length}</h3>
              <button
                onClick={() => setShowViewersPopup(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  color: '#b0b3b8',
                  cursor: 'pointer',
                  padding: '0',
                  lineHeight: '1'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{
              flex: 1,
              overflowY: 'auto',
              marginBottom: '16px'
            }}>
              {viewers.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: '#b0b3b8',
                  padding: '40px 20px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
                  <div style={{ fontSize: '15px' }}>Chưa có người xem nào</div>
                </div>
              ) : (
                viewers.map((viewer, index) => (
                  <div key={viewer._id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: '#3a3b3c',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: '#18191a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        color: '#e4e6eb',
                        fontWeight: '600'
                      }}>
                        {index + 1}
                      </div>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: viewer.avatarUrl ? `url(${viewer.avatarUrl})` : '#4a4b4c',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px'
                      }}>
                        {!viewer.avatarUrl && '👤'}
                      </div>
                      <div>
                        <div style={{
                          fontSize: '15px',
                          fontWeight: '600',
                          color: '#e4e6eb'
                        }}>
                          {viewer.displayName || viewer.username}
                        </div>
                        {viewer.username && (
                          <div style={{
                            fontSize: '13px',
                            color: '#b0b3b8'
                          }}>
                            @{viewer.username}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#b0b3b8',
                      textAlign: 'right'
                    }}>
                      {viewer.messageCount || 0}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Banned Users Popup */}
      {showBannedUsersPopup && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          background: 'rgba(0,0,0,0.7)', 
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ 
            background: '#242526',
            padding: '24px',
            borderRadius: '8px',
            width: '400px',
            maxWidth: '90%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ 
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                color: '#e4e6eb'
              }}>Người bị chặn • {bannedUsers.length}</h3>
              <button
                onClick={() => setShowBannedUsersPopup(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  color: '#b0b3b8',
                  cursor: 'pointer',
                  padding: '0',
                  lineHeight: '1'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{
              flex: 1,
              overflowY: 'auto',
              marginBottom: '16px'
            }}>
              {bannedUsers.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: '#b0b3b8',
                  padding: '40px 20px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                  <div style={{ fontSize: '15px' }}>Chưa có người dùng bị chặn</div>
                </div>
              ) : (
                bannedUsers.map((bannedUser, index) => {
                  const userId = bannedUser._id || bannedUser;
                  const displayName = bannedUser.displayName || bannedUser.username || 'User';
                  const username = bannedUser.username;
                  
                  return (
                    <div key={userId} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      background: '#3a3b3c',
                      borderRadius: '8px',
                      marginBottom: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: '#4a4b4c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px'
                        }}>
                          🚫
                        </div>
                        <div>
                          <div style={{
                            fontSize: '15px',
                            fontWeight: '600',
                            color: '#e4e6eb'
                          }}>
                            {displayName}
                          </div>
                          {username && (
                            <div style={{
                              fontSize: '13px',
                              color: '#b0b3b8'
                            }}>
                              @{username}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnban(userId)}
                        style={{
                          padding: '6px 12px',
                          background: '#0084ff',
                          border: 'none',
                          borderRadius: '6px',
                          color: 'white',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Bỏ chặn
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default LiveStreamLive;