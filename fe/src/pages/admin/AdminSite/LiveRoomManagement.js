import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Video, Clock, Users, Ban, StopCircle, Eye, Calendar, Shield, AlertTriangle, RefreshCw, ExternalLink, CheckCircle, XCircle, Flag, UserX, UserCheck, User, X, Wifi } from 'lucide-react';
import { livestreamAdminService } from '../../../services/admin/livestreamAdminService';
import videojs from 'video.js';
import '../../../../node_modules/video.js/dist/video-js.css';
import LiveVideo from '../../../components/LiveVideo';
import {
  initSocket,
  getSocket,
  onStreamStarted,
  offStreamStarted,
  onGlobalStreamEnded,
  offGlobalStreamEnded,
  onNewLivestreamReport,
  offNewLivestreamReport
} from '../../../services/user/socketService';

const LiveRoomManagement = () => {
  const [activeTab, setActiveTab] = useState('live');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  
  // Data states
  const [activeLivestreams, setActiveLivestreams] = useState([]);
  const [reports, setReports] = useState([]);
  const [bannedUsers, setBannedUsers] = useState([]);
  const [reportFilter, setReportFilter] = useState('pending');
  
  // Ban modal state
  const [showBanModal, setShowBanModal] = useState(false);
  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState('Vi phạm quy định cộng đồng');
  const [customBanReason, setCustomBanReason] = useState('');

  // Live stream modal state
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [liveModalRoom, setLiveModalRoom] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState(null);
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  
  // Socket connection status
  const [socketConnected, setSocketConnected] = useState(false);

  // Fetch active livestreams (all rooms with status 'live')
  const fetchActiveLivestreams = useCallback(async () => {
    try {
      const result = await livestreamAdminService.getActiveLivestreams();
      setActiveLivestreams(result.data || []);
    } catch (error) {
      console.error('Error fetching active livestreams:', error);
      setActiveLivestreams([]);
    }
  }, []);

  // Fetch reports (includes room info)
  const fetchReports = useCallback(async () => {
    try {
      const result = await livestreamAdminService.getLivestreamReports({ 
        status: reportFilter === 'all' ? undefined : reportFilter 
      });
      setReports(result.data?.reports || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
    }
  }, [reportFilter]);

  // Fetch banned users
  const fetchBannedUsers = useCallback(async () => {
    try {
      const result = await livestreamAdminService.getBannedLivestreamUsers();
      setBannedUsers(result.data?.users || []);
    } catch (error) {
      console.error('Error fetching banned users:', error);
      setBannedUsers([]);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchActiveLivestreams(), fetchReports(), fetchBannedUsers()]);
      setLoading(false);
    };
    loadData();
  }, [fetchActiveLivestreams, fetchReports, fetchBannedUsers]);

  // Socket connection for real-time updates
  useEffect(() => {
    // Initialize socket
    initSocket();
    
    // Check socket connection
    const socket = getSocket();
    if (socket) {
      setSocketConnected(socket.connected);
      
      socket.on('connect', () => {
        setSocketConnected(true);
      });
      
      socket.on('disconnect', () => {
        setSocketConnected(false);
      });
    }

    // Handler when new livestream starts
    const handleStreamStarted = (newRoom) => {
      setActiveLivestreams(prev => {
        // Check if already exists
        const exists = prev.some(r => r._id === newRoom._id);
        if (exists) {
          // Update existing
          return prev.map(r => r._id === newRoom._id ? { ...r, ...newRoom, currentViewers: 0 } : r);
        }
        // Add new stream to beginning
        return [{ ...newRoom, currentViewers: 0 }, ...prev];
      });
    };

    // Handler when livestream ends
    const handleStreamEnded = (data) => {
      const { roomId } = data;
      // Remove from active livestreams
      setActiveLivestreams(prev => prev.filter(r => r._id !== roomId));
    };

    // Handler when new livestream report is created
    const handleNewLivestreamReport = (data) => {
      const { report } = data;
      
      // Add to reports list if not already exists
      setReports(prev => {
        const exists = prev.some(r => r._id === report._id);
        if (exists) return prev;
        // Add to beginning of list
        return [report, ...prev];
      });
    };

    // Register event listeners
    onStreamStarted(handleStreamStarted);
    onGlobalStreamEnded(handleStreamEnded);
    onNewLivestreamReport(handleNewLivestreamReport);

    // Cleanup
    return () => {
      offStreamStarted(handleStreamStarted);
      offGlobalStreamEnded(handleStreamEnded);
      offNewLivestreamReport(handleNewLivestreamReport);
      
      if (socket) {
        socket.off('connect');
        socket.off('disconnect');
      }
    };
  }, []);

  // Refresh data
  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([fetchActiveLivestreams(), fetchReports(), fetchBannedUsers()]);
    setLoading(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTimeDiff = (startTime) => {
    if (!startTime) return '0m';
    const diff = Date.now() - new Date(startTime).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const openBanModal = (room) => {
    setBanTarget(room);
    setBanReason('Vi phạm quy định cộng đồng');
    setCustomBanReason('');
    setShowBanModal(true);
  };

  const handleBan = async () => {
    if (!banTarget) return;
    
    // Lấy lý do cuối cùng
    const finalReason = banReason === 'Khác' ? customBanReason.trim() : banReason;
    
    if (!finalReason) {
      alert('Vui lòng nhập lý do ban');
      return;
    }
    
    setActionLoading(banTarget._id);
    setShowBanModal(false);
    
    try {
      await livestreamAdminService.adminBanLivestream(banTarget._id, {
        resolveReports: true,
        banUser: true, // Luôn ban user
        reason: finalReason
      });
      await handleRefresh();
      alert('Đã ban livestream và cấm người dùng phát livestream');
    } catch (error) {
      console.error('Error banning livestream:', error);
      alert('Lỗi khi ban livestream: ' + (error.response?.data?.message || error.message));
    } finally {
      setActionLoading(null);
      setBanTarget(null);
    }
  };

  const handleUnbanUser = async (userId, displayName) => {
    if (!window.confirm(`Bạn có chắc muốn gỡ cấm livestream cho ${displayName}?`)) return;
    
    setActionLoading(userId);
    try {
      await livestreamAdminService.adminUnbanUser(userId);
      await fetchBannedUsers();
      alert('Đã gỡ cấm phát livestream cho người dùng');
    } catch (error) {
      console.error('Error unbanning user:', error);
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleEndStream = async (roomId) => {
    if (!window.confirm('Bạn có chắc muốn KẾT THÚC livestream này?')) return;
    
    setActionLoading(roomId);
    try {
      await livestreamAdminService.adminEndLivestream(roomId);
      await handleRefresh();
    } catch (error) {
      console.error('Error ending livestream:', error);
      alert('Lỗi khi kết thúc livestream: ' + (error.response?.data?.message || error.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveReport = async (reportId) => {
    setActionLoading(reportId);
    try {
      await livestreamAdminService.resolveReport(reportId);
      await fetchReports();
    } catch (error) {
      console.error('Error resolving report:', error);
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismissReport = async (reportId) => {
    setActionLoading(reportId);
    try {
      await livestreamAdminService.dismissReport(reportId);
      await fetchReports();
    } catch (error) {
      console.error('Error dismissing report:', error);
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleWatchLive = (room) => {
    // Lấy playbackUrl từ room object (backend đã trả về playbackUrls)
    const hlsUrl = room.playbackUrls?.hls;
    
    if (!hlsUrl) {
      alert('Không thể lấy URL phát livestream. Vui lòng thử lại.');
      return;
    }
    
    setLiveModalRoom(room);
    setPlaybackUrl(hlsUrl);
    setShowLiveModal(true);
  };

  // Cleanup video player khi modal đóng
  useEffect(() => {
    if (!showLiveModal && playerRef.current) {
      try {
        playerRef.current.dispose();
        playerRef.current = null;
      } catch (e) {
        console.error('[Video.js] Dispose error:', e);
      }
      setPlaybackUrl(null);
      setLiveModalRoom(null);
    }
  }, [showLiveModal]);

  // Initialize video player khi modal mở và có playbackUrl
  useEffect(() => {
    if (!showLiveModal || !playbackUrl || !videoRef.current || playerRef.current) {
      return;
    }

    const initializePlayer = () => {
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

        // Auto reconnect on error
        player.on('error', () => {
          const err = player.error();
          console.error('VideoJS Error:', err);
          if (err && (err.code === 2 || err.code === 3 || err.code === 4)) {
            setTimeout(() => {
              if (player && !player.isDisposed()) {
                player.src({
                  src: playbackUrl,
                  type: 'application/x-mpegURL'
                });
                player.play().catch(() => {});
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
    };

    // Delay để đảm bảo DOM đã render
    const timer = setTimeout(initializePlayer, 100);

    return () => {
      clearTimeout(timer);
      if (playerRef.current) {
        try {
          playerRef.current.dispose();
        } catch (e) {
          console.error('[Video.js] Dispose error:', e);
        }
        playerRef.current = null;
      }
    };
  }, [showLiveModal, playbackUrl]);

  // Reports stats
  const pendingReportsCount = reports.filter(r => r.status === 'pending').length;
  
  const filteredActiveLivestreams = activeLivestreams.filter(room => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (room.title || '').toLowerCase().includes(searchLower) ||
      (room.description || '').toLowerCase().includes(searchLower) ||
      (room.hostId?.displayName || room.hostId?.username || '').toLowerCase().includes(searchLower)
    );
  });

  const filteredReports = reports.filter(report => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (report.room?.title || '').toLowerCase().includes(searchLower) ||
      (report.room?.hostId?.displayName || '').toLowerCase().includes(searchLower) ||
      (report.reporterId?.displayName || '').toLowerCase().includes(searchLower) ||
      (report.reason || '').toLowerCase().includes(searchLower)
    );
  });

  const filteredBannedUsers = bannedUsers.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.displayName || '').toLowerCase().includes(searchLower) ||
      (user.username || '').toLowerCase().includes(searchLower) ||
      (user.livestreamBannedReason || '').toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status) => {
    switch(status) {
      case 'live':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold flex items-center gap-1 animate-pulse">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          LIVE
        </span>;
      case 'preview':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-xs font-medium">
          Preview
        </span>;
      case 'waiting':
        return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium">
          Scheduled
        </span>;
      case 'ended':
        return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-lg text-xs font-medium">
          Ended
        </span>;
      default:
        return null;
    }
  };

  const getReasonBadge = (reason) => {
    const colors = {
      spam: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      inappropriate: 'bg-red-500/20 text-red-400 border-red-500/30',
      copyright: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      harassment: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      other: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    const labels = {
      spam: 'Spam',
      inappropriate: 'Nội dung không phù hợp',
      copyright: 'Vi phạm bản quyền',
      harassment: 'Quấy rối',
      other: 'Khác'
    };
    return (
      <span className={`px-2 py-1 ${colors[reason] || colors.other} border rounded-lg text-xs font-medium`}>
        {labels[reason] || reason}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-violet-400" size={48} />
          <p className="text-gray-400">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
            Quản lý Livestream
          </h1>
          <p className="text-gray-400 mt-2">Giám sát và xử lý các phòng livestream</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Socket connection indicator */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            socketConnected 
              ? 'bg-green-500/10 border-green-500/30 text-green-400' 
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            <Wifi size={16} className={socketConnected ? 'animate-pulse' : ''} />
            <span className="text-sm font-medium">
              {socketConnected ? 'Realtime' : 'Offline'}
            </span>
        </div>
        <button 
          onClick={handleRefresh}
          className="px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 rounded-xl text-violet-400 flex items-center gap-2 transition-all"
        >
          <RefreshCw size={18} />
          Làm mới
        </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Đang Live</p>
              <p className="text-2xl font-bold text-white mt-1">{activeLivestreams.length}</p>
            </div>
            <Video className="text-red-400" size={32} />
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {activeLivestreams.reduce((sum, room) => sum + (room.currentViewers || 0), 0)} viewers
          </div>
        </div>
        
        <div className={`bg-gradient-to-br ${pendingReportsCount > 0 ? 'from-yellow-500/20 to-orange-500/20 border-yellow-500/40' : 'from-green-500/10 to-emerald-500/10 border-green-500/20'} border rounded-xl p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Báo cáo chờ</p>
              <p className={`text-2xl font-bold mt-1 ${pendingReportsCount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                {pendingReportsCount}
              </p>
            </div>
            <Flag className={pendingReportsCount > 0 ? 'text-yellow-400 animate-pulse' : 'text-green-400'} size={32} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">User bị cấm</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{bannedUsers.length}</p>
            </div>
            <UserX className="text-red-400" size={32} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'live', label: 'Đang Live', count: activeLivestreams.length, icon: Video },
          { key: 'reports', label: 'Báo cáo', count: pendingReportsCount, highlight: pendingReportsCount > 0, icon: Flag },
          { key: 'banned', label: 'Đã cấm', count: bannedUsers.length, icon: UserX },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/30'
                  : tab.highlight 
                    ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${tab.highlight && activeTab !== tab.key ? 'bg-yellow-500 text-black' : 'bg-white/20'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Tìm kiếm theo tiêu đề, host, lý do..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all text-white placeholder-gray-400"
        />
      </div>

      {/* Report Filter (only show when in reports tab) */}
      {activeTab === 'reports' && (
        <div className="flex gap-2 mb-6">
          {['pending', 'resolved', 'dismissed', 'all'].map(filter => (
            <button
              key={filter}
              onClick={() => setReportFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                reportFilter === filter
                  ? 'bg-violet-500 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
              }`}
            >
              {filter === 'pending' && 'Chờ xử lý'}
              {filter === 'resolved' && 'Đã xử lý'}
              {filter === 'dismissed' && 'Đã bỏ qua'}
              {filter === 'all' && 'Tất cả'}
            </button>
          ))}
        </div>
      )}

      {/* ===================== BANNED USERS TAB ===================== */}
      {activeTab === 'banned' && (
        <div className="space-y-4">
          {filteredBannedUsers.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-gray-800/30 rounded-xl">
              <UserCheck className="mx-auto mb-4 text-green-400" size={64} />
              <p className="text-xl font-medium">Không có người dùng nào bị cấm</p>
              <p className="text-sm mt-2">Tất cả người dùng đều có thể phát livestream</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBannedUsers.map((user) => (
                <div 
                  key={user._id}
                  className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-red-500/30 p-4 hover:border-red-500/50 transition-all"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0 overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
                      ) : (
                        user.displayName?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-white truncate">{user.displayName}</h3>
                      <p className="text-sm text-gray-400">@{user.username}</p>
                      
                      <div className="mt-2 p-2 bg-red-500/10 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-red-400">
                          <Ban size={12} />
                          <span>Bị cấm từ: {formatDate(user.livestreamBannedAt)}</span>
                        </div>
                        {user.livestreamBannedReason && (
                          <p className="text-xs text-gray-400 mt-1">
                            Lý do: {user.livestreamBannedReason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleUnbanUser(user._id, user.displayName)}
                    disabled={actionLoading === user._id}
                    className="mt-4 w-full px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <UserCheck size={16} />
                    {actionLoading === user._id ? 'Đang xử lý...' : 'Gỡ cấm Livestream'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== REPORTS TAB ===================== */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {filteredReports.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-gray-800/30 rounded-xl">
              <CheckCircle className="mx-auto mb-4 text-green-400" size={64} />
              <p className="text-xl font-medium">Không có báo cáo nào</p>
              <p className="text-sm mt-2">Tất cả đã được xử lý hoặc chưa có báo cáo mới</p>
            </div>
          ) : (
            filteredReports.map((report) => (
              <div 
                key={report._id}
                className={`bg-gray-800/30 backdrop-blur-sm rounded-xl border ${
                  report.status === 'pending' ? 'border-yellow-500/30' : 'border-gray-700/50'
                } p-6 hover:border-violet-500/50 transition-all`}
              >
                <div className="flex gap-6">
                  {/* Room Info */}
                  <div className="flex-1">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                        {report.room?.hostId?.displayName?.[0]?.toUpperCase() || '?'}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-white">
                            {report.room?.title || 'Phòng đã bị xóa'}
                          </h3>
                          {report.room?.status && getStatusBadge(report.room.status)}
                          {report.reportCount > 1 && (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs font-bold">
                              {report.reportCount} báo cáo
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">
                          Host: <span className="text-gray-300">{report.room?.hostId?.displayName || 'Unknown'}</span>
                          {report.room?.startedAt && (
                            <span className="ml-3">
                              <Clock size={12} className="inline mr-1" />
                              {getTimeDiff(report.room.startedAt)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Report Details */}
                    <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Flag size={14} className="text-yellow-400" />
                        <span className="text-sm text-gray-400">Lý do:</span>
                        {getReasonBadge(report.reason)}
                      </div>
                      {report.description && (
                        <p className="text-sm text-gray-300 mt-2 pl-5">
                          "{report.description}"
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span>
                          Người báo cáo: <span className="text-gray-400">{report.reporterId?.displayName || 'Anonymous'}</span>
                        </span>
                        <span>
                          Thời gian: <span className="text-gray-400">{formatDate(report.createdAt)}</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded ${
                          report.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          report.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {report.status === 'pending' ? 'Chờ xử lý' : 
                           report.status === 'resolved' ? 'Đã xử lý' : 'Đã bỏ qua'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 min-w-[160px]">
                    {/* Nút xem live - luôn hiển thị nếu room đang live */}
                    {report.room?.status === 'live' && (
                      <button
                        onClick={() => handleWatchLive(report.room)}
                        className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                      >
                        <Eye size={16} />
                        Xem Live
                      </button>
                    )}
                    
                    {report.status === 'pending' && (
                      <>
                        {report.room?.status === 'live' && (
                          <>
                            <button
                              onClick={() => handleEndStream(report.room._id)}
                              disabled={actionLoading === report.room._id}
                              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              <StopCircle size={16} />
                              Kết thúc
                            </button>
                            <button
                              onClick={() => openBanModal(report.room)}
                              disabled={actionLoading === report.room._id}
                              className="px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              <Ban size={16} />
                              Ban Stream
                            </button>
                          </>
                        )}
                        
                        <div className="border-t border-gray-700 my-2"></div>
                        
                        <button
                          onClick={() => handleResolveReport(report._id)}
                          disabled={actionLoading === report._id}
                          className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <CheckCircle size={16} />
                          Đã xử lý
                        </button>
                        <button
                          onClick={() => handleDismissReport(report._id)}
                          disabled={actionLoading === report._id}
                          className="px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-gray-400 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <XCircle size={16} />
                          Bỏ qua
                        </button>
                      </>
                    )}
                    
                    {report.status !== 'pending' && report.resolvedBy && (
                      <div className="text-xs text-gray-500 text-center">
                        Xử lý bởi: {report.resolvedBy.displayName || 'Admin'}
                        <br />
                        {formatDate(report.resolvedAt)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===================== LIVESTREAM GRID (Live tab) ===================== */}
      {activeTab === 'live' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredActiveLivestreams.length === 0 ? (
            <div className="col-span-full text-center py-16 text-gray-400 bg-gray-800/30 rounded-xl">
              <Video className="mx-auto mb-4 opacity-50" size={64} />
              <p className="text-xl font-medium">
                Không có phòng nào đang live
              </p>
            </div>
          ) : (
            filteredActiveLivestreams.map((room) => (
              <div 
                key={room._id}
                className={`bg-gray-800/30 backdrop-blur-sm rounded-xl border ${
                  room.moderationStatus === 'banned' ? 'border-red-500/50' : 'border-gray-700/50'
                } overflow-hidden hover:border-violet-500/50 transition-all duration-300 group`}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden bg-gray-900">
                  <div className="w-full h-full flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, 
                        hsl(${(room._id?.charCodeAt(0) * 10) % 360 || 0}, 70%, 25%) 0%, 
                        hsl(${(room._id?.charCodeAt(1) * 10) % 360 || 180}, 70%, 15%) 100%)`
                    }}>
                    <Video className="text-white/30" size={48} />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent opacity-60" />
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    {getStatusBadge(room.status)}
                  </div>

                  {/* Privacy Badge */}
                  {room.privacyType === 'follow_only' && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-purple-500/20 backdrop-blur-sm border border-purple-500/30 rounded-lg flex items-center gap-1">
                      <Shield size={12} className="text-purple-400" />
                      <span className="text-xs text-purple-400 font-medium">Follower Only</span>
                    </div>
                  )}

                  {/* Viewer Count (Live only) */}
                  {room.status === 'live' && (
                    <div className="absolute bottom-3 right-3 px-2 py-1 bg-gray-900/80 backdrop-blur-sm rounded-lg flex items-center gap-1">
                      <Users size={14} className="text-red-400" />
                      <span className="text-sm font-medium text-white">{room.currentViewers || 0}</span>
                    </div>
                  )}

                  {/* Duration (Live only) */}
                  {room.status === 'live' && room.startedAt && (
                    <div className="absolute bottom-3 left-3 px-2 py-1 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-lg">
                      <span className="text-xs font-medium text-red-400">{getTimeDiff(room.startedAt)}</span>
                    </div>
                  )}

                  {/* Watch Button Overlay - chỉ hiển thị khi đang live */}
                  {room.status === 'live' && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleWatchLive(room)}
                        className="px-4 py-2 bg-violet-500 rounded-lg flex items-center gap-2 shadow-lg shadow-violet-500/50 hover:scale-110 transition-transform text-white font-medium"
                      >
                        <Eye size={18} />
                        Xem Live
                      </button>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="text-lg font-bold text-white mb-1 truncate">{room.title || 'Không có tiêu đề'}</h3>
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{room.description || 'Không có mô tả'}</p>
                  
                  {/* Host Info */}
                  <div className="flex items-center gap-2 mb-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <span className="text-xs font-bold">{room.hostId?.displayName?.[0]?.toUpperCase() || '?'}</span>
                    </div>
                    <span className="text-gray-300">{room.hostId?.displayName || room.hostId?.username || 'Unknown'}</span>
                  </div>

                  {/* Time Info */}
                  {room.startedAt && (
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                      <Clock size={14} />
                      <span>Bắt đầu: {formatDate(room.startedAt)}</span>
                    </div>
                  )}
                  {room.endedAt && (
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                      <Clock size={14} />
                      <span>Kết thúc: {formatDate(room.endedAt)}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    {room.status === 'live' && (
                      <button
                        onClick={() => handleWatchLive(room)}
                        className="flex-1 px-3 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1"
                      >
                        <Eye size={16} />
                        Xem Live
                      </button>
                    )}
                    {room.moderationStatus === 'active' && room.status === 'live' && (
                      <>
                        <button
                          onClick={() => handleEndStream(room._id)}
                          disabled={actionLoading === room._id}
                          className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <StopCircle size={16} />
                          Kết thúc
                        </button>
                        <button
                          onClick={() => openBanModal(room)}
                          disabled={actionLoading === room._id}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <Ban size={16} />
                          Ban
                        </button>
                      </>
                    )}
                    {room.status === 'ended' && room.moderationStatus === 'active' && (
                      <button
                        onClick={() => openBanModal(room)}
                        disabled={actionLoading === room._id}
                        className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <Ban size={16} />
                        Ban Host
                      </button>
                    )}
                  </div>

                  {/* Moderation Status */}
                  {room.moderationStatus === 'banned' && (
                    <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                      <Ban size={14} className="text-red-400" />
                      <span className="text-xs text-red-400 font-medium">Phòng này đã bị cấm</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* AI Moderation Note */}
      <div className="mt-8 p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-1">Về giám sát nội dung</h4>
            <p className="text-xs text-gray-500">
              Vì hệ thống không lưu trữ video stream, admin cần xem livestream <strong>realtime</strong> khi có báo cáo. 
              Nhấn "Xem Live" để mở stream trong tab mới và kiểm tra nội dung. 
              Trong tương lai có thể tích hợp AI moderation để tự động phát hiện nội dung vi phạm.
            </p>
          </div>
        </div>
      </div>

      {/* Live Stream Modal */}
      {showLiveModal && liveModalRoom && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-7xl h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Video className="text-violet-400" size={24} />
                  {liveModalRoom.title || 'Livestream'}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Host: {liveModalRoom.hostId?.displayName || liveModalRoom.hostId?.username || 'Unknown'}
                  {liveModalRoom.currentViewers !== undefined && (
                    <span className="ml-3">
                      <Users size={14} className="inline mr-1" />
                      {liveModalRoom.currentViewers} viewers
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowLiveModal(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* Video Player */}
            <div className="flex-1 relative bg-black overflow-hidden">
              {playbackUrl ? (
                <>
                  <div data-vjs-player style={{ width: '100%', height: '100%' }}>
                    <video
                      ref={videoRef}
                      className="video-js vjs-big-play-centered vjs-16-9"
                      playsInline
                      preload="auto"
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                  {playerRef.current && (
                    <LiveVideo 
                      player={playerRef.current} 
                      style={{ top: '20px', left: '20px' }} 
                    />
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center flex-col gap-4 text-gray-400">
                  <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                  <div>Đang tải tín hiệu...</div>
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="p-4 border-t border-gray-700 bg-gray-900/50">
              <div className="flex items-center gap-4 text-sm text-gray-400">
                {liveModalRoom.description && (
                  <p className="flex-1 line-clamp-2">{liveModalRoom.description}</p>
                )}
                {liveModalRoom.startedAt && (
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    <span>Bắt đầu: {formatDate(liveModalRoom.startedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {showBanModal && banTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Ban className="text-red-400" size={24} />
              Ban Livestream
            </h3>
            
            <div className="mb-4 p-3 bg-gray-900/50 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">Phòng:</p>
              <p className="text-white font-medium">{banTarget.title || 'Không có tiêu đề'}</p>
              <p className="text-sm text-gray-500 mt-1">
                Host: {banTarget.hostId?.displayName || 'Unknown'}
              </p>
            </div>

            {/* Thông báo */}
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <UserX size={16} />
                <span>Người dùng sẽ bị cấm phát livestream</span>
              </div>
            </div>

            {/* Lý do ban */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Lý do ban *</label>
              <select
                value={banReason}
                onChange={(e) => {
                  setBanReason(e.target.value);
                  if (e.target.value !== 'Khác') {
                    setCustomBanReason('');
                  }
                }}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500"
              >
                <option value="Vi phạm quy định cộng đồng">Vi phạm quy định cộng đồng</option>
                <option value="Nội dung không phù hợp">Nội dung không phù hợp</option>
                <option value="Spam">Spam</option>
                <option value="Vi phạm bản quyền">Vi phạm bản quyền</option>
                <option value="Quấy rối người khác">Quấy rối người khác</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            {/* Custom reason input khi chọn "Khác" */}
            {banReason === 'Khác' && (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Nhập lý do *</label>
                <textarea
                  value={customBanReason}
                  onChange={(e) => setCustomBanReason(e.target.value)}
                  placeholder="Mô tả lý do ban..."
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500 resize-none"
                />
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowBanModal(false);
                  setBanTarget(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleBan}
                disabled={banReason === 'Khác' && !customBanReason.trim()}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Ban size={16} />
                Ban Livestream
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveRoomManagement;
