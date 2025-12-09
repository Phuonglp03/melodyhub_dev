import { useMemo, useCallback } from "react";
import {
  normalizeTimeSignaturePayload,
  clampSwingAmount,
} from "../utils/musicTheory";
import {
  normalizeRhythmPattern,
  normalizeRhythmSteps,
  registerPatternLookupKey,
  lookupPatternFromMap,
  createDefaultPatternSteps,
  formatTransportTime,
} from "../utils/timelineHelpers";

/**
 * Hook for computing derived values from project state
 * @param {Object} options - Configuration options
 * @param {Object} options.project - Project data
 * @param {Array} options.tracks - Array of tracks
 * @param {Array} options.chordProgression - Chord progression array
 * @param {string} options.projectId - Project ID
 * @param {Array} options.availableLicks - Available licks array
 * @param {string} options.selectedInstrumentId - Selected instrument ID
 * @param {string} options.selectedTrackId - Selected track ID
 * @param {string} options.selectedRhythmPatternId - Selected rhythm pattern ID
 * @param {Array} options.rhythmPatterns - Rhythm patterns array
 * @param {Object} options.trackContextMenu - Track context menu state
 * @param {number} options.secondsPerBeat - Seconds per beat
 * @param {number} options.playbackPosition - Current playback position
 * @returns {Object} Computed values
 */
export const useProjectComputed = ({
  project,
  tracks,
  chordProgression,
  projectId,
  availableLicks,
  selectedInstrumentId,
  selectedTrackId,
  selectedRhythmPatternId,
  rhythmPatterns,
  trackContextMenu,
  secondsPerBeat,
  playbackPosition,
}) => {
  // Resolved backing instrument ID
  const resolvedBackingInstrumentId = useMemo(
    () => selectedInstrumentId || project?.backingInstrumentId || null,
    [selectedInstrumentId, project?.backingInstrumentId]
  );

  // Instrument highlight ID
  const instrumentHighlightId = useMemo(() => {
    if (!selectedTrackId) return resolvedBackingInstrumentId;
    const targetTrack = tracks.find((t) => t._id === selectedTrackId);
    if (!targetTrack) return null;
    if (targetTrack.isBackingTrack || targetTrack.trackType === "backing") {
      return resolvedBackingInstrumentId;
    }
    return targetTrack.instrument || null;
  }, [selectedTrackId, tracks, resolvedBackingInstrumentId]);

  // Normalized time signature
  const normalizedTimeSignature = useMemo(
    () => normalizeTimeSignaturePayload(project?.timeSignature),
    [project?.timeSignature]
  );

  // Beats per measure
  const beatsPerMeasure = normalizedTimeSignature?.numerator || 4;

  // Chord duration in seconds
  const chordDurationSeconds = beatsPerMeasure * secondsPerBeat;

  // Project swing amount
  const projectSwingAmount = useMemo(
    () => clampSwingAmount(project?.swingAmount ?? 0),
    [project?.swingAmount]
  );

  // Rhythm pattern lookup map
  const rhythmPatternLookup = useMemo(() => {
    const map = {};
    (rhythmPatterns || []).forEach((pattern) => {
      if (!pattern) return;
      const normalized = normalizeRhythmPattern(pattern);
      registerPatternLookupKey(map, pattern._id, normalized);
      registerPatternLookupKey(map, pattern.id, normalized);
      registerPatternLookupKey(map, pattern.slug, normalized);
      registerPatternLookupKey(map, pattern.name, normalized);
    });
    return map;
  }, [rhythmPatterns]);

  // Lookup rhythm pattern function
  const lookupRhythmPattern = useCallback(
    (key) => lookupPatternFromMap(rhythmPatternLookup, key),
    [rhythmPatternLookup]
  );

  // Get rhythm pattern visual
  const getRhythmPatternVisual = useCallback(
    (item) => {
      if (!item) return null;

      const patternKeys = [
        item.rhythmPatternId,
        item.rhythmPattern,
        item.rhythm?.patternId,
        item.rhythm?.id,
        item.rhythmPatternName,
        item.rhythm?.name,
      ].filter(Boolean);

      const tryLookupPattern = () => {
        for (const key of patternKeys) {
          const found = lookupRhythmPattern(key);
          if (found) return found;
        }
        return null;
      };

      const directSources = [
        item.rhythmPatternSteps,
        item.rhythmPatternData,
        item.rhythm?.steps,
        item.rhythm,
      ];

      for (const source of directSources) {
        const steps = normalizeRhythmSteps(source);
        if (steps.length) {
          const matchedPattern = tryLookupPattern();
          const label =
            item.rhythmPatternName ||
            item.rhythm?.name ||
            matchedPattern?.displayName ||
            null;
          return { steps, label };
        }
      }

      const matchedPattern = tryLookupPattern();
      if (matchedPattern) {
        return {
          steps: matchedPattern.visualSteps,
          label: matchedPattern.displayName,
        };
      }

      if (selectedRhythmPatternId) {
        const fallback = lookupRhythmPattern(selectedRhythmPatternId);
        if (fallback) {
          return {
            steps: fallback.visualSteps,
            label: fallback.displayName,
          };
        }
      }

      return {
        steps: createDefaultPatternSteps(),
        label: null,
      };
    },
    [lookupRhythmPattern, selectedRhythmPatternId]
  );

  // Track-related computed values
  const orderedTracks = useMemo(
    () => [...tracks].sort((a, b) => (a.trackOrder ?? 0) - (b.trackOrder ?? 0)),
    [tracks]
  );

  const userTracks = useMemo(
    () =>
      orderedTracks.filter(
        (track) => !track.isBackingTrack && track.trackType !== "backing"
      ),
    [orderedTracks]
  );

  const hasAnyUserClips = useMemo(
    () => userTracks.some((track) => (track.items || []).length > 0),
    [userTracks]
  );

  const menuTrack = useMemo(
    () =>
      trackContextMenu?.trackId
        ? tracks.find((track) => track._id === trackContextMenu.trackId) || null
        : null,
    [trackContextMenu?.trackId, tracks]
  );

  const menuPosition = useMemo(() => {
    const padding = 12;
    const width = 260;
    const height = 320;
    let x = trackContextMenu?.x || 0;
    let y = trackContextMenu?.y || 0;

    if (typeof window !== "undefined") {
      x = Math.min(Math.max(padding, x), window.innerWidth - width - padding);
      y = Math.min(Math.max(padding, y), window.innerHeight - height - padding);
    }

    return { x, y };
  }, [trackContextMenu?.x, trackContextMenu?.y]);

  // Formatted play time
  const formattedPlayTime = useMemo(
    () => formatTransportTime(playbackPosition),
    [playbackPosition]
  );

  return {
    resolvedBackingInstrumentId,
    instrumentHighlightId,
    normalizedTimeSignature,
    beatsPerMeasure,
    chordDurationSeconds,
    projectSwingAmount,
    rhythmPatternLookup,
    lookupRhythmPattern,
    getRhythmPatternVisual,
    orderedTracks,
    userTracks,
    hasAnyUserClips,
    menuTrack,
    menuPosition,
    formattedPlayTime,
  };
};
