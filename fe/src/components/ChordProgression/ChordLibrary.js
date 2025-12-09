import React from "react";
import ChordBlock from "../ChordBlock";

/**
 * ChordLibrary - Library of available chords
 *
 * Props:
 * - chordPalette: Array - array of available chords
 * - selectedKey: string - currently selected key filter
 * - showComplexChords: boolean - whether to show complex chords
 * - onChordSelect: (chord: Object) => void - callback when chord is selected
 * - onLoadComplexChords: () => void - callback to load complex chords
 * - className?: string - optional custom classes
 */
const ChordLibrary = ({
  chordPalette = [],
  selectedKey,
  showComplexChords = false,
  onChordSelect,
  onLoadComplexChords,
  className = "",
}) => {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Chord Library</h3>
        {!showComplexChords && (
          <button
            onClick={onLoadComplexChords}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Show complex chords
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {chordPalette.map((chord, index) => {
          const chordName = chord.chordName || chord.name || `Chord ${index}`;
          return (
            <ChordBlock
              key={`library-${chordName}-${index}`}
              chord={chordName}
              onClick={() => onChordSelect?.(chord)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ChordLibrary;
