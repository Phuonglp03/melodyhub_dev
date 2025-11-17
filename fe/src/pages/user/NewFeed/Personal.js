import React, { useEffect, useState } from "react";
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
  List,
  Divider,
  Dropdown,
} from "antd";
import {
  LikeOutlined,
  MessageOutlined,
  PlusOutlined,
  UserOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined
} from "@ant-design/icons";
import { listMyPosts, createPost, updatePost, deletePost } from "../../../services/user/post";
import {
  likePost,
  unlikePost,
  createPostComment,
  getPostStats,
  getAllPostComments,
} from "../../../services/user/post";
import { getMyProfile, uploadMyCoverPhoto } from "../../../services/user/profile";
import { useNavigate } from "react-router-dom";
import PostLickEmbed from "../../../components/PostLickEmbed";

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

const Suggestion = ({ user }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      padding: "6px 0",
      width: "100%",
    }}
  >
    <Space size={12}>
      <Avatar size={36} style={{ background: user.color }}>
        {user.name[0]}
      </Avatar>
      <div>
        <Text strong style={{ color: "#fff" }}>
          {user.name}
        </Text>
        <div style={{ fontSize: 12, color: "#f3f5f7ff" }}>
          {user.followers} người theo dõi
        </div>
      </div>
    </Space>
    <Button
      shape="circle"
      size="large"
      type="primary"
      icon={<PlusOutlined />}
      style={{ marginLeft: "auto" }}
    />
  </div>
);

const LeaderboardItem = ({ name, icon, iconColor = "#111" }) => (
  <Space>
    <div
      style={{
        width: 36,
        height: 36,
        background: iconColor,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: "bold",
        color: "#fff",
      }}
    >
      {icon}
    </div>
    <div>
      <Text strong style={{ color: "#fff" }}>
        {name}
      </Text>
      <div style={{ fontSize: 12, color: "#9ca3af" }}>Tên người tạo</div>
    </div>
  </Space>
);

const formatTime = (isoString) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return "";
  }
};

const getLinkInfo = (url) => {
  if (!url) return { iconClass: "bi bi-globe", label: "Website", color: "#3b82f6" };
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (hostname.includes("facebook.com")) {
      return { iconClass: "bi bi-facebook", label: "Facebook", color: "#1877f2" };
    } else if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
      return { iconClass: "bi bi-twitter-x", label: "Twitter", color: "#1da1f2" };
    } else if (hostname.includes("instagram.com")) {
      return { iconClass: "bi bi-instagram", label: "Instagram", color: "#e4405f" };
    } else if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      return { iconClass: "bi bi-youtube", label: "YouTube", color: "#ff0000" };
    } else if (hostname.includes("linkedin.com")) {
      return { iconClass: "bi bi-linkedin", label: "LinkedIn", color: "#0077b5" };
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

const PersonalFeed = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = React.useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newText, setNewText] = useState("");
  const [files, setFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  const [maxChars] = useState(300);
  const [linkPreview, setLinkPreview] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [previewCache, setPreviewCache] = useState({});
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentPostId, setCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [likingPostId, setLikingPostId] = useState(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [postIdToStats, setPostIdToStats] = useState({});
  const [postIdToComments, setPostIdToComments] = useState({});
  const [postIdToLiked, setPostIdToLiked] = useState({});
  const [postIdToCommentInput, setPostIdToCommentInput] = useState({});
  const [modalPost, setModalPost] = useState(null);
  const [uploadingCoverPhoto, setUploadingCoverPhoto] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editText, setEditText] = useState("");
  const [editFiles, setEditFiles] = useState([]);
  const [editing, setEditing] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState(null);

  const fetchProfile = async () => {
    try {
      const res = await getMyProfile();
      setProfile(res?.data?.user || null);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Load profile failed:", e);
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

  const openComment = (postId) => {
    setCommentPostId(postId);
    setCommentText("");
    const p = items.find((it) => it._id === postId) || null;
    setModalPost(p);
    setCommentOpen(true);
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
      setCommentOpen(false);
      setCommentText("");
      const all = await getAllPostComments(commentPostId);
      setPostIdToComments((prev) => ({ ...prev, [commentPostId]: all }));
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
      setPostIdToComments((prev) => ({ ...prev, [postId]: all }));
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

  const fetchData = async (p = page) => {
    setLoading(true);
    setError("");
    try {
      const res = await listMyPosts({ page: p, limit });
      const posts = res?.data?.posts || [];
      const total = res?.data?.pagination?.totalPosts || 0;
      if (p === 1) setItems(posts);
      else setItems((prev) => [...prev, ...posts]);
      const totalPages = Math.ceil(total / limit) || 1;
      setHasMore(p < totalPages);
    } catch (e) {
      setError(e.message || "Lỗi tải bài viết");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Làm giàu preview cho các bài đã tải nếu chỉ có URL trong text
  useEffect(() => {
    const enrich = async () => {
      const urls = items
        .map(
          (p) => p?.linkPreview?.url || extractFirstUrl(p?.textContent || "")
        )
        .filter((u) => u && !previewCache[u]);
      for (const url of urls) {
        // eslint-disable-next-line no-await-in-loop
        await resolvePreview(url);
      }
    };
    if (items && items.length) enrich();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // -------------- Link preview helpers (same như trang NewFeed chính) --------------
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
      const base =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : "https://melodyhub.app";
      const normalised = urlString.startsWith("http")
        ? new URL(urlString)
        : new URL(urlString, base);
      const segments = normalised.pathname.split("/").filter(Boolean);
      if (segments.length >= 2 && segments[0] === "licks") {
        return segments[1];
      }
      return null;
    } catch {
      return null;
    }
  };

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
      } catch (_) {}
    }
    return null;
  };

  const fetchOgTags = async (url) => {
    try {
      const proxied = `https://r.jina.ai/http/${url.replace(
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
  }, [newText]);

  const handleCreatePost = async () => {
    if (!newText.trim()) {
      message.warning("Vui lòng nhập nội dung");
      return;
    }
    try {
      setPosting(true);
      if (files.length > 0) {
        const form = new FormData();
        form.append("postType", "status_update");
        form.append("textContent", newText.trim());
        if (linkPreview)
          form.append("linkPreview", JSON.stringify(linkPreview));
        files.forEach((f) => {
          if (f.originFileObj) form.append("media", f.originFileObj);
        });
        await createPost(form);
      } else {
        await createPost({
          postType: "status_update",
          textContent: newText.trim(),
          linkPreview,
        });
      }
      setNewText("");
      setFiles([]);
      setIsModalOpen(false);
      message.success("Đăng bài thành công");
      fetchData(1);
      setPage(1);
    } catch (e) {
      message.error(e.message || "Đăng bài thất bại");
    } finally {
      setPosting(false);
    }
  };

  const handleHidePost = (postId) => {
    Modal.confirm({
      title: "Xác nhận lưu trữ bài viết",
      content: "Bạn có chắc chắn muốn lưu trữ bài viết này? Bài viết sẽ được chuyển vào kho lưu trữ và sẽ bị xóa vĩnh viễn sau 30 ngày nếu không khôi phục.",
      okText: "Lưu trữ",
      cancelText: "Hủy",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          setDeletingPostId(postId);
          await deletePost(postId);
          message.success("Đã lưu trữ bài viết. Bài viết sẽ bị xóa vĩnh viễn sau 30 ngày nếu không khôi phục.");
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
    setEditFiles([]);
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
    try {
      setEditing(true);
      const payload = {
        postType: "status_update",
        textContent: editText.trim(),
      };
      await updatePost(editingPost._id, payload);
      message.success("Cập nhật bài viết thành công");
      setEditModalOpen(false);
      setEditingPost(null);
      setEditText("");
      setEditFiles([]);
      fetchData(1);
      setPage(1);
    } catch (e) {
      message.error(e.message || "Cập nhật bài viết thất bại");
    } finally {
      setEditing(false);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          const next = page + 1;
          setPage(next);
          fetchData(next);
        }
      },
      { rootMargin: "200px" }
    );
    const el = loaderRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [loading, hasMore, page]);

  return (
    <div
      style={{
        maxWidth: 1680,
        margin: "0 auto",
        padding: "24px 24px",
        background: "#0a0a0a",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          position: "relative",
          height: 300,
          background: profile?.coverPhotoUrl ? `url(${profile.coverPhotoUrl})` : "#131313",
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: 8,
          marginBottom: 16,
          overflow: "hidden",
        }}
      >
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
            
            if (file?.status === 'done' || file?.status === 'uploading') {
              return;
            }
            
            try {
              setUploadingCoverPhoto(true);
              const res = await uploadMyCoverPhoto(fileToUpload);
              const url = res?.data?.coverPhotoUrl || res?.data?.user?.coverPhotoUrl;
              if (url) {
                setProfile((prev) => prev ? { ...prev, coverPhotoUrl: url } : prev);
                message.success('Cập nhật ảnh bìa thành công');
                if (file) file.status = 'done';
              } else {
                if (file) file.status = 'error';
              }
            } catch (e) {
              message.error(e.message || 'Tải ảnh bìa thất bại');
              if (file) file.status = 'error';
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
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px minmax(0, 1.2fr) 360px",
          gap: 24,
        }}
      >
        <div>
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
                backgroundImage: profile?.coverPhotoUrl
                  ? `url(${profile.coverPhotoUrl})`
                  : undefined,
                backgroundColor: "#131313",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
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
                  {profile?.displayName || profile?.username || "trần quý"}
                </div>
                <div style={{ color: "#9ca3af", marginTop: 4 }}>
                  @{profile?.username || "2003tranquy123"}
                </div>
              </div>
              <Button
                onClick={() => navigate("/profile")}
                style={{
                  marginTop: 16,
                  background: "#fff",
                  color: "#111",
                  borderColor: "#fff",
                  padding: "0 20px",
                  height: 40,
                  borderRadius: 999,
                }}
              >
                View Profile
              </Button>
            </div>
          </Card>
          <Card style={{ background: "#0f0f10", borderColor: "#1f1f1f", marginBottom: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>
                  {profile?.followersCount ?? 0}
                </div>
                <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
                  Followers
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>
                  {profile?.followingCount ?? 0}
                </div>
                <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
                  Following
                </div>
              </div>
            </div>
          </Card>
          <Card style={{ background: "#0f0f10", borderColor: "#1f1f1f" }}>
            <Button
              type="text"
              block
              onClick={() => navigate("/archived-posts")}
              style={{
                color: "#e5e7eb",
                textAlign: "left",
                height: "auto",
                padding: "12px 16px",
              }}
            >
              <Space>
                <DeleteOutlined />
                <span>Bài viết đã lưu trữ</span>
              </Space>
            </Button>
          </Card>
        </div>

        <div>
          <div
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
            onClick={() => setIsModalOpen(true)}
          >
            <Avatar 
              size={40} 
              src={profile?.avatarUrl || profile?.avatar_url} 
              style={{ backgroundColor: "#722ed1" }}
            >
              {(profile?.displayName || profile?.username || "U")[0]?.toUpperCase()}
            </Avatar>
            <Input.TextArea
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
                setIsModalOpen(true);
              }}
            >
              Post
            </Button>
          </div>

          <Modal
            open={isModalOpen}
            title={
              <span style={{ color: "#fff", fontWeight: 600 }}>
                Tạo bài đăng
              </span>
            }
            onCancel={() => {
              if (!posting) {
                setIsModalOpen(false);
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
                    if (!posting) setIsModalOpen(false);
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
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input.TextArea
                placeholder="Chia sẻ điều gì đó..."
                autoSize={{ minRows: 3, maxRows: 8 }}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                maxLength={maxChars}
                showCount
              />
              <Upload.Dragger
                multiple
                fileList={files}
                accept="audio/*,video/*"
                beforeUpload={() => false}
                onChange={({ fileList }) => setFiles(fileList)}
                listType="text"
                style={{
                  padding: 8,
                  borderColor: "#303030",
                  background: "#0f0f10",
                  color: "#e5e7eb",
                  minHeight: 150,
                }}
                itemRender={(originNode, file, fileList, actions) => (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      color: "#e5e7eb",
                      padding: "6px 8px",
                      borderBottom: "1px dashed #303030",
                    }}
                  >
                    <span
                      style={{
                        color: "#e5e7eb",
                        fontSize: 16,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginRight: 12,
                      }}
                    >
                      {file.name}
                    </span>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <Button danger size="small" onClick={actions.remove}>
                        Xóa
                      </Button>
                    </div>
                  </div>
                )}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <p style={{ margin: 0, color: "#e5e7eb" }}>
                    Kéo thả hoặc bấm để chọn file (audio/video)
                  </p>
                  <Text style={{ color: "#bfbfbf" }}>
                    Hỗ trợ tối đa 10 file, 100MB mỗi file
                  </Text>
                </div>
              </Upload.Dragger>
              {extractFirstUrl(newText) && (
                <div
                  style={{
                    border: "1px solid #303030",
                    borderRadius: 8,
                    padding: 12,
                    background: "#111",
                    color: "#e5e7eb",
                  }}
                >
                  {linkLoading && (
                    <Text style={{ color: "#bfbfbf" }}>Đang tải preview…</Text>
                  )}
                  {!linkLoading && (
                    <div
                      style={{ display: "flex", gap: 12, alignItems: "center" }}
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
                      <Button size="small" onClick={() => setLinkPreview(null)}>
                        Ẩn
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Modal>

          {loading && (
            <div
              style={{ display: "flex", justifyContent: "center", padding: 24 }}
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
                        src={post?.userId?.avatarUrl}
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
                          <Text strong style={{ color: "#fff", fontSize: 16 }}>
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
                            label: "Lưu trữ bài post",
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
                  </div>
                  {post?.textContent && (
                    <div
                      style={{
                        marginBottom: 10,
                        color: "#fff",
                        fontSize: 15,
                        lineHeight: 1.6,
                      }}
                    >
                      {post.textContent}
                    </div>
                  )}
                  {sharedLickId && (
                    <div style={{ marginBottom: 12 }}>
                      <PostLickEmbed lickId={sharedLickId} url={firstUrl} />
                    </div>
                  )}
                  {post?.media?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <WavePlaceholder />
                    </div>
                  )}
                  {previewUrl && (
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
                    style={{
                      marginTop: 14,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
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
                      Thích{" "}
                      {Number(postIdToStats[post._id]?.likesCount ?? 0) > 0
                        ? `(${postIdToStats[post._id].likesCount})`
                        : ""}
                    </Button>
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
                        {(postIdToComments[post._id] || []).map((c) => {
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
                                src={c?.userId?.avatarUrl}
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
                                }}
                              >
                                <div style={{ fontWeight: 600 }}>
                                  {c?.userId?.displayName ||
                                    c?.userId?.username ||
                                    "Người dùng"}
                                </div>
                                <div>{c.comment}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                </Card>
              );
            })}

          <div ref={loaderRef} style={{ height: 1 }} />
        </div>

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
            header: {
              background: "#0f0f10",
              borderBottom: "1px solid #1f1f1f",
            },
            content: { background: "#0f0f10", borderRadius: 12 },
            body: { background: "#0f0f10" },
          }}
        >
          {modalPost && (
            <div>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <Avatar size={40} style={{ background: "#2db7f5" }}>
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
                  <span style={{ color: "#9ca3af", fontSize: 12 }}>
                    {formatTime(modalPost?.createdAt)}
                  </span>
                </div>
              </div>
              {modalPost?.textContent && (
                <div style={{ marginBottom: 8, color: "#e5e7eb" }}>
                  {modalPost.textContent}
                </div>
              )}
              {(() => {
                const firstUrl = extractFirstUrl(modalPost?.textContent || "");
                const sharedLickId = parseSharedLickId(firstUrl);
                return sharedLickId ? (
                  <div style={{ marginBottom: 12 }}>
                    <PostLickEmbed lickId={sharedLickId} url={firstUrl} />
                  </div>
                ) : null;
              })()}
              {modalPost?.media?.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <WavePlaceholder />
                </div>
              )}
              {!parseSharedLickId(
                extractFirstUrl(modalPost?.textContent || "")
              ) &&
                modalPost?.linkPreview && (
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
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        {modalPost.linkPreview?.thumbnailUrl ? (
                          <img
                            src={modalPost.linkPreview.thumbnailUrl}
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
                {Number(postIdToStats[commentPostId]?.likesCount ?? 0)} lượt
                thích ·{" "}
                {Number(postIdToStats[commentPostId]?.commentsCount ?? 0)} bình
                luận
              </div>

              <div style={{ marginTop: 12, maxHeight: 360, overflowY: "auto" }}>
                {(postIdToComments[commentPostId] || []).map((c) => (
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
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {c?.userId?.displayName ||
                          c?.userId?.username ||
                          "Người dùng"}
                      </div>
                      <div>{c.comment}</div>
                    </div>
                  </div>
                ))}
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
              setEditFiles([]);
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
                    setEditFiles([]);
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
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

        <div>
          <Card style={{ background: "#0f0f10", borderColor: "#1f1f1f" }}>
            <div style={{ color: "#fff", fontWeight: 700, marginBottom: 12 }}>
              Find Me On
            </div>
            {profile?.links && Array.isArray(profile.links) && profile.links.length > 0 ? (
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
                No links available
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PersonalFeed;
