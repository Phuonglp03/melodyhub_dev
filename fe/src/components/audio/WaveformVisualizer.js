import React, { useEffect, useRef, useCallback, memo } from "react";
import WaveSurfer from "wavesurfer.js";

/**
 * WaveformVisualizer - Optimized waveform display using wavesurfer.js
 *
 * Optimization strategies:
 * 1. Uses useRef to store WaveSurfer instance outside React render cycle
 * 2. Uses requestAnimationFrame for smooth playback position updates
 * 3. Throttles state updates to avoid excessive re-renders
 * 4. Memoized to prevent unnecessary re-renders from parent
 *
 * Props:
 * - audioUrl: string - URL of audio to display
 * - waveformData: number[] - Pre-computed waveform peaks (optional, for faster rendering)
 * - height: number - Height of waveform in pixels
 * - waveColor: string - Color of waveform
 * - progressColor: string - Color of played portion
 * - backgroundColor: string - Background color
 * - cursorColor: string - Playhead cursor color
 * - isPlaying: boolean - External playback state (for sync with global transport)
 * - currentTime: number - External current time in seconds (for sync)
 * - duration: number - Total duration in seconds
 * - onReady: (duration: number) => void - Callback when waveform is loaded
 * - onSeek: (time: number) => void - Callback when user seeks
 * - onTimeUpdate: (time: number) => void - Callback for time updates
 * - className: string - Additional CSS classes
 */
const WaveformVisualizer = memo(function WaveformVisualizer({
  audioUrl,
  waveformData,
  height = 60,
  waveColor = "#666",
  progressColor = "#ff6b35",
  backgroundColor = "transparent",
  cursorColor = "#ff6b35",
  isPlaying = false,
  currentTime = 0,
  duration = 0,
  onReady,
  onSeek,
  onTimeUpdate,
  className = "",
}) {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastTimeUpdateRef = useRef(0);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy existing instance if any
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor,
      progressColor,
      backgroundColor,
      cursorColor,
      cursorWidth: 2,
      height,
      barWidth: 2,
      barGap: 1,
      responsive: true,
      normalize: true,
      backend: "MediaElement",
      mediaControls: false,
      interact: true,
      hideScrollbar: true,
    });

    wavesurferRef.current = wavesurfer;

    // Load audio or use pre-computed peaks
    if (audioUrl) {
      if (waveformData && waveformData.length > 0) {
        // Use pre-computed peaks for faster rendering
        wavesurfer.load(audioUrl, waveformData);
      } else {
        wavesurfer.load(audioUrl);
      }
    }

    // Event handlers
    wavesurfer.on("ready", () => {
      const dur = wavesurfer.getDuration();
      onReady?.(dur);
    });

    wavesurfer.on("seek", (progress) => {
      const seekTime = progress * wavesurfer.getDuration();
      onSeek?.(seekTime);
    });

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [audioUrl]); // Only re-init when audioUrl changes

  // Update visual properties without re-creating instance
  useEffect(() => {
    if (!wavesurferRef.current) return;

    // WaveSurfer doesn't have a direct setOptions, but we can update colors
    // For now, this requires re-initialization if colors change significantly
  }, [waveColor, progressColor, cursorColor]);

  // Sync external playback state with WaveSurfer
  useEffect(() => {
    if (!wavesurferRef.current) return;

    if (isPlaying) {
      // Start animation loop for smooth position updates
      const updatePosition = () => {
        if (!wavesurferRef.current) return;

        const now = Date.now();
        // Throttle updates to 60fps (16.67ms)
        if (now - lastTimeUpdateRef.current >= 16) {
          const time = wavesurferRef.current.getCurrentTime();
          onTimeUpdate?.(time);
          lastTimeUpdateRef.current = now;
        }

        if (isPlaying) {
          animationFrameRef.current = requestAnimationFrame(updatePosition);
        }
      };

      animationFrameRef.current = requestAnimationFrame(updatePosition);
    } else {
      // Stop animation loop
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, onTimeUpdate]);

  // Sync external currentTime with WaveSurfer (for external transport control)
  useEffect(() => {
    if (!wavesurferRef.current || !duration) return;

    // Only seek if the difference is significant (avoid feedback loops)
    const wsTime = wavesurferRef.current.getCurrentTime();
    if (Math.abs(wsTime - currentTime) > 0.1) {
      wavesurferRef.current.seekTo(currentTime / duration);
    }
  }, [currentTime, duration]);

  return (
    <div
      ref={containerRef}
      className={`waveform-visualizer ${className}`}
      style={{
        backgroundColor,
        borderRadius: "4px",
        overflow: "hidden",
      }}
    />
  );
});

export default WaveformVisualizer;
