// src/pages/liveroom_create/index.js
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { livestreamService } from '../../../services/user/livestreamService';
import {
  initSocket,
  onStreamPreviewReady,
  onStreamPrivacyUpdated,
  offSocketEvents,
  disconnectSocket
} from '../../../services/user/socketService';
import videojs from 'video.js';
import '../../../../node_modules/video.js/dist/video-js.css';
import { Select, Button } from 'antd';
import EmojiPicker from 'emoji-picker-react';
import { useSelector } from 'react-redux';
import { SmileOutlined } from '@ant-design/icons';


const LiveStreamCreate = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [hasTitle, setHasTitle] = useState(false);
  const [isPreviewReady, setIsPreviewReady] = useState(false);

  const [showEditPopup, setShowEditPopup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [privacy, setPrivacy] = useState('public');
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [descriptionText, setDescriptionText] = useState('');
  
  // Video.js refs
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const retryIntervalRef = useRef(null);
  
  useEffect(() => {
    initSocket();

    const fetchRoom = async () => {
      try {
        const roomData = await livestreamService.getLiveStreamById(roomId);
        const currentUserId = user?.user?.id  || user?.user?._id;
        const hostId = roomData.hostId?._id;

        if (hostId !== currentUserId) {
          setError("Bạn không có quyền truy cập vào trang này.");
          setLoading(false);
          return; 
        }
        if (roomData.status === 'live') {
          navigate(`/livestream/live/${roomId}`);
          return;
        }
        if (roomData.status === 'ended') {
          navigate('/');
          return;
        }

        setRoom(roomData);
        setHasTitle(!!roomData.title);
        setIsPreviewReady(roomData.status === 'preview');
        setPrivacy(roomData.privacyType);
        setLoading(false);
      } catch (err) {
        setError('Không tìm thấy phòng live.');
        setLoading(false);
      }
    };

    fetchRoom();

    // Lắng nghe tín hiệu OBS từ NMS
    onStreamPreviewReady((roomDataFromServer) => {
      console.log('[Socket] Tín hiệu OBS đã sẵn sàng!', roomDataFromServer);
      setIsPreviewReady(true);
      setRoom(roomDataFromServer);
      setPrivacy(roomDataFromServer.privacyType);
    });

    onStreamPrivacyUpdated((data) => {
      console.log('[Socket] Cập nhật privacy:', data.privacyType);
      setPrivacy(data.privacyType);
      setRoom(prev => prev ? ({ ...prev, privacyType: data.privacyType }) : null);
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

  // Initialize Video.js player when preview is ready
  useEffect(() => {
    if (isPreviewReady && room?.playbackUrls?.hls && videoRef.current && !playerRef.current) {
      const player = videojs(videoRef.current, {
        autoplay: true,
        muted: true,
        controls: true,
        fluid: false,
        fill: true,
        liveui: true,
        html5: {
          vhs: {
            enableLowInitialPlaylist: true,
            smoothQualityChange: true,
            overrideNative: true
          },
          nativeAudioTracks: false,
          nativeVideoTracks: false
        }
      });

      player.src({
        src: room.playbackUrls.hls,
        type: 'application/x-mpegURL'
      });

      playerRef.current = player;

      player.on('error', () => {
        console.error('Video.js error:', player.error());
      });
    }

    return () => {
      if (playerRef.current && !isPreviewReady) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [isPreviewReady, room]);

  const handlePrivacyChange = async (newPrivacy) => {
    setIsUpdatingPrivacy(true);
    try {
      await livestreamService.updatePrivacy(roomId, newPrivacy);
      setPrivacy(newPrivacy);
    } catch (err) {
      console.error('Lỗi đổi privacy:', err);
      setPrivacy(room.privacyType);
    } finally {
      setIsUpdatingPrivacy(false);
    }
  };

  const handleUpdateDetails = async ({ title, description }) => {
    setIsSubmitting(true);
    try {
      const { details } = await livestreamService.updateLiveStreamDetails(roomId, { title, description });
      setRoom(prev => ({ ...prev, title: details.title, description: details.description }));
      setHasTitle(!!details.title);
      setShowEditPopup(false);
    } catch (err) {
      console.error("Lỗi cập nhật:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoLive = async () => {
    if (!hasTitle || !isPreviewReady) {
      alert("Cần có tiêu đề và kết nối OBS để bắt đầu!");
      return;
    }
    setIsSubmitting(true);
    try {
      await livestreamService.goLive(roomId);
      navigate(`/livestream/live/${roomId}`);
    } catch (err) {
      console.error("Lỗi khi Go Live:", err);
      alert(err.response?.data?.message || 'Không thể phát trực tiếp.');
      setIsSubmitting(false);
    }
  };

  const handleOpenEditPopup = () => {
    setDescriptionText(room.description || '');
    setShowEmojiPicker(false);
    setShowEditPopup(true);
  };

  const handleReloadPlayer = () => {
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }
    
    // Re-initialize player
    if (room?.playbackUrls?.hls && videoRef.current) {
      const player = videojs(videoRef.current, {
        autoplay: true,
        muted: true,
        controls: true,
        fluid: false,
        fill: true,
        liveui: true,
        html5: {
          vhs: {
            enableLowInitialPlaylist: true,
            smoothQualityChange: true,
            overrideNative: true
          }
        }
      });

      player.src({
        src: room.playbackUrls.hls,
        type: 'application/x-mpegURL'
      });

      playerRef.current = player;
    }
  };

  if (loading) return <div style={{ color: 'white' }}>Đang tải thông tin phòng...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!room) return null;

  const isGoLiveDisabled = !hasTitle || !isPreviewReady || isSubmitting;
  const previewUrl = room.playbackUrls?.hls;

  return (
    <div style={{ 
      minHeight: '50vh', 
      background: '#18191a', 
      color: 'white',
      padding: '0'
    }}>
      <div style={{ 
        display: 'flex', 
        gap: '0',
        height: 'calc(100vh - 60px)'
      }}>
        {/* Left Panel */}
        <div style={{ 
          width: 'calc(100vw - 80vw)',
          height: '100%',
          background: '#242526',
          borderRight: '1px solid #3a3b3c',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            padding: '16px 24px'
          }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Tạo video trực tiếp</h2>
          </div>
          
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#3a3b3c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}>👤</div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600' }}>
                  {room.hostId?.username || 'Melodyhub'}
                </div>
                <div style={{ fontSize: '13px', color: '#b0b3b8' }}>Người tổ chức</div>
              </div>
            </div>

            {/* Privacy Dropdown */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                fontSize: '13px', 
                color: '#b0b3b8',
                display: 'block',
                marginBottom: '8px'
              }}>
                Quyền riêng tư trực tiếp video
              </label>
              <Select
                value={privacy}
                onChange={handlePrivacyChange}
                loading={isUpdatingPrivacy}
                disabled={isUpdatingPrivacy}
                style={{ width: '100%' }}
                size="large"
              >
                <Select.Option value="public">Công khai</Select.Option>
                <Select.Option value="follow_only">Chỉ người theo dõi</Select.Option>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ 
            marginTop: 'auto',
            padding: '20px',
            display: 'flex',
            gap: '12px'
          }}>
            <button 
              onClick={() => navigate('/')}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: '#3a3b3c',
                border: 'none',
                borderRadius: '6px',
                color: '#e4e6eb',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Quay lại
            </button>
            <button 
              onClick={handleGoLive}
              disabled={isGoLiveDisabled}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: isGoLiveDisabled ? '#4a4a4a' : '#e4e6eb',
                border: 'none',
                borderRadius: '6px',
                color: isGoLiveDisabled ? '#6a6a6a' : '#000',
                fontSize: '15px',
                fontWeight: '600',
                cursor: isGoLiveDisabled ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? 'Đang xử lý...' : 'Phát trực tiếp'}
            </button>
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ 
          flex: 1,
          background: '#18191a',
          overflowY: 'auto',
          padding: '20px'
        }}>
          {/* Video Preview */}
          <div style={{ 
            background: '#8b9298',
            borderRadius: '8px',
            width: '85%',
            minWidth: '200px',
            aspectRatio: '16/9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {!isPreviewReady ? (
              <div style={{ textAlign: 'center', color: '#242526' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔹</div>
                <p style={{ margin: 0, fontSize: '15px' }}>Đang chờ tín hiệu từ OBS...</p>
              </div>
            ) : previewUrl ? (
              <div data-vjs-player style={{ width: '100%', height: '100%' }}>
                <video
                  ref={videoRef}
                  className="video-js vjs-big-play-centered"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#242526' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔹</div>
                <p style={{ margin: 0, fontSize: '15px' }}>Kết nối phần mềm phát trực tiếp để tăng sáng</p>
              </div>
            )}
          </div>

          {!isPreviewReady && (
            <Button
              onClick={handleReloadPlayer}
              style={{
                marginTop: '12px',
                background: '#3a3b3c',
                color: '#e4e6eb',
                border: 'none'
              }}
            >
              Không thấy video? Tải lại trình phát
            </Button>
          )}

          {/* Bottom Sections */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            {/* Video Source Section */}
            <div style={{ 
              flex: 1,
              background: '#242526',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <div style={{ 
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <div style={{
                  fontSize: '12px',
                  color: '#b0b3b8',
                  marginTop: '4px'
                }}>ⓘ</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ 
                    margin: '0 0 12px 0',
                    fontSize: '17px',
                    fontWeight: '600'
                  }}>Chọn nguồn video</h3>
                  <div style={{
                    background: '#18191a',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      margin: '0 auto 12px',
                      background: '#0084ff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px'
                    }}>✓</div>
                    <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>
                      Phần mềm phát trực tiếp
                    </div>
                    <div style={{ fontSize: '13px', color: '#b0b3b8', lineHeight: '1.5' }}>
                      Các buổi phát trực tiếp xem trước phần mềm phát trực tiếp bạn đang sử dụng.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stream Setup Section */}
            <div style={{ 
              flex: 1,
              background: '#242526',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <h3 style={{ 
                margin: '0 0 12px 0',
                fontSize: '17px',
                fontWeight: '600',
                color: '#e4e6eb'
              }}>Thiết lập phần mềm phát trực tiếp</h3>
              <div style={{ 
                fontSize: '13px',
                color: '#ff6b6b',
                marginBottom: '16px',
                lineHeight: '1.5'
              }}>
                Sao chép và dán khóa luồng này vào phần mềm phát trực tiếp bạn đang sử dụng.
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <label style={{ 
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#e4e6eb',
                  display: 'block',
                  marginBottom: '8px'
                }}>Khóa luồng</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ 
                    flex: 1,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <input 
                      type={showStreamKey ? "text" : "password"}
                      readOnly 
                      value={room.streamKey}
                      style={{ 
                        width: '100%',
                        padding: '8px 40px 8px 12px',
                        background: '#3a3b3c',
                        border: '1px solid #4a4b4c',
                        borderRadius: '6px',
                        color: '#e4e6eb',
                        fontSize: '13px'
                      }} 
                    />
                    <button
                      onClick={() => setShowStreamKey(!showStreamKey)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title={showStreamKey ? "Ẩn khóa" : "Hiện khóa"}
                    >
                      {showStreamKey ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                  <button 
                    onClick={() => navigator.clipboard.writeText(room.streamKey)}
                    style={{
                      padding: '8px 16px',
                      background: '#0084ff',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Sao chép
                  </button>
                </div>
              </div>
              
              <div style={{ fontSize: '12px', color: '#b0b3b8', marginTop: '12px' }}>
                Nhấn không nên chia sẻ khóa này với bất kỳ ai khi chưa bạn muốn cản khác hành xâm nhập vào phát trực tiếp. <a href="#" style={{ color: '#0084ff' }}>Sao thế hơn nếu cần thiết.</a>
              </div>
            </div>
          </div>

          {/* Post Details Section */}
          <div style={{ 
            background: '#242526',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0',
              fontSize: '17px',
              fontWeight: '600'
            }}>Thêm chi tiết về bài viết</h3>
            
            {/* Tiêu đề */}
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ 
                margin: '0 0 5px 0',
                fontSize: '14px',
                fontWeight: '600'
              }}>Tiêu đề</h4>
              <div 
                onClick={handleOpenEditPopup}
                style={{
                  background: '#3a3b3c',
                  borderRadius: '6px',
                  padding: '12px',
                  cursor: 'pointer',
                  border: '1px solid #4a4b4c'
                }}
              >
                <div style={{ 
                  fontSize: '15px',
                  color: room.title ? '#e4e6eb' : '#8b9298'
                }}>
                  {room.title || 'Tiêu đề '}
                </div>
              </div>
            </div>

            {/* Mô tả */}
            <div>
              <h4 style={{ 
                margin: '0 0 5px 0',
                fontSize: '14px',
                fontWeight: '600'
              }}>Mô tả</h4>
              <div 
                onClick={handleOpenEditPopup}
                style={{
                  background: '#3a3b3c',
                  borderRadius: '6px',
                  padding: '12px',
                  cursor: 'pointer',
                  border: '1px solid #4a4b4c',
                  minHeight: '60px'
                }}
              >
                <div style={{ 
                  fontSize: '13px',
                  color: room.description ? '#b0b3b8' : '#8b9298'
                }}>
                  {room.description || 'Mô tả'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Popup */}
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
                  defaultValue={room.title}
                  placeholder="Tiêu đề (bắt buộc)"
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
                      padding: '4px 8px'
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
    </div>
  );
};

export default LiveStreamCreate;