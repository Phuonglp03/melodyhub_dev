import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaPlay,
  FaPause,
  FaStop,
  FaCircle,
  FaLock,
  FaUser,
  FaMusic,
  FaTrash,
  FaPlus,
  FaSearch,
  FaTimes,
} from "react-icons/fa";
import {
  getProjectById,
  updateProject,
  addLickToTimeline,
  updateTimelineItem,
  deleteTimelineItem,
  updateChordProgression as updateChordProgressionAPI,
  addTrack,
  updateTrack,
  getInstruments,
} from "../../../services/user/projectService";
import { getCommunityLicks } from "../../../services/user/lickService";
import { useSelector } from "react-redux";

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  const [project, setProject] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1); // Zoom multiplier
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapValue, setSnapValue] = useState(1); // Snap to 1 beat by default
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // UI State
  const [activeTab, setActiveTab] = useState("lick-library"); // "lick-library", "midi-editor", "instrument"
  const [selectedLick, setSelectedLick] = useState(null);
  const [showLickLibrary, setShowLickLibrary] = useState(true);
  const [lickSearchTerm, setLickSearchTerm] = useState("");
  const [availableLicks, setAvailableLicks] = useState([]);
  const [loadingLicks, setLoadingLicks] = useState(false);

  // Chord progression
  const [chordProgression, setChordProgression] = useState([]);

  // Instruments
  const [instruments, setInstruments] = useState([]);
  const [loadingInstruments, setLoadingInstruments] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState(null);

  // Drag and drop
  const [draggedLick, setDraggedLick] = useState(null);
  const [dragOverTrack, setDragOverTrack] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null);

  const timelineRef = useRef(null);
  const playheadRef = useRef(null);
  const basePixelsPerSecond = 50; // Base scale for timeline
  const beatsPerMeasure = 4; // For 4/4 time

  // Calculate BPM-dependent values
  const bpm = project?.tempo || 120;
  const secondsPerBeat = 60 / bpm;
  const pixelsPerSecond = basePixelsPerSecond * zoomLevel; // Zoom-adjusted scale
  const pixelsPerBeat = pixelsPerSecond * secondsPerBeat;

  // Common chords
  const commonChords = [
    "C",
    "G",
    "Am",
    "F",
    "Dm",
    "Em",
    "Gmaj7",
    "Am7",
    "Cmaj7",
    "Dm7",
  ];

  useEffect(() => {
    fetchProject(true); // Show loading only on initial load
    fetchInstruments();
  }, [projectId]);

  // Fetch available instruments
  const fetchInstruments = async () => {
    try {
      setLoadingInstruments(true);
      const response = await getInstruments();
      if (response.success) {
        setInstruments(response.data || []);
      }
    } catch (err) {
      console.error("Error fetching instruments:", err);
    } finally {
      setLoadingInstruments(false);
    }
  };

  // Fetch licks on initial mount and when search term changes
  useEffect(() => {
    const timeout = setTimeout(
      () => {
        fetchLicks();
      },
      lickSearchTerm ? 300 : 0
    );
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lickSearchTerm]);

  // Fetch project with loading state (only for initial load)
  const fetchProject = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const response = await getProjectById(projectId);
      if (response.success) {
        setProject(response.data.project);
        setTracks(response.data.tracks || []);
        // Parse chord progression
        if (response.data.project.chordProgression) {
          try {
            const chords = JSON.parse(response.data.project.chordProgression);
            setChordProgression(chords);
          } catch {
            setChordProgression([]);
          }
        } else {
          setChordProgression([]);
        }
      } else {
        setError(response.message || "Failed to load project");
      }
    } catch (err) {
      console.error("Error fetching project:", err);
      setError(err.message || "Failed to load project");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Silent refresh - updates data without showing loading
  const refreshProject = async () => {
    try {
      const response = await getProjectById(projectId);
      if (response.success) {
        setProject(response.data.project);
        setTracks(response.data.tracks || []);
        // Set selected instrument
        if (response.data.project.backingInstrumentId) {
          const instrumentId =
            response.data.project.backingInstrumentId._id ||
            response.data.project.backingInstrumentId;
          setSelectedInstrument(instrumentId);
        } else {
          setSelectedInstrument(null);
        }
        // Parse chord progression
        if (response.data.project.chordProgression) {
          try {
            const chords = JSON.parse(response.data.project.chordProgression);
            setChordProgression(chords);
          } catch {
            setChordProgression([]);
          }
        } else {
          setChordProgression([]);
        }
      }
    } catch (err) {
      console.error("Error refreshing project:", err);
      // Don't show error for silent refreshes, just log it
    }
  };

  const fetchLicks = async () => {
    try {
      setLoadingLicks(true);
      const response = await getCommunityLicks({
        search: lickSearchTerm || "",
        limit: 50,
      });
      if (response.success) {
        // Handle different response structures
        const licks =
          response.data?.licks || response.data || response.licks || [];
        setAvailableLicks(licks);
      } else {
        setAvailableLicks([]);
      }
    } catch (err) {
      console.error("Error fetching licks:", err);
      setAvailableLicks([]);
    } finally {
      setLoadingLicks(false);
    }
  };

  // Playback control with playhead movement
  useEffect(() => {
    let animationFrame;
    let startTime;

    if (isPlaying) {
      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = (timestamp - startTime) / 1000; // Convert to seconds
        setPlaybackPosition(elapsed);
        animationFrame = requestAnimationFrame(animate);
      };
      animationFrame = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isPlaying]);

  const handlePlay = () => {
    setIsPlaying(true);
    // TODO: Implement actual audio playback with Tone.js
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setPlaybackPosition(0);
  };

  // Snap time to grid
  const snapTime = (time) => {
    if (!snapToGrid) return time;
    const beats = time / secondsPerBeat;
    const snappedBeats = Math.round(beats / snapValue) * snapValue;
    return snappedBeats * secondsPerBeat;
  };

  // Calculate timeline width based on content
  const calculateTimelineWidth = () => {
    let maxTime = 32; // Default 32 seconds
    tracks.forEach((track) => {
      track.items?.forEach((item) => {
        const endTime = item.startTime + item.duration;
        if (endTime > maxTime) maxTime = endTime;
      });
    });
    // Add some padding
    return Math.max(maxTime * pixelsPerSecond + 200, 1000);
  };

  const saveChordProgression = async (chords) => {
    try {
      // Optimistic update - update chord progression in local state immediately
      setChordProgression(chords);
      await updateChordProgressionAPI(projectId, chords);
      // Silent refresh in background
      refreshProject();
    } catch (err) {
      console.error("Error updating chord progression:", err);
      // Revert on error by refreshing
      refreshProject();
    }
  };

  // Handle instrument selection
  const handleSelectInstrument = async (instrumentId) => {
    try {
      // Optimistic update
      setSelectedInstrument(instrumentId);
      setProject((prev) => ({
        ...prev,
        backingInstrumentId: instrumentId,
      }));

      await updateProject(projectId, { backingInstrumentId: instrumentId });
      // Silent refresh in background
      refreshProject();
    } catch (err) {
      console.error("Error updating instrument:", err);
      // Revert on error
      refreshProject();
    }
  };

  const handleAddChord = (chord) => {
    const newProgression = [...chordProgression, chord];
    setChordProgression(newProgression);
    saveChordProgression(newProgression);
  };

  const handleRemoveChord = (index) => {
    const newProgression = chordProgression.filter((_, i) => i !== index);
    setChordProgression(newProgression);
    saveChordProgression(newProgression);
  };

  const handleDragStart = (lick) => {
    setDraggedLick(lick);
  };

  const handleDragOver = (e, trackId, position) => {
    e.preventDefault();
    setDragOverTrack(trackId);
    setDragOverPosition(position);
  };

  const handleDrop = async (e, trackId, startTime) => {
    e.preventDefault();
    if (!draggedLick) return;

    // Get lick ID - handle different field names
    const lickId = draggedLick._id || draggedLick.lick_id || draggedLick.id;
    if (!lickId) {
      setError("Invalid lick: missing ID");
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
      setError("Invalid time values");
      setDraggedLick(null);
      return;
    }

    try {
      const response = await addLickToTimeline(projectId, {
        trackId: trackId.toString(),
        lickId: lickId.toString(),
        startTime: numericStartTime,
        duration: numericDuration,
      });

      if (response.success) {
        // Optimistic update - add item to local state immediately
        const newItem = response.data;
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
        setError(null);
        // Silent refresh in background to ensure sync
        refreshProject();
      } else {
        setError(response.message || "Failed to add lick to timeline");
      }
    } catch (err) {
      console.error("Error adding lick to timeline:", err);
      console.error("Error details:", {
        response: err.response?.data,
        draggedLick,
        trackId,
        startTime: numericStartTime,
        duration: numericDuration,
      });

      // Extract detailed error message
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
      setError(errorMessage);
    } finally {
      setDraggedLick(null);
      setDragOverTrack(null);
      setDragOverPosition(null);
    }
  };

  const handleDeleteTimelineItem = async (itemId) => {
    if (
      !window.confirm(
        "Are you sure you want to remove this lick from the timeline?"
      )
    ) {
      return;
    }

    try {
      // Optimistic update - remove item from local state immediately
      setTracks((prevTracks) =>
        prevTracks.map((track) => ({
          ...track,
          items: (track.items || []).filter((item) => item._id !== itemId),
        }))
      );

      await deleteTimelineItem(projectId, itemId);
      // Silent refresh in background to ensure sync
      refreshProject();
    } catch (err) {
      console.error("Error deleting timeline item:", err);
      setError(err.message || "Failed to delete timeline item");
      // Revert on error by refreshing
      refreshProject();
    }
  };

  const handleAddTrack = async () => {
    const trackName = prompt("Enter track name:");
    if (!trackName) return;

    try {
      const response = await addTrack(projectId, { trackName });
      if (response.success) {
        // Optimistic update - add track to local state immediately
        setTracks((prevTracks) => [...prevTracks, response.data]);
        // Silent refresh in background
        refreshProject();
      }
    } catch (err) {
      console.error("Error adding track:", err);
      setError(err.message || "Failed to add track");
    }
  };

  const handleUpdateTrack = async (trackId, updates) => {
    try {
      // Optimistic update - update track in local state immediately
      setTracks((prevTracks) =>
        prevTracks.map((track) =>
          track._id === trackId ? { ...track, ...updates } : track
        )
      );

      await updateTrack(projectId, trackId, updates);
      // Silent refresh in background to ensure sync
      refreshProject();
    } catch (err) {
      console.error("Error updating track:", err);
      // Revert on error by refreshing
      refreshProject();
    }
  };

  // Handle clip dragging
  useEffect(() => {
    if (!isDraggingItem || !selectedItem) return;

    const handleMouseMove = (e) => {
      if (!timelineRef.current) return;

      const timelineElement = timelineRef.current;
      const timelineRect = timelineElement.getBoundingClientRect();
      const scrollLeft = timelineElement.scrollLeft || 0;
      const x = e.clientX - timelineRect.left + scrollLeft;
      const newStartTime = Math.max(0, x / pixelsPerSecond);

      // Update position visually (optimistic update)
      // The actual save will happen on mouse up
    };

    const handleMouseUp = async (e) => {
      if (!timelineRef.current || !selectedItem) return;

      const timelineElement = timelineRef.current;
      const timelineRect = timelineElement.getBoundingClientRect();
      const scrollLeft = timelineElement.scrollLeft || 0;
      const x = e.clientX - timelineRect.left + scrollLeft;
      const rawTime = Math.max(0, x / pixelsPerSecond);
      const snappedTime = snapTime(rawTime);

      await handleClipMove(selectedItem, snappedTime);

      setIsDraggingItem(false);
      setSelectedItem(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isDraggingItem,
    selectedItem,
    pixelsPerSecond,
    snapToGrid,
    snapValue,
    secondsPerBeat,
  ]);

  const handleClipMouseDown = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedItem(item._id);
    setIsDraggingItem(true);
  };

  // Handle clip move
  const handleClipMove = async (itemId, newStartTime) => {
    if (newStartTime < 0) return;
    try {
      // Optimistic update - update item position in local state immediately
      setTracks((prevTracks) =>
        prevTracks.map((track) => ({
          ...track,
          items: (track.items || []).map((item) =>
            item._id === itemId ? { ...item, startTime: newStartTime } : item
          ),
        }))
      );

      await updateTimelineItem(projectId, itemId, { startTime: newStartTime });
      // Silent refresh in background to ensure sync
      refreshProject();
    } catch (err) {
      console.error("Error moving clip:", err);
      // Revert on error by refreshing
      refreshProject();
    }
  };

  // Handle clip resize
  const handleClipResize = async (itemId, newDuration) => {
    const snappedDuration = snapTime(newDuration);
    if (snappedDuration < 0.1) return; // Minimum duration
    try {
      // Optimistic update - update item duration in local state immediately
      setTracks((prevTracks) =>
        prevTracks.map((track) => ({
          ...track,
          items: (track.items || []).map((item) =>
            item._id === itemId ? { ...item, duration: snappedDuration } : item
          ),
        }))
      );

      await updateTimelineItem(projectId, itemId, {
        duration: snappedDuration,
      });
      // Silent refresh in background to ensure sync
      refreshProject();
    } catch (err) {
      console.error("Error resizing clip:", err);
      // Revert on error by refreshing
      refreshProject();
    }
  };

  const getChordDuration = () => {
    // Each chord gets 4 beats (1 measure in 4/4)
    return 4;
  };

  // Calculate chord width in pixels (4 beats = 1 measure)
  const getChordWidth = () => {
    return getChordDuration() * pixelsPerBeat;
  };

  // Calculate chord start position in pixels
  const getChordStartPosition = (chordIndex) => {
    return chordIndex * getChordWidth();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-6">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-400">{error}</p>
        </div>
        <button
          className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-2 rounded-md"
          onClick={() => navigate("/projects")}
        >
          Back to Projects
        </button>
      </div>
    );
  }

  if (!project) return null;

  const timelineWidth = calculateTimelineWidth();
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      {/* Top Bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        {/* Left: Project Title */}
        <div>
          <h2 className="text-white font-semibold text-lg">
            {project.title} - {formatDate(project.createdAt)}
          </h2>
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isPlaying ? (
              <button
                onClick={handlePause}
                className="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-white"
              >
                <FaPause size={14} />
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-white"
              >
                <FaPlay size={14} />
              </button>
            )}
            <button
              onClick={handleStop}
              className="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-white"
            >
              <FaStop size={14} />
            </button>
            <button className="w-10 h-10 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded text-white">
              <FaCircle size={12} />
            </button>
          </div>
          <div className="text-center">
            <div className="text-white font-medium">
              {project.tempo || 120} BPM
            </div>
            <div className="text-gray-400 text-xs">
              {project.timeSignature || "4/4"}
            </div>
          </div>
        </div>

        {/* Right: Action Buttons & Zoom Controls */}
        <div className="flex items-center gap-3">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1">
            <button
              onClick={() => setZoomLevel(Math.max(0.25, zoomLevel - 0.25))}
              className="text-gray-400 hover:text-white px-2"
              title="Zoom Out"
            >
              −
            </button>
            <span className="text-xs text-gray-400 min-w-[60px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(Math.min(4, zoomLevel + 0.25))}
              className="text-gray-400 hover:text-white px-2"
              title="Zoom In"
            >
              +
            </button>
          </div>

          {/* Snap Toggle */}
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`px-3 py-1 rounded text-xs font-medium ${
              snapToGrid
                ? "bg-orange-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
            title="Toggle Snap to Grid"
          >
            Snap
          </button>

          <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium">
            Invite
          </button>
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-gray-900"></div>
            <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-gray-900"></div>
            <div className="w-6 h-6 rounded-full bg-gray-600 border-2 border-gray-900"></div>
          </div>
          <button className="text-gray-400 hover:text-white">
            <FaLock size={16} />
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium">
            Publish
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Track Controls */}
        <div className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <button
              onClick={handleAddTrack}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center justify-center gap-2"
            >
              <FaPlus size={12} />
              Add a track
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tracks.map((track) => (
              <div
                key={track._id}
                className="p-4 border-b border-gray-800"
                onDragOver={(e) => handleDragOver(e, track._id, null)}
                onDrop={(e) => handleDrop(e, track._id, playbackPosition)}
                style={{
                  backgroundColor:
                    dragOverTrack === track._id
                      ? "rgba(255,255,255,0.05)"
                      : "transparent",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-medium text-sm">
                    {track.trackName}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        handleUpdateTrack(track._id, { muted: !track.muted })
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
                        handleUpdateTrack(track._id, { solo: !track.solo })
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
                      handleUpdateTrack(track._id, {
                        volume: parseFloat(e.target.value),
                      })
                    }
                    className="flex-1 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center - Timeline */}
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
          {/* Chord Progression Bar */}
          <div className="bg-gray-800 border-b border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-gray-300 text-sm font-medium">
                Chord Progression:
              </span>
              {chordProgression.map((chord, index) => (
                <div
                  key={index}
                  className="relative group"
                  style={{
                    width: `${getChordWidth()}px`,
                    minWidth: "80px",
                    marginLeft: index === 0 ? "0" : "0",
                  }}
                >
                  <div className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium text-center">
                    {chord}
                  </div>
                  <button
                    onClick={() => handleRemoveChord(index)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center"
                  >
                    <FaTimes size={8} />
                  </button>
                  {/* Beat numbers */}
                  <div className="flex justify-between mt-1 text-xs text-gray-500">
                    {Array.from({ length: getChordDuration() }).map((_, i) => (
                      <span key={i}>{i + 1}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Grid */}
          <div className="flex-1 overflow-auto relative" ref={timelineRef}>
            {/* Time Ruler with Beat Markers */}
            <div className="sticky top-0 z-10 bg-gray-800 border-b border-gray-700 h-10 flex items-end">
              {/* Measure markers (every 4 beats) */}
              {Array.from({
                length:
                  Math.ceil(timelineWidth / pixelsPerBeat / beatsPerMeasure) +
                  1,
              }).map((_, measureIndex) => {
                const measureTime =
                  measureIndex * beatsPerMeasure * secondsPerBeat;
                const measurePosition = measureTime * pixelsPerSecond;
                return (
                  <div
                    key={`measure-${measureIndex}`}
                    className="absolute border-l-2 border-blue-500 h-full flex items-end pb-1"
                    style={{ left: `${measurePosition}px` }}
                  >
                    <span className="text-xs text-blue-400 font-medium px-1">
                      {measureIndex + 1}
                    </span>
                  </div>
                );
              })}

              {/* Beat markers */}
              {Array.from({
                length: Math.ceil(calculateTimelineWidth() / pixelsPerBeat) + 1,
              }).map((_, beatIndex) => {
                const beatTime = beatIndex * secondsPerBeat;
                const beatPosition = beatTime * pixelsPerSecond;
                const isMeasureStart = beatIndex % beatsPerMeasure === 0;
                return (
                  <div
                    key={`beat-${beatIndex}`}
                    className={`absolute border-l h-full ${
                      isMeasureStart ? "border-blue-500" : "border-gray-600"
                    }`}
                    style={{ left: `${beatPosition}px` }}
                  />
                );
              })}

              {/* Second markers */}
              {Array.from({
                length:
                  Math.ceil(calculateTimelineWidth() / pixelsPerSecond) + 1,
              }).map((_, i) => (
                <div
                  key={`sec-${i}`}
                  className="absolute border-l border-gray-700 h-4 bottom-0"
                  style={{ left: `${i * pixelsPerSecond}px` }}
                />
              ))}
            </div>

            {/* Playhead */}
            {playbackPosition > 0 && (
              <div
                ref={playheadRef}
                className="absolute top-10 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                style={{
                  left: `${playbackPosition * pixelsPerSecond}px`,
                }}
              >
                <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
              </div>
            )}

            {/* Track Lanes */}
            {tracks.map((track, trackIndex) => (
              <div
                key={track._id}
                className="relative border-b border-gray-800"
                style={{ minHeight: "120px" }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!timelineRef.current) return;
                  const trackRect = e.currentTarget.getBoundingClientRect();
                  const scrollLeft = timelineRef.current.scrollLeft || 0;
                  const x = e.clientX - trackRect.left + scrollLeft;
                  const startTime = Math.max(0, x / pixelsPerSecond);
                  handleDragOver(e, track._id, startTime);
                }}
                onDrop={(e) => {
                  if (!timelineRef.current) return;
                  const trackRect = e.currentTarget.getBoundingClientRect();
                  const scrollLeft = timelineRef.current.scrollLeft || 0;
                  const x = e.clientX - trackRect.left + scrollLeft;
                  const rawTime = Math.max(0, x / pixelsPerSecond);
                  const snappedTime = snapTime(rawTime);
                  handleDrop(e, track._id, snappedTime);
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

                {/* Timeline Items (Clips) */}
                {track.items?.map((item) => {
                  const isSelected = selectedItem === item._id;
                  const clipWidth = item.duration * pixelsPerSecond;
                  const clipLeft = item.startTime * pixelsPerSecond;

                  return (
                    <div
                      key={item._id}
                      className={`absolute rounded border-2 ${
                        isSelected
                          ? "bg-blue-500 border-yellow-400 shadow-lg shadow-yellow-400/50"
                          : "bg-blue-600 border-blue-700 hover:bg-blue-700"
                      } text-white cursor-move transition-all`}
                      style={{
                        left: `${clipLeft}px`,
                        width: `${clipWidth}px`,
                        top: "10px",
                        height: "100px",
                        minWidth: "60px",
                      }}
                      title={item.lickId?.title || "Lick"}
                      onMouseDown={(e) => handleClipMouseDown(e, item)}
                    >
                      {/* Waveform visualization if available */}
                      {item.lickId?.waveformData ? (
                        (() => {
                          try {
                            const waveform =
                              typeof item.lickId.waveformData === "string"
                                ? JSON.parse(item.lickId.waveformData)
                                : item.lickId.waveformData;
                            const waveformArray = Array.isArray(waveform)
                              ? waveform
                              : [];
                            const sampleCount = Math.min(
                              50,
                              Math.floor(clipWidth / 4)
                            );
                            const step = Math.max(
                              1,
                              Math.floor(waveformArray.length / sampleCount)
                            );

                            return (
                              <div className="absolute inset-0 p-2 flex items-center justify-center">
                                <div className="w-full h-full bg-blue-800/30 rounded flex items-end justify-around gap-0.5">
                                  {waveformArray
                                    .filter((_, idx) => idx % step === 0)
                                    .slice(0, sampleCount)
                                    .map((value, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-white rounded-t"
                                        style={{
                                          width: "2px",
                                          height: `${Math.min(
                                            100,
                                            Math.abs(value || 0) * 100
                                          )}%`,
                                        }}
                                      />
                                    ))}
                                </div>
                              </div>
                            );
                          } catch (e) {
                            return null;
                          }
                        })()
                      ) : (
                        <div className="flex flex-col justify-between h-full p-2">
                          <div className="font-medium text-sm truncate">
                            {item.lickId?.title || `Lick ${trackIndex + 1}`}
                          </div>
                          <div className="text-xs opacity-75">
                            {item.startTime.toFixed(2)}s
                          </div>
                        </div>
                      )}

                      {/* Resize handle (right edge) */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-400"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          // TODO: Implement resize drag
                        }}
                      />

                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTimelineItem(item._id);
                        }}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-700 rounded text-white text-xs flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                      >
                        <FaTimes size={8} />
                      </button>
                    </div>
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
              </div>
            ))}

            {/* Drop Zone Hint */}
            {draggedLick && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800/90 border border-gray-700 rounded-lg px-6 py-3 text-gray-300 text-sm">
                Drag and drop a loop or audio/MIDI file here
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Libraries */}
        <div className="w-80 bg-gray-950 border-l border-gray-800 flex flex-col">
          {/* Backing Tracks */}
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-white font-medium mb-3">Backing Tracks</h3>
            <div className="relative">
              <FaSearch
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={14}
              />
              <input
                type="text"
                placeholder="Search..."
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 pl-9 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Chord Library */}
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-white font-medium mb-3">Chord Library</h3>
            <div className="grid grid-cols-2 gap-2">
              {commonChords.map((chord) => (
                <button
                  key={chord}
                  onClick={() => handleAddChord(chord)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded text-sm font-medium transition-colors"
                >
                  {chord}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar - Lick Library */}
      <div className="bg-gray-900 border-t border-gray-800">
        {/* Tabs */}
        <div className="flex items-center border-b border-gray-800">
          <button
            onClick={() => setActiveTab("instrument")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "instrument"
                ? "bg-gray-800 text-white border-b-2 border-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Instrument
          </button>
          <button
            onClick={() => setActiveTab("midi-editor")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "midi-editor"
                ? "bg-gray-800 text-white border-b-2 border-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            MIDI Editor
          </button>
          <button
            onClick={() => setActiveTab("lick-library")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "lick-library"
                ? "bg-gray-800 text-red-500 border-b-2 border-red-500"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Lick Library
          </button>
        </div>

        {/* Instrument Tab Content */}
        {activeTab === "instrument" && (
          <div className="p-6">
            <div className="mb-4">
              <h3 className="text-white font-semibold mb-2">
                Select Backing Instrument
              </h3>
              <p className="text-gray-400 text-sm">
                Choose an instrument to generate backing track from chord
                progression
              </p>
            </div>

            {loadingInstruments ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {instruments.map((instrument) => (
                  <button
                    key={instrument._id}
                    onClick={() => handleSelectInstrument(instrument._id)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedInstrument === instrument._id
                        ? "bg-orange-600 border-orange-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                    }`}
                  >
                    <div className="text-center">
                      <FaMusic className="mx-auto mb-2" size={24} />
                      <div className="font-medium text-sm">
                        {instrument.name}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedInstrument && (
              <div className="mt-6 p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 text-white">
                  <FaMusic className="text-orange-500" />
                  <span className="font-medium">
                    Selected:{" "}
                    {instruments.find((i) => i._id === selectedInstrument)
                      ?.name || "Unknown"}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  Backing track will be generated from chord progression using
                  this instrument's timbre.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Lick Library Content */}
        {activeTab === "lick-library" && (
          <div className="p-4 flex flex-col gap-4 h-full">
            {/* Search and Filters Row */}
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <FaSearch
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Search Licks..."
                  value={lickSearchTerm}
                  onChange={(e) => setLickSearchTerm(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 pl-9 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
                  Genre
                </button>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
                  Instrument
                </button>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
                  Mood
                </button>
              </div>
            </div>

            {/* Lick Cards - Scrollable Grid */}
            <div className="flex-1 overflow-y-auto">
              {loadingLicks ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
                </div>
              ) : availableLicks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <FaMusic size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">No licks found</p>
                  {lickSearchTerm && (
                    <p className="text-xs mt-1">Try a different search term</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {availableLicks.map((lick) => (
                    <div
                      key={lick._id || lick.lick_id}
                      draggable
                      onDragStart={() => handleDragStart(lick)}
                      className="bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-orange-500 transition-colors"
                    >
                      <div className="font-medium text-white text-sm mb-1 truncate">
                        {lick.title || lick.name}
                      </div>
                      <div className="text-xs text-gray-400 mb-2">
                        by{" "}
                        {lick.userId?.displayName ||
                          lick.userId?.username ||
                          lick.creator?.displayName ||
                          lick.creator?.username ||
                          "Unknown"}
                      </div>
                      {(lick.tags || lick.tag_names) && (
                        <div className="flex flex-wrap gap-1">
                          {(lick.tags || lick.tag_names || [])
                            .slice(0, 3)
                            .map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded"
                              >
                                {typeof tag === "string"
                                  ? tag
                                  : tag.tag_name || tag.name}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-900/20 border border-red-800 rounded-lg p-4 max-w-md">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default ProjectDetailPage;
