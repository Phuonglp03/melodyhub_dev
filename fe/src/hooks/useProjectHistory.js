import { useState, useRef, useCallback } from "react";
import {
  HISTORY_LIMIT,
  cloneTracksForHistory,
  cloneChordsForHistory,
} from "../utils/projectHelpers";

/**
 * Hook for managing undo/redo history
 * @param {Array} tracks - Current tracks
 * @param {Array} chordProgression - Current chord progression
 * @param {Function} setTracks - Tracks setter
 * @param {Function} setChordProgression - Chord progression setter
 * @param {Function} setSelectedItem - Selected item setter
 * @param {Function} setFocusedClipId - Focused clip ID setter
 */
export const useProjectHistory = ({
  tracks,
  chordProgression,
  setTracks,
  setChordProgression,
  setSelectedItem,
  setFocusedClipId,
}) => {
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const [historyStatus, setHistoryStatus] = useState({
    canUndo: false,
    canRedo: false,
  });

  // Update history status
  const updateHistoryStatus = useCallback(() => {
    setHistoryStatus({
      canUndo: historyRef.current.length > 0,
      canRedo: futureRef.current.length > 0,
    });
  }, []);

  // Push current state to history
  const pushHistory = useCallback(() => {
    const snapshot = {
      tracks: cloneTracksForHistory(tracks),
      chordProgression: cloneChordsForHistory(chordProgression),
    };
    historyRef.current = [...historyRef.current, snapshot].slice(
      -HISTORY_LIMIT
    );
    // Clear future when new action is performed
    futureRef.current = [];
    updateHistoryStatus();
  }, [tracks, chordProgression, updateHistoryStatus]);

  // Undo
  const handleUndo = useCallback(() => {
    if (!historyRef.current.length) return;
    const previous = historyRef.current.pop();
    futureRef.current.push({
      tracks: cloneTracksForHistory(tracks),
      chordProgression: cloneChordsForHistory(chordProgression),
    });
    setTracks(previous?.tracks || []);
    setChordProgression(previous?.chordProgression || []);
    setSelectedItem(null);
    setFocusedClipId(null);
    updateHistoryStatus();
  }, [
    tracks,
    chordProgression,
    setTracks,
    setChordProgression,
    setSelectedItem,
    setFocusedClipId,
    updateHistoryStatus,
  ]);

  // Redo
  const handleRedo = useCallback(() => {
    if (!futureRef.current.length) return;
    const nextState = futureRef.current.pop();
    historyRef.current.push({
      tracks: cloneTracksForHistory(tracks),
      chordProgression: cloneChordsForHistory(chordProgression),
    });
    setTracks(nextState?.tracks || []);
    setChordProgression(nextState?.chordProgression || []);
    setSelectedItem(null);
    setFocusedClipId(null);
    updateHistoryStatus();
  }, [
    tracks,
    chordProgression,
    setTracks,
    setChordProgression,
    setSelectedItem,
    setFocusedClipId,
    updateHistoryStatus,
  ]);

  return {
    historyStatus,
    pushHistory,
    handleUndo,
    handleRedo,
    updateHistoryStatus,
  };
};
