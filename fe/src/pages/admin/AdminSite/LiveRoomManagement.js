import React, { useState } from 'react';
import { Search, Video, Clock, Users, Ban, StopCircle, Eye, Calendar, Shield } from 'lucide-react';

const LiveRoomManagement = () => {
  const [activeTab, setActiveTab] = useState('live');
  const [searchTerm, setSearchTerm] = useState('');
  // const [selectedRoom, setSelectedRoom] = useState(null);

  const [liveRooms, setLiveRooms] = useState([
    {
      id: 1,
      hostId: { username: 'DJ_Baddie', _id: 'host1' },
      title: 'Late Night Chill Session',
      description: 'Relaxing beats for your evening',
      streamKey: 'stream_abc123',
      status: 'live',
      privacyType: 'public',
      moderationStatus: 'active',
      viewers: 245,
      startedAt: '2024-11-06T20:30:00',
      scheduledAt: '2024-11-06T20:00:00',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop'
    },
    {
      id: 2,
      hostId: { username: 'john_music', _id: 'host2' },
      title: 'Guitar Practice Stream',
      description: 'Learning new techniques',
      streamKey: 'stream_def456',
      status: 'live',
      privacyType: 'follow_only',
      moderationStatus: 'active',
      viewers: 89,
      startedAt: '2024-11-06T19:45:00',
      scheduledAt: null,
      thumbnail: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop'
    },
    {
      id: 3,
      hostId: { username: 'kevin_beats', _id: 'host3' },
      title: 'Hip Hop Production',
      description: 'Making beats live',
      streamKey: 'stream_ghi789',
      status: 'preview',
      privacyType: 'public',
      moderationStatus: 'active',
      viewers: 12,
      startedAt: null,
      scheduledAt: '2024-11-06T22:00:00',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop'
    },
    {
      id: 4,
      hostId: { username: 'alex_producer', _id: 'host4' },
      title: 'Jazz Jam Session',
      description: 'Improvisation and collaboration',
      streamKey: 'stream_jkl012',
      status: 'waiting',
      privacyType: 'public',
      moderationStatus: 'active',
      viewers: 0,
      startedAt: null,
      scheduledAt: '2024-11-07T18:00:00',
      thumbnail: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop'
    },
    {
      id: 5,
      hostId: { username: 'banned_user', _id: 'host5' },
      title: 'Banned Stream Example',
      description: 'This stream was banned for violations',
      streamKey: 'stream_mno345',
      status: 'ended',
      privacyType: 'public',
      moderationStatus: 'banned',
      viewers: 0,
      startedAt: '2024-11-05T15:00:00',
      endedAt: '2024-11-05T16:30:00',
      scheduledAt: null,
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop'
    }
  ]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
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

  const handleBan = (id) => {
    setLiveRooms(liveRooms.map(room => 
      room.id === id ? { ...room, moderationStatus: 'banned', status: 'ended' } : room
    ));
  };

  const handleUnban = (id) => {
    setLiveRooms(liveRooms.map(room => 
      room.id === id ? { ...room, moderationStatus: 'active' } : room
    ));
  };

  const handleEndStream = (id) => {
    setLiveRooms(liveRooms.map(room => 
      room.id === id ? { ...room, status: 'ended', endedAt: new Date().toISOString() } : room
    ));
  };

  const liveRoomsList = liveRooms.filter(r => r.status === 'live');
  const scheduledRoomsList = liveRooms.filter(r => r.status === 'waiting' || r.status === 'preview');
  const endedRoomsList = liveRooms.filter(r => r.status === 'ended');
  const bannedRoomsList = liveRooms.filter(r => r.moderationStatus === 'banned');
  
  let displayRooms = [];
  if (activeTab === 'live') displayRooms = liveRoomsList;
  else if (activeTab === 'scheduled') displayRooms = scheduledRoomsList;
  else if (activeTab === 'ended') displayRooms = endedRoomsList;
  else displayRooms = bannedRoomsList;
  
  const filteredRooms = displayRooms.filter(room => {
    const searchLower = searchTerm.toLowerCase();
    return (
      room.title.toLowerCase().includes(searchLower) ||
      (room.description && room.description.toLowerCase().includes(searchLower)) ||
      room.hostId.username.toLowerCase().includes(searchLower)
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

  // const getPrivacyIcon = (privacy) => {
  //   if (privacy === 'follow_only') {
  //     return <Shield size={14} className="text-purple-400" />;
  //   }
  //   return null;
  // };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
          LiveRoom Approvement
        </h1>
        <p className="text-gray-400 mt-2">Monitor and manage live streaming rooms</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Live Now</p>
              <p className="text-2xl font-bold text-white mt-1">{liveRoomsList.length}</p>
            </div>
            <Video className="text-red-400" size={32} />
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {liveRoomsList.reduce((sum, room) => sum + (room.viewers || 0), 0)} total viewers
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Scheduled</p>
              <p className="text-2xl font-bold text-white mt-1">{scheduledRoomsList.length}</p>
            </div>
            <Clock className="text-blue-400" size={32} />
          </div>
        </div>
        <div className="bg-gradient-to-br from-gray-500/10 to-gray-600/10 border border-gray-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Ended</p>
              <p className="text-2xl font-bold text-white mt-1">{endedRoomsList.length}</p>
            </div>
            <StopCircle className="text-gray-400" size={32} />
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Banned</p>
              <p className="text-2xl font-bold text-white mt-1">{bannedRoomsList.length}</p>
            </div>
            <Ban className="text-orange-400" size={32} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('live')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'live'
              ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/30'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Live Now
          {liveRoomsList.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
              {liveRoomsList.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'scheduled'
              ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/30'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Scheduled
        </button>
        <button
          onClick={() => setActiveTab('ended')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'ended'
              ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/30'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Ended
        </button>
        <button
          onClick={() => setActiveTab('banned')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'banned'
              ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/30'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Banned
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search by title, description, or host..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all text-white placeholder-gray-400"
        />
      </div>

      {/* Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRooms.map((room) => (
          <div 
            key={room.id}
            className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden hover:border-violet-500/50 transition-all duration-300 group"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video overflow-hidden bg-gray-900">
              <img 
                src={room.thumbnail} 
                alt={room.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent opacity-60" />
              
              {/* Status Badge */}
              <div className="absolute top-3 left-3">
                {getStatusBadge(room.status)}
              </div>

              {/* Privacy Badge */}
              {room.privacyType === 'follow_only' && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-purple-500/20 backdrop-blur-sm border border-purple-500/30 rounded-lg flex items-center gap-1">
                  <Shield size={12} className="text-purple-400" />
                  <span className="text-xs text-purple-400 font-medium">Follow Only</span>
                </div>
              )}

              {/* Viewer Count (Live only) */}
              {room.status === 'live' && (
                <div className="absolute bottom-3 right-3 px-2 py-1 bg-gray-900/80 backdrop-blur-sm rounded-lg flex items-center gap-1">
                  <Users size={14} className="text-red-400" />
                  <span className="text-sm font-medium text-white">{room.viewers}</span>
                </div>
              )}

              {/* Duration (Live only) */}
              {room.status === 'live' && (
                <div className="absolute bottom-3 left-3 px-2 py-1 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-lg">
                  <span className="text-xs font-medium text-red-400">{getTimeDiff(room.startedAt)}</span>
                </div>
              )}

              {/* Watch Button Overlay */}
              {room.status === 'live' && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="px-4 py-2 bg-violet-500 rounded-lg flex items-center gap-2 shadow-lg shadow-violet-500/50 hover:scale-110 transition-transform text-white font-medium">
                    <Eye size={18} />
                    Watch
                  </button>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="text-lg font-bold text-white mb-1 truncate">{room.title}</h3>
              <p className="text-sm text-gray-400 mb-3 line-clamp-2">{room.description || 'No description'}</p>
              
              {/* Host Info */}
              <div className="flex items-center gap-2 mb-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <span className="text-xs font-bold">{room.hostId.username[0].toUpperCase()}</span>
                </div>
                <span className="text-gray-300">{room.hostId.username}</span>
              </div>

              {/* Schedule Info */}
              {room.scheduledAt && (
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3 bg-gray-900/50 rounded-lg p-2">
                  <Calendar size={14} />
                  <span>Scheduled: {formatDate(room.scheduledAt)}</span>
                </div>
              )}

              {/* Started/Ended Time */}
              {room.startedAt && (
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                  <Clock size={14} />
                  <span>Started: {formatDate(room.startedAt)}</span>
                </div>
              )}
              {room.endedAt && (
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                  <Clock size={14} />
                  <span>Ended: {formatDate(room.endedAt)}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                {room.moderationStatus === 'active' && room.status === 'live' && (
                  <>
                    <button
                      onClick={() => handleEndStream(room.id)}
                      className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1"
                    >
                      <StopCircle size={16} />
                      End Stream
                    </button>
                    <button
                      onClick={() => handleBan(room.id)}
                      className="flex-1 px-3 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1"
                    >
                      <Ban size={16} />
                      Ban
                    </button>
                  </>
                )}
                {room.moderationStatus === 'banned' && (
                  <button
                    onClick={() => handleUnban(room.id)}
                    className="flex-1 px-3 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1"
                  >
                    <Shield size={16} />
                    Unban
                  </button>
                )}
                {room.status === 'ended' && room.moderationStatus === 'active' && (
                  <button
                    onClick={() => handleBan(room.id)}
                    className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1"
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
                  <span className="text-xs text-red-400 font-medium">This room is banned</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredRooms.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Video className="mx-auto mb-4 opacity-50" size={64} />
          <p className="text-xl font-medium">No live rooms found</p>
          <p className="text-sm mt-2">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
};

export default LiveRoomManagement;