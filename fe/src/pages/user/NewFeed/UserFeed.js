import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  Avatar,
  Button,
  Typography,
  Space,
  Input,
  Spin,
  Empty,
  message,
  Modal,
  Upload,
  Select,
  List,
  Dropdown,
  Radio,
  Drawer,
  Tag,
} from "antd";
import {
  LikeOutlined,
  MessageOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  FlagOutlined,
  MenuOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  listPostsByUser,
  createPost,
  getPostById,
  updatePost,
  deletePost,
  deletePostComment,
} from "../../../services/user/post";
import {
  likePost,
  unlikePost,
  createPostComment,
  getPostStats,
  getAllPostComments,
  getPostLikes,
} from "../../../services/user/post";
import {
  getProfileById,
  followUser,
  unfollowUser,
  uploadMyCoverPhoto,
  getFollowersList,
  getUserFollowingList,
} from "../../../services/user/profile";
import {
  onPostCommentNew,
  offPostCommentNew,
  onPostArchived,
  offPostArchived,
  joinRoom,
} from "../../../services/user/socketService";
import {
  getMyLicks,
  getLicksByUser,
  playLickAudio,
} from "../../../services/user/lickService";
import {
  getPlaylistsByUser,
  getPlaylistById,
} from "../../../services/user/playlistService";
import { getUserProjects, getUserProjectsById } from "../../../services/user/projectService";
import SimpleWaveform from "../../../components/SimpleWaveform";
import LickCard from "../../../components/LickCard";
import {
  reportPost,
  checkPostReport,
} from "../../../services/user/reportService";
import PostLickEmbed from "../../../components/PostLickEmbed";
import PostProjectEmbed from "../../../components/PostProjectEmbed";
import ProjectPlayer from "../../../components/ProjectPlayer";
import "./newFeedResponsive.css";
import { useNavigate, useParams } from "react-router-dom";

const { Text } = Typography;

const composerSectionStyle = {
  background: "#141414",
  border: "1px solid #262626",
  borderRadius: 16,
  padding: "18px 20px",
};

const composerLabelStyle = {
  color: "#f8fafc",
  fontWeight: 600,
  fontSize: 15,
};

const composerHintStyle = {
  color: "#9ca3af",
  fontSize: 13,
};

const WavePlaceholder = () => (
  <div
    style={{
      height: 120,
      background: "#1a1a1a",
      borderRadius: 8,
      position: "relative",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "100%",
        display: "flex",
        alignItems: "end",
        gap: 2,
        padding: "8px 12px",
      }}
    >
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: `${Math.random() * 80 + 20}px`,
            background: "#ff7a45",
            borderRadius: 1.5,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          width: 12,
          height: 12,
          background: "#ff7a45",
          borderRadius: "50%",
        }}
      />
    </div>
  </div>
);

const formatTime = (isoString) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return "";
  }
};

const sortCommentsDesc = (comments) => {
  if (!Array.isArray(comments)) return [];
  return [...comments].sort((a, b) => {
    const timeA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
};

const limitToNewest3 = (comments) => {
  if (!Array.isArray(comments)) return [];
  const sorted = sortCommentsDesc(comments);
  return sorted.slice(0, 3);
};

const extractFirstUrl = (text) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
};

const getYoutubeId = (urlString) => {
  try {
    const u = new URL(urlString);
    if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "");
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    return null;
  } catch {
    return null;
  }
};

const deriveThumbnail = (urlString) => {
  const ytId = getYoutubeId(urlString);
  if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  return "";
};

const parseSharedLickId = (urlString) => {
  if (!urlString) return null;
  try {
    // Handle both absolute and relative URLs
    let url;
    if (urlString.startsWith("http://") || urlString.startsWith("https://")) {
      url = new URL(urlString);
    } else if (urlString.startsWith("/")) {
      const base =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : "https://melodyhub.website";
      url = new URL(urlString, base);
    } else {
      // Try to parse as relative path
      const base =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : "https://melodyhub.website";
      url = new URL("/" + urlString, base);
    }

    // Clean pathname (remove trailing slashes)
    const cleanPath = url.pathname.replace(/\/+$/, "");
    const segments = cleanPath.split("/").filter(Boolean);

    if (segments.length >= 2 && segments[0].toLowerCase() === "licks") {
      const id = segments[1];
      // Remove any query params or fragments from ID
      return id.split("?")[0].split("#")[0];
    }
    return null;
  } catch {
    return null;
  }
};

const parseProjectId = (urlString) => {
  if (!urlString) return null;
  try {
    // Handle both absolute and relative URLs
    let url;
    if (urlString.startsWith("http://") || urlString.startsWith("https://")) {
      url = new URL(urlString);
    } else if (urlString.startsWith("/")) {
      const base =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : "https://melodyhub.website";
      url = new URL(urlString, base);
    } else {
      // Try to parse as relative path
      const base =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : "https://melodyhub.website";
      url = new URL("/" + urlString, base);
    }

    // Clean pathname (remove trailing slashes)
    const cleanPath = url.pathname.replace(/\/+$/, "");
    const segments = cleanPath.split("/").filter(Boolean);

    if (segments.length >= 2 && segments[0].toLowerCase() === "projects") {
      const id = segments[1];
      // Remove any query params or fragments from ID
      return id.split("?")[0].split("#")[0];
    }
    return null;
  } catch {
    return null;
  }
};

const getLinkInfo = (url) => {
  if (!url)
    return { iconClass: "bi bi-globe", label: "Website", color: "#3b82f6" };
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes("facebook.com")) {
      return {
        iconClass: "bi bi-facebook",
        label: "Facebook",
        color: "#1877f2",
      };
    } else if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
      return {
        iconClass: "bi bi-twitter-x",
        label: "Twitter",
        color: "#1da1f2",
      };
    } else if (hostname.includes("instagram.com")) {
      return {
        iconClass: "bi bi-instagram",
        label: "Instagram",
        color: "#e4405f",
      };
    } else if (
      hostname.includes("youtube.com") ||
      hostname.includes("youtu.be")
    ) {
      return { iconClass: "bi bi-youtube", label: "YouTube", color: "#ff0000" };
    } else if (hostname.includes("linkedin.com")) {
      return {
        iconClass: "bi bi-linkedin",
        label: "LinkedIn",
        color: "#0077b5",
      };
    } else if (hostname.includes("github.com")) {
      return { iconClass: "bi bi-github", label: "GitHub", color: "#333" };
    } else if (hostname.includes("tiktok.com")) {
      return { iconClass: "bi bi-tiktok", label: "TikTok", color: "#000000" };
    } else if (hostname.includes("spotify.com")) {
      return { iconClass: "bi bi-spotify", label: "Spotify", color: "#1db954" };
    } else {
      return { iconClass: "bi bi-globe", label: "Website", color: "#3b82f6" };
    }
  } catch {
    return { iconClass: "bi bi-globe", label: "Website", color: "#3b82f6" };
  }
};

const getValidAvatarUrl = (url) => {
  if (typeof url !== "string") return undefined;
  const trimmed = url.trim();
  return trimmed ? trimmed : undefined;
};

const UserFeed = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = React.useRef(null);
  const [previewCache, setPreviewCache] = useState({});
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentPostId, setCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [likingPostId, setLikingPostId] = useState(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [postIdToLiked, setPostIdToLiked] = useState({});
  const [postIdToStats, setPostIdToStats] = useState({});
  const [postIdToComments, setPostIdToComments] = useState({});
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [modalPost, setModalPost] = useState(null);
  const [replyingToCommentId, setReplyingToCommentId] = useState(null);
  const [replyTexts, setReplyTexts] = useState({});
  const [commentReplies, setCommentReplies] = useState({});
  const [likesModalOpen, setLikesModalOpen] = useState(false);
  const [likesPostId, setLikesPostId] = useState(null);
  const [likesList, setLikesList] = useState([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [userIdToFollowing, setUserIdToFollowing] = useState({});
  const [userIdToFollowLoading, setUserIdToFollowLoading] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newText, setNewText] = useState("");
  const [files, setFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  const [maxChars] = useState(300);
  const [linkPreview, setLinkPreview] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [availableLicks, setAvailableLicks] = useState([]);
  const [loadingLicks, setLoadingLicks] = useState(false);
  const [selectedLickIds, setSelectedLickIds] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [uploadingCoverPhoto, setUploadingCoverPhoto] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editText, setEditText] = useState("");
  const [editSelectedLickIds, setEditSelectedLickIds] = useState([]);
  const [editSelectedProjectId, setEditSelectedProjectId] = useState(null);
  const [editLinkPreview, setEditLinkPreview] = useState(null);
  const [editLinkLoading, setEditLinkLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [hideConfirmModalOpen, setHideConfirmModalOpen] = useState(false);
  const [postToHide, setPostToHide] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportPostId, setReportPostId] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [isMobileSidebar, setIsMobileSidebar] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 1024;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [postIdToReported, setPostIdToReported] = useState({});
  const [currentUserId] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return undefined;
      const obj = JSON.parse(raw);
      const u = obj?.user || obj;
      return u?.id || u?.userId || u?._id;
    } catch {
      return undefined;
    }
  });
  const [currentUserRole] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return undefined;
      const obj = JSON.parse(raw);
      const u = obj?.user || obj;
      return u?.roleId || u?.role;
    } catch {
      return undefined;
    }
  });
  const isAdminUser = (currentUserRole || "").toLowerCase() === "admin";
  const [commentModal, commentModalContextHolder] = Modal.useModal();
  const [modal, modalContextHolder] = Modal.useModal();
  const [activeTab, setActiveTab] = useState("activity"); // activity | licks | projects | playlists
  const [userLicks, setUserLicks] = useState([]);
  const [userLicksLoading, setUserLicksLoading] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [userPlaylistsLoading, setUserPlaylistsLoading] = useState(false);
  const [userProjects, setUserProjectsState] = useState([]);
  const [userProjectsLoading, setUserProjectsLoading] = useState(false);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [playlistModalLoading, setPlaylistModalLoading] = useState(false);
  const [playlistDetail, setPlaylistDetail] = useState(null);
  const [playingLickId, setPlayingLickId] = useState(null);
  const playlistAudioRef = React.useRef(null);
  const isOwnProfile = useMemo(
    () =>
      !!currentUserId && userId && currentUserId.toString() === userId.toString(),
    [currentUserId, userId]
  );
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const getAuthorId = (post) => {
    if (!post) return "";
    const user = post?.userId;
    if (!user) return "";
    if (typeof user === "string" || typeof user === "number")
      return user.toString();
    if (typeof user === "object") {
      const id = user._id || user.id;
      if (id) return id.toString();
    }
    return "";
  };
  const isPostOwner = (post) => {
    const ownerId = getAuthorId(post);
    if (!ownerId || !currentUserId) return false;
    return ownerId.toString() === currentUserId.toString();
  };
  const canDeleteComment = (_, post) => isAdminUser || isPostOwner(post);

  const usedChars = newText?.length || 0;
  const charPercent = maxChars
    ? Math.min(100, Math.round((usedChars / maxChars) * 100))
    : 0;

  const fetchProfile = async (id) => {
    try {
      // Ensure id is a string
      const userIdStr = id?.toString ? id.toString() : String(id || "");
      if (!userIdStr) {
        console.warn("Invalid userId for fetchProfile:", id);
        return;
      }
      const res = await getProfileById(userIdStr);
      setProfile(res?.data?.user || null);
      if (typeof res?.data?.isFollowing === "boolean") {
        setIsFollowing(res.data.isFollowing);
      }
    } catch (e) {
      console.warn("Load profile failed:", e);
    }
  };

  const toggleFollow = async () => {
    if (!userId || !profile) return;
    try {
      setFollowLoading(true);
      if (isFollowing) {
        await unfollowUser(userId);
        setIsFollowing(false);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                followersCount: Math.max(0, (prev.followersCount || 1) - 1),
              }
            : prev
        );
        message.success("Đã bỏ theo dõi");
      } else {
        await followUser(userId);
        setIsFollowing(true);
        setProfile((prev) =>
          prev
            ? { ...prev, followersCount: (prev.followersCount || 0) + 1 }
            : prev
        );
        message.success("Đã theo dõi");
      }
    } catch (e) {
      const msg = e?.message || "";
      if (!isFollowing && msg.toLowerCase().includes("already following")) {
        setIsFollowing(true);
        setProfile((prev) =>
          prev
            ? { ...prev, followersCount: (prev.followersCount || 0) + 1 }
            : prev
        );
        message.success("Đã theo dõi");
      } else {
        message.error(
          msg || (isFollowing ? "Bỏ theo dõi thất bại" : "Theo dõi thất bại")
        );
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const fetchFollowers = async () => {
    if (!userId) return;
    try {
      setFollowersLoading(true);
      const res = await getFollowersList(userId);
      if (res?.success && Array.isArray(res.data)) {
        setFollowersList(res.data);
      } else {
        setFollowersList([]);
      }
    } catch (error) {
      console.error("Error fetching followers:", error);
      message.error("Không thể tải danh sách người theo dõi");
      setFollowersList([]);
    } finally {
      setFollowersLoading(false);
    }
  };

  const fetchFollowing = async () => {
    if (!userId) return;
    try {
      setFollowingLoading(true);
      const res = await getUserFollowingList(userId);
      if (res?.success && Array.isArray(res.data)) {
        setFollowingList(res.data);
      } else {
        setFollowingList([]);
      }
    } catch (error) {
      console.error("Error fetching following:", error);
      message.error("Không thể tải danh sách đang theo dõi");
      setFollowingList([]);
    } finally {
      setFollowingLoading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      setLikingPostId(postId);
      const isLiked = !!postIdToLiked[postId];
      if (isLiked) {
        await unlikePost(postId);
        setPostIdToLiked((prev) => ({ ...prev, [postId]: false }));
        setPostIdToStats((prev) => {
          const cur = prev[postId] || { likesCount: 0, commentsCount: 0 };
          const nextLikes = Math.max((cur.likesCount || 0) - 1, 0);
          return { ...prev, [postId]: { ...cur, likesCount: nextLikes } };
        });
        message.success("Đã bỏ thích");
      } else {
        await likePost(postId);
        setPostIdToLiked((prev) => ({ ...prev, [postId]: true }));
        setPostIdToStats((prev) => {
          const cur = prev[postId] || { likesCount: 0, commentsCount: 0 };
          return {
            ...prev,
            [postId]: { ...cur, likesCount: (cur.likesCount || 0) + 1 },
          };
        });
        message.success("Đã thích bài viết");
      }
      getPostStats(postId)
        .then((res) => {
          const stats = res?.data || {};
          setPostIdToStats((prev) => ({ ...prev, [postId]: stats }));
        })
        .catch(() => {});
    } catch (e) {
      message.error(e.message || "Không thể thích bài viết");
    } finally {
      setLikingPostId(null);
    }
  };

  const openComment = async (postId) => {
    setCommentPostId(postId);
    setCommentText("");
    setReplyingToCommentId(null);
    setReplyTexts({});
    const p = items.find((it) => it._id === postId) || null;
    setModalPost(p);
    setCommentOpen(true);
    try {
      const all = await getAllPostComments(postId);
      const topLevelComments = Array.isArray(all)
        ? all.filter((c) => !c.parentCommentId)
        : [];
      setPostIdToComments((prev) => ({
        ...prev,
        [postId]: sortCommentsDesc(topLevelComments),
      }));

      // Fetch replies for each comment
      if (topLevelComments.length > 0) {
        const repliesPromises = topLevelComments.map(async (comment) => {
          try {
            const replies = await getAllPostComments(postId, {
              parentCommentId: comment._id,
            });
            return {
              commentId: comment._id,
              replies: Array.isArray(replies) ? replies : [],
            };
          } catch (e) {
            console.warn(
              `Failed to fetch replies for comment ${comment._id}:`,
              e
            );
            return { commentId: comment._id, replies: [] };
          }
        });
        const repliesResults = await Promise.all(repliesPromises);
        const repliesMap = {};
        repliesResults.forEach(({ commentId, replies }) => {
          repliesMap[commentId] = sortCommentsDesc(replies);
        });
        setCommentReplies(repliesMap);
      }
    } catch (e) {
      console.warn("Failed to fetch all comments for modal:", e);
    }
  };

  const toggleFollowUser = async (uid) => {
    if (!uid) return;
    try {
      setUserIdToFollowLoading((prev) => ({ ...prev, [uid]: true }));
      const isFollowing = !!userIdToFollowing[uid];
      if (isFollowing) {
        await unfollowUser(uid);
        setUserIdToFollowing((prev) => ({ ...prev, [uid]: false }));
        message.success("Đã bỏ theo dõi");
      } else {
        await followUser(uid);
        setUserIdToFollowing((prev) => ({ ...prev, [uid]: true }));
        message.success("Đã theo dõi");
      }
    } catch (e) {
      const msg = e?.message || "";
      if (
        !userIdToFollowing[uid] &&
        msg.toLowerCase().includes("already following")
      ) {
        setUserIdToFollowing((prev) => ({ ...prev, [uid]: true }));
        message.success("Đã theo dõi");
      } else {
        message.error(msg || "Thao tác thất bại");
      }
    } finally {
      setUserIdToFollowLoading((prev) => ({ ...prev, [uid]: false }));
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

      // Fetch following status for all users in the list
      try {
        const uniqueUserIds = Array.from(
          new Set(users.map((u) => u.id).filter(Boolean))
        );
        const results = await Promise.all(
          uniqueUserIds.map(async (uid) => {
            try {
              const r = await getProfileById(uid);
              return { uid, isFollowing: !!r?.data?.isFollowing };
            } catch {
              return { uid, isFollowing: false };
            }
          })
        );
        const map = {};
        results.forEach(({ uid, isFollowing }) => {
          map[uid] = isFollowing;
        });
        setUserIdToFollowing((prev) => ({ ...prev, ...map }));
      } catch {}
    } catch (e) {
      message.error("Không thể tải danh sách người đã thích");
      console.error("Failed to fetch likes:", e);
    } finally {
      setLikesLoading(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) {
      message.warning("Vui lòng nhập bình luận");
      return;
    }
    try {
      setCommentSubmitting(true);
      await createPostComment(commentPostId, { comment: commentText.trim() });
      message.success("Đã gửi bình luận");
      setCommentText("");
      // Không cần refresh manual vì realtime event sẽ tự động cập nhật
      // Chỉ refresh stats để đảm bảo số lượng chính xác
      const statsRes = await getPostStats(commentPostId);
      setPostIdToStats((prev) => ({
        ...prev,
        [commentPostId]: statsRes?.data || prev[commentPostId],
      }));
    } catch (e) {
      message.error(e.message || "Không thể gửi bình luận");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const startReply = (commentId) => {
    setReplyingToCommentId(commentId);
    setReplyTexts((prev) => ({ ...prev, [commentId]: "" }));
  };

  const cancelReply = (commentId) => {
    if (replyingToCommentId === commentId) {
      setReplyingToCommentId(null);
    }
    setReplyTexts((prev) => {
      const next = { ...prev };
      delete next[commentId];
      return next;
    });
  };

  const submitReply = async (commentId) => {
    const replyText = (replyTexts[commentId] || "").trim();
    if (!replyText) {
      message.warning("Vui lòng nhập phản hồi");
      return;
    }
    try {
      setCommentSubmitting(true);
      await createPostComment(commentPostId, {
        comment: replyText,
        parentCommentId: commentId,
      });
      message.success("Đã gửi phản hồi");
      cancelReply(commentId);

      // Không cần refresh manual vì realtime event sẽ tự động cập nhật
      // Chỉ refresh stats để đảm bảo số lượng chính xác
      const statsRes = await getPostStats(commentPostId);
      setPostIdToStats((prev) => ({
        ...prev,
        [commentPostId]: statsRes?.data || prev[commentPostId],
      }));
    } catch (e) {
      message.error(e.message || "Không thể gửi phản hồi");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    if (!postId || !commentId) return;
    try {
      setDeletingCommentId(commentId);
      await deletePostComment(postId, commentId);

      // Xóa khỏi top-level comments
      setPostIdToComments((prev) => {
        const list = Array.isArray(prev[postId]) ? prev[postId] : [];
        return { ...prev, [postId]: list.filter((c) => c._id !== commentId) };
      });

      // Xóa khỏi replies nếu là reply
      setCommentReplies((prev) => {
        const newReplies = { ...prev };
        Object.keys(newReplies).forEach((parentId) => {
          newReplies[parentId] = (newReplies[parentId] || []).filter(
            (r) => r._id !== commentId
          );
        });
        return newReplies;
      });

      setPostIdToStats((prev) => {
        const current = prev[postId] || { likesCount: 0, commentsCount: 0 };
        const nextComments = Math.max((current.commentsCount || 1) - 1, 0);
        return {
          ...prev,
          [postId]: { ...current, commentsCount: nextComments },
        };
      });
      getPostStats(postId)
        .then((res) => {
          if (res?.data) {
            setPostIdToStats((prev) => ({ ...prev, [postId]: res.data }));
          }
        })
        .catch(() => {});
      message.success("Đã xóa bình luận");
    } catch (e) {
      message.error(e?.message || "Không thể xóa bình luận");
    } finally {
      setDeletingCommentId(null);
    }
  };

  const confirmDeleteComment = (postId, commentId) => {
    commentModal.confirm({
      title: "Xóa bình luận này?",
      content:
        "Bình luận sẽ bị xóa khỏi bài viết và người viết sẽ không nhận thông báo.",
      okText: "Xóa",
      cancelText: "Hủy",
      okButtonProps: { danger: true },
      centered: true,
      onOk: () => handleDeleteComment(postId, commentId),
    });
  };

  const buildCommentMenuProps = (postId, commentId) => ({
    items: [
      {
        key: "delete-comment",
        label: "Xóa bình luận",
        danger: true,
        disabled: deletingCommentId === commentId,
      },
    ],
    onClick: ({ key }) => {
      if (key === "delete-comment" && deletingCommentId !== commentId) {
        confirmDeleteComment(postId, commentId);
      }
    },
  });

  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return;
    try {
      items.forEach((it) => it?._id && joinRoom(`post:${it._id}`));
    } catch (e) {
      // ignore join errors
    }
  }, [items]);

  useEffect(() => {
    const handler = (payload) => {
      if (!payload?.postId || !payload?.comment) return;
      const postId = payload.postId;
      const comment = payload.comment;
      if (!comment.createdAt) {
        comment.createdAt = new Date().toISOString();
      }
      setPostIdToStats((prev) => {
        const cur = prev[postId] || { likesCount: 0, commentsCount: 0 };
        return {
          ...prev,
          [postId]: { ...cur, commentsCount: (cur.commentsCount || 0) + 1 },
        };
      });

      // Nếu là reply (có parentCommentId), chỉ thêm vào danh sách replies, KHÔNG thêm vào top-level comments
      if (comment.parentCommentId) {
        setCommentReplies((prev) => {
          const parentId = comment.parentCommentId;
          const existingReplies = prev[parentId] || [];
          // Kiểm tra duplicate trước khi thêm
          const exists = existingReplies.some((r) => r._id === comment._id);
          if (exists) return prev;
          return {
            ...prev,
            [parentId]: sortCommentsDesc([comment, ...existingReplies]),
          };
        });
        // Đảm bảo reply không có trong top-level comments (phòng trường hợp lỗi)
        setPostIdToComments((prev) => {
          const cur = Array.isArray(prev[postId]) ? prev[postId] : [];
          // Loại bỏ reply nếu có trong top-level comments
          const filtered = cur.filter((c) => c._id !== comment._id);
          return { ...prev, [postId]: limitToNewest3(filtered) };
        });
      } else {
        // Nếu là top-level comment, cập nhật danh sách comment và chỉ giữ lại 3 comment gần nhất
        setPostIdToComments((prev) => {
          const cur = Array.isArray(prev[postId]) ? prev[postId] : [];
          // Kiểm tra duplicate trước khi thêm
          const exists = cur.some((c) => c._id === comment._id);
          if (exists) return prev;
          return { ...prev, [postId]: limitToNewest3([comment, ...cur]) };
        });
      }
    };
    onPostCommentNew(handler);
    return () => {
      offPostCommentNew(handler);
    };
  }, []);

  useEffect(() => {
    if (!commentOpen || !commentPostId) return;
    const handler = (payload) => {
      if (!payload || payload.postId !== commentPostId) return;
      const newComment = payload.comment;
      if (!newComment.createdAt) {
        newComment.createdAt = new Date().toISOString();
      }

      // Nếu là reply (có parentCommentId), chỉ thêm vào danh sách replies, KHÔNG thêm vào top-level comments
      if (newComment.parentCommentId) {
        setCommentReplies((prev) => {
          const parentId = newComment.parentCommentId;
          const existingReplies = prev[parentId] || [];
          // Kiểm tra duplicate trước khi thêm
          const exists = existingReplies.some((r) => r._id === newComment._id);
          if (exists) return prev;
          return {
            ...prev,
            [parentId]: sortCommentsDesc([newComment, ...existingReplies]),
          };
        });
        // Đảm bảo reply không có trong top-level comments (phòng trường hợp lỗi)
        setPostIdToComments((prev) => {
          const cur = prev[commentPostId] || [];
          // Loại bỏ reply nếu có trong top-level comments
          const filtered = cur.filter((c) => c._id !== newComment._id);
          return { ...prev, [commentPostId]: filtered };
        });
      } else {
        // Nếu là top-level comment, thêm vào danh sách comments
        setPostIdToComments((prev) => {
          const cur = prev[commentPostId] || [];
          // Kiểm tra duplicate trước khi thêm
          const exists = cur.some((c) => c._id === newComment._id);
          if (exists) return prev;
          return {
            ...prev,
            [commentPostId]: sortCommentsDesc([newComment, ...cur]),
          };
        });
      }

      setPostIdToStats((prev) => {
        const cur = prev[commentPostId] || { likesCount: 0, commentsCount: 0 };
        return {
          ...prev,
          [commentPostId]: {
            ...cur,
            commentsCount: (cur.commentsCount || 0) + 1,
          },
        };
      });
    };
    onPostCommentNew(handler);
    return () => {
      offPostCommentNew(handler);
    };
  }, [commentOpen, commentPostId]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      const mobile = window.innerWidth <= 1024;
      setIsMobileSidebar(mobile);
      if (!mobile) {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sidebarContent = (
    <Card style={{ background: "#0f0f10", borderColor: "#1f1f1f" }}>
      <div style={{ color: "#fff", fontWeight: 700, marginBottom: 12 }}>
        Liên hệ với tôi
      </div>
      {profile?.links &&
      Array.isArray(profile.links) &&
      profile.links.length > 0 ? (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {profile.links.map((link, index) => {
            const linkInfo = getLinkInfo(link);
            return (
              <Space key={index} style={{ width: "100%" }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: "#111",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: linkInfo.color,
                    fontSize: 18,
                  }}
                >
                  <i className={linkInfo.iconClass}></i>
                </div>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#fff", textDecoration: "none" }}
                >
                  {linkInfo.label}
                </a>
              </Space>
            );
          })}
        </Space>
      ) : (
        <div style={{ color: "#9ca3af", fontSize: 14 }}>
          Chưa có liên kết nào được thêm vào.
        </div>
      )}
    </Card>
  );

  // Listen for post archived event (realtime removal from feed)
  useEffect(() => {
    const handler = (payload) => {
      console.log("[UserFeed] Received post:archived event:", payload);
      if (!payload?.postId) {
        console.warn("[UserFeed] post:archived event missing postId");
        return;
      }
      const postId = payload.postId.toString();
      console.log("[UserFeed] Removing post from feed:", postId);

      // Remove post from feed immediately
      setItems((prev) => {
        const filtered = prev.filter((p) => {
          const pId = p._id?.toString() || p._id;
          return pId !== postId;
        });
        console.log("[UserFeed] After filter, items count:", filtered.length);
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
      message.info("Một bài viết đã bị ẩn do vi phạm quy định cộng đồng");
    };
    console.log("[UserFeed] Setting up post:archived listener");
    onPostArchived(handler);
    return () => {
      console.log("[UserFeed] Cleaning up post:archived listener");
      offPostArchived(handler);
    };
  }, []);

  const fetchProviderOEmbed = async (url) => {
    const tryFetch = async (endpoint) => {
      const res = await fetch(`${endpoint}${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error("oEmbed failed");
      return res.json();
    };
    const endpoints = [
      "https://noembed.com/embed?url=",
      "https://soundcloud.com/oembed?format=json&url=",
      "https://vimeo.com/api/oembed.json?url=",
      "https://open.spotify.com/oembed?url=",
    ];
    for (const ep of endpoints) {
      try {
        const data = await tryFetch(ep);
        return {
          title: data.title || url,
          thumbnailUrl: data.thumbnail_url || deriveThumbnail(url),
          provider: data.provider_name || "",
          author: data.author_name || "",
          type: data.type || "link",
        };
      } catch (_) {
        // continue
      }
    }
    return null;
  };

  const fetchOgTags = async (url) => {
    try {
      const proxied = `https://r.jina.ai/http://${url.replace(
        /^https?:\/\//,
        ""
      )}`;
      const res = await fetch(proxied);
      if (!res.ok) return null;
      const text = await res.text();
      const ogImageMatch = text.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
      );
      const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
      return {
        title: (titleMatch && titleMatch[1]) || url,
        thumbnailUrl: (ogImageMatch && ogImageMatch[1]) || deriveThumbnail(url),
        provider: "",
        author: "",
        type: "link",
      };
    } catch {
      return null;
    }
  };

  const resolvePreview = async (url) => {
    if (previewCache[url]) return previewCache[url];
    const fromOembed = await fetchProviderOEmbed(url);
    const data = fromOembed ||
      (await fetchOgTags(url)) || {
        title: url,
        thumbnailUrl: deriveThumbnail(url),
      };
    setPreviewCache((prev) => ({ ...prev, [url]: data }));
    return data;
  };

  useEffect(() => {
    // Nếu đã chọn lick hoặc project thì không xử lý link preview nữa
    if (selectedLickIds && selectedLickIds.length > 0) {
      setLinkPreview(null);
      setLinkLoading(false);
      return;
    }
    if (selectedProjectId) {
      setLinkPreview(null);
      setLinkLoading(false);
      return;
    }
    const url = extractFirstUrl(newText);
    if (!url) {
      setLinkPreview(null);
      return;
    }
    let aborted = false;
    setLinkLoading(true);
    resolvePreview(url)
      .then((data) => {
        if (!aborted) setLinkPreview({ url, ...data });
      })
      .finally(() => {
        if (!aborted) setLinkLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [newText, selectedLickIds, selectedProjectId]);

  const fetchActiveLicks = async () => {
    try {
      setLoadingLicks(true);
      const res = await getMyLicks({ status: "active", limit: 100 });
      if (res?.success && Array.isArray(res.data)) {
        const formattedLicks = res.data.map((lick) => ({
          value: lick.lick_id || lick._id,
          label: lick.title || "Untitled Lick",
          ...lick,
        }));
        setAvailableLicks(formattedLicks);
      } else {
        setAvailableLicks([]);
      }
    } catch (e) {
      console.error("Error fetching active licks:", e);
      setAvailableLicks([]);
    } finally {
      setLoadingLicks(false);
    }
  };

  const fetchActiveProjects = async () => {
    try {
      setLoadingProjects(true);
      const res = await getUserProjects("all", "active");
      if (res?.success && Array.isArray(res.data)) {
        const formattedProjects = res.data.map((project) => ({
          value: String(project._id), // Normalize ID thành string để đảm bảo match với editSelectedProjectId
          label: project.title || "Untitled Project",
          ...project,
        }));
        setAvailableProjects(formattedProjects);
      } else {
        setAvailableProjects([]);
      }
    } catch (e) {
      console.error("Error fetching active projects:", e);
      setAvailableProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleModalOpen = () => {
    setIsModalOpen(true);
    if (currentUserId) {
      fetchActiveLicks();
      fetchActiveProjects();
    }
  };

  // Khi mở modal chỉnh sửa bài viết, cũng cần load danh sách lick active
  useEffect(() => {
    if (editModalOpen && currentUserId) {
      fetchActiveLicks();
    }
  }, [editModalOpen, currentUserId]);

  // Xử lý link preview trong modal chỉnh sửa (theo nội dung editText)
  useEffect(() => {
    // Nếu đang chọn lick đính kèm thì không xử lý link preview
    if (editSelectedLickIds && editSelectedLickIds.length > 0) {
      setEditLinkPreview(null);
      setEditLinkLoading(false);
      return;
    }

    // Nếu đang chọn project thì không xử lý link preview
    if (editSelectedProjectId) {
      setEditLinkPreview(null);
      setEditLinkLoading(false);
      return;
    }

    // Nếu có lick hoặc project từ bài post ban đầu, không cho phép thêm link preview
    const originalUrl = extractFirstUrl(editingPost?.textContent || "");
    const originalSharedLickId = originalUrl
      ? parseSharedLickId(originalUrl)
      : null;
    const hasOriginalLick =
      (editingPost?.attachedLicks &&
        Array.isArray(editingPost.attachedLicks) &&
        editingPost.attachedLicks.length > 0) ||
      !!originalSharedLickId;
    const hasOriginalProject =
      editingPost?.projectId &&
      ((typeof editingPost.projectId === "string" &&
        editingPost.projectId.trim() !== "") ||
        (typeof editingPost.projectId === "object" &&
          editingPost.projectId !== null &&
          Object.keys(editingPost.projectId).length > 0 &&
          (editingPost.projectId._id || editingPost.projectId.id)));

    // Nếu bài post ban đầu có lick hoặc project, không cho phép thêm link preview
    if (hasOriginalLick || hasOriginalProject) {
      const url = extractFirstUrl(editText);
      // Nếu người dùng dán link vào nhưng bài post có lick/project → không set link preview
      if (url) {
        setEditLinkPreview(null);
        setEditLinkLoading(false);
        return;
      }
    }

    const url = extractFirstUrl(editText || "");
    if (!url) {
      // Không còn URL trong nội dung -> clear preview (chỉ giữ lại nếu post gốc có linkPreview và user chưa gõ gì)
      setEditLinkPreview(null);
      setEditLinkLoading(false);
      return;
    }

    let aborted = false;
    setEditLinkLoading(true);
    resolvePreview(url)
      .then((data) => {
        if (!aborted) {
          setEditLinkPreview({ url, ...data });
        }
      })
      .finally(() => {
        if (!aborted) setEditLinkLoading(false);
      });

    return () => {
      aborted = true;
    };
  }, [editText, editSelectedLickIds, editSelectedProjectId, editingPost]);

  const handleModalClose = () => {
    if (!posting) {
      setIsModalOpen(false);
      setSelectedLickIds([]);
      setSelectedProjectId(null);
    }
  };

  const MAX_POST_TEXT_LENGTH = 300;

  const handleCreatePost = async () => {
    const trimmed = newText.trim();
    const hasUrl = !!extractFirstUrl(trimmed);
    const hasLinkPreview = hasUrl && linkPreview;
    const hasLicks = selectedLickIds.length > 0;
    const hasProject = !!selectedProjectId;

    // Kiểm tra: nếu có URL trong text và đã chọn lick, không cho đăng
    if (hasUrl && hasLicks) {
      commentModal.warning({
        title: "Chỉ được chọn 1 loại đính kèm",
        content:
          "Bạn đã chọn Lick và có Link trong nội dung. Chỉ được chọn 1 trong 3: Project, Lick, hoặc Link. Vui lòng xóa link trong nội dung hoặc bỏ chọn Lick trước khi đăng.",
      });
      return;
    }

    // Kiểm tra: nếu có URL trong text và đã chọn project, không cho đăng
    if (hasUrl && hasProject) {
      commentModal.warning({
        title: "Chỉ được chọn 1 loại đính kèm",
        content:
          "Bạn đã chọn Project và có Link trong nội dung. Chỉ được chọn 1 trong 3: Project, Lick, hoặc Link. Vui lòng xóa link trong nội dung hoặc bỏ chọn Project trước khi đăng.",
      });
      return;
    }

    // Đếm số lượng loại đính kèm được chọn
    const attachmentCount =
      (hasLinkPreview ? 1 : 0) + (hasLicks ? 1 : 0) + (hasProject ? 1 : 0);

    // Kiểm tra: chỉ được chọn 1 trong 3: project, licks, hoặc linkPreview
    if (attachmentCount > 1) {
      commentModal.warning({
        title: "Chỉ được chọn 1 loại đính kèm",
        content:
          "Bạn chỉ được chọn 1 trong 3: Project, Lick, hoặc Link. Vui lòng bỏ chọn các mục khác trước khi đăng.",
      });
      return;
    }

    // Kiểm tra: phải có ít nhất text hoặc 1 trong 3 loại đính kèm
    if (!trimmed && attachmentCount === 0) {
      commentModal.warning({
        title: "Thiếu nội dung",
        content:
          "Vui lòng nhập nội dung hoặc chọn ít nhất 1 trong 3: Project, Lick, hoặc Link.",
      });
      return;
    }

    if (trimmed && trimmed.length > MAX_POST_TEXT_LENGTH) {
      commentModal.warning({
        title: "Nội dung quá dài",
        content: `Nội dung không được vượt quá ${MAX_POST_TEXT_LENGTH} ký tự (hiện tại: ${trimmed.length}). Vui lòng rút gọn trước khi đăng.`,
      });
      return;
    }
    try {
      setPosting(true);
      let newPost = null;
      if (files.length > 0) {
        const form = new FormData();
        form.append("postType", "status_update");
        // Chỉ thêm textContent nếu có text
        if (trimmed) {
          form.append("textContent", trimmed);
        }
        // Chỉ cho phép 1 trong 3: linkPreview, licks, hoặc project
        if (hasLinkPreview && !hasLicks && !hasProject) {
          form.append("linkPreview", JSON.stringify(linkPreview));
        }
        if (hasLicks && !hasLinkPreview && !hasProject) {
          form.append("attachedLickIds", JSON.stringify(selectedLickIds));
        }
        if (hasProject && !hasLinkPreview && !hasLicks) {
          form.append("projectId", selectedProjectId);
        }
        files.forEach((f) => {
          if (f.originFileObj) form.append("media", f.originFileObj);
        });
        const response = await createPost(form);
        newPost = response?.data || response;
      } else {
        const payload = {
          postType: "status_update",
        };
        // Chỉ thêm textContent nếu có text
        if (trimmed) {
          payload.textContent = trimmed;
        }
        // Chỉ cho phép 1 trong 3: linkPreview, licks, hoặc project
        if (hasLinkPreview && !hasLicks && !hasProject) {
          payload.linkPreview = linkPreview;
        }
        if (hasLicks && !hasLinkPreview && !hasProject) {
          payload.attachedLickIds = selectedLickIds;
        }
        if (hasProject && !hasLinkPreview && !hasLicks) {
          payload.projectId = selectedProjectId;
        }
        const response = await createPost(payload);
        newPost = response?.data || response;
      }

      if (newPost && newPost._id) {
        setItems((prev) => {
          const exists = prev.some((p) => p._id === newPost._id);
          if (exists) return prev;
          return [newPost, ...prev];
        });

        setPostIdToStats((prev) => ({
          ...prev,
          [newPost._id]: { likesCount: 0, commentsCount: 0 },
        }));
        setPostIdToLiked((prev) => ({ ...prev, [newPost._id]: false }));
        setPostIdToComments((prev) => ({ ...prev, [newPost._id]: [] }));

        try {
          joinRoom(`post:${newPost._id}`);
        } catch {
          // Ignore socket errors
        }
      }

      setNewText("");
      setFiles([]);
      setSelectedLickIds([]);
      setSelectedProjectId(null);
      setIsModalOpen(false);
      message.success("Đăng bài thành công");
      commentModal.success({
        title: "Đăng bài thành công",
        content: "Bài viết của bạn đã được đăng lên bảng tin.",
      });
    } catch (e) {
      message.error(e.message || "Đăng bài thất bại");
    } finally {
      setPosting(false);
    }
  };

  const handleHidePost = (postId) => {
    console.log("handleHidePost called with postId:", postId);
    setPostToHide(postId);
    setHideConfirmModalOpen(true);
  };

  const confirmHidePost = async () => {
    if (!postToHide) return;
    const postId = postToHide;
    console.log("Modal confirmed, deleting post:", postId);
    try {
      setDeletingPostId(postId);
      setHideConfirmModalOpen(false);
      console.log("Calling deletePost API for:", postId);
      const response = await deletePost(postId);
      console.log("deletePost response:", response);
      if (response?.success !== false) {
        message.success(
          "Đã lưu trữ bài viết. Bài viết sẽ bị xóa vĩnh viễn sau 30 ngày nếu không khôi phục."
        );
        setItems((prev) => prev.filter((p) => p._id !== postId));
      } else {
        message.error(response?.message || "Không thể lưu trữ bài viết");
      }
    } catch (e) {
      const errorMessage =
        e?.response?.data?.message ||
        e?.message ||
        "Không thể lưu trữ bài viết";
      message.error(errorMessage);
      console.error("Error hiding post:", e);
      console.error("Error details:", {
        message: e.message,
        response: e.response,
        data: e.response?.data,
      });
    } finally {
      setDeletingPostId(null);
      setPostToHide(null);
    }
  };

  const openEditModal = (post) => {
    setEditingPost(post);
    setEditText(post?.textContent || "");
    setEditLinkPreview(post?.linkPreview || null);
    // Khởi tạo danh sách lick đang đính kèm để có thể chỉnh sửa
    if (post?.attachedLicks && Array.isArray(post.attachedLicks)) {
      const ids = post.attachedLicks
        .map((lick) => {
          if (!lick) return null;
          if (typeof lick === "string") return lick;
          return lick._id || lick.id || lick.lick_id || null;
        })
        .filter(Boolean);
      setEditSelectedLickIds(ids);
    } else {
      setEditSelectedLickIds([]);
    }
    // Khởi tạo project đang đính kèm (nếu có)
    if (post?.projectId) {
      const pid = post.projectId._id || post.projectId.id || post.projectId;
      // Normalize ID thành string để đảm bảo match với options
      setEditSelectedProjectId(pid ? String(pid) : null);
    } else {
      setEditSelectedProjectId(null);
    }
    setEditModalOpen(true);
  };

  const handleUpdatePost = async () => {
    if (!editText.trim()) {
      message.warning("Vui lòng nhập nội dung");
      return;
    }
    if (!editingPost?._id) {
      message.error("Không tìm thấy bài viết");
      return;
    }

    // Kiểm tra: nếu có lick và có link preview → không cho cập nhật
    const hasLicks = editSelectedLickIds && editSelectedLickIds.length > 0;
    const hasLinkPreview = !!editLinkPreview;
    const hasProject = !!editSelectedProjectId;
    const hasUrl = !!extractFirstUrl(editText.trim());

    // Kiểm tra xem bài post ban đầu có lick hoặc project không
    const originalUrl = extractFirstUrl(editingPost?.textContent || "");
    const originalSharedLickId = originalUrl
      ? parseSharedLickId(originalUrl)
      : null;
    const hasOriginalLick =
      (editingPost?.attachedLicks &&
        Array.isArray(editingPost.attachedLicks) &&
        editingPost.attachedLicks.length > 0) ||
      !!originalSharedLickId;
    const hasOriginalProject =
      editingPost?.projectId &&
      ((typeof editingPost.projectId === "string" &&
        editingPost.projectId.trim() !== "") ||
        (typeof editingPost.projectId === "object" &&
          editingPost.projectId !== null &&
          Object.keys(editingPost.projectId).length > 0 &&
          (editingPost.projectId._id || editingPost.projectId.id)));

    // Debug log
    console.log("[Update Post] Validation check:", {
      hasLicks,
      hasLinkPreview,
      hasProject,
      hasUrl,
      hasOriginalLick,
      hasOriginalProject,
      editSelectedLickIds,
      editText: editText.substring(0, 50),
      editingPost: {
        attachedLicks: editingPost?.attachedLicks,
        projectId: editingPost?.projectId,
        textContent: editingPost?.textContent?.substring(0, 50),
      },
    });

    // Nếu bài post ban đầu có lick và người dùng dán link vào → không cho cập nhật
    if ((hasLicks || hasOriginalLick) && (hasLinkPreview || hasUrl)) {
      console.log("[Update Post] Blocked: Has lick and link", {
        hasLicks,
        hasOriginalLick,
        hasLinkPreview,
        hasUrl,
      });
      // Sử dụng modal.warning từ hook để đảm bảo thông báo hiển thị
      modal.warning({
        title: "Không thể cập nhật",
        content:
          "Chỉ được chọn 1 loại đính kèm: Lick hoặc Link. Vui lòng xóa link trong nội dung hoặc bỏ chọn Lick.",
        okText: "Đã hiểu",
      });
      return;
    }

    // Nếu bài post ban đầu có project và người dùng dán link vào → không cho cập nhật
    if ((hasProject || hasOriginalProject) && (hasLinkPreview || hasUrl)) {
      console.log("[Update Post] Blocked: Has project and link", {
        hasProject,
        hasOriginalProject,
        hasLinkPreview,
        hasUrl,
      });
      modal.warning({
        title: "Không thể cập nhật",
        content:
          "Chỉ được chọn 1 loại đính kèm: Project hoặc Link. Vui lòng xóa link trong nội dung hoặc bỏ chọn Project.",
        okText: "Đã hiểu",
      });
      return;
    }

    if (hasLicks && hasLinkPreview) {
      console.log("[Update Post] Blocked: Has licks and link preview", {
        hasLicks,
        hasLinkPreview,
      });
      modal.warning({
        title: "Không thể cập nhật",
        content:
          "Chỉ được chọn 1 loại đính kèm: Lick hoặc Link. Vui lòng xóa link trong nội dung hoặc bỏ chọn Lick.",
        okText: "Đã hiểu",
      });
      return;
    }

    if (hasLicks && hasProject) {
      message.warning(
        "Chỉ được chọn 1 loại đính kèm: Lick hoặc Project. Vui lòng bỏ chọn một trong hai."
      );
      return;
    }

    if (hasLinkPreview && hasProject) {
      message.warning(
        "Chỉ được chọn 1 loại đính kèm: Link hoặc Project. Vui lòng xóa link trong nội dung hoặc bỏ chọn Project."
      );
      return;
    }

    try {
      setEditing(true);
      const payload = {
        postType: "status_update",
        textContent: editText.trim(),
      };

      // Chỉ cho phép một trong ba: lick, project, hoặc link preview
      // Nếu có lick → chỉ gửi lick, không gửi link preview
      if (hasLicks) {
        payload.attachedLickIds = editSelectedLickIds;
        // Không gửi linkPreview khi có lick
        payload.linkPreview = undefined;
        payload.projectId = null;
      }
      // Nếu có project → chỉ gửi project, không gửi lick và link preview
      else if (hasProject) {
        payload.projectId = editSelectedProjectId;
        payload.attachedLickIds = [];
        payload.linkPreview = undefined;
      }
      // Nếu có link preview → chỉ gửi link preview, không gửi lick
      else if (hasLinkPreview) {
        payload.linkPreview = editLinkPreview;
        payload.attachedLickIds = [];
        payload.projectId = null;
      }
      // Nếu không có gì cả → xóa tất cả
      else {
        payload.attachedLickIds = [];
        payload.linkPreview = undefined;
        // Nếu post cũ có project nhưng giờ không chọn nữa → xóa project
        if (editingPost?.projectId) {
          payload.projectId = null;
        }
      }

      await updatePost(editingPost._id, payload);
      message.success("Cập nhật bài viết thành công");
      setEditModalOpen(false);
      setEditingPost(null);
      setEditText("");
      setEditSelectedLickIds([]);
      setEditSelectedProjectId(null);
      setEditLinkPreview(null);
      // Refresh the feed
      if (userId) {
        const userIdStr = userId?.toString
          ? userId.toString()
          : String(userId || "");
        fetchData(userIdStr, 1);
        setPage(1);
      }
    } catch (e) {
      message.error(e.message || "Cập nhật bài viết thất bại");
    } finally {
      setEditing(false);
    }
  };

  const openReportModal = async (postId) => {
    setReportPostId(postId);
    setReportReason("");
    setReportDescription("");
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
      message.warning("Vui lòng chọn lý do báo cáo");
      return;
    }
    try {
      setReportSubmitting(true);
      await reportPost(reportPostId, {
        reason: reportReason,
        description: reportDescription.trim() || "",
      });
      message.success("Đã gửi báo cáo thành công");
      setPostIdToReported((prev) => ({ ...prev, [reportPostId]: true }));
      setReportModalOpen(false);
      setReportReason("");
      setReportDescription("");
    } catch (e) {
      message.error(e.message || "Không thể gửi báo cáo");
    } finally {
      setReportSubmitting(false);
    }
  };

  const fetchData = async (id, p = page) => {
    setLoading(true);
    setError("");
    try {
      // Ensure id is a string
      const userIdStr = id?.toString ? id.toString() : String(id || "");
      if (!userIdStr) {
        setError("Invalid user ID");
        return;
      }
      const res = await listPostsByUser(userIdStr, { page: p, limit });
      const posts = res?.data?.posts || [];
      const total = res?.data?.pagination?.totalPosts || 0;
      if (p === 1) setItems(posts);
      else setItems((prev) => [...prev, ...posts]);
      const totalPages = Math.ceil(total / limit) || 1;
      setHasMore(p < totalPages);

      const likedMap = {};
      posts.forEach((post) => {
        if (post._id && post.isLiked !== undefined) {
          likedMap[post._id] = !!post.isLiked;
        }
      });
      setPostIdToLiked((prev) => ({ ...prev, ...likedMap }));
    } catch (e) {
      setError(e.message || "Lỗi tải bài viết");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    // Ensure userId is a string
    const userIdStr = userId?.toString
      ? userId.toString()
      : String(userId || "");
    if (!userIdStr) return;
    setItems([]);
    setPage(1);
    fetchProfile(userIdStr);
    fetchData(userIdStr, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const enrich = async () => {
      for (const p of items) {
        getPostStats(p._id)
          .then((res) => {
            setPostIdToStats((prev) => ({
              ...prev,
              [p._id]: res?.data || prev[p._id],
            }));
          })
          .catch(() => {});
        getAllPostComments(p._id)
          .then((list) => {
            const limited = limitToNewest3(Array.isArray(list) ? list : []);
            setPostIdToComments((prev) => ({ ...prev, [p._id]: limited }));
          })
          .catch(() => {});
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
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          const next = page + 1;
          setPage(next);
          if (userId) {
            const userIdStr = userId?.toString
              ? userId.toString()
              : String(userId || "");
            if (userIdStr) fetchData(userIdStr, next);
          }
        }
      },
      { rootMargin: "200px" }
    );
    const el = loaderRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [loading, hasMore, page, userId]);

  // ----- Profile tabs data loaders -----

  const fetchUserLicks = async (targetUserId) => {
    if (!targetUserId) return;
    try {
      setUserLicksLoading(true);
      const res = await getLicksByUser(targetUserId, { status: "active", limit: 20 });
      const list = Array.isArray(res?.data) ? res.data : res?.licks || [];
      setUserLicks(list);
    } catch (e) {
      console.error("Error loading user licks:", e);
      setUserLicks([]);
    } finally {
      setUserLicksLoading(false);
    }
  };

  const fetchUserPlaylists = async (targetUserId) => {
    if (!targetUserId) return;
    try {
      setUserPlaylistsLoading(true);
      const res = await getPlaylistsByUser(targetUserId, { page: 1, limit: 20, isPublic: true });
      const list = Array.isArray(res?.data) ? res.data : res?.playlists || [];
      // Filter to only show public playlists
      const publicPlaylists = list.filter(pl => pl.is_public !== false && pl.isPublic !== false);
      setUserPlaylists(publicPlaylists);
    } catch (e) {
      console.error("Error loading user playlists:", e);
      setUserPlaylists([]);
    } finally {
      setUserPlaylistsLoading(false);
    }
  };

  const openPlaylistDetail = async (playlist) => {
    const id = playlist?.playlist_id || playlist?._id;
    if (!id) return;
    try {
      setPlaylistModalOpen(true);
      setPlaylistModalLoading(true);
      setPlaylistDetail(null);
      const res = await getPlaylistById(id);
      // BE thường trả { success, data: { playlist, licks } } hoặc { playlist, licks }
      const payload = res?.data || res;
      setPlaylistDetail(payload);
    } catch (e) {
      console.error("Error loading playlist detail:", e);
      message.error(e.message || "Không tải được chi tiết playlist");
    } finally {
      setPlaylistModalLoading(false);
    }
  };

  const handlePlayLickFromPlaylist = async (lickId) => {
    if (!lickId) return;
    try {
      // Stop current audio if any
      if (playlistAudioRef.current) {
        playlistAudioRef.current.pause();
        playlistAudioRef.current = null;
      }
      setPlayingLickId(lickId);
      const res = await playLickAudio(lickId);
      const payload = res?.data || res;
      const url =
        payload?.audioUrl ||
        payload?.url ||
        payload?.audio_url ||
        payload?.playbackUrl;
      if (!url) {
        setPlayingLickId(null);
        message.warning("Không tìm thấy file audio cho lick này");
        return;
      }
      const audio = new Audio(url);
      playlistAudioRef.current = audio;
      audio.onended = () => {
        setPlayingLickId((prev) => (prev === lickId ? null : prev));
      };
      await audio.play();
    } catch (e) {
      console.error("Error playing lick from playlist:", e);
      message.error(e.message || "Không phát được audio");
      setPlayingLickId(null);
    }
  };

  useEffect(() => {
    if (!userId) return;
    
    if (activeTab === "licks") {
      fetchUserLicks(userId);
    } else if (activeTab === "playlists") {
      fetchUserPlaylists(userId);
    } else if (activeTab === "projects") {
      // Fetch projects based on whether it's own profile or not
      const fetchProjects = async () => {
        try {
          setUserProjectsLoading(true);
          let res;
          // Calculate isOwnProfile directly here to avoid dependency issues
          const ownProfile = !!currentUserId && userId && currentUserId.toString() === userId.toString();
          if (ownProfile) {
            // Lấy tất cả projects của chính user đăng nhập
            res = await getUserProjects("all");
          } else {
            // Lấy chỉ active projects của user khác
            res = await getUserProjectsById(userId);
          }
          const list = Array.isArray(res?.data) ? res.data : res?.projects || [];
          setUserProjectsState(list);
        } catch (e) {
          console.error("Error loading user projects:", e);
          setUserProjectsState([]);
        } finally {
          setUserProjectsLoading(false);
        }
      };
      fetchProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userId]);

  // Stop audio when component unmounts or modal is closed
  useEffect(() => {
    return () => {
      if (playlistAudioRef.current) {
        playlistAudioRef.current.pause();
        playlistAudioRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {commentModalContextHolder}
      {modalContextHolder}
      <div
        className="newsfeed-page"
        style={{
          maxWidth: 1680,
          margin: "0 auto",
          padding: "var(--newsfeed-page-padding, 24px 24px)",
          background: "#0a0a0a",
          minHeight: "100vh",
        }}
      >
        <div
          className="profile-cover"
          style={{
            position: "relative",
            height: 300,
            background: profile?.coverPhotoUrl ? "#000" : "#131313",
            borderRadius: 12,
            marginBottom: 16,
            overflow: "hidden",
          }}
        >
          {profile?.coverPhotoUrl && (
            <img
              src={profile.coverPhotoUrl}
              alt="Cover"
              className="profile-cover__image"
            />
          )}
          {isOwnProfile && (
            <Upload
              showUploadList={false}
              accept="image/*"
              beforeUpload={() => {
                return false;
              }}
              onChange={async (info) => {
                const { file } = info;
                const fileToUpload = file?.originFileObj || file;

                if (!fileToUpload) {
                  return;
                }

                if (file?.status === "done" || file?.status === "uploading") {
                  return;
                }

                try {
                  setUploadingCoverPhoto(true);
                  const res = await uploadMyCoverPhoto(fileToUpload);
                  const url =
                    res?.data?.coverPhotoUrl || res?.data?.user?.coverPhotoUrl;
                  if (url) {
                    setProfile((prev) =>
                      prev ? { ...prev, coverPhotoUrl: url } : prev
                    );
                    message.success("Cập nhật ảnh bìa thành công");
                    if (file) file.status = "done";
                  } else {
                    if (file) file.status = "error";
                  }
                } catch (e) {
                  message.error(e.message || "Tải ảnh bìa thất bại");
                  if (file) file.status = "error";
                } finally {
                  setUploadingCoverPhoto(false);
                }
              }}
            >
              <Button
                loading={uploadingCoverPhoto}
                type="primary"
                style={{
                  position: "absolute",
                  bottom: 16,
                  right: 16,
                  background: "rgba(0, 0, 0, 0.6)",
                  borderColor: "#fff",
                  color: "#fff",
                }}
              >
                {profile?.coverPhotoUrl ? "Thay đổi ảnh bìa" : "Thêm ảnh bìa"}
              </Button>
            </Upload>
          )}
        </div>
        <div
          className="profile-feed-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "var(--newsfeed-grid-columns, 360px minmax(0, 1.2fr) 360px)",
            gap: "var(--newsfeed-grid-gap, 24px)",
          }}
        >
          <div className="profile-feed-left">
            <Card
              style={{
                background: "#0f0f10",
                borderColor: "#1f1f1f",
                marginBottom: 12,
                padding: 0,
              }}
            >
              <div
                style={{
                  height: 250,
                  borderRadius: "8px 8px 0 0",
                  backgroundColor: "#131313",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Avatar
                  size={150}
                  src={getValidAvatarUrl(profile?.avatarUrl)}
                  style={{
                    backgroundColor: "#722ed1",
                    border: "4px solid #0f0f10",
                  }}
                >
                  {(profile?.displayName || profile?.username || "U")[0]}
                </Avatar>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "12px 16px 20px 16px",
                }}
              >
                <div
                  style={{ marginTop: 12, textAlign: "center", width: "100%" }}
                >
                  <div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>
                    {profile?.displayName || profile?.username || "User"}
                  </div>
                  <div style={{ color: "#9ca3af", marginTop: 4 }}>
                    @{profile?.username || ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  {isOwnProfile ? (
                    <Button
                      onClick={() => navigate("/profile")}
                      style={{
                        background: "#fff",
                        color: "#111",
                        borderColor: "#fff",
                        padding: "0 20px",
                        height: 40,
                        borderRadius: 999,
                      }}
                    >
                      Xem hồ sơ
                    </Button>
                  ) : (
                    <Button
                      onClick={toggleFollow}
                      loading={followLoading}
                      style={{
                        background: isFollowing ? "#111" : "#fff",
                        color: isFollowing ? "#fff" : "#111",
                        borderColor: isFollowing ? "#303030" : "#fff",
                        padding: "0 20px",
                        height: 40,
                        borderRadius: 999,
                      }}
                    >
                      {isFollowing ? "Đang theo dõi" : "Theo dõi"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
            <Card style={{ background: "#0f0f10", borderColor: "#1f1f1f" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "opacity 0.2s",
                  }}
                  onClick={() => {
                    if (!userId) return;
                    setFollowersModalOpen(true);
                    fetchFollowers();
                  }}
                  onMouseEnter={(e) => {
                    if (profile?.followersCount > 0) {
                      e.currentTarget.style.opacity = "0.7";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                >
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>
                    {profile?.followersCount ?? 0}
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
                    Người theo dõi
                  </div>
                </div>
                <div
                  style={{
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "opacity 0.2s",
                  }}
                  onClick={() => {
                    if (!userId) return;
                    setFollowingModalOpen(true);
                    fetchFollowing();
                  }}
                  onMouseEnter={(e) => {
                    if (profile?.followingCount > 0) {
                      e.currentTarget.style.opacity = "0.7";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                >
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>
                    {profile?.followingCount ?? 0}
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
                    Đang theo dõi
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="profile-feed-main">
            {isMobileSidebar && (
              <Button
                block
                className="newsfeed-sidebar-toggle"
                icon={<MenuOutlined />}
                onClick={() => setSidebarOpen(true)}
                style={{ marginBottom: 16 }}
              >
                Xem mạng xã hội
              </Button>
            )}

            {/* Post composer - only show if own profile */}
            {isOwnProfile && activeTab === "activity" && (
              <div
                className="composer-card"
                style={{
                  marginBottom: 20,
                  background: "#0f0f10",
                  border: "1px solid #1f1f1f",
                  borderRadius: 8,
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
                onClick={handleModalOpen}
              >
                <Avatar
                  size={40}
                  src={getValidAvatarUrl(profile?.avatarUrl)}
                  style={{ backgroundColor: "#722ed1" }}
                >
                  {(profile?.displayName || profile?.username || "U")[0]}
                </Avatar>
                <Input.TextArea
                  className="composer-input"
                  placeholder="Có gì mới ?"
                  autoSize={{ minRows: 2, maxRows: 8 }}
                  style={{
                    flex: 1,
                    background: "#fff",
                    border: "none",
                    borderRadius: 10,
                    minHeight: 56,
                    fontSize: 16,
                  }}
                  readOnly
                />
                <Button
                  className="composer-action-btn"
                  type="primary"
                  size="large"
                  style={{
                    borderRadius: 999,
                    background: "#1890ff",
                    padding: "0 22px",
                    height: 44,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleModalOpen();
                  }}
                >
                  Đăng bài
                </Button>
              </div>
            )}

            <div className="profile-tabs">
              {[
                { key: "activity", label: "Hoạt động" },
                { key: "licks", label: "Licks" },
                { key: "projects", label: "Projects" },
                { key: "playlists", label: "Playlists" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={
                    "profile-tab-btn" +
                    (activeTab === tab.key ? " profile-tab-btn--active" : "")
                  }
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "activity" && (
              <>
                <Modal
                  open={isModalOpen}
                  title={
                    <span style={{ color: "#fff", fontWeight: 600 }}>
                      Tạo bài đăng
                    </span>
                  }
                  onCancel={handleModalClose}
                  footer={
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <Button
                        shape="round"
                        onClick={handleModalClose}
                        style={{
                          height: 44,
                          borderRadius: 22,
                          padding: 0,
                          width: 108,
                          background: "#1f1f1f",
                          color: "#e5e7eb",
                          borderColor: "#303030",
                        }}
                      >
                        Hủy
                      </Button>
                      <Button
                        type="primary"
                        shape="round"
                        loading={posting}
                        onClick={handleCreatePost}
                        style={{
                          height: 44,
                          borderRadius: 22,
                          padding: 0,
                          width: 108,
                          background: "#7c3aed",
                          borderColor: "#7c3aed",
                        }}
                      >
                        Đăng
                      </Button>
                    </div>
                  }
                  styles={{
                    content: { background: "#0f0f10" },
                    header: {
                      background: "#0f0f10",
                      borderBottom: "1px solid #1f1f1f",
                    },
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Space size={12} align="center">
                        <Avatar
                          size={48}
                          src={getValidAvatarUrl(profile?.avatarUrl)}
                          style={{ background: "#7c3aed" }}
                        >
                          {
                            (profile?.displayName ||
                              profile?.username ||
                              "U")[0]
                          }
                        </Avatar>
                        <div>
                          <Text style={{ color: "#fff", fontWeight: 600 }}>
                            {profile?.displayName ||
                              profile?.username ||
                              "User"}
                          </Text>
                          <div style={{ color: "#9ca3af", fontSize: 13 }}>
                            Sẵn sàng chia sẻ cảm hứng với cộng đồng
                          </div>
                        </div>
                      </Space>
                      <Tag
                        color="#7c3aed"
                        style={{
                          borderRadius: 999,
                          margin: 0,
                          color: "#fff",
                          border: "none",
                        }}
                      >
                        Bài viết mới
                      </Tag>
                    </div>

                    <div
                      style={{
                        ...composerSectionStyle,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <Input.TextArea
                        placeholder="Chia sẻ điều gì đó..."
                        autoSize={{ minRows: 4, maxRows: 10 }}
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        allowClear
                        style={{
                          background: "#0b0b0f",
                          border: "1px solid #222",
                          borderRadius: 14,
                          padding: 16,
                          color: "#f8fafc",
                          fontSize: 16,
                          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ color: "#9ca3af", fontSize: 13 }}>
                          Bạn có thể chèn link lick hoặc video để auto preview
                        </span>
                        <span style={{ color: "#fff", fontWeight: 600 }}>
                          {usedChars}/{maxChars}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          width: "100%",
                          background: "#1f1f1f",
                          borderRadius: 999,
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${charPercent}%`,
                            background:
                              charPercent > 80 ? "#f97316" : "#7c3aed",
                            borderRadius: 999,
                            transition: "width 0.2s ease",
                          }}
                        />
                      </div>
                    </div>

                    <div
                      className="composer-section"
                      style={{
                        ...composerSectionStyle,
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                        border: "1px solid #2a2a2a",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              ...composerLabelStyle,
                              marginBottom: 6,
                              fontSize: 16,
                            }}
                          >
                            Đính kèm lick
                          </div>
                          <div
                            style={{ ...composerHintStyle, lineHeight: "1.5" }}
                          >
                            Chỉ hiển thị các lick đang active trong tài khoản.
                            Chỉ chọn 1 trong 3: Project, Lick, hoặc Link.
                          </div>
                        </div>
                        <Tag
                          color="#1f1f1f"
                          style={{
                            borderRadius: 999,
                            color: "#9ca3af",
                            border: "none",
                            marginLeft: 12,
                          }}
                        >
                          Tùy chọn
                        </Tag>
                      </div>
                      <Select
                        mode="multiple"
                        placeholder="Chọn 1 lick để đính kèm..."
                        value={selectedLickIds}
                        onChange={(values) => {
                          const next = Array.isArray(values)
                            ? values.slice(0, 1)
                            : [];
                          setSelectedLickIds(next);
                          if (next.length > 0) {
                            setLinkPreview(null);
                            setSelectedProjectId(null);
                          }
                        }}
                        loading={loadingLicks}
                        style={{
                          width: "100%",
                          backgroundColor: "#1a1a1a",
                          border: "1px solid #3a3a3a",
                          borderRadius: 8,
                        }}
                        options={availableLicks}
                        popupMatchSelectWidth={false}
                        styles={{ popup: { root: { minWidth: 360, maxWidth: 520, whiteSpace: "normal" } } }}
                        optionLabelProp="label"
                        notFoundContent={
                          loadingLicks ? (
                            <Spin size="small" />
                          ) : (
                            <Empty description="Không có lick active nào" />
                          )
                        }
                        filterOption={(input, option) =>
                          (option?.label ?? "")
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                        popupClassName="dark-select-dropdown project-select-dropdown"
                        allowClear
                        disabled={
                          !!extractFirstUrl(newText) || !!selectedProjectId
                        }
                      />
                    </div>

                    <div
                      className="composer-section"
                      style={{
                        ...composerSectionStyle,
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                        border: "1px solid #2a2a2a",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              ...composerLabelStyle,
                              marginBottom: 6,
                              fontSize: 16,
                            }}
                          >
                            Chọn project
                          </div>
                          <div
                            style={{ ...composerHintStyle, lineHeight: "1.5" }}
                          >
                            Chỉ hiển thị các project có trạng thái active. Chỉ
                            chọn 1 trong 3: Project, Lick, hoặc Link.
                          </div>
                        </div>
                        <Tag
                          color="#1f1f1f"
                          style={{
                            borderRadius: 999,
                            color: "#9ca3af",
                            border: "none",
                            marginLeft: 12,
                          }}
                        >
                          Tùy chọn
                        </Tag>
                      </div>
                      <Select
                        placeholder="Chọn project để đính kèm..."
                        value={selectedProjectId}
                        onChange={(value) => {
                          setSelectedProjectId(value);
                          if (value) {
                            setSelectedLickIds([]);
                            setLinkPreview(null);
                          }
                        }}
                        loading={loadingProjects}
                        style={{
                          width: "100%",
                          backgroundColor: "#1a1a1a",
                          border: "1px solid #3a3a3a",
                          borderRadius: 8,
                        }}
                        options={availableProjects}
                        popupMatchSelectWidth={false}
                        styles={{ popup: { root: { minWidth: 360, maxWidth: 520, whiteSpace: "normal" } } }}
                        optionLabelProp="label"
                        notFoundContent={
                          loadingProjects ? (
                            <Spin size="small" />
                          ) : (
                            <Empty description="Không có project active nào" />
                          )
                        }
                        filterOption={(input, option) =>
                          (option?.label ?? "")
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                        popupClassName="dark-select-dropdown project-select-dropdown"
                        allowClear
                        disabled={
                          selectedLickIds.length > 0 ||
                          !!extractFirstUrl(newText)
                        }
                      />
                    </div>

                    {extractFirstUrl(newText) &&
                      selectedLickIds.length === 0 && (
                        <div
                          style={{
                            ...composerSectionStyle,
                            border: "1px solid #303030",
                            background: "#111",
                            color: "#e5e7eb",
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                          }}
                        >
                          {linkLoading ? (
                            <Text style={{ color: "#bfbfbf" }}>
                              Đang tải preview…
                            </Text>
                          ) : (
                            <a
                              href={extractFirstUrl(newText)}
                              target="_blank"
                              rel="noreferrer"
                              style={{ textDecoration: "none" }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  gap: 12,
                                  alignItems: "center",
                                }}
                              >
                                {linkPreview?.thumbnailUrl ? (
                                  <img
                                    src={linkPreview.thumbnailUrl}
                                    alt="preview"
                                    style={{
                                      width: 64,
                                      height: 64,
                                      objectFit: "cover",
                                      borderRadius: 6,
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: 64,
                                      height: 64,
                                      borderRadius: 6,
                                      background: "#1f1f1f",
                                    }}
                                  />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      color: "#fff",
                                      marginBottom: 4,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {linkPreview?.title ||
                                      extractFirstUrl(newText)}
                                  </div>
                                  <div
                                    style={{
                                      color: "#9ca3af",
                                      fontSize: 12,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {extractFirstUrl(newText)}
                                  </div>
                                </div>
                              </div>
                            </a>
                          )}
                        </div>
                      )}
                  </div>
                </Modal>

                {loading && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: 24,
                    }}
                  >
                    <Spin />
                  </div>
                )}
                {!loading && error && (
                  <Card
                    style={{
                      marginBottom: 20,
                      background: "#0f0f10",
                      borderColor: "#1f1f1f",
                    }}
                  >
                    <Text style={{ color: "#fff" }}>{error}</Text>
                  </Card>
                )}
                {!loading && !error && items.length === 0 && (
                  <Empty
                    description={
                      <span style={{ color: "#9ca3af" }}>Chưa có bài đăng</span>
                    }
                  />
                )}

                {!loading &&
                  !error &&
                  items.map((post) => {
                    const firstUrl = extractFirstUrl(post?.textContent || "");
                    const sharedLickId = parseSharedLickId(firstUrl);
                    const previewUrl = sharedLickId
                      ? null
                      : post?.linkPreview?.url || firstUrl;
                    const previewData =
                      post?.linkPreview ||
                      (previewUrl ? previewCache[previewUrl] : null);

                    // Parse lick/project ID from linkPreview URL
                    const linkPreviewLickId = post?.linkPreview?.url
                      ? parseSharedLickId(post.linkPreview.url)
                      : null;
                    const linkPreviewProjectId = post?.linkPreview?.url
                      ? parseProjectId(post.linkPreview.url)
                      : null;
                    return (
                      <Card
                        key={post._id}
                        style={{
                          marginBottom: 20,
                          background: "#0f0f10",
                          borderColor: "#1f1f1f",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: 12,
                          }}
                        >
                          <Space align="start" size={14}>
                            <Avatar
                              size={40}
                              src={getValidAvatarUrl(post?.userId?.avatarUrl)}
                              style={{ background: "#2db7f5" }}
                            >
                              {
                                (post?.userId?.displayName ||
                                  post?.userId?.username ||
                                  "U")[0]
                              }
                            </Avatar>
                            <div>
                              <Space style={{ marginBottom: 4 }}>
                                <Text
                                  strong
                                  style={{ color: "#fff", fontSize: 16 }}
                                >
                                  {post?.userId?.displayName ||
                                    post?.userId?.username ||
                                    "Người dùng"}
                                </Text>
                                <Text
                                  type="secondary"
                                  style={{ color: "#9ca3af", fontSize: 13 }}
                                >
                                  {formatTime(post?.createdAt)}
                                </Text>
                              </Space>
                            </div>
                          </Space>
                          {currentUserId &&
                            (() => {
                              const postAuthorId =
                                post?.userId?._id ||
                                post?.userId?.id ||
                                post?.userId;
                              const isOwnPost =
                                postAuthorId &&
                                currentUserId &&
                                postAuthorId.toString() ===
                                  currentUserId.toString();

                              // Debug log (remove in production)
                              if (process.env.NODE_ENV === "development") {
                                console.log("Post debug:", {
                                  postId: post._id,
                                  postAuthorId,
                                  currentUserId,
                                  isOwnPost,
                                  postUserId: post?.userId,
                                });
                              }

                              if (isOwnPost) {
                                // Menu for own posts: Edit and Hide
                                return (
                                  <Dropdown
                                    menu={{
                                      items: [
                                        {
                                          key: "edit",
                                          label: "Chỉnh sửa bài post",
                                          icon: <EditOutlined />,
                                        },
                                        {
                                          key: "hide",
                                          label: "Lưu trữ bài post",
                                          icon: <DeleteOutlined />,
                                          danger: true,
                                          disabled: deletingPostId === post._id,
                                        },
                                      ],
                                      onClick: ({ key }) => {
                                        console.log(
                                          "Dropdown clicked, key:",
                                          key,
                                          "postId:",
                                          post._id
                                        );
                                        if (key === "edit") {
                                          console.log(
                                            "Opening edit modal for post:",
                                            post._id
                                          );
                                          openEditModal(post);
                                        } else if (key === "hide") {
                                          console.log("Hiding post:", post._id);
                                          handleHidePost(post._id);
                                        }
                                      },
                                    }}
                                    trigger={["click"]}
                                  >
                                    <Button
                                      type="text"
                                      icon={<MoreOutlined />}
                                      style={{ color: "#9ca3af" }}
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
                                        key: "report",
                                        label: postIdToReported[post._id]
                                          ? "Đã báo cáo"
                                          : "Báo cáo bài viết",
                                        icon: <FlagOutlined />,
                                        disabled: postIdToReported[post._id],
                                      },
                                    ],
                                    onClick: ({ key }) => {
                                      if (key === "report") {
                                        openReportModal(post._id);
                                      }
                                    },
                                  }}
                                  trigger={["click"]}
                                >
                                  <Button
                                    type="text"
                                    icon={<MoreOutlined />}
                                    style={{ color: "#9ca3af" }}
                                  />
                                </Dropdown>
                              );
                            })()}
                        </div>
                        {/* Chỉ hiển thị text, nhưng ẩn các dòng chỉ chứa URL (để không lộ link thô) */}
                        {(() => {
                          if (!post?.textContent) return null;
                          const raw = String(post.textContent || "").trim();
                          const firstUrl = extractFirstUrl(raw || "");
                          // Bỏ các dòng mà nội dung chỉ là URL
                          const lines = raw.split(/\r?\n/);
                          const filteredLines = lines.filter((line) => {
                            const trimmed = line.trim();
                            if (!trimmed) return false;
                            const lineUrl = extractFirstUrl(trimmed);
                            // Nếu cả dòng chỉ là một URL → không hiển thị
                            if (lineUrl && trimmed === lineUrl.trim())
                              return false;
                            return true;
                          });
                          const displayText = filteredLines.join("\n").trim();
                          if (!displayText) return null;
                          return (
                            <div
                              style={{
                                marginBottom: 10,
                                color: "#fff",
                                fontSize: 15,
                                lineHeight: 1.6,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                            >
                              {displayText}
                            </div>
                          );
                        })()}
                        {sharedLickId && (
                          <div style={{ marginBottom: 12 }}>
                            <PostLickEmbed
                              lickId={sharedLickId}
                              url={firstUrl}
                            />
                          </div>
                        )}

                        {/* Preview project đính kèm: dùng ProjectPlayer phát nhạc, không hiển thị trạng thái/updated */}
                        {post?.projectId?.audioUrl && (
                          <div style={{ marginBottom: 12 }}>
                            <ProjectPlayer
                              audioUrl={post.projectId.audioUrl}
                              waveformData={post.projectId.waveformData}
                              audioDuration={post.projectId.audioDuration}
                              projectName={post.projectId.title}
                            />
                          </div>
                        )}
                        {post?.attachedLicks &&
                          Array.isArray(post.attachedLicks) &&
                          post.attachedLicks.length > 0 && (
                            <div
                              style={{
                                marginBottom: 12,
                                display: "flex",
                                flexDirection: "column",
                                gap: 12,
                              }}
                            >
                              {post.attachedLicks.map((lick) => {
                                const lickId =
                                  lick?._id || lick?.lick_id || lick;
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
                        {post?.linkPreview &&
                          (() => {
                            const linkPreviewUrl = post.linkPreview?.url;
                            if (!linkPreviewUrl) return null;

                            // If it's a lick URL, show PostLickEmbed
                            if (linkPreviewLickId) {
                              return (
                                <div style={{ marginBottom: 12 }}>
                                  <PostLickEmbed
                                    lickId={linkPreviewLickId}
                                    url={linkPreviewUrl}
                                  />
                                </div>
                              );
                            }

                            // If it's a project URL, show PostProjectEmbed
                            if (linkPreviewProjectId) {
                              return (
                                <div style={{ marginBottom: 12 }}>
                                  <PostProjectEmbed
                                    projectId={linkPreviewProjectId}
                                    url={linkPreviewUrl}
                                  />
                                </div>
                              );
                            }

                            // Otherwise, show default link preview card
                            return (
                              <a
                                href={linkPreviewUrl || "#"}
                                target="_blank"
                                rel="noreferrer"
                                style={{ textDecoration: "none" }}
                              >
                                <div
                                  style={{
                                    border: "1px solid #303030",
                                    borderRadius: 8,
                                    padding: 12,
                                    background: "#111",
                                    color: "#e5e7eb",
                                    marginTop: 8,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 12,
                                      alignItems: "center",
                                    }}
                                  >
                                    {(() => {
                                      const imgSrc =
                                        (previewData &&
                                          previewData.thumbnailUrl) ||
                                        deriveThumbnail(linkPreviewUrl);
                                      return imgSrc ? (
                                        <img
                                          src={imgSrc}
                                          alt="preview"
                                          style={{
                                            width: 64,
                                            height: 64,
                                            objectFit: "cover",
                                            borderRadius: 6,
                                          }}
                                        />
                                      ) : null;
                                    })() || (
                                      <div
                                        style={{
                                          width: 64,
                                          height: 64,
                                          borderRadius: 6,
                                          background: "#1f1f1f",
                                        }}
                                      />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontWeight: 600,
                                          color: "#fff",
                                          marginBottom: 4,
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {previewData?.title || linkPreviewUrl}
                                      </div>
                                      <div
                                        style={{
                                          color: "#9ca3af",
                                          fontSize: 12,
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {linkPreviewUrl}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </a>
                            );
                          })()}
                        {!post?.linkPreview && previewUrl && (
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ textDecoration: "none" }}
                          >
                            <div
                              style={{
                                border: "1px solid #303030",
                                borderRadius: 8,
                                padding: 12,
                                background: "#111",
                                color: "#e5e7eb",
                                marginTop: 8,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  gap: 12,
                                  alignItems: "center",
                                }}
                              >
                                {(() => {
                                  const imgSrc =
                                    (previewData && previewData.thumbnailUrl) ||
                                    deriveThumbnail(previewUrl);
                                  return imgSrc ? (
                                    <img
                                      src={imgSrc}
                                      alt="preview"
                                      style={{
                                        width: 64,
                                        height: 64,
                                        objectFit: "cover",
                                        borderRadius: 6,
                                      }}
                                    />
                                  ) : null;
                                })() || (
                                  <div
                                    style={{
                                      width: 64,
                                      height: 64,
                                      borderRadius: 6,
                                      background: "#1f1f1f",
                                    }}
                                  />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      color: "#fff",
                                      marginBottom: 4,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {previewData?.title || previewUrl}
                                  </div>
                                  <div
                                    style={{
                                      color: "#9ca3af",
                                      fontSize: 12,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {previewUrl}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </a>
                        )}
                        <Space
                          className="post-actions"
                          style={{
                            marginTop: 14,
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Button
                              icon={<LikeOutlined />}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: postIdToLiked[post._id]
                                  ? "#1890ff"
                                  : "#fff",
                              }}
                              loading={likingPostId === post._id}
                              onClick={() => handleLike(post._id)}
                            >
                              Thích
                            </Button>
                            {Number(postIdToStats[post._id]?.likesCount ?? 0) >
                              0 && (
                              <span
                                onClick={() => openLikesModal(post._id)}
                                style={{
                                  color: "#1890ff",
                                  cursor: "pointer",
                                  fontSize: 14,
                                  fontWeight: 500,
                                  userSelect: "none",
                                }}
                              >
                                {postIdToStats[post._id].likesCount} lượt thích
                              </span>
                            )}
                          </div>
                          <Button
                            icon={<MessageOutlined />}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#fff",
                            }}
                            onClick={() => openComment(post._id)}
                          >
                            Bình luận{" "}
                            {Number(
                              postIdToStats[post._id]?.commentsCount ?? 0
                            ) > 0
                              ? `(${postIdToStats[post._id].commentsCount})`
                              : ""}
                          </Button>
                        </Space>

                        {/* Danh sách bình luận - chỉ hiển thị 3 comment gần nhất */}
                        {postIdToComments[post._id] &&
                          postIdToComments[post._id].length > 0 && (
                            <div
                              style={{
                                marginTop: 12,
                                background: "#0f0f10",
                                borderTop: "1px solid #1f1f1f",
                                paddingTop: 8,
                              }}
                            >
                              {limitToNewest3(postIdToComments[post._id]).map(
                                (c) => {
                                  const canDelete = canDeleteComment(c, post);
                                  return (
                                    <div
                                      key={c._id}
                                      style={{
                                        display: "flex",
                                        gap: 8,
                                        marginBottom: 8,
                                      }}
                                    >
                                      <Avatar
                                        size={28}
                                        style={{ background: "#555" }}
                                      >
                                        {c?.userId?.displayName?.[0] ||
                                          c?.userId?.username?.[0] ||
                                          "U"}
                                      </Avatar>
                                      <div
                                        style={{
                                          background: "#151515",
                                          border: "1px solid #232323",
                                          borderRadius: 10,
                                          padding: "6px 10px",
                                          color: "#e5e7eb",
                                          flex: 1,
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: 8,
                                          }}
                                        >
                                          <div style={{ fontWeight: 600 }}>
                                            {c?.userId?.displayName ||
                                              c?.userId?.username ||
                                              "Người dùng"}
                                          </div>
                                          {canDelete && (
                                            <Dropdown
                                              trigger={["click"]}
                                              menu={buildCommentMenuProps(
                                                post._id,
                                                c._id
                                              )}
                                            >
                                              <Button
                                                type="text"
                                                icon={<MoreOutlined />}
                                                loading={
                                                  deletingCommentId === c._id
                                                }
                                                style={{
                                                  color: "#9ca3af",
                                                  padding: 0,
                                                }}
                                              />
                                            </Dropdown>
                                          )}
                                        </div>
                                        <div>{c.comment}</div>
                                      </div>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          )}
                      </Card>
                    );
                  })}

                <div ref={loaderRef} style={{ height: 1 }} />
              </>
            )}

            {activeTab === "licks" && (
              <Card style={{ background: "#0f0f10", borderColor: "#1f1f1f" }}>
                <div
                  style={{
                    marginBottom: 16,
                    color: "#e5e7eb",
                    fontWeight: 600,
                  }}
                >
                  Licks của {profile?.displayName || profile?.username}
                </div>
                {userLicksLoading && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: 24,
                    }}
                  >
                    <Spin />
                  </div>
                )}
                {!userLicksLoading && userLicks.length === 0 && (
                  <Empty
                    description={
                      <span style={{ color: "#9ca3af" }}>Chưa có lick nào</span>
                    }
                  />
                )}
                {!userLicksLoading && userLicks.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userLicks.map((lick) => (
                      <LickCard
                        key={lick.lick_id || lick._id}
                        lick={lick}
                        onClick={(id) => navigate(`/licks/${id}`)}
                      />
                    ))}
                  </div>
                )}
              </Card>
            )}

            {activeTab === "projects" && (
              <Card style={{ background: "#0f0f10", borderColor: "#1f1f1f" }}>
                <div
                  style={{
                    marginBottom: 12,
                    color: "#e5e7eb",
                    fontWeight: 600,
                  }}
                >
                  Projects của {profile?.displayName || profile?.username}
                </div>
                {userProjectsLoading && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: 24,
                    }}
                  >
                    <Spin />
                  </div>
                )}
                {!userProjectsLoading && userProjects.length === 0 && (
                  <Empty
                    description={
                      <span style={{ color: "#9ca3af" }}>
                        Chưa có project nào
                      </span>
                    }
                  />
                )}
                {!userProjectsLoading && userProjects.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(260px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {userProjects
                      .filter((project) => project.status === "active")
                      .map((project) => (
                        <div
                          key={project._id}
                          style={{
                            background: "#020617",
                            borderRadius: 14,
                            border: "1px solid #1f2937",
                            padding: 16,
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                          }}
                        >
                          <div style={{ marginBottom: 4 }}>
                            <Text style={{ color: "#e5e7eb", fontWeight: 600 }}>
                              {project.title || "Untitled Project"}
                            </Text>
                            {project.description && (
                              <div
                                style={{
                                  color: "#9ca3af",
                                  fontSize: 12,
                                  marginTop: 4,
                                }}
                              >
                                {project.description}
                              </div>
                            )}
                          </div>
                          {project.audioUrl ? (
                            <ProjectPlayer
                              audioUrl={project.audioUrl}
                              waveformData={project.waveformData}
                              audioDuration={project.audioDuration}
                              projectName={project.title}
                              style={{ marginTop: 4 }}
                            />
                          ) : (
                            <div
                              style={{
                                height: 80,
                                borderRadius: 12,
                                background:
                                  "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(15,23,42,0.6))",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#64748b",
                                fontSize: 12,
                              }}
                            >
                              Chưa có audio export cho project này
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </Card>
            )}

            {activeTab === "playlists" && (
              <Card style={{ background: "#0f0f10", borderColor: "#1f1f1f" }}>
                <div
                  style={{
                    marginBottom: 16,
                    color: "#e5e7eb",
                    fontWeight: 600,
                  }}
                >
                  Playlists của {profile?.displayName || profile?.username}
                </div>
                {userPlaylistsLoading && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: 24,
                    }}
                  >
                    <Spin />
                  </div>
                )}
                {!userPlaylistsLoading && userPlaylists.length === 0 && (
                  <Empty
                    description={
                      <span style={{ color: "#9ca3af" }}>
                        Chưa có playlist nào
                      </span>
                    }
                  />
                )}
                {!userPlaylistsLoading && userPlaylists.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(220px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {userPlaylists.map((pl) => (
                      <div
                        key={pl.playlist_id || pl._id}
                        style={{
                          background: "#111827",
                          borderRadius: 12,
                          border: "1px solid #1f2937",
                          overflow: "hidden",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          minHeight: 220,
                        }}
                        onClick={() => openPlaylistDetail(pl)}
                      >
                        <div
                          style={{
                            position: "relative",
                            height: 120,
                            background:
                              "linear-gradient(135deg, #111827, #1f2937, #4b5563)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {pl.cover_image_url ? (
                            <img
                              src={pl.cover_image_url}
                              alt={pl.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: 40 }}>🎵</span>
                          )}
                          <div
                            style={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              display: "flex",
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                backgroundColor: pl.is_public
                                  ? "#16a34a"
                                  : "#374151",
                                color: "#f9fafb",
                              }}
                            >
                              {pl.is_public ? "Public" : "Private"}
                            </span>
                          </div>
                        </div>
                        <div
                          style={{ padding: "10px 12px 12px 12px", flex: 1 }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: "#f9fafb",
                              marginBottom: 4,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {pl.name || "Untitled Playlist"}
                          </div>
                          {pl.description && (
                            <div
                              style={{
                                color: "#9ca3af",
                                fontSize: 12,
                                marginBottom: 6,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {pl.description}
                            </div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: 11,
                              color: "#9ca3af",
                              marginTop: 4,
                            }}
                          >
                            <span>{pl.licks_count || 0} licks</span>
                            {pl.updated_at && (
                              <span>
                                {new Date(pl.updated_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          {!isMobileSidebar && (
            <div className="profile-feed-sidebar">{sidebarContent}</div>
          )}
        </div>
        {isMobileSidebar && (
          <Drawer
            placement="right"
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            width={320}
            destroyOnClose
            className="newsfeed-sidebar-drawer"
            styles={{ body: { padding: 0, background: "#0a0a0a" } }}
          >
            <div className="newsfeed-sidebar-drawer-content hide-scrollbar">
              {sidebarContent}
            </div>
          </Drawer>
        )}
      </div>

      <Modal
        title={
          <span style={{ color: "#fff", fontWeight: 700 }}>Người đã thích</span>
        }
        open={likesModalOpen}
        onCancel={() => {
          setLikesModalOpen(false);
          setLikesPostId(null);
          setLikesList([]);
        }}
        footer={null}
        width={500}
        styles={{
          header: { background: "#0f0f10", borderBottom: "1px solid #1f1f1f" },
          content: { background: "#0f0f10", borderRadius: 12 },
          body: { background: "#0f0f10", maxHeight: "60vh", overflowY: "auto" },
        }}
      >
        {likesLoading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 24 }}
          >
            <Spin />
          </div>
        ) : likesList.length === 0 ? (
          <Empty
            description={
              <span style={{ color: "#9ca3af" }}>
                Chưa có ai thích bài viết này
              </span>
            }
          />
        ) : (
          <List
            dataSource={likesList}
            renderItem={(user) => {
              const isCurrentUser =
                currentUserId &&
                user.id &&
                user.id.toString() === currentUserId.toString();
              return (
                <List.Item
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid #1f1f1f",
                  }}
                  actions={
                    isCurrentUser
                      ? null
                      : [
                          <Button
                            key="follow"
                            size="small"
                            type={
                              userIdToFollowing[user.id] ? "default" : "primary"
                            }
                            loading={!!userIdToFollowLoading[user.id]}
                            onClick={() => toggleFollowUser(user.id)}
                            style={{
                              background: userIdToFollowing[user.id]
                                ? "#111"
                                : "#7c3aed",
                              borderColor: userIdToFollowing[user.id]
                                ? "#444"
                                : "#7c3aed",
                              color: "#fff",
                            }}
                          >
                            {userIdToFollowing[user.id]
                              ? "Đang theo dõi"
                              : "Follow"}
                          </Button>,
                        ]
                  }
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        size={40}
                        src={getValidAvatarUrl(user.avatarUrl)}
                        style={{ background: "#2db7f5", cursor: "pointer" }}
                        onClick={() => navigate(`/users/${user.id}/newfeeds`)}
                      >
                        {user.displayName?.[0] || user.username?.[0] || "U"}
                      </Avatar>
                    }
                    title={
                      <span
                        style={{ color: "#fff", cursor: "pointer" }}
                        onClick={() => navigate(`/users/${user.id}/newfeeds`)}
                      >
                        {user.displayName || user.username || "Người dùng"}
                      </span>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Modal>

      {/* Playlist detail modal */}
      <Modal
        open={playlistModalOpen}
        onCancel={() => {
          if (!playlistModalLoading) {
            if (playlistAudioRef.current) {
              playlistAudioRef.current.pause();
              playlistAudioRef.current = null;
            }
            setPlayingLickId(null);
            setPlaylistModalOpen(false);
            setPlaylistDetail(null);
          }
        }}
        footer={null}
        width={720}
        styles={{
          header: { background: "#0f0f10", borderBottom: "1px solid #1f1f1f" },
          content: { background: "#0f0f10", borderRadius: 12 },
          body: { background: "#0f0f10" },
        }}
        title={
          <span style={{ color: "#fff", fontWeight: 600 }}>
            Playlist detail
          </span>
        }
      >
        {playlistModalLoading && (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 32 }}
          >
            <Spin />
          </div>
        )}
        {!playlistModalLoading && playlistDetail && (
          <div style={{ color: "#e5e7eb" }}>
            {(() => {
              const playlist =
                playlistDetail.playlist ||
                playlistDetail.data ||
                playlistDetail;
              const tracks =
                playlistDetail.licks ||
                playlistDetail.tracks ||
                playlistDetail.items ||
                [];
              return (
                <>
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: 16,
                        background:
                          "linear-gradient(135deg, #111827, #1f2937, #4b5563)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {playlist?.cover_image_url ? (
                        <img
                          src={playlist.cover_image_url}
                          alt={playlist.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 42 }}>🎵</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: "#fff",
                          marginBottom: 4,
                        }}
                      >
                        {playlist?.name || "Untitled Playlist"}
                      </div>
                      {playlist?.description && (
                        <div
                          style={{
                            color: "#9ca3af",
                            fontSize: 13,
                            marginBottom: 6,
                          }}
                        >
                          {playlist.description}
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          fontSize: 12,
                          color: "#9ca3af",
                          marginTop: 4,
                        }}
                      >
                        <span>
                          {playlist.licks_count ||
                            playlist.tracks?.length ||
                            tracks.length ||
                            0}{" "}
                          licks
                        </span>
                        {playlist.updated_at && (
                          <>
                            <span>•</span>
                            <span>
                              Cập nhật{" "}
                              {new Date(
                                playlist.updated_at
                              ).toLocaleDateString()}
                            </span>
                          </>
                        )}
                        {typeof playlist.is_public === "boolean" && (
                          <>
                            <span>•</span>
                            <span>
                              {playlist.is_public ? "Public" : "Private"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid #1f2937",
                      paddingTop: 12,
                      marginTop: 8,
                    }}
                  >
                    <div
                      style={{
                        marginBottom: 8,
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      Các bài trong playlist
                    </div>
                    {tracks.length === 0 ? (
                      <Empty
                        description={
                          <span style={{ color: "#9ca3af" }}>
                            Playlist chưa có bài nào
                          </span>
                        }
                      />
                    ) : (
                      <>
                        {/* Waveform preview cho bài đang phát */}
                        {playingLickId && (
                          <div style={{ marginBottom: 12 }}>
                            {(() => {
                              const current =
                                tracks.find((t) => {
                                  const l = t.lick || t.lickId || t;
                                  const id = l?._id || l?.lick_id || t?.lickId;
                                  return (
                                    id &&
                                    id.toString() === playingLickId.toString()
                                  );
                                }) || null;
                              const currentLick =
                                current?.lick || current?.lickId || current;
                              const wfData =
                                currentLick?.waveform_data ||
                                currentLick?.waveformData ||
                                [];
                              return (
                                <SimpleWaveform
                                  waveformData={wfData}
                                  isPlaying={true}
                                  height={70}
                                  style={{
                                    background:
                                      "linear-gradient(180deg,#020617,#020617)",
                                  }}
                                />
                              );
                            })()}
                          </div>
                        )}

                        <List
                          size="small"
                          dataSource={tracks}
                          renderItem={(item, index) => {
                            const lick = item.lick || item.lickId || item;
                            const lickId =
                              lick?._id || lick?.lick_id || item?.lickId;
                            return (
                              <List.Item
                                style={{
                                  borderBottom: "1px solid #111827",
                                  cursor: lickId ? "pointer" : "default",
                                }}
                                onClick={() =>
                                  handlePlayLickFromPlaylist(lickId)
                                }
                              >
                                <List.Item.Meta
                                  title={
                                    <span
                                      style={{
                                        color: "#f9fafb",
                                        fontWeight:
                                          playingLickId === lickId ? 700 : 500,
                                      }}
                                    >
                                      {index + 1}.{" "}
                                      {lick?.title ||
                                        item.title ||
                                        "Untitled Lick"}
                                    </span>
                                  }
                                  description={
                                    <span
                                      style={{ color: "#9ca3af", fontSize: 12 }}
                                    >
                                      {lick?.description ||
                                        item.description ||
                                        "Không có mô tả"}
                                    </span>
                                  }
                                />
                              </List.Item>
                            );
                          }}
                        />
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </Modal>

      <Modal
        title={
          <span style={{ color: "#fff", fontWeight: 700 }}>
            Bình luận bài viết
          </span>
        }
        open={commentOpen}
        onCancel={() => setCommentOpen(false)}
        footer={null}
        width={860}
        styles={{
          header: { background: "#0f0f10", borderBottom: "1px solid #1f1f1f" },
          content: { background: "#0f0f10", borderRadius: 12 },
          body: { background: "#0f0f10" },
        }}
      >
        {modalPost && (
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <Avatar
                size={40}
                src={getValidAvatarUrl(modalPost?.userId?.avatarUrl)}
                style={{ background: "#2db7f5" }}
              >
                {modalPost?.userId?.displayName?.[0] ||
                  modalPost?.userId?.username?.[0] ||
                  "U"}
              </Avatar>
              <div>
                <div style={{ color: "#fff", fontWeight: 600 }}>
                  {modalPost?.userId?.displayName ||
                    modalPost?.userId?.username ||
                    "Người dùng"}
                </div>
                <Text
                  type="secondary"
                  style={{ color: "#9ca3af", fontSize: 12 }}
                >
                  {formatTime(modalPost?.createdAt)}
                </Text>
              </div>
            </div>
            {modalPost?.textContent && (
              <div style={{ marginBottom: 8, color: "#e5e7eb" }}>
                {modalPost.textContent}
              </div>
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
              <div style={{ marginBottom: 8 }}>
                <WavePlaceholder />
              </div>
            )}
            {modalPost?.linkPreview && (
              <a
                href={modalPost.linkPreview?.url || "#"}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    border: "1px solid #303030",
                    borderRadius: 8,
                    padding: 12,
                    background: "#111",
                    color: "#e5e7eb",
                    marginTop: 8,
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 12, alignItems: "center" }}
                  >
                    {modalPost.linkPreview?.thumbnailUrl ||
                    previewCache[modalPost.linkPreview?.url]?.thumbnailUrl ? (
                      <img
                        src={
                          modalPost.linkPreview?.thumbnailUrl ||
                          previewCache[modalPost.linkPreview?.url]?.thumbnailUrl
                        }
                        alt="preview"
                        style={{
                          width: 64,
                          height: 64,
                          objectFit: "cover",
                          borderRadius: 6,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 6,
                          background: "#1f1f1f",
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: "#fff",
                          marginBottom: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {modalPost.linkPreview?.title ||
                          previewCache[modalPost.linkPreview?.url]?.title ||
                          modalPost.linkPreview?.url}
                      </div>
                      <div
                        style={{
                          color: "#9ca3af",
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {modalPost.linkPreview?.url}
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            )}

            <div style={{ marginTop: 8, color: "#9ca3af" }}>
              {Number(postIdToStats[commentPostId]?.likesCount ?? 0)} lượt thích
              · {Number(postIdToStats[commentPostId]?.commentsCount ?? 0)} bình
              luận
            </div>

            <div style={{ marginTop: 12, maxHeight: 360, overflowY: "auto" }}>
              {(postIdToComments[commentPostId] || [])
                .filter((c) => !c.parentCommentId)
                .map((c) => {
                  const canDelete = canDeleteComment(c, modalPost);
                  const replies = commentReplies[c._id] || [];
                  const isReplying = replyingToCommentId === c._id;
                  const replyText = replyTexts[c._id] || "";
                  return (
                    <div key={c._id} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Avatar
                          size={28}
                          src={getValidAvatarUrl(c?.userId?.avatarUrl)}
                          style={{ background: "#555" }}
                        >
                          {c?.userId?.displayName?.[0] ||
                            c?.userId?.username?.[0] ||
                            "U"}
                        </Avatar>
                        <div
                          style={{
                            background: "#151515",
                            border: "1px solid #232323",
                            borderRadius: 10,
                            padding: "6px 10px",
                            color: "#e5e7eb",
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>
                              {c?.userId?.displayName ||
                                c?.userId?.username ||
                                "Người dùng"}
                            </div>
                            {canDelete && (
                              <Dropdown
                                trigger={["click"]}
                                menu={buildCommentMenuProps(
                                  commentPostId,
                                  c._id
                                )}
                              >
                                <Button
                                  type="text"
                                  icon={<MoreOutlined />}
                                  loading={deletingCommentId === c._id}
                                  style={{ color: "#9ca3af", padding: 0 }}
                                />
                              </Dropdown>
                            )}
                          </div>
                          <div style={{ marginTop: 4, marginBottom: 6 }}>
                            {c.comment}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              marginTop: 4,
                            }}
                          >
                            <Button
                              type="text"
                              size="small"
                              onClick={() =>
                                isReplying
                                  ? cancelReply(c._id)
                                  : startReply(c._id)
                              }
                              style={{
                                color: "#9ca3af",
                                padding: 0,
                                height: "auto",
                                fontSize: 12,
                              }}
                            >
                              {isReplying ? "Hủy" : "Phản hồi"}
                            </Button>
                            {replies.length > 0 && (
                              <span style={{ color: "#9ca3af", fontSize: 12 }}>
                                {replies.length} phản hồi
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Reply input */}
                      {isReplying && (
                        <div
                          style={{
                            marginLeft: 36,
                            marginTop: 8,
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                            }}
                          >
                            <Input
                              placeholder="Nhập phản hồi..."
                              value={replyText}
                              onChange={(e) =>
                                setReplyTexts((prev) => ({
                                  ...prev,
                                  [c._id]: e.target.value,
                                }))
                              }
                              style={{
                                background: "#0f0f10",
                                color: "#e5e7eb",
                                borderColor: "#303030",
                                borderRadius: 8,
                                flex: 1,
                              }}
                              onPressEnter={() => submitReply(c._id)}
                            />
                            <Button
                              type="primary"
                              size="small"
                              loading={commentSubmitting}
                              onClick={() => submitReply(c._id)}
                              style={{
                                background: "#7c3aed",
                                borderColor: "#7c3aed",
                                borderRadius: 8,
                              }}
                            >
                              Gửi
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Replies list */}
                      {replies.length > 0 && (
                        <div style={{ marginLeft: 36, marginTop: 8 }}>
                          {replies.map((reply) => {
                            const canDeleteReply = canDeleteComment(
                              reply,
                              modalPost
                            );
                            return (
                              <div
                                key={reply._id}
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  marginBottom: 8,
                                }}
                              >
                                <Avatar
                                  size={24}
                                  src={getValidAvatarUrl(
                                    reply?.userId?.avatarUrl
                                  )}
                                  style={{ background: "#555" }}
                                >
                                  {reply?.userId?.displayName?.[0] ||
                                    reply?.userId?.username?.[0] ||
                                    "U"}
                                </Avatar>
                                <div
                                  style={{
                                    background: "#1a1a1a",
                                    border: "1px solid #2a2a2a",
                                    borderRadius: 8,
                                    padding: "6px 10px",
                                    color: "#e5e7eb",
                                    flex: 1,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      gap: 8,
                                    }}
                                  >
                                    <div
                                      style={{ fontWeight: 600, fontSize: 13 }}
                                    >
                                      {reply?.userId?.displayName ||
                                        reply?.userId?.username ||
                                        "Người dùng"}
                                    </div>
                                    {canDeleteReply && (
                                      <Dropdown
                                        trigger={["click"]}
                                        menu={buildCommentMenuProps(
                                          commentPostId,
                                          reply._id
                                        )}
                                      >
                                        <Button
                                          type="text"
                                          icon={<MoreOutlined />}
                                          loading={
                                            deletingCommentId === reply._id
                                          }
                                          style={{
                                            color: "#9ca3af",
                                            padding: 0,
                                            fontSize: 12,
                                          }}
                                        />
                                      </Dropdown>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 13, marginTop: 2 }}>
                                    {reply.comment}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginTop: 12,
              }}
            >
              <Input
                placeholder="Nhập bình luận của bạn..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onPressEnter={submitComment}
                style={{
                  background: "#0f0f10",
                  color: "#e5e7eb",
                  borderColor: "#303030",
                  height: 44,
                  borderRadius: 22,
                  flex: 1,
                }}
              />
              <Button
                type="primary"
                loading={commentSubmitting}
                onClick={submitComment}
                style={{
                  background: "#7c3aed",
                  borderColor: "#7c3aed",
                  borderRadius: 22,
                  padding: "0 20px",
                  height: 44,
                }}
              >
                Gửi
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Report Modal */}
      <Modal
        title={
          <span style={{ color: "#fff", fontWeight: 700 }}>
            Báo cáo bài viết
          </span>
        }
        open={reportModalOpen}
        onCancel={() => {
          setReportModalOpen(false);
          setReportPostId(null);
          setReportReason("");
          setReportDescription("");
        }}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <Button
              onClick={() => {
                setReportModalOpen(false);
                setReportPostId(null);
                setReportReason("");
                setReportDescription("");
              }}
              style={{
                background: "#1f1f1f",
                color: "#e5e7eb",
                borderColor: "#303030",
              }}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              loading={reportSubmitting}
              onClick={submitReport}
              disabled={!reportReason}
              style={{ background: "#7c3aed", borderColor: "#7c3aed" }}
            >
              Gửi báo cáo
            </Button>
          </div>
        }
        width={500}
        styles={{
          header: { background: "#0f0f10", borderBottom: "1px solid #1f1f1f" },
          content: { background: "#0f0f10", borderRadius: 12 },
          body: { background: "#0f0f10" },
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <Text
              style={{
                color: "#e5e7eb",
                marginBottom: 8,
                display: "block",
                fontWeight: 600,
              }}
            >
              Lý do báo cáo <span style={{ color: "#ef4444" }}>*</span>
            </Text>
            <Radio.Group
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              style={{ width: "100%" }}
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <Radio value="spam" style={{ color: "#e5e7eb" }}>
                  Spam
                </Radio>
                <Radio value="inappropriate" style={{ color: "#e5e7eb" }}>
                  Nội dung không phù hợp
                </Radio>
                <Radio value="copyright" style={{ color: "#e5e7eb" }}>
                  Vi phạm bản quyền
                </Radio>
                <Radio value="harassment" style={{ color: "#e5e7eb" }}>
                  Quấy rối
                </Radio>
                <Radio value="other" style={{ color: "#e5e7eb" }}>
                  Khác
                </Radio>
              </Space>
            </Radio.Group>
          </div>
          <div>
            <Text
              style={{
                color: "#e5e7eb",
                marginBottom: 8,
                display: "block",
                fontWeight: 600,
              }}
            >
              Mô tả chi tiết (tùy chọn)
            </Text>
            <Input.TextArea
              placeholder="Vui lòng mô tả chi tiết về vấn đề..."
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              rows={4}
              maxLength={500}
              showCount
              style={{
                background: "#0f0f10",
                color: "#e5e7eb",
                borderColor: "#303030",
              }}
            />
          </div>
        </div>
      </Modal>

      {/* Hide Post Confirmation Modal */}
      <Modal
        open={hideConfirmModalOpen}
        title="Xác nhận lưu trữ bài viết"
        onCancel={() => {
          setHideConfirmModalOpen(false);
          setPostToHide(null);
        }}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <Button
              onClick={() => {
                setHideConfirmModalOpen(false);
                setPostToHide(null);
              }}
            >
              Hủy
            </Button>
            <Button
              danger
              loading={deletingPostId === postToHide}
              onClick={confirmHidePost}
            >
              Lưu trữ
            </Button>
          </div>
        }
        styles={{
          content: { background: "#0f0f10" },
          header: {
            background: "#0f0f10",
            borderBottom: "1px solid #1f1f1f",
          },
        }}
      >
        <div style={{ color: "#e5e7eb" }}>
          Bạn có chắc chắn muốn lưu trữ bài viết này? Bài viết sẽ được chuyển
          vào kho lưu trữ và sẽ bị xóa vĩnh viễn sau 30 ngày nếu không khôi
          phục.
        </div>
      </Modal>

      {/* Edit Post Modal */}
      <Modal
        open={editModalOpen}
        title={
          <span style={{ color: "#fff", fontWeight: 600 }}>
            Chỉnh sửa bài đăng
          </span>
        }
        onCancel={() => {
          if (!editing) {
            setEditModalOpen(false);
            setEditingPost(null);
            setEditText("");
          }
        }}
        footer={
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Button
              shape="round"
              onClick={() => {
                if (!editing) {
                  setEditModalOpen(false);
                  setEditingPost(null);
                  setEditText("");
                }
              }}
              style={{
                height: 44,
                borderRadius: 22,
                padding: 0,
                width: 108,
                background: "#1f1f1f",
                color: "#e5e7eb",
                borderColor: "#303030",
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
                background: "#7c3aed",
                borderColor: "#7c3aed",
              }}
            >
              Cập nhật
            </Button>
          </div>
        }
        styles={{
          content: { background: "#0f0f10" },
          header: {
            background: "#0f0f10",
            borderBottom: "1px solid #1f1f1f",
          },
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input.TextArea
            placeholder="Chia sẻ điều gì đó..."
            autoSize={{ minRows: 6, maxRows: 16 }}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            maxLength={maxChars}
            showCount
          />

          {/* Preview phần nội dung giống ngoài feed (lick/media/link) */}
          {editingPost && (
            <>
              {/* Chỉ hiển thị phần chỉnh sửa tương ứng với loại nội dung của bài post */}
              {(() => {
                // Kiểm tra xem bài post có lick không (attachedLicks hoặc shared lick URL trong textContent ban đầu)
                const originalUrl = extractFirstUrl(
                  editingPost?.textContent || ""
                );
                const originalSharedLickId = originalUrl
                  ? parseSharedLickId(originalUrl)
                  : null;
                const hasAttachedLicks =
                  editingPost?.attachedLicks &&
                  Array.isArray(editingPost.attachedLicks) &&
                  editingPost.attachedLicks.length > 0;
                const hasSharedLickUrl = !!originalSharedLickId;
                const hasLick = hasAttachedLicks || hasSharedLickUrl;

                // Kiểm tra xem bài post có project không (phải là giá trị hợp lệ, không phải object rỗng)
                const projectIdValue = editingPost?.projectId;
                let hasValidProject = false;

                // Chỉ coi là có project nếu projectId thực sự tồn tại và hợp lệ
                if (projectIdValue != null) {
                  // != null checks for both null and undefined
                  if (typeof projectIdValue === "string") {
                    // Nếu là string, phải không rỗng
                    hasValidProject = projectIdValue.trim() !== "";
                  } else if (typeof projectIdValue === "object") {
                    // Nếu là object, phải có _id hoặc id hợp lệ
                    const projectId = projectIdValue._id || projectIdValue.id;
                    if (projectId) {
                      // Kiểm tra xem có phải là object rỗng không
                      const keys = Object.keys(projectIdValue);
                      // Phải có ít nhất 1 key (không phải object rỗng) VÀ phải có _id hoặc id hợp lệ
                      const isValidId =
                        typeof projectId === "string"
                          ? projectId.trim() !== ""
                          : !!projectId;
                      hasValidProject = keys.length > 0 && isValidId;
                    } else {
                      // Nếu không có _id hoặc id → không phải project hợp lệ
                      hasValidProject = false;
                    }
                  }
                } else {
                  // Nếu projectId là null hoặc undefined → không có project
                  hasValidProject = false;
                }

                // Chỉ hiển thị project nếu có project hợp lệ VÀ không có lick (vì chỉ chọn 1 trong 3)
                const hasProject =
                  hasValidProject === true && hasLick === false;

                // Kiểm tra xem bài post có link preview không (và không phải là shared lick URL, và không có lick/project)
                const hasLinkPreview =
                  !!editingPost?.linkPreview &&
                  !originalSharedLickId &&
                  !hasLick &&
                  !hasValidProject;

                return (
                  <>
                    {/* Chỉ hiển thị nếu bài post có lick */}
                    {hasLick && (
                      <div
                        className="composer-section"
                        style={{
                          ...composerSectionStyle,
                          display: "flex",
                          flexDirection: "column",
                          gap: 16,
                          border: "1px solid #2a2a2a",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: 4,
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                ...composerLabelStyle,
                                marginBottom: 6,
                                fontSize: 16,
                              }}
                            >
                              Đính kèm lick (chỉnh sửa)
                            </div>
                            <div
                              style={{
                                ...composerHintStyle,
                                lineHeight: "1.5",
                              }}
                            >
                              Bạn có thể thay đổi hoặc bỏ lick đang đính kèm.
                            </div>
                          </div>
                        </div>
                        <Select
                          mode="multiple"
                          placeholder="Chọn 1 lick để đính kèm..."
                          value={editSelectedLickIds}
                          onChange={(values) => {
                            const next = Array.isArray(values)
                              ? values.slice(0, 1)
                              : [];
                            setEditSelectedLickIds(next);
                          }}
                          loading={loadingLicks}
                          style={{
                            width: "100%",
                            backgroundColor: "#1a1a1a",
                            border: "1px solid #3a3a3a",
                            borderRadius: 8,
                          }}
                          options={availableLicks}
                          popupMatchSelectWidth={false}
                          styles={{ popup: { root: { minWidth: 360, maxWidth: 520, whiteSpace: "normal" } } }}
                          optionLabelProp="label"
                          notFoundContent={
                            loadingLicks ? (
                              <Spin size="small" />
                            ) : (
                              <Empty description="Không có lick active nào" />
                            )
                          }
                          filterOption={(input, option) =>
                            (option?.label ?? "")
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          popupClassName="dark-select-dropdown project-select-dropdown"
                          allowClear
                        />
                      </div>
                    )}

                    {/* Chỉ hiển thị nếu bài post có project VÀ không có lick */}
                    {hasProject && !hasLick && (
                      <div
                        className="composer-section"
                        style={{
                          ...composerSectionStyle,
                          display: "flex",
                          flexDirection: "column",
                          gap: 16,
                          border: "1px solid #2a2a2a",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: 4,
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                ...composerLabelStyle,
                                marginBottom: 6,
                                fontSize: 16,
                              }}
                            >
                              Chọn project (chỉnh sửa)
                            </div>
                            <div
                              style={{
                                ...composerHintStyle,
                                lineHeight: "1.5",
                              }}
                            >
                              Bạn có thể thay đổi hoặc bỏ project đang đính kèm.
                            </div>
                          </div>
                        </div>
                        <Select
                          placeholder="Chọn project để đính kèm..."
                          value={editSelectedProjectId}
                          onChange={(value) => {
                            setEditSelectedProjectId(value || null);
                            if (value) {
                              setEditSelectedLickIds([]);
                              setEditLinkPreview(null);
                            }
                          }}
                          loading={loadingProjects}
                          style={{
                            width: "100%",
                            backgroundColor: "#1a1a1a",
                            border: "1px solid #3a3a3a",
                            borderRadius: 8,
                          }}
                          options={availableProjects}
                        popupMatchSelectWidth={false}
                        styles={{ popup: { root: { minWidth: 360, maxWidth: 520, whiteSpace: "normal" } } }}
                        optionLabelProp="label"
                          notFoundContent={
                            loadingProjects ? (
                              <Spin size="small" />
                            ) : (
                              <Empty description="Không có project active nào" />
                            )
                          }
                          filterOption={(input, option) =>
                            (option?.label ?? "")
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          popupClassName="dark-select-dropdown project-select-dropdown"
                          allowClear
                          showSearch
                          optionFilterProp="label"
                        />
                      </div>
                    )}

                    {/* Chỉ hiển thị nếu bài post có link preview (không phải shared lick) */}
                    {hasLinkPreview && (
                      <div
                        style={{
                          ...composerSectionStyle,
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div style={composerLabelStyle}>
                              Link preview (chỉnh sửa)
                            </div>
                            <div style={composerHintStyle}>
                              Link preview sẽ tự động cập nhật khi bạn thay đổi
                              URL trong nội dung.
                            </div>
                          </div>
                          <Tag
                            color="#1f1f1f"
                            style={{
                              borderRadius: 999,
                              color: "#9ca3af",
                              border: "none",
                            }}
                          >
                            Tự động
                          </Tag>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {(() => {
                const url = extractFirstUrl(editText || "");
                const sharedLickId = parseSharedLickId(url);
                if (!sharedLickId) return null;
                return (
                  <div style={{ marginTop: 8 }}>
                    <PostLickEmbed lickId={sharedLickId} url={url} />
                  </div>
                );
              })()}

              {/* Attached licks giống ngoài feed */}
              {editSelectedLickIds.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {editSelectedLickIds.map((lickId) => {
                    if (!lickId) return null;
                    return (
                      <div key={lickId} style={{ marginBottom: 8 }}>
                        <PostLickEmbed lickId={lickId} />
                      </div>
                    );
                  })}
                </div>
              )}

              {editingPost?.media?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <WavePlaceholder />
                </div>
              )}

              {(() => {
                // Nếu không phải lick được embed từ URL thì hiển thị preview link giống ngoài feed
                const firstUrl = extractFirstUrl(editText || "");
                const sharedLickId = parseSharedLickId(firstUrl);
                if (sharedLickId) return null;

                // Ưu tiên URL và dữ liệu preview tương ứng với nội dung đang chỉnh sửa
                const previewUrl =
                  firstUrl ||
                  editLinkPreview?.url ||
                  editingPost?.linkPreview?.url;
                if (!previewUrl) return null;

                const previewData =
                  (firstUrl && editLinkPreview) ||
                  editLinkPreview ||
                  editingPost?.linkPreview ||
                  (previewUrl ? previewCache[previewUrl] : null);

                return (
                  <div
                    style={{
                      border: "1px solid #303030",
                      borderRadius: 8,
                      padding: 12,
                      background: "#111",
                      color: "#e5e7eb",
                      marginTop: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      {(() => {
                        const imgSrc =
                          (previewData && previewData.thumbnailUrl) ||
                          deriveThumbnail(previewUrl);
                        return imgSrc ? (
                          <img
                            src={imgSrc}
                            alt="preview"
                            style={{
                              width: 64,
                              height: 64,
                              objectFit: "cover",
                              borderRadius: 6,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 6,
                              background: "#1f1f1f",
                            }}
                          />
                        );
                      })()}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "#fff",
                            marginBottom: 4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {previewData?.title || previewUrl}
                        </div>
                        <div
                          style={{
                            color: "#9ca3af",
                            fontSize: 12,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {previewUrl}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </Modal>

      {/* Followers Modal */}
      <Modal
        title={
          <span style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>
            Người theo dõi
          </span>
        }
        open={followersModalOpen}
        onCancel={() => setFollowersModalOpen(false)}
        footer={null}
        width={450}
        style={{ top: 20 }}
        styles={{
          content: { background: "#0f0f10", padding: "20px" },
          header: {
            background: "#0f0f10",
            borderBottom: "1px solid #1f1f1f",
            paddingBottom: 16,
          },
        }}
      >
        {followersLoading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 24 }}
          >
            <Spin />
          </div>
        ) : followersList.length === 0 ? (
          <Empty
            description={
              <span style={{ color: "#9ca3af" }}>Chưa có người theo dõi</span>
            }
          />
        ) : (
          <List
            dataSource={followersList}
            renderItem={(user) => {
              const isCurrentUser =
                currentUserId &&
                user.id &&
                user.id.toString() === currentUserId.toString();
              return (
                <List.Item
                  style={{
                    padding: "16px 0",
                    borderBottom: "1px solid #1f1f1f",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#1a1a1a";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                  onClick={() => {
                    setFollowersModalOpen(false);
                    navigate(`/users/${user.id}/newfeeds`);
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    <Avatar
                      src={
                        user.avatarUrl &&
                        typeof user.avatarUrl === "string" &&
                        user.avatarUrl.trim() !== ""
                          ? user.avatarUrl
                          : undefined
                      }
                      icon={<UserOutlined />}
                      size={48}
                      style={{ background: "#2db7f5", marginRight: 12 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: 15,
                          marginBottom: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {user.displayName || user.username || "Người dùng"}
                      </div>
                      {user.displayName && user.username && (
                        <div
                          style={{
                            color: "#9ca3af",
                            fontSize: 13,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          @{user.username}
                        </div>
                      )}
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </Modal>

      {/* Following Modal */}
      <Modal
        title={
          <span style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>
            Đang theo dõi
          </span>
        }
        open={followingModalOpen}
        onCancel={() => setFollowingModalOpen(false)}
        footer={null}
        width={450}
        style={{ top: 20 }}
        styles={{
          content: { background: "#0f0f10", padding: "20px" },
          header: {
            background: "#0f0f10",
            borderBottom: "1px solid #1f1f1f",
            paddingBottom: 16,
          },
        }}
      >
        {followingLoading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 24 }}
          >
            <Spin />
          </div>
        ) : followingList.length === 0 ? (
          <Empty
            description={
              <span style={{ color: "#9ca3af" }}>Chưa theo dõi ai</span>
            }
          />
        ) : (
          <List
            dataSource={followingList}
            renderItem={(user) => {
              const isCurrentUser =
                currentUserId &&
                user.id &&
                user.id.toString() === currentUserId.toString();
              return (
                <List.Item
                  style={{
                    padding: "16px 0",
                    borderBottom: "1px solid #1f1f1f",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#1a1a1a";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                  onClick={() => {
                    setFollowingModalOpen(false);
                    navigate(`/users/${user.id}/newfeeds`);
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    <Avatar
                      src={
                        user.avatarUrl &&
                        typeof user.avatarUrl === "string" &&
                        user.avatarUrl.trim() !== ""
                          ? user.avatarUrl
                          : undefined
                      }
                      icon={<UserOutlined />}
                      size={48}
                      style={{ background: "#2db7f5", marginRight: 12 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: 15,
                          marginBottom: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {user.displayName || user.username || "Người dùng"}
                      </div>
                      {user.displayName && user.username && (
                        <div
                          style={{
                            color: "#9ca3af",
                            fontSize: 13,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          @{user.username}
                        </div>
                      )}
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </Modal>
    </>
  );
};

export default UserFeed;
