import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { PlayCircleOutlined, PauseCircleOutlined } from "@ant-design/icons";
import { Button, Typography } from "antd";

const { Text } = Typography;

const Waveform = ({
  audioUrl,
  waveformData,
  height = 60,
  color = "#ff6b35",
  backgroundColor = "#1a1a1a",
  progressColor = "#ff6b35",
  waveColor = "#666",
  showControls = true,
  style = {},
}) => {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!waveformRef.current || !audioUrl) return;

    // Initialize WaveSurfer
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: waveColor,
      progressColor: progressColor,
      backgroundColor: backgroundColor,
      height: height,
      barWidth: 2,
      barGap: 1,
      responsive: true,
      normalize: true,
      backend: "MediaElement",
      mediaControls: false,
      cursorColor: "#ff6b35",
      cursorWidth: 2,
    });

    wavesurferRef.current = wavesurfer;

    // Load audio
    wavesurfer.load(audioUrl);

    // Event listeners
    wavesurfer.on("ready", () => {
      setDuration(wavesurfer.getDuration());
    });

    wavesurfer.on("play", () => {
      setIsPlaying(true);
    });

    wavesurfer.on("pause", () => {
      setIsPlaying(false);
    });

    wavesurfer.on("finish", () => {
      setIsPlaying(false);
    });

    wavesurfer.on("audioprocess", () => {
      setCurrentTime(wavesurfer.getCurrentTime());
    });

    return () => {
      wavesurfer.destroy();
    };
  }, [audioUrl, height, color, backgroundColor, progressColor, waveColor]);

  const togglePlay = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{ ...style }}>
      {/* Waveform Container */}
      <div
        ref={waveformRef}
        style={{
          backgroundColor: backgroundColor,
          borderRadius: "4px",
          border: "1px solid #333",
          padding: "8px",
          cursor: "pointer",
        }}
        onClick={togglePlay}
      />

      {/* Controls */}
      {showControls && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "8px",
          }}
        >
          <Button
            type="text"
            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={togglePlay}
            style={{
              color: color,
              fontSize: "16px",
              padding: "4px 8px",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Text style={{ color: "#ccc", fontSize: "12px" }}>
              {formatTime(currentTime)}
            </Text>
            <Text style={{ color: "#999", fontSize: "12px" }}>/</Text>
            <Text style={{ color: "#ccc", fontSize: "12px" }}>
              {formatTime(duration)}
            </Text>
          </div>
        </div>
      )}
    </div>
  );
};

export default Waveform;

