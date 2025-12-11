import React, { useRef, useState } from "react";
import {
  Card,
  Tag,
  Avatar,
  Typography,
  Row,
  Col,
  Button,
  Divider,
  Spin,
  message,
} from "antd";
import {
  HeartOutlined,
  CommentOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { setLikeState, toggleLikeLocal } from "../redux/likesSlice";
import { toggleLickLike } from "../services/user/lickService";
// Use Redux auth state rather than helper for user id
import LickPlayer from "./LickPlayer";
import GuitarTabNotation from "./GuitarTabNotation";
import CommentSection from "./CommentSection";
import { getMyProfile } from "../services/user/profile";
import GuitarTabEditor from "./GuitarTabEditor";
import { updateLick } from "../services/user/lickService";
import { createPost as createPostApi } from "../services/user/post";

const { Title, Text, Paragraph } = Typography;

const LickDetail = ({
  lick,
  onLike,
  currentUserId = "current-user-id",
  currentUser = null,
  showPlayer = true,
  showComments = true,
  showSidebar = true,
  onTabNotationUpdate = () => {},
}) => {
  // Create audio ref for syncing player with tab notation
  const audioRef = useRef(null);
  const dispatch = useDispatch();
  const authUser = useSelector((s) => s.auth.user);
  const likeState = useSelector((s) => s.likes.byId[lick.lick_id]);
  const isLiked = likeState?.liked || false;
  const localLikesCount = likeState?.count ?? lick.likes_count;
  const [commentsCount, setCommentsCount] = useState(
    typeof lick.comments_count === "number"
      ? lick.comments_count
      : lick.commentsCount ?? 0
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [myProfile, setMyProfile] = useState(null);
  const [tabContent, setTabContent] = useState(
    lick?.tab_notation || lick?.tabNotation || ""
  );
  const [isEditingTab, setIsEditingTab] = useState(false);
  const [savingTab, setSavingTab] = useState(false);
  const [sharing, setSharing] = useState(false);
  const isPublic = lick?.is_public ?? lick?.isPublic ?? false;
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  React.useEffect(() => {
    if (!likeState) {
      dispatch(
        setLikeState({
          id: lick.lick_id,
          liked: false,
          count: lick.likes_count,
        })
      );
    }
  }, [dispatch, likeState, lick.lick_id, lick.likes_count]);

  React.useEffect(() => {
    // Fetch current user's profile for displaying correct user info
    const loadProfile = async () => {
      try {
        const res = await getMyProfile();
        if (res?.success && res?.data?.user) {
          setMyProfile(res.data.user);
        }
      } catch (_) {
        // ignore - fallback to lick.creator below
      }
    };
    loadProfile();
  }, []);

  React.useEffect(() => {
    const resolvedTab = lick?.tab_notation || lick?.tabNotation || "";
    setTabContent(resolvedTab);
    setIsEditingTab(false);
  }, [lick?.lick_id, lick?.tab_notation, lick?.tabNotation]);

  const displayAvatar = lick.creator?.avatar_url;
  const displayName =
    lick.creator?.display_name ||
    lick.creator?.displayName ||
    lick.creator?.username ||
    "Unknown User";

  const resolvedCurrentUserId =
    myProfile?.id ||
    authUser?.user?.id ||
    authUser?.id ||
    currentUser?.id ||
    currentUserId;
  const lickOwnerId =
    lick.creator?.user_id ||
    lick.userId ||
    lick.user_id ||
    lick.creator?._id ||
    null;
  const canEditTab =
    Boolean(resolvedCurrentUserId) &&
    Boolean(lickOwnerId) &&
    String(resolvedCurrentUserId) === String(lickOwnerId);

  const handleTabSave = async (newTab) => {
    if (!canEditTab) return;
    if (savingTab) {
      message.info("Tab notation update in progress");
      return;
    }

    setSavingTab(true);
    try {
      const response = await updateLick(lick.lick_id, { tabNotation: newTab });
      const updatedTab =
        response?.data?.tabNotation !== undefined
          ? response.data.tabNotation
          : newTab;
      setTabContent(updatedTab);
      onTabNotationUpdate(updatedTab);
      message.success("Tab notation updated successfully");
      setIsEditingTab(false);
    } catch (error) {
      console.error("Error updating tab notation:", error);
      message.error(error?.message || "Failed to update tab notation");
    } finally {
      setSavingTab(false);
    }
  };

  const resolvedTags = Array.isArray(lick?.tags) ? lick.tags : [];

  const handleLike = async () => {
    const tokenFromStorage = (() => {
      try {
        const stored = localStorage.getItem("user");
        return stored ? JSON.parse(stored)?.token : undefined;
      } catch {
        return undefined;
      }
    })();

    const userId = authUser?.user?.id || authUser?.id || currentUserId;
    const hasToken = Boolean(tokenFromStorage);
    if (!userId || !hasToken || userId === "current-user-id") {
      alert("You need to be logged in to like licks.");
      return;
    }
    dispatch(toggleLikeLocal({ id: lick.lick_id }));
    try {
      const res = await toggleLickLike(lick.lick_id, userId);
      if (res.success && typeof res.data?.liked === "boolean") {
        if (res.data.liked !== isLiked) {
          dispatch(toggleLikeLocal({ id: lick.lick_id }));
        }
      }
      if (onLike) onLike(lick.lick_id);
    } catch (e) {
      dispatch(toggleLikeLocal({ id: lick.lick_id }));
      console.error("Error toggling lick like:", e);
    }
  };

  const handleShare = async () => {
    if (sharing) return;
    if (!isPublic) {
      message.warning("Chỉ có thể chia sẻ lick ở trạng thái Public");
      return;
    }
    try {
      setSharing(true);
      const origin =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : "";
      const shareUrl = origin
        ? `${origin}/licks/${lick.lick_id}`
        : `/licks/${lick.lick_id}`;
      const title = lick?.title || "My new lick";
      const textContent = `🎸 ${title}\n${shareUrl}`;
      const MAX_POST_TEXT_LENGTH = 300;
      if (textContent.length > MAX_POST_TEXT_LENGTH) {
        message.warning(
          `Nội dung không được vượt quá ${MAX_POST_TEXT_LENGTH} ký tự (hiện tại: ${textContent.length})`
        );
        return;
      }
      await createPostApi({ postType: "status_update", textContent });
      message.success("Đã chia sẻ lên bảng tin của bạn");
    } catch (error) {
      console.error("Error sharing lick:", error);
      message.error(error?.message || "Chia sẻ thất bại");
    } finally {
      setSharing(false);
    }
  };

  if (!lick) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Row gutter={[20, 16]}>
      {/* Main Content */}
      <Col xs={24} lg={showSidebar ? 16 : 24}>
        <Card
          style={{
            backgroundColor: "#111827",
            border: "1px solid #1f2937",
            borderRadius: "16px",
            marginBottom: "20px",
            boxShadow: "0 12px 32px rgba(15, 23, 42, 0.25)",
          }}
          styles={{ body: { padding: "20px" } }}
        >
          {/* Audio Player */}
          {showPlayer && (
            <div style={{ marginBottom: "18px" }}>
              <LickPlayer
                lick={lick}
                style={{ marginBottom: "12px" }}
                audioRef={audioRef}
                onPlayStateChange={setIsPlaying}
                onProgress={setProgress}
              />
            </div>
          )}

          {/* Lick Info */}
          <div style={{ marginBottom: "18px" }}>
            <Title
              level={2}
              style={{
                color: "#f3f4f6",
                marginBottom: "8px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              {lick.title}
            </Title>

            {(myProfile || lick.creator) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "18px",
                }}
              >
                {displayAvatar ? (
                  <Avatar
                    src={displayAvatar}
                    size={48}
                    style={{ border: "2px solid #1f2937" }}
                  />
                ) : null}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <Text
                    style={{
                      color: "#e2e8f0",
                      display: "block",
                      fontWeight: "bold",
                    }}
                  >
                    {displayName}
                  </Text>
                  <Text style={{ color: "#94a3b8", fontSize: "12px" }}>
                    {formatDate(lick.created_at)}
                  </Text>
                </div>
              </div>
            )}

            {/* Stats */}
            <div
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "16px",
                flexWrap: "wrap",
              }}
            >
              <Button
                type="text"
                icon={<HeartOutlined />}
                onClick={handleLike}
                style={{
                  color: isLiked ? "#f87171" : "#cbd5f5",
                  backgroundColor: "rgba(15, 23, 42, 0.35)",
                  borderRadius: "999px",
                  padding: "4px 14px",
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {localLikesCount} likes
              </Button>
              <Button
                type="text"
                icon={<CommentOutlined />}
                style={{
                  color: "#cbd5f5",
                  backgroundColor: "rgba(15, 23, 42, 0.35)",
                  borderRadius: "999px",
                  padding: "4px 14px",
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {commentsCount} comments
              </Button>

            </div>

            {/* Tags */}
            <div
              style={{
                marginBottom: "14px",
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {resolvedTags.map((tag) => (
                <Tag
                  key={tag.tag_id}
                  style={{
                    background: "rgba(14, 165, 233, 0.1)",
                    border: "1px solid rgba(14, 165, 233, 0.25)",
                    color: "#38bdf8",
                    borderRadius: "999px",
                    padding: "4px 12px",
                    fontSize: "12px",
                  }}
                >
                  #{tag.tag_name}
                </Tag>
              ))}
            </div>

            {/* Description */}
            {lick.description && (
              <Paragraph
                style={{
                  color: "#cbd5f5",
                  marginBottom: "18px",
                  lineHeight: 1.55,
                }}
              >
                {lick.description}
              </Paragraph>
            )}

            {/* Technical Info */}
            <Row gutter={[12, 12]} style={{ marginBottom: "4px" }}>
              <Col xs={12} sm={6}>
                <Text
                  style={{
                    color: "#94a3b8",
                    fontSize: "12px",
                    textTransform: "uppercase",
                  }}
                >
                  Key
                </Text>
                <br />
                <Text
                  style={{
                    color: "#e5e7eb",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  {lick.key || "N/A"}
                </Text>
              </Col>
              <Col xs={12} sm={6}>
                <Text
                  style={{
                    color: "#94a3b8",
                    fontSize: "12px",
                    textTransform: "uppercase",
                  }}
                >
                  Tempo
                </Text>
                <br />
                <Text
                  style={{
                    color: "#e5e7eb",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  {lick.tempo || "N/A"} BPM
                </Text>
              </Col>
              <Col xs={12} sm={6}>
                <Text
                  style={{
                    color: "#94a3b8",
                    fontSize: "12px",
                    textTransform: "uppercase",
                  }}
                >
                  Difficulty:
                </Text>
                <br />
                <Text
                  style={{
                    color: "#e5e7eb",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  {lick.difficulty || "N/A"}
                </Text>
              </Col>
              <Col xs={12} sm={6}>
                <Text
                  style={{
                    color: "#94a3b8",
                    fontSize: "12px",
                    textTransform: "uppercase",
                  }}
                >
                  Duration:
                </Text>
                <br />
                <Text
                  style={{
                    color: "#e5e7eb",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  {lick.duration || "N/A"}s
                </Text>
              </Col>
            </Row>
          </div>

          <Divider style={{ borderColor: "#1f2937", margin: "0 0 18px" }} />

          {canEditTab && (
            <div style={{ marginBottom: "18px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                  gap: "12px",
                }}
              >
                <Title
                  level={4}
                  style={{
                    color: "#e2e8f0",
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Tab Notation Editor
                </Title>
                <Button
                  type="text"
                  onClick={() => setIsEditingTab((prev) => !prev)}
                  disabled={savingTab}
                  style={{
                    padding: "0 12px",
                    height: "34px",
                    borderRadius: "10px",
                    color: isEditingTab ? "#e5e7eb" : "#94a3b8",
                    backgroundColor: isEditingTab
                      ? "rgba(148, 163, 184, 0.12)"
                      : "transparent",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                  }}
                >
                  {isEditingTab ? "Close Editor" : "Edit Tab"}
                </Button>
              </div>
              {isEditingTab ? (
                <GuitarTabEditor
                  initialTab={tabContent}
                  onSave={handleTabSave}
                  tempo={lick.tempo || 120}
                />
              ) : (
                <div
                  style={{
                    backgroundColor: "#0b1623",
                    border: "1px solid #1f2937",
                    borderRadius: "12px",
                    padding: "16px",
                  }}
                >
                  {tabContent ? (
                    <GuitarTabNotation
                      tabData={tabContent}
                      tempo={lick.tempo || 120}
                      isEditable={false}
                      audioRef={audioRef}
                      audioDuration={lick.duration || 0}
                    />
                  ) : (
                    <Text style={{ color: "#7f8ea3" }}>
                      No tab notation available. Click "Edit Tab" to create one.
                    </Text>
                  )}
                </div>
              )}
            </div>
          )}

          {showComments && (
            <div style={{ marginTop: "12px" }}>
              <CommentSection
                lickId={lick.lick_id}
                currentUser={{ id: currentUserId }}
                onCountChange={setCommentsCount}
              />
            </div>
          )}
        </Card>
      </Col>

      {/* Sidebar */}
      {showSidebar && (
        <Col xs={24} lg={8}>
          <Card
            title={canEditTab ? "Playback & Notes" : "Tab Notation"}
            style={{
              backgroundColor: "#0f172a",
              border: "1px solid #1f2937",
              borderRadius: "16px",
              boxShadow: "0 12px 32px rgba(15, 23, 42, 0.2)",
            }}
            styles={{
              header: {
                color: "#e2e8f0",
                borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
                background: "rgba(15, 23, 42, 0.55)",
                padding: "14px 20px",
              },
              body: { padding: "20px" }
            }}
          >
            <div style={{ color: "white" }}>
              {canEditTab ? (
                <div
                  style={{
                    color: "#94a3b8",
                    lineHeight: 1.6,
                    fontSize: "14px",
                  }}
                >
                  <p style={{ marginBottom: "10px" }}>
                    Use the editor to update notes while listening. Save to keep
                    the preview in sync.
                  </p>
                  <Divider
                    style={{ borderColor: "#1f2937", margin: "12px 0" }}
                  />
                  <p style={{ marginBottom: 0 }}>
                    Preview closes automatically when you switch back to
                    editing.
                  </p>
                </div>
              ) : (
                <div style={{ marginBottom: "0" }}>
                  {tabContent ? (
                    <GuitarTabNotation
                      tabData={tabContent}
                      tempo={lick.tempo || 120}
                      isEditable={false}
                      audioRef={audioRef}
                      audioDuration={lick.duration || 0}
                    />
                  ) : (
                    <div
                      style={{
                        backgroundColor: "#0b1623",
                        padding: "16px",
                        borderRadius: "12px",
                        textAlign: "center",
                      }}
                    >
                      <Text style={{ color: "#7f8ea3" }}>
                        No tab notation available
                      </Text>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </Col>
      )}
    </Row>
  );
};

export default LickDetail;
