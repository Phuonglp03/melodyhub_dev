// fe/src/components/ProjectChordDeck.js
// Chord input deck for ProjectDetailPage
import React from "react";
import { useSelector } from "react-redux";
import { getKeyDisplayName } from "../utils/musicTheory";

// Get diatonic chords for a key
const getDiatonicChords = (key) => {
  const notes = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  
  // Handle key as object (new format) or string (legacy format)
  let keyString;
  if (typeof key === "object" && key !== null) {
    // New format: { root, scale, name }
    const displayName = getKeyDisplayName(key);
    keyString = typeof displayName === "string" ? displayName : "C Major";
  } else {
    // Legacy format: string like "C Major" or "Am"
    keyString = typeof key === "string" ? key : "C Major";
  }
  
  // Ensure keyString is a string before calling string methods
  if (typeof keyString !== "string") {
    keyString = "C Major";
  }
  
  const keyIndex = notes.indexOf(keyString.replace("m", "").replace(" Major", "").replace(" Minor", "").split(" ")[0] || "C");
  const isMinor = keyString.toLowerCase().includes("minor") || (keyString.toLowerCase().includes("m") && !keyString.toLowerCase().includes("major"));

  if (isMinor) {
    const intervals = [0, 2, 3, 5, 7, 8, 10];
    const qualities = ["m7", "m7b5", "maj7", "m7", "m7", "maj7", "7"];
    return intervals.map(
      (interval, i) => notes[(keyIndex + interval) % 12] + qualities[i]
    );
  } else {
    const intervals = [0, 2, 4, 5, 7, 9, 11];
    const qualities = ["maj7", "m7", "m7", "maj7", "7", "m7", "m7b5"];
    return intervals.map(
      (interval, i) => notes[(keyIndex + interval) % 12] + qualities[i]
    );
  }
};

export default function ProjectChordDeck({
  selectedChordIndex,
  onChordSelect,
  onAddChord,
  projectKey,
}) {
  const diatonicChords = getDiatonicChords(projectKey);

  const isActive = selectedChordIndex !== null;

  return (
    <div className="h-24 bg-gray-900 border-t border-gray-800 px-3 py-2">
      <div className="h-full flex flex-col gap-3">
        {/* Diatonic Chords Row */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-[10px] w-14 uppercase tracking-wide">
            Diatonic
          </span>
          <div className="flex flex-wrap gap-1.5">
            {diatonicChords.map((chord) => (
              <button
                key={chord}
                onClick={() => {
                  console.log("(NO $) [DEBUG][ChordDeck] Chord button clicked:", chord);
                  onChordSelect(chord);
                }}
                className="px-2.5 py-1.5 bg-purple-600/90 hover:bg-purple-500 text-white text-xs font-semibold rounded-md transition-colors min-w-[52px]"
              >
                {chord}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-[10px] w-14 uppercase tracking-wide">
            Quick
          </span>
          <div className="flex gap-1.5">
            {isActive && (
              <>
                <button
                  onClick={() => onChordSelect("%")}
                  className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 text-xs"
                  title="Repeat previous chord"
                >
                  %
                </button>
                <button
                  onClick={() => onChordSelect("N.C.")}
                  className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 text-xs"
                  title="No Chord"
                >
                  N.C.
                </button>
              <button
                onClick={() => {
                  console.log("(NO $) [DEBUG][ChordDeck] Clear button clicked");
                  onChordSelect(""); // Pass empty string to clear chord
                }}
                className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 text-xs"
                title="Clear"
              >
                Clear
              </button>
              </>
            )}
            <button
              onClick={() => {
                console.log("(NO $) [DEBUG][ChordDeck] Add button clicked");
                onAddChord();
              }}
              className="px-2.5 py-1 bg-green-600 hover:bg-green-500 rounded text-white text-xs font-semibold"
              title="Add new chord"
            >
              + Add
            </button>
          </div>

          {/* Current position indicator */}
          {isActive ? (
            <div className="ml-auto text-gray-400 text-xs">
              Chord {selectedChordIndex + 1}
            </div>
          ) : (
            <div className="ml-auto text-gray-500 text-xs">
              Click a chord above to add, or click in progression to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
