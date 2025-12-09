import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  updateTimelineItem,
  bulkUpdateTimelineItems,
  deleteTimelineItem,
  addLickToTimeline,
} from "../services/user/projectService";
import {
  normalizeTimelineItem,
  MIN_CLIP_DURATION,
} from "../utils/timelineHelpers";
import { getChordIndexFromId } from "../utils/timelineHelpers";

/**
 * Hook for managing timeline state and operations
 * @param {string} projectId - Project ID
 * @param {number} bpm - Beats per minute
 * @param {number} zoomLevel - Timeline zoom level
 * @param {Function} broadcast - Collaboration broadcast function
 * @param {Function} pushHistory - History push function
 * @param {Array} chordItems - Chord items for magnet snapping
 * @param {Function} setError - Error setter
 */
export const useProjectTimeline = ({
  projectId,
  bpm = 120,
  zoomLevel = 1,
  broadcast,
  pushHistory,
  chordItems = [],
  setError,
}) => {
  // Timeline state
  const [tracks, setTracks] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, trackId: null });
  const [resizeState, setResizeState] = useState(null);
  const [focusedClipId, setFocusedClipId] = useState(null);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [isSavingTimeline, setIsSavingTimeline] = useState(false);
  const [draggedLick, setDraggedLick] = useState(null);
  const [dragOverTrack, setDragOverTrack] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null);

  // View / playback state (used by ProjectDetailPage)
  const [zoomLevelState, setZoomLevel] = useState(zoomLevel || 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);

  // Refs
  const timelineRef = useRef(null);
  const playheadRef = useRef(null);
  const clipRefs = useRef(new Map());
  const dragStateRef = useRef(null);
  const dirtyTimelineItemsRef = useRef(new Set());
  const saveTimeoutRef = useRef(null);
  const autosaveTimeoutRef = useRef(null);

  // Constants
  const basePixelsPerSecond = 50;
  const TRACK_COLUMN_WIDTH = 256;

  // Calculations
  const secondsPerBeat = useMemo(() => 60 / bpm, [bpm]);
  const pixelsPerSecond = useMemo(
    () => basePixelsPerSecond * zoomLevelState,
    [zoomLevelState]
  );
  const pixelsPerBeat = useMemo(
    () => pixelsPerSecond * secondsPerBeat,
    [pixelsPerSecond, secondsPerBeat]
  );

  // Calculate timeline width based on content
  const calculateTimelineWidth = useCallback(() => {
    let maxTime = 32; // Default 32 seconds
    tracks.forEach((track) => {
      track.items?.forEach((item) => {
        const endTime = item.startTime + item.duration;
        if (endTime > maxTime) maxTime = endTime;
      });
    });
    // Add some padding
    return Math.max(maxTime * pixelsPerSecond + 200, 1000);
  }, [tracks, pixelsPerSecond]);

  // Collect timeline item snapshot for saving
  const collectTimelineItemSnapshot = useCallback(
    (itemId) => {
      if (!itemId) return null;
      for (const track of tracks) {
        const found = (track.items || []).find((item) => item._id === itemId);
        if (found) {
          const normalized = normalizeTimelineItem(found);
          const snapshot = {
            _id: normalized._id,
            startTime: normalized.startTime,
            duration: normalized.duration,
            offset: normalized.offset,
            loopEnabled: normalized.loopEnabled,
            playbackRate: normalized.playbackRate,
            sourceDuration: normalized.sourceDuration,
          };

          // Include chord-related fields for chord timeline items
          if (normalized.type === "chord") {
            if (normalized.chordName !== undefined) {
              snapshot.chordName = normalized.chordName;
            }
            if (normalized.rhythmPatternId !== undefined) {
              snapshot.rhythmPatternId = normalized.rhythmPatternId;
            }
            if (normalized.isCustomized !== undefined) {
              snapshot.isCustomized = normalized.isCustomized;
            }
            if (normalized.customMidiEvents !== undefined) {
              snapshot.customMidiEvents = normalized.customMidiEvents;
            }
          }

          return snapshot;
        }
      }
      return null;
    },
    [tracks]
  );

  // Mark timeline item as dirty (needs saving)
  const markTimelineItemDirty = useCallback((itemId) => {
    dirtyTimelineItemsRef.current.add(itemId);
  }, []);

  // Flush timeline saves to server
  const flushTimelineSaves = useCallback(async () => {
    const ids = Array.from(dirtyTimelineItemsRef.current);
    if (!ids.length) return;

    const snapshots = ids
      .map((id) => collectTimelineItemSnapshot(id))
      .filter((s) => s !== null);

    if (!snapshots.length) return;

    const payload = snapshots;
    setIsSavingTimeline(true);
    dirtyTimelineItemsRef.current.clear();

    try {
      if (broadcast) {
        broadcast("TIMELINE_ITEMS_BULK_UPDATE", { items: payload });
      }

      await bulkUpdateTimelineItems(projectId, payload);
    } catch (error) {
      console.error("Timeline items bulk save failed:", error);
      ids.forEach((id) => dirtyTimelineItemsRef.current.add(id));
    } finally {
      setIsSavingTimeline(false);
    }
  }, [projectId, collectTimelineItemSnapshot, broadcast]);

  // Schedule autosave
  const scheduleTimelineAutosave = useCallback(() => {
    clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => {
      flushTimelineSaves();
    }, 2000);
  }, [flushTimelineSaves]);

  // Snap time to grid and clip edges
  const applyMagnet = useCallback(
    (time, track, itemId) => {
      if (!track) return time;

      const thresholdSeconds = secondsPerBeat * 0.25; // quarter-beat magnetic range
      let closestTime = time;
      let minDelta = thresholdSeconds;

      // Snap to beat grid
      const beatTime = Math.round(time / secondsPerBeat) * secondsPerBeat;
      const beatDelta = Math.abs(beatTime - time);
      if (beatDelta < minDelta) {
        minDelta = beatDelta;
        closestTime = beatTime;
      }

      // Snap to clip edges
      const hasTimelineChords = (track.items || []).some(
        (clip) => clip?.type === "chord"
      );
      const includeVirtualChords =
        (track.trackType === "backing" || track.isBackingTrack) &&
        chordItems?.length &&
        !hasTimelineChords;
      const allItems = includeVirtualChords
        ? [...(track.items || []), ...chordItems]
        : track.items || [];

      allItems.forEach((item) => {
        if (!item || item._id === itemId) return;
        const start = item.startTime || 0;
        const end = start + (item.duration || 0);
        const edges = [start, end];

        edges.forEach((edge) => {
          const delta = Math.abs(edge - time);
          if (delta < minDelta) {
            minDelta = delta;
            closestTime = edge;
          }
        });
      });

      return closestTime;
    },
    [secondsPerBeat, chordItems]
  );

  // Handle clip overlap: Trim overlapping clips
  const handleClipOverlap = useCallback(
    (track, movedItemId, newStartTime, movedDuration) => {
      if (!track) return track;

      const movedItem = track.items?.find((item) => item._id === movedItemId);
      if (!movedItem) return track;

      const movedEnd = newStartTime + movedDuration;
      const updatedItems = (track.items || [])
        .map((item) => {
          if (item._id === movedItemId) {
            // Update the moved item
            return { ...item, startTime: newStartTime };
          }

          const itemStart = item.startTime || 0;
          const itemEnd = itemStart + (item.duration || 0);

          // Check if moved clip overlaps this item
          const overlaps = !(newStartTime >= itemEnd || movedEnd <= itemStart);

          if (overlaps) {
            // Trim the underlying clip
            if (newStartTime > itemStart && newStartTime < itemEnd) {
              // Moved clip starts inside this item - trim the end
              const newDuration = newStartTime - itemStart;
              if (newDuration >= MIN_CLIP_DURATION) {
                return { ...item, duration: newDuration };
              } else {
                // Too small, remove it
                return null;
              }
            } else if (movedEnd > itemStart && movedEnd < itemEnd) {
              // Moved clip ends inside this item - trim the start
              const trimAmount = movedEnd - itemStart;
              const newStart = itemStart + trimAmount;
              const newDuration = item.duration - trimAmount;
              if (newDuration >= MIN_CLIP_DURATION) {
                return {
                  ...item,
                  startTime: newStart,
                  offset: (item.offset || 0) + trimAmount,
                };
              } else {
                // Too small, remove it
                return null;
              }
            } else if (newStartTime <= itemStart && movedEnd >= itemEnd) {
              // Moved clip completely covers this item - remove it
              return null;
            }
          }

          return item;
        })
        .filter(Boolean); // Remove null items

      return {
        ...track,
        items: updatedItems,
      };
    },
    []
  );

  // Handle dropping a lick onto the timeline
  const handleDrop = useCallback(
    async (e, trackId, startTime) => {
      e.preventDefault();

      // Use local state for the currently dragged lick (matches call sites)
      if (!draggedLick) return;

      // Get lick ID - handle different field names
      const lickId = draggedLick._id || draggedLick.lick_id || draggedLick.id;
      if (!lickId) {
        if (setError) setError("Invalid lick: missing ID");
        setDraggedLick(null);
        return;
      }

      // Ensure startTime and duration are numbers
      const numericStartTime =
        typeof startTime === "number" ? startTime : parseFloat(startTime) || 0;
      const numericDuration =
        typeof draggedLick.duration === "number"
          ? draggedLick.duration
          : parseFloat(draggedLick.duration) || 4;

      if (isNaN(numericStartTime) || isNaN(numericDuration)) {
        if (setError) setError("Invalid time values");
        setDraggedLick(null);
        return;
      }

      try {
        const sourceDuration =
          typeof draggedLick.duration === "number"
            ? draggedLick.duration
            : parseFloat(draggedLick.duration) || numericDuration;
        const response = await addLickToTimeline(projectId, {
          trackId: trackId.toString(),
          lickId: lickId.toString(),
          startTime: numericStartTime,
          duration: numericDuration,
          offset: 0,
          sourceDuration,
          loopEnabled: false,
        });

        if (response.success) {
          const rawItem = response.data;
          const uniqueId =
            rawItem._id || rawItem.id || `temp-${Date.now()}-${Math.random()}`;

          const newItem = normalizeTimelineItem({
            ...rawItem,
            _id: uniqueId,
          });

          if (pushHistory) pushHistory();
          setTracks((prevTracks) =>
            prevTracks.map((track) =>
              track._id === trackId
                ? {
                    ...track,
                    items: [...(track.items || []), newItem],
                  }
                : track
            )
          );
          if (setError) setError(null);

          // Broadcast to collaborators
          if (broadcast) {
            broadcast("LICK_ADD_TO_TIMELINE", {
              trackId: trackId.toString(),
              item: newItem,
            });
          }
        } else {
          if (setError)
            setError(response.message || "Failed to add lick to timeline");
        }
      } catch (err) {
        console.error("Error adding lick to timeline:", err);
        let errorMessage = "Failed to add lick to timeline";
        if (err.response?.data) {
          if (
            err.response.data.errors &&
            Array.isArray(err.response.data.errors)
          ) {
            errorMessage = err.response.data.errors
              .map((e) => e.msg || e.message)
              .join(", ");
          } else if (err.response.data.message) {
            errorMessage = err.response.data.message;
          }
        } else if (err.message) {
          errorMessage = err.message;
        }
        if (setError) setError(errorMessage);
      } finally {
        setDraggedLick(null);
      }
    },
    [projectId, broadcast, pushHistory, setError, draggedLick]
  );

  // Handle deleting a timeline item
  const handleDeleteTimelineItem = useCallback(
    async (itemId, { skipConfirm = false, refreshProject } = {}) => {
      if (
        !skipConfirm &&
        !window.confirm(
          "Are you sure you want to remove this lick from the timeline?"
        )
      ) {
        return;
      }

      try {
        // Optimistic update - remove item from local state immediately
        if (pushHistory) pushHistory();
        setTracks((prevTracks) =>
          prevTracks.map((track) => ({
            ...track,
            items: (track.items || []).filter((item) => item._id !== itemId),
          }))
        );

        // Broadcast to collaborators immediately
        if (broadcast) {
          broadcast("TIMELINE_ITEM_DELETE", { itemId });
        }

        await deleteTimelineItem(projectId, itemId);

        // Silent refresh in background to ensure sync
        if (refreshProject) refreshProject();
      } catch (err) {
        console.error("Error deleting timeline item:", err);
        if (setError) setError(err.message || "Failed to delete timeline item");
        // Revert on error by refreshing
        if (refreshProject) refreshProject();
      }
    },
    [projectId, broadcast, pushHistory, setError]
  );

  // Handle moving a clip
  const handleClipMove = useCallback(
    async (itemId, newStartTime, options = {}) => {
      if (newStartTime < 0) return;

      // Only push history if not skipped (e.g., when called from drag handler)
      if (!options.skipHistory && pushHistory) {
        pushHistory();
      }

      // Update state to ensure consistency
      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          const hasClip = (track.items || []).some(
            (item) => item._id === itemId
          );
          if (!hasClip) return track;
          return {
            ...track,
            items: (track.items || []).map((item) =>
              item._id === itemId
                ? normalizeTimelineItem({ ...item, startTime: newStartTime })
                : item
            ),
          };
        })
      );

      // Broadcast position update in real-time
      if (broadcast) {
        broadcast("TIMELINE_ITEM_POSITION_UPDATE", {
          itemId,
          updates: { startTime: newStartTime },
        });
      }

      // mark dirty & schedule autosave
      markTimelineItemDirty(itemId);
      scheduleTimelineAutosave();
    },
    [broadcast, pushHistory, markTimelineItemDirty, scheduleTimelineAutosave]
  );

  // Handle resizing a clip
  const handleClipResize = useCallback(
    async (itemId, updates) => {
      const chordIndex = getChordIndexFromId(itemId);
      if (chordIndex !== null) {
        // Chord blocks have fixed duration for now
        return;
      }

      const sanitized = {};
      if (updates.startTime !== undefined) {
        sanitized.startTime = Math.max(0, updates.startTime);
      }
      if (updates.duration !== undefined) {
        sanitized.duration = Math.max(MIN_CLIP_DURATION, updates.duration);
      }
      if (updates.offset !== undefined) {
        sanitized.offset = Math.max(0, updates.offset);
      }

      if (!Object.keys(sanitized).length) return;

      if (pushHistory) pushHistory();

      // Update state optimistically
      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          const hasClip = (track.items || []).some(
            (item) => item._id === itemId
          );
          if (!hasClip) return track;
          return {
            ...track,
            items: (track.items || []).map((item) =>
              item._id === itemId
                ? normalizeTimelineItem({ ...item, ...sanitized })
                : item
            ),
          };
        })
      );

      // Broadcast update
      if (broadcast) {
        broadcast("TIMELINE_ITEM_POSITION_UPDATE", {
          itemId,
          updates: sanitized,
        });
      }

      // Mark dirty and schedule autosave
      markTimelineItemDirty(itemId);
      scheduleTimelineAutosave();
    },
    [broadcast, pushHistory, markTimelineItemDirty, scheduleTimelineAutosave]
  );

  // Handle clip mouse down (start drag)
  const handleClipMouseDown = useCallback(
    (e, item, trackId) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't start drag if clicking on resize handles or delete button
      if (
        e.target.closest("[data-resize-handle]") ||
        e.target.closest("button")
      ) {
        return;
      }

      setSelectedItem(item._id);
      setFocusedClipId(item._id);

      if (timelineRef.current) {
        const timelineRect = timelineRef.current.getBoundingClientRect();
        const scrollLeft = timelineRef.current.scrollLeft || 0;

        // Where the user clicked in timeline coordinates
        const pointerX = e.clientX - timelineRect.left + scrollLeft;

        // Where the clip currently starts in timeline coordinates
        const itemStartX = (item.startTime || 0) * pixelsPerSecond;

        // How far from the clip's left edge the user clicked (in pixels)
        const clickOffsetX = pointerX - itemStartX;

        // Store the original state for smooth dragging
        dragStateRef.current = {
          originStart: item.startTime || 0,
          originPointerX: pointerX, // Where user clicked (absolute timeline position)
        };

        setDragOffset({
          x: Number.isFinite(clickOffsetX) ? Math.max(0, clickOffsetX) : 0,
          trackId,
        });
      } else {
        dragStateRef.current = {
          originStart: item.startTime || 0,
          originPointerX: 0,
        };
        setDragOffset({ x: 0, trackId: trackId || null });
      }
      setIsDraggingItem(true);
    },
    [pixelsPerSecond]
  );

  // Start clip resize
  const startClipResize = useCallback(
    (e, item, trackId, edge = "right") => {
      e.preventDefault();
      e.stopPropagation();
      if (!item || !trackId) return;
      setFocusedClipId(item._id);
      setSelectedItem(item._id);
      setIsDraggingItem(false);
      if (pushHistory) pushHistory();
      setResizeState({
        clipId: item._id,
        trackId,
        edge,
        originDuration: item.duration || MIN_CLIP_DURATION,
        originStart: item.startTime || 0,
        originOffset: item.offset || 0,
        sourceDuration:
          item.sourceDuration ||
          item.lickId?.duration ||
          (item.offset || 0) + (item.duration || 0),
        startX: e.clientX,
      });
    },
    [pushHistory]
  );

  // Handle clip dragging with smooth real-time updates
  useEffect(() => {
    if (!isDraggingItem || !selectedItem) return;

    let currentItem = null;
    let currentTrack = null;

    const candidateTracks = dragOffset.trackId
      ? tracks.filter((track) => track._id === dragOffset.trackId)
      : tracks;

    candidateTracks.forEach((track) => {
      const item = track.items?.find((i) => i._id === selectedItem);
      if (item) {
        currentItem = item;
        currentTrack = track;
      }
    });

    if (!currentItem || !currentTrack) return;

    const clipElement = clipRefs.current.get(selectedItem);
    if (!clipElement) return;

    const originalZIndex = clipElement.style.zIndex;
    const originalCursor = clipElement.style.cursor;
    clipElement.style.zIndex = "100";
    clipElement.style.cursor = "grabbing";

    // Professional DAW Logic:
    // 1. Record where user clicked INSIDE the clip (offset from clip's left edge)
    // 2. During drag, keep that point under the cursor
    // 3. Only startTime changes, offset and duration stay constant
    const computeNewStartTime = (event) => {
      if (!timelineRef.current || !dragStateRef.current) {
        return currentItem.startTime;
      }
      const timelineElement = timelineRef.current;
      const timelineRect = timelineElement.getBoundingClientRect();
      const scrollLeft = timelineElement.scrollLeft || 0;

      // Current mouse position in timeline coordinates
      const currentPointerX = event.clientX - timelineRect.left + scrollLeft;

      // Where the user originally clicked (in timeline coordinates)
      const originPointerX = dragStateRef.current.originPointerX;

      // How far the mouse has moved
      const deltaX = currentPointerX - originPointerX;

      // Calculate new startTime: original start + mouse movement
      // The click offset (dragOffset.x) is already accounted for in originPointerX
      const newStartTime =
        dragStateRef.current.originStart + deltaX / pixelsPerSecond;

      return Math.max(0, newStartTime);
    };

    const handleMouseMove = (event) => {
      const newStartTime = computeNewStartTime(event);
      const newLeftPixel = newStartTime * pixelsPerSecond;
      clipElement.style.left = `${newLeftPixel}px`;
      // Don't update state here to avoid re-render lag during drag
    };

    const handleMouseUp = async (event) => {
      const newStartTime = computeNewStartTime(event);
      const finalTime = Math.max(0, newStartTime);

      clipElement.style.zIndex = originalZIndex;
      clipElement.style.cursor = originalCursor || "move";

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      // Optional snapping: Hold Shift to disable snapping (like professional DAWs)
      const shouldSnap = !event.shiftKey;
      const finalSnappedTime = shouldSnap
        ? applyMagnet(finalTime, currentTrack, selectedItem)
        : finalTime;

      // Push history once before making changes
      if (pushHistory) pushHistory();

      // Handle clip overlap: Trim overlapping clips (like openDAW/Ableton)
      const trimmedTracks = handleClipOverlap(
        currentTrack,
        selectedItem,
        finalSnappedTime,
        currentItem.duration
      );

      // Update state IMMEDIATELY with overlap handling
      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          if (track._id !== currentTrack._id) return track;
          return trimmedTracks;
        })
      );

      // Final update (this will also save to DB) - don't push history again
      await handleClipMove(selectedItem, finalSnappedTime, {
        skipHistory: true,
      });

      setIsDraggingItem(false);
      setSelectedItem(null);
      setDragOffset({ x: 0, trackId: null });
      dragStateRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      clipElement.style.zIndex = originalZIndex;
      clipElement.style.cursor = originalCursor;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isDraggingItem,
    selectedItem,
    pixelsPerSecond,
    tracks,
    dragOffset,
    applyMagnet,
    handleClipOverlap,
    handleClipMove,
    pushHistory,
  ]);

  // Handle clip resizing
  useEffect(() => {
    if (!resizeState) return;

    const clipElement = clipRefs.current.get(resizeState.clipId);
    if (!clipElement) return;

    const waveformElement = clipElement.querySelector(
      '[data-clip-waveform="true"]'
    );
    const originalStyles = {
      width: clipElement.style.width,
      left: clipElement.style.left,
      waveformLeft: waveformElement?.style.left ?? null,
    };

    const computeResizeValues = (event) => {
      const deltaX = event.clientX - resizeState.startX;
      const deltaSeconds = deltaX / pixelsPerSecond;

      if (resizeState.edge === "left") {
        const lowerBound = Math.max(
          -resizeState.originStart,
          -resizeState.originOffset
        );
        const upperBound = resizeState.originDuration - MIN_CLIP_DURATION;
        const clampedDelta = Math.min(
          Math.max(deltaSeconds, lowerBound),
          upperBound
        );

        const startTime = resizeState.originStart + clampedDelta;
        const duration = Math.max(
          MIN_CLIP_DURATION,
          resizeState.originDuration - clampedDelta
        );
        const offset = Math.max(0, resizeState.originOffset + clampedDelta);

        return {
          startTime,
          duration,
          offset,
          isLeft: true,
        };
      }

      const lowerBound = MIN_CLIP_DURATION - resizeState.originDuration;
      const availableTail =
        (resizeState.sourceDuration || 0) -
        (resizeState.originOffset + resizeState.originDuration);
      const upperBound = Math.max(0, availableTail);
      const clampedDelta = Math.min(
        Math.max(deltaSeconds, lowerBound),
        upperBound
      );
      const duration = Math.max(
        MIN_CLIP_DURATION,
        resizeState.originDuration + clampedDelta
      );

      return {
        duration,
        isLeft: false,
      };
    };

    const handleMouseMove = (event) => {
      const values = computeResizeValues(event);
      if (!values) return;

      if (values.duration !== undefined) {
        clipElement.style.width = `${values.duration * pixelsPerSecond}px`;
      }

      if (values.isLeft && values.startTime !== undefined) {
        clipElement.style.left = `${values.startTime * pixelsPerSecond}px`;

        if (waveformElement && values.offset !== undefined) {
          waveformElement.style.left = `-${values.offset * pixelsPerSecond}px`;
        }
      }
      // Don't update state here to avoid re-render lag during resize
    };

    const handleMouseUp = async (event) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      const finalValues = computeResizeValues(event) || {};
      const clipId = resizeState.clipId;
      setResizeState(null);

      // Update state IMMEDIATELY using functional update to get latest data
      // This ensures we preserve ALL original clip data (waveform, lickId, etc.)
      if (Object.keys(finalValues).length > 0) {
        setTracks((prevTracks) => {
          // Find the current clip with ALL its data from the latest state
          let currentClip = null;
          for (const track of prevTracks) {
            const found = (track.items || []).find(
              (item) => item._id === clipId
            );
            if (found) {
              currentClip = found;
              break;
            }
          }

          if (!currentClip) return prevTracks;

          // Merge updates while preserving ALL original data
          const updatedItem = {
            ...currentClip, // Preserve ALL original data (waveform, lickId, sourceDuration, etc.)
            ...finalValues, // Apply the resize values
          };

          return prevTracks.map((track) => {
            const hasClip = (track.items || []).some(
              (item) => item._id === clipId
            );
            if (!hasClip) return track;
            return {
              ...track,
              items: (track.items || []).map((item) =>
                item._id === clipId ? normalizeTimelineItem(updatedItem) : item
              ),
            };
          });
        });
      }

      // Final update with validation (this will also save to DB)
      // handleClipResize uses functional updates so it will get the latest state
      await handleClipResize(clipId, finalValues);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      // Don't reset styles on cleanup - let React re-render with updated state
      // Resetting styles here causes the "snap back" bug
    };
  }, [resizeState, pixelsPerSecond, handleClipResize]);

  // Check if there are unsaved changes
  const hasUnsavedTimelineChanges = dirtyTimelineItemsRef.current.size > 0;

  return {
    // State
    zoomLevel: zoomLevelState,
    setZoomLevel,
    isPlaying,
    setIsPlaying,
    playbackPosition,
    setPlaybackPosition,
    metronomeEnabled,
    setMetronomeEnabled,
    loopEnabled,
    setLoopEnabled,
    tracks,
    setTracks,
    selectedItem,
    setSelectedItem,
    isDraggingItem,
    setIsDraggingItem,
    dragOffset,
    setDragOffset,
    resizeState,
    setResizeState,
    focusedClipId,
    setFocusedClipId,
    selectedTrackId,
    setSelectedTrackId,
    isSavingTimeline,
    hasUnsavedTimelineChanges,
    draggedLick,
    setDraggedLick,
    dragOverTrack,
    setDragOverTrack,
    dragOverPosition,
    setDragOverPosition,

    // Refs
    timelineRef,
    playheadRef,
    clipRefs,
    dragStateRef,

    // Calculations
    secondsPerBeat,
    pixelsPerSecond,
    pixelsPerBeat,
    calculateTimelineWidth,
    TRACK_COLUMN_WIDTH,

    // Operations
    handleDrop,
    handleClipResize,
    handleClipMove,
    handleDeleteTimelineItem,
    handleClipOverlap,
    applyMagnet,
    handleClipMouseDown,
    startClipResize,

    // Autosave
    markTimelineItemDirty,
    scheduleTimelineAutosave,
    flushTimelineSaves,
  };
};
