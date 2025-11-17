import React from "react";

const SimpleWaveform = ({
  waveformData = [],
  height = 60,
  color = "#ff6b35",
  backgroundColor = "#1a1a1a",
  isPlaying = false,
  style = {},
}) => {
  // Generate default waveform if no data provided
  const defaultWaveform = Array.from(
    { length: 100 },
    () => Math.random() * 0.8 + 0.2
  );
  const waveData = waveformData.length > 0 ? waveformData : defaultWaveform;

  return (
    <div
      style={{
        backgroundColor: backgroundColor,
        borderRadius: "4px",
        border: "1px solid #333",
        padding: "8px",
        height: `${height}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "1px",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.2s ease",
        ...style,
      }}
    >
      {waveData.map((amplitude, index) => {
        const barHeight = Math.max(amplitude * 100, 4);
        const barColor = isPlaying ? color : "#666";

        return (
          <div
            key={index}
            style={{
              width: "3px",
              height: `${barHeight}%`,
              backgroundColor: barColor,
              borderRadius: "2px",
              transition: "background-color 0.3s ease, height 0.1s ease",
              opacity: 0.7 + amplitude * 0.3,
            }}
          />
        );
      })}
    </div>
  );
};

export default SimpleWaveform;
