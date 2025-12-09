import React, { memo, useCallback } from "react";
import { FaPlay, FaPause, FaStop, FaStepBackward, FaSync } from "react-icons/fa";

/**
 * AudioTransportControls - Transport bar for play/pause/stop/loop
 * Extracted from ProjectDetailPage to follow separation of concerns.
 *
 * Props:
 * - isPlaying: boolean - current playback state
 * - loopEnabled: boolean - whether loop is enabled
 * - formattedPlayTime: string - formatted playback time (e.g., "0:00.0")
 * - onPlay: () => void - callback for play
 * - onPause: () => void - callback for pause
 * - onStop: () => void - callback for stop
 * - onReturnToStart: () => void - callback for return to start
 * - onLoopToggle: () => void - callback for loop toggle
 * - className?: string - optional custom classes for the container
 */
const AudioTransportControls = memo(function AudioTransportControls({
  isPlaying = false,
  loopEnabled = false,
  formattedPlayTime = "0:00.0",
  onPlay,
  onPause,
  onStop,
  onReturnToStart,
  onLoopToggle,
  className = "",
}) {
  const handlePlayToggle = useCallback(() => {
    if (isPlaying) {
      onPause?.();
    } else {
      onPlay?.();
    }
  }, [isPlaying, onPlay, onPause]);

  const buttonBase =
    "p-1.5 rounded-full transition-all duration-150 hover:bg-gray-800/70";

  const getButtonClass = (isActive) => {
    if (isActive) {
      return `${buttonBase} text-orange-300 bg-orange-500/20 shadow-inner`;
    }
    return `${buttonBase} text-gray-300 hover:text-white`;
  };

  return (
    <div
      className={[
        "flex items-center gap-1 bg-gray-900/60 border border-gray-800 rounded-full px-3 py-1.5 backdrop-blur-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Return to Start */}
      <button
        type="button"
        onClick={onReturnToStart}
        className={getButtonClass(false)}
        title="Return to start"
      >
        <FaStepBackward size={12} />
      </button>

      {/* Play/Pause Toggle */}
      <button
        type="button"
        onClick={handlePlayToggle}
        className={getButtonClass(isPlaying)}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <FaPause size={12} /> : <FaPlay size={12} />}
      </button>

      {/* Stop */}
      <button
        type="button"
        onClick={onStop}
        className={getButtonClass(false)}
        title="Stop"
      >
        <FaStop size={12} />
      </button>

      {/* Loop Toggle */}
      <button
        type="button"
        onClick={onLoopToggle}
        className={getButtonClass(loopEnabled)}
        title="Loop playback"
      >
        <FaSync size={12} />
      </button>

      {/* Playback Time Display */}
      <div className="text-xs font-mono text-blue-200 px-2">
        {formattedPlayTime}
      </div>
    </div>
  );
});

export default AudioTransportControls;
