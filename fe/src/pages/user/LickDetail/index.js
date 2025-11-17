import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Spin, Empty } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import LickDetail from "../../../components/LickDetail";
import { getLickById } from "../../../services/user/lickService";

const LickDetailPage = () => {
  const navigate = useNavigate();
  const { lickId } = useParams();

  const [lick, setLick] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [likesCount, setLikesCount] = useState(null);

  const handleTabNotationUpdate = (updatedTab) => {
    setLick((prev) =>
      prev
        ? {
            ...prev,
            tab_notation: updatedTab,
            tabNotation: updatedTab,
          }
        : prev
    );
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getLickById(lickId);
      if (res.success) {
        setLick(res.data);
        setLikesCount(res.data.likes_count ?? 0);
      } else {
        setError("Failed to load lick");
      }
    } catch (e) {
      setError(e.message || "Failed to load lick");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lickId) fetchData();
  }, [lickId]);

  const handleLike = () => {
    // LickDetail handles API + Redux; this optional handler can keep a separate count if needed
    setLikesCount((c) => (typeof c === "number" ? Math.max(0, c + 0) : 0));
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !lick) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Empty description="Lick not found" />
        <Button
          onClick={() => navigate("/licks")}
          style={{ marginTop: "16px" }}
        >
          Back
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        paddingTop: "80px",
        backgroundColor: "#1a1a1a",
        minHeight: "100vh",
        color: "white",
      }}
    >
      {/* Back Button */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/licks")}
        style={{ marginBottom: "20px" }}
      >
        Quay lại
      </Button>

      <LickDetail
        lick={{ ...lick, likes_count: likesCount ?? lick.likes_count }}
        onLike={handleLike}
        showPlayer={true}
        showComments={true}
        showSidebar={true}
        onTabNotationUpdate={handleTabNotationUpdate}
      />
    </div>
  );
};

export default LickDetailPage;
