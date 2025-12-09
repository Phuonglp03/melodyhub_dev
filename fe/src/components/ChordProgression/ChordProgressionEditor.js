import React from "react";
import ChordBlock from "../ChordBlock";

/**
 * ChordProgressionEditor - Editor for chord progression
 *
 * Props:
 * - chordProgression: Array - array of chord entries
 * - selectedChordIndex: number | null - currently selected chord index
 * - onChordSelect: (chord: Object, index: number) => void - callback when chord is selected
 * - onChordRemove: (index: number) => void - callback when chord is removed
 * - pixelsPerBeat: number - pixels per beat for rendering
 * - className?: string - optional custom classes
 */
const ChordProgressionEditor = ({
  chordProgression = [],
  selectedChordIndex,
  onChordSelect,
  onChordRemove,
  pixelsPerBeat,
  className = "",
}) => {
  const chordWidth = 4 * pixelsPerBeat; // 4 beats per chord

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {chordProgression.map((entry, index) => {
        const chordName =
          entry?.chordName || entry?.chord || `Chord ${index + 1}`;
        const isSelected = selectedChordIndex === index;

        return (
          <div
            key={`chord-${index}`}
            className="relative"
            style={{ width: `${chordWidth}px` }}
          >
            <ChordBlock
              chord={chordName}
              isSelected={isSelected}
              onClick={() => onChordSelect?.(entry, index)}
              onRemove={() => onChordRemove?.(index)}
            />
          </div>
        );
      })}
    </div>
  );
};

export default ChordProgressionEditor;
