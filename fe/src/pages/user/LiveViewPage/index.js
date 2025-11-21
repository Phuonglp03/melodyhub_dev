// src/pages/user/LiveViewPage/index.js
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
  onStreamEnded, 
  offSocketEvents, 
  disconnectSocket,
  onChatError,
  onMessageRemoved
} from '../../../services/user/socketService';
import LiveVideo from '../../../components/LiveVideo';
import { SendOutlined, UserOutlined, InfoCircleOutlined } from '@ant-design/icons'; // Cần cài antd icons nếu chưa có

const LiveViewPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState(null);
  
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [showDescription, setShowDescription] = useState(false);

  // Video.js refs
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const chatEndRef = useRef(null); // Để auto scroll

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
      alert("Livestream đã kết thúc.");
      navigate('/live'); 
    });
    
    onChatError((errorMsg) => {
      alert(errorMsg || 'Không thể gửi tin nhắn.');
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
  }, [roomId, navigate]);

  // Auto scroll to bottom chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize Video.js
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

          playerRef.current = player;

          // Auto Reconnect Logic
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

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendMessage(roomId, chatInput.trim());
      setChatInput("");
    }
  };

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
      {/* Global Styles for Scrollbar & VideoJS Tweaks */}
      <style>{`
        body { margin: 0; overflow: hidden; background: #0e0e10; }
        
        /* VideoJS Customization */
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

        /* Custom Scrollbar for Chat */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #666; }
      `}</style>

      <div style={{ 
        display: 'flex', 
        height: '100vh', 
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
          
          {/* Video Player Container */}
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
                      onError={(e) => {e.target.src = 'https://via.placeholder.com/48'}}
                    />
                  </div>
                  <div>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#9147ff' 
                    }}>
                      {room.hostId?.displayName || 'Unknown Host'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#adadb8' }}>
                      Host • {room.privacyType === 'public' ? 'Công khai' : 'Người theo dõi'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description Toggle */}
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
          {/* Chat Header */}
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

          {/* Chat Messages */}
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
                        color: msg.userId?._id === room.hostId._id ? '#e91916' : '#adadb8', // Host màu đỏ, user thường màu xám
                        marginRight: '6px',
                        cursor: 'pointer'
                      }}>
                        {msg.userId?.displayName || 'User'}:
                        {msg.userId?._id === room.hostId._id && <span style={{marginLeft:'4px', fontSize:'10px', background:'#e91916', color:'white', padding:'1px 3px', borderRadius:'2px'}}>HOST</span>}
                      </span>
                    )}
                    <span>{msg.deleted ? 'Tin nhắn đã bị xóa' : msg.message}</span>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div style={{ padding: '20px' }}>
            <form onSubmit={handleSendChat} style={{ position: 'relative' }}>
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Gửi tin nhắn..."
                maxLength={200}
                style={{ 
                  width: '100%', 
                  background: '#2f2f35', 
                  color: '#efeff1', 
                  border: '2px solid transparent', 
                  padding: '12px 40px 12px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#9147ff'}
                onBlur={(e) => e.target.style.borderColor = 'transparent'}
              />
              <button 
                type="submit"
                disabled={!chatInput.trim()}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: chatInput.trim() ? '#9147ff' : '#53535f',
                  cursor: chatInput.trim() ? 'pointer' : 'default',
                  padding: '4px',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <SendOutlined />
              </button>
            </form>
            <div style={{ 
              textAlign: 'right', 
              fontSize: '11px', 
              color: '#adadb8', 
              marginTop: '6px' 
            }}>
              {chatInput.length}/200
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LiveViewPage;