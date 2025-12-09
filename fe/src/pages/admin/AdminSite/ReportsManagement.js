import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, ShieldAlert, UserX, Loader2, Eye, X } from 'lucide-react';
import { getAllReports, adminRestorePost, adminDeletePost } from '../../../services/user/reportService';
import { message, Modal } from 'antd';
import PostLickEmbed from '../../../components/PostLickEmbed';
import { onNewReport, offNewReport } from '../../../services/user/socketService';

const ReportsManagement = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);

  // Map reason to Vietnamese display text
  const getReasonDisplay = (reason) => {
    const reasonMap = {
      'spam': 'Spam',
      'inappropriate': 'Nội dung không phù hợp',
      'copyright': 'Vi phạm bản quyền',
      'harassment': 'Quấy rối',
      'other': 'Khác'
    };
    return reasonMap[reason] || reason;
  };

  // Map reason to violation type for icon
  const getViolationTypeFromReason = (reason) => {
    const typeMap = {
      'copyright': 'Copyright Infringement',
      'inappropriate': 'Inappropriate Content',
      'harassment': 'Impersonation',
      'spam': 'Spam',
      'other': 'Other'
    };
    return typeMap[reason] || 'Other';
  };

  // Helper function to map report data to frontend format
  const mapReportData = (report, index = 0) => {
    const reporterDisplayName = report.reporterId?.displayName || report.reporterId?.username || 'Unknown';
    const reportData = {
      id: report._id || index + 1,
      _id: report._id,
      reportedBy: reporterDisplayName,
      reporterUsername: report.reporterId?.username || 'Unknown',
      reporterId: report.reporterId?._id,
      violationType: getReasonDisplay(report.reason),
      reason: report.reason,
      reportedContent: '',
      uploader: '',
      uploaderDisplayName: '',
      host: '',
      detail: report.description || '',
      accountStatus: 'Active',
      isPending: report.status === 'pending',
      status: report.status,
      createdAt: report.createdAt,
      post: report.post ? {
        ...report.post,
        attachedLicks: report.post.attachedLicks || [],
        media: report.post.media || [],
        linkPreview: report.post.linkPreview || null
      } : null,
      targetContentType: report.targetContentType,
      targetContentId: report.targetContentId,
      fullReport: report // Store full report data for detail view
    };

    // Format reported content based on content type
    if (report.targetContentType === 'post' && report.post) {
      const postText = report.post.textContent 
        ? (report.post.textContent.length > 50 
            ? report.post.textContent.substring(0, 50) + '...' 
            : report.post.textContent)
        : 'Post không có nội dung';
      reportData.reportedContent = `Post: "${postText}"`;
      reportData.uploader = report.post.author?.username || 'Unknown';
      reportData.uploaderDisplayName = report.post.author?.displayName || report.post.author?.username || 'Unknown';
    } else if (report.targetContentType === 'lick') {
      reportData.reportedContent = `Lick: "${report.targetContentId}"`;
    } else if (report.targetContentType === 'user') {
      reportData.reportedContent = `User Profile: "${report.targetContentId}"`;
    } else {
      reportData.reportedContent = `${report.targetContentType}: ${report.targetContentId}`;
    }

    return reportData;
  };

  // Fetch reports from backend
  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const response = await getAllReports();
        if (response?.success && response?.data) {
          // Map backend data to frontend format
          const mappedReports = response.data.map((report, index) => mapReportData(report, index));
          setReports(mappedReports);
        }
      } catch (error) {
        console.error('Error fetching reports:', error);
        message.error('Không thể tải danh sách báo cáo');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  // Listen for new reports via socket (realtime)
  useEffect(() => {
    const handleNewReport = (payload) => {
      console.log('[ReportsManagement] Received new report via socket:', payload);
      const newReport = payload.report;
      
      if (!newReport) {
        console.warn('[ReportsManagement] No report data in payload');
        return;
      }

      // Check if report already exists (avoid duplicates)
      setReports(prevReports => {
        const exists = prevReports.some(r => r._id === newReport._id);
        if (exists) {
          console.log('[ReportsManagement] Report already exists, skipping');
          return prevReports;
        }

        // Map the new report to frontend format
        const mappedReport = mapReportData(newReport);
        
        // Add to the beginning of the list (newest first)
        const updatedReports = [mappedReport, ...prevReports];
        
        // Show notification
        message.success({
          content: `Có báo cáo mới từ ${mappedReport.reportedBy}`,
          duration: 3,
        });

        // Auto-switch to pending tab if not already there
        if (mappedReport.status === 'pending') {
          setActiveTab('pending');
        }

        return updatedReports;
      });
    };

    // Setup socket listener
    onNewReport(handleNewReport);

    // Cleanup on unmount
    return () => {
      offNewReport(handleNewReport);
    };
  }, []);

  const handleAction = async (id, action) => {
    console.log('[ReportsManagement] handleAction called with:', { id, action });
    const report = reports.find(r => r._id === id || r.id === id);
    console.log('[ReportsManagement] Found report:', report);
    
    if (!report) {
      console.error('[ReportsManagement] Report not found for id:', id);
      message.error('Không tìm thấy báo cáo');
      return;
    }
    
    if (!report.post) {
      console.error('[ReportsManagement] Report has no post data:', report);
      message.error('Báo cáo không có thông tin bài viết');
      return;
    }

    const postId = report.post._id?.toString() || report.post._id || report.targetContentId?.toString() || report.targetContentId;
    console.log('[ReportsManagement] PostId extracted:', postId);
    console.log('[ReportsManagement] Report post object:', report.post);
    console.log('[ReportsManagement] Report targetContentId:', report.targetContentId);
    
    if (!postId) {
      console.error('[ReportsManagement] Cannot extract postId from report');
      message.error('Không thể xác định ID bài viết');
      return;
    }
    
    if (action === 'delete') {
      console.log('[ReportsManagement] Opening delete confirmation modal');
      setPostToDelete({ postId, reportId: id });
      setShowDeleteConfirm(true);
    } else if (action === 'restore') {
      // Restore post
      try {
        const response = await adminRestorePost(postId);
        const resolvedCount = response?.data?.resolvedReportsCount || 0;
        message.success(`Đã khôi phục bài viết và đánh dấu ${resolvedCount} báo cáo là đã xử lý`);
        
        // Refresh reports from server to get updated status
        const refreshResponse = await getAllReports();
        if (refreshResponse?.success && refreshResponse?.data) {
          const mappedReports = refreshResponse.data.map((r, index) => mapReportData(r, index));
          setReports(mappedReports);
          // Switch to resolved tab to show the resolved reports
          setActiveTab('resolved');
        }
      } catch (error) {
        message.error(error.message || 'Không thể khôi phục bài viết');
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!postToDelete) return;
    
    const { postId } = postToDelete;
    try {
      console.log('[ReportsManagement] Attempting to delete post:', postId);
      const deleteResponse = await adminDeletePost(postId);
      console.log('[ReportsManagement] Delete response:', deleteResponse);
      message.success('Đã xóa vĩnh viễn bài viết');
      
      setShowDeleteConfirm(false);
      setPostToDelete(null);
      
      // Refresh reports from server
      const response = await getAllReports();
      if (response?.success && response?.data) {
        const mappedReports = response.data.map((r, index) => mapReportData(r, index));
        setReports(mappedReports);
        // Switch to resolved tab to show the resolved reports
        setActiveTab('resolved');
      }
    } catch (error) {
      console.error('[ReportsManagement] Error deleting post:', error);
      console.error('[ReportsManagement] Error details:', {
        message: error.message,
        response: error.response,
        stack: error.stack
      });
      message.error(error.message || 'Không thể xóa bài viết');
    }
  };

  const handleViewDetails = (report) => {
    setSelectedReport(report);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedReport(null);
  };

  // Extract first URL from text
  const extractFirstUrl = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches && matches.length > 0 ? matches[0] : null;
  };

  // Parse shared lick ID from URL
  const parseSharedLickId = (url) => {
    if (!url) return null;
    const match = url.match(/\/licks\/([a-f0-9]{24})/i);
    return match ? match[1] : null;
  };

  const getViolationIcon = (type) => {
    // Map display text back to reason for icon
    if (type.includes('bản quyền') || type.includes('Copyright')) {
      return <AlertCircle className="text-red-400" size={18} />;
    } else if (type.includes('không phù hợp') || type.includes('Inappropriate')) {
      return <ShieldAlert className="text-orange-400" size={18} />;
    } else if (type.includes('Quấy rối') || type.includes('Impersonation')) {
      return <UserX className="text-purple-400" size={18} />;
    } else {
      return <AlertCircle className="text-gray-400" size={18} />;
    }
  };

  const pendingReports = reports.filter(r => r.isPending || r.status === 'pending');
  const resolvedReports = reports.filter(r => !r.isPending && r.status !== 'pending');
  
  const displayReports = activeTab === 'pending' ? pendingReports : resolvedReports;
  
  const filteredReports = displayReports.filter(report => {
    const searchLower = searchTerm.toLowerCase();
    return (
      report.reportedBy.toLowerCase().includes(searchLower) ||
      report.violationType.toLowerCase().includes(searchLower) ||
      report.reportedContent.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 animate-spin text-orange-400" size={48} />
          <p className="text-gray-400">Đang tải danh sách báo cáo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
          Reports Management
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'pending'
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Pending Reports
          {pendingReports.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
              {pendingReports.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('resolved')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'resolved'
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Resolved Reports
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search reports..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-transparent transition-all text-white placeholder-gray-400"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-800/50 border-b border-gray-700/50">
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-300">Người báo cáo</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-300">Loại vi phạm</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-300">Nội dung báo cáo</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-300">Hành động</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-300">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => (
                <tr 
                  key={report._id || report.id} 
                  className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="py-4 px-6">
                    <span className="font-medium text-white">{report.reportedBy}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      {getViolationIcon(report.violationType)}
                      <span className="text-gray-300">{report.violationType}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-gray-300">
                      <div className="font-medium text-white mb-1">{report.reportedContent}</div>
                      {report.uploaderDisplayName && (
                        <div className="text-sm text-gray-400">Người đăng: {report.uploaderDisplayName}</div>
                      )}
                      {report.host && (
                        <div className="text-sm text-gray-400">Host: {report.host}</div>
                      )}
                      {report.detail && (
                        <div className="text-sm text-gray-400 line-clamp-1">({report.detail})</div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {activeTab === 'pending' && report.post ? (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleAction(report._id || report.id, 'restore')}
                          className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs font-medium transition-all border border-green-500/30"
                        >
                          Khôi phục bài viết
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('[ReportsManagement] Delete button clicked for report:', report._id || report.id);
                            handleAction(report._id || report.id, 'delete');
                          }}
                          className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-medium transition-all border border-red-500/30"
                        >
                          Xóa bài viết
                        </button>
                      </div>
                    ) : (
                      <span className="px-4 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-sm font-medium border border-green-500/30 inline-block">
                        Đã xử lý
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <button
                      onClick={() => handleViewDetails(report)}
                      className="px-4 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-sm font-medium transition-all border border-blue-500/30 flex items-center gap-2"
                    >
                      <Eye size={16} />
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredReports.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <AlertCircle className="mx-auto mb-3 opacity-50" size={48} />
              <p className="text-lg">No reports found</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-700/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                Chi tiết báo cáo
              </h2>
              <button
                onClick={closeDetailModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Report Info */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                <h3 className="text-lg font-semibold text-white mb-4">Thông tin báo cáo</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Người báo cáo</p>
                    <p className="text-white font-medium">{selectedReport.reportedBy}</p>
                    {selectedReport.reporterUsername && selectedReport.reporterUsername !== selectedReport.reportedBy && (
                      <p className="text-xs text-gray-500">@{selectedReport.reporterUsername}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Loại vi phạm</p>
                    <div className="flex items-center gap-2">
                      {getViolationIcon(selectedReport.violationType)}
                      <p className="text-white font-medium">{selectedReport.violationType}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Trạng thái</p>
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      selectedReport.status === 'pending' 
                        ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30' 
                        : 'bg-green-600/20 text-green-400 border border-green-500/30'
                    }`}>
                      {selectedReport.status === 'pending' ? 'Đang chờ xử lý' : 'Đã xử lý'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Ngày báo cáo</p>
                    <p className="text-white font-medium">
                      {selectedReport.createdAt 
                        ? new Date(selectedReport.createdAt).toLocaleString('vi-VN')
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reported Content */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                <h3 className="text-lg font-semibold text-white mb-4">Nội dung báo cáo</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Loại nội dung</p>
                    <p className="text-white font-medium capitalize">{selectedReport.targetContentType}</p>
                  </div>
                  {selectedReport.post && (
                    <div className="space-y-3">
                      {/* Text Content */}
                      {selectedReport.post.textContent && (
                        <div>
                          <p className="text-sm text-gray-400 mb-2">Nội dung bài post</p>
                          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                            <p className="text-white whitespace-pre-wrap" style={{ fontSize: '15px', lineHeight: '1.6' }}>
                              {selectedReport.post.textContent}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Shared Lick from URL */}
                      {(() => {
                        const url = extractFirstUrl(selectedReport.post.textContent);
                        const sharedLickId = parseSharedLickId(url);
                        return sharedLickId ? (
                          <div>
                            <p className="text-sm text-gray-400 mb-2">Lick được chia sẻ</p>
                            <PostLickEmbed lickId={sharedLickId} url={url} />
                          </div>
                        ) : null;
                      })()}

                      {/* Attached Licks */}
                      {selectedReport.post.attachedLicks && Array.isArray(selectedReport.post.attachedLicks) && selectedReport.post.attachedLicks.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-400 mb-2">Lick đính kèm</p>
                          <div className="space-y-3">
                            {selectedReport.post.attachedLicks.map((lick) => {
                              const lickId = lick?._id || lick?.lick_id || lick;
                              if (!lickId) return null;
                              return (
                                <div key={lickId}>
                                  <PostLickEmbed lickId={lickId} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Media Files */}
                      {selectedReport.post.media && selectedReport.post.media.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-400 mb-2">File đính kèm ({selectedReport.post.media.length})</p>
                          <div className="grid grid-cols-2 gap-3">
                            {selectedReport.post.media.map((media, idx) => (
                              <div key={idx} className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/30">
                                {media.type === 'image' && media.url && (
                                  <img 
                                    src={media.url} 
                                    alt={`Image ${idx + 1}`}
                                    className="w-full h-32 object-cover rounded"
                                  />
                                )}
                                {media.type === 'video' && (
                                  <div className="w-full h-32 bg-gray-700 rounded flex items-center justify-center">
                                    <span className="text-gray-400 text-sm">Video</span>
                                  </div>
                                )}
                                {media.type === 'audio' && (
                                  <div className="w-full h-32 bg-gray-700 rounded flex items-center justify-center">
                                    <span className="text-gray-400 text-sm">Audio</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Link Preview */}
                      {selectedReport.post.linkPreview && (
                        <div>
                          <p className="text-sm text-gray-400 mb-2">Link preview</p>
                          <a 
                            href={selectedReport.post.linkPreview.url || '#'} 
                            target="_blank" 
                            rel="noreferrer"
                            className="block border border-gray-700 rounded-lg p-3 bg-gray-800/50 hover:bg-gray-800 transition-colors"
                          >
                            <div className="flex gap-3 items-center">
                              {selectedReport.post.linkPreview.image && (
                                <img 
                                  src={selectedReport.post.linkPreview.image} 
                                  alt="preview" 
                                  className="w-16 h-16 object-cover rounded"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-white font-semibold mb-1 truncate">
                                  {selectedReport.post.linkPreview.title || selectedReport.post.linkPreview.url}
                                </div>
                                <div className="text-gray-400 text-xs truncate">
                                  {selectedReport.post.linkPreview.url}
                                </div>
                                {selectedReport.post.linkPreview.description && (
                                  <div className="text-gray-500 text-xs mt-1 line-clamp-2">
                                    {selectedReport.post.linkPreview.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedReport.uploaderDisplayName && (
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Người đăng</p>
                      <p className="text-white font-medium">{selectedReport.uploaderDisplayName}</p>
                      {selectedReport.uploader && selectedReport.uploader !== selectedReport.uploaderDisplayName && (
                        <p className="text-xs text-gray-500">@{selectedReport.uploader}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {selectedReport.detail && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <h3 className="text-lg font-semibold text-white mb-4">Mô tả chi tiết</h3>
                  <p className="text-white whitespace-pre-wrap">{selectedReport.detail}</p>
                </div>
              )}

              {/* Post Author */}
              {selectedReport.uploaderDisplayName && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <p className="text-sm text-gray-400 mb-1">Người đăng bài post</p>
                  <p className="text-white font-medium">{selectedReport.uploaderDisplayName}</p>
                  {selectedReport.uploader && selectedReport.uploader !== selectedReport.uploaderDisplayName && (
                    <p className="text-xs text-gray-500 mt-1">@{selectedReport.uploader}</p>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {activeTab === 'pending' && selectedReport.post && (
              <div className="mt-6 flex gap-3 pt-6 border-t border-gray-700/50">
                <button
                  onClick={() => {
                    handleAction(selectedReport._id || selectedReport.id, 'restore');
                    closeDetailModal();
                  }}
                  className="flex-1 px-4 py-2.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg font-medium transition-all border border-green-500/30"
                >
                  Khôi phục bài viết
                </button>
                <button
                  onClick={() => {
                    handleAction(selectedReport._id || selectedReport.id, 'delete');
                    closeDetailModal();
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-medium transition-all border border-red-500/30"
                >
                  Xóa bài viết
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteConfirm}
        title="Xác nhận xóa vĩnh viễn"
        onOk={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setPostToDelete(null);
        }}
        okText="Xóa"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <p>Bạn có chắc chắn muốn xóa vĩnh viễn bài viết này? Hành động này không thể hoàn tác.</p>
      </Modal>
    </div>
  );
};

export default ReportsManagement;