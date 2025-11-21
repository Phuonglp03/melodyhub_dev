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
import { 
  Button, Input, Select, Form, Card, Typography, 
  Alert, Spin, Modal, Tooltip, message 
} from 'antd';
import { 
  CopyOutlined, EyeOutlined, EyeInvisibleOutlined, 
  VideoCameraOutlined, SettingOutlined, ArrowLeftOutlined 
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
  
  // Edit Form
  const [form] = Form.useForm();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  // Keys Visibility
  const [showStreamKey, setShowStreamKey] = useState(false);

  // Video Refs
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  // --- INIT & SOCKET ---
  useEffect(() => {
    initSocket();

    const fetchRoom = async () => {
      try {
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
      } catch (err) {
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
      if (playerRef.current) playerRef.current.dispose();
    };
  }, [roomId, navigate, user, form]);

  // --- VIDEO PLAYER ---
  useEffect(() => {
    if (isPreviewReady && room?.playbackUrls?.hls && videoRef.current && !playerRef.current) {
      const player = videojs(videoRef.current, {
        autoplay: true,
        muted: true,
        controls: true,
        fluid: true,
        liveui: true,
        html5: {
          vhs: {
            enableLowInitialPlaylist: true,
            smoothQualityChange: true,
            overrideNative: true,
            liveSyncDurationCount: 3,
          }
        }
      });
      player.src({ src: room.playbackUrls.hls, type: 'application/x-mpegURL' });
      playerRef.current = player;
    }
  }, [isPreviewReady, room]);

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

  if (loading) return <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#141414'}}><Spin size="large" /></div>;
  if (error) return <div style={{padding:'50px', textAlign:'center', color:'red'}}>{error}</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#141414', color: '#fff', padding: '20px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Button icon={<ArrowLeftOutlined />} type="text" style={{color:'white'}} onClick={() => navigate('/')} />
          <Title level={3} style={{ color: '#fff', margin: 0 }}>Thiết lập Livestream</Title>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button onClick={() => setIsEditModalVisible(true)} icon={<SettingOutlined />}>
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
              {isPreviewReady ? (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                  <div data-vjs-player style={{ width: '100%', height: '100%' }}>
                    <video ref={videoRef} className="video-js vjs-big-play-centered vjs-16-9" playsInline muted />
                  </div>
                </div>
              ) : (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#666' }}>
                  <VideoCameraOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                  <Text style={{ color: '#888' }}>Kết nối phần mềm phát trực tiếp (OBS) để xem trước</Text>
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