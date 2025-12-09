import React from "react";

/**
 * WaveformRenderer - Renders waveform visualization for audio clips
 * 
 * Props:
 * - waveformData: Array | string - waveform data (array or JSON string)
 * - clipWidth: number - width of the clip in pixels
 * - itemOffset: number - offset into the source audio
 * - itemDuration: number - duration of the visible clip
 * - sourceDuration: number - total duration of source audio
 * - className?: string - optional custom classes
 */
const WaveformRenderer = ({
  waveformData,
  clipWidth,
  itemOffset = 0,
  itemDuration = 0,
  sourceDuration = 0,
  className = "",
}) => {
  if (!waveformData) return null;

  try {
    // Parse waveform data if it's a string
    const waveform =
      typeof waveformData === "string"
        ? JSON.parse(waveformData)
        : waveformData;
    const waveformArray = Array.isArray(waveform) ? waveform : [];

    if (!waveformArray.length) return null;

    // Calculate sample rate
    const totalSamples = waveformArray.length;
    const samplesPerSecond = totalSamples / (sourceDuration || 1);

    // Determine the visible slice of audio
    const startSample = Math.floor(itemOffset * samplesPerSecond);
    const endSample = Math.floor(
      (itemOffset + itemDuration) * samplesPerSecond
    );

    // Get the visible samples (clamped to array bounds)
    const visibleSamples = waveformArray.slice(
      Math.max(0, startSample),
      Math.min(totalSamples, endSample)
    );

    if (!visibleSamples.length) return null;

    // Calculate step to achieve target density (roughly 1 bar every 5 pixels)
    const targetBarCount = Math.max(10, Math.floor(clipWidth / 5));
    const step = Math.max(
      1,
      Math.ceil(visibleSamples.length / targetBarCount)
    );

    return (
      <div className={`absolute inset-0 overflow-hidden ${className}`}>
        <div
          data-clip-waveform="true"
          className="absolute top-0 bottom-0 h-full flex items-end gap-0.5 opacity-80 px-2 pointer-events-none"
          style={{
            width: "100%",
            left: 0,
          }}
        >
          {visibleSamples
            .filter((_value, idx) => idx % step === 0)
            .map((value, idx) => (
              <div
                key={idx}
                className="bg-white rounded-t"
                style={{
                  width: "3px",
                  flexShrink: 0,
                  height: `${Math.min(100, Math.abs(value || 0) * 100)}%`,
                }}
              />
            ))}
        </div>
      </div>
    );
  } catch (e) {
    console.error("Waveform Error:", e);
    return null;
  }
};

export default WaveformRenderer;





