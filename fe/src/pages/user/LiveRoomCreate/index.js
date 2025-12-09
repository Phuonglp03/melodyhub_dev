// src/pages/liveroom_create/index.js
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { livestreamService } from '../../../services/user/livestreamService';
import {
  initSocket,
  joinRoom,
  onStreamPreviewReady,
  onStreamPrivacyUpdated,
  offSocketEvents,
  disconnectSocket
} from '../../../services/user/socketService';
import videojs from 'video.js';
import '../../../../node_modules/video.js/dist/video-js.css';
import { 
  Button, Input, Select, Form, Card, Typography, 
  Alert, Spin, Modal, Tooltip, message 
} from 'antd';
import { 
  CopyOutlined, EyeOutlined, EyeInvisibleOutlined, 
  VideoCameraOutlined, SettingOutlined, ArrowLeftOutlined,
  ReloadOutlined, WifiOutlined
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import LiveVideo from '../../../components/LiveVideo';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const LiveStreamCreate = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  // State
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Ban status
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState(null);
  
  // Edit Form
  const [form] = Form.useForm();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  // Keys Visibility
  const [showStreamKey, setShowStreamKey] = useState(false);
  
  // Check connection
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

  // Video Refs - dùng container ref để tránh conflict giữa React và Video.js
  const videoContainerRef = useRef(null);
  const playerRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  // --- INIT & SOCKET ---
  useEffect(() => {
    initSocket();

    const fetchRoom = async () => {
      try {
        // Kiểm tra ban status trước
        const banStatus = await livestreamService.checkLivestreamBanStatus();
        if (banStatus.banned) {
          setIsBanned(true);
          setBanInfo({
            bannedAt: banStatus.bannedAt,
            reason: banStatus.reason
          });
          setLoading(false);
          return;
        }

        const roomData = await livestreamService.getLiveStreamById(roomId);
        const currentUserId = user?.user?.id || user?.user?._id;
        
        if (roomData.hostId?._id !== currentUserId) {
          setError("Bạn không có quyền truy cập trang này.");
          setLoading(false); return;
        }
        if (roomData.status === 'live') {
          navigate(`/livestream/live/${roomId}`); return;
        }

        setRoom(roomData);
        setIsPreviewReady(roomData.status === 'preview');
        
        // Pre-fill form
        form.setFieldsValue({
          title: roomData.title,
          description: roomData.description,
          privacyType: roomData.privacyType
        });
        
        setLoading(false);
        
        // Join socket room để nhận events (stream-preview-ready, etc.)
        joinRoom(roomId);
      } catch (err) {
        // Kiểm tra nếu lỗi là bị ban
        if (err.response?.data?.banned) {
          setIsBanned(true);
          setBanInfo({
            bannedAt: err.response.data.bannedAt,
            reason: err.response.data.reason
          });
          setLoading(false);
          return;
        }
        setError('Không thể tải thông tin phòng.');
        setLoading(false);
      }
    };

    fetchRoom();

    // Socket Listeners
    onStreamPreviewReady((data) => {
      message.success('Đã nhận tín hiệu từ OBS!');
      setIsPreviewReady(true);
      setRoom(data);
    });

    onStreamPrivacyUpdated((data) => {
      setRoom(prev => ({ ...prev, privacyType: data.privacyType }));
      form.setFieldsValue({ privacyType: data.privacyType });
    });

    return () => {
      offSocketEvents();
      disconnectSocket();
      // Player được cleanup ở VIDEO PLAYER useEffect
    };
  }, [roomId, navigate, user, form]);

  // --- VIDEO PLAYER với auto-retry khi OBS kết nối ---
  // Dùng container ref để tránh conflict giữa React DOM và Video.js DOM
  useEffect(() => {
    // Cleanup function - dispose player và xóa video element khỏi container
    const cleanupPlayer = () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (playerRef.current) {
        try {
          if (!playerRef.current.isDisposed()) {
            playerRef.current.dispose();
          }
        } catch (e) {
          console.error('[Video.js] Dispose error:', e);
        }
        playerRef.current = null;
      }
      // Xóa tất cả children khỏi container (Video.js tạo ra)
      if (videoContainerRef.current) {
        videoContainerRef.current.innerHTML = '';
      }
    };

    const initializePlayer = (retryCount = 0) => {
      const maxRetries = 5;
      const hlsUrl = room?.playbackUrls?.hls;

      if (!isPreviewReady || !hlsUrl || !videoContainerRef.current) {
        return;
      }

      // Nếu đã có player và đang hoạt động, không cần khởi tạo lại
      if (playerRef.current && !playerRef.current.isDisposed()) {
        return;
      }

      try {
        console.log(`[Preview] Khởi tạo video player... (attempt ${retryCount + 1})`);
        
        // Xóa nội dung cũ trong container
        videoContainerRef.current.innerHTML = '';
        
        // Tạo video element bằng JavaScript (không dùng JSX)
        const videoElement = document.createElement('video');
        videoElement.className = 'video-js vjs-big-play-centered vjs-16-9';
        videoElement.setAttribute('playsInline', '');
        videoElement.muted = true;
        videoContainerRef.current.appendChild(videoElement);
        
        const player = videojs(videoElement, {
          autoplay: true,
          muted: true,
          controls: true,
          fluid: true,
          liveui: true,
          liveTracker: {
            trackingThreshold: 15,
            liveTolerance: 10,
          },
          html5: {
            vhs: {
              enableLowInitialPlaylist: true,
              smoothQualityChange: true,
              overrideNative: true,
              liveSyncDurationCount: 3,
              playlistRetryCount: 3,
              playlistRetryDelay: 500,
            }
          }
        });

        player.src({ src: hlsUrl, type: 'application/x-mpegURL' });

        player.ready(() => {
          if (player && !player.isDisposed()) {
            player.play().catch(() => {
              if (player && !player.isDisposed()) {
                player.muted(true);
                player.play().catch(() => {});
              }
            });
          }
        });

        // Xử lý lỗi - retry nếu chưa đủ số lần
        player.on('error', () => {
          const err = player.error();
          console.warn('[Preview] VideoJS Error:', err);

          if (retryCount < maxRetries && err && (err.code === 2 || err.code === 3 || err.code === 4)) {
            console.log(`[Preview] Đang thử kết nối lại... (${retryCount + 1}/${maxRetries})`);
            
            cleanupPlayer();

            retryTimeoutRef.current = setTimeout(() => {
              initializePlayer(retryCount + 1);
            }, 2000);
          }
        });

        playerRef.current = player;
        console.log('[Preview] Video player đã khởi tạo thành công');

      } catch (error) {
        console.error('[Preview] Initialization error:', error);
        
        if (retryCount < maxRetries) {
          retryTimeoutRef.current = setTimeout(() => {
            initializePlayer(retryCount + 1);
          }, 2000);
        }
      }
    };

    // Khi isPreviewReady chuyển từ false -> true, đợi một chút rồi khởi tạo player
    if (isPreviewReady && room?.playbackUrls?.hls) {
      retryTimeoutRef.current = setTimeout(() => {
        initializePlayer(0);
      }, 500);
    }

    return cleanupPlayer;
  }, [isPreviewReady, room?.playbackUrls?.hls]);

  // --- HANDLERS ---
  const handleUpdateInfo = async (values) => {
    setIsSubmitting(true);
    try {
      const { details } = await livestreamService.updateLiveStreamDetails(roomId, {
        title: values.title,
        description: values.description
      });
      
      if (values.privacyType !== room.privacyType) {
        await livestreamService.updatePrivacy(roomId, values.privacyType);
      }

      setRoom(prev => ({ 
        ...prev, 
        title: details.title, 
        description: details.description,
        privacyType: values.privacyType
      }));
      
      message.success('Cập nhật thông tin thành công');
      setIsEditModalVisible(false);
    } catch (err) {
      message.error('Lỗi cập nhật thông tin');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoLive = async () => {
    if (!room.title) {
      return message.warning('Vui lòng nhập tiêu đề trước khi phát live.');
    }
    if (!isPreviewReady) {
      return message.warning('Chưa nhận được tín hiệu từ OBS.');
    }

    setIsSubmitting(true);
    try {
      await livestreamService.goLive(roomId);
      message.success('Đang phát trực tiếp!');
      navigate(`/livestream/live/${roomId}`);
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể phát trực tiếp.');
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    message.success(`Đã sao chép ${label}`);
  };

  // Hàm cleanup player an toàn
  const cleanupPlayerSafe = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (playerRef.current) {
      try {
        if (!playerRef.current.isDisposed()) {
          playerRef.current.dispose();
        }
      } catch (e) {}
      playerRef.current = null;
    }
    if (videoContainerRef.current) {
      videoContainerRef.current.innerHTML = '';
    }
  };

  // Kiểm tra kết nối OBS thủ công
  const handleCheckConnection = async () => {
    if (isCheckingConnection) return;
    
    setIsCheckingConnection(true);
    try {
      cleanupPlayerSafe();
      
      const roomData = await livestreamService.getLiveStreamById(roomId);
      
      if (roomData.status === 'preview' || roomData.status === 'live') {
        message.success('Đã phát hiện tín hiệu từ OBS!');
        setRoom(roomData);
        setIsPreviewReady(true);
      } else {
        message.warning('Chưa phát hiện tín hiệu từ OBS. Hãy đảm bảo OBS đang stream.');
      }
    } catch (err) {
      message.error('Lỗi kiểm tra kết nối');
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Reload video preview - chỉ reload source, không destroy player
  const handleReloadPreview = () => {
    if (isCheckingConnection) return;
    
    const hlsUrl = room?.playbackUrls?.hls;
    
    if (playerRef.current && !playerRef.current.isDisposed() && hlsUrl) {
      message.info('Đang tải lại preview...');
      
      try {
        // Chỉ reload source trên player hiện tại
        playerRef.current.src({ src: hlsUrl, type: 'application/x-mpegURL' });
        playerRef.current.load();
        playerRef.current.play().catch(() => {
          if (playerRef.current && !playerRef.current.isDisposed()) {
            playerRef.current.muted(true);
            playerRef.current.play().catch(() => {});
          }
        });
        message.success('Đã tải lại preview!');
      } catch (error) {
        console.error('[Preview] Reload error:', error);
        message.error('Lỗi tải lại preview');
      }
    } else {
      message.warning('Không có player để tải lại');
    }
  };

  if (loading) return <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#141414'}}><Spin size="large" /></div>;
  if (error) return <div style={{padding:'50px', textAlign:'center', color:'red'}}>{error}</div>;
  
  // Hiển thị nếu user bị cấm livestream
  if (isBanned) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#141414', 
        color: '#fff', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '20px'
      }}>
        <Card 
          style={{ 
            maxWidth: '500px', 
            width: '100%', 
            background: '#1f1f1f', 
            border: '1px solid #ff4d4f',
            borderRadius: '12px'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: '50%', 
              background: 'rgba(255, 77, 79, 0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <VideoCameraOutlined style={{ fontSize: '40px', color: '#ff4d4f' }} />
            </div>
            
            <Title level={3} style={{ color: '#ff4d4f', margin: '0 0 16px 0' }}>
              Tài khoản bị cấm Livestream
            </Title>
            
            <Paragraph style={{ color: '#adadb8', marginBottom: '16px' }}>
              Bạn đã bị cấm phát livestream do vi phạm quy định cộng đồng.
            </Paragraph>
            
            {banInfo?.reason && (
              <Alert
                message="Lý do"
                description={banInfo.reason}
                type="error"
                showIcon={false}
                style={{ 
                  marginBottom: '16px', 
                  background: 'rgba(255, 77, 79, 0.1)', 
                  border: '1px solid rgba(255, 77, 79, 0.3)',
                  textAlign: 'left'
                }}
              />
            )}
            
            {banInfo?.bannedAt && (
              <Text type="secondary" style={{ display: 'block', marginBottom: '20px' }}>
                Thời gian: {new Date(banInfo.bannedAt).toLocaleString('vi-VN')}
              </Text>
            )}
            
            <Paragraph style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>
              Nếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ bộ phận hỗ trợ.
            </Paragraph>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <Button onClick={() => navigate('/')}>
                Về trang chủ
              </Button>
              <Button type="primary" onClick={() => navigate('/support')}>
                Liên hệ hỗ trợ
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#141414', color: '#fff', padding: '20px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Button icon={<ArrowLeftOutlined />} type="text" style={{color:'white'}} onClick={() => navigate('/')} />
          <Title level={3} style={{ color: '#fff', margin: 0 }}>Thiết lập Livestream</Title>
        </div>
        
        {/* ✅ FIX: Thêm alignItems: 'center' và size="large" cho nút chỉnh sửa */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Button 
            size="large" 
            onClick={() => setIsEditModalVisible(true)} 
            icon={<SettingOutlined />}
          >
            Chỉnh sửa thông tin
          </Button>
          <Button 
            type="primary" 
            size="large"
            danger={isPreviewReady} // Red if ready, blue if not
            disabled={!isPreviewReady || !room.title}
            onClick={handleGoLive}
            loading={isSubmitting}
          >
            {isPreviewReady ? 'PHÁT TRỰC TIẾP' : 'ĐANG CHỜ OBS...'}
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* LEFT: PREVIEW */}
        <div style={{ flex: 2, minWidth: '300px' }}>
          <Card 
            bordered={false} 
            style={{ background: '#1f1f1f', borderRadius: '8px' }}
            bodyStyle={{ padding: 0 }}
          >
            <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
              {/* Video Container - LUÔN MOUNT, chỉ show/hide bằng CSS */}
              <div 
                ref={videoContainerRef} 
                data-vjs-player 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%',
                  display: isPreviewReady ? 'block' : 'none'
                }}
              />
              
              {/* Nút reload preview - hiện khi có preview */}
              {isPreviewReady && (
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleReloadPreview}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    zIndex: 10,
                    background: 'rgba(0,0,0,0.6)',
                    border: 'none',
                    color: '#fff'
                  }}
                >
                  Tải lại
                </Button>
              )}
              
              {/* Placeholder khi chưa có preview */}
              {!isPreviewReady && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#666' }}>
                  <VideoCameraOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                  <Text style={{ color: '#888', marginBottom: '16px' }}>Kết nối phần mềm phát trực tiếp (OBS) để xem trước</Text>
                  <Button
                    type="primary"
                    icon={<WifiOutlined />}
                    onClick={handleCheckConnection}
                    loading={isCheckingConnection}
                    size="large"
                  >
                    Kiểm tra kết nối OBS
                  </Button>
                </div>
              )}
            </div>
            <div style={{ padding: '20px' }}>
              <Title level={4} style={{ color: '#fff', margin: 0 }}>{room.title || 'Chưa có tiêu đề'}</Title>
              <Text style={{ color: '#888' }}>{room.description || 'Chưa có mô tả'}</Text>
              <div style={{ marginTop: '12px' }}>
                <Text style={{ color: '#888' }}>Quyền riêng tư: </Text>
                <Text strong style={{ color: '#fff' }}>{room.privacyType === 'public' ? 'Công khai' : 'Người theo dõi'}</Text>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT: SETTINGS */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          <Card title={<span style={{color:'white'}}>Cài đặt Stream</span>} bordered={false} style={{ background: '#1f1f1f', color: '#fff' }} headStyle={{borderBottom:'1px solid #303030'}}>
            
            <Alert 
              message="Bảo mật" 
              description="Không chia sẻ Khóa luồng (Stream Key) cho bất kỳ ai." 
              type="warning" 
              showIcon 
              style={{ marginBottom: '20px', background: '#2b2111', border: '1px solid #443b24', color: '#d4b106' }}
            />

            <div style={{ marginBottom: '20px' }}>
              <Text style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>URL Máy chủ (Server)</Text>
              <Input.Group compact>
                <Input 
                  style={{ width: 'calc(100% - 80px)', background: '#141414', color: '#fff', border: '1px solid #303030' }} 
                  value={room.rtmpUrl} 
                  readOnly 
                />
                <Button 
                  type="primary" 
                  icon={<CopyOutlined />} 
                  onClick={() => copyToClipboard(room.rtmpUrl, 'URL')}
                >
                  Sao chép
                </Button>
              </Input.Group>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <Text style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Khóa luồng (Stream Key)</Text>
              <Input.Group compact>
                <Input.Password 
                  style={{ width: 'calc(100% - 80px)', background: '#141414', color: '#fff', border: '1px solid #303030' }} 
                  value={room.streamKey} 
                  readOnly 
                  visibilityToggle={{ visible: showStreamKey, onVisibleChange: setShowStreamKey }}
                />
                <Button 
                  type="primary" 
                  icon={<CopyOutlined />} 
                  onClick={() => copyToClipboard(room.streamKey, 'Stream Key')}
                >
                  Sao chép
                </Button>
              </Input.Group>
            </div>

            <div style={{ marginTop: '30px', borderTop: '1px solid #303030', paddingTop: '20px' }}>
              <Text strong style={{ color: '#fff' }}>Hướng dẫn OBS:</Text>
              <ol style={{ color: '#888', paddingLeft: '20px', marginTop: '10px' }}>
                <li>Mở <b>OBS Studio</b> &rarr; Settings &rarr; Stream</li>
                <li>Service: chọn <b>Custom...</b></li>
                <li>Server: Dán <b>URL Máy chủ</b> ở trên</li>
                <li>Stream Key: Dán <b>Khóa luồng</b> ở trên</li>
                <li>Nhấn <b>Start Streaming</b></li>
              </ol>
            </div>

          </Card>
        </div>
      </div>

      {/* MODAL EDIT */}
      <Modal
        title="Chỉnh sửa thông tin"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleUpdateInfo}>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}>
            <Input placeholder="Nhập tiêu đề livestream" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <TextArea rows={4} placeholder="Mô tả nội dung..." />
          </Form.Item>
          <Form.Item name="privacyType" label="Quyền riêng tư">
            <Select>
              <Option value="public">Công khai</Option>
              <Option value="follow_only">Chỉ người theo dõi</Option>
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button onClick={() => setIsEditModalVisible(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={isSubmitting}>Lưu thay đổi</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default LiveStreamCreate;