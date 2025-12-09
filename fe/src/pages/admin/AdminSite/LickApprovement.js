import React, { useState, useEffect, useRef } from 'react';
import { Search, Music, Clock, User, Check, X, Play, Pause, Eye, Calendar, FileText, Tag, Music2 } from 'lucide-react';
import api from '../../../services/api';

const LickApprovement = () => {
  // State quản lý Tab: 'pending' hoặc 'resolved'
  const [activeTab, setActiveTab] = useState('pending');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingLicks, setPendingLicks] = useState([]);
  const [resolvedLicks, setResolvedLicks] = useState([]); // Danh sách lick đã duyệt/từ chối
  const [loading, setLoading] = useState(true);
  
  const [playingLickId, setPlayingLickId] = useState(null);
  const [selectedLick, setSelectedLick] = useState(null); 
  const audioRef = useRef(new Audio());

  // Fetch dữ liệu
  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Gọi API lấy Pending Licks
      const pendingRes = await api.get('/licks/pending');

      // 2. Gọi API lấy Resolved Licks (Active hoặc Inactive)
      // Bạn cần tạo thêm API này ở backend hoặc lọc từ danh sách tất cả nếu backend hỗ trợ
      // Giả sử backend có API /api/licks/resolved hoặc chúng ta tạm thời dùng community licks + inactive licks
      // Để đơn giản, tôi giả định bạn sẽ tạo thêm endpoint này. Nếu chưa có, bạn có thể dùng tạm danh sách rỗng.
      // const resolvedRes = await axios.get('http://localhost:9999/api/licks/resolved', { ... });
      
      // TẠM THỜI: Để demo, tôi sẽ dùng mảng rỗng cho resolvedLicks nếu chưa có API backend tương ứng.
      // Bạn cần thêm endpoint `getResolvedLicks` vào backend tương tự `getPendingLicks` nhưng tìm status: { $in: ['active', 'inactive'] }
      const resolvedData = []; 

      if (pendingRes.data.success) {
        const mapLick = (lick) => ({
          id: lick._id,
          title: lick.title,
          description: lick.description,
          userId: lick.userId || { username: 'Unknown', displayName: 'Unknown' },
          uploadDate: lick.createdAt,
          duration: lick.duration || 0,
          tempo: lick.tempo,
          key: lick.key,
          difficulty: lick.difficulty,
          status: lick.status,
          isPublic: lick.isPublic,
          audioUrl: lick.audioUrl, 
          tabNotation: lick.tabNotation,
          tags: lick.tags || [],
          thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop' 
        });

        setPendingLicks(pendingRes.data.data.map(mapLick));
        // setResolvedLicks(resolvedRes.data.data.map(mapLick)); // Uncomment khi có API
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    return () => {
      audioRef.current.pause();
      audioRef.current.src = "";
    };
  }, []);

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayAudio = (e, lick) => {
    e.stopPropagation();
    if (playingLickId === lick.id) {
      audioRef.current.pause();
      setPlayingLickId(null);
    } else {
      audioRef.current.src = lick.audioUrl;
      audioRef.current.play().catch(err => console.error("Audio play error:", err));
      setPlayingLickId(lick.id);
      audioRef.current.onended = () => setPlayingLickId(null);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.patch(`/licks/${id}/approve`, {});
      
      // Di chuyển từ Pending sang Resolved
      const approvedLick = pendingLicks.find(l => l.id === id);
      if (approvedLick) {
          setPendingLicks(prev => prev.filter(l => l.id !== id));
          setResolvedLicks(prev => [{...approvedLick, status: 'active'}, ...prev]);
      }
      
      if (selectedLick?.id === id) setSelectedLick(null);
      alert("Lick approved successfully!");
    } catch (error) {
      console.error("Error approving lick:", error);
      alert("Failed to approve lick");
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Are you sure you want to reject this lick?")) return;
    try {
      await api.patch(`/licks/${id}/reject`, {});
      
      // Di chuyển từ Pending sang Resolved
      const rejectedLick = pendingLicks.find(l => l.id === id);
      if (rejectedLick) {
          setPendingLicks(prev => prev.filter(l => l.id !== id));
          setResolvedLicks(prev => [{...rejectedLick, status: 'inactive'}, ...prev]);
      }

      if (selectedLick?.id === id) setSelectedLick(null);
    } catch (error) {
      console.error("Error rejecting lick:", error);
      alert("Failed to reject lick");
    }
  };

  // Lọc danh sách hiển thị dựa trên Tab và Search
  const currentList = activeTab === 'pending' ? pendingLicks : resolvedLicks;
  
  const filteredLicks = currentList.filter(lick => {
    const searchLower = searchTerm.toLowerCase();
    return (
      lick.title.toLowerCase().includes(searchLower) ||
      (lick.description && lick.description.toLowerCase().includes(searchLower)) ||
      (lick.userId?.username && lick.userId.username.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="p-8 relative min-h-screen bg-[#0F172A]"> {/* Nền tối */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
          Lick Approval
        </h1>
        <p className="text-gray-400 mt-2">Review and manage pending music licks</p>
      </div>

      {/* ⭐ TABS: Pending vs Resolved (Theo thiết kế hình ảnh) */}
      <div className="flex space-x-4 mb-8">
        {/* Tab Pending */}
        <button
          onClick={() => setActiveTab('pending')}
          className={`relative flex items-center px-6 py-3 rounded-lg font-bold text-lg transition-all duration-200 ${
            activeTab === 'pending'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/20'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          Pending Reviews
          {pendingLicks.length > 0 && (
            <span className={`ml-3 px-2 py-0.5 text-sm rounded-full ${
                activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-gray-700 text-gray-300'
            }`}>
              {pendingLicks.length}
            </span>
          )}
        </button>

        {/* Tab Resolved */}
        <button
          onClick={() => setActiveTab('resolved')}
          className={`flex items-center px-6 py-3 rounded-lg font-bold text-lg transition-all duration-200 ${
            activeTab === 'resolved'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/20'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          Resolved Reviews
          {/* (Optional) Badge số lượng cho Resolved */}
          {resolvedLicks.length > 0 && (
             <span className={`ml-3 px-2 py-0.5 text-sm rounded-full ${
                activeTab === 'resolved' ? 'bg-white/20 text-white' : 'bg-gray-700 text-gray-300'
            }`}>
              {resolvedLicks.length}
            </span>
          )}
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search by title, description, uploader..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-transparent transition-all text-white placeholder-gray-400"
        />
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="text-center text-white py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-500 mx-auto mb-4"></div>
            Loading...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredLicks.map((lick) => (
            <div 
              key={lick.id}
              className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden hover:border-teal-500/50 transition-all duration-300 group cursor-pointer relative"
              onClick={() => setSelectedLick(lick)} 
            >
              {/* Status Badge cho Resolved Tab */}
              {activeTab === 'resolved' && (
                  <div className={`absolute top-2 right-2 z-10 px-2 py-1 rounded text-xs font-bold uppercase ${
                      lick.status === 'active' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                      {lick.status}
                  </div>
              )}

              {/* Thumbnail & Play Button */}
              <div className="relative aspect-square overflow-hidden bg-gray-900">
                <img 
                  src={lick.thumbnail} 
                  alt={lick.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent opacity-60" />
                
                <div className="absolute bottom-3 right-3 px-2 py-1 bg-gray-900/80 backdrop-blur-sm rounded-lg text-xs font-medium text-white">
                  {formatDuration(lick.duration)}
                </div>
                
                <div 
                  className="absolute inset-0 flex items-center justify-center"
                  onClick={(e) => handlePlayAudio(e, lick)}
                >
                  <div className={`p-3 rounded-full text-white transform transition-all duration-200 ${
                    playingLickId === lick.id 
                      ? "bg-teal-500 scale-110" 
                      : "bg-teal-500/80 opacity-0 group-hover:opacity-100 hover:scale-110"
                  }`}>
                    {playingLickId === lick.id ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                  </div>
                </div>
              </div>

              <div className="p-4">
                <h3 className="text-lg font-bold text-white mb-1 truncate">{lick.title}</h3>
                <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
                  <User size={14} />
                  <span>{lick.userId?.displayName || 'Unknown'}</span>
                </div>

                <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                  <Calendar size={12} />
                  <span>{new Date(lick.uploadDate).toLocaleDateString()}</span>
                </div>

                {/* Action Buttons - CHỈ HIỂN THỊ Ở TAB PENDING */}
                {activeTab === 'pending' && (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredLicks.length === 0 && (
        <div className="text-center py-24 text-gray-500 bg-gray-800/20 rounded-2xl border border-gray-700/30">
          <Music className="mx-auto mb-4 opacity-30" size={64} />
          <p className="text-xl font-medium">No {activeTab} licks found</p>
          <p className="text-sm mt-2 opacity-60">
              {activeTab === 'pending' ? "All caught up! No new uploads to review." : "No history of approved or rejected licks."}
          </p>
        </div>
      )}

      {/* ⭐ DETAIL MODAL */}
      {selectedLick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-800 flex justify-between items-start bg-gray-800/50">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">{selectedLick.title}</h2>
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <User size={16} />
                  <span>Uploaded by {selectedLick.userId?.displayName}</span>
                  <span>•</span>
                  <Calendar size={16} />
                  <span>{new Date(selectedLick.uploadDate).toLocaleString()}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLick(null)}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {/* Audio Player Section */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Music2 size={16} className="text-teal-400" /> Audio Preview
                  </span>
                  <span className="text-xs text-gray-500">{formatDuration(selectedLick.duration)}</span>
                </div>
                <audio controls className="w-full" src={selectedLick.audioUrl}>
                  Your browser does not support the audio element.
                </audio>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/30">
                  <p className="text-gray-500 text-xs uppercase font-bold mb-1">Key</p>
                  <p className="text-white font-medium">{selectedLick.key || 'N/A'}</p>
                </div>
                <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/30">
                  <p className="text-gray-500 text-xs uppercase font-bold mb-1">Tempo</p>
                  <p className="text-white font-medium">{selectedLick.tempo || 'N/A'} BPM</p>
                </div>
                <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/30">
                  <p className="text-gray-500 text-xs uppercase font-bold mb-1">Difficulty</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium 
                    ${selectedLick.difficulty === 'beginner' ? 'bg-green-500/20 text-green-400' : 
                      selectedLick.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' : 
                      'bg-red-500/20 text-red-400'}`}>
                    {selectedLick.difficulty || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <FileText size={16} className="text-blue-400" /> Description
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed bg-gray-800/30 p-4 rounded-xl border border-gray-700/30">
                  {selectedLick.description || "No description provided."}
                </p>
              </div>

              {/* Tab Notation */}
              <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Music size={16} className="text-purple-400" /> Tab Notation
                </h3>
                <pre className="bg-gray-950 text-green-400 p-4 rounded-xl overflow-x-auto font-mono text-xs border border-gray-800">
                  {selectedLick.tabNotation || "No tab notation available."}
                </pre>
              </div>

              {/* Tags */}
              {selectedLick.tags && selectedLick.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <Tag size={16} className="text-orange-400" /> Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedLick.tags.map((tag, index) => (
                      <span key={index} className="px-3 py-1 rounded-full bg-gray-800 text-gray-300 text-xs border border-gray-700">
                        #{tag.tag_name || tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-800 bg-gray-800/50 flex gap-4">
              <button
                onClick={() => handleApprove(selectedLick.id)}
                className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-900/20"
              >
                Approve Lick
              </button>
              <button
                onClick={() => handleReject(selectedLick.id)}
                className="flex-1 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-900/20"
              >
                Reject Lick
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default LickApprovement;