import React from "react";
import { FaTimes } from "react-icons/fa";
import MidiClip from "../MidiClip";
import WaveformRenderer from "./WaveformRenderer";
import ActiveEditorsIndicator from "../Collaboration/ActiveEditorsIndicator";
import {
  formatLabelValue,
  getChordMidiEvents,
} from "../../utils/timelineHelpers";
import { formatLabelValue as formatLabel } from "../../utils/projectHelpers";

/**
 * TimelineClip - Renders a single clip on the timeline
 * 
 * Props:
 * - item: Object - Timeline item/clip data
 * - track: Object - Track containing this clip
 * - pixelsPerSecond: number - Pixels per second for timeline
 * - isSelected: boolean - Whether clip is selected
 * - isDragging: boolean - Whether clip is being dragged
 * - activeEditor: Object | null - Active editor info if someone is editing
 * - currentUserId: string - Current user ID
 * - getRhythmPatternVisual: Function - Function to get rhythm pattern visual
 * - onMouseDown: Function - Mouse down handler
 * - onDoubleClick: Function - Double click handler
 * - onClick: Function - Click handler
 * - onDelete: Function - Delete handler
 * - onResizeStart: Function - Resize start handler
 * - clipRef: Function - Ref callback for clip element
 * - className?: string - Optional custom classes
 */
const TimelineClip = ({
  item,
  track,
  pixelsPerSecond,
  isSelected = false,
  isDragging = false,
  activeEditor = null,
  currentUserId,
  getRhythmPatternVisual,
  onMouseDown,
  onDoubleClick,
  onClick,
  onDelete,
  onResizeStart,
  clipRef,
  className = "",
}) => {
  // Calculate Dimensions & Position
  const clipWidth = item.duration * pixelsPerSecond;
  const clipLeft = item.startTime * pixelsPerSecond;

  // Determine Labels
  const isVirtualChord =
    typeof item._id === "string" && item._id.startsWith("chord-");
  const isTimelineChord = item.type === "chord" && !isVirtualChord;
  const isChord =
    isTimelineChord ||
    isVirtualChord ||
    item._isChord ||
    (item.chord &&
      (track.trackType === "backing" || track.isBackingTrack) &&
      !item.lickId);

  const readableTrackName = track.trackName || "Track";
  const mainLabel = isChord
    ? item.chordName || item.chord || "Chord"
    : formatLabel(item.lickId?.title) ||
      formatLabel(item.title) ||
      formatLabel(item.name) ||
      formatLabel(item.trackName) ||
      readableTrackName ||
      "Clip";

  const trackInstrumentLabel =
    formatLabel(track.instrumentStyle) ||
    formatLabel(track.instrument) ||
    (track.isBackingTrack ? "Backing Instrument" : "") ||
    readableTrackName;
  const instrumentLabel =
    formatLabel(item.instrumentStyle) || trackInstrumentLabel;

  const subLabel = isChord
    ? (() => {
        const rhythmVisual = getRhythmPatternVisual?.(item);
        const patternLabel = rhythmVisual?.label || null;
        const formattedPatternLabel = formatLabel(patternLabel);
        return [formattedPatternLabel, instrumentLabel]
          .filter((label) => label && label.trim())
          .join(" • ");
      })()
    : instrumentLabel || readableTrackName || null;

  const trackAccent = track.color || "#2563eb";
  const isMuted = Boolean(track.muted || item.muted);
  const isBeingEdited = activeEditor && activeEditor.userId !== currentUserId;

  // Prepare MIDI data
  let itemWithMidi = { ...item };
  if (isChord) {
    const rhythmVisual = getRhythmPatternVisual?.(item);
    const patternSteps = rhythmVisual?.steps || [];
    const chordMidiEvents = getChordMidiEvents(
      item,
      item.duration,
      patternSteps
    );
    itemWithMidi = {
      ...item,
      customMidiEvents: chordMidiEvents,
    };
  } else {
    if (!item.customMidiEvents || item.customMidiEvents.length === 0) {
      if (item.midiNotes && Array.isArray(item.midiNotes) && item.midiNotes.length > 0) {
        const duration = item.duration || 1;
        itemWithMidi = {
          ...item,
          customMidiEvents: item.midiNotes.map((pitch) => ({
            pitch: Number(pitch),
            startTime: 0,
            duration: duration,
            velocity: 0.8,
          })),
        };
      } else if (
        item.lickId?.midiNotes &&
        Array.isArray(item.lickId.midiNotes) &&
        item.lickId.midiNotes.length > 0
      ) {
        const duration = item.duration || 1;
        itemWithMidi = {
          ...item,
          customMidiEvents: item.lickId.midiNotes.map((pitch) => ({
            pitch: Number(pitch),
            startTime: 0,
            duration: duration,
            velocity: 0.8,
          })),
        };
      }
    }
  }

  // Show waveform for licks OR chord items with generated audio
  const showWaveform =
    (item.type === "lick" && item.lickId?.waveformData) ||
    (item.type === "chord" &&
      (item.waveformData || item.audioUrl || item.lickId?.waveformData));
  const showResizeHandles = !isVirtualChord;

  // Calculate loop notches
  const loopSegmentDuration =
    item.loopEnabled && item.sourceDuration ? item.sourceDuration : null;
  const loopRepeats =
    loopSegmentDuration && loopSegmentDuration > 0
      ? Math.floor(item.duration / loopSegmentDuration)
      : 0;
  const loopNotches = Math.max(0, loopRepeats - 1);

  return (
    <div
      ref={clipRef}
      className={`absolute rounded-md overflow-hidden cursor-pointer group border ${
        isSelected
          ? "border-yellow-400 shadow-md z-50"
          : isBeingEdited
          ? "border-blue-400 shadow-lg z-40"
          : "border-transparent z-10"
      } ${className}`}
      style={{
        left: `${clipLeft}px`,
        width: `${clipWidth}px`,
        top: "4px",
        bottom: "4px",
        height: "auto",
        backgroundColor: trackAccent,
        opacity:
          isDragging && isSelected
            ? 0.8
            : isMuted
            ? 0.45
            : 1,
        filter: isMuted ? "grayscale(0.35)" : undefined,
        transition:
          isDragging && isSelected ? "none" : "left 0.1s, width 0.1s",
      }}
      onMouseDown={(e) => onMouseDown?.(e, item, track._id)}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(item._id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(item);
      }}
    >
      {/* Active Editor Indicator */}
      {isBeingEdited && activeEditor && (
        <ActiveEditorsIndicator
          activeEditors={new Map([[item._id, activeEditor]])}
          itemId={item._id}
        />
      )}

      {/* Data Layer - Waveform or MIDI */}
      <div className="absolute inset-0 w-full h-full">
        {showWaveform ? (
          <WaveformRenderer
            waveformData={
              item.waveformData ||
              item.lickId?.waveformData ||
              null
            }
            clipWidth={clipWidth}
            itemOffset={item.offset || 0}
            itemDuration={item.duration || 0}
            sourceDuration={
              item.sourceDuration ||
              item.lickId?.duration ||
              item.duration ||
              1
            }
          />
        ) : (
          <MidiClip
            data={itemWithMidi}
            width={clipWidth}
            height={82}
            color={trackAccent}
            isSelected={isSelected}
            isMuted={isMuted}
          />
        )}
        {/* Always render MidiClip behind waveform if both exist */}
        {showWaveform &&
          (itemWithMidi.customMidiEvents?.length > 0 ||
            itemWithMidi.midiNotes?.length > 0) && (
            <MidiClip
              data={itemWithMidi}
              width={clipWidth}
              height={82}
              color={trackAccent}
              isSelected={isSelected}
              isMuted={isMuted}
            />
          )}
      </div>

      {/* Header Text */}
      <div className="absolute top-0 left-0 right-0 h-6 px-2 flex items-center gap-2 pointer-events-none">
        <span className="text-[11px] font-bold text-white truncate drop-shadow-md">
          {mainLabel}
        </span>
        {clipWidth > 80 && subLabel && (
          <span className="text-[10px] text-white/70 truncate">{subLabel}</span>
        )}
        {loopNotches > 0 && (
          <div className="flex items-center gap-0.5 ml-auto">
            {Array.from({ length: loopNotches }).map((_loop, notchIdx) => (
              <span
                key={`loop-notch-${item._id}-${notchIdx}`}
                className="w-1 h-2 rounded-sm bg-white/70"
              />
            ))}
          </div>
        )}
      </div>

      {/* Resize Handles */}
      {showResizeHandles && (
        <>
          <div
            data-resize-handle="left"
            className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-white/25 z-20 transition-colors border-r border-white/20"
            onMouseDown={(e) => onResizeStart?.(e, item, track._id, "left")}
          />
          <div
            data-resize-handle="right"
            className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-white/25 z-20 transition-colors border-l border-white/20"
            onMouseDown={(e) => onResizeStart?.(e, item, track._id, "right")}
          />
        </>
      )}

      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.(item._id, isVirtualChord);
        }}
        className={`absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-white/50 hover:text-white hover:bg-red-500/80 rounded z-30 transition-opacity ${
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <FaTimes size={10} />
      </button>
    </div>
  );
};

export default TimelineClip;







