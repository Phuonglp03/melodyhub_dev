import { useState, useCallback } from "react";
import {
  addLickToTimeline,
  generateBackingTrack as generateBackingTrackAPI,
  generateAIBackingTrack,
  addTrack,
  updateProject,
} from "../services/user/projectService";
import { updateTimelineItem } from "../services/user/projectService";
import { TRACK_COLOR_PALETTE } from "../utils/projectHelpers";
import { normalizeTracks } from "../utils/timelineHelpers";
import {
  normalizeKeyPayload,
  normalizeTimeSignaturePayload,
} from "../utils/musicTheory";

/**
 * Hook for managing backing track operations
 * @param {Object} options - Configuration options
 * @param {string} options.projectId - Project ID
 * @param {Object} options.project - Project data
 * @param {Object} options.backingTrack - Backing track object
 * @param {Function} options.setBackingTrack - Setter for backing track
 * @param {Array} options.tracks - Tracks array
 * @param {Function} options.setTracks - Setter for tracks
 * @param {Function} options.setSelectedInstrumentId - Setter for selected instrument ID
 * @param {Function} options.broadcast - Function to broadcast to collaborators
 * @param {Function} options.refreshProject - Function to refresh project
 * @param {Function} options.setError - Setter for error
 * @param {Array} options.chordLibrary - Chord library array
 * @param {string} options.selectedRhythmPatternId - Selected rhythm pattern ID
 * @param {Function} options.setIsGeneratingAI - Setter for AI generation state
 * @param {Function} options.setAiNotification - Setter for AI notification
 * @param {Function} options.fetchProject - Function to fetch project
 * @returns {Object} Backing track handlers
 */
export const useProjectBackingTrack = ({
  projectId,
  project,
  backingTrack,
  setBackingTrack,
  tracks,
  setTracks,
  setSelectedInstrumentId,
  broadcast,
  refreshProject,
  setError,
  chordLibrary,
  selectedRhythmPatternId,
  setIsGeneratingAI,
  setAiNotification,
  fetchProject,
}) => {
  const [isGeneratingBackingTrack, setIsGeneratingBackingTrack] =
    useState(false);

  // Ensure backing track exists
  const ensureBackingTrack = useCallback(async () => {
    // First check if backingTrack state is set
    if (backingTrack) return backingTrack._id;

    // Check if a backing track already exists in the tracks array
    const existingBackingTrack = tracks.find(
      (track) =>
        track.isBackingTrack ||
        track.trackType === "backing" ||
        track.trackName?.toLowerCase() === "backing track"
    );

    if (existingBackingTrack) {
      // Set the state so we don't try to create another one
      setBackingTrack(existingBackingTrack);
      return existingBackingTrack._id;
    }

    // Create backing track if it doesn't exist
    try {
      const defaultColor =
        TRACK_COLOR_PALETTE[tracks.length % TRACK_COLOR_PALETTE.length];
      const response = await addTrack(projectId, {
        trackName: "Backing Track",
        isBackingTrack: true,
        trackType: "backing",
        color: defaultColor,
      });
      if (response.success) {
        const [createdTrack] = normalizeTracks(
          [
            {
              ...response.data,
              isBackingTrack: true,
              trackType: "backing",
              color: response.data.color || defaultColor,
            },
          ],
          TRACK_COLOR_PALETTE
        );
        if (createdTrack) {
          setBackingTrack(createdTrack);
          setTracks((prev) => [...prev, createdTrack]);
          return createdTrack._id;
        }
      }
    } catch (err) {
      console.error("Error creating backing track:", err);
      // If error says backing track already exists, try to find it in tracks
      if (err.message?.includes("already has a backing track")) {
        const existingBackingTrack = tracks.find(
          (track) =>
            track.isBackingTrack ||
            track.trackType === "backing" ||
            track.trackName?.toLowerCase() === "backing track"
        );
        if (existingBackingTrack) {
          setBackingTrack(existingBackingTrack);
          return existingBackingTrack._id;
        }
        // Refresh project to get the latest tracks
        await refreshProject();
        // Try to find it again after refresh
        const refreshedBackingTrack = tracks.find(
          (track) =>
            track.isBackingTrack ||
            track.trackType === "backing" ||
            track.trackName?.toLowerCase() === "backing track"
        );
        if (refreshedBackingTrack) {
          setBackingTrack(refreshedBackingTrack);
          return refreshedBackingTrack._id;
        }
      }
    }
    return null;
  }, [
    backingTrack,
    tracks,
    projectId,
    setBackingTrack,
    setTracks,
    refreshProject,
  ]);

  // Apply backing instrument selection
  const applyBackingInstrumentSelection = useCallback(
    async (instrumentId) => {
      setSelectedInstrumentId(instrumentId);
      // Note: setProject should be passed as a dependency if needed
      // For now, we'll update via API and refresh

      // Broadcast to collaborators immediately (before API call)
      if (broadcast) {
        broadcast("PROJECT_SETTINGS_UPDATE", {
          backingInstrumentId: instrumentId,
        });
      }

      await updateProject(projectId, { backingInstrumentId: instrumentId });

      refreshProject();
    },
    [projectId, setSelectedInstrumentId, broadcast, refreshProject]
  );

  // Handle instrument selection for backing track or selected track
  const handleSelectInstrument = useCallback(
    async (instrumentId, selectedTrackId) => {
      try {
        if (selectedTrackId) {
          const track = tracks.find((t) => t._id === selectedTrackId);

          if (!track) {
            alert("That track is no longer available. Please select it again.");
            return;
          }

          if (!track.isBackingTrack && track.trackType !== "backing") {
            // This should be handled by track update, not here
            return;
          }

          await applyBackingInstrumentSelection(instrumentId);
          return;
        }

        await applyBackingInstrumentSelection(instrumentId);
      } catch (err) {
        console.error("Error updating instrument:", err);
        refreshProject();
      }
    },
    [tracks, applyBackingInstrumentSelection, refreshProject]
  );

  // Handle adding chord to timeline
  const handleAddChordToTimeline = useCallback(
    async (chordData) => {
      try {
        if (!backingTrack) {
          alert("No backing track found. Please create one first.");
          return;
        }

        // Find the chord in the library to get full MIDI data
        const chord = chordLibrary.find(
          (c) => c.chordName === chordData.chordName
        );
        if (!chord) {
          alert("Chord not found in library");
          return;
        }

        // Calculate start time (place at the end of existing items)
        const existingItems = backingTrack.items || [];
        const lastItem =
          existingItems.length > 0
            ? existingItems.reduce((max, item) => {
                const endTime = item.startTime + item.duration;
                return endTime > max ? endTime : max;
              }, 0)
            : 0;

        const bpm = project?.tempo || 120;
        const secondsPerBeat = 60 / bpm;
        const durationInSeconds = (chordData.duration || 4) * secondsPerBeat;

        // Parse MIDI notes - they're stored as JSON string
        let midiNotes = [];
        if (chord.midiNotes) {
          if (typeof chord.midiNotes === "string") {
            try {
              midiNotes = JSON.parse(chord.midiNotes);
            } catch (e) {
              console.error("Failed to parse MIDI notes:", e);
              midiNotes = [];
            }
          } else if (Array.isArray(chord.midiNotes)) {
            midiNotes = chord.midiNotes;
          }
        }

        const timelineData = {
          trackId: backingTrack._id,
          startTime: lastItem,
          duration: durationInSeconds,
          offset: 0,
          type: "chord",
          chordName: chord.chordName,
          rhythmPatternId: chordData.rhythmPatternId || selectedRhythmPatternId,
          isCustomized: false,
          customMidiEvents:
            midiNotes.length > 0
              ? midiNotes.map((pitch) => ({
                  pitch: Number(pitch),
                  startTime: 0,
                  duration: durationInSeconds,
                  velocity: 0.8,
                }))
              : [],
        };

        const response = await addLickToTimeline(projectId, timelineData);
        if (response.success) {
          // Broadcast to collaborators immediately (before refresh)
          if (broadcast) {
            broadcast("LICK_ADD_TO_TIMELINE", {
              trackId: timelineData.trackId,
              item: response.data,
            });
          }

          await refreshProject();
          alert("Chord added to timeline!");
        }
      } catch (error) {
        console.error("Error adding chord to timeline:", error);
        alert(
          `Failed to add chord: ${
            error.response?.data?.message || error.message
          }`
        );
      }
    },
    [
      backingTrack,
      chordLibrary,
      project,
      selectedRhythmPatternId,
      projectId,
      broadcast,
      refreshProject,
    ]
  );

  // Handle generating full backing track with audio generation
  const handleGenerateBackingTrack = useCallback(
    async (data) => {
      // Validate bandSettings is required for audio generation
      const hasBandSettings = project?.bandSettings?.members?.length > 0;

      if (!hasBandSettings) {
        alert(
          "Band settings are required for backing track generation. Please configure your band settings first."
        );
        return;
      }

      if (!project?.bandSettings?.style) {
        alert(
          "Band style is required for backing track generation. Please set a style (Swing, Bossa, Latin, Ballad, Funk, or Rock)."
        );
        return;
      }

      if (!data.chords || data.chords.length === 0) {
        alert("Please add some chords to the progression first");
        return;
      }

      setIsGeneratingBackingTrack(true);
      setError(null);

      try {
        // Include project tempo and key for accurate audio generation
        const generationData = {
          ...data,
          tempo: project?.tempo || 120,
          key: normalizeKeyPayload(project?.key),
          timeSignature: normalizeTimeSignaturePayload(project?.timeSignature),
          // Flag to indicate we want audio generation (not just MIDI)
          generateAudio: true,
        };

        console.log(
          "[Generate Backing Track] Starting generation with data:",
          generationData
        );
        const response = await generateBackingTrackAPI(
          projectId,
          generationData
        );

        if (response.success) {
          // bandSettings is always used now, so don't update selectedInstrumentId

          // Small delay to ensure server has saved everything
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Refresh project to get new backing track items with audio
          await refreshProject();

          // Show success message
          alert(
            `✅ Backing track generated successfully with ${
              response.data?.items?.length || 0
            } chord clips!`
          );
        } else {
          throw new Error(
            response.message || "Failed to generate backing track"
          );
        }
      } catch (error) {
        console.error(
          "[Generate Backing Track] Error generating backing track:",
          error
        );
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          "Failed to generate backing track audio";
        setError(errorMessage);
        alert(`❌ Error: ${errorMessage}`);
      } finally {
        setIsGeneratingBackingTrack(false);
      }
    },
    [project, projectId, setSelectedInstrumentId, refreshProject, setError]
  );

  // Handle AI Backing Track Generation with Suno
  const handleGenerateAIBackingTrack = useCallback(
    async (params) => {
      setIsGeneratingAI(true);
      setAiNotification(null);

      try {
        const response = await generateAIBackingTrack(projectId, params);

        if (response.success) {
          // Show success notification
          setAiNotification({
            type: "success",
            message:
              response.message || "🎵 AI backing track generated successfully!",
          });

          // Refresh project to get new backing track items
          await fetchProject();

          // Auto-hide notification after 5 seconds
          setTimeout(() => setAiNotification(null), 5000);
        }
      } catch (error) {
        console.error("AI generation failed:", error);
        setAiNotification({
          type: "error",
          message: error.message || "Failed to generate AI backing track",
        });
      } finally {
        setIsGeneratingAI(false);
      }
    },
    [projectId, setIsGeneratingAI, setAiNotification, fetchProject]
  );

  return {
    isGeneratingBackingTrack,
    ensureBackingTrack,
    applyBackingInstrumentSelection,
    handleSelectInstrument,
    handleAddChordToTimeline,
    handleGenerateBackingTrack,
    handleGenerateAIBackingTrack,
  };
};
