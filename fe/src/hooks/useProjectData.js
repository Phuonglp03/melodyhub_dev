import { useState, useCallback, useEffect, useRef } from "react";
import { getProjectById } from "../services/user/projectService";
import {
  hydrateChordProgression,
  TRACK_COLOR_PALETTE,
} from "../utils/projectHelpers";
import { normalizeTracks } from "../utils/timelineHelpers";
import { DEFAULT_BAND_MEMBERS, deriveLegacyMixFromMembers } from "../utils/bandDefaults";

/**
 * Hook for managing project data fetching and state
 * @param {string} projectId - The project ID
 * @param {Object} options - Configuration options
 * @param {Function} options.setChordProgression - Callback to set chord progression
 * @param {Function} options.setTracks - Callback to set tracks
 * @param {Function} options.setSelectedInstrumentId - Callback to set selected instrument ID
 * @param {Function} options.setBackingTrack - Callback to set backing track
 * @param {Function} options.setLoadingLicks - Callback to set loading licks state
 * @param {Function} options.updateBandSettings - Callback to update band settings
 * @param {Function} options.onProjectLoaded - Optional callback when project is loaded
 * @returns {Object} Project data and control functions
 */
export const useProjectData = ({
  projectId,
  setChordProgression,
  setTracks,
  setSelectedInstrumentId,
  setBackingTrack,
  setLoadingLicks,
  updateBandSettings,
  onProjectLoaded,
}) => {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState("viewer");
  const [isDeleting, setIsDeleting] = useState(false);
  const refreshProjectRef = useRef(null);

  const fetchProject = useCallback(
    async (showLoading = false) => {
      try {
        if (showLoading) {
          setLoading(true);
        }
        setError(null);
        const response = await getProjectById(projectId);
        if (response.success) {
          setProject(response.data.project);
          if (response.data.project.bandSettings?.members?.length) {
            updateBandSettings(response.data.project.bandSettings);
          }
          setChordProgression(
            hydrateChordProgression(response.data.project.chordProgression)
          );
          const normalized = normalizeTracks(
            response.data.tracks || [],
            TRACK_COLOR_PALETTE
          );
          setTracks(normalized);

          // Store userRole if available
          if (response.data.userRole) {
            setUserRole(response.data.userRole);
          }

          // Initialize backingTrack state if a backing track exists
          const existingBackingTrack = normalized.find(
            (track) =>
              track.isBackingTrack ||
              track.trackType === "backing" ||
              track.trackName?.toLowerCase() === "backing track"
          );
          if (existingBackingTrack) {
            console.log("[Fetch Project] Found backing track:", {
              id: existingBackingTrack._id,
              name: existingBackingTrack.trackName,
              instrument: existingBackingTrack.instrument,
              instrumentId: existingBackingTrack.instrument?.instrumentId,
            });
            // Update selectedInstrumentId if backing track has an instrument
            if (existingBackingTrack.instrument?.instrumentId) {
              console.log(
                "[Fetch Project] Setting selectedInstrumentId to:",
                existingBackingTrack.instrument.instrumentId
              );
              setSelectedInstrumentId(
                existingBackingTrack.instrument.instrumentId
              );
            }
            setBackingTrack(existingBackingTrack);
          } else {
            console.log("[Fetch Project] No backing track found in tracks");
          }

          // Call optional callback
          if (onProjectLoaded) {
            onProjectLoaded(response.data);
          }
        } else {
          throw new Error(response.message || "Failed to fetch project");
        }
      } catch (error) {
        console.error("Error fetching project:", error);
        setError(error.message || "Failed to load project");
      } finally {
        if (showLoading) {
          setLoading(false);
        }
        setLoadingLicks(false);
      }
    },
    [
      projectId,
      setChordProgression,
      setTracks,
      setSelectedInstrumentId,
      setBackingTrack,
      setLoadingLicks,
      setProject,
      setUserRole,
      setError,
      setLoading,
      updateBandSettings,
      onProjectLoaded,
    ]
  );

  const refreshProject = useCallback(() => fetchProject(false), [fetchProject]);

  // Update ref when refreshProject changes
  useEffect(() => {
    refreshProjectRef.current = refreshProject;
  }, [refreshProject]);

  return {
    project,
    setProject,
    loading,
    error,
    setError,
    userRole,
    setUserRole,
    isDeleting,
    setIsDeleting,
    fetchProject,
    refreshProject,
    refreshProjectRef,
  };
};

