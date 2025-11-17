import React, { useState } from 'react';
import { Search, Music, Clock, User, Check, X, Play, Eye, TrendingUp, Calendar } from 'lucide-react';

const LickApprovement = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLick, setSelectedLick] = useState(null);

  const [licks, setLicks] = useState([
    {
      id: 1,
      title: 'Summer Jam Remix',
      description: 'A smooth jazz-hip hop fusion lick',
      userId: { username: 'john_music', _id: 'user1' },
      uploadDate: '2024-11-05',
      duration: 225, // in seconds
      tempo: 120,
      key: 'C Major',
      difficulty: 'intermediate',
      status: 'draft',
      isPublic: true,
      isFeatured: false,
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop'
    },
    {
      id: 2,
      title: 'Midnight Groove',
      description: 'Electronic bass line with funk elements',
      userId: { username: 'kevin_beats', _id: 'user2' },
      uploadDate: '2024-11-04',
      duration: 252,
      tempo: 128,
      key: 'D Minor',
      difficulty: 'advanced',
      status: 'draft',
      isPublic: true,
      isFeatured: false,
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop'
    },
    {
      id: 3,
      title: 'Acoustic Dreams',
      description: 'Gentle fingerpicking pattern',
      userId: { username: 'alex_producer', _id: 'user3' },
      uploadDate: '2024-11-03',
      duration: 178,
      tempo: 90,
      key: 'G Major',
      difficulty: 'beginner',
      status: 'draft',
      isPublic: true,
      isFeatured: false,
      thumbnail: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop'
    },
    {
      id: 4,
      title: 'Urban Beats',
      description: 'Fast-paced hip hop drum pattern',
      userId: { username: 'producer_mike', _id: 'user4' },
      uploadDate: '2024-11-02',
      duration: 210,
      tempo: 140,
      key: 'A Minor',
      difficulty: 'advanced',
      status: 'draft',
      isPublic: true,
      isFeatured: false,
      thumbnail: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop'
    }
  ]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleApprove = (id) => {
    setLicks(licks.map(lick => 
      lick.id === id ? { ...lick, status: 'active' } : lick
    ));
    setSelectedLick(null);
  };

  const handleReject = (id) => {
    setLicks(licks.map(lick => 
      lick.id === id ? { ...lick, status: 'inactive' } : lick
    ));
    setSelectedLick(null);
  };

  const handleFeature = (id) => {
    setLicks(licks.map(lick => 
      lick.id === id ? { ...lick, isFeatured: !lick.isFeatured } : lick
    ));
  };

  const pendingLicks = licks.filter(l => l.status === 'draft');
  const approvedLicks = licks.filter(l => l.status === 'active');
  const rejectedLicks = licks.filter(l => l.status === 'inactive');
  
  let displayLicks = [];
  if (activeTab === 'pending') displayLicks = pendingLicks;
  else if (activeTab === 'approved') displayLicks = approvedLicks;
  else displayLicks = rejectedLicks;
  
  const filteredLicks = displayLicks.filter(lick => {
    const searchLower = searchTerm.toLowerCase();
    return (
      lick.title.toLowerCase().includes(searchLower) ||
      (lick.description && lick.description.toLowerCase().includes(searchLower)) ||
      lick.userId.username.toLowerCase().includes(searchLower) ||
      (lick.key && lick.key.toLowerCase().includes(searchLower))
    );
  });

  const getDifficultyColor = (difficulty) => {
    switch(difficulty) {
      case 'beginner': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'intermediate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'advanced': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
          Lick Approvement
        </h1>
        <p className="text-gray-400 mt-2">Review and manage uploaded music licks</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Pending Review</p>
              <p className="text-2xl font-bold text-white mt-1">{pendingLicks.length}</p>
            </div>
            <Clock className="text-yellow-400" size={32} />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Approved</p>
              <p className="text-2xl font-bold text-white mt-1">{approvedLicks.length}</p>
            </div>
            <Check className="text-green-400" size={32} />
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Rejected</p>
              <p className="text-2xl font-bold text-white mt-1">{rejectedLicks.length}</p>
            </div>
            <X className="text-red-400" size={32} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'pending'
              ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/30'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Pending Review
          {pendingLicks.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
              {pendingLicks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'approved'
              ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/30'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Approved
        </button>
        <button
          onClick={() => setActiveTab('rejected')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'rejected'
              ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/30'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Rejected
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search by title, description, uploader, or key..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-transparent transition-all text-white placeholder-gray-400"
        />
      </div>

      {/* Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredLicks.map((lick) => (
          <div 
            key={lick.id}
            className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden hover:border-teal-500/50 transition-all duration-300 group"
          >
            {/* Thumbnail */}
            <div className="relative aspect-square overflow-hidden bg-gray-900">
              <img 
                src={lick.thumbnail} 
                alt={lick.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent opacity-60" />
              
              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/50 hover:scale-110 transition-transform">
                  <Play className="text-white ml-1" size={28} fill="white" />
                </button>
              </div>

              {/* Featured Badge */}
              {lick.isFeatured && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg text-xs font-bold flex items-center gap-1">
                  <TrendingUp size={12} />
                  Featured
                </div>
              )}

              {/* Duration */}
              <div className="absolute bottom-3 right-3 px-2 py-1 bg-gray-900/80 backdrop-blur-sm rounded-lg text-xs font-medium">
                {formatDuration(lick.duration)}
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="text-lg font-bold text-white mb-1 truncate">{lick.title}</h3>
              <p className="text-sm text-gray-400 mb-3 line-clamp-2">{lick.description || 'No description'}</p>
              
              {/* User Info */}
              <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
                <User size={14} />
                <span>{lick.userId.username}</span>
              </div>

              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                <div className="bg-gray-900/50 rounded-lg p-2">
                  <p className="text-gray-500">Key</p>
                  <p className="text-white font-medium">{lick.key || 'N/A'}</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-2">
                  <p className="text-gray-500">Tempo</p>
                  <p className="text-white font-medium">{lick.tempo || 'N/A'} BPM</p>
                </div>
              </div>

              {/* Difficulty Badge */}
              <div className="mb-3">
                <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${getDifficultyColor(lick.difficulty)}`}>
                  {lick.difficulty ? lick.difficulty.charAt(0).toUpperCase() + lick.difficulty.slice(1) : 'N/A'}
                </span>
              </div>

              {/* Upload Date */}
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                <Calendar size={12} />
                <span>{new Date(lick.uploadDate).toLocaleDateString()}</span>
              </div>

              {/* Action Buttons */}
              {activeTab === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(lick.id)}
                    className="flex-1 px-3 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1"
                  >
                    <Check size={16} />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(lick.id)}
                    className="flex-1 px-3 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1"
                  >
                    <X size={16} />
                    Reject
                  </button>
                </div>
              )}

              {activeTab === 'approved' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFeature(lick.id)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                      lick.isFeatured
                        ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    <TrendingUp size={16} />
                    {lick.isFeatured ? 'Unfeature' : 'Feature'}
                  </button>
                  <button
                    onClick={() => handleReject(lick.id)}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {activeTab === 'rejected' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(lick.id)}
                    className="flex-1 px-3 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1"
                  >
                    <Check size={16} />
                    Reactivate
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredLicks.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Music className="mx-auto mb-4 opacity-50" size={64} />
          <p className="text-xl font-medium">No licks found</p>
          <p className="text-sm mt-2">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
};

export default LickApprovement;