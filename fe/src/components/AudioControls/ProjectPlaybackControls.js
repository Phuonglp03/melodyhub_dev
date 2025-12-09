import React from "react";
import { AudioTransportControls } from "../audio";
import { RiPulseFill } from "react-icons/ri";

/**
 * ProjectPlaybackControls - Playback controls for project with metronome
 *
 * Props:
 * - isPlaying: boolean - current playback state
 * - loopEnabled: boolean - whether loop is enabled
 * - metronomeEnabled: boolean - whether metronome is enabled
 * - formattedPlayTime: string - formatted playback time (e.g., "0:00.0")
 * - onPlay: () => void - callback for play
 * - onPause: () => void - callback for pause
 * - onStop: () => void - callback for stop
 * - onReturnToStart: () => void - callback for return to start
 * - onLoopToggle: () => void - callback for loop toggle
 * - onMetronomeToggle: () => void - callback for metronome toggle
 * - className?: string - optional custom classes for the container
 */
const ProjectPlaybackControls = ({
  isPlaying = false,
  loopEnabled = false,
  metronomeEnabled = false,
  formattedPlayTime = "0:00.0",
  onPlay,
  onPause,
  onStop,
  onReturnToStart,
  onLoopToggle,
  onMetronomeToggle,
  className = "",
}) => {
  const buttonBase =
    "p-1.5 rounded-full transition-all duration-150 hover:bg-gray-800/70";

  const getButtonClass = (isActive) => {
    if (isActive) {
      return `${buttonBase} text-orange-300 bg-orange-500/20 shadow-inner`;
    }
    return `${buttonBase} text-gray-300 hover:text-white`;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <AudioTransportControls
        isPlaying={isPlaying}
        loopEnabled={loopEnabled}
        formattedPlayTime={formattedPlayTime}
        onPlay={onPlay}
        onPause={onPause}
        onStop={onStop}
        onReturnToStart={onReturnToStart}
        onLoopToggle={onLoopToggle}
      />

      {/* Metronome Toggle */}
      <button
        type="button"
        onClick={onMetronomeToggle}
        className={getButtonClass(metronomeEnabled)}
        title="Metronome"
      >
        <RiPulseFill size={14} />
      </button>
    </div>
  );
};

export default ProjectPlaybackControls;
