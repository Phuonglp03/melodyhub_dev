import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import videojs from 'video.js';
import '../../../../node_modules/video.js/dist/video-js.css';
import { livestreamService } from '../../../services/user/livestreamService';
import { followUser, unfollowUser } from '../../../services/user/profile';
import { reportLivestream, checkLivestreamReport } from '../../../services/user/reportService';
import {
  initSocket,
  joinRoom,
  sendMessage,
  onNewMessage,
  onStreamEnded,
  offSocketEvents,
  disconnectSocket,
  onChatError,
  onChatBanned,
  onChatUnbanned,
  onMessageRemoved
} from '../../../services/user/socketService';
import LiveVideo from '../../../components/LiveVideo';
import { Modal } from 'antd';
import { SendOutlined, UserOutlined, InfoCircleOutlined, UserAddOutlined, UserDeleteOutlined, FlagOutlined } from '@ant-design/icons';

const LiveViewPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const currentUser = useSelector(state => state.auth.user?.user);
  
  // Modal hook (antd v5)
  const [modal, contextHolder] = Modal.useModal();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState(null);

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [chatBanned, setChatBanned] = useState(false);

  // Report modal states
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDescription, setReportDescription] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [hasReported, setHasReported] = useState(false);

  // Video.js refs
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    initSocket();

    const fetchRoom = async () => {
      try {
        const roomData = await livestreamService.getLiveStreamById(roomId);
        const history = await livestreamService.getChatHistory(roomId);

        if (roomData.status !== 'live') {
          setError('Stream không hoạt động hoặc đã kết thúc.');
          setLoading(false);
          return;
        }

        setRoom(roomData);
        // isFollowing và các field user-specific sẽ được update ở useEffect riêng bên dưới
        setIsFollowing(roomData.isFollowing || false);

        const hlsUrl = roomData.playbackUrls?.hls;

        if (hlsUrl) {
          setPlaybackUrl(hlsUrl);
        } else {
          console.error('[LiveView] No HLS URL available');
        }

        setLoading(false);
        joinRoom(roomId);
        setMessages(history);
      } catch (err) {
        setError(err.message || 'Không thể tải stream.');
        setLoading(false);
      }
    };

    fetchRoom();

    onNewMessage((message) => {
      setMessages(prev => [...prev, message]);
    });

    onStreamEnded(() => {
      modal.info({
        title: 'Livestream đã kết thúc',
        content: 'Người phát đã dừng livestream.',
        okText: 'Quay lại danh sách',
        maskClosable: true,
        onOk: () => navigate('/live'),
        onCancel: () => navigate('/live') // Click bên ngoài cũng redirect
      });
    });

    onChatError((errorMsg) => {
      if (errorMsg && errorMsg.includes('cấm chat')) {
        setChatBanned(true);
      } else {
        alert(errorMsg || 'Không thể gửi tin nhắn.');
      }
    });

    onChatBanned(() => {
      setChatBanned(true);
    });

    onChatUnbanned(() => {
      setChatBanned(false);
    });

    onMessageRemoved((data) => {
      setMessages(prev => prev.map(msg =>
        msg._id === data.messageId ? { ...msg, message: 'Tin nhắn này đã bị gỡ', deleted: true } : msg
      ));
    });

    return () => {
      offSocketEvents();
      disconnectSocket();
      if (playerRef.current) {
        try {
          playerRef.current.dispose();
        } catch (e) {
          console.error('[Video.js] Dispose error:', e);
        }
        playerRef.current = null;
      }
    };
    // Chỉ chạy một lần – LOẠI BỎ currentUser khỏi dependency để tránh dispose player khi user load
  }, [roomId, navigate, modal]);

  // ==================================================================
  // NEW: Cập nhật lại các thông tin cần auth (isFollowing, hasReported, isHost…) khi currentUser sẵn sàng
  // ==================================================================
  useEffect(() => {
    if (!currentUser || loading || !roomId) return;

    // Cập nhật hasReported
    checkLivestreamReport(roomId)
      .then(res => {
        setHasReported(res.data.hasReported);
      })
      .catch(err => {
        console.error('Error checking report status:', err);
      });

    // Cập nhật lại room data để lấy isFollowing, isHost… chính xác (khi user vừa login)
    livestreamService.getLiveStreamById(roomId)
      .then(freshRoomData => {
        setIsFollowing(freshRoomData.isFollowing || false);
        setRoom(prev => ({
          ...prev,
          isHost: freshRoomData.isHost ?? prev.isHost ?? false,
          // nếu có thêm field nào cần auth thì thêm vào đây
        }));
      })
      .catch(err => {
        console.error('Error refreshing room data for auth fields:', err);
      });
  }, [currentUser, roomId, loading]);

  // Auto scroll to bottom chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize Video.js – cấu hình y hệt file cũ (đã test chạy tốt)
  useEffect(() => {
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
              trackingThreshold: 15,
              liveTolerance: 10,
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
                limitRenditionByPlayerDimensions: false,
                playlistRetryCount: 3,
                playlistRetryDelay: 500,
                bufferBasedBitrateSelection: true,
                liveSyncDurationCount: 3,
                liveMaxLatencyDurationCount: 7,
              },
              nativeAudioTracks: false,
              nativeVideoTracks: false
            }
          });

          player.src({
            src: playbackUrl,
            type: 'application/x-mpegURL'
          });

          player.ready(() => {
            player.play().catch(() => {
              player.muted(true);
              player.play();
            });
          });
          playerRef.current = player;

          // Auto Reconnect Logic (giữ nguyên từ file cũ)
          player.on('error', () => {
            const err = player.error();
            console.warn('VideoJS Error:', err);
            if (err && (err.code === 2 || err.code === 3 || err.code === 4)) {
              console.log('Đang thử khôi phục stream...');
              setTimeout(() => {
                if (player && !player.isDisposed()) {
                  player.src({
                    src: playbackUrl,
                    type: 'application/x-mpegURL'
                  });
                  player.play().catch(e => console.log('Auto-play prevented'));
                }
              }, 1500);
            }
          });

          let wasPaused = false;
          player.on('pause', () => { wasPaused = true; });
          player.on('play', () => {
            if (wasPaused) {
              setTimeout(() => {
                const liveTracker = player.liveTracker;
                if (liveTracker?.seekToLiveEdge) liveTracker.seekToLiveEdge();
              }, 100);
              wasPaused = false;
            }
          });

        } catch (error) {
          console.error('[Video.js] Initialization error:', error);
        }
      }, 100);
    }
    return cleanup;
  }, [playbackUrl]);

  // ==================================================================
  // Các handler còn lại giữ nguyên
  // ==================================================================
  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendMessage(roomId, chatInput.trim());
      setChatInput("");
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      alert('Vui lòng đăng nhập để theo dõi.');
      return;
    }

    if (!room?.hostId?._id) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(room.hostId._id);
        setIsFollowing(false);
      } else {
        await followUser(room.hostId._id);
        setIsFollowing(true);
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
      alert(err.response?.data?.message || 'Không thể thực hiện thao tác.');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert('Vui lòng đăng nhập để báo cáo.');
      return;
    }

    setReportLoading(true);
    try {
      await reportLivestream(roomId, {
        reason: reportReason,
        description: reportDescription
      });
      alert('Đã gửi báo cáo thành công. Cảm ơn bạn!');
      setShowReportModal(false);
      setHasReported(true);
      setReportDescription('');
    } catch (err) {
      console.error('Error reporting livestream:', err);
      alert(err.response?.data?.message || 'Không thể gửi báo cáo.');
    } finally {
      setReportLoading(false);
    }
  };

  // ==================================================================
  // Render (giữ nguyên toàn bộ UI của file mới)
  // ==================================================================
  if (loading) return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0e0e10',
      color: '#efeff1'
    }}>
      <div className="loading-spinner"></div>
      <style>{`
        .loading-spinner {
          width: 40px; height: 40px;
          border: 3px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: #bf94ff;
          animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );

  if (error) return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0e0e10',
      color: '#ff4d4d',
      fontSize: '18px',
      fontWeight: '500'
    }}>
      ⚠️ {error}
    </div>
  );

  if (!room) return null;

  return (
    <>
      {/* Context holder cho Modal hook */}
      {contextHolder}
      
      {/* Global Styles & toàn bộ JSX còn lại giữ nguyên 100% như file mới của bạn */}
      <style>{`
        body { margin: 0; overflow: hidden; background: #0e0e10; }
        .video-js .vjs-control-bar { background: linear-gradient(to top, rgba(0,0,0,0.9), transparent) !important; }
        .video-js .vjs-big-play-button {
          background-color: rgba(145, 71, 255, 0.8) !important;
          border: none !important;
          border-radius: 50% !important;
          width: 60px !important; height: 60px !important;
          line-height: 60px !important;
          margin-left: -30px !important; margin-top: -30px !important;
        }
        .video-js .vjs-volume-panel { margin-right: auto !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #666; }
      `}</style>

      <div style={{
        display: 'flex',
        height: 'calc(100vh - 72px)',
        marginTop: '72px',
        background: '#0e0e10',
        color: '#efeff1',
        overflow: 'hidden'
      }}>
        {/* LEFT COLUMN: VIDEO & INFO */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          position: 'relative'
        }} className="custom-scrollbar">

          <div style={{
            width: '100%',
            background: '#000',
            aspectRatio: '16/9',
            position: 'relative',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}>
            {playbackUrl ? (
              <>
                <div data-vjs-player style={{ width: '100%', height: '100%' }}>
                  <video
                    ref={videoRef}
                    className="video-js vjs-big-play-centered vjs-16-9"
                    playsInline
                    preload="auto"
                  />
                </div>
                {playerRef.current && <LiveVideo player={playerRef.current} style={{ top: '20px', left: '20px' }} />}
              </>
            ) : (
              <div style={{
                width: '100%', height: '100%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '15px', color: '#adadb8'
              }}>
                <div className="loading-spinner"></div>
                <div>Đang tải tín hiệu...</div>
              </div>
            )}
          </div>

          {/* Stream Info Section */}
          <div style={{ padding: '20px 30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h1 style={{
                  fontSize: '22px',
                  fontWeight: '700',
                  margin: '0 0 8px 0',
                  lineHeight: '1.2'
                }}>
                  {room.title}
                </h1>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                  <div style={{
                    width: '48px', height: '48px',
                    borderRadius: '50%',
                    border: '2px solid #9147ff',
                    overflow: 'hidden',
                    background: '#1f1f23'
                  }}>
                    <img
                      src={room.hostId?.avatarUrl || 'https://via.placeholder.com/48'}
                      alt="Host"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/48' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (room.hostId?._id) {
                            // Mở profile ở tab mới để không thoát khỏi livestream
                            window.open(`/users/${room.hostId._id}/newfeeds`, '_blank');
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (room.hostId?._id) {
                              window.open(`/users/${room.hostId._id}/newfeeds`, '_blank');
                            }
                          }
                        }}
                        style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#9147ff',
                          cursor: 'pointer',
                          transition: 'opacity 0.2s',
                          userSelect: 'none',
                          display: 'inline-block',
                          outline: 'none'
                        }}
                        onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                        onMouseLeave={(e) => e.target.style.opacity = '1'}
                      >
                        {room.hostId?.displayName || 'Unknown Host'}
                      </div>

                      {/* Follow/Unfollow Button */}
                      {currentUser && room.hostId?._id && currentUser.id !== room.hostId._id && !room.isHost && (
                        <button
                          onClick={handleFollowToggle}
                          disabled={followLoading}
                          style={{
                            background: isFollowing ? '#2f2f35' : '#9147ff',
                            border: isFollowing ? '1px solid #53535f' : 'none',
                            color: '#efeff1',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            cursor: followLoading ? 'default' : 'pointer',
                            fontSize: '13px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            opacity: followLoading ? 0.6 : 1,
                            transition: 'all 0.2s'
                          }}
                        >
                          {followLoading ? '...' : (
                            <>
                              {isFollowing ? <UserDeleteOutlined /> : <UserAddOutlined />}
                              {isFollowing ? 'Bỏ theo dõi' : 'Theo dõi'}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: '#adadb8', marginTop: '2px' }}>
                      Host • {room.privacyType === 'public' ? 'Công khai' : 'Người theo dõi'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {room.description && (
                  <button
                    onClick={() => setShowDescription(!showDescription)}
                    style={{
                      background: '#2f2f35',
                      border: 'none',
                      color: '#efeff1',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '600',
                      fontSize: '13px'
                    }}
                  >
                    <InfoCircleOutlined /> {showDescription ? 'Ẩn mô tả' : 'Hiện mô tả'}
                  </button>
                )}

                {/* Report Button */}
                {currentUser && room.hostId?._id && currentUser.id !== room.hostId._id && !room.isHost && (
                  <button
                    onClick={() => setShowReportModal(true)}
                    disabled={hasReported}
                    style={{
                      background: hasReported ? '#53535f' : '#e91916',
                      border: 'none',
                      color: '#efeff1',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      cursor: hasReported ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '600',
                      fontSize: '13px',
                      opacity: hasReported ? 0.6 : 1
                    }}
                    title={hasReported ? 'Bạn đã báo cáo livestream này' : 'Báo cáo livestream'}
                  >
                    <FlagOutlined /> {hasReported ? 'Đã báo cáo' : 'Báo cáo'}
                  </button>
                )}
              </div>
            </div>

            {showDescription && (
              <div style={{
                marginTop: '20px',
                background: '#1f1f23',
                padding: '15px',
                borderRadius: '8px',
                fontSize: '14px',
                lineHeight: '1.5',
                color: '#dedee3'
              }}>
                {room.description}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CHAT */}
        <div style={{
          width: '340px',
          background: '#18181b',
          borderLeft: '1px solid #2f2f35',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          <div style={{
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #2f2f35',
            fontSize: '12px',
            fontWeight: '600',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: '#adadb8'
          }}>
            Trò chuyện trực tiếp
          </div>

          <div className="custom-scrollbar" style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 15px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {messages.length === 0 ? (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#adadb8',
                opacity: 0.7
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
                <div style={{ fontSize: '14px' }}>Chào mừng đến với phòng chat!</div>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isSystem = !msg.userId;
                return (
                  <div key={msg._id || index} style={{
                    fontSize: '13px',
                    lineHeight: '20px',
                    padding: '4px 0',
                    wordWrap: 'break-word',
                    color: msg.deleted ? '#666' : '#efeff1',
                    fontStyle: msg.deleted ? 'italic' : 'normal'
                  }}>
                    {!isSystem && (
                      <span style={{
                        fontWeight: '700',
                        color: msg.userId?._id === room.hostId._id ? '#e91916' : '#adadb8',
                        marginRight: '6px',
                        cursor: 'pointer'
                      }}>
                        {msg.userId?.displayName || 'User'}:
                        {msg.userId?._id === room.hostId._id && (
                          <span style={{
                            marginLeft: '4px',
                            fontSize: '10px',
                            background: '#e91916',
                            color: 'white',
                            padding: '1px 3px',
                            borderRadius: '2px'
                          }}>HOST</span>
                        )}
                      </span>
                    )}
                    <span>{msg.deleted ? 'Tin nhắn đã bị xóa' : msg.message}</span>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: '20px' }}>
            {chatBanned && (
              <div style={{
                background: 'rgba(255, 77, 79, 0.1)',
                border: '1px solid rgba(255, 77, 79, 0.3)',
                borderRadius: '6px',
                padding: '10px 12px',
                marginBottom: '12px',
                color: '#ff4d4f',
                fontSize: '13px',
                fontWeight: '500',
                textAlign: 'center'
              }}>
                🚫 Bạn đã bị cấm chat trong các phòng livestream của host này
              </div>
            )}
            <form onSubmit={handleSendChat} style={{ position: 'relative' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={chatBanned ? "Bạn đã bị cấm chat" : "Gửi tin nhắn..."}
                maxLength={200}
                disabled={chatBanned}
                style={{
                  width: '100%',
                  background: chatBanned ? '#1f1f23' : '#2f2f35',
                  color: chatBanned ? '#666' : '#efeff1',
                  border: '2px solid transparent',
                  padding: '12px 40px 12px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                  cursor: chatBanned ? 'not-allowed' : 'text'
                }}
                onFocus={(e) => !chatBanned && (e.target.style.borderColor = '#9147ff')}
                onBlur={(e) => e.target.style.borderColor = 'transparent'}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatBanned}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: (chatInput.trim() && !chatBanned) ? '#9147ff' : '#53535f',
                  cursor: (chatInput.trim() && !chatBanned) ? 'pointer' : 'default',
                  padding: '4px',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <SendOutlined />
              </button>
            </form>
            {!chatBanned && (
              <div style={{
                textAlign: 'right',
                fontSize: '11px',
                color: '#adadb8',
                marginTop: '6px'
              }}>
                {chatInput.length}/200
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setShowReportModal(false)}
        >
          <div
            style={{
              background: '#18181b',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              margin: '0 0 20px 0',
              fontSize: '20px',
              fontWeight: '700',
              color: '#efeff1'
            }}>
              Báo cáo livestream
            </h2>

            <form onSubmit={handleReportSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#adadb8'
                }}>
                  Lý do báo cáo *
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#2f2f35',
                    border: '1px solid #53535f',
                    borderRadius: '4px',
                    color: '#efeff1',
                    fontSize: '14px'
                  }}
                >
                  <option value="spam">Spam</option>
                  <option value="inappropriate">Nội dung không phù hợp</option>
                  <option value="copyright">Vi phạm bản quyền</option>
                  <option value="harassment">Quấy rối</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#adadb8'
                }}>
                  Mô tả chi tiết (tùy chọn)
                </label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Vui lòng mô tả chi tiết vấn đề..."
                  maxLength={500}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#2f2f35',
                    border: '1px solid #53535f',
                    borderRadius: '4px',
                    color: '#efeff1',
                    fontSize: '14px',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
                <div style={{
                  textAlign: 'right',
                  fontSize: '12px',
                  color: '#adadb8',
                  marginTop: '4px'
                }}>
                  {reportDescription.length}/500
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  disabled={reportLoading}
                  style={{
                    padding: '10px 20px',
                    background: '#2f2f35',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#efeff1',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: reportLoading ? 'not-allowed' : 'pointer',
                    opacity: reportLoading ? 0.5 : 1
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={reportLoading}
                  style={{
                    padding: '10px 20px',
                    background: '#e91916',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#efeff1',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: reportLoading ? 'not-allowed' : 'pointer',
                    opacity: reportLoading ? 0.5 : 1
                  }}
                >
                  {reportLoading ? 'Đang gửi...' : 'Gửi báo cáo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default LiveViewPage;