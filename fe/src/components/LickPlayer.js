import React, { useState, useRef, useEffect } from "react";
import { Button, Slider, Typography, Row, Col } from "antd";
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  SoundOutlined,
  MutedOutlined,
} from "@ant-design/icons";
import { playLickAudio } from "../services/user/lickService";
import { getMyProfile } from "../services/user/profile";

const { Text } = Typography;

const LickPlayer = ({
  lick,
  onTimeUpdate,
  style = {},
  showWaveform = true,
  showControls = true,
  usePlayEndpoint = false, // Optional: use the new play endpoint
  userId = null, // Optional: for tracking plays
  audioRef: externalAudioRef = null, // Optional: external audio ref for tab sync
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(lick?.duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(lick?.audio_url || "");
  const [myProfile, setMyProfile] = useState(null);
  const animationFrameRef = useRef(null);

  const internalAudioRef = useRef(null);
  const audioRef = externalAudioRef || internalAudioRef;

  useEffect(() => {
    const loadAudio = async () => {
      if (lick?.lick_id && usePlayEndpoint) {
        // Use the play endpoint to get the audio URL
        try {
          const response = await playLickAudio(lick.lick_id, userId);
          if (response.success && response.data.audio_url) {
            setAudioUrl(response.data.audio_url);
            if (audioRef?.current) {
              // Force reload by resetting the src
              audioRef.current.pause();
              audioRef.current.load();
              audioRef.current.src =
                response.data.audio_url + `?t=${Date.now()}`; // Cache bust
            }
          }
        } catch (error) {
          console.error("Error loading audio from play endpoint:", error);
          // Fallback to direct URL if available
          if (lick?.audio_url) {
            setAudioUrl(lick.audio_url);
            if (audioRef?.current) {
              audioRef.current.pause();
              audioRef.current.load();
              audioRef.current.src = lick.audio_url + `?t=${Date.now()}`; // Cache bust
            }
          }
        }
      } else if (lick?.audio_url && audioRef?.current) {
        // Use direct audio URL with cache busting
        setAudioUrl(lick.audio_url);
        audioRef.current.pause();
        audioRef.current.load();
        audioRef.current.src = lick.audio_url + `?t=${Date.now()}`; // Cache bust
      }

      setDuration(lick?.duration || 0);
      setIsPlaying(false); // Reset playing state when lick changes
      setCurrentTime(0); // Reset time
    };

    loadAudio();
  }, [lick, usePlayEndpoint, userId, audioRef]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await getMyProfile();
        if (res?.success && res?.data?.user) {
          setMyProfile(res.data.user);
        }
      } catch (_) {
        // ignore
      }
    };
    loadProfile();
  }, []);

  const displayName =
    lick?.creator?.display_name ||
    lick?.creator?.displayName ||
    lick?.creator?.username ||
    "Unknown User";

  const displayAvatar = lick?.creator?.avatar_url;

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error playing audio:", error);
          setIsLoading(false);
        });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      if (onTimeUpdate) {
        onTimeUpdate(time);
      }
    }
  };

  const animateProgress = () => {
    if (!audioRef.current) return;
    const time = audioRef.current.currentTime;
    setCurrentTime(time);
    if (onTimeUpdate) {
      onTimeUpdate(time);
    }
    animationFrameRef.current = requestAnimationFrame(animateProgress);
  };

  React.useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animateProgress);
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [isPlaying]);

  React.useEffect(() => () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const handleSeek = (value) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  const handleVolumeChange = (value) => {
    const nextValue = Array.isArray(value) ? value[0] : value;
    const normalized = nextValue / 100;
    if (audioRef.current) {
      audioRef.current.volume = normalized;
      setVolume(normalized);
      if (nextValue === 0) {
        setIsMuted(true);
      } else if (isMuted) {
        setIsMuted(false);
      }
    }
  };

  const handleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${millis
      .toString()
      .padStart(2, "0")}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  const sliderTheme = {
    track: {
      background: "linear-gradient(90deg, #f97316 0%, #facc15 100%)",
      height: 4,
      borderRadius: 999,
    },
    rail: {
      background: "rgba(148, 163, 184, 0.18)",
      height: 4,
      borderRadius: 999,
    },
    handle: {
      width: 12,
      height: 12,
      border: "1px solid #f97316",
      backgroundColor: "#0f172a",
      boxShadow: "0 0 0 3px rgba(249, 115, 22, 0.18)",
    },
  };

  const volumeSliderTheme = {
    track: {
      background: "linear-gradient(90deg, #38bdf8 0%, #6366f1 100%)",
      height: 4,
      borderRadius: 999,
    },
    rail: {
      background: "rgba(148, 163, 184, 0.18)",
      height: 4,
      borderRadius: 999,
    },
    handle: {
      width: 10,
      height: 10,
      border: "1px solid #38bdf8",
      backgroundColor: "#0f172a",
    },
  };

  const renderWaveform = () => {
    if (!showWaveform || !lick?.waveform_data) return null;

    return (
      <div
        style={{
          height: "70px",
          background:
            "linear-gradient(180deg, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.4) 100%)",
          borderRadius: "10px",
          padding: "10px 12px",
          marginBottom: "18px",
          display: "flex",
          alignItems: "flex-end",
          gap: "3px",
        }}
      >
        {lick.waveform_data.map((amplitude, index) => {
          const barProgress = index / lick.waveform_data.length;
          const isPlayed = barProgress <= progress;
          return (
            <div
              key={index}
              style={{
                height: `${Math.max(amplitude, 0.05) * 100}%`,
                background:
                  isPlayed
                    ? "linear-gradient(180deg, #f97316 0%, #fb923c 100%)"
                    : "linear-gradient(180deg, rgba(148,163,184,0.35) 0%, rgba(148,163,184,0.1) 100%)",
                width: "3px",
                borderRadius: "3px",
                transition: "all 0.25s ease",
                opacity: isPlayed ? 1 : 0.65 + amplitude * 0.3,
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(9,9,11,0.88) 100%)",
        padding: "24px",
        borderRadius: "16px",
        border: "1px solid rgba(71, 85, 105, 0.4)",
        boxShadow: "0 25px 45px rgba(15, 23, 42, 0.45)",
        ...style,
      }}
    >
      {/* Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current.duration)}
        onEnded={() => setIsPlaying(false)}
        onError={(e) => {
          console.error("Audio error:", e);
          setIsLoading(false);
        }}
        preload="metadata"
      />

      {/* Waveform */}
      {renderWaveform()}

      {/* Player Controls */}
      {showControls && (
        <div>
          {/* Main Controls */}
          <Row
            gutter={[16, 12]}
            align="middle"
            style={{ marginBottom: "16px", flexWrap: "nowrap" }}
          >
            <Col>
              <Button
                type="primary"
                shape="circle"
                icon={
                  isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />
                }
                size="large"
                onClick={handlePlayPause}
                loading={isLoading}
                style={{
                  background:
                    "linear-gradient(135deg, #f97316 0%, #fb923c 45%, #fbbf24 100%)",
                  borderColor: "#f97316",
                  width: "54px",
                  height: "54px",
                  boxShadow: "0 12px 25px rgba(249, 115, 22, 0.35)",
                }}
              />
            </Col>

            <Col flex={1}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <Text style={{ color: "#e2e8f0", fontSize: "12px" }}>
                  {formatTime(currentTime)}
                </Text>
                <Text style={{ color: "#64748b", fontSize: "12px" }}>
                  {formatTime(duration)}
                </Text>
              </div>
              <Slider
                min={0}
                max={duration}
                step={0.01}
                value={currentTime}
                onChange={handleSeek}
                tooltip={{ formatter: (value) => formatTime(value) }}
                style={{ margin: 0 }}
                trackStyle={sliderTheme.track}
                railStyle={sliderTheme.rail}
                handleStyle={[sliderTheme.handle]}
              />
            </Col>

            <Col>
              <Button
                type="text"
                icon={isMuted ? <MutedOutlined /> : <SoundOutlined />}
                onClick={handleMute}
                style={{
                  color: "#e2e8f0",
                  fontSize: "18px",
                  backgroundColor: "rgba(148, 163, 184, 0.08)",
                  borderRadius: "10px",
                  padding: "10px",
                }}
              />
            </Col>
          </Row>

          {/* Volume Control */}
          <Row align="middle" gutter={12}>
            <Col>
              <Text style={{ color: "#94a3b8", fontSize: "12px" }}>
                Volume
              </Text>
            </Col>
            <Col flex={0}>
              <Slider
                min={0}
                max={100}
                step={1}
                value={isMuted ? 0 : Math.round(volume * 100)}
                onChange={handleVolumeChange}
                style={{ margin: 0, width: 140 }}
                trackStyle={volumeSliderTheme.track}
                railStyle={volumeSliderTheme.rail}
                handleStyle={[volumeSliderTheme.handle]}
              />
            </Col>
          </Row>
        </div>
      )}

      {/* Lick Info */}
      {lick && (
        <div
          style={{
            marginTop: "18px",
            paddingTop: "16px",
            borderTop: "1px solid rgba(71, 85, 105, 0.45)",
          }}
        >
          <Text
            style={{ color: "#f9fafb", fontWeight: 600, display: "block" }}
          >
            {lick.title}
          </Text>
          <Text style={{ color: "#94a3b8", fontSize: "12px" }}>
            by {displayName} • {lick.duration || 0}s • {lick.tempo || "N/A"} BPM
          </Text>
        </div>
      )}
    </div>
  );
};

export default LickPlayer;
