import React, { useEffect, useState } from "react";
import {
  Card,
  Avatar,
  Button,
  Typography,
  Space,
  Spin,
  Empty,
  message,
  Modal,
} from "antd";
import {
  LikeOutlined,
  MessageOutlined,
  ArrowLeftOutlined,
  UndoOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { listArchivedPosts, restorePost, permanentlyDeletePost } from "../../services/user/post";
import { likePost, unlikePost, getPostStats, getAllPostComments } from "../../services/user/post";
import { useNavigate } from "react-router-dom";
import PostLickEmbed from "../../components/PostLickEmbed";
import { onPostDeleted, offPostDeleted } from "../../services/user/socketService";

const { Text } = Typography;

const formatTime = (isoString) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleString("vi-VN");
  } catch {
    return "";
  }
};

const formatDaysRemaining = (archivedAt) => {
  if (!archivedAt) return "";
  try {
    const archivedDate = new Date(archivedAt);
    const now = new Date();
    const diffTime = now - archivedDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const daysRemaining = 30 - diffDays;
    if (daysRemaining <= 0) return "Đã quá hạn";
    return `Còn ${daysRemaining} ngày`;
  } catch {
    return "";
  }
};

const extractFirstUrl = (text) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
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

const ArchivedPosts = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = React.useRef(null);
  const [postIdToStats, setPostIdToStats] = useState({});
  const [postIdToComments, setPostIdToComments] = useState({});
  const [postIdToLiked, setPostIdToLiked] = useState({});
  const [likingPostId, setLikingPostId] = useState(null);
  const [restoringPostId, setRestoringPostId] = useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);

  const fetchData = async (p = page) => {
    setLoading(true);
    setError("");
    try {
      const res = await listArchivedPosts({ page: p, limit });
      const posts = res?.data?.posts || [];
      const total = res?.data?.pagination?.totalPosts || 0;
      if (p === 1) setItems(posts);
      else setItems((prev) => [...prev, ...posts]);
      const totalPages = Math.ceil(total / limit) || 1;
      setHasMore(p < totalPages);

      // Load stats for each post
      for (const post of posts) {
        try {
          const statsRes = await getPostStats(post._id);
          setPostIdToStats((prev) => ({ ...prev, [post._id]: statsRes?.data || {} }));
        } catch (e) {
          // Ignore errors
        }
      }
    } catch (e) {
      setError(e.message || "Lỗi tải bài viết đã lưu trữ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Listen for post deleted event (admin deleted permanently)
  useEffect(() => {
    const handler = (payload) => {
      console.log('[ArchivedPosts] Received post:deleted event:', payload);
      if (!payload?.postId) {
        console.warn('[ArchivedPosts] post:deleted event missing postId');
        return;
      }
      const postId = payload.postId.toString();
      console.log('[ArchivedPosts] Removing post from archived list:', postId);
      
      // Remove post from archived list immediately
      setItems((prev) => {
        const filtered = prev.filter((p) => {
          const pId = p._id?.toString() || p._id;
          return pId !== postId;
        });
        console.log('[ArchivedPosts] After filter, items count:', filtered.length, 'removed:', prev.length - filtered.length);
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
      
      message.warning('Một bài viết đã bị xóa vĩnh viễn bởi admin do vi phạm quy định cộng đồng');
    };
    
    console.log('[ArchivedPosts] Setting up post:deleted listener');
    onPostDeleted(handler);
    return () => {
      console.log('[ArchivedPosts] Cleaning up post:deleted listener');
      offPostDeleted(handler);
    };
  }, []);

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
      }
      const statsRes = await getPostStats(postId);
      setPostIdToStats((prev) => ({ ...prev, [postId]: statsRes?.data || {} }));
    } catch (e) {
      message.error(e.message || "Không thể thích bài viết");
    } finally {
      setLikingPostId(null);
    }
  };

  const handleRestore = async (postId) => {
    try {
      setRestoringPostId(postId);
      await restorePost(postId);
      message.success("Đã khôi phục bài viết");
      setItems((prev) => prev.filter((p) => p._id !== postId));
    } catch (e) {
      message.error(e.message || "Không thể khôi phục bài viết");
    } finally {
      setRestoringPostId(null);
    }
  };

  const handlePermanentDelete = (postId) => {
    Modal.confirm({
      title: "Xác nhận xóa vĩnh viễn",
      content: "Bạn có chắc chắn muốn xóa vĩnh viễn bài viết này? Hành động này không thể hoàn tác.",
      okText: "Xóa",
      cancelText: "Hủy",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          setDeletingPostId(postId);
          await permanentlyDeletePost(postId);
          message.success("Đã xóa vĩnh viễn bài viết");
          setItems((prev) => prev.filter((p) => p._id !== postId));
        } catch (e) {
          message.error(e.message || "Không thể xóa bài viết");
        } finally {
          setDeletingPostId(null);
        }
      },
    });
  };

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "24px",
        background: "#0a0a0a",
        minHeight: "100vh",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ marginBottom: 16 }}
        >
          Quay lại
        </Button>
        <Typography.Title level={2} style={{ color: "#fff", margin: 0 }}>
          Bài viết đã lưu trữ
        </Typography.Title>
        <Text style={{ color: "#9ca3af" }}>
          Các bài viết đã lưu trữ sẽ bị xóa vĩnh viễn sau 30 ngày nếu không khôi phục
        </Text>
      </div>

      {loading && items.length === 0 && (
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
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
            <span style={{ color: "#9ca3af" }}>Chưa có bài viết nào được lưu trữ</span>
          }
        />
      )}

      {!loading &&
        !error &&
        items.map((post) => {
          const firstUrl = extractFirstUrl(post?.textContent || "");
          const sharedLickId = parseSharedLickId(firstUrl);
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
                    <div style={{ marginTop: 4 }}>
                      <Text
                        type="secondary"
                        style={{ color: "#9ca3af", fontSize: 12 }}
                      >
                        Đã lưu trữ: {formatTime(post?.archivedAt)} •{" "}
                        {formatDaysRemaining(post?.archivedAt)}
                      </Text>
                    </div>
                  </div>
                </Space>
                <Space>
                  <Button
                    icon={<UndoOutlined />}
                    loading={restoringPostId === post._id}
                    onClick={() => handleRestore(post._id)}
                    disabled={post.archivedByReports}
                    title={post.archivedByReports ? "Bài viết này bị ẩn do báo cáo. Chỉ admin mới có thể khôi phục." : ""}
                    style={{ background: "#f0edefff", borderColor: "#f9faf9ff" }}
                  >
                    {post.archivedByReports ? "Đã bị ẩn do báo cáo" : "Khôi phục"}
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={deletingPostId === post._id}
                    onClick={() => handlePermanentDelete(post._id)}
                  >
                    Xóa vĩnh viễn
                  </Button>
                </Space>
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
                  <div
                    style={{
                      height: 120,
                      background: "#1a1a1a",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#9ca3af",
                    }}
                  >
                    Media file
                  </div>
                </div>
              )}

              {post?.linkPreview && (
                <a
                  href={post.linkPreview?.url || "#"}
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
                      {post.linkPreview?.thumbnailUrl ? (
                        <img
                          src={post.linkPreview.thumbnailUrl}
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
                          {post.linkPreview?.title || post.linkPreview?.url}
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
                          {post.linkPreview?.url}
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
                >
                  Bình luận{" "}
                  {Number(postIdToStats[post._id]?.commentsCount ?? 0) > 0
                    ? `(${postIdToStats[post._id].commentsCount})`
                    : ""}
                </Button>
              </Space>
            </Card>
          );
        })}

      <div ref={loaderRef} style={{ height: 1 }} />
    </div>
  );
};

export default ArchivedPosts;

