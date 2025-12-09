import React, { useEffect, useState } from "react";
import { Card, Avatar, Typography, Space, Spin } from "antd";
import { getProjectById } from "../services/user/projectService";
import ProjectPlayer from "./ProjectPlayer";

const { Text } = Typography;

const PROJECT_CACHE = new Map();

const PostProjectEmbed = ({ projectId }) => {
  const [data, setData] = useState(() =>
    projectId && PROJECT_CACHE.has(projectId) ? PROJECT_CACHE.get(projectId) : null
  );
  const [loading, setLoading] = useState(!data && Boolean(projectId));
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(data?.audioUrl || null);

  useEffect(() => {
    let active = true;
    if (!projectId) return undefined;
    
    // If data is already cached, set it
    if (PROJECT_CACHE.has(projectId)) {
      const cachedData = PROJECT_CACHE.get(projectId);
      setData(cachedData);
      if (cachedData.audioUrl) {
        setAudioUrl(cachedData.audioUrl);
      }
      return undefined;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await getProjectById(projectId);
        if (!active) return;
        if (res?.success && res.data) {
          // Backend returns { project, tracks, ... } – flatten to project-level for the embed
          const project =
            res.data.project ||
            res.data.data || // fallback just in case
            res.data;

          const normalized = {
            ...project,
            creatorId: project?.creatorId || project?.creator,
            waveformData: project?.waveformData || project?.waveform_data,
          };

          PROJECT_CACHE.set(projectId, normalized);
          setData(normalized);
          setError(null);

          const audio = normalized.audioUrl || normalized.audio_url;
          if (audio) {
            setAudioUrl(audio);
          }
        } else {
          setError("Project unavailable");
        }
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load project");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [projectId]);

  return (
    <Card
      bordered={false}
      style={{
        background: "#111",
        borderRadius: 12,
        border: "1px solid #1f1f1f",
        cursor: "default",
      }}
      bodyStyle={{ padding: 16 }}
    >
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
          <Spin />
        </div>
      )}
      {!loading && error && (
        <Text type="secondary" style={{ color: "#9ca3af" }}>
          {error}
        </Text>
      )}
      {!loading && !error && data && (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Space size={12}>
            <Avatar
              size={44}
              src={data?.creatorId?.avatarUrl || data?.creator?.avatarUrl}
              style={{ background: "#7c3aed", fontWeight: 600 }}
            >
              {data?.creatorId?.displayName?.[0] ||
                data?.creatorId?.username?.[0] ||
                data?.creator?.displayName?.[0] ||
                data?.creator?.username?.[0] ||
                (data?.title || "P")[0]}
            </Avatar>
            <div>
              <Text style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>
                {data?.title || "Untitled Project"}
              </Text>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                {data?.creatorId?.displayName ||
                  data?.creatorId?.username ||
                  data?.creator?.displayName ||
                  data?.creator?.username ||
                  "Unknown artist"}
              </div>
            </div>
          </Space>

          <ProjectPlayer
            audioUrl={audioUrl}
            waveformData={data?.waveformData || data?.waveform_data}
            audioDuration={data?.audioDuration}
            projectName={data?.title || "Untitled Project"}
          />

          <div style={{ color: "#9ca3af", fontSize: 12 }}>
            {data?.audioDuration
              ? `Exported Project · ${data.audioDuration.toFixed(1)}s`
              : "Exported Project"}
          </div>
        </Space>
      )}
    </Card>
  );
};

export default PostProjectEmbed;


