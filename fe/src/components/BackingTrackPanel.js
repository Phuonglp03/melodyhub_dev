import React, { useState } from "react";
import {
  FaMusic,
  FaPlay,
  FaMagic,
  FaCheck,
  FaTimes,
} from "react-icons/fa";
import { getMidiNotesForChord, midiToNoteNameNoOctave } from "../utils/midi";
import { getKeyDisplayName } from "../utils/musicTheory";

/**
 * BackingTrackPanel Component - Enhanced UI for easier backing track creation
 */
const BackingTrackPanel = ({
  chordLibrary = [],
  instruments = [],
  rhythmPatterns = [],
  onAddChord,
  onGenerateBackingTrack,
  onGenerateAIBackingTrack,
  selectedInstrumentId,
  onInstrumentChange,
  selectedRhythmPatternId,
  onRhythmPatternChange,
  chordProgression = [],
  loading = false,
  project = {},
  onRemoveChord,
  getRhythmPatternVisual,
}) => {
  const [chordDuration, setChordDuration] = useState(4);
  const [aiStyle, setAiStyle] = useState("jazz");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const musicStyles = [
    "Jazz",
    "Rock",
    "Pop",
    "Bossa Nova",
    "Blues",
    "Country",
    "Classical",
    "Funk",
  ];

  const selectedInstrument = instruments.find(
    (i) => i._id === selectedInstrumentId
  );
  const selectedRhythm = rhythmPatterns.find(
    (r) => r._id === selectedRhythmPatternId
  );
  const projectKeyDisplay = getKeyDisplayName(project?.key);

  const handleGenerateFullBackingTrack = () => {
    if (chordProgression.length === 0) {
      alert("Please add some chords to the progression first");
      return;
    }

    if (!selectedInstrumentId) {
      alert("Please select an instrument first");
      return;
    }

    if (!selectedRhythmPatternId) {
      alert("Please select a rhythm pattern first");
      return;
    }

    if (onGenerateBackingTrack) {
      onGenerateBackingTrack({
        chords: chordProgression,
        instrumentId: selectedInstrumentId,
        rhythmPatternId: selectedRhythmPatternId,
        chordDuration,
      });
    }
  };

  const handleGenerateAIBackingTrack = async () => {
    if (chordProgression.length === 0) {
      alert("Please add some chords to build a progression first!");
      return;
    }

    if (!selectedInstrumentId) {
      alert("Please select an instrument first!");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const selectedInstrument = instruments.find(
        (i) => i._id === selectedInstrumentId
      );

      if (onGenerateAIBackingTrack) {
        await onGenerateAIBackingTrack({
          chords: chordProgression,
          instrument: selectedInstrument?.name || "Piano",
          style: aiStyle,
          tempo: project.tempo || 120,
          key: projectKeyDisplay || "C Major",
          duration: chordProgression.length * chordDuration,
        });
      }
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const canGenerate =
    chordProgression.length > 0 &&
    selectedInstrumentId &&
    selectedRhythmPatternId;

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white overflow-y-auto">
      {/* Header with Steps Indicator */}
      <div className="p-3 border-b border-gray-700 bg-gray-800/50">
        <h3 className="text-sm font-semibold text-white mb-2">
          Create Backing Track
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <div
            className={`flex items-center gap-1 ${
              chordProgression.length > 0 ? "text-green-400" : "text-gray-500"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center ${
                chordProgression.length > 0 ? "bg-green-500" : "bg-gray-700"
              }`}
            >
              {chordProgression.length > 0 && <FaCheck size={8} />}
            </div>
            <span>1. Chords</span>
          </div>
          <div className="w-4 h-0.5 bg-gray-700"></div>
          <div
            className={`flex items-center gap-1 ${
              selectedInstrumentId ? "text-green-400" : "text-gray-500"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center ${
                selectedInstrumentId ? "bg-green-500" : "bg-gray-700"
              }`}
            >
              {selectedInstrumentId && <FaCheck size={8} />}
            </div>
            <span>2. Instrument</span>
          </div>
          <div className="w-4 h-0.5 bg-gray-700"></div>
          <div
            className={`flex items-center gap-1 ${
              selectedRhythmPatternId ? "text-green-400" : "text-gray-500"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center ${
                selectedRhythmPatternId ? "bg-green-500" : "bg-gray-700"
              }`}
            >
              {selectedRhythmPatternId && <FaCheck size={8} />}
            </div>
            <span>3. Rhythm</span>
          </div>
        </div>
      </div>

      {/* Chord Progression Section - Enhanced */}
      <div className="p-3 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-300">
            Chord Progression{" "}
            {chordProgression.length > 0 && `(${chordProgression.length})`}
          </label>
          {chordProgression.length > 0 && (
            <span className="text-[10px] text-gray-500">
              {chordProgression.length * chordDuration} beats total
            </span>
          )}
        </div>

        {chordProgression.length === 0 ? (
          <div className="text-center py-4 border-2 border-dashed border-gray-700 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">No chords added yet</p>
            <p className="text-[10px] text-gray-600">
              Click chords from the library to add them
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {chordProgression.map((chord, index) => {
              const chordName =
                chord?.chordName || chord?.name || `Chord ${index + 1}`;
              const rawMidiNotes =
                Array.isArray(chord?.midiNotes) && chord.midiNotes.length
                  ? chord.midiNotes
                  : getMidiNotesForChord(chordName);
              const cleanedMidiNotes = (rawMidiNotes || [])
                .map((note) => Number(note))
                .filter((note) => !Number.isNaN(note));
              const noteNames = cleanedMidiNotes.map((note) =>
                midiToNoteNameNoOctave(note)
              );
              const chordTitleParts = [`${chordName}`];
              if (noteNames.length) {
                chordTitleParts.push(`Notes: ${noteNames.join(", ")}`);
              }
              if (cleanedMidiNotes.length) {
                chordTitleParts.push(`MIDI: ${cleanedMidiNotes.join(", ")}`);
              }
              const rhythmVisual = getRhythmPatternVisual
                ? getRhythmPatternVisual(chord)
                : null;
              const patternSteps = rhythmVisual?.steps || [];
              const patternLabel = rhythmVisual?.label || null;
              const patternDisplay =
                patternSteps.length > 0 ? patternSteps : Array(8).fill(0.2);

              return (
                <div
                  key={index}
                  className="group relative px-3 py-1.5 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-lg text-xs font-semibold flex flex-col gap-0.5 hover:from-indigo-500 hover:to-indigo-600 transition-all shadow-sm"
                  title={chordTitleParts.join(" • ")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-indigo-200 font-normal">
                      {index + 1}
                    </span>
                    <span>{chordName}</span>
                    {onRemoveChord && (
                      <button
                        onClick={() => onRemoveChord(index)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 hover:bg-red-500 rounded p-0.5"
                        title="Remove chord"
                      >
                        <FaTimes size={8} className="text-white" />
                      </button>
                    )}
                  </div>
                  {noteNames.length > 0 && (
                    <div className="text-[10px] font-mono tracking-tight text-indigo-100">
                      {noteNames.join(" · ")}
                    </div>
                  )}
                  {cleanedMidiNotes.length > 0 && (
                    <div className="text-[9px] font-mono tracking-tight text-indigo-100/80 uppercase">
                      MIDI: {cleanedMidiNotes.join(" / ")}
                    </div>
                  )}
                  {patternLabel && (
                    <div className="text-[9px] text-indigo-100/80 font-semibold truncate">
                      {patternLabel}
                    </div>
                  )}
                  <div className="relative mt-1 h-8 rounded-md border border-white/10 bg-black/30 overflow-hidden">
                    <div className="absolute inset-0 flex">
                      {patternDisplay.map((value, stepIdx) => (
                        <div
                          key={`pattern-chip-${index}-${stepIdx}`}
                          className="flex-1 border-l border-white/10 last:border-r border-white/10 relative"
                        >
                          <div
                            className="absolute bottom-1 left-1 right-1 rounded-sm bg-white"
                            style={{
                              opacity: 0.2 + (value || 0) * 0.4,
                              height: `${Math.max(
                                8,
                                Math.min(100, (value || 0) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Instrument Selection - Visual Cards */}
      <div className="p-3 border-b border-gray-700 flex-shrink-0">
        <label className="block text-xs font-semibold text-gray-300 mb-2">
          Instrument {selectedInstrumentId && "✓"}
        </label>
        {instruments.length === 0 ? (
          <div className="text-xs text-gray-500 py-2">
            Loading instruments...
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
            {instruments.map((instrument) => {
              const isSelected = selectedInstrumentId === instrument._id;
              return (
                <button
                  key={instrument._id}
                  onClick={() => onInstrumentChange?.(instrument._id)}
                  className={`p-2 rounded-lg border-2 transition-all text-xs ${
                    isSelected
                      ? "bg-gradient-to-br from-orange-600 to-orange-700 border-orange-500 text-white shadow-lg"
                      : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                  }`}
                  title={instrument.name}
                >
                  <div className="flex flex-col items-center gap-1">
                    <FaMusic
                      size={14}
                      className={
                        isSelected ? "text-orange-200" : "text-gray-500"
                      }
                    />
                    <span className="truncate w-full text-center text-[10px]">
                      {instrument.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {selectedInstrument && (
          <div className="mt-2 px-2 py-1.5 bg-orange-900/30 border border-orange-700/50 rounded text-xs text-orange-200">
            <span className="font-medium">Selected:</span>{" "}
            {selectedInstrument.name}
          </div>
        )}
      </div>

      {/* Rhythm Pattern Selection - Visual Cards */}
      <div className="p-3 border-b border-gray-700 flex-shrink-0">
        <label className="block text-xs font-semibold text-gray-300 mb-2">
          Rhythm Pattern {selectedRhythmPatternId && "✓"}
        </label>
        {rhythmPatterns.length === 0 ? (
          <div className="text-xs text-gray-500 py-2">Loading patterns...</div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto">
            {rhythmPatterns.map((pattern) => {
              const isSelected = selectedRhythmPatternId === pattern._id;
              return (
                <button
                  key={pattern._id}
                  onClick={() => onRhythmPatternChange?.(pattern._id)}
                  className={`p-2 rounded-lg border-2 transition-all text-xs ${
                    isSelected
                      ? "bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500 text-white shadow-lg"
                      : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                  }`}
                  title={pattern.name}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`w-1 h-3 rounded ${
                            isSelected ? "bg-blue-200" : "bg-gray-600"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="truncate text-[10px]">{pattern.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {selectedRhythm && (
          <div className="mt-2 px-2 py-1.5 bg-blue-900/30 border border-blue-700/50 rounded text-xs text-blue-200">
            <span className="font-medium">Selected:</span> {selectedRhythm.name}
          </div>
        )}
      </div>

      {/* Settings Row */}
      <div className="p-3 border-b border-gray-700 flex-shrink-0 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-400">
              Beats per Chord
            </label>
            <input
              type="number"
              min="1"
              max="16"
              value={chordDuration}
              onChange={(e) =>
                setChordDuration(parseInt(e.target.value, 10) || 4)
              }
              className="w-full px-2 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-gray-400">
              AI Style
            </label>
            <select
              value={aiStyle}
              onChange={(e) => setAiStyle(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            >
              {musicStyles.map((style) => (
                <option key={style} value={style.toLowerCase()}>
                  {style}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-3 space-y-2 flex-shrink-0">
        {/* Generate Audio Button - Primary Action */}
        <button
          onClick={handleGenerateFullBackingTrack}
          disabled={!canGenerate || loading}
          className={`w-full px-3 py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
            canGenerate
              ? "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white shadow-lg hover:shadow-xl"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          }`}
          title={
            !canGenerate
              ? chordProgression.length === 0
                ? "Add chords first"
                : !selectedInstrumentId
                ? "Select an instrument"
                : "Select a rhythm pattern"
              : "Generate audio backing track"
          }
        >
          <FaPlay size={12} />
          {loading ? "Generating..." : "Generate Audio Track"}
        </button>

        {/* AI Generation Button */}
        <button
          onClick={handleGenerateAIBackingTrack}
          disabled={
            chordProgression.length === 0 ||
            !selectedInstrumentId ||
            isGeneratingAI
          }
          className={`w-full px-3 py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
            chordProgression.length > 0 && selectedInstrumentId
              ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg hover:shadow-xl"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          }`}
        >
          <FaMagic size={12} />
          {isGeneratingAI ? "Generating AI..." : "🎵 Generate AI Track"}
        </button>

        {/* Status Message */}
        {canGenerate && (
          <div className="text-center px-2 py-1.5 bg-green-900/30 border border-green-700/50 rounded text-xs text-green-300">
            ✓ Ready to generate {chordProgression.length} chord
            {chordProgression.length !== 1 ? "s" : ""} with{" "}
            {selectedInstrument?.name || "instrument"}
          </div>
        )}
      </div>
    </div>
  );
};

export default BackingTrackPanel;
