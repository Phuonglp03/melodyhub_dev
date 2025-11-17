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

const LiveViewPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState(null);
  
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  // Video.js refs
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    initSocket();

    const fetchRoom = async () => {
      try {
        // GỌI HÀM NÀY SẼ TỰ ĐỘNG CHECK AUTH VÀ FOLLOW
        const roomData = await livestreamService.getLiveStreamById(roomId);
        const history = await livestreamService.getChatHistory(roomId);
        // Nếu stream chưa 'live' hoặc đã 'ended' (Viewer không được xem)
        if (roomData.status !== 'live') {
          setError('Stream không hoạt động hoặc đã kết thúc.');
          setLoading(false);
          return;
        }

        setRoom(roomData);
        const hlsUrl = roomData.playbackUrls?.hls;
        
        console.log('[LiveView] Playback URL:', hlsUrl);
        console.log('[LiveView] Room status:', roomData.status);
        
        if (hlsUrl) {
          setPlaybackUrl(hlsUrl);
        } else {
          console.error('[LiveView] No HLS URL available');
        }
        
        setLoading(false);
        joinRoom(roomId);
        setMessages(history);
      } catch (err) {
        // Lỗi 403 (Follow only) hoặc 404 (Not found) sẽ rơi vào đây
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
      navigate('/live'); // Quay về trang danh sách
    });
    
    onChatError((errorMsg) => {
      alert(errorMsg || 'Không thể gửi tin nhắn.');
    });
    
    onMessageRemoved((data) => {
      // ✅ Cập nhật tin nhắn bị gỡ để hiển thị "Tin nhắn này đã bị gỡ"
      setMessages(prev => prev.map(msg =>
        msg._id === data.messageId ? { ...msg, message: 'Tin nhắn này đã bị gỡ', deleted: true } : msg
      ));
    });
    
    // (Không cần onStreamDetailsUpdated hoặc onStreamPrivacyUpdated, trừ khi bạn muốn)

    return () => {
      offSocketEvents();
      disconnectSocket();
      // Cleanup Video.js player
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

  // Initialize Video.js player when playback URL is available
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
              progressControl: false, // ✅ Ẩn progress bar như host
              currentTimeDisplay: false,
              timeDivider: false,
              durationDisplay: false,
              remainingTimeDisplay: false,
              seekToLive: true // Hiện nút "LIVE"
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
            console.log('[Video.js] User paused video');
          });

          player.on('play', () => {
            if (wasPaused) {
              // User ấn play sau khi pause → jump to live edge
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
    }
  };

  if (loading) return <div style={{ color: 'white' }}>Đang tải stream...</div>;
  if (error) return <div style={{ color: 'red', padding: '50px' }}>{error}</div>;
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
        display: 'flex', 
        padding: '20px', 
        gap: '20px', 
        color: 'white',
        minHeight: '100vh',
        background: '#18191a'
      }}>
        
        {/* Cột trái: Video */}
      <div style={{ flex: 3 }}>
        <div style={{ 
          background: 'black', 
          width: '100%', 
          aspectRatio: '16/9',
          position: 'relative',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          {playbackUrl ? (
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
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '16px',
              color: '#b0b3b8'
            }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                border: '4px solid #3a3b3c',
                borderTop: '4px solid #0084ff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <div>Đang tải video...</div>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}
        </div>
        
        <h2 style={{ 
          marginTop: '20px',
          fontSize: '24px',
          fontWeight: '600',
          color: '#e4e6eb'
        }}>{room.title}</h2>
        
        <p style={{ 
          fontSize: '15px',
          color: '#b0b3b8',
          marginTop: '8px'
        }}>
          Host: <span style={{ color: '#e4e6eb', fontWeight: '500' }}>{room.hostId.displayName}</span>
        </p>
        
        {room.description && (
          <p style={{ 
            fontSize: '14px',
            color: '#b0b3b8',
            marginTop: '12px',
            lineHeight: '1.5'
          }}>
            {room.description}
          </p>
        )}
      </div>

      {/* Cột phải: Chat */}
      <div style={{ 
        flex: 1, 
        background: '#242526', 
        padding: '20px', 
        borderRadius: '8px', 
        display: 'flex', 
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 40px)',
        position: 'sticky',
        top: '20px'
      }}>
        <h3 style={{ 
          margin: '0 0 16px 0',
          fontSize: '17px',
          fontWeight: '600',
          color: '#e4e6eb',
          borderBottom: '1px solid #3a3b3c',
          paddingBottom: '12px'
        }}>Bình luận</h3>
        
        <div className="chat-messages" style={{ 
          flex: 1, 
          overflowY: 'auto', 
          marginBottom: '16px', 
          minHeight: '400px'
        }}>
          {messages.length === 0 ? (
            <div style={{ 
              textAlign: 'center',
              color: '#b0b3b8',
              padding: '40px 20px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
              <div style={{ fontSize: '15px' }}>Chưa có bình luận nào</div>
              <div style={{ fontSize: '13px', marginTop: '8px' }}>Hãy là người đầu tiên bình luận!</div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={msg._id || index} style={{ 
                marginBottom: '16px',
                display: 'flex',
                gap: '10px'
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
                    {msg.userId?.displayName || 'User'}
                  </div>
                  <div style={{ 
                    fontSize: '13px',
                    color: msg.deleted ? '#65676b' : '#b0b3b8',
                    wordBreak: 'break-word',
                    fontStyle: msg.deleted ? 'italic' : 'normal'
                  }}>
                    {msg.deleted ? 'Tin nhắn này đã bị gỡ' : msg.message}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <form onSubmit={handleSendChat} style={{ 
          borderTop: '1px solid #3a3b3c',
          paddingTop: '16px'
        }}>
          <input 
            type="text" 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Viết bình luận..."
            style={{ 
              width: '100%', 
              background: '#3a3b3c', 
              color: '#e4e6eb', 
              border: '1px solid #4a4b4c', 
              padding: '10px 12px',
              borderRadius: '20px',
              fontSize: '15px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </form>
      </div>
    </div>
    </>
  );
};

export default LiveViewPage;