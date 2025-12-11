import React, { useEffect, useMemo, useState, useRef } from "react";
import { Card, Avatar, Typography, Space, Spin, Button } from "antd";
import { PlayCircleOutlined, PauseCircleOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { getLickById, playLickAudio } from "../services/user/lickService";

const { Text } = Typography;

const LICK_CACHE = new Map();

const buildBars = (waveform = []) => {
  if (Array.isArray(waveform) && waveform.length > 0) {
    return waveform.slice(0, 80);
  }
  return Array.from({ length: 60 }, () => Math.random() * 0.8 + 0.2);
};

const PostLickEmbed = ({ lickId, url }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(() =>
    lickId && LICK_CACHE.has(lickId) ? LICK_CACHE.get(lickId) : null
  );
  const [loading, setLoading] = useState(!data && Boolean(lickId));
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (!lickId) return undefined;
    
    // If data is already cached, set it and fetch audio URL if needed
    if (LICK_CACHE.has(lickId)) {
      const cachedData = LICK_CACHE.get(lickId);
      setData(cachedData);
      if (cachedData.audio_url) {
        setAudioUrl(cachedData.audio_url);
      } else {
        // Try to get audio URL from play endpoint
        playLickAudio(lickId)
          .then((playRes) => {
            if (!active) return;
            if (playRes?.success && playRes.data?.audio_url) {
              setAudioUrl(playRes.data.audio_url);
            }
          })
          .catch((err) => {
            console.warn("Could not fetch audio URL from cache:", err);
          });
      }
      return undefined;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await getLickById(lickId);
        if (!active) return;
        if (res?.success && res.data) {
          LICK_CACHE.set(lickId, res.data);
          setData(res.data);
          setError(null);
          // Set audio URL if available in data
          if (res.data.audio_url) {
            setAudioUrl(res.data.audio_url);
          } else {
            // Try to get audio URL from play endpoint
            try {
              const playRes = await playLickAudio(lickId);
              if (playRes?.success && playRes.data?.audio_url) {
                setAudioUrl(playRes.data.audio_url);
              }
            } catch (err) {
              console.warn("Could not fetch audio URL:", err);
            }
          }
        } else {
          setError("Lick unavailable");
        }
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load lick");
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
  }, [lickId]);

  const bars = useMemo(
    () => buildBars(data?.waveform_data || data?.waveformData),
    [data]
  );

  const handleNavigate = () => {
    if (lickId) {
      navigate(`/licks/${lickId}`);
    } else if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handlePlayPause = async (e) => {
    e.stopPropagation(); // Prevent navigation when clicking play button
    if (!audioRef.current) return;

    // If no audio URL yet, try to fetch it
    if (!audioUrl && lickId) {
      try {
        const playRes = await playLickAudio(lickId);
        if (playRes?.success && playRes.data?.audio_url) {
          setAudioUrl(playRes.data.audio_url);
          audioRef.current.src = playRes.data.audio_url;
        } else {
          console.error("No audio URL available");
          return;
        }
      } catch (error) {
        console.error("Error fetching audio URL:", error);
        return;
      }
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioUrl && !audioRef.current.src) {
        audioRef.current.src = audioUrl;
      }
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((error) => {
          console.error("Error playing audio:", error);
        });
    }
  };

  const handleWaveformClick = (e) => {
    e.stopPropagation(); // Prevent navigation when clicking waveform
    handlePlayPause(e);
  };

  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl;
    }
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setIsPlaying(false);
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, []);

  return (
    <Card
      variant="borderless"
      onClick={handleNavigate}
      style={{
        background: "#111",
        borderRadius: 12,
        border: "1px solid #1f1f1f",
        cursor: "pointer",
      }}
      styles={{ body: { padding: 16 } }}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        preload="metadata"
        onError={(e) => {
          console.error("Audio error:", e);
        }}
      />
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
              src={data?.creator?.avatar_url}
              style={{ background: "#7c3aed", fontWeight: 600 }}
            >
              {data?.creator?.display_name?.[0] ||
                data?.creator?.username?.[0] ||
                (data?.title || "L")[0]}
            </Avatar>
            <div>
              <Text style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>
                {data?.title || "Untitled Lick"}
              </Text>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                {data?.creator?.display_name ||
                  data?.creator?.username ||
                  "Unknown artist"}
              </div>
            </div>
          </Space>
          <div
            style={{
              position: "relative",
              height: 120,
              background: "#181818",
              borderRadius: 10,
              overflow: "hidden",
              padding: "12px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 2,
                height: "100%",
                cursor: "pointer",
              }}
              onClick={handleWaveformClick}
            >
              {bars.map((height, idx) => (
                <div
                  key={idx}
                  style={{
                    width: 4,
                    height: `${Math.max(6, height * 90)}px`,
                    background: "#fb923c",
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
            {lickId && (
              <Button
                type="text"
                icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={handlePlayPause}
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#fb923c",
                  fontSize: 24,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0, 0, 0, 0.5)",
                  border: "none",
                }}
              />
            )}
            {!lickId && (
              <div
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "#fb923c",
                }}
              />
            )}
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>
            Tempo:{" "}
            {data?.tempo ? `${Math.round(Number(data.tempo))} BPM` : "N/A"} ·{" "}
            Key: {data?.key || "Unknown"}
          </div>
        </Space>
      )}
    </Card>
  );
};

export default PostLickEmbed;
