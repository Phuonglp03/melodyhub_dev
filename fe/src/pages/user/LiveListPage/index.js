// src/pages/user/LiveListPage/index.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { livestreamService } from '../../../services/user/livestreamService';
import { Card, Avatar } from 'antd'; 

const { Meta } = Card;

const LiveListPage = () => {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const activeStreams = await livestreamService.getActiveLiveStreams();
        const validStreams = activeStreams.filter(stream => stream.hostId);
        setStreams(validStreams);
      } catch (err) {
        console.error("Lỗi khi tải danh sách stream:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStreams();
  }, []);

  const handleStreamClick = (roomId) => {
    navigate(`/live/${roomId}`);
  };

  if (loading) {
    return <div style={{ color: 'white', padding: '20px' }}>Đang tải danh sách...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ color: 'white' }}>Trực tiếp</h1>
      
      {/* (Đây là UI giả lập, bạn sẽ thay bằng UI grid của mình) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {streams.length === 0 && (
          <p style={{ color: 'gray' }}>Không có ai đang livestream.</p>
        )}
        
        {streams.map((stream) => (
          <Card
            key={stream._id}
            hoverable
            style={{ width: 300, background: '#222', border: 'none' }}
            cover={
              <div style={{ height: 180, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white' }}>LIVE</span>
              </div>
            }
            onClick={() => handleStreamClick(stream._id)}
          >
            <Meta
              avatar={<Avatar src={stream.hostId.avatarUrl || 'default_avatar.png'} />}
              title={<span style={{ color: 'white' }}>{stream.title}</span>}
              description={<span style={{ color: 'gray' }}>{stream.hostId.displayName}</span>}
            />
          </Card>
        ))}
      </div>
    </div>
  );
};

export default LiveListPage;