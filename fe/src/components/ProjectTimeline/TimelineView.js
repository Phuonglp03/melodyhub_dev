import React, { useState, useEffect, useRef } from "react";
import TimelineTrack from "./TimelineTrack";
import ChordBlock from "../ChordBlock";
import CollaboratorCursor from "../Collaboration/CollaboratorCursor";

/**
 * TimelineView - Main timeline container component
 *
 * Props:
 * - tracks: Array - Array of track objects
 * - chordProgression: Array - Array of chord entries
 * - pixelsPerSecond: number - Pixels per second
 * - pixelsPerBeat: number - Pixels per beat
 * - secondsPerBeat: number - Seconds per beat
 * - beatsPerMeasure: number - Beats per measure
 * - timelineWidth: number - Total timeline width
 * - playbackPosition: number - Current playback position
 * - isPlaying: boolean - Whether playback is active
 * - setPlaybackPosition: Function - Setter for playback position
 * - audioEngine: Object - Audio engine instance for seeking during playback
 * - chordDurationSeconds: number - Duration of each chord in seconds
 * - selectedChordIndex: number | null - Currently selected chord index
 * - collaborators: Array - Array of collaborators
 * - broadcastCursor: Function - Function to broadcast cursor position
 * - timelineRef: Ref - Reference to timeline element
 * - playheadRef: Ref - Reference to playhead element
 * - clipRefs: Ref - Map of clip refs
 * - All other props passed to TimelineTrack...
 */
const TimelineView = ({
  tracks = [],
  chordProgression = [],
  pixelsPerSecond,
  pixelsPerBeat,
  secondsPerBeat,
  beatsPerMeasure,
  timelineWidth,
  playbackPosition,
  isPlaying,
  setPlaybackPosition,
  audioEngine,
  chordDurationSeconds,
  selectedChordIndex,
  collaborators = [],
  broadcastCursor,
  timelineRef,
  playheadRef,
  clipRefs,
  TRACK_COLUMN_WIDTH = 256,
  calculateTimelineWidth,
  // Track interaction props
  selectedTrackId,
  setSelectedTrackId,
  dragOverTrack,
  setDragOverTrack,
  dragOverPosition,
  setDragOverPosition,
  focusedClipId,
  setFocusedClipId,
  selectedItem,
  setSelectedItem,
  isDraggingItem,
  draggedLick,
  setDraggedLick,
  activeEditors,
  currentUserId,
  // Handlers
  handleDrop,
  handleClipMouseDown,
  handleClipResizeStart,
  handleOpenMidiEditor,
  handleUpdateTrack,
  handleDeleteTimelineItem,
  handleRemoveChord,
  setSelectedChordIndex,
  openTrackMenu,
  trackContextMenu,
  getRhythmPatternVisual,
  applyMagnet,
  // Additional props
  onTimelineClick,
  hasAnyUserClips,
  userTracksLength,
  onAddTrack,
  canAddTrack,
  ...trackProps
}) => {
  const userTracks = tracks.filter(
    (track) => !track.isBackingTrack && track.trackType !== "backing"
  );

  // Track mouse position for cursor broadcasting
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMouseOverTimeline, setIsMouseOverTimeline] = useState(false);
  const cursorTimeoutRef = useRef(null);

  // Playhead drag state
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const playheadDragStartRef = useRef(null);

  // Handle playhead drag
  useEffect(() => {
    if (!isDraggingPlayhead || !timelineRef?.current || !playheadRef?.current) return;

    const handleMouseMove = (e) => {
      if (!timelineRef.current || !playheadDragStartRef.current) return;

      const timelineRect = timelineRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current.scrollLeft || 0;
      
      // Calculate mouse X position relative to timeline (accounting for track column)
      const mouseX = e.clientX - timelineRect.left + scrollLeft;
      const timelineX = mouseX - TRACK_COLUMN_WIDTH;
      
      // Convert pixel position to time in seconds
      const newPosition = Math.max(0, timelineX / pixelsPerSecond);
      
      // Update playback position
      if (setPlaybackPosition) {
        setPlaybackPosition(newPosition);
      }
      
      // If playing, also update audio engine position
      if (isPlaying && audioEngine) {
        audioEngine.setPosition(newPosition);
      }
      
      // Update playhead visual position directly for smooth dragging
      if (playheadRef.current) {
        playheadRef.current.style.left = `${TRACK_COLUMN_WIDTH + newPosition * pixelsPerSecond}px`;
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      playheadDragStartRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingPlayhead, timelineRef, playheadRef, pixelsPerSecond, TRACK_COLUMN_WIDTH, setPlaybackPosition, isPlaying, audioEngine]);

  // Handle playhead mouse down
  const handlePlayheadMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!timelineRef?.current) return;
    
    const timelineRect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft || 0;
    const mouseX = e.clientX - timelineRect.left + scrollLeft;
    
    playheadDragStartRef.current = {
      startX: mouseX,
      startPosition: playbackPosition,
    };
    
    setIsDraggingPlayhead(true);
  };

  // Broadcast cursor position when mouse moves
  useEffect(() => {
    if (!broadcastCursor || !isMouseOverTimeline || isDraggingPlayhead) return;

    const handleMouseMove = (e) => {
      if (!timelineRef?.current || isDraggingPlayhead) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setMousePosition({ x, y });

      // Calculate bar index from x position
      const TRACK_COLUMN_WIDTH = 256;
      const timelineX = x - TRACK_COLUMN_WIDTH;
      if (timelineX > 0 && pixelsPerBeat) {
        const barIndex = Math.floor(
          timelineX / (pixelsPerBeat * beatsPerMeasure)
        );

        // Throttle cursor broadcasts (every 100ms)
        if (cursorTimeoutRef.current) {
          clearTimeout(cursorTimeoutRef.current);
        }
        cursorTimeoutRef.current = setTimeout(() => {
          if (broadcastCursor) {
            // Get absolute position for cursor display
            const absoluteX = e.clientX;
            const absoluteY = e.clientY;
            broadcastCursor(null, barIndex, absoluteX, absoluteY);
          }
        }, 100);
      }
    };

    const handleMouseEnter = () => {
      setIsMouseOverTimeline(true);
    };

    const handleMouseLeave = () => {
      setIsMouseOverTimeline(false);
      // Clear cursor when mouse leaves
      if (broadcastCursor) {
        broadcastCursor(null, null);
      }
    };

    const timelineElement = timelineRef?.current;
    if (timelineElement) {
      timelineElement.addEventListener("mousemove", handleMouseMove);
      timelineElement.addEventListener("mouseenter", handleMouseEnter);
      timelineElement.addEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      if (timelineElement) {
        timelineElement.removeEventListener("mousemove", handleMouseMove);
        timelineElement.removeEventListener("mouseenter", handleMouseEnter);
        timelineElement.removeEventListener("mouseleave", handleMouseLeave);
      }
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [
    broadcastCursor,
    isMouseOverTimeline,
    isDraggingPlayhead,
    pixelsPerBeat,
    beatsPerMeasure,
    timelineRef,
  ]);

  // Get other collaborators (excluding current user) with cursor positions
  const collaboratorCursors = React.useMemo(() => {
    return collaborators
      .filter((collab) => {
        const collaboratorId =
          collab.userId || collab._id || collab.user?._id || collab.user?.id;
        const hasCursor =
          collab.cursor?.position || collab.cursor?.barIndex !== undefined;
        return (
          collaboratorId &&
          String(collaboratorId) !== String(currentUserId) &&
          hasCursor
        );
      })
      .map((collab) => {
        const cursorPos = collab.cursor?.position;
        if (!cursorPos || !timelineRef?.current) return null;

        const rect = timelineRef.current.getBoundingClientRect();
        // Convert absolute position to relative position within timeline
        const relativeX = cursorPos.x - rect.left;
        const relativeY = cursorPos.y - rect.top;

        // Only show cursor if it's within timeline bounds
        if (
          relativeX >= 0 &&
          relativeX <= rect.width &&
          relativeY >= 0 &&
          relativeY <= rect.height
        ) {
          return {
            collaborator: collab,
            position: { x: relativeX, y: relativeY },
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [collaborators, currentUserId, timelineRef]);

  return (
    <div
      ref={timelineRef}
      className="flex-1 overflow-auto relative min-w-0"
      onClick={onTimelineClick}
    >
      {/* Render collaborator cursors */}
      {collaboratorCursors.map(({ collaborator, position }) => (
        <CollaboratorCursor
          key={collaborator.userId || collaborator._id}
          collaborator={collaborator}
          position={position}
        />
      ))}
      {/* Time Ruler with Beat Markers */}
      <div className="sticky top-0 z-20 flex">
        <div className="w-64 bg-gray-950 border-r border-gray-800 h-6 flex items-center px-4 text-xs font-semibold uppercase tracking-wide text-gray-400 sticky left-0 z-20">
          Track
        </div>
        <div className="flex-1 relative bg-gray-800 border-b border-gray-700 h-6 flex items-end">
          {/* Measure markers (every 4 beats) */}
          {Array.from({
            length:
              Math.ceil(timelineWidth / pixelsPerBeat / beatsPerMeasure) + 1,
          }).map((_, measureIndex) => {
            const measureTime = measureIndex * beatsPerMeasure * secondsPerBeat;
            const measurePosition = measureTime * pixelsPerSecond;
            return (
              <div
                key={`measure-${measureIndex}`}
                className="absolute border-l-2 border-blue-400/80 h-full flex items-end pb-1"
                style={{ left: `${measurePosition}px` }}
              >
                <span className="text-[11px] text-blue-200 font-medium px-1">
                  {measureIndex + 1}
                </span>
              </div>
            );
          })}

          {/* Beat markers */}
          {Array.from({
            length:
              Math.ceil(
                (calculateTimelineWidth
                  ? calculateTimelineWidth()
                  : timelineWidth) / pixelsPerBeat
              ) + 1,
          }).map((_, beatIndex) => {
            const beatTime = beatIndex * secondsPerBeat;
            const beatPosition = beatTime * pixelsPerSecond;
            const isMeasureStart = beatIndex % beatsPerMeasure === 0;
            return (
              <div
                key={`beat-${beatIndex}`}
                className={`absolute border-l h-full ${
                  isMeasureStart ? "border-blue-400/60" : "border-gray-700/50"
                }`}
                style={{ left: `${beatPosition}px` }}
              />
            );
          })}

          {/* Second markers */}
          {Array.from({
            length:
              Math.ceil(
                (calculateTimelineWidth
                  ? calculateTimelineWidth()
                  : timelineWidth) / pixelsPerSecond
              ) + 1,
          }).map((_, i) => (
            <div
              key={`sec-${i}`}
              className="absolute border-l border-gray-800/70 h-4 bottom-0"
              style={{ left: `${i * pixelsPerSecond}px` }}
            />
          ))}
        </div>
      </div>

      {/* Playhead */}
      {(playbackPosition > 0 || isPlaying) && (
        <div
          ref={playheadRef}
          className="absolute top-0 bottom-0 w-[2px] bg-orange-400 z-30 cursor-ew-resize shadow-[0_0_14px_rgba(251,191,36,0.6)]"
          style={{
            left: `${
              TRACK_COLUMN_WIDTH + playbackPosition * pixelsPerSecond
            }px`,
          }}
          onMouseDown={handlePlayheadMouseDown}
        >
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-orange-400 rounded-full border border-white cursor-ew-resize" />
        </div>
      )}

      {/* Master Chord Track */}
      <div
        className="flex border-b border-gray-800/50 bg-gray-950/50"
        style={{ minHeight: "56px" }}
      >
        <div className="w-64 border-r border-gray-800/50 px-3 py-2 bg-gray-950 sticky left-0 z-20 flex flex-col justify-center">
          <span className="text-[11px] font-medium text-gray-300 uppercase tracking-wide">
            Structure
          </span>
        </div>
        <div className="flex-1 relative min-w-0 bg-gray-950/30">
          {chordProgression.map((chord, idx) => {
            const startTime = idx * chordDurationSeconds;
            const width = chordDurationSeconds * pixelsPerSecond;
            const isSelected = selectedChordIndex === idx;
            const chordName = chord.chordName || chord.chord || "Chord";

            return (
              <div
                key={`chord-${idx}`}
                className="absolute inset-0"
                style={{
                  left: `${startTime * pixelsPerSecond}px`,
                  width: `${Math.max(width, 40)}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log("(NO $) [DEBUG][ChordEdit] Chord clicked in timeline:", {
                    index: idx,
                    chordName,
                    isSelected,
                  });
                  console.log("(NO $) [DEBUG][ChordEdit] Calling setSelectedChordIndex with:", idx);
                  if (setSelectedChordIndex) {
                    setSelectedChordIndex(idx);
                    console.log("(NO $) [DEBUG][ChordEdit] setSelectedChordIndex called successfully");
                  } else {
                    console.warn("(NO $) [DEBUG][ChordEdit] setSelectedChordIndex is not available");
                  }
                  if (broadcastCursor) {
                    broadcastCursor(null, idx);
                  }
                }}
              >
                {/* Remote cursor indicators */}
                {collaborators
                  .filter((c) => c.cursor?.barIndex === idx)
                  .map((collab) => (
                    <div
                      key={collab.userId}
                      className="absolute -top-1 -right-1 z-30 flex items-center gap-1 bg-green-500/90 text-black text-[8px] px-1.5 py-0.5 rounded-full border border-white/50 shadow-lg"
                    >
                      {collab.user?.avatarUrl ? (
                        <img
                          src={collab.user.avatarUrl}
                          alt={collab.user.displayName}
                          className="w-3 h-3 rounded-full"
                        />
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                      )}
                      <span className="font-semibold">
                        {collab.user?.displayName ||
                          collab.user?.username ||
                          "User"}
                      </span>
                    </div>
                  ))}
                <div
                  className={`relative ${
                    collaborators.some((c) => c.cursor?.barIndex === idx)
                      ? "ring-2 ring-green-500/50 ring-offset-1 ring-offset-gray-950"
                      : ""
                  }`}
                >
                  <ChordBlock chordName={chordName} isSelected={isSelected} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. USER TRACKS (Licks/Audio) */}
      {userTracks.map((track) => (
        <TimelineTrack
          key={track._id}
          track={track}
          pixelsPerSecond={pixelsPerSecond}
          secondsPerBeat={secondsPerBeat}
          timelineRef={timelineRef}
          clipRefs={clipRefs}
          selectedTrackId={selectedTrackId}
          dragOverTrack={dragOverTrack}
          dragOverPosition={dragOverPosition}
          focusedClipId={focusedClipId}
          selectedItem={selectedItem}
          isDraggingItem={isDraggingItem}
          activeEditors={activeEditors}
          currentUserId={currentUserId}
          getRhythmPatternVisual={getRhythmPatternVisual}
          applyMagnet={applyMagnet}
          handleDrop={handleDrop}
          setDraggedLick={setDraggedLick}
          handleClipMouseDown={handleClipMouseDown}
          handleClipResizeStart={handleClipResizeStart}
          handleOpenMidiEditor={handleOpenMidiEditor}
          handleUpdateTrack={handleUpdateTrack}
          handleDeleteTimelineItem={handleDeleteTimelineItem}
          handleRemoveChord={handleRemoveChord}
          setFocusedClipId={setFocusedClipId}
          setSelectedItem={setSelectedItem}
          setSelectedTrackId={setSelectedTrackId}
          openTrackMenu={openTrackMenu}
          trackContextMenu={trackContextMenu}
          {...trackProps}
        />
      ))}

      {/* Add Track Button - Under the last track */}
      {onAddTrack && (
        <div
          className="flex border-b border-gray-900 bg-[#05070d]"
          style={{ minHeight: "90px" }}
        >
          <div className="w-64 border-r border-gray-800/50 p-2 flex items-center justify-center sticky left-0 z-10 bg-[#05060d]">
            <button
              onClick={onAddTrack}
              disabled={!canAddTrack}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                !canAddTrack
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-500 text-white"
              }`}
              title={
                !canAddTrack
                  ? "Maximum of 10 tracks allowed per project"
                  : "Add a new track"
              }
            >
              <span>+</span>
              Add Track
            </button>
          </div>
          <div className="flex-1 bg-[#05070d]"></div>
        </div>
      )}

      {!hasAnyUserClips && !draggedLick && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-gray-900/85 border border-gray-800 rounded-lg px-6 py-3 text-gray-300 text-sm text-center">
            Drag licks or chords onto any track to build your arrangement
          </div>
        </div>
      )}

      {/* Drop Zone Hint */}
      {draggedLick && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800/90 border border-gray-700 rounded-lg px-6 py-3 text-gray-300 text-sm">
          Drag and drop a loop or audio/MIDI file here
        </div>
      )}
    </div>
  );
};

export default TimelineView;
