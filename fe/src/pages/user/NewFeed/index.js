import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Card,
  Avatar,
  Button,
  Typography,
  Space,
  Input,
  List,
  Divider,
  Tag,
  Spin,
  Empty,
  message,
  Modal,
  Select,
  Dropdown,
  Radio,
  Drawer,
} from "antd";
import {
  LikeOutlined,
  MessageOutlined,
  PlusOutlined,
  HeartOutlined,
  CrownOutlined,
  UserOutlined,
  MoreOutlined,
  FlagOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  CustomerServiceOutlined,
  LinkOutlined,
  MenuOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  listPosts,
  createPost,
  getPostById,
  updatePost,
  deletePost,
} from "../../../services/user/post";
import {
  likePost,
  unlikePost,
  createPostComment,
  getPostStats,
  getAllPostComments,
  getPostLikes,
  deletePostComment,
} from "../../../services/user/post";
import {
  followUser,
  unfollowUser,
  getFollowSuggestions,
  getProfileById,
  getFollowingList,
  getMyProfile,
} from "../../../services/user/profile";
import { ensureConversationWith } from "../../../services/dmService";
import {
  onPostCommentNew,
  offPostCommentNew,
  onPostArchived,
  offPostArchived,
  joinRoom,
} from "../../../services/user/socketService";
import {
  getMyLicks,
  getTopLicksLeaderboard,
  playLickAudio,
} from "../../../services/user/lickService";
import { getUserProjects } from "../../../services/user/projectService";
import {
  reportPost,
  checkPostReport,
} from "../../../services/user/reportService";
import PostLickEmbed from "../../../components/PostLickEmbed";
import PostProjectEmbed from "../../../components/PostProjectEmbed";
import ProjectPlayer from "../../../components/ProjectPlayer";
import "./newFeedResponsive.css";

const { Title, Text } = Typography;
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

const Suggestion = ({ user, following, loading, onFollow }) => {
  const navigate = useNavigate();

  const handleOpenUserFeed = () => {
    if (!user?.id) return;
    navigate(`/users/${user.id}/newfeeds`);
  };

  const handleFollowClick = (e) => {
    e.stopPropagation();
    if (!user?.id) return;
    onFollow(user.id);
  };

  // Hiển thị lý do theo thứ tự ưu tiên từ backend
  // Thứ tự: 1. mutualFollowing, 2. sharedFollowers, 3. interactions, 4. popularity
  const reasons = Array.isArray(user?.reasons) ? user.reasons : [];
  const primaryReason = reasons.length > 0 ? reasons[0] : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "6px 0",
        width: "100%",
        cursor: "pointer",
      }}
      onClick={handleOpenUserFeed}
    >
      <Space size={12}>
        <Avatar
          size={36}
          src={
            user.avatarUrl &&
            typeof user.avatarUrl === "string" &&
            user.avatarUrl.trim() !== ""
              ? user.avatarUrl
              : undefined
          }
          style={{ background: "#555" }}
        >
          {(user.displayName || user.username || "U")[0]}
        </Avatar>
        <div>
          <Text strong style={{ color: "#fff" }}>
            {user.displayName || user.username}
          </Text>
          <div style={{ fontSize: 12, color: "#f3f5f7ff" }}>
            {Number(user.followersCount || 0)} người theo dõi
          </div>
          {primaryReason && (
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              {primaryReason}
            </div>
          )}
        </div>
      </Space>
      {following ? (
        <Button
          size="middle"
          type="primary"
          loading={loading}
          onClick={handleFollowClick}
          style={{ marginLeft: "auto", borderRadius: 999 }}
        >
          Đang theo dõi
        </Button>
      ) : (
        <Button
          shape="circle"
          size="large"
          type="primary"
          loading={loading}
          onClick={handleFollowClick}
          icon={<PlusOutlined />}
          style={{ marginLeft: "auto" }}
        />
      )}
    </div>
  );
};

const LeaderboardItem = ({
  rank,
  title,
  creatorName,
  likesCount,
  isPlaying,
  onClick,
}) => (
  <div
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      cursor: "pointer",
      padding: "4px 0",
    }}
  >
    <Space>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          fontWeight: "bold",
          color: "#fff",
          background: "#0f172a",
        }}
      >
        {rank}
      </div>
      <div>
        <Text strong style={{ color: "#fff" }}>
          {title}
        </Text>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>
          {creatorName || "Ẩn danh"} · {likesCount} lượt thích
        </div>
      </div>
    </Space>
    <Button
      type={isPlaying ? "primary" : "default"}
      shape="circle"
      size="small"
      icon={<CustomerServiceOutlined />}
      style={{
        borderColor: isPlaying ? "#7c3aed" : "#303030",
        background: isPlaying ? "#7c3aed" : "#111",
        color: "#fff",
      }}
    />
  </div>
);

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

const formatTime = (isoString) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return "";
  }
};

const formatTimeAgo = (isoString) => {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "vừa xong";
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return date.toLocaleDateString("vi-VN");
  } catch {
    return "";
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

const sortPostsByCreatedAtDesc = (posts) => {
  if (!Array.isArray(posts)) return [];
  return [...posts].sort((a, b) => {
    const timeA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
};

const NewsFeed = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = React.useRef(null);
  const mainScrollRef = React.useRef(null);
  const itemsRef = React.useRef([]);
  const [pendingNewPosts, setPendingNewPosts] = useState([]);
  const [isNearTop, setIsNearTop] = useState(true);
  const [lastSeenTopId, setLastSeenTopId] = useState(null);
  const [lastSeenTopCreatedAt, setLastSeenTopCreatedAt] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newText, setNewText] = useState("");
  const [showMediaUpload, setShowMediaUpload] = useState(false);
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
  const [previewCache, setPreviewCache] = useState({}); // url -> {title, thumbnailUrl}
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentPostId, setCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [likingPostId, setLikingPostId] = useState(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [postIdToStats, setPostIdToStats] = useState({}); // postId -> {likesCount, commentsCount}
  const [postIdToComments, setPostIdToComments] = useState({}); // postId -> comments[]
  const [postIdToLiked, setPostIdToLiked] = useState({}); // postId -> boolean
  const [postIdToCommentInput, setPostIdToCommentInput] = useState({}); // postId -> string
  const [modalPost, setModalPost] = useState(null);
  const [replyingToCommentId, setReplyingToCommentId] = useState(null); // commentId being replied to
  const [replyTexts, setReplyTexts] = useState({}); // commentId -> reply text
  const [commentReplies, setCommentReplies] = useState({}); // commentId -> replies[]
  const [loadingReplies, setLoadingReplies] = useState({}); // commentId -> boolean
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
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [postIdToReported, setPostIdToReported] = useState({}); // postId -> boolean
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editText, setEditText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editSelectedLickIds, setEditSelectedLickIds] = useState([]);
  const [editSelectedProjectId, setEditSelectedProjectId] = useState(null);
  const [editLinkPreview, setEditLinkPreview] = useState(null);
  const [editLinkLoading, setEditLinkLoading] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [leaderboardLicks, setLeaderboardLicks] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardPlayingId, setLeaderboardPlayingId] = useState(null);
  const [leaderboardLoadingId, setLeaderboardLoadingId] = useState(null);
  const leaderboardAudioRef = React.useRef(null);
  const { user: authUser } = useSelector((state) => state.auth || {});
  const [currentUser, setCurrentUser] = useState(
    authUser?.user || authUser || null
  );
  const currentUserId = useMemo(() => {
    const idFromAuthUser =
      authUser?.user?._id ||
      authUser?.user?.id ||
      authUser?.user?.userId ||
      authUser?._id ||
      authUser?.id ||
      authUser?.userId;
    const idFromCurrentUser =
      currentUser?._id || currentUser?.id || currentUser?.userId;

    return idFromAuthUser || idFromCurrentUser || null;
  }, [authUser, currentUser]);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [modal, modalContextHolder] = Modal.useModal();
  const [isMobileSidebar, setIsMobileSidebar] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 1024;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const composerUser = useMemo(() => {
    if (currentUser && Object.keys(currentUser).length > 0) return currentUser;
    if (authUser && Object.keys(authUser).length > 0) return authUser;
    return null;
  }, [authUser, currentUser]);

  const composerAvatarUrl =
    composerUser?.avatarUrl ||
    composerUser?.avatar_url ||
    composerUser?.avatar ||
    composerUser?.user?.avatarUrl ||
    composerUser?.user?.avatar_url ||
    composerUser?.user?.avatar ||
    "";

  const composerDisplayName =
    composerUser?.displayName ||
    composerUser?.username ||
    composerUser?.user?.displayName ||
    composerUser?.user?.username ||
    "Bạn";
  const composerInitial = composerDisplayName
    ? composerDisplayName[0].toUpperCase()
    : "U";
  const usedChars = newText?.length || 0;
  const charPercent = maxChars
    ? Math.min(100, Math.round((usedChars / maxChars) * 100))
    : 0;
  const isInitialLoading = loading && items.length === 0;
  const isLoadingMore = loading && items.length > 0;

  // Keep a ref of the current items for polling without resetting intervals
  useEffect(() => {
    itemsRef.current = items;
    if (Array.isArray(items) && items.length > 0) {
      const top = items[0];
      const topId = top?._id || top?.id;
      const topCreatedAt = top?.createdAt || null;
      setLastSeenTopId(topId || null);
      setLastSeenTopCreatedAt(topCreatedAt || null);
    }
  }, [items]);

  const handleMainScroll = (e) => {
    const top = e?.target?.scrollTop || 0;
    setIsNearTop(top < 120);
  };

  useEffect(() => {
    const syncScrollPosition = () => {
      const top =
        (mainScrollRef.current && mainScrollRef.current.scrollTop) ||
        window.scrollY ||
        0;
      setIsNearTop(top < 120);
    };
    window.addEventListener("scroll", syncScrollPosition, { passive: true });
    return () => {
      window.removeEventListener("scroll", syncScrollPosition);
    };
  }, []);

  const extractFirstUrl = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  };

  const getYoutubeId = (urlString) => {
    try {
      const u = new URL(urlString);
      if (u.hostname.includes("youtu.be")) {
        return u.pathname.replace("/", "");
      }
      if (u.hostname.includes("youtube.com")) {
        return u.searchParams.get("v");
      }
      return null;
    } catch {
      return null;
    }
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

      console.log("(NO $) [DEBUG][parseSharedLickId] Parsing:", {
        urlString,
        pathname: url.pathname,
        cleanPath,
        segments,
        firstSegment: segments[0],
        secondSegment: segments[1],
      });

      if (segments.length >= 2 && segments[0].toLowerCase() === "licks") {
        const id = segments[1];
        // Remove any query params or fragments from ID
        const cleanId = id.split("?")[0].split("#")[0];
        console.log(
          "(NO $) [DEBUG][parseSharedLickId] Found lick ID:",
          cleanId
        );
        return cleanId;
      }
      console.log("(NO $) [DEBUG][parseSharedLickId] No lick ID found");
      return null;
    } catch (err) {
      console.log(
        "(NO $) [DEBUG][parseSharedLickId] Failed to parse:",
        urlString,
        err
      );
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

      console.log("(NO $) [DEBUG][parseProjectId] Parsing:", {
        urlString,
        pathname: url.pathname,
        cleanPath,
        segments,
        firstSegment: segments[0],
        secondSegment: segments[1],
      });

      if (segments.length >= 2 && segments[0].toLowerCase() === "projects") {
        const id = segments[1];
        // Remove any query params or fragments from ID
        const cleanId = id.split("?")[0].split("#")[0];
        console.log(
          "(NO $) [DEBUG][parseProjectId] Found project ID:",
          cleanId
        );
        return cleanId;
      }
      console.log("(NO $) [DEBUG][parseProjectId] No project ID found");
      return null;
    } catch (err) {
      console.log(
        "(NO $) [DEBUG][parseProjectId] Failed to parse:",
        urlString,
        err
      );
      return null;
    }
  };

  const deriveThumbnail = (urlString) => {
    const ytId = getYoutubeId(urlString);
    if (ytId) {
      return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }
    return "";
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
        message.success("Đã bỏ thích");
      } else {
        // Like
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
      // reconcile with server (non-blocking)
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

  const getAuthorId = (post) => {
    // Ensure we always return a string ID, never an object
    const userId = post?.userId;
    if (!userId) return "";
    // If userId is already a string/number, return it as string
    if (typeof userId === "string" || typeof userId === "number") {
      return userId.toString();
    }
    // If userId is an object, extract _id or id
    if (typeof userId === "object") {
      const id = userId._id || userId.id;
      if (id) return id.toString();
    }
    return "";
  };

  const getCommentAuthorId = (comment) => {
    if (!comment) return "";
    const user = comment.userId || comment.user_id;
    if (!user) return "";
    if (typeof user === "string" || typeof user === "number") {
      return user.toString();
    }
    if (typeof user === "object") {
      const candidate = user._id || user.id || user.userId || user.user_id;
      return candidate ? candidate.toString() : "";
    }
    return "";
  };

  const currentUserRole = React.useMemo(() => {
    if (currentUser?.roleId) return currentUser.roleId;
    if (currentUser?.role) return currentUser.role;
    if (currentUser?.user?.roleId) return currentUser.user.roleId;
    if (currentUser?.user?.role) return currentUser.user.role;
    return undefined;
  }, [currentUser]);

  const isAdminUser = (currentUserRole || "").toLowerCase() === "admin";

  const isPostOwner = (post) => {
    const ownerId = getAuthorId(post);
    if (!ownerId || !currentUserId) return false;
    return ownerId.toString() === currentUserId.toString();
  };

  const canDeleteComment = (_, post) => isAdminUser || isPostOwner(post);

  const toggleFollow = async (uid) => {
    if (!uid) return;
    // Normalize ID thành string để đảm bảo consistency
    const uidStr = String(uid);
    try {
      setUserIdToFollowLoading((prev) => ({ ...prev, [uidStr]: true }));
      const isFollowing =
        !!userIdToFollowing[uidStr] || !!userIdToFollowing[uid];
      if (isFollowing) {
        await unfollowUser(uid);
        setUserIdToFollowing((prev) => {
          const next = { ...prev };
          delete next[uidStr];
          delete next[uid]; // Xóa cả 2 format để đảm bảo
          return next;
        });
        message.success("Đã bỏ theo dõi");
        // Refresh suggestions để loại bỏ user đã unfollow (nếu có trong suggestions)
        loadSuggestions();
      } else {
        await followUser(uid);
        setUserIdToFollowing((prev) => ({ ...prev, [uidStr]: true }));
        message.success("Đã theo dõi");
        // Refresh suggestions để loại bỏ user đã follow khỏi danh sách
        setSuggestions((prev) =>
          prev.filter((u) => {
            const uIdStr = String(u.id);
            return uIdStr !== uidStr && u.id !== uid;
          })
        );
      }
    } catch (e) {
      const msg = e?.message || "";
      if (
        !userIdToFollowing[uidStr] &&
        !userIdToFollowing[uid] &&
        msg.toLowerCase().includes("already following")
      ) {
        // BE trả về 400 nếu đã theo dõi trước đó; đồng bộ UI thành đang theo dõi
        setUserIdToFollowing((prev) => ({ ...prev, [uidStr]: true }));
        message.success("Đã theo dõi");
        // Refresh suggestions
        setSuggestions((prev) =>
          prev.filter((u) => {
            const uIdStr = String(u.id);
            return uIdStr !== uidStr && u.id !== uid;
          })
        );
      } else {
        message.error(msg || "Thao tác thất bại");
      }
    } finally {
      setUserIdToFollowLoading((prev) => {
        const next = { ...prev };
        delete next[uidStr];
        delete next[uid];
        return next;
      });
    }
  };

  const loadSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      const res = await getFollowSuggestions(10);
      const list = (res?.data || [])
        .filter((u) => {
          if (!u?.id) return false;
          // Loại bỏ current user
          if (currentUserId && u.id.toString() === currentUserId.toString())
            return false;
          // Loại bỏ các user đã follow
          const uidStr = u.id.toString();
          return !userIdToFollowing[uidStr] && !userIdToFollowing[u.id];
        })
        .slice(0, 5);
      // Normalize ID thành string để đảm bảo match với userIdToFollowing
      const map = {};
      list.forEach((u) => {
        const uidStr = String(u.id);
        map[uidStr] = false; // BE đã lọc CHƯA follow, nhưng đảm bảo normalize ID
      });
      setUserIdToFollowing((prev) => ({ ...prev, ...map }));
      setSuggestions(list);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Load suggestions failed:", e.message);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

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

  // Cleanup audio when unmount
  useEffect(() => {
    return () => {
      if (leaderboardAudioRef.current) {
        leaderboardAudioRef.current.pause();
        leaderboardAudioRef.current = null;
      }
    };
  }, []);

  const handlePlayLeaderboardLick = async (lick) => {
    const lickId = lick?.lick_id || lick?._id;
    if (!lickId) return;

    // If clicking on the same lick while it's playing -> pause/stop
    if (leaderboardPlayingId === lickId && leaderboardAudioRef.current) {
      leaderboardAudioRef.current.pause();
      setLeaderboardPlayingId(null);
      return;
    }

    try {
      setLeaderboardLoadingId(lickId);

      // Stop current audio if any
      if (leaderboardAudioRef.current) {
        leaderboardAudioRef.current.pause();
      } else {
        leaderboardAudioRef.current = new Audio();
        leaderboardAudioRef.current.addEventListener("ended", () => {
          setLeaderboardPlayingId(null);
        });
      }

      const res = await playLickAudio(lickId);
      const url = res?.data?.audio_url;
      if (!res?.success || !url) {
        message.error("Không thể phát lick này");
        return;
      }

      leaderboardAudioRef.current.src = url;
      await leaderboardAudioRef.current.play();
      setLeaderboardPlayingId(lickId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to play leaderboard lick:", e);
      message.error(e?.message || "Không thể phát lick");
      setLeaderboardPlayingId(null);
    } finally {
      setLeaderboardLoadingId(null);
    }
  };

  // Fetch top licks leaderboard for sidebar
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoadingLeaderboard(true);
        const res = await getTopLicksLeaderboard(5);
        if (res?.success && Array.isArray(res.data)) {
          setLeaderboardLicks(res.data);
        } else {
          setLeaderboardLicks([]);
        }
      } catch (e) {
        // Không chặn NewsFeed nếu leaderboard lỗi
        // eslint-disable-next-line no-console
        console.warn("Failed to load lick leaderboard:", e?.message || e);
        setLeaderboardLicks([]);
      } finally {
        setLoadingLeaderboard(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const openComment = async (postId, postOverride = null) => {
    setCommentPostId(postId);
    setCommentText("");
    setReplyingToCommentId(null);
    setReplyTexts({});
    const p = postOverride || items.find((it) => it._id === postId) || null;
    setModalPost(p);
    setCommentOpen(true);
    // Fetch tất cả top-level comments để hiển thị trong modal (không giới hạn 3)
    try {
      const all = await getAllPostComments(postId); // Get top-level comments (no parentCommentId)
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
      // Nếu fetch thất bại, vẫn giữ comments hiện có
      console.warn("Failed to fetch all comments for modal:", e);
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

  const submitInlineComment = async (postId) => {
    const text = (postIdToCommentInput[postId] || "").trim();
    if (!text) {
      message.warning("Vui lòng nhập bình luận");
      return;
    }
    try {
      setCommentSubmitting(true);
      await createPostComment(postId, { comment: text });
      setPostIdToCommentInput((prev) => ({ ...prev, [postId]: "" }));
      const all = await getAllPostComments(postId);
      const limited = limitToNewest3(Array.isArray(all) ? all : []);
      setPostIdToComments((prev) => ({ ...prev, [postId]: limited }));
      const statsRes = await getPostStats(postId);
      setPostIdToStats((prev) => ({
        ...prev,
        [postId]: statsRes?.data || prev[postId],
      }));
    } catch (e) {
      message.error(e.message || "Không thể gửi bình luận");
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
    modal.confirm({
      title: "Xóa bình luận này?",
      content:
        "Bình luận sẽ bị xóa khỏi bài viết và người viết sẽ không nhận thông báo.",
      okText: "Xóa",
      cancelText: "Hủy",
      okButtonProps: { danger: true },
      closable: true,
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

  const handleHidePost = (postId) => {
    modal.confirm({
      title: "Xác nhận lưu trữ bài viết",
      content:
        "Bạn có chắc chắn muốn lưu trữ bài viết này? Bài viết sẽ được chuyển vào kho lưu trữ và sẽ bị xóa vĩnh viễn sau 30 ngày nếu không khôi phục.",
      okText: "Lưu trữ",
      cancelText: "Hủy",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          setDeletingPostId(postId);
          await deletePost(postId);
          message.success(
            "Đã lưu trữ bài viết. Bài viết sẽ bị xóa vĩnh viễn sau 30 ngày nếu không khôi phục."
          );
          setItems((prev) => prev.filter((p) => p._id !== postId));
        } catch (e) {
          message.error(e.message || "Không thể lưu trữ bài viết");
        } finally {
          setDeletingPostId(null);
        }
      },
    });
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
    // Fetch licks và projects khi mở modal
    if (currentUserId) {
      fetchActiveLicks();
      fetchActiveProjects();
    }
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
      fetchData(1);
      setPage(1);
    } catch (e) {
      message.error(e.message || "Cập nhật bài viết thất bại");
    } finally {
      setEditing(false);
    }
  };

  const sidebarContent = (
    <>
      {/* Người liên hệ */}
      <Card
        style={{
          marginBottom: 16,
          background: "#0f0f10",
          borderColor: "#1f1f1f",
        }}
        title={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: 700 }}>
              Người đang theo dõi
            </Text>
            <Button
              type="text"
              icon={<MoreOutlined />}
              style={{ color: "#9ca3af", padding: 0 }}
            />
          </div>
        }
      >
        {loadingFollowing ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 16 }}
          >
            <Spin />
          </div>
        ) : followingUsers.length === 0 ? (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              color: "#9ca3af",
              fontSize: 13,
            }}
          >
            Chưa có người theo dõi
          </div>
        ) : (
          <List
            dataSource={followingUsers}
            renderItem={(user) => {
              const userId = user.id || user._id || user.userId;

              const handleChatClick = async (e) => {
                e.stopPropagation();
                try {
                  const conversation = await ensureConversationWith(userId);
                  if (conversation && conversation._id) {
                    window.dispatchEvent(
                      new CustomEvent("openChatWindow", {
                        detail: { conversation },
                      })
                    );
                  } else {
                    message.error("Không thể tạo cuộc trò chuyện");
                  }
                } catch (error) {
                  console.error("Error opening chat:", error);
                  message.error(error.message || "Không thể mở chat");
                }
              };

              const handleNameClick = (e) => {
                e.stopPropagation();
                if (userId) {
                  navigate(`/users/${userId}/newfeeds`);
                }
              };

              return (
                <List.Item
                  style={{
                    padding: "8px 0",
                    borderBottom: "1px solid #1f1f1f",
                  }}
                  actions={[
                    <Button
                      key="chat"
                      type="text"
                      icon={<MessageOutlined />}
                      onClick={handleChatClick}
                      style={{
                        color: "#9ca3af",
                        padding: "4px 8px",
                      }}
                    />,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        src={
                          user.avatarUrl &&
                          typeof user.avatarUrl === "string" &&
                          user.avatarUrl.trim() !== ""
                            ? user.avatarUrl
                            : undefined
                        }
                        icon={<UserOutlined />}
                        size={40}
                        style={{ background: "#2db7f5" }}
                      />
                    }
                    title={
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                        onClick={handleNameClick}
                      >
                        {user.displayName || user.username || "Người dùng"}
                      </Text>
                    }
                    description={
                      <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                        {user.isOnline ? (
                          <span style={{ color: "#52c41a" }}>
                            ● Đang hoạt động
                          </span>
                        ) : user.lastSeen ? (
                          `Hoạt động ${formatTimeAgo(user.lastSeen)}`
                        ) : (
                          "Offline"
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

      <Card
        style={{
          marginBottom: 16,
          background: "#0f0f10",
          borderColor: "#1f1f1f",
        }}
        title={
          <Text style={{ color: "#fff", fontWeight: 700 }}>Gợi ý theo dõi</Text>
        }
      >
        {suggestionsLoading && (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 16 }}
          >
            <Spin />
          </div>
        )}
        {!suggestionsLoading && (
          <List
            itemLayout="horizontal"
            dataSource={suggestions}
            renderItem={(user) => {
              // Normalize ID để đảm bảo match với userIdToFollowing
              const userIdStr = user?.id ? String(user.id) : null;
              const isFollowing = userIdStr
                ? !!userIdToFollowing[userIdStr] || !!userIdToFollowing[user.id]
                : false;
              const isLoading = userIdStr
                ? !!userIdToFollowLoading[userIdStr] ||
                  !!userIdToFollowLoading[user.id]
                : false;

              return (
                <List.Item style={{ padding: "8px 0" }}>
                  <Suggestion
                    user={user}
                    following={isFollowing}
                    loading={isLoading}
                    onFollow={(uid) => toggleFollow(uid)}
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      <Card style={{ background: "#0f0f10", borderColor: "#1f1f1f" }}>
        <Title
          level={4}
          style={{ color: "#fff", marginBottom: 12, textAlign: "center" }}
        >
          LeaderBoard
        </Title>
        <Divider style={{ margin: "8px 0", borderColor: "#1f1f1f" }} />
        {loadingLeaderboard ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 16 }}
          >
            <Spin />
          </div>
        ) : leaderboardLicks.length === 0 ? (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              color: "#9ca3af",
              fontSize: 13,
            }}
          >
            Chưa có lick nào trong bảng xếp hạng
          </div>
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {leaderboardLicks.map((lick, index) => (
              <LeaderboardItem
                key={lick.lick_id || lick._id || index}
                rank={index + 1}
                title={lick.title || "Untitled lick"}
                creatorName={
                  lick.creator?.display_name ||
                  lick.creator?.displayName ||
                  lick.creator?.username
                }
                likesCount={Number(lick.likes_count ?? 0)}
                isPlaying={leaderboardPlayingId === (lick.lick_id || lick._id)}
                onClick={() => handlePlayLeaderboardLick(lick)}
              />
            ))}
          </Space>
        )}
      </Card>
    </>
  );

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
        return {
          ...prev,
          [postId]: { ...cur, commentsCount: (cur.commentsCount || 0) + 1 },
        };
      });

      // Nếu là reply (có parentCommentId), thêm vào danh sách replies
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
      } else {
        // Nếu là top-level comment, cập nhật danh sách comment và chỉ giữ lại 3 comment gần nhất
        setPostIdToComments((prev) => {
          const cur = Array.isArray(prev[postId]) ? prev[postId] : [];
          // Kiểm tra duplicate trước khi thêm
          const exists = cur.some((c) => c._id === comment._id);
          if (exists) return prev;
          // Thêm comment mới vào đầu danh sách và giới hạn 3 comment gần nhất
          return { ...prev, [postId]: limitToNewest3([comment, ...cur]) };
        });
      }
    };
    onPostCommentNew(handler);
    return () => {
      offPostCommentNew(handler);
    };
  }, []);

  // Listen for post archived event (realtime removal from feed)
  useEffect(() => {
    const handler = (payload) => {
      console.log("[NewsFeed] Received post:archived event:", payload);
      if (!payload?.postId) {
        console.warn("[NewsFeed] post:archived event missing postId");
        return;
      }
      const postId = payload.postId.toString();
      console.log("[NewsFeed] Removing post from feed:", postId);

      // Remove post from feed immediately
      setItems((prev) => {
        console.log("[NewsFeed] Current items before filter:", prev.length);
        const filtered = prev.filter((p) => {
          const pId = p._id?.toString() || p._id;
          const matches = pId !== postId;
          if (!matches) {
            console.log(
              "[NewsFeed] Found matching post to remove:",
              pId,
              "===",
              postId
            );
          }
          return matches;
        });
        console.log(
          "[NewsFeed] After filter, items count:",
          filtered.length,
          "removed:",
          prev.length - filtered.length
        );
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

    console.log("[NewsFeed] Setting up post:archived listener");
    onPostArchived(handler);
    return () => {
      console.log("[NewsFeed] Cleaning up post:archived listener");
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

  // Lắng nghe event từ NotificationBell để mở modal comment
  useEffect(() => {
    const handleOpenCommentModal = (event) => {
      const { postId } = event.detail || {};
      if (postId) {
        // Nếu post chưa có trong items, cần fetch trước
        const post = items.find((it) => it._id === postId);
        if (post) {
          openComment(postId, post);
        } else {
          // Nếu post chưa có, fetch post và mở modal
          getPostById(postId)
            .then((result) => {
              if (result.success && result.data) {
                // Thêm post vào items nếu chưa có
                setItems((prev) => {
                  const exists = prev.some((it) => it._id === postId);
                  if (exists) return prev;
                  return sortPostsByCreatedAtDesc([result.data, ...prev]);
                });
                openComment(postId, result.data);
              }
            })
            .catch((err) => {
              console.error("Lỗi khi lấy bài viết:", err);
              message.error("Không tìm thấy bài viết");
            });
        }
      }
    };

    window.addEventListener("openPostCommentModal", handleOpenCommentModal);
    return () => {
      window.removeEventListener(
        "openPostCommentModal",
        handleOpenCommentModal
      );
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
        openComment(postId, post);
      } else {
        // Nếu post chưa có, fetch post và mở modal
        getPostById(postId)
          .then((result) => {
            if (result.success && result.data) {
              // Thêm post vào items nếu chưa có
              setItems((prev) => {
                const exists = prev.some((it) => it._id === postId);
                if (exists) return prev;
                return sortPostsByCreatedAtDesc([result.data, ...prev]);
              });
              openComment(postId, result.data);
            }
          })
          .catch((err) => {
            console.error("Lỗi khi lấy bài viết:", err);
            message.error("Không tìm thấy bài viết");
          });
      }
    }
  }, [location.state, items]);

  const fetchProviderOEmbed = async (url) => {
    const tryFetch = async (endpoint) => {
      const res = await fetch(`${endpoint}${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error("oEmbed failed");
      return res.json();
    };
    // Ordered list of oEmbed providers to try
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
    // cache first
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

  // useEffect để cập nhật link preview khi chỉnh sửa bài post
  useEffect(() => {
    // Nếu đã chọn lick hoặc project thì không xử lý link preview nữa
    // Và tự động clear link preview nếu có
    if (editSelectedLickIds && editSelectedLickIds.length > 0) {
      setEditLinkPreview(null);
      setEditLinkLoading(false);
      return;
    }
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

    const url = extractFirstUrl(editText);
    if (!url) {
      setEditLinkPreview(null);
      return;
    }
    let aborted = false;
    setEditLinkLoading(true);
    resolvePreview(url)
      .then((data) => {
        if (!aborted) setEditLinkPreview({ url, ...data });
      })
      .finally(() => {
        if (!aborted) setEditLinkLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [editText, editSelectedLickIds, editSelectedProjectId, editingPost]);

  const fetchData = async (p = page, l = limit) => {
    setLoading(true);
    setError("");
    try {
      const res = await listPosts({ page: p, limit: l });
      // Luôn ưu tiên hiển thị theo thời gian tạo (mới nhất lên đầu)
      // bất kể chiến lược sắp xếp trên backend, để feed nhất quán cho người dùng.
      const posts = res?.data?.posts || [];
      const totalPosts = res?.data?.pagination?.totalPosts || 0;

      // Debug: Check for posts with linkPreview
      const postsWithLinkPreview = posts.filter((p) => p.linkPreview);
      if (postsWithLinkPreview.length > 0) {
        console.log("(NO $) [DEBUG][fetchData] Found posts with linkPreview:", {
          count: postsWithLinkPreview.length,
          posts: postsWithLinkPreview.map((p) => ({
            _id: p._id,
            linkPreviewUrl: p.linkPreview?.url,
            parsedLickId: p.linkPreview?.url
              ? parseSharedLickId(p.linkPreview.url)
              : null,
            parsedProjectId: p.linkPreview?.url
              ? parseProjectId(p.linkPreview.url)
              : null,
          })),
        });
      }

      if (p === 1) {
        setItems(sortPostsByCreatedAtDesc(posts));
      } else {
        // Append and re-sort theo thời gian để đảm bảo thứ tự mới nhất trước
        setItems((prev) => sortPostsByCreatedAtDesc([...prev, ...posts]));
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
          if (typeof userId === "string" || typeof userId === "number") {
            return userId.toString();
          }
          if (typeof userId === "object") {
            const id = userId._id || userId.id;
            if (id) return id.toString();
          }
          return null;
        };
        const uniqueUserIds = Array.from(
          new Set((posts || []).map(extractUserId).filter(Boolean))
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
      setError(e.message || "Lỗi tải bài viết");
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshWithNewPosts = async () => {
    setPendingNewPosts([]);
    setPage(1);
    await fetchData(1, limit);
    // Sau khi làm mới, cập nhật mốc bài mới nhất để tránh hiển thị nút ảo
    if (itemsRef.current && itemsRef.current.length > 0) {
      const top = itemsRef.current[0];
      setLastSeenTopId(top?._id || top?.id || null);
      setLastSeenTopCreatedAt(top?.createdAt || null);
    }
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    fetchData(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for new posts while user is browsing; surface a refresh CTA instead of auto-jumping the feed
  useEffect(() => {
    let cancelled = false;
    let isChecking = false;

    const checkForNewPosts = async () => {
      if (cancelled || isChecking) return;
      const currentItems = itemsRef.current || [];
      // Nếu chưa có dữ liệu hiện tại (vừa vào trang hoặc đang refresh) thì không so sánh
      if (!currentItems.length) return;
      isChecking = true;
      try {
        // Use a slightly larger limit to avoid missing a new post that was pushed down
        const pollLimit = Math.max(limit, 15);
        const res = await listPosts({ page: 1, limit: pollLimit });
        const latest = res?.data?.posts || [];
        // Dùng createdAt của bài mới nhất hiện có làm mốc để tránh báo “mới” khi chỉ khác phân trang
        const newestCurrent = currentItems[0]?.createdAt || null;
        const newestCurrentTs = newestCurrent
          ? new Date(newestCurrent).getTime()
          : null;
        const latestTopId =
          (latest[0]?._id && latest[0]._id.toString
            ? latest[0]._id.toString()
            : latest[0]?._id) || null;
        const latestTopCreatedAt = latest[0]?.createdAt || null;
        const lastSeenTopIdStr = lastSeenTopId
          ? lastSeenTopId.toString()
          : null;
        const lastSeenTs = lastSeenTopCreatedAt
          ? new Date(lastSeenTopCreatedAt).getTime()
          : newestCurrentTs; // fallback mốc hiện tại nếu chưa có lastSeen

        // Nếu top hiện tại trùng với top đã thấy gần nhất, bỏ qua
        if (latestTopId && lastSeenTopIdStr && latestTopId === lastSeenTopIdStr) {
          return;
        }
        const existingIds = new Set(
          currentItems
            .map((p) => {
              const id = p?._id && p._id.toString ? p._id.toString() : p?._id;
              return id || null;
            })
            .filter(Boolean)
        );
        const fresh = latest.filter((p) => {
          const id = p?._id && p._id.toString ? p._id.toString() : p?._id;
          if (!id || existingIds.has(id)) return false;
          const createdTs = p?.createdAt ? new Date(p.createdAt).getTime() : 0;
          // Chỉ coi là mới nếu mới hơn mốc đã thấy (hoặc chưa có mốc)
          if (lastSeenTs && createdTs <= lastSeenTs) return false;
          if (newestCurrentTs && createdTs <= newestCurrentTs) return false;
          return true;
        });
        if (!cancelled && fresh.length > 0) {
          // Replace queue with latest fresh posts to ensure button appears promptly
          setPendingNewPosts((prev) => {
            const prevIds = new Set(
              prev
                .map((p) => {
                  const id =
                    p?._id && p._id.toString ? p._id.toString() : p?._id;
                  return id || null;
                })
                .filter(Boolean)
            );
            const uniqueFresh = fresh.filter((p) => {
              const id =
                p?._id && p._id.toString ? p._id.toString() : p?._id;
              return id && !prevIds.has(id);
            });
            return uniqueFresh.length > 0 ? uniqueFresh : prev;
          });
        }
      } catch (e) {
        // ignore polling failures to avoid breaking the feed
      } finally {
        isChecking = false;
      }
    };

    const interval = setInterval(checkForNewPosts, 5000);
    checkForNewPosts();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [limit]);

  // Enrich loaded posts with preview thumbnails if missing
  useEffect(() => {
    const enrich = async () => {
      // fetch stats and initial comments for each post
      for (const p of items) {
        // fetch stats
        getPostStats(p._id)
          .then((res) => {
            setPostIdToStats((prev) => ({
              ...prev,
              [p._id]: res?.data || prev[p._id],
            }));
          })
          .catch(() => {});
        // fetch all top-level comments and limit to 3 newest
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
          fetchData(next, limit);
        }
      },
      { rootMargin: "200px" }
    );
    const el = loaderRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [loading, hasMore, page, limit]);

  // Keep local currentUser in sync with persisted auth user
  useEffect(() => {
    setCurrentUser(authUser || null);
  }, [authUser]);

  // Fetch current user profile
  useEffect(() => {
    const fetchMyProfile = async () => {
      try {
        setLoadingProfile(true);
        const res = await getMyProfile();
        console.log("[NewsFeed] getMyProfile response:", res);

        // Handle different response formats - same as Personal.js
        const userData = res?.data?.user || res?.user || null;

        if (userData) {
          console.log("[NewsFeed] Setting currentUser from API:", userData);
          setCurrentUser(userData);
        }
      } catch (error) {
        console.error("[NewsFeed] Error fetching profile:", error);
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
        const res = await getFollowingList("", 50);
        console.log("[NewsFeed] getFollowingList response:", res);
        if (res?.success && Array.isArray(res.data)) {
          console.log("[NewsFeed] Found following users:", res.data.length);
          setFollowingUsers(res.data);
        } else {
          console.log("[NewsFeed] No following users or invalid response");
          setFollowingUsers([]);
        }
      } catch (error) {
        console.error("[NewsFeed] Error fetching following users:", error);
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
      const res = await getMyLicks({ status: "active", limit: 100 });
      if (res?.success && Array.isArray(res.data)) {
        // Format data để Select component có thể sử dụng
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
        const ownedProjects = res.data.filter((project) => {
          const ownerId =
            project?.creatorId?._id ||
            project?.creatorId?.id ||
            project?.creatorId ||
            project?.creator?._id ||
            project?.creator?.id ||
            project?.creator;
          return (
            ownerId &&
            currentUserId &&
            ownerId.toString() === currentUserId.toString()
          );
        });
        const formattedProjects = ownedProjects.map((project) => ({
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
      modal.warning({
        title: "Chỉ được chọn 1 loại đính kèm",
        content:
          "Bạn đã chọn Lick và có Link trong nội dung. Chỉ được chọn 1 trong 3: Project, Lick, hoặc Link. Vui lòng xóa link trong nội dung hoặc bỏ chọn Lick trước khi đăng.",
      });
      return;
    }

    // Kiểm tra: nếu có URL trong text và đã chọn project, không cho đăng
    if (hasUrl && hasProject) {
      modal.warning({
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
      modal.warning({
        title: "Chỉ được chọn 1 loại đính kèm",
        content:
          "Bạn chỉ được chọn 1 trong 3: Project, Lick, hoặc Link. Vui lòng bỏ chọn các mục khác trước khi đăng.",
      });
      return;
    }

    // Kiểm tra: phải có ít nhất text hoặc 1 trong 3 loại đính kèm
    if (!trimmed && attachmentCount === 0) {
      modal.warning({
        title: "Thiếu nội dung",
        content:
          "Vui lòng nhập nội dung hoặc chọn ít nhất 1 trong 3: Project, Lick, hoặc Link.",
      });
      return;
    }

    if (trimmed && trimmed.length > MAX_POST_TEXT_LENGTH) {
      modal.warning({
        title: "Nội dung quá dài",
        content: `Nội dung không được vượt quá ${MAX_POST_TEXT_LENGTH} ký tự (hiện tại: ${trimmed.length}). Vui lòng rút gọn trước khi đăng.`,
      });
      return;
    }
    try {
      setPosting(true);
      // eslint-disable-next-line no-console
      console.log("[UI] Click Đăng, preparing payload...");
      // Không chặn khi thiếu userId ở UI; service sẽ tự chèn từ localStorage
      // và BE sẽ trả lỗi rõ ràng nếu thiếu
      // eslint-disable-next-line no-console
      console.log("[UI] Sending JSON createPost...");
      const payload = { postType: "status_update" };
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
      // Service trả về { success: true, data: post } từ axios response.data
      // axios đã unwrap response.data rồi, nên response chính là { success: true, data: post }
      let newPost = response?.data || response;
      // eslint-disable-next-line no-console
      console.log("[UI] Post created response:", {
        response,
        newPost,
        hasId: !!newPost?._id,
      });

      // Debug linkPreview if present
      if (newPost?.linkPreview) {
        console.log("(NO $) [DEBUG][createPost] New post has linkPreview:", {
          url: newPost.linkPreview?.url,
          title: newPost.linkPreview?.title,
          lickId: parseSharedLickId(newPost.linkPreview?.url),
          projectId: parseProjectId(newPost.linkPreview?.url),
        });
      }

      // Thêm post mới vào đầu danh sách ngay lập tức
      if (newPost && newPost._id) {
        // eslint-disable-next-line no-console
        console.log("[UI] Adding new post to feed:", newPost._id);
        console.log("(NO $) [DEBUG][createPost] Full newPost object:", {
          _id: newPost._id,
          hasLinkPreview: !!newPost.linkPreview,
          linkPreview: newPost.linkPreview,
          linkPreviewUrl: newPost.linkPreview?.url,
          parsedLickId: newPost.linkPreview?.url
            ? parseSharedLickId(newPost.linkPreview.url)
            : null,
          parsedProjectId: newPost.linkPreview?.url
            ? parseProjectId(newPost.linkPreview.url)
            : null,
        });
        setItems((prev) => {
          // Kiểm tra xem post đã tồn tại chưa (tránh duplicate)
          const exists = prev.some((p) => p._id === newPost._id);
          if (exists) {
            // eslint-disable-next-line no-console
            console.log("[UI] Post already exists, skipping");
            return prev;
          }
          // Thêm post mới và sắp xếp theo thời gian (mới nhất lên đầu)
          // eslint-disable-next-line no-console
          console.log("[UI] Adding post to beginning of list");
          return sortPostsByCreatedAtDesc([newPost, ...prev]);
        });

        // Hydrate following status cho author của post mới
        const extractAuthorId = (post) => {
          const userId = post?.userId;
          if (!userId) return null;
          if (typeof userId === "string" || typeof userId === "number") {
            return userId.toString();
          }
          if (typeof userId === "object") {
            const id = userId._id || userId.id;
            if (id) return id.toString();
          }
          return null;
        };
        const authorId = extractAuthorId(newPost);
        if (
          authorId &&
          currentUserId &&
          authorId === currentUserId.toString()
        ) {
          // Post của chính mình, không cần check following
        } else if (authorId) {
          try {
            const profileRes = await getProfileById(authorId);
            setUserIdToFollowing((prev) => ({
              ...prev,
              [authorId]: !!profileRes?.data?.isFollowing,
            }));
          } catch {
            // Ignore error
          }
        }

        // Initialize stats cho post mới
        setPostIdToStats((prev) => ({
          ...prev,
          [newPost._id]: { likesCount: 0, commentsCount: 0 },
        }));
        setPostIdToLiked((prev) => ({ ...prev, [newPost._id]: false }));
        setPostIdToComments((prev) => ({ ...prev, [newPost._id]: [] }));

        // Join socket room cho post mới
        try {
          joinRoom(`post:${newPost._id}`);
        } catch {
          // Ignore socket errors
        }
      }

      setNewText("");
      setSelectedLickIds([]);
      setSelectedProjectId(null);
      setIsModalOpen(false);
      message.success("Đăng bài thành công");
      modal.success({
        title: "Đăng bài thành công",
        content: "Bài viết của bạn đã được đăng lên bảng tin.",
      });
      // KHÔNG fetch lại data - post mới đã được thêm vào đầu danh sách
      // Chỉ khi refresh trang thì mới sort theo engagement
    } catch (e) {
      message.error(e.message || "Đăng bài thất bại");
    } finally {
      setPosting(false);
    }
  };

  return (
    <>
      {modalContextHolder}
      <div
        className="newsfeed-page"
        style={{
          maxWidth: 1680,
          margin: "0 auto",
          padding: "var(--newsfeed-page-padding, 24px 24px)",
          background: "#0a0a0a",
          minHeight: "100vh",
          height: "var(--newsfeed-page-height, 100vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          className="newsfeed-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "var(--newsfeed-grid-columns, minmax(0, 1.2fr) 460px)",
            gap: "var(--newsfeed-grid-gap, 32px)",
            flex: 1,
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          <div
            className="newsfeed-main-column hide-scrollbar"
            style={{
              overflowY: "auto",
              overflowX: "hidden",
              height: "100%",
              paddingRight: "var(--newsfeed-main-pr, 8px)",
              scrollbarWidth: "none", // Firefox
              msOverflowStyle: "none", // IE and Edge
            }}
            ref={mainScrollRef}
            onScroll={handleMainScroll}
          >
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
              {(() => {
                const user = currentUser || authUser || null;

                const avatarUrl =
                  user?.avatarUrl ||
                  user?.avatar_url ||
                  user?.avatar ||
                  user?.user?.avatarUrl ||
                  user?.user?.avatar_url ||
                  user?.user?.avatar;

                const displayName =
                  user?.displayName ||
                  user?.username ||
                  user?.user?.displayName ||
                  user?.user?.username ||
                  "";
                const initial = displayName
                  ? displayName[0].toUpperCase()
                  : "U";

                // Only use src if avatarUrl is a valid non-empty string
                const validAvatarUrl =
                  avatarUrl &&
                  typeof avatarUrl === "string" &&
                  avatarUrl.trim() !== "" &&
                  avatarUrl !== ""
                    ? avatarUrl.trim()
                    : null;

                console.log("[NewsFeed] Avatar render:", {
                  hasUser: !!user,
                  avatarUrl,
                  validAvatarUrl,
                  displayName,
                  initial,
                });

                return (
                  <Avatar size={40} src={validAvatarUrl || undefined}>
                    {initial}
                  </Avatar>
                );
              })()}
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
                Đăng Bài
              </Button>
            </div>

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
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
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
                      src={
                        composerAvatarUrl &&
                        typeof composerAvatarUrl === "string" &&
                        composerAvatarUrl.trim() !== ""
                          ? composerAvatarUrl
                          : undefined
                      }
                      style={{ background: "#7c3aed" }}
                    >
                      {composerInitial}
                    </Avatar>
                    <div>
                      <Text style={{ color: "#fff", fontWeight: 600 }}>
                        {composerDisplayName}
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
                        background: charPercent > 80 ? "#f97316" : "#7c3aed",
                        borderRadius: 999,
                        transition: "width 0.2s ease",
                      }}
                    />
                  </div>
                </div>

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
                      <div style={composerLabelStyle}>Đính kèm lick</div>
                      <div style={composerHintStyle}>
                        Chỉ hiển thị các lick đang active trong tài khoản. Chỉ
                        chọn 1 trong 3: Project, Lick, hoặc Link.
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
                      Tùy chọn
                    </Tag>
                  </div>
                  <Select
                    mode="multiple"
                    placeholder="Tìm và chọn 1 lick để đính kèm..."
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
                    disabled={!!extractFirstUrl(newText) || !!selectedProjectId}
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
                      <div style={{ ...composerHintStyle, lineHeight: "1.5" }}>
                        Chỉ hiển thị các project có trạng thái active. Chỉ chọn
                        1 trong 3: Project, Lick, hoặc Link.
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
                      selectedLickIds.length > 0 || !!extractFirstUrl(newText)
                    }
                  />
                </div>

                {extractFirstUrl(newText) && selectedLickIds.length === 0 && (
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
                              borderRadius: 10,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 10,
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
                            {linkPreview?.title || extractFirstUrl(newText)}
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
                        <Button
                          size="small"
                          onClick={() => setLinkPreview(null)}
                        >
                          Ẩn
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Modal>
            {isMobileSidebar && (
              <Button
                block
                className="newsfeed-sidebar-toggle"
                icon={<MenuOutlined />}
                onClick={() => setSidebarOpen(true)}
              >
                Khám phá danh mục bên phải
              </Button>
            )}

            {isInitialLoading && (
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
            {!isInitialLoading && !error && items.length === 0 && (
              <Empty
                description={
                  <span style={{ color: "#9ca3af" }}>Chưa có bài đăng</span>
                }
              />
            )}
            {pendingNewPosts.length > 0 && !isNearTop && (
              <div
                style={{
                  position: "sticky",
                  top: 12,
                  zIndex: 30,
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <Button
                  type="primary"
                  shape="round"
                  icon={<ReloadOutlined />}
                  onClick={handleRefreshWithNewPosts}
                  loading={loading}
                >
                  {pendingNewPosts.length} bài viết mới - Làm mới
                </Button>
              </div>
            )}
            {items.map((post) => (
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
                    <div
                      role="button"
                      onClick={() => {
                        const uid = getAuthorId(post);
                        if (uid) navigate(`/users/${uid}/newfeeds`);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <Avatar
                        size={40}
                        src={
                          post?.userId?.avatarUrl &&
                          typeof post?.userId?.avatarUrl === "string" &&
                          post?.userId?.avatarUrl.trim() !== ""
                            ? post.userId.avatarUrl
                            : undefined
                        }
                        style={{ background: "#2db7f5" }}
                      >
                        {post?.userId?.displayName?.[0] ||
                          post?.userId?.username?.[0] ||
                          "U"}
                      </Avatar>
                    </div>
                    <div>
                      <Space style={{ marginBottom: 4 }}>
                        <span
                          onClick={() => {
                            const uid = getAuthorId(post);
                            if (uid) navigate(`/users/${uid}/newfeeds`);
                          }}
                          style={{
                            color: "#fff",
                            fontSize: 16,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {post?.userId?.displayName ||
                            post?.userId?.username ||
                            "Người dùng"}
                        </span>
                        <Text
                          type="secondary"
                          style={{ color: "#9ca3af", fontSize: 13 }}
                        >
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
                      if (
                        uid &&
                        currentUserId &&
                        uid.toString() === currentUserId.toString()
                      )
                        return null;
                      return (
                        <Button
                          size="middle"
                          loading={loading}
                          onClick={() => toggleFollow(uid)}
                          style={{
                            background: isFollowing ? "#111" : "#333",
                            borderColor: isFollowing ? "#444" : "#333",
                            color: "#fff",
                          }}
                        >
                          {isFollowing ? "Đang theo dõi" : "Follow"}
                        </Button>
                      );
                    })()}
                    {currentUserId &&
                      (() => {
                        const uid = getAuthorId(post);
                        const isOwnPost =
                          uid &&
                          currentUserId &&
                          uid.toString() === currentUserId.toString();

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
                                    onClick: () => openEditModal(post),
                                  },
                                  {
                                    key: "hide",
                                    label: "Ẩn bài post",
                                    icon: <DeleteOutlined />,
                                    danger: true,
                                    loading: deletingPostId === post._id,
                                    onClick: () => handleHidePost(post._id),
                                  },
                                ],
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
                                  onClick: () => openReportModal(post._id),
                                },
                              ],
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
                  </Space>
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
                    if (lineUrl && trimmed === lineUrl.trim()) return false;
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
                {(() => {
                  const url = extractFirstUrl(post?.textContent);
                  const sharedLickId = parseSharedLickId(url);
                  return sharedLickId ? (
                    <div style={{ marginBottom: 12 }}>
                      <PostLickEmbed lickId={sharedLickId} url={url} />
                    </div>
                  ) : null;
                })()}

                {/* Preview project đính kèm: ưu tiên dữ liệu populate; fallback fetch bằng PostProjectEmbed */}
                {(() => {
                  const projectId =
                    post?.projectId?._id ||
                    post?.projectId?.id ||
                    (typeof post?.projectId === "string"
                      ? post.projectId
                      : null);
                  const hasInlineProject =
                    post?.projectId &&
                    typeof post.projectId === "object" &&
                    post.projectId.audioUrl;

                  if (hasInlineProject) {
                    return (
                      <div style={{ marginBottom: 12 }}>
                        <ProjectPlayer
                          audioUrl={post.projectId.audioUrl}
                          waveformData={post.projectId.waveformData}
                          audioDuration={post.projectId.audioDuration}
                          projectName={post.projectId.title}
                        />
                      </div>
                    );
                  }

                  if (projectId) {
                    return (
                      <div style={{ marginBottom: 12 }}>
                        <PostProjectEmbed projectId={projectId} />
                      </div>
                    );
                  }
                  return null;
                })()}
                {/* Hiển thị attached licks với waveform */}
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
                {post?.linkPreview &&
                  (() => {
                    const previewUrl = post.linkPreview?.url;
                    if (!previewUrl) {
                      console.log(
                        "(NO $) [DEBUG][linkPreview] No URL in linkPreview:",
                        {
                          postId: post._id,
                          linkPreview: post.linkPreview,
                        }
                      );
                      return null;
                    }

                    // Try to parse lick or project ID from URL
                    // Test parse function directly first
                    const testParse = parseSharedLickId(previewUrl);
                    console.log(
                      "(NO $) [DEBUG][linkPreview] Direct parse test:",
                      {
                        previewUrl,
                        testParse,
                        type: typeof testParse,
                        isTruthy: !!testParse,
                      }
                    );

                    const lickId = parseSharedLickId(previewUrl);
                    const projectId = parseProjectId(previewUrl);

                    // Always log for debugging
                    console.log("(NO $) [DEBUG][linkPreview] Processing:", {
                      postId: post._id,
                      url: previewUrl,
                      lickId,
                      projectId,
                      hasLinkPreview: !!post.linkPreview,
                      linkPreviewObject: post.linkPreview,
                      willRenderLickEmbed: !!lickId,
                      willRenderProjectEmbed: !!projectId,
                    });

                    // Debug log for troubleshooting
                    if (lickId || projectId) {
                      console.log(
                        "(NO $) [DEBUG][linkPreview] Detected embed:",
                        {
                          postId: post._id,
                          url: previewUrl,
                          lickId,
                          projectId,
                          linkPreview: post.linkPreview,
                        }
                      );
                    } else {
                      console.log(
                        "(NO $) [DEBUG][linkPreview] No embed detected, will use default card",
                        {
                          postId: post._id,
                          url: previewUrl,
                          parseResult: {
                            lickId,
                            projectId,
                          },
                        }
                      );
                    }

                    // If it's a lick URL, show PostLickEmbed
                    if (lickId) {
                      console.log(
                        "(NO $) [DEBUG][linkPreview] Rendering PostLickEmbed with lickId:",
                        lickId
                      );
                      return (
                        <div style={{ marginBottom: 12 }}>
                          <PostLickEmbed lickId={lickId} url={previewUrl} />
                        </div>
                      );
                    }

                    // If it's a project URL, show PostProjectEmbed
                    if (projectId) {
                      console.log(
                        "(NO $) [DEBUG][linkPreview] Rendering PostProjectEmbed with projectId:",
                        projectId
                      );
                      return (
                        <div style={{ marginBottom: 12 }}>
                          <PostProjectEmbed
                            projectId={projectId}
                            url={previewUrl}
                          />
                        </div>
                      );
                    }

                    // Otherwise, show default link preview card
                    console.log(
                      "(NO $) [DEBUG][linkPreview] Using default card:",
                      {
                        postId: post._id,
                        url: previewUrl,
                        linkPreview: post.linkPreview,
                      }
                    );
                    return (
                      <a
                        href={previewUrl || "#"}
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
                            {post.linkPreview?.thumbnailUrl ||
                            previewCache[previewUrl]?.thumbnailUrl ? (
                              <img
                                src={
                                  post.linkPreview?.thumbnailUrl ||
                                  previewCache[previewUrl]?.thumbnailUrl
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
                                {post.linkPreview?.title ||
                                  previewCache[previewUrl]?.title ||
                                  previewUrl}
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
                    );
                  })()}
                <Space
                  className="post-actions"
                  style={{
                    marginTop: 14,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <Button
                      icon={<LikeOutlined />}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: postIdToLiked[post._id] ? "#1890ff" : "#fff",
                      }}
                      loading={likingPostId === post._id}
                      onClick={() => handleLike(post._id)}
                    >
                      Thích
                    </Button>
                    {Number(postIdToStats[post._id]?.likesCount ?? 0) > 0 && (
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
                    {Number(postIdToStats[post._id]?.commentsCount ?? 0) > 0
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
                      {limitToNewest3(postIdToComments[post._id]).map((c) => {
                        const canDelete = canDeleteComment(c, post);
                        return (
                          <div
                            key={c._id}
                            style={{ display: "flex", gap: 8, marginBottom: 8 }}
                          >
                            <Avatar size={28} style={{ background: "#555" }}>
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
                                      loading={deletingCommentId === c._id}
                                      style={{ color: "#9ca3af", padding: 0 }}
                                    />
                                  </Dropdown>
                                )}
                              </div>
                              <div>{c.comment}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </Card>
            ))}

            <div ref={loaderRef} style={{ height: 1 }} />
            {isLoadingMore && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: 16,
                }}
              >
                <Spin />
              </div>
            )}
          </div>

          {!isMobileSidebar && (
            <div
              className="newsfeed-sidebar-column hide-scrollbar"
              style={{
                overflowY: "auto",
                overflowX: "hidden",
                height: "100%",
                paddingLeft: "var(--newsfeed-sidebar-pl, 8px)",
                scrollbarWidth: "none", // Firefox
                msOverflowStyle: "none", // IE and Edge
              }}
            >
              {sidebarContent}
            </div>
          )}
        </div>
      </div>
      <Drawer
        placement="right"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        width={360}
        className="newsfeed-sidebar-drawer"
        destroyOnClose
        styles={{ body: { padding: 0, background: "#0a0a0a" } }}
      >
        <div className="newsfeed-sidebar-drawer-content hide-scrollbar">
          {sidebarContent}
        </div>
      </Drawer>

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
                            onClick={() => toggleFollow(user.id)}
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
                              : "Theo dõi"}
                          </Button>,
                        ]
                  }
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        size={40}
                        src={
                          user.avatarUrl &&
                          typeof user.avatarUrl === "string" &&
                          user.avatarUrl.trim() !== ""
                            ? user.avatarUrl
                            : undefined
                        }
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
                src={
                  modalPost?.userId?.avatarUrl &&
                  typeof modalPost?.userId?.avatarUrl === "string" &&
                  modalPost?.userId?.avatarUrl.trim() !== ""
                    ? modalPost.userId.avatarUrl
                    : undefined
                }
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
              <div
                style={{
                  marginBottom: 8,
                  color: "#e5e7eb",
                  fontSize: 15,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
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
            {/* Hiển thị attached licks giống như ngoài feed */}
            {modalPost?.attachedLicks &&
              Array.isArray(modalPost.attachedLicks) &&
              modalPost.attachedLicks.length > 0 && (
                <div
                  style={{
                    marginBottom: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {modalPost.attachedLicks.map((lick) => {
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

            {/* stats quick view */}
            <div style={{ marginTop: 8, color: "#9ca3af" }}>
              {Number(postIdToStats[commentPostId]?.likesCount ?? 0)} lượt thích
              · {Number(postIdToStats[commentPostId]?.commentsCount ?? 0)} bình
              luận
            </div>

            {/* comments list */}
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
                          src={
                            c?.userId?.avatarUrl &&
                            typeof c?.userId?.avatarUrl === "string" &&
                            c?.userId?.avatarUrl.trim() !== ""
                              ? c.userId.avatarUrl
                              : undefined
                          }
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
                                  src={
                                    reply?.userId?.avatarUrl &&
                                    typeof reply?.userId?.avatarUrl ===
                                      "string" &&
                                    reply?.userId?.avatarUrl.trim() !== ""
                                      ? reply.userId.avatarUrl
                                      : undefined
                                  }
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

            {/* input */}
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
            setEditSelectedLickIds([]);
            setEditSelectedProjectId(null);
            setEditLinkPreview(null);
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
                  setEditSelectedLickIds([]);
                  setEditSelectedProjectId(null);
                  setEditLinkPreview(null);
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
          />

          {/* Chỉ hiển thị phần chỉnh sửa tương ứng với loại nội dung của bài post */}
          {(() => {
            // Kiểm tra xem bài post có lick không (attachedLicks hoặc shared lick URL trong textContent ban đầu)
            const originalUrl = extractFirstUrl(editingPost?.textContent || "");
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
            // Kiểm tra chặt chẽ: phải có giá trị và không phải null/undefined
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
                  // Đảm bảo projectId không phải là string rỗng hoặc giá trị falsy
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

            // Debug log để kiểm tra
            console.log("[Edit Modal] Content check:", {
              hasAttachedLicks,
              hasSharedLickUrl,
              hasLick,
              projectIdValue,
              projectIdType: typeof projectIdValue,
              projectIdKeys:
                projectIdValue && typeof projectIdValue === "object"
                  ? Object.keys(projectIdValue)
                  : null,
              hasValidProject,
              hasProject: hasValidProject && !hasLick,
              editingPost: {
                attachedLicks: editingPost?.attachedLicks,
                projectId: editingPost?.projectId,
                textContent: editingPost?.textContent?.substring(0, 50),
              },
            });

            // Chỉ hiển thị project nếu có project hợp lệ VÀ không có lick (vì chỉ chọn 1 trong 3)
            // Đảm bảo hasValidProject phải là true và hasLick phải là false
            const hasProject = hasValidProject === true && hasLick === false;

            // Kiểm tra xem bài post có link preview không (và không phải là shared lick URL, và không có lick/project)
            const hasLinkPreview =
              !!editingPost?.linkPreview &&
              !originalSharedLickId &&
              !hasLick &&
              !hasValidProject;

            // Chỉ hiển thị phần Select tương ứng với loại nội dung mà bài post có
            return (
              <>
                {/* Chỉ hiển thị nếu bài post có lick */}
                {hasLick && (
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
                          Đính kèm lick (chỉnh sửa)
                        </div>
                        <div style={composerHintStyle}>
                          Bạn có thể thay đổi hoặc bỏ lick đang đính kèm.
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
                        Tùy chọn
                      </Tag>
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
                        if (next.length > 0) {
                          setEditLinkPreview(null);
                          setEditSelectedProjectId(null);
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
                        !!extractFirstUrl(editText) || !!editSelectedProjectId
                      }
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
                          style={{ ...composerHintStyle, lineHeight: "1.5" }}
                        >
                          Bạn có thể thay đổi hoặc bỏ project đang đính kèm.
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
                      value={editSelectedProjectId}
                      onChange={(value) => {
                        setEditSelectedProjectId(value);
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
                      popupClassName="dark-select-dropdown"
                      allowClear
                      disabled={
                        editSelectedLickIds.length > 0 ||
                        !!extractFirstUrl(editText)
                      }
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
                          Link preview sẽ tự động cập nhật khi bạn thay đổi URL
                          trong nội dung.
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

          {/* Preview phần nội dung giống ngoài feed (lick/media/link) */}
          <>
            {/* Preview shared lick từ URL trong text */}
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

            {/* Preview attached licks đã chọn */}
            {editSelectedLickIds && editSelectedLickIds.length > 0 && (
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

            {/* Preview project đã chọn */}
            {editSelectedProjectId &&
              (() => {
                const selectedProject = availableProjects.find(
                  (p) => p.value === editSelectedProjectId
                );
                if (!selectedProject) return null;
                return (
                  <div style={{ marginTop: 12 }}>
                    {selectedProject.audioUrl ? (
                      <ProjectPlayer
                        audioUrl={selectedProject.audioUrl}
                        waveformData={selectedProject.waveformData}
                        audioDuration={selectedProject.audioDuration}
                        projectName={selectedProject.title}
                      />
                    ) : (
                      <div
                        style={{
                          height: 120,
                          background: "#111",
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#9ca3af",
                        }}
                      >
                        Project preview
                      </div>
                    )}
                  </div>
                );
              })()}

            {/* Preview link */}
            {editLinkPreview &&
              !editSelectedLickIds?.length &&
              !editSelectedProjectId && (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      border: "1px solid #2a2a2a",
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "#1a1a1a",
                    }}
                  >
                    {editLinkPreview.thumbnailUrl && (
                      <div
                        style={{
                          width: "100%",
                          height: 200,
                          backgroundImage: `url(${editLinkPreview.thumbnailUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                    )}
                    <div style={{ padding: 16 }}>
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
                        {editLinkPreview.title || editLinkPreview.url}
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
                        {editLinkPreview.url}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* Media hiện tại của bài viết (chỉ hiển thị, không chỉnh sửa được) */}
            {editingPost?.media?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    height: 120,
                    background: "#111",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#9ca3af",
                  }}
                >
                  Media hiện tại của bài viết
                </div>
              </div>
            )}
          </>
        </div>
      </Modal>
    </>
  );
};

export default NewsFeed;
