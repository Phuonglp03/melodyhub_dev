import { useState, useCallback } from "react";
import { addTrack, updateTrack, deleteTrack } from "../services/user/projectService";
import { TRACK_COLOR_PALETTE } from "../utils/projectHelpers";
import { normalizeTracks } from "../utils/timelineHelpers";

/**
 * Hook for managing track operations and state
 * @param {Object} options - Configuration options
 * @param {string} options.projectId - Project ID
 * @param {Array} options.tracks - Current tracks array
 * @param {Function} options.setTracks - Setter for tracks
 * @param {Function} options.pushHistory - Function to push history state
 * @param {Function} options.broadcast - Function to broadcast to collaborators
 * @param {Function} options.refreshProject - Function to refresh project
 * @param {Function} options.setBackingTrack - Setter for backing track
 * @param {Function} options.setFocusedClipId - Setter for focused clip ID
 * @param {string} options.focusedClipId - Currently focused clip ID
 * @param {Array} options.orderedTracks - Ordered tracks array (from computed hook)
 * @returns {Object} Track management state and handlers
 */
export const useProjectTracks = ({
  projectId,
  tracks,
  setTracks,
  pushHistory,
  broadcast,
  refreshProject,
  setBackingTrack,
  setFocusedClipId,
  focusedClipId,
  orderedTracks,
}) => {
  // Track context menu state
  const [trackContextMenu, setTrackContextMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    trackId: null,
  });

  // Add track modal state
  const [addTrackModalOpen, setAddTrackModalOpen] = useState(false);
  const [newTrackName, setNewTrackName] = useState("");
  const [addTrackError, setAddTrackError] = useState(null);
  const [addTrackSuccess, setAddTrackSuccess] = useState(null);

  // Close track menu
  const closeTrackMenu = useCallback(
    () => setTrackContextMenu({ isOpen: false, x: 0, y: 0, trackId: null }),
    []
  );

  // Open track menu
  const openTrackMenu = useCallback((event, track) => {
    event.preventDefault();
    event.stopPropagation();
    const { clientX = 0, clientY = 0, currentTarget } = event;
    let x = clientX;
    let y = clientY;

    if (!x && !y && currentTarget) {
      const rect = currentTarget.getBoundingClientRect();
      x = rect.right;
      y = rect.bottom;
    }

    setTrackContextMenu({
      isOpen: true,
      x,
      y,
      trackId: track._id,
    });
  }, []);

  // Handle add track
  const handleAddTrack = useCallback(() => {
    // Check track limit (max 10 tracks per project)
    if (tracks.length >= 10) {
      setAddTrackError(
        "Maximum of 10 tracks allowed per project. Please remove a track before adding a new one."
      );
      setAddTrackModalOpen(true);
      return;
    }
    setNewTrackName(`New Audio Track ${tracks.length + 1}`);
    setAddTrackError(null);
    setAddTrackSuccess(null);
    setAddTrackModalOpen(true);
  }, [tracks.length]);

  // Handle confirm add track
  const handleConfirmAddTrack = useCallback(async () => {
    if (!newTrackName.trim()) {
      setAddTrackError("Please enter a track name");
      return;
    }

    // Check track limit again
    if (tracks.length >= 10) {
      setAddTrackError(
        "Maximum of 10 tracks allowed per project. Please remove a track before adding a new one."
      );
      return;
    }

    // Default to audio track type
    const trackTypeValue = "audio";
    const isBackingTrack = false;

    try {
      setAddTrackError(null);
      setAddTrackSuccess(null);

      const defaultColor =
        TRACK_COLOR_PALETTE[tracks.length % TRACK_COLOR_PALETTE.length];
      const response = await addTrack(projectId, {
        trackName: newTrackName.trim(),
        isBackingTrack,
        trackType: trackTypeValue,
        color: defaultColor,
      });

      if (response.success) {
        const [normalizedTrack] = normalizeTracks(
          [
            {
              ...response.data,
              isBackingTrack,
              trackType: trackTypeValue,
              color: response.data.color || defaultColor,
            },
          ],
          TRACK_COLOR_PALETTE
        );
        if (normalizedTrack) {
          pushHistory();
          setTracks((prevTracks) => [...prevTracks, normalizedTrack]);

          if (broadcast) {
            broadcast("TRACK_ADD", { track: normalizedTrack });
          }

          setAddTrackSuccess(
            `Track "${newTrackName.trim()}" added successfully!`
          );
          setTimeout(() => {
            setAddTrackModalOpen(false);
            setNewTrackName("");
            setAddTrackSuccess(null);
          }, 1500);
        }
        refreshProject();
      }
    } catch (err) {
      console.error("Error adding track:", err);
      setAddTrackError(err.message || "Failed to add track");
    }
  }, [
    newTrackName,
    tracks.length,
    projectId,
    pushHistory,
    setTracks,
    broadcast,
    refreshProject,
  ]);

  // Handle update track
  const handleUpdateTrack = useCallback(
    async (trackId, updates) => {
      try {
        // Optimistic update - update track in local state immediately
        pushHistory();
        setTracks((prevTracks) =>
          prevTracks.map((track) =>
            track._id === trackId ? { ...track, ...updates } : track
          )
        );

        // Broadcast to collaborators immediately (before API call)
        if (broadcast) {
          broadcast("TRACK_UPDATE", { trackId, updates });
        }

        await updateTrack(projectId, trackId, updates);

        // Silent refresh in background to ensure sync
        refreshProject();
      } catch (err) {
        console.error("Error updating track:", err);
        // Revert on error by refreshing
        refreshProject();
      }
    },
    [projectId, pushHistory, setTracks, broadcast, refreshProject]
  );

  // Handle track rename
  const handleTrackRename = useCallback(
    (track) => {
      if (!track) return;
      closeTrackMenu();
      const newName = prompt("Rename track:", track.trackName || "Track");
      if (!newName) return;
      const trimmed = newName.trim();
      if (!trimmed || trimmed === track.trackName) return;
      handleUpdateTrack(track._id, { trackName: trimmed });
    },
    [closeTrackMenu, handleUpdateTrack]
  );

  // Handle track color change
  const handleTrackColorChange = useCallback(
    (track, color) => {
      if (!track || !color) return;
      handleUpdateTrack(track._id, { color });
    },
    [handleUpdateTrack]
  );

  // Handle track move
  const handleTrackMove = useCallback(
    async (track, direction) => {
      if (!track || !direction) return;
      closeTrackMenu();
      const sorted = [...orderedTracks];
      const currentIndex = sorted.findIndex((t) => t._id === track._id);
      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= sorted.length) return;
      const targetTrack = sorted[targetIndex];
      const currentOrder =
        typeof track.trackOrder === "number" ? track.trackOrder : currentIndex;
      const targetOrder =
        typeof targetTrack.trackOrder === "number"
          ? targetTrack.trackOrder
          : targetIndex;

      pushHistory();
      setTracks((prev) =>
        prev.map((t) => {
          if (t._id === track._id) {
            return { ...t, trackOrder: targetOrder };
          }
          if (t._id === targetTrack._id) {
            return { ...t, trackOrder: currentOrder };
          }
          return t;
        })
      );

      // Broadcast to collaborators immediately (before API call)
      if (broadcast) {
        broadcast("TRACK_UPDATE", {
          trackId: track._id,
          updates: { trackOrder: targetOrder },
        });
        broadcast("TRACK_UPDATE", {
          trackId: targetTrack._id,
          updates: { trackOrder: currentOrder },
        });
      }

      try {
        await Promise.all([
          updateTrack(projectId, track._id, { trackOrder: targetOrder }),
          updateTrack(projectId, targetTrack._id, { trackOrder: currentOrder }),
        ]);

        refreshProject();
      } catch (err) {
        console.error("Error reordering tracks:", err);
        refreshProject();
      }
    },
    [
      orderedTracks,
      closeTrackMenu,
      pushHistory,
      setTracks,
      broadcast,
      projectId,
      refreshProject,
    ]
  );

  // Handle track delete
  const handleTrackDelete = useCallback(
    async (track) => {
      if (!track) return;
      closeTrackMenu();
      if (
        !window.confirm(
          "Delete this track and all of its clips? This action cannot be undone."
        )
      ) {
        return;
      }

      try {
        pushHistory();
        // Optimistic update - remove track from local state immediately
        setTracks((prev) => prev.filter((t) => t._id !== track._id));
        if (track.isBackingTrack) {
          setBackingTrack(null);
        }
        if (
          setFocusedClipId &&
          (track.items || []).some((item) => item._id === focusedClipId)
        ) {
          setFocusedClipId(null);
        }

        // Broadcast to collaborators immediately (before API call)
        if (broadcast) {
          broadcast("TRACK_DELETE", { trackId: track._id });
        }

        await deleteTrack(projectId, track._id);

        refreshProject();
      } catch (err) {
        console.error("Error deleting track:", err);
        refreshProject();
      }
    },
    [
      closeTrackMenu,
      pushHistory,
      setTracks,
      setBackingTrack,
      setFocusedClipId,
      broadcast,
      projectId,
      refreshProject,
    ]
  );

  return {
    // State
    trackContextMenu,
    addTrackModalOpen,
    newTrackName,
    addTrackError,
    addTrackSuccess,
    // Setters
    setAddTrackModalOpen,
    setNewTrackName,
    setAddTrackError,
    setAddTrackSuccess,
    // Handlers
    openTrackMenu,
    closeTrackMenu,
    handleAddTrack,
    handleConfirmAddTrack,
    handleUpdateTrack,
    handleTrackRename,
    handleTrackColorChange,
    handleTrackMove,
    handleTrackDelete,
  };
};

