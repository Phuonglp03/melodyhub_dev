import React, { useState, useEffect, useRef } from "react";
import {
  FaPlay,
  FaPause,
  FaPlus,
  FaMinus,
  FaEdit,
  FaMusic,
  FaVolumeUp,
} from "react-icons/fa";
import GuitarSynthesizer from "../services/guitarSynthesizer";

const GuitarTabNotation = ({
  tabData = "",
  isEditable = false,
  onChange,
  tempo = 120,
  audioRef = null, // Audio element reference for syncing
  audioDuration = 0, // Audio duration in seconds
  timeSignatureTop = 4,
  timeSignatureBottom = 4,
  showTimingRuler = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackMode, setPlaybackMode] = useState(
    audioRef ? "audio" : "instrument"
  ); // 'audio' or 'instrument'

  const playbackIntervalRef = useRef(null);
  const synthesizerRef = useRef(null);

  // Parse tab string into structured format by measures
  const parseTab = (tabString) => {
    if (!tabString || tabString.trim() === "") {
      return [getDefaultMeasure()];
    }

    const lines = tabString.split("\n").filter((line) => line.trim());
    const measures = [];
    let currentMeasure = [];

    for (let line of lines) {
      if (line.includes("|")) {
        currentMeasure.push(line);

        // A complete measure has 6 strings (e, B, G, D, A, E)
        if (currentMeasure.length === 6) {
          measures.push([...currentMeasure]);
          currentMeasure = [];
        }
      }
    }

    // Add any remaining incomplete measure
    if (currentMeasure.length > 0) {
      measures.push(currentMeasure);
    }

    return measures.length > 0 ? measures : [getDefaultMeasure()];
  };

  const getDefaultMeasure = () => {
    return [
      "e|--------------------------------|",
      "B|--------------------------------|",
      "G|--------------------------------|",
      "D|--------------------------------|",
      "A|--------------------------------|",
      "E|--------------------------------|",
    ];
  };

  const measures = parseTab(tabData);

  // Initialize synthesizer
  useEffect(() => {
    synthesizerRef.current = new GuitarSynthesizer();
    return () => {
      if (synthesizerRef.current) {
        synthesizerRef.current.destroy();
      }
    };
  }, []);

  // Calculate actual tab length from parsed tab
  const calculateTabLength = () => {
    if (measures.length === 0 || measures[0].length === 0) return 32;
    const firstLine = measures[0][0];
    const parts = firstLine.split("|");
    const notes = parts.slice(1, -1).join(""); // Remove string label and last pipe
    // Total length = measure length * number of measures
    return notes.length * measures.length;
  };

  // (Removed timing ruler to match clean pro UI)

  // (Removed bottom ruler to match clean pro UI)

  // Parse notes from tab for playback (consumes multi-digit frets correctly)
  const parseNotesFromTab = () => {
    const notes = [];
    const stringNames = ["e", "B", "G", "D", "A", "E"];

    const tabLength = calculateTabLength();
    const totalDuration = audioDuration || (tabLength * 60) / tempo / 4;

    measures.forEach((measure, measureIndex) => {
      if (measure.length < 6) return;

      const measureLength = measure[0].split("|").slice(1, -1).join("").length;
      const measureStartPos = measureIndex * measureLength;

      // Check each string
      measure.forEach((line, stringIndex) => {
        const parts = line.split("|");
        const noteContent = parts.slice(1, -1).join("");

        let pos = 0;
        while (pos < noteContent.length) {
          const char = noteContent[pos];

          if (char && char >= "0" && char <= "9") {
            let fret = parseInt(char);
            let fretWidth = 1;

            // Handle 2-digit frets
            if (pos + 1 < noteContent.length) {
              const nextChar = noteContent[pos + 1];
              if (nextChar >= "0" && nextChar <= "9") {
                fret = parseInt(char + nextChar);
                fretWidth = 2;
              }
            }

            const globalPos = measureStartPos + pos;

            notes.push({
              string: stringNames[stringIndex],
              fret: fret,
              position: globalPos,
              time: (globalPos / tabLength) * totalDuration,
            });

            pos += fretWidth; // consume whole note
          } else {
            pos += 1;
          }
        }
      });
    });

    return notes.sort((a, b) => a.time - b.time);
  };

  // Sync with audio playback
  useEffect(() => {
    if (!audioRef || !audioRef.current) return;

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Calculate position in tab based on audio time
      if (audioDuration > 0) {
        // Calculate actual tab length from parsed tab
        const tabLength = calculateTabLength();
        const position = Math.floor(
          (audio.currentTime / audioDuration) * tabLength
        );
        setCurrentPosition(position);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentPosition(0);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioRef, audioDuration, measures]);

  // Handle zoom
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 0.5));
  };

  // Format time in MM:SS format
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Stop playback
  const stopPlayback = () => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    if (synthesizerRef.current) {
      synthesizerRef.current.stopAll();
    }
    setIsPlaying(false);
    setCurrentPosition(0);
    setCurrentTime(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  // Toggle playback - with mode selection
  const handlePlayPause = () => {
    if (isPlaying) {
      // Stop playback
      if (playbackMode === "audio" && audioRef && audioRef.current) {
        audioRef.current.pause();
      } else {
        stopPlayback();
      }
      return;
    }

    // Start playback
    if (playbackMode === "audio" && audioRef && audioRef.current) {
      // Audio sync mode
      audioRef.current.play().catch((err) => {
        console.error("Playback error:", err);
      });
    } else {
      // Instrument simulation mode
      playWithInstrument();
    }
  };

  // Play tab with synthesized instrument sounds
  const playWithInstrument = () => {
    const notes = parseNotesFromTab();
    if (notes.length === 0) {
      console.warn("No notes found in tab");
      return;
    }

    setIsPlaying(true);
    setCurrentPosition(0);

    const tabLength = calculateTabLength();
    const msPerPosition = 60000 / tempo / 4; // Milliseconds per position
    const totalDuration = tabLength * msPerPosition;

    let startTime = Date.now();
    let lastPlayedIndex = -1;

    playbackIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / totalDuration;
      const position = Math.floor(progress * tabLength);

      setCurrentPosition(position);
      setCurrentTime(elapsed / 1000);

      // Play notes at this position
      notes.forEach((note, index) => {
        if (note.position === position && index > lastPlayedIndex) {
          if (synthesizerRef.current) {
            // Calculate note duration (distance to next note on same string)
            const nextNote = notes.find(
              (n, i) => i > index && n.string === note.string
            );
            const duration = nextNote
              ? ((nextNote.position - note.position) * msPerPosition) / 1000
              : 0.5;

            synthesizerRef.current.playNote(
              note.string,
              note.fret,
              Math.min(duration, 2)
            );
          }
          lastPlayedIndex = index;
        }
      });

      // Check if playback finished
      if (position >= tabLength) {
        stopPlayback();
      }
    }, msPerPosition / 4); // Update 4 times per position for smooth animation
  };

  // Split measures into systems (rows)
  const measuresPerRow = 4;
  const systems = [];
  for (let i = 0; i < measures.length; i += measuresPerRow) {
    systems.push(measures.slice(i, i + measuresPerRow));
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      {/* Main Header - Title & View Controls */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Guitar Tablature</h3>

        <div className="flex items-center space-x-2">
          {/* Zoom Controls */}
          <button
            onClick={handleZoomOut}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors"
            title="Zoom Out"
          >
            <FaMinus size={12} />
          </button>
          <span className="text-gray-400 text-sm min-w-[50px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors"
            title="Zoom In"
          >
            <FaPlus size={12} />
          </button>

          {/* Edit Button */}
          {isEditable && (
            <button
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors ml-2"
              title="Edit Tab"
            >
              <FaEdit size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Playback Control Bar */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex items-center space-x-4">
          {/* Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            className={`p-2.5 ${
              playbackMode === "instrument"
                ? "bg-orange-600 hover:bg-orange-700"
                : "bg-blue-600 hover:bg-blue-700"
            } text-white rounded-md transition-colors`}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <FaPause size={14} /> : <FaPlay size={14} />}
          </button>

          {/* Playback Mode Toggle */}
          {audioRef && (
            <div className="flex bg-gray-900 rounded-md overflow-hidden border border-gray-700">
              <button
                onClick={() => setPlaybackMode("audio")}
                className={`px-3 py-2 text-xs transition-colors ${
                  playbackMode === "audio"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
                title="Sync with Audio"
              >
                <FaVolumeUp size={12} className="inline mr-1" />
                Audio
              </button>
              <button
                onClick={() => setPlaybackMode("instrument")}
                className={`px-3 py-2 text-xs transition-colors ${
                  playbackMode === "instrument"
                    ? "bg-orange-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
                title="Simulated Instrument"
              >
                <FaMusic size={12} className="inline mr-1" />
                Instrument
              </button>
            </div>
          )}

          {/* Progress Bar & Time Display */}
          <div className="flex-1 min-w-0">
            {((audioRef && audioDuration > 0 && playbackMode === "audio") ||
              (playbackMode === "instrument" && isPlaying)) && (
              <>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>
                    {playbackMode === "audio"
                      ? formatTime(audioDuration)
                      : formatTime((calculateTabLength() * 60) / tempo / 4)}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      playbackMode === "instrument"
                        ? "bg-gradient-to-r from-orange-500 to-red-600"
                        : "bg-gradient-to-r from-blue-500 to-purple-600"
                    }`}
                    style={{
                      width:
                        playbackMode === "audio"
                          ? `${(currentTime / audioDuration) * 100}%`
                          : `${
                              (currentPosition / calculateTabLength()) * 100
                            }%`,
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Tempo Display */}
          <span className="text-gray-400 text-sm whitespace-nowrap">
            Tempo: {tempo} BPM
          </span>
        </div>
      </div>

      {/* Tab Display (TabSheet) */}
      <div className="bg-gray-950 rounded-lg p-4 overflow-x-auto">
        <div
          className="font-mono text-sm leading-relaxed flex flex-col gap-8"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            transition: "transform 0.2s ease",
          }}
        >
          {systems.map((systemMeasures, systemIdx) => {
            const stringSpacingPx = 24; // Match the spacing used in measures
            return (
              <div key={systemIdx} className="flex items-start gap-6">
                {/* String labels - aligned with string lines */}
                <div
                  className="relative mr-2 select-none"
                  style={{
                    height: `${stringSpacingPx * 5 + 2}px`,
                    width: "20px",
                  }}
                >
                  {["e", "B", "G", "D", "A", "E"].map((s, idx) => (
                    <span
                      key={s}
                      className="text-orange-400 font-bold absolute"
                      style={{
                        top: `${idx * stringSpacingPx}px`,
                        transform: "translateY(-50%)",
                        lineHeight: 1,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                {/* System (row of measures) */}
                <div className="flex flex-wrap gap-8 items-start flex-1">
                  {systemMeasures.map((measure, relativeIdx) => {
                    const measureIndex =
                      systemIdx * measuresPerRow + relativeIdx;
                    // Get measure length for position calculation
                    const measureLength = measure[0]
                      ? measure[0].split("|").slice(1, -1).join("").length
                      : 16;
                    const measureStartPos = measureIndex * measureLength;
                    const beats = Math.max(1, timeSignatureTop);
                    const positionsPerBeat = Math.max(
                      1,
                      Math.floor(measureLength / beats)
                    );
                    const slotWidthPx = 12; // base width per tab slot for scaling
                    const stringSpacingPx = 24; // distance between string lines
                    const measureWidthPx = measureLength * slotWidthPx;
                    const measureHeightPx = stringSpacingPx * 5 + 2; // 6 lines -> 5 gaps

                    return (
                      <div
                        key={measureIndex}
                        className="mb-6 inline-block relative"
                        style={{ width: `${measureWidthPx + 40}px` }}
                      >
                        {/* MeasureHeader */}
                        <div className="flex items-baseline justify-between mb-1">
                          <div className="text-xs text-gray-500">
                            {measureIndex + 1}
                          </div>
                          {/* Chord placeholder */}
                          <div className="text-sm text-white font-semibold opacity-60"></div>
                          <div className="text-xs text-gray-500"></div>
                        </div>
                        {/* Stage: solid string lines and bar lines */}
                        <div
                          className="relative"
                          style={{
                            height: `${measureHeightPx}px`,
                            width: `${measureWidthPx}px`,
                          }}
                        >
                          {/* Left and right bar lines */}
                          <div
                            className="absolute top-0 bottom-0 border-l border-gray-600"
                            style={{ left: 0 }}
                          />
                          <div
                            className="absolute top-0 bottom-0 border-r border-gray-600"
                            style={{ right: 0 }}
                          />

                          {/* Six string lines */}
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className="absolute left-0 right-0 bg-gray-600"
                              style={{
                                height: "1px",
                                top: `${i * stringSpacingPx}px`,
                              }}
                            />
                          ))}

                          {/* NoteLayer: absolute notes + stems and beams */}
                          <div className="absolute inset-0">
                            {(() => {
                              const stringOrder = [
                                "e",
                                "B",
                                "G",
                                "D",
                                "A",
                                "E",
                              ];
                              const notesAll = parseNotesFromTab().filter(
                                (n) =>
                                  n.position >= measureStartPos &&
                                  n.position < measureStartPos + measureLength
                              );

                              // Group notes at the same slot position
                              const groupsMap = new Map();
                              for (const n of notesAll) {
                                const key = n.position;
                                if (!groupsMap.has(key)) groupsMap.set(key, []);
                                groupsMap.get(key).push(n);
                              }

                              const beats = Math.max(1, timeSignatureTop);
                              const positionsPerBeat = Math.max(
                                1,
                                Math.floor(measureLength / beats)
                              );
                              const sortedPositions = Array.from(
                                groupsMap.keys()
                              ).sort((a, b) => a - b);

                              const beatGroups = sortedPositions.map(
                                (pos, idx) => {
                                  const nextPos =
                                    sortedPositions[idx + 1] ??
                                    pos + positionsPerBeat;
                                  const delta = nextPos - pos;
                                  const rhythm =
                                    delta < positionsPerBeat
                                      ? "eighth"
                                      : "quarter";
                                  return {
                                    position: pos,
                                    rhythm,
                                    notes: groupsMap.get(pos),
                                  };
                                }
                              );

                              const elements = [];
                              const beams = [];
                              let pending = [];

                              // Use consistent spacing based on positions per beat
                              const BEAT_SPACING = measureWidthPx / beats; // Space per beat
                              let currentBeatIndex = null;

                              for (const g of beatGroups) {
                                const beatIndex = Math.floor(
                                  (g.position - measureStartPos) /
                                    positionsPerBeat
                                );

                                // Calculate base X position based on beat position for consistent spacing
                                const baseX =
                                  beatIndex * BEAT_SPACING + BEAT_SPACING / 2;

                                // For notes within the same beat, distribute evenly
                                const notesInSameBeat = beatGroups.filter(
                                  (bg) =>
                                    Math.floor(
                                      (bg.position - measureStartPos) /
                                        positionsPerBeat
                                    ) === beatIndex
                                );

                                const noteIndexInBeat =
                                  notesInSameBeat.findIndex(
                                    (bg) => bg.position === g.position
                                  );

                                // Evenly distribute notes within beat space
                                const idealX =
                                  notesInSameBeat.length > 1 &&
                                  noteIndexInBeat >= 0
                                    ? baseX -
                                      BEAT_SPACING * 0.3 +
                                      noteIndexInBeat *
                                        ((BEAT_SPACING * 0.6) /
                                          Math.max(
                                            1,
                                            notesInSameBeat.length - 1
                                          ))
                                    : baseX;

                                // Reset beams on new beat
                                if (currentBeatIndex === null)
                                  currentBeatIndex = beatIndex;
                                if (beatIndex !== currentBeatIndex) {
                                  if (pending.length > 1)
                                    beams.push([...pending]);
                                  pending = [];
                                  currentBeatIndex = beatIndex;
                                }

                                let lowestY = 0;
                                let highestY = Infinity;
                                let stemX = idealX;

                                // Calculate note widths and positions first
                                const noteData = [];
                                for (const n of g.notes) {
                                  const sIdx = stringOrder.indexOf(n.string);
                                  // Position note directly on the string line (not between lines)
                                  const yLine = sIdx * stringSpacingPx;

                                  const fretText = String(n.fret ?? "");
                                  let noteWidth = 14; // Base width for single digit
                                  if (fretText.length === 2)
                                    noteWidth = 22; // Two digits
                                  else if (fretText.length >= 3) noteWidth = 30; // Three digits

                                  noteData.push({
                                    note: n,
                                    stringIdx: sIdx,
                                    yLine, // Position on the actual line
                                    noteWidth,
                                    highlight:
                                      isPlaying &&
                                      Math.round(currentPosition) ===
                                        Math.round(n.position),
                                  });

                                  lowestY = Math.max(lowestY, yLine);
                                  highestY = Math.min(highestY, yLine);
                                }

                                // Calculate stem position (center of note group)
                                stemX = idealX;

                                // Track note positions for stem placement
                                const noteRightEdges = [];

                                // Draw notes with consistent positioning - aligned directly on string lines
                                for (const {
                                  note,
                                  stringIdx,
                                  yLine,
                                  noteWidth,
                                  highlight,
                                } of noteData) {
                                  const noteX = idealX - noteWidth / 2; // Center the note horizontally
                                  const noteRightEdge = noteX + noteWidth; // Right edge of note
                                  noteRightEdges.push(noteRightEdge);

                                  elements.push(
                                    <div
                                      key={`n-${g.position}-${note.string}`}
                                      className="absolute font-mono text-sm font-semibold"
                                      style={{
                                        top: `${yLine}px`, // Position exactly on the line
                                        left: `${noteX}px`,
                                        width: `${noteWidth}px`,
                                        height: `${stringSpacingPx * 0.6}px`, // Fixed height for consistent centering
                                        backgroundColor: highlight
                                          ? "#22c55e"
                                          : "#121212",
                                        color: highlight
                                          ? "#000000"
                                          : "#ffffff",
                                        transform: "translateY(-50%)", // Center vertically on the line
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        lineHeight: 1, // Exact line height for perfect centering
                                        textAlign: "center",
                                        borderRadius: "2px",
                                        zIndex: 2, // Ensure numbers appear above the stem
                                      }}
                                    >
                                      {note.fret}
                                    </div>
                                  );
                                }

                                // Draw only downward stem under the note boxes
                                if (noteData.length > 0) {
                                  // Calculate note box boundaries
                                  const noteBoxHeight = stringSpacingPx * 0.6;
                                  const lowestNoteBoxBottom =
                                    lowestY + noteBoxHeight / 2;

                                  // Position stem at the center of the note group
                                  const stemXPosition = idealX;

                                  // Draw downward stem only (below lowest note box)
                                  // Extend stem by approximately 2 string rows for better visibility
                                  const downwardStemTop = lowestNoteBoxBottom;
                                  const downwardStemBottom =
                                    lowestY + 12 + stringSpacingPx * 2;
                                  if (downwardStemBottom > downwardStemTop) {
                                    elements.push(
                                      <div
                                        key={`s-down-${g.position}`}
                                        className="absolute bg-white"
                                        style={{
                                          width: "1.5px",
                                          height: `${
                                            downwardStemBottom - downwardStemTop
                                          }px`,
                                          top: `${downwardStemTop}px`,
                                          left: `${stemXPosition}px`,
                                          transform: "translateX(-50%)",
                                          zIndex: 1,
                                        }}
                                      />
                                    );
                                  }

                                  // Use the bottom of the downward stem for beam positioning
                                  const stemBottomForBeam = downwardStemBottom;

                                  if (g.rhythm === "eighth") {
                                    pending.push({
                                      x: stemXPosition,
                                      y: stemBottomForBeam,
                                    });
                                  } else {
                                    if (pending.length > 1)
                                      beams.push([...pending]);
                                    pending = [];
                                  }
                                }
                              }

                              if (pending.length > 1) beams.push([...pending]);

                              // Draw beams with proper alignment
                              for (const seg of beams) {
                                if (seg.length < 2) continue;

                                const first = seg[0];
                                const last = seg[seg.length - 1];

                                // Calculate beam position based on highest stem top
                                const beamTop = Math.min(
                                  ...seg.map((s) => s.y)
                                );

                                // Ensure beam width is at least 1px
                                const beamWidth = Math.max(
                                  1,
                                  Math.abs(last.x - first.x)
                                );

                                elements.push(
                                  <div
                                    key={`b-${first.x}-${last.x}`}
                                    className="absolute bg-white"
                                    style={{
                                      left: `${Math.min(first.x, last.x)}px`,
                                      top: `${beamTop}px`,
                                      width: `${beamWidth}px`,
                                      height: "2.5px",
                                      borderRadius: "1px",
                                    }}
                                  />
                                );
                              }

                              return elements;
                            })()}
                          </div>
                        </div>

                        {/* PlaybackIndicator (green column) - aligned with tab stave and note positions */}
                        {(audioDuration > 0 ||
                          (playbackMode === "instrument" && isPlaying)) && (
                          <div
                            className="pointer-events-none absolute"
                            style={{
                              left:
                                currentPosition >= measureStartPos &&
                                currentPosition <
                                  measureStartPos + measureLength
                                  ? (() => {
                                      // Find notes at current position to align cursor with actual note positions
                                      const notesAtPosition =
                                        parseNotesFromTab().filter(
                                          (n) =>
                                            n.position >= measureStartPos &&
                                            n.position <
                                              measureStartPos + measureLength &&
                                            Math.round(n.position) ===
                                              Math.round(currentPosition)
                                        );

                                      if (notesAtPosition.length > 0) {
                                        // Calculate position based on beat alignment (same as note rendering)
                                        const beatIndex = Math.floor(
                                          (currentPosition - measureStartPos) /
                                            positionsPerBeat
                                        );
                                        const BEAT_SPACING =
                                          measureWidthPx / beats;
                                        const baseX =
                                          beatIndex * BEAT_SPACING +
                                          BEAT_SPACING / 2;
                                        // Align to beat center (where notes are positioned)
                                        return `${baseX}px`;
                                      }
                                      // Fallback to proportional position
                                      return `${
                                        ((currentPosition - measureStartPos) /
                                          measureLength) *
                                        measureWidthPx
                                      }px`;
                                    })()
                                  : "-9999px",
                              top: "0px",
                              bottom: "0px",
                              width: "20px", // Wider column to encompass note groups
                              transform: "translateX(-50%)", // Center on the position
                            }}
                          >
                            <div
                              className="h-full bg-green-500/40 shadow-[0_0_12px_4px_rgba(34,197,94,0.5)] border-l-2 border-r-2 border-green-500"
                              style={{
                                width: "calc(100% - 8px)", // Narrower inner div to create spacing
                                margin: "0 auto", // Center the inner div
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Notation Guide - Combined Legend & Tips */}
        <div className="mt-6 pt-4 border-t border-gray-800">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-white mb-2">
              Notation Guide
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-400">
              <div>
                <span className="text-white font-semibold">Numbers:</span> Fret
                positions
              </div>
              <div>
                <span className="text-white font-semibold">-:</span> Empty
                string
              </div>
              <div>
                <span className="text-white font-semibold">0:</span> Open string
              </div>
              <div>
                <span className="text-white font-semibold">|:</span> Measure bar
              </div>
              <div>
                <span className="text-white font-semibold">h:</span> Hammer-on
              </div>
              <div>
                <span className="text-white font-semibold">p:</span> Pull-off
              </div>
              <div>
                <span className="text-white font-semibold">b:</span> Bend
              </div>
              <div>
                <span className="text-white font-semibold">/\:</span> Slide
              </div>
            </div>
          </div>

          {/* Quick Tip for Editable Mode */}
          {isEditable && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <p className="text-blue-300 text-xs">
                <strong>Tip:</strong> Use standard tab notation format. Each
                line represents a string (e-B-G-D-A-E from high to low), numbers
                indicate frets, and dashes fill empty space.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuitarTabNotation;
