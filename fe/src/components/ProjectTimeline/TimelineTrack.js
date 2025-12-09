import React from "react";
import { FaEllipsisV } from "react-icons/fa";
import TimelineClip from "./TimelineClip";
import TrackDropZone from "./TrackDropZone";
import { formatTrackTitle, formatLabelValue } from "../../utils/projectHelpers";

/**
 * TimelineTrack - Renders a single track row on the timeline
 *
 * Props:
 * - track: Object - Track data
 * - pixelsPerSecond: number - Pixels per second for timeline
 * - secondsPerBeat: number - Seconds per beat
 * - timelineRef: Ref - Reference to timeline element
 * - selectedTrackId: string | null - Currently selected track ID
 * - dragOverTrack: string | null - Track being dragged over
 * - dragOverPosition: number | null - Position being dragged over
 * - focusedClipId: string | null - Currently focused clip ID
 * - selectedItem: string | null - Currently selected item ID
 * - isDraggingItem: boolean - Whether an item is being dragged
 * - activeEditors: Map - Map of active editors by itemId
 * - currentUserId: string - Current user ID
 * - getRhythmPatternVisual: Function - Function to get rhythm pattern visual
 * - applyMagnet: Function - Function to apply magnetic snapping
 * - handleDrop: Function - Function to handle drop
 * - setDraggedLick: Function - Setter for dragged lick
 * - handleClipMouseDown: Function - Clip mouse down handler
 * - handleClipResizeStart: Function - Clip resize start handler
 * - handleOpenMidiEditor: Function - Open MIDI editor handler
 * - handleUpdateTrack: Function - Update track handler
 * - handleDeleteTimelineItem: Function - Delete timeline item handler
 * - handleRemoveChord: Function - Remove chord handler
 * - setFocusedClipId: Function - Set focused clip ID
 * - setSelectedItem: Function - Set selected item
 * - setSelectedTrackId: Function - Set selected track ID
 * - openTrackMenu: Function - Open track context menu
 * - trackContextMenu: Object - Track context menu state
 * - clipRefs: Ref - Map of clip refs
 * - className?: string - Optional custom classes
 */
const TimelineTrack = ({
  track,
  pixelsPerSecond,
  secondsPerBeat,
  timelineRef,
  selectedTrackId,
  dragOverTrack,
  dragOverPosition,
  focusedClipId,
  selectedItem,
  isDraggingItem,
  activeEditors,
  currentUserId,
  getRhythmPatternVisual,
  applyMagnet,
  handleDrop,
  setDraggedLick,
  handleClipMouseDown,
  handleClipResizeStart,
  handleOpenMidiEditor,
  handleUpdateTrack,
  handleDeleteTimelineItem,
  handleRemoveChord,
  setFocusedClipId,
  setSelectedItem,
  setSelectedTrackId,
  openTrackMenu,
  trackContextMenu,
  clipRefs,
  className = "",
}) => {
  const isHoveringTrack = dragOverTrack === track._id;
  const isMenuOpen =
    trackContextMenu?.isOpen && trackContextMenu?.trackId === track._id;
  const trackAccent = track.color || "#2563eb";
  const readableTrackName = formatTrackTitle(track.trackName || "Track");
  const trackHasClips = (track.items || []).length > 0;
  const trackRowBg = isHoveringTrack
    ? "bg-gray-900/40"
    : trackHasClips
    ? "bg-[#0b0f1b]"
    : "bg-[#05070d]";

  const timelineItems = (track.items || []).sort(
    (a, b) => (a.startTime || 0) - (b.startTime || 0)
  );

  return (
    <div
      className={`flex border-b border-gray-900 ${trackRowBg} ${className}`}
      style={{ minHeight: "90px" }}
    >
      {/* Track Header */}
      <div
        className={`w-64 border-r border-gray-800/50 p-2 flex flex-col gap-1.5 sticky left-0 z-10 ${
          isMenuOpen
            ? "bg-gray-800/80"
            : isHoveringTrack
            ? "bg-gray-900/80"
            : trackHasClips
            ? "bg-gray-950"
            : "bg-[#05060d]"
        }`}
        style={{
          minHeight: "inherit",
          borderLeft: `4px solid ${trackAccent}`,
        }}
        onContextMenu={(e) => openTrackMenu?.(e, track)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedTrackId?.(track._id);
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: trackAccent,
                boxShadow:
                  selectedTrackId === track._id
                    ? `0 0 8px ${trackAccent}`
                    : "none",
              }}
            />
            <span
              className={`text-sm font-medium truncate ${
                selectedTrackId === track._id
                  ? "text-orange-400"
                  : "text-gray-200"
              }`}
            >
              {readableTrackName}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              className="text-gray-500 hover:text-white p-1 rounded"
              title="Track options"
              onClick={(e) => openTrackMenu?.(e, track)}
            >
              <FaEllipsisV size={12} />
            </button>
            <button
              onClick={() =>
                handleUpdateTrack?.(track._id, { muted: !track.muted })
              }
              className={`w-6 h-6 rounded text-xs font-bold ${
                track.muted
                  ? "bg-red-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
              title="Mute"
            >
              M
            </button>
            <button
              onClick={() =>
                handleUpdateTrack?.(track._id, { solo: !track.solo })
              }
              className={`w-6 h-6 rounded text-xs font-bold ${
                track.solo
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
              title="Solo"
            >
              S
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={track.volume}
            onChange={(e) =>
              handleUpdateTrack?.(track._id, {
                volume: parseFloat(e.target.value),
              })
            }
            className="flex-1 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
            style={{ accentColor: trackAccent }}
          />
        </div>
      </div>

      {/* Track Drop Zone */}
      <TrackDropZone
        trackId={track._id}
        track={track}
        timelineRef={timelineRef}
        pixelsPerSecond={pixelsPerSecond}
        secondsPerBeat={secondsPerBeat}
        applyMagnet={applyMagnet}
        handleDrop={handleDrop}
        setDraggedLick={setDraggedLick}
        className="relative flex-1"
        style={{
          backgroundColor: isHoveringTrack
            ? "rgba(255,255,255,0.04)"
            : "transparent",
        }}
      >
        {/* Wavy Background Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              rgba(255,255,255,0.1) 10px,
              rgba(255,255,255,0.1) 20px
            )`,
          }}
        />

        {/* Timeline Clips */}
        {timelineItems.map((item) => {
          const isSelected =
            focusedClipId === item._id || selectedItem === item._id;
          const activeEditor = activeEditors?.get(item._id);

          return (
            <TimelineClip
              key={item._id}
              item={item}
              track={track}
              pixelsPerSecond={pixelsPerSecond}
              isSelected={isSelected}
              isDragging={isDraggingItem && selectedItem === item._id}
              activeEditor={activeEditor}
              currentUserId={currentUserId}
              getRhythmPatternVisual={getRhythmPatternVisual}
              onMouseDown={handleClipMouseDown}
              onDoubleClick={handleOpenMidiEditor}
              onClick={setFocusedClipId}
              onDelete={(itemId, isVirtualChord) => {
                setFocusedClipId((prev) => (prev === itemId ? null : prev));
                if (isVirtualChord) {
                  handleRemoveChord?.(itemId);
                } else {
                  handleDeleteTimelineItem?.(itemId);
                }
              }}
              onResizeStart={handleClipResizeStart}
              clipRef={(el) => {
                if (el) {
                  clipRefs?.current?.set(item._id, el);
                } else {
                  clipRefs?.current?.delete(item._id);
                }
              }}
            />
          );
        })}

        {/* Drop Zone Indicator */}
        {dragOverTrack === track._id && dragOverPosition !== null && (
          <div
            className="absolute top-0 bottom-0 border-2 border-dashed border-orange-500 bg-orange-500/10"
            style={{
              left: `${dragOverPosition * pixelsPerSecond}px`,
              width: "100px",
            }}
          />
        )}
      </TrackDropZone>
    </div>
  );
};

export default TimelineTrack;
