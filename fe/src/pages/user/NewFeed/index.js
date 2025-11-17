import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Avatar, Button, Typography, Space, Input, List, Divider, Tag, Spin, Empty, message, Modal, Upload, Select, Dropdown, Radio } from 'antd';
import { LikeOutlined, MessageOutlined, PlusOutlined, HeartOutlined, CrownOutlined, UserOutlined, MoreOutlined, FlagOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listPosts, createPost, getPostById, updatePost, deletePost } from '../../../services/user/post';
import { likePost, unlikePost, createPostComment, getPostStats, getAllPostComments, getPostLikes } from '../../../services/user/post';
import { followUser, unfollowUser, getFollowSuggestions, getProfileById, getFollowingList, getMyProfile } from '../../../services/user/profile';
import { ensureConversationWith } from '../../../services/dmService';
import { onPostCommentNew, offPostCommentNew, onPostArchived, offPostArchived, joinRoom } from '../../../services/user/socketService';
import { getMyLicks } from '../../../services/user/lickService';
import { reportPost, checkPostReport } from '../../../services/user/reportService';
import PostLickEmbed from '../../../components/PostLickEmbed';

const { Title, Text } = Typography;
const WavePlaceholder = () => (
  <div
    style={{
      height: 120,
      background: '#1a1a1a',
      borderRadius: 8,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div style={{ 
      position: 'absolute', 
      bottom: 0, 
      left: 0, 
      right: 0, 
      height: '100%',
      display: 'flex',
      alignItems: 'end',
      gap: 2,
      padding: '8px 12px'
    }}>
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: `${Math.random() * 80 + 20}px`,
            background: '#ff7a45',
            borderRadius: 1.5,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 12,
          height: 12,
          background: '#ff7a45',
          borderRadius: '50%',
        }}
      />
    </div>
  </div>
);

const Suggestion = ({ user, following, loading, onFollow }) => (
  <div style={{ display: 'flex', alignItems: 'center', padding: '6px 0', width: '100%' }}>
    <Space size={12}>
      <Avatar 
        size={36} 
        src={user.avatarUrl && typeof user.avatarUrl === 'string' && user.avatarUrl.trim() !== '' ? user.avatarUrl : undefined} 
        style={{ background: '#555' }}
      >
        {(user.displayName || user.username || 'U')[0]}
      </Avatar>
      <div>
        <Text strong style={{ color: '#fff' }}>{user.displayName || user.username}</Text>
        <div style={{ fontSize: 12, color: '#f3f5f7ff' }}>{Number(user.followersCount || 0)} người theo dõi</div>
      </div>
    </Space>
    {following ? (
      <Button 
        size="middle" 
        type="primary" 
        loading={loading}
        onClick={() => onFollow(user.id)}
        style={{ marginLeft: 'auto', borderRadius: 999 }} 
      >
        Đang theo dõi
      </Button>
    ) : (
      <Button 
        shape="circle" 
        size="large" 
        type="primary" 
        loading={loading}
        onClick={() => onFollow(user.id)}
        icon={<PlusOutlined />} 
        style={{ marginLeft: 'auto' }} 
      />
    )}
  </div>
);

const LeaderboardItem = ({ name, icon, iconColor = '#111' }) => (
  <Space>
    <div style={{ 
      width: 36, 
      height: 36, 
      background: iconColor, 
      borderRadius: 8, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontSize: 12,
      fontWeight: 'bold',
      color: '#fff'
    }}>
      {icon}
    </div>
    <div>
      <Text strong style={{ color: '#fff' }}>{name}</Text>
      <div style={{ fontSize: 12, color: '#9ca3af' }}>Tên người tạo</div>
    </div>
  </Space>
);

const formatTime = (isoString) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return '';
  }
};

const formatTimeAgo = (isoString) => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  } catch {
    return '';
  }
};

const sortCommentsDesc = (comments) => {
  if (!Array.isArray(comments)) return [];
  return [...comments].sort((a, b) => {
    const timeA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA; // descending order (newest first)
  });
};

const limitToNewest3 = (comments) => {
  if (!Array.isArray(comments)) return [];
  const sorted = sortCommentsDesc(comments);
  return sorted.slice(0, 3);
};

const NewsFeed = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = React.useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newText, setNewText] = useState('');
  const [files, setFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  const [maxChars] = useState(300);
  const [linkPreview, setLinkPreview] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [availableLicks, setAvailableLicks] = useState([]);
  const [loadingLicks, setLoadingLicks] = useState(false);
  const [selectedLickIds, setSelectedLickIds] = useState([]);
  const [previewCache, setPreviewCache] = useState({}); // url -> {title, thumbnailUrl}
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentPostId, setCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [likingPostId, setLikingPostId] = useState(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [postIdToStats, setPostIdToStats] = useState({}); // postId -> {likesCount, commentsCount}
  const [postIdToComments, setPostIdToComments] = useState({}); // postId -> comments[]
  const [postIdToLiked, setPostIdToLiked] = useState({}); // postId -> boolean
  const [postIdToCommentInput, setPostIdToCommentInput] = useState({}); // postId -> string
  const [modalPost, setModalPost] = useState(null);
  const [userIdToFollowing, setUserIdToFollowing] = useState({}); // userId -> boolean
  const [userIdToFollowLoading, setUserIdToFollowLoading] = useState({}); // userId -> boolean
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [likesModalOpen, setLikesModalOpen] = useState(false);
  const [likesPostId, setLikesPostId] = useState(null);
  const [likesList, setLikesList] = useState([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportPostId, setReportPostId] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [postIdToReported, setPostIdToReported] = useState({}); // postId -> boolean
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editText, setEditText] = useState('');
  const [editing, setEditing] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [currentUserId] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return undefined;
      const obj = JSON.parse(raw);
      const u = obj?.user || obj;
      return u?.id || u?.userId || u?._id;
    } catch {
      return undefined;
    }
  });

  const [currentUser, setCurrentUser] = useState(() => {
    // Initialize from localStorage immediately
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const obj = JSON.parse(raw);
        return obj?.user || obj;
      }
    } catch {}
    return null;
  });
  const [loadingProfile, setLoadingProfile] = useState(false);

  const extractFirstUrl = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  };

  const getYoutubeId = (urlString) => {
    try {
      const u = new URL(urlString);
      if (u.hostname.includes('youtu.be')) {
        return u.pathname.replace('/', '');
      }
      if (u.hostname.includes('youtube.com')) {
        return u.searchParams.get('v');
      }
      return null;
    } catch {
      return null;
    }
  };

  const parseSharedLickId = (urlString) => {
    if (!urlString) return null;
    try {
      const base =
        typeof window !== 'undefined' && window.location
          ? window.location.origin
          : 'https://melodyhub.app';
      const normalised = urlString.startsWith('http')
        ? new URL(urlString)
        : new URL(urlString, base);
      const segments = normalised.pathname.split('/').filter(Boolean);
      if (segments.length >= 2 && segments[0] === 'licks') {
        return segments[1];
      }
      return null;
    } catch {
      return null;
    }
  };

  const deriveThumbnail = (urlString) => {
    const ytId = getYoutubeId(urlString);
    if (ytId) {
      return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }
    return '';
  };

  const handleLike = async (postId) => {
    try {
      setLikingPostId(postId);
      const isLiked = !!postIdToLiked[postId];
      if (isLiked) {
        // Unlike
        await unlikePost(postId);
        setPostIdToLiked((prev) => ({ ...prev, [postId]: false }));
        setPostIdToStats((prev) => {
          const cur = prev[postId] || { likesCount: 0, commentsCount: 0 };
          const nextLikes = Math.max((cur.likesCount || 0) - 1, 0);
          return { ...prev, [postId]: { ...cur, likesCount: nextLikes } };
        });
        message.success('Đã bỏ thích');
      } else {
        // Like
        await likePost(postId);
        setPostIdToLiked((prev) => ({ ...prev, [postId]: true }));
        setPostIdToStats((prev) => {
          const cur = prev[postId] || { likesCount: 0, commentsCount: 0 };
          return { ...prev, [postId]: { ...cur, likesCount: (cur.likesCount || 0) + 1 } };
        });
        message.success('Đã thích bài viết');
      }
      // reconcile with server (non-blocking)
      getPostStats(postId).then((res) => {
        const stats = res?.data || {};
        setPostIdToStats((prev) => ({ ...prev, [postId]: stats }));
      }).catch(() => {});
    } catch (e) {
      message.error(e.message || 'Không thể thích bài viết');
    } finally {
      setLikingPostId(null);
    }
  };

  const getAuthorId = (post) => {
    // Ensure we always return a string ID, never an object
    const userId = post?.userId;
    if (!userId) return '';
    // If userId is already a string/number, return it as string
    if (typeof userId === 'string' || typeof userId === 'number') {
      return userId.toString();
    }
    // If userId is an object, extract _id or id
    if (typeof userId === 'object') {
      const id = userId._id || userId.id;
      if (id) return id.toString();
    }
    return '';
  };

  const toggleFollow = async (uid) => {
    if (!uid) return;
    try {
      setUserIdToFollowLoading((prev) => ({ ...prev, [uid]: true }));
      const isFollowing = !!userIdToFollowing[uid];
      if (isFollowing) {
        await unfollowUser(uid);
        setUserIdToFollowing((prev) => ({ ...prev, [uid]: false }));
        message.success('Đã bỏ theo dõi');
      } else {
        await followUser(uid);
        setUserIdToFollowing((prev) => ({ ...prev, [uid]: true }));
        message.success('Đã theo dõi');
      }
    } catch (e) {
      const msg = e?.message || '';
      if (!userIdToFollowing[uid] && msg.toLowerCase().includes('already following')) {
        // BE trả về 400 nếu đã theo dõi trước đó; đồng bộ UI thành đang theo dõi
        setUserIdToFollowing((prev) => ({ ...prev, [uid]: true }));
        message.success('Đã theo dõi');
      } else {
        message.error(msg || 'Thao tác thất bại');
      }
    } finally {
      setUserIdToFollowLoading((prev) => ({ ...prev, [uid]: false }));
    }
  };

  const loadSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      const res = await getFollowSuggestions(10);
      const list = (res?.data || [])
        .filter((u) => !!u?.id && (!currentUserId || u.id.toString() !== currentUserId.toString()))
        .slice(0, 5);
      const map = {};
      list.forEach((u) => { map[u.id] = false; }); // BE đã lọc CHƯA follow
      setUserIdToFollowing((prev) => ({ ...prev, ...map }));
      setSuggestions(list);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Load suggestions failed:', e.message);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => { loadSuggestions(); }, []);

  const openComment = async (postId) => {
    setCommentPostId(postId);
    setCommentText('');
    const p = items.find((it) => it._id === postId) || null;
    setModalPost(p);
    setCommentOpen(true);
    // Fetch tất cả comments để hiển thị trong modal (không giới hạn 3)
    try {
      const all = await getAllPostComments(postId);
      setPostIdToComments((prev) => ({ ...prev, [postId]: Array.isArray(all) ? sortCommentsDesc(all) : [] }));
    } catch (e) {
      // Nếu fetch thất bại, vẫn giữ comments hiện có
      console.warn('Failed to fetch all comments for modal:', e);
    }
  };

  const openLikesModal = async (postId) => {
    setLikesPostId(postId);
    setLikesModalOpen(true);
    setLikesList([]);
    try {
      setLikesLoading(true);
      const res = await getPostLikes(postId, { page: 1, limit: 100 });
      const users = res?.data?.users || [];
      setLikesList(users);
    } catch (e) {
      message.error('Không thể tải danh sách người đã thích');
      console.error('Failed to fetch likes:', e);
    } finally {
      setLikesLoading(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) {
      message.warning('Vui lòng nhập bình luận');
      return;
    }
    try {
      setCommentSubmitting(true);
      await createPostComment(commentPostId, { comment: commentText.trim() });
      message.success('Đã gửi bình luận');
      setCommentOpen(false);
      setCommentText('');
      // refresh comments and counts
      const all = await getAllPostComments(commentPostId);
      setPostIdToComments((prev) => ({ ...prev, [commentPostId]: all }));
      const statsRes = await getPostStats(commentPostId);
      setPostIdToStats((prev) => ({ ...prev, [commentPostId]: statsRes?.data || prev[commentPostId] }));
    } catch (e) {
      message.error(e.message || 'Không thể gửi bình luận');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const submitInlineComment = async (postId) => {
    const text = (postIdToCommentInput[postId] || '').trim();
    if (!text) { message.warning('Vui lòng nhập bình luận'); return; }
    try {
      setCommentSubmitting(true);
      await createPostComment(postId, { comment: text });
      setPostIdToCommentInput((prev) => ({ ...prev, [postId]: '' }));
      const all = await getAllPostComments(postId);
      const limited = limitToNewest3(Array.isArray(all) ? all : []);
      setPostIdToComments((prev) => ({ ...prev, [postId]: limited }));
      const statsRes = await getPostStats(postId);
      setPostIdToStats((prev) => ({ ...prev, [postId]: statsRes?.data || prev[postId] }));
    } catch (e) {
      message.error(e.message || 'Không thể gửi bình luận');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const openReportModal = async (postId) => {
    setReportPostId(postId);
    setReportReason('');
    setReportDescription('');
    setReportModalOpen(true);
    // Check if user has already reported this post
    try {
      const res = await checkPostReport(postId);
      if (res?.success && res?.data?.hasReported) {
        setPostIdToReported((prev) => ({ ...prev, [postId]: true }));
      }
    } catch (e) {
      // Ignore error, just proceed
    }
  };

  const submitReport = async () => {
    if (!reportReason) {
      message.warning('Vui lòng chọn lý do báo cáo');
      return;
    }
    try {
      setReportSubmitting(true);
      await reportPost(reportPostId, {
        reason: reportReason,
        description: reportDescription.trim() || '',
      });
      message.success('Đã gửi báo cáo thành công');
      setPostIdToReported((prev) => ({ ...prev, [reportPostId]: true }));
      setReportModalOpen(false);
      setReportReason('');
      setReportDescription('');
    } catch (e) {
      message.error(e.message || 'Không thể gửi báo cáo');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleHidePost = (postId) => {
    Modal.confirm({
      title: 'Xác nhận lưu trữ bài viết',
      content: 'Bạn có chắc chắn muốn lưu trữ bài viết này? Bài viết sẽ được chuyển vào kho lưu trữ và sẽ bị xóa vĩnh viễn sau 30 ngày nếu không khôi phục.',
      okText: 'Lưu trữ',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          setDeletingPostId(postId);
          await deletePost(postId);
          message.success('Đã lưu trữ bài viết. Bài viết sẽ bị xóa vĩnh viễn sau 30 ngày nếu không khôi phục.');
          setItems((prev) => prev.filter((p) => p._id !== postId));
        } catch (e) {
          message.error(e.message || 'Không thể lưu trữ bài viết');
        } finally {
          setDeletingPostId(null);
        }
      },
    });
  };

  const openEditModal = (post) => {
    setEditingPost(post);
    setEditText(post?.textContent || '');
    setEditModalOpen(true);
  };

  const handleUpdatePost = async () => {
    if (!editText.trim()) {
      message.warning('Vui lòng nhập nội dung');
      return;
    }
    if (!editingPost?._id) {
      message.error('Không tìm thấy bài viết');
      return;
    }
    try {
      setEditing(true);
      const payload = {
        postType: 'status_update',
        textContent: editText.trim(),
      };
      await updatePost(editingPost._id, payload);
      message.success('Cập nhật bài viết thành công');
      setEditModalOpen(false);
      setEditingPost(null);
      setEditText('');
      // Refresh the feed
      fetchData(1);
      setPage(1);
    } catch (e) {
      message.error(e.message || 'Cập nhật bài viết thất bại');
    } finally {
      setEditing(false);
    }
  };

  // Join socket rooms for all posts currently in the feed to receive inline updates
  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return;
    try {
      items.forEach((it) => it?._id && joinRoom(`post:${it._id}`));
    } catch (e) {
      // ignore join errors
    }
  }, [items]);

  // Global listener: update inline lists and counters when any post gets a new comment
  useEffect(() => {
    const handler = (payload) => {
      if (!payload?.postId || !payload?.comment) return;
      const postId = payload.postId;
      const comment = payload.comment;
      // Đảm bảo comment mới có createdAt (nếu chưa có thì dùng thời gian hiện tại)
      if (!comment.createdAt) {
        comment.createdAt = new Date().toISOString();
      }
      setPostIdToStats((prev) => {
        const cur = prev[postId] || { likesCount: 0, commentsCount: 0 };
        return { ...prev, [postId]: { ...cur, commentsCount: (cur.commentsCount || 0) + 1 } };
      });
      // Cập nhật danh sách comment và chỉ giữ lại 3 comment gần nhất
      setPostIdToComments((prev) => {
        const cur = Array.isArray(prev[postId]) ? prev[postId] : [];
        // Thêm comment mới vào đầu danh sách và giới hạn 3 comment gần nhất
        return { ...prev, [postId]: limitToNewest3([comment, ...cur]) };
      });
    };
    onPostCommentNew(handler);
    return () => {
      offPostCommentNew(handler);
    };
  }, []);

  // Listen for post archived event (realtime removal from feed)
  useEffect(() => {
    const handler = (payload) => {
      console.log('[NewsFeed] Received post:archived event:', payload);
      if (!payload?.postId) {
        console.warn('[NewsFeed] post:archived event missing postId');
        return;
      }
      const postId = payload.postId.toString();
      console.log('[NewsFeed] Removing post from feed:', postId);
      
      // Remove post from feed immediately
      setItems((prev) => {
        console.log('[NewsFeed] Current items before filter:', prev.length);
        const filtered = prev.filter((p) => {
          const pId = p._id?.toString() || p._id;
          const matches = pId !== postId;
          if (!matches) {
            console.log('[NewsFeed] Found matching post to remove:', pId, '===', postId);
          }
          return matches;
        });
        console.log('[NewsFeed] After filter, items count:', filtered.length, 'removed:', prev.length - filtered.length);
        return filtered;
      });
      
      // Clean up related state
      setPostIdToStats((prev) => {
        const newState = { ...prev };
        delete newState[postId];
        return newState;
      });
      setPostIdToLiked((prev) => {
        const newState = { ...prev };
        delete newState[postId];
        return newState;
      });
      setPostIdToComments((prev) => {
        const newState = { ...prev };
        delete newState[postId];
        return newState;
      });
      message.info('Một bài viết đã bị ẩn do vi phạm quy định cộng đồng');
    };
    
    console.log('[NewsFeed] Setting up post:archived listener');
    onPostArchived(handler);
    return () => {
      console.log('[NewsFeed] Cleaning up post:archived listener');
      offPostArchived(handler);
    };
  }, []);

  // Listen realtime comments for the currently opened post (modal)
  useEffect(() => {
    if (!commentOpen || !commentPostId) return;
    const handler = (payload) => {
      if (!payload || payload.postId !== commentPostId) return;
      const newComment = payload.comment;
      // Đảm bảo comment mới có createdAt
      if (!newComment.createdAt) {
        newComment.createdAt = new Date().toISOString();
      }
      // Trong modal, hiển thị tất cả comments (không giới hạn 3)
      setPostIdToComments((prev) => {
        const cur = prev[commentPostId] || [];
        return { ...prev, [commentPostId]: sortCommentsDesc([newComment, ...cur]) };
      });
      setPostIdToStats((prev) => {
        const cur = prev[commentPostId] || { likesCount: 0, commentsCount: 0 };
        return { ...prev, [commentPostId]: { ...cur, commentsCount: (cur.commentsCount || 0) + 1 } };
      });
    };
    onPostCommentNew(handler);
    return () => {
      offPostCommentNew(handler);
    };
  }, [commentOpen, commentPostId]);

  // Lắng nghe event từ NotificationBell để mở modal comment
  useEffect(() => {
    const handleOpenCommentModal = (event) => {
      const { postId } = event.detail || {};
      if (postId) {
        // Nếu post chưa có trong items, cần fetch trước
        const post = items.find((it) => it._id === postId);
        if (post) {
          openComment(postId);
        } else {
          // Nếu post chưa có, fetch post và mở modal
          getPostById(postId).then((result) => {
            if (result.success && result.data) {
              // Thêm post vào items nếu chưa có
              setItems((prev) => {
                const exists = prev.some((it) => it._id === postId);
                return exists ? prev : [result.data, ...prev];
              });
              openComment(postId);
            }
          }).catch((err) => {
            console.error('Lỗi khi lấy bài viết:', err);
            message.error('Không tìm thấy bài viết');
          });
        }
      }
    };

    window.addEventListener('openPostCommentModal', handleOpenCommentModal);
    return () => {
      window.removeEventListener('openPostCommentModal', handleOpenCommentModal);
    };
  }, [items]);

  // Kiểm tra location.state khi component mount hoặc location thay đổi
  useEffect(() => {
    if (location.state?.openCommentModal && location.state?.postId) {
      const { postId } = location.state;
      // Clear state để tránh mở lại khi refresh
      navigate(location.pathname, { replace: true, state: {} });
      
      // Nếu post chưa có trong items, fetch trước
      const post = items.find((it) => it._id === postId);
      if (post) {
        openComment(postId);
      } else {
        // Nếu post chưa có, fetch post và mở modal
        getPostById(postId).then((result) => {
          if (result.success && result.data) {
            // Thêm post vào items nếu chưa có
            setItems((prev) => {
              const exists = prev.some((it) => it._id === postId);
              return exists ? prev : [result.data, ...prev];
            });
            openComment(postId);
          }
        }).catch((err) => {
          console.error('Lỗi khi lấy bài viết:', err);
          message.error('Không tìm thấy bài viết');
        });
      }
    }
  }, [location.state, items]);

  const fetchProviderOEmbed = async (url) => {
    const tryFetch = async (endpoint) => {
      const res = await fetch(`${endpoint}${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('oEmbed failed');
      return res.json();
    };
    // Ordered list of oEmbed providers to try
    const endpoints = [
      'https://noembed.com/embed?url=',
      'https://soundcloud.com/oembed?format=json&url=',
      'https://vimeo.com/api/oembed.json?url=',
      'https://open.spotify.com/oembed?url=',
    ];
    for (const ep of endpoints) {
      try {
        const data = await tryFetch(ep);
        return {
          title: data.title || url,
          thumbnailUrl: data.thumbnail_url || deriveThumbnail(url),
          provider: data.provider_name || '',
          author: data.author_name || '',
          type: data.type || 'link',
        };
      } catch (_) {
        // continue
      }
    }
    return null;
  };

  const fetchOgTags = async (url) => {
    try {
      const proxied = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`;
      const res = await fetch(proxied);
      if (!res.ok) return null;
      const text = await res.text();
      const ogImageMatch = text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
      return {
        title: (titleMatch && titleMatch[1]) || url,
        thumbnailUrl: (ogImageMatch && ogImageMatch[1]) || deriveThumbnail(url),
        provider: '',
        author: '',
        type: 'link',
      };
    } catch {
      return null;
    }
  };

  const resolvePreview = async (url) => {
    // cache first
    if (previewCache[url]) return previewCache[url];
    const fromOembed = await fetchProviderOEmbed(url);
    const data = fromOembed || (await fetchOgTags(url)) || { title: url, thumbnailUrl: deriveThumbnail(url) };
    setPreviewCache((prev) => ({ ...prev, [url]: data }));
    return data;
  };

  useEffect(() => {
    const url = extractFirstUrl(newText);
    if (!url) {
      setLinkPreview(null);
      return;
    }
    let aborted = false;
    setLinkLoading(true);
    resolvePreview(url)
      .then((data) => { if (!aborted) setLinkPreview({ url, ...data }); })
      .finally(() => { if (!aborted) setLinkLoading(false); });
    return () => { aborted = true; };
  }, [newText]);

  const fetchData = async (p = page, l = limit) => {
    setLoading(true);
    setError('');
    try {
      const res = await listPosts({ page: p, limit: l });
      // Posts are already sorted by backend: engagement score (likes + comments) descending, then createdAt descending
      // Frontend displays posts in the exact order received from backend - no additional sorting
      const posts = res?.data?.posts || [];
      const totalPosts = res?.data?.pagination?.totalPosts || 0;
      if (p === 1) {
        setItems(posts);
      } else {
        // Append new posts to existing list (maintain backend order)
        setItems((prev) => [...prev, ...posts]);
      }
      setTotal(totalPosts);
      const totalPages = Math.ceil(totalPosts / l);
      setHasMore(p < totalPages);

      // Set liked status for each post based on isLiked from backend
      const likedMap = {};
      posts.forEach((post) => {
        if (post._id && post.isLiked !== undefined) {
          likedMap[post._id] = !!post.isLiked;
        }
      });
      setPostIdToLiked((prev) => ({ ...prev, ...likedMap }));

      // hydrate following status for authors in loaded posts
      try {
        const extractUserId = (post) => {
          const userId = post?.userId;
          if (!userId) return null;
          if (typeof userId === 'string' || typeof userId === 'number') {
            return userId.toString();
          }
          if (typeof userId === 'object') {
            const id = userId._id || userId.id;
            if (id) return id.toString();
          }
          return null;
        };
        const uniqueUserIds = Array.from(new Set((posts || []).map(extractUserId).filter(Boolean)));
        const results = await Promise.all(uniqueUserIds.map(async (uid) => {
          try {
            const r = await getProfileById(uid);
            return { uid, isFollowing: !!r?.data?.isFollowing };
          } catch {
            return { uid, isFollowing: false };
          }
        }));
        const map = {};
        results.forEach(({ uid, isFollowing }) => { map[uid] = isFollowing; });
        setUserIdToFollowing((prev) => ({ ...prev, ...map }));
      } catch {}
    } catch (e) {
      setError(e.message || 'Lỗi tải bài viết');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enrich loaded posts with preview thumbnails if missing
  useEffect(() => {
    const enrich = async () => {
      // fetch stats and initial comments for each post
      for (const p of items) {
        // fetch stats
        getPostStats(p._id).then((res) => {
          setPostIdToStats((prev) => ({ ...prev, [p._id]: res?.data || prev[p._id] }));
        }).catch(() => {});
        // fetch all top-level comments and limit to 3 newest
        getAllPostComments(p._id).then((list) => {
          const limited = limitToNewest3(Array.isArray(list) ? list : []);
          setPostIdToComments((prev) => ({ ...prev, [p._id]: limited }));
        }).catch(() => {});
      }
      const urls = items
        .map((p) => p?.linkPreview?.url)
        .filter((u) => u && !previewCache[u]);
      for (const url of urls) {
        await resolvePreview(url);
      }
    };
    if (items && items.length) enrich();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && hasMore) {
        const next = page + 1;
        setPage(next);
        fetchData(next, limit);
      }
    }, { rootMargin: '200px' });
    const el = loaderRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [loading, hasMore, page, limit]);

  // Fetch current user profile
  useEffect(() => {
    const fetchMyProfile = async () => {
      try {
        setLoadingProfile(true);
        const res = await getMyProfile();
        console.log('[NewsFeed] getMyProfile response:', res);
        
        // Handle different response formats - same as Personal.js
        const userData = res?.data?.user || res?.user || null;
        
        if (userData) {
          console.log('[NewsFeed] Setting currentUser from API:', userData);
          setCurrentUser(userData);
        } else {
          console.log('[NewsFeed] No user data from API, keeping localStorage value');
        }
      } catch (error) {
        console.error('[NewsFeed] Error fetching profile:', error);
        // Fallback to localStorage
        try {
          const raw = localStorage.getItem('user');
          if (raw) {
            const obj = JSON.parse(raw);
            setCurrentUser(obj?.user || obj);
          }
        } catch {}
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchMyProfile();
  }, []);

  // Fetch following users
  useEffect(() => {
    const fetchFollowing = async () => {
      if (!currentUserId) return;
      try {
        setLoadingFollowing(true);
        const res = await getFollowingList('', 50);
        console.log('[NewsFeed] getFollowingList response:', res);
        if (res?.success && Array.isArray(res.data)) {
          console.log('[NewsFeed] Found following users:', res.data.length);
          setFollowingUsers(res.data);
        } else {
          console.log('[NewsFeed] No following users or invalid response');
          setFollowingUsers([]);
        }
      } catch (error) {
        console.error('[NewsFeed] Error fetching following users:', error);
        setFollowingUsers([]);
      } finally {
        setLoadingFollowing(false);
      }
    };
    fetchFollowing();
  }, [currentUserId]);

  const fetchActiveLicks = async () => {
    try {
      setLoadingLicks(true);
      const res = await getMyLicks({ status: 'active', limit: 100 });
      if (res?.success && Array.isArray(res.data)) {
        // Format data để Select component có thể sử dụng
        const formattedLicks = res.data.map((lick) => ({
          value: lick.lick_id || lick._id,
          label: lick.title || 'Untitled Lick',
          ...lick
        }));
        setAvailableLicks(formattedLicks);
      } else {
        setAvailableLicks([]);
      }
    } catch (e) {
      console.error('Error fetching active licks:', e);
      setAvailableLicks([]);
    } finally {
      setLoadingLicks(false);
    }
  };

  const handleModalOpen = () => {
    setIsModalOpen(true);
    if (currentUserId) {
      fetchActiveLicks();
    }
  };

  const handleModalClose = () => {
    if (!posting) {
      setIsModalOpen(false);
      setSelectedLickIds([]);
    }
  };

  const handleCreatePost = async () => {
    if (!newText.trim()) {
      message.warning('Vui lòng nhập nội dung');
      return;
    }
    try {
      setPosting(true);
      // eslint-disable-next-line no-console
      console.log('[UI] Click Đăng, preparing payload...');
      // Không chặn khi thiếu userId ở UI; service sẽ tự chèn từ localStorage
      // và BE sẽ trả lỗi rõ ràng nếu thiếu
      let newPost = null;
      if (files.length > 0) {
        const form = new FormData();
        form.append('postType', 'status_update');
        form.append('textContent', newText.trim());
        if (linkPreview) {
          form.append('linkPreview', JSON.stringify(linkPreview));
        }
        if (selectedLickIds.length > 0) {
          form.append('attachedLickIds', JSON.stringify(selectedLickIds));
        }
        files.forEach((f) => {
          if (f.originFileObj) form.append('media', f.originFileObj);
        });
        // eslint-disable-next-line no-console
        console.log('[UI] Sending multipart createPost...', { fileCount: files.length, lickCount: selectedLickIds.length });
        const response = await createPost(form);
        // Service trả về { success: true, data: post } từ axios response.data
        // axios đã unwrap response.data rồi, nên response chính là { success: true, data: post }
        newPost = response?.data || response;
        // eslint-disable-next-line no-console
        console.log('[UI] Post created response:', { response, newPost, hasId: !!newPost?._id });
      } else {
        // eslint-disable-next-line no-console
        console.log('[UI] Sending JSON createPost...');
        const payload = { postType: 'status_update', textContent: newText.trim(), linkPreview };
        if (selectedLickIds.length > 0) {
          payload.attachedLickIds = selectedLickIds;
        }
        const response = await createPost(payload);
        // Service trả về { success: true, data: post } từ axios response.data
        // axios đã unwrap response.data rồi, nên response chính là { success: true, data: post }
        newPost = response?.data || response;
        // eslint-disable-next-line no-console
        console.log('[UI] Post created response:', { response, newPost, hasId: !!newPost?._id });
      }
      
      // Thêm post mới vào đầu danh sách ngay lập tức
      if (newPost && newPost._id) {
        // eslint-disable-next-line no-console
        console.log('[UI] Adding new post to feed:', newPost._id);
        setItems((prev) => {
          // Kiểm tra xem post đã tồn tại chưa (tránh duplicate)
          const exists = prev.some((p) => p._id === newPost._id);
          if (exists) {
            // eslint-disable-next-line no-console
            console.log('[UI] Post already exists, skipping');
            return prev;
          }
          // Thêm post mới vào đầu danh sách
          // eslint-disable-next-line no-console
          console.log('[UI] Adding post to beginning of list');
          return [newPost, ...prev];
        });
        
        // Hydrate following status cho author của post mới
        const extractAuthorId = (post) => {
          const userId = post?.userId;
          if (!userId) return null;
          if (typeof userId === 'string' || typeof userId === 'number') {
            return userId.toString();
          }
          if (typeof userId === 'object') {
            const id = userId._id || userId.id;
            if (id) return id.toString();
          }
          return null;
        };
        const authorId = extractAuthorId(newPost);
        if (authorId && currentUserId && authorId === currentUserId.toString()) {
          // Post của chính mình, không cần check following
        } else if (authorId) {
          try {
            const profileRes = await getProfileById(authorId);
            setUserIdToFollowing((prev) => ({ ...prev, [authorId]: !!profileRes?.data?.isFollowing }));
          } catch {
            // Ignore error
          }
        }
        
        // Initialize stats cho post mới
        setPostIdToStats((prev) => ({
          ...prev,
          [newPost._id]: { likesCount: 0, commentsCount: 0 }
        }));
        setPostIdToLiked((prev) => ({ ...prev, [newPost._id]: false }));
        setPostIdToComments((prev) => ({ ...prev, [newPost._id]: [] }));
        
        // Join socket room cho post mới
        try {

        } catch {
          // Ignore socket errors
        }
      }
      
      setNewText('');
      setFiles([]);
      setSelectedLickIds([]);
      setIsModalOpen(false);
      message.success('Đăng bài thành công');
      // KHÔNG fetch lại data - post mới đã được thêm vào đầu danh sách
      // Chỉ khi refresh trang thì mới sort theo engagement
    } catch (e) {
      message.error(e.message || 'Đăng bài thất bại');
    } finally {
      setPosting(false);
    }
  };

  return (
    <>
    <style>{`
      .hide-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .hide-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `}</style>
    <div style={{ 
      maxWidth: 1680, 
      margin: '0 auto', 
      padding: '24px 24px',
      background: '#0a0a0a',
      minHeight: '100vh',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'minmax(0, 1.2fr) 460px', 
        gap: 32,
        flex: 1,
        overflow: 'hidden',
        minHeight: 0
      }}>
        <div style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          height: '100%',
          paddingRight: 8,
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE and Edge
        }} className="hide-scrollbar">
          <div style={{ 
            marginBottom: 20, 
            background: '#0f0f10', 
            border: '1px solid #1f1f1f',
            borderRadius: 8,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}             onClick={handleModalOpen}>
            {(() => {
              // Get user data with fallback to localStorage
              const user = currentUser || (() => {
                try {
                  const raw = localStorage.getItem('user');
                  if (raw) {
                    const obj = JSON.parse(raw);
                    return obj?.user || obj;
                  }
                } catch {}
                return null;
              })();
              
              const avatarUrl = user?.avatarUrl || user?.avatar_url;
              const displayName = user?.displayName || user?.username || '';
              const initial = displayName ? displayName[0].toUpperCase() : 'U';
              
              // Only use src if avatarUrl is a valid non-empty string
              const validAvatarUrl = avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '' && avatarUrl !== '' 
                ? avatarUrl.trim() 
                : null;
              
              console.log('[NewsFeed] Avatar render:', { 
                hasUser: !!user, 
                avatarUrl, 
                validAvatarUrl, 
                displayName, 
                initial 
              });
              
              return (
                <Avatar 
                  size={40} 
                  src={validAvatarUrl || undefined}
                  style={{ backgroundColor: '#722ed1' }}
                >
                  {initial}
                </Avatar>
              );
            })()}
            <Input.TextArea 
              placeholder="Có gì mới ?" 
              autoSize={{ minRows: 2, maxRows: 8 }}
              style={{ 
                flex: 1,
                background: '#fff',
                border: 'none',
                borderRadius: 10,
                minHeight: 56,
                fontSize: 16
              }}
              readOnly
            />
            <Button type="primary" size="large" style={{ borderRadius: 999, background: '#1890ff', padding: '0 22px', height: 44 }} onClick={(e) => { e.stopPropagation(); handleModalOpen(); }}>Post</Button>
          </div>

          <Modal
            open={isModalOpen}
            title={<span style={{ color: '#fff', fontWeight: 600 }}>Tạo bài đăng</span>}
            onCancel={handleModalClose}
            footer={
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                <Button 
                  shape="round"
                  onClick={handleModalClose}
                  style={{ height: 44, borderRadius: 22, padding: 0, width: 108, background: '#1f1f1f', color: '#e5e7eb', borderColor: '#303030' }}
                >Hủy</Button>
                <Button 
                  type="primary" 
                  shape="round"
                  loading={posting} 
                  onClick={handleCreatePost}
                  style={{ height: 44, borderRadius: 22, padding: 0, width: 108, background: '#7c3aed', borderColor: '#7c3aed' }}
                >Đăng</Button>
              </div>
            }
            styles={{ 
              content: { background: '#0f0f10' },
              header: { background: '#0f0f10', borderBottom: '1px solid #1f1f1f' }
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input.TextArea
                placeholder="Chia sẻ điều gì đó..."
                autoSize={{ minRows: 3, maxRows: 8 }}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                maxLength={maxChars}
                showCount
              />
              <div>
                <Text style={{ color: '#e5e7eb', marginBottom: 8, display: 'block' }}>Đính kèm lick (chỉ licks active của bạn)</Text>
                <Select
                  mode="multiple"
                  placeholder="Chọn lick để đính kèm..."
                  value={selectedLickIds}
                  onChange={setSelectedLickIds}
                  loading={loadingLicks}
                  style={{ width: '100%' }}
                  options={availableLicks}
                  notFoundContent={loadingLicks ? <Spin size="small" /> : <Empty description="Không có lick active nào" />}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  popupClassName="dark-select-dropdown"
                />
              </div>
              <Upload.Dragger
                multiple
                fileList={files}
                accept="audio/*,video/*"
                beforeUpload={() => false}
                onChange={({ fileList }) => setFiles(fileList)}
                listType="text"
                style={{ padding: 8, borderColor: '#303030', background: '#0f0f10', color: '#e5e7eb', minHeight: 150 }}
                itemRender={(originNode, file, fileList, actions) => (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: '#e5e7eb', padding: '6px 8px', borderBottom: '1px dashed #303030' }}>
                    <span style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>{file.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Button danger size="small" onClick={actions.remove}>Xóa</Button>
                    </div>
                  </div>
                )}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <p style={{ margin: 0, color: '#e5e7eb' }}>Kéo thả hoặc bấm để chọn file (audio/video)</p>
                  <Text style={{ color: '#bfbfbf' }}>Hỗ trợ tối đa 10 file, 100MB mỗi file</Text>
                </div>
              </Upload.Dragger>
              {extractFirstUrl(newText) && (
                <div style={{ border: '1px solid #303030', borderRadius: 8, padding: 12, background: '#111', color: '#e5e7eb' }}>
                  {linkLoading ? (
                    <Text style={{ color: '#bfbfbf' }}>Đang tải preview…</Text>
                  ) : (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {linkPreview?.thumbnailUrl ? (
                        <img src={linkPreview.thumbnailUrl} alt="preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />
                      ) : (
                        <div style={{ width: 64, height: 64, borderRadius: 6, background: '#1f1f1f' }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkPreview?.title || extractFirstUrl(newText)}</div>
                        <div style={{ color: '#9ca3af', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extractFirstUrl(newText)}</div>
                      </div>
                      <Button size="small" onClick={() => setLinkPreview(null)}>Ẩn</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Modal>

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Spin />
            </div>
          )}
          {!loading && error && (
            <Card style={{ marginBottom: 20, background: '#0f0f10', borderColor: '#1f1f1f' }}>
              <Text style={{ color: '#fff' }}>{error}</Text>
            </Card>
          )}
          {!loading && !error && items.length === 0 && (
            <Empty description={<span style={{ color: '#9ca3af' }}>Chưa có bài đăng</span>} />
          )}
          {!loading && !error && items.map((post) => (
            <Card key={post._id} style={{ marginBottom: 20, background: '#0f0f10', borderColor: '#1f1f1f' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <Space align="start" size={14}>
                    <div
                    role="button"
                    onClick={() => {
                      const uid = getAuthorId(post);
                      if (uid) navigate(`/users/${uid}/newfeeds`);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <Avatar 
                      size={40} 
                      src={post?.userId?.avatarUrl && typeof post?.userId?.avatarUrl === 'string' && post?.userId?.avatarUrl.trim() !== '' ? post.userId.avatarUrl : undefined} 
                      style={{ background: '#2db7f5' }}
                    >
                      {post?.userId?.displayName?.[0] || post?.userId?.username?.[0] || 'U'}
                    </Avatar>
                  </div>
                  <div>
                    <Space style={{ marginBottom: 4 }}>
                      <span
                        onClick={() => {
                          const uid = getAuthorId(post);
                          if (uid) navigate(`/users/${uid}/newfeeds`);
                        }}
                        style={{ color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {post?.userId?.displayName || post?.userId?.username || 'Người dùng'}
                      </span>
                      <Text type="secondary" style={{ color: '#9ca3af', fontSize: 13 }}>
                        {formatTime(post?.createdAt)}
                      </Text>
                    </Space>
                  </div>
                </Space>
                <Space>
                  {(() => {
                    const uid = getAuthorId(post);
                    const isFollowing = !!userIdToFollowing[uid];
                    const loading = !!userIdToFollowLoading[uid];
                    if (uid && currentUserId && uid.toString() === currentUserId.toString()) return null;
                    return (
                      <Button
                        size="middle"
                        loading={loading}
                        onClick={() => toggleFollow(uid)}
                        style={{
                          background: isFollowing ? '#111' : '#333',
                          borderColor: isFollowing ? '#444' : '#333',
                          color: '#fff',
                        }}
                      >
                        {isFollowing ? 'Đang theo dõi' : 'Follow'}
                      </Button>
                    );
                  })()}
                  {currentUserId && (() => {
                    const uid = getAuthorId(post);
                    const isOwnPost = uid && currentUserId && uid.toString() === currentUserId.toString();
                    
                    if (isOwnPost) {
                      // Menu for own posts: Edit and Hide
                      return (
                        <Dropdown
                          menu={{
                            items: [
                              {
                                key: 'edit',
                                label: 'Chỉnh sửa bài post',
                                icon: <EditOutlined />,
                                onClick: () => openEditModal(post),
                              },
                              {
                                key: 'hide',
                                label: 'Lưu trữ bài post',
                                icon: <DeleteOutlined />,
                                danger: true,
                                loading: deletingPostId === post._id,
                                onClick: () => handleHidePost(post._id),
                              },
                            ],
                          }}
                          trigger={['click']}
                        >
                          <Button
                            type="text"
                            icon={<MoreOutlined />}
                            style={{ color: '#9ca3af' }}
                            loading={deletingPostId === post._id}
                          />
                        </Dropdown>
                      );
                    }
                    
                    // Menu for other users' posts: Report
                    return (
                      <Dropdown
                        menu={{
                          items: [
                            {
                              key: 'report',
                              label: postIdToReported[post._id] ? 'Đã báo cáo' : 'Báo cáo bài viết',
                              icon: <FlagOutlined />,
                              disabled: postIdToReported[post._id],
                              onClick: () => openReportModal(post._id),
                            },
                          ],
                        }}
                        trigger={['click']}
                      >
                        <Button
                          type="text"
                          icon={<MoreOutlined />}
                          style={{ color: '#9ca3af' }}
                        />
                      </Dropdown>
                    );
                  })()}
                </Space>
              </div>
              {post?.textContent && (
                <div style={{ marginBottom: 10, color: '#fff', fontSize: 15, lineHeight: 1.6 }}>
                  {post.textContent}
                </div>
              )}
          {(() => {
            const url = extractFirstUrl(post?.textContent);
            const sharedLickId = parseSharedLickId(url);
            return sharedLickId ? (
              <div style={{ marginBottom: 12 }}>
                <PostLickEmbed lickId={sharedLickId} url={url} />
              </div>
            ) : null;
          })()}
              {/* Hiển thị attached licks với waveform */}
              {post?.attachedLicks && Array.isArray(post.attachedLicks) && post.attachedLicks.length > 0 && (
                <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {post.attachedLicks.map((lick) => {
                    const lickId = lick?._id || lick?.lick_id || lick;
                    if (!lickId) return null;
                    return (
                      <div key={lickId} style={{ marginBottom: 8 }}>
                        <PostLickEmbed lickId={lickId} />
                      </div>
                    );
                  })}
                </div>
              )}
              {post?.media?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <WavePlaceholder />
                </div>
              )}
              {post?.linkPreview && (
                <a href={post.linkPreview?.url || '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <div style={{ border: '1px solid #303030', borderRadius: 8, padding: 12, background: '#111', color: '#e5e7eb', marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {(post.linkPreview?.thumbnailUrl || (previewCache[post.linkPreview?.url]?.thumbnailUrl)) ? (
                        <img src={(post.linkPreview?.thumbnailUrl || previewCache[post.linkPreview?.url]?.thumbnailUrl)} alt="preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />
                      ) : (
                        <div style={{ width: 64, height: 64, borderRadius: 6, background: '#1f1f1f' }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.linkPreview?.title || previewCache[post.linkPreview?.url]?.title || post.linkPreview?.url}</div>
                        <div style={{ color: '#9ca3af', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.linkPreview?.url}</div>
                      </div>
                    </div>
                  </div>
                </a>
              )}
              <Space style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button 
                    icon={<LikeOutlined />} 
                    style={{ background: 'transparent', border: 'none', color: postIdToLiked[post._id] ? '#1890ff' : '#fff' }}
                    loading={likingPostId === post._id}
                    onClick={() => handleLike(post._id)}
                  >
                    Thích
                  </Button>
                  {Number(postIdToStats[post._id]?.likesCount ?? 0) > 0 && (
                    <span
                      onClick={() => openLikesModal(post._id)}
                      style={{
                        color: '#1890ff',
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 500,
                        userSelect: 'none'
                      }}
                    >
                      {postIdToStats[post._id].likesCount} lượt thích
                    </span>
                  )}
                </div>
                <Button 
                  icon={<MessageOutlined />} 
                  style={{ background: 'transparent', border: 'none', color: '#fff' }}
                  onClick={() => openComment(post._id)}
                >
                  Bình luận {Number(postIdToStats[post._id]?.commentsCount ?? 0) > 0 ? `(${postIdToStats[post._id].commentsCount})` : ''}
                </Button>
              </Space>

              {/* Danh sách bình luận - chỉ hiển thị 3 comment gần nhất */}
              {postIdToComments[post._id] && postIdToComments[post._id].length > 0 && (
                <div style={{ marginTop: 12, background: '#0f0f10', borderTop: '1px solid #1f1f1f', paddingTop: 8 }}>
                  {limitToNewest3(postIdToComments[post._id]).map((c) => (
                    <div key={c._id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <Avatar size={28} style={{ background: '#555' }}>{c?.userId?.displayName?.[0] || c?.userId?.username?.[0] || 'U'}</Avatar>
                      <div style={{ background: '#151515', border: '1px solid #232323', borderRadius: 10, padding: '6px 10px', color: '#e5e7eb' }}>
                        <div style={{ fontWeight: 600 }}>{c?.userId?.displayName || c?.userId?.username || 'Người dùng'}</div>
                        <div>{c.comment}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              
            </Card>
          ))}

          <div ref={loaderRef} style={{ height: 1 }} />
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
              <Spin />
            </div>
          )}
        </div>

        <div style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          height: '100%',
          paddingLeft: 8,
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE and Edge
        }} className="hide-scrollbar">
          {/* Người liên hệ */}
          <Card 
            style={{ marginBottom: 16, background: '#0f0f10', borderColor: '#1f1f1f' }} 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: 700 }}>Người liên hệ</Text>
                <Button type="text" icon={<MoreOutlined />} style={{ color: '#9ca3af', padding: 0 }} />
              </div>
            }
          >
            {loadingFollowing ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                <Spin />
              </div>
            ) : followingUsers.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                Chưa có người liên hệ
              </div>
            ) : (
              <List
                dataSource={followingUsers}
                renderItem={(user) => {
                  const userId = user.id || user._id || user.userId;
                  return (
                    <List.Item
                      style={{ 
                        padding: '8px 0', 
                        cursor: 'pointer',
                        borderBottom: '1px solid #1f1f1f'
                      }}
                      onClick={async () => {
                        try {
                          // Create or get conversation with this user
                          const conversation = await ensureConversationWith(userId);
                          if (conversation && conversation._id) {
                            // Dispatch custom event to open chat window (header will listen)
                            window.dispatchEvent(new CustomEvent('openChatWindow', { 
                              detail: { conversation } 
                            }));
                          } else {
                            message.error('Không thể tạo cuộc trò chuyện');
                          }
                        } catch (error) {
                          console.error('Error opening chat:', error);
                          message.error(error.message || 'Không thể mở chat');
                        }
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar 
                            src={user.avatarUrl && typeof user.avatarUrl === 'string' && user.avatarUrl.trim() !== '' ? user.avatarUrl : undefined} 
                            icon={<UserOutlined />}
                            size={40}
                            style={{ background: '#2db7f5' }}
                          />
                        }
                        title={
                          <Text style={{ color: '#fff', fontWeight: 500 }}>
                            {user.displayName || user.username || 'Người dùng'}
                          </Text>
                        }
                        description={
                          <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                            {user.isOnline ? (
                              <span style={{ color: '#52c41a' }}>● Đang hoạt động</span>
                            ) : user.lastSeen ? (
                              `Hoạt động ${formatTimeAgo(user.lastSeen)}`
                            ) : (
                              'Offline'
                            )}
                          </Text>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>

          <Card style={{ marginBottom: 16, background: '#0f0f10', borderColor: '#1f1f1f' }} title={<Text style={{ color: '#fff', fontWeight: 700 }}>Gợi ý theo dõi</Text>}>
            {suggestionsLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spin /></div>
            )}
            {!suggestionsLoading && (
              <List
                itemLayout="horizontal"
                dataSource={suggestions}
                renderItem={(user) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <Suggestion 
                      user={user}
                      following={!!userIdToFollowing[user.id]}
                      loading={!!userIdToFollowLoading[user.id]}
                      onFollow={(uid) => toggleFollow(uid)}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Card style={{ background: '#0f0f10', borderColor: '#1f1f1f' }}>
            <Title level={4} style={{ color: '#fff', marginBottom: 12, textAlign: 'center' }}>LeaderBoard</Title>
            <Divider style={{ margin: '8px 0', borderColor: '#1f1f1f' }} />
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <LeaderboardItem name="Tên lick" icon="XVEN" iconColor="#ef4444" />
              <LeaderboardItem name="Tên lick" icon="UNITED" iconColor="#3b82f6" />
              <LeaderboardItem name="Tên lick" icon={<UserOutlined />} iconColor="#6b7280" />
            </Space>
          </Card>
        </div>
      </div>
    </div>

      <Modal
        title={<span style={{ color: '#fff', fontWeight: 700 }}>Người đã thích</span>}
        open={likesModalOpen}
        onCancel={() => {
          setLikesModalOpen(false);
          setLikesPostId(null);
          setLikesList([]);
        }}
        footer={null}
        width={500}
        styles={{
          header: { background: '#0f0f10', borderBottom: '1px solid #1f1f1f' },
          content: { background: '#0f0f10', borderRadius: 12 },
          body: { background: '#0f0f10', maxHeight: '60vh', overflowY: 'auto' }
        }}
      >
        {likesLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : likesList.length === 0 ? (
          <Empty description={<span style={{ color: '#9ca3af' }}>Chưa có ai thích bài viết này</span>} />
        ) : (
          <List
            dataSource={likesList}
            renderItem={(user) => {
              const isCurrentUser = currentUserId && user.id && user.id.toString() === currentUserId.toString();
              return (
              <List.Item
                style={{ padding: '12px 0', borderBottom: '1px solid #1f1f1f' }}
                actions={
                  isCurrentUser ? null : [
                    <Button
                      key="follow"
                      size="small"
                      type={userIdToFollowing[user.id] ? 'default' : 'primary'}
                      loading={!!userIdToFollowLoading[user.id]}
                      onClick={() => toggleFollow(user.id)}
                      style={{
                        background: userIdToFollowing[user.id] ? '#111' : '#7c3aed',
                        borderColor: userIdToFollowing[user.id] ? '#444' : '#7c3aed',
                        color: '#fff',
                      }}
                    >
                      {userIdToFollowing[user.id] ? 'Đang theo dõi' : 'Follow'}
                    </Button>
                  ]
                }
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size={40}
                      src={user.avatarUrl && typeof user.avatarUrl === 'string' && user.avatarUrl.trim() !== '' ? user.avatarUrl : undefined}
                      style={{ background: '#2db7f5', cursor: 'pointer' }}
                      onClick={() => navigate(`/users/${user.id}/newfeeds`)}
                    >
                      {user.displayName?.[0] || user.username?.[0] || 'U'}
                    </Avatar>
                  }
                  title={
                    <span
                      style={{ color: '#fff', cursor: 'pointer' }}
                      onClick={() => navigate(`/users/${user.id}/newfeeds`)}
                    >
                      {user.displayName || user.username || 'Người dùng'}
                    </span>
                  }
                />
              </List.Item>
              );
            }}
          />
        )}
      </Modal>

      <Modal
        title={<span style={{ color: '#fff', fontWeight: 700 }}>Bình luận bài viết</span>}
      open={commentOpen}
      onCancel={() => setCommentOpen(false)}
        footer={null}
        width={860}
        styles={{
          header: { background: '#0f0f10', borderBottom: '1px solid #1f1f1f' },
          content: { background: '#0f0f10', borderRadius: 12 },
          body: { background: '#0f0f10' }
        }}
    >
        {modalPost && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <Avatar size={40} style={{ background: '#2db7f5' }}>
                {modalPost?.userId?.displayName?.[0] || modalPost?.userId?.username?.[0] || 'U'}
              </Avatar>
              <div>
                <div style={{ color: '#fff', fontWeight: 600 }}>
                  {modalPost?.userId?.displayName || modalPost?.userId?.username || 'Người dùng'}
                </div>
                <Text type="secondary" style={{ color: '#9ca3af', fontSize: 12 }}>{formatTime(modalPost?.createdAt)}</Text>
              </div>
            </div>
            {modalPost?.textContent && (
              <div style={{ marginBottom: 8, color: '#e5e7eb' }}>{modalPost.textContent}</div>
            )}
            {(() => {
              const url = extractFirstUrl(modalPost?.textContent);
              const sharedLickId = parseSharedLickId(url);
              return sharedLickId ? (
                <div style={{ marginBottom: 12 }}>
                  <PostLickEmbed lickId={sharedLickId} url={url} />
                </div>
              ) : null;
            })()}
            {modalPost?.media?.length > 0 && (
              <div style={{ marginBottom: 8 }}><WavePlaceholder /></div>
            )}
            {modalPost?.linkPreview && (
              <a href={modalPost.linkPreview?.url || '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ border: '1px solid #303030', borderRadius: 8, padding: 12, background: '#111', color: '#e5e7eb', marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {(modalPost.linkPreview?.thumbnailUrl || (previewCache[modalPost.linkPreview?.url]?.thumbnailUrl)) ? (
                      <img src={(modalPost.linkPreview?.thumbnailUrl || previewCache[modalPost.linkPreview?.url]?.thumbnailUrl)} alt="preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />
                    ) : (
                      <div style={{ width: 64, height: 64, borderRadius: 6, background: '#1f1f1f' }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{modalPost.linkPreview?.title || previewCache[modalPost.linkPreview?.url]?.title || modalPost.linkPreview?.url}</div>
                      <div style={{ color: '#9ca3af', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{modalPost.linkPreview?.url}</div>
                    </div>
                  </div>
                </div>
              </a>
            )}

            {/* stats quick view */}
            <div style={{ marginTop: 8, color: '#9ca3af' }}>
              {Number(postIdToStats[commentPostId]?.likesCount ?? 0)} lượt thích · {Number(postIdToStats[commentPostId]?.commentsCount ?? 0)} bình luận
            </div>

            {/* comments list */}
            <div style={{ marginTop: 12, maxHeight: 360, overflowY: 'auto' }}>
              {(postIdToComments[commentPostId] || []).map((c) => (
                <div key={c._id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <Avatar size={28} style={{ background: '#555' }}>{c?.userId?.displayName?.[0] || c?.userId?.username?.[0] || 'U'}</Avatar>
                  <div style={{ background: '#151515', border: '1px solid #232323', borderRadius: 10, padding: '6px 10px', color: '#e5e7eb' }}>
                    <div style={{ fontWeight: 600 }}>{c?.userId?.displayName || c?.userId?.username || 'Người dùng'}</div>
                    <div>{c.comment}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* input */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
              <Input
                placeholder="Nhập bình luận của bạn..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                style={{ background: '#0f0f10', color: '#e5e7eb', borderColor: '#303030', height: 44, borderRadius: 22, flex: 1 }}
              />
              <Button type="primary" loading={commentSubmitting} onClick={submitComment} style={{ background: '#7c3aed', borderColor: '#7c3aed', borderRadius: 22, padding: '0 20px', height: 44 }}>Gửi</Button>
            </div>
          </div>
        )}
    </Modal>

    {/* Report Modal */}
    <Modal
      title={<span style={{ color: '#fff', fontWeight: 700 }}>Báo cáo bài viết</span>}
      open={reportModalOpen}
      onCancel={() => {
        setReportModalOpen(false);
        setReportPostId(null);
        setReportReason('');
        setReportDescription('');
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button
            onClick={() => {
              setReportModalOpen(false);
              setReportPostId(null);
              setReportReason('');
              setReportDescription('');
            }}
            style={{ background: '#1f1f1f', color: '#e5e7eb', borderColor: '#303030' }}
          >
            Hủy
          </Button>
          <Button
            type="primary"
            loading={reportSubmitting}
            onClick={submitReport}
            disabled={!reportReason}
            style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
          >
            Gửi báo cáo
          </Button>
        </div>
      }
      width={500}
      styles={{
        header: { background: '#0f0f10', borderBottom: '1px solid #1f1f1f' },
        content: { background: '#0f0f10', borderRadius: 12 },
        body: { background: '#0f0f10' }
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Text style={{ color: '#e5e7eb', marginBottom: 8, display: 'block', fontWeight: 600 }}>
            Lý do báo cáo <span style={{ color: '#ef4444' }}>*</span>
          </Text>
          <Radio.Group
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Radio value="spam" style={{ color: '#e5e7eb' }}>Spam</Radio>
              <Radio value="inappropriate" style={{ color: '#e5e7eb' }}>Nội dung không phù hợp</Radio>
              <Radio value="copyright" style={{ color: '#e5e7eb' }}>Vi phạm bản quyền</Radio>
              <Radio value="harassment" style={{ color: '#e5e7eb' }}>Quấy rối</Radio>
              <Radio value="other" style={{ color: '#e5e7eb' }}>Khác</Radio>
            </Space>
          </Radio.Group>
        </div>
        <div>
          <Text style={{ color: '#e5e7eb', marginBottom: 8, display: 'block', fontWeight: 600 }}>
            Mô tả chi tiết (tùy chọn)
          </Text>
          <Input.TextArea
            placeholder="Vui lòng mô tả chi tiết về vấn đề..."
            value={reportDescription}
            onChange={(e) => setReportDescription(e.target.value)}
            rows={4}
            maxLength={500}
            showCount
            style={{ background: '#0f0f10', color: '#e5e7eb', borderColor: '#303030' }}
          />
        </div>
      </div>
    </Modal>

    {/* Edit Post Modal */}
    <Modal
      open={editModalOpen}
      title={
        <span style={{ color: '#fff', fontWeight: 600 }}>
          Chỉnh sửa bài đăng
        </span>
      }
      onCancel={() => {
        if (!editing) {
          setEditModalOpen(false);
          setEditingPost(null);
          setEditText('');
        }
      }}
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Button
            shape="round"
            onClick={() => {
              if (!editing) {
                setEditModalOpen(false);
                setEditingPost(null);
                setEditText('');
              }
            }}
            style={{
              height: 44,
              borderRadius: 22,
              padding: 0,
              width: 108,
              background: '#1f1f1f',
              color: '#e5e7eb',
              borderColor: '#303030',
            }}
          >
            Hủy
          </Button>
          <Button
            shape="round"
            type="primary"
            loading={editing}
            onClick={handleUpdatePost}
            style={{
              height: 44,
              borderRadius: 22,
              padding: 0,
              width: 108,
              background: '#7c3aed',
              borderColor: '#7c3aed',
            }}
          >
            Cập nhật
          </Button>
        </div>
      }
      styles={{
        content: { background: '#0f0f10' },
        header: {
          background: '#0f0f10',
          borderBottom: '1px solid #1f1f1f',
        },
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input.TextArea
          placeholder="Chia sẻ điều gì đó..."
          autoSize={{ minRows: 3, maxRows: 8 }}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          maxLength={maxChars}
          showCount
        />
      </div>
    </Modal>
  </>
  );
};

export default NewsFeed;