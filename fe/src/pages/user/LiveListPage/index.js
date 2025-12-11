// src/pages/user/LiveListPage/index.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { livestreamService } from '../../../services/user/livestreamService';
import { Avatar, Button, Spin, Tooltip } from 'antd';
import { 
  ReloadOutlined, 
  UserOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  PlayCircleFilled,
  HeartFilled,
  GlobalOutlined,
  LockOutlined
} from '@ant-design/icons';
import { normalizeAvatarUrl } from '../../../utils/userConstants';

const LiveListPage = () => {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const currentUserId = user?.user?.id || user?.user?._id;

  const fetchStreams = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const activeStreams = await livestreamService.getActiveLiveStreams();
      const validStreams = activeStreams.filter(stream => stream.hostId);
      setStreams(validStreams);
    } catch (err) {
      console.error("Lỗi khi tải danh sách stream:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStreams();
    
    // Auto refresh mỗi 30 giây
    const interval = setInterval(() => {
      fetchStreams(false);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchStreams]);

  // Lọc và sắp xếp streams
  const filteredAndSortedStreams = useMemo(() => {
    // Bước 1: Lọc bỏ streams follow_only mà user không follow
    const filtered = streams.filter(stream => {
      // Stream public thì ai cũng xem được
      if (stream.privacyType === 'public') return true;
      
      // Stream follow_only
      if (stream.privacyType === 'follow_only') {
        // Nếu chưa đăng nhập thì không hiện
        if (!currentUserId) return false;
        
        // Nếu là chủ stream thì hiện
        if (stream.hostId?._id === currentUserId) return true;
        
        // Nếu đang follow host thì hiện (backend trả về isFollowing)
        if (stream.isFollowing) return true;
        
        // Không follow thì ẩn
        return false;
      }
      
      // Mặc định hiện
      return true;
    });

    // Bước 2: Sắp xếp - người đang follow lên đầu
    const sorted = [...filtered].sort((a, b) => {
      // Ưu tiên streams từ người đang follow
      const aFollowing = a.isFollowing ? 1 : 0;
      const bFollowing = b.isFollowing ? 1 : 0;
      
      if (bFollowing !== aFollowing) {
        return bFollowing - aFollowing; // Following lên đầu
      }
      
      // Nếu cùng trạng thái follow, sắp xếp theo số người xem
      return (b.currentViewers || 0) - (a.currentViewers || 0);
    });

    return sorted;
  }, [streams, currentUserId]);

  const handleStreamClick = (roomId) => {
    navigate(`/live/${roomId}`);
  };

  const formatDuration = (startedAt) => {
    if (!startedAt) return '';
    const start = new Date(startedAt);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000);
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatViewers = (count) => {
    if (!count) return '0';
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Đếm số streams từ người đang follow
  const followingStreamsCount = useMemo(() => {
    return filteredAndSortedStreams.filter(s => s.isFollowing).length;
  }, [filteredAndSortedStreams]);

  return (
    <div style={{ 
      minHeight: 'calc(100vh - 72px)',
      background: 'linear-gradient(180deg, #0f0f0f 0%, #1a1a2e 100%)',
      padding: '24px',
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '32px',
        maxWidth: '1400px',
        margin: '0 auto 32px auto'
      }}>
        <div>
          <h1 style={{ 
            color: '#fff', 
            margin: 0, 
            fontSize: '28px', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{
              width: '12px',
              height: '12px',
              background: '#ff4d4d',
              borderRadius: '50%',
              animation: 'pulse 2s infinite',
              boxShadow: '0 0 0 0 rgba(255, 77, 77, 0.7)'
            }} />
            Đang phát trực tiếp
          </h1>
          <p style={{ color: '#adadb8', margin: '8px 0 0 0', fontSize: '14px' }}>
            {filteredAndSortedStreams.length} kênh đang livestream
            {followingStreamsCount > 0 && (
              <span style={{ color: '#9147ff', marginLeft: '8px' }}>
                • {followingStreamsCount} từ người bạn theo dõi
              </span>
            )}
          </p>
        </div>
        
        <Tooltip title="Làm mới">
          <Button 
            icon={<ReloadOutlined spin={refreshing} />} 
            onClick={() => fetchStreams(true)}
            style={{ 
              background: '#2f2f35', 
              border: 'none', 
              color: '#fff',
              height: '40px',
              width: '40px'
            }}
          />
        </Tooltip>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '400px' 
          }}>
            <Spin size="large" />
          </div>
        ) : filteredAndSortedStreams.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '400px',
            background: '#18181b',
            borderRadius: '16px',
            padding: '48px'
          }}>
            <div style={{
              width: '120px',
              height: '120px',
              background: 'linear-gradient(135deg, #9147ff 0%, #772ce8 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px'
            }}>
              <PlayCircleFilled style={{ fontSize: '48px', color: '#fff' }} />
            </div>
            <h3 style={{ color: '#fff', fontSize: '20px', margin: '0 0 8px 0' }}>
              Chưa có ai đang livestream
            </h3>
            <p style={{ color: '#adadb8', margin: 0, textAlign: 'center' }}>
              Hãy quay lại sau để xem các buổi phát trực tiếp mới!
            </p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
            gap: '20px' 
          }}>
            {filteredAndSortedStreams.map((stream) => (
              <div
                key={stream._id}
                onClick={() => handleStreamClick(stream._id)}
                style={{
                  background: '#18181b',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  border: stream.isFollowing ? '2px solid #9147ff' : '2px solid transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(145, 71, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Thumbnail */}
                <div style={{ 
                  position: 'relative',
                  paddingTop: '56.25%', // 16:9
                  background: 'linear-gradient(135deg, #2f2f35 0%, #1f1f23 100%)'
                }}>
                  {/* Stream thumbnail hoặc placeholder */}
                  {stream.thumbnailUrl ? (
                    <img 
                      src={stream.thumbnailUrl} 
                      alt={stream.title}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(135deg, 
                        hsl(${(stream._id.charCodeAt(0) * 10) % 360}, 70%, 25%) 0%, 
                        hsl(${(stream._id.charCodeAt(1) * 10) % 360}, 70%, 15%) 100%)`
                    }}>
                      <PlayCircleFilled style={{ fontSize: '48px', color: 'rgba(255,255,255,0.3)' }} />
                    </div>
                  )}
                  
                  {/* Following badge */}
                  {stream.isFollowing && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: '#9147ff',
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <HeartFilled style={{ fontSize: '10px' }} />
                      Đang theo dõi
                    </div>
                  )}
                  
                  {/* LIVE badge */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: '#e91916',
                    color: '#fff',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      background: '#fff',
                      borderRadius: '50%',
                      animation: 'pulse 1.5s infinite'
                    }} />
                    LIVE
                  </div>
                  
                  {/* Viewer count */}
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px',
                    background: 'rgba(0,0,0,0.75)',
                    color: '#fff',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <EyeOutlined />
                    {formatViewers(stream.currentViewers || 0)} người xem
                  </div>
                  
                  {/* Duration */}
                  {stream.startedAt && (
                    <div style={{
                      position: 'absolute',
                      bottom: '12px',
                      right: '12px',
                      background: 'rgba(0,0,0,0.75)',
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <ClockCircleOutlined />
                      {formatDuration(stream.startedAt)}
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Avatar 
                      src={normalizeAvatarUrl(stream?.hostId?.avatarUrl)}
                      icon={<UserOutlined />}
                      size={44}
                      style={{ 
                        border: stream.isFollowing ? '2px solid #9147ff' : '2px solid #2f2f35',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <h3 style={{ 
                        color: '#fff', 
                        margin: '0 0 4px 0', 
                        fontSize: '15px',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {stream.title || 'Livestream'}
                      </h3>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        marginBottom: '2px'
                      }}>
                        <span style={{ 
                          color: stream.isFollowing ? '#9147ff' : '#adadb8', 
                          fontSize: '13px',
                          fontWeight: stream.isFollowing ? '600' : '400',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {stream.hostId?.displayName || 'Unknown'}
                        </span>
                        {/* Privacy badge */}
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '600',
                          background: stream.privacyType === 'follow_only' ? 'rgba(145, 71, 255, 0.2)' : 'rgba(0, 200, 83, 0.2)',
                          color: stream.privacyType === 'follow_only' ? '#bf94ff' : '#00c853'
                        }}>
                          {stream.privacyType === 'follow_only' ? (
                            <><LockOutlined style={{ fontSize: '9px' }} /> Follower</>
                          ) : (
                            <><GlobalOutlined style={{ fontSize: '9px' }} /> Công khai</>
                          )}
                        </span>
                      </div>
                      {stream.description && (
                        <p style={{ 
                          color: '#7a7a7a', 
                          margin: '2px 0 0 0', 
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {stream.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(255, 77, 77, 0.7);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(255, 77, 77, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(255, 77, 77, 0);
          }
        }
      `}</style>
    </div>
  );
};

export default LiveListPage;
