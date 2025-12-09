import React from 'react';
import { FaTimes } from 'react-icons/fa';

// Helper function to convert MIDI number to note name
const midiToNoteName = (midiNumber) => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteName = noteNames[midiNumber % 12];
  return `${noteName}${octave}`;
};

// Convert array of MIDI numbers to note names
const midiArrayToNotes = (midiNotes) => {
  if (!midiNotes || !Array.isArray(midiNotes)) return '';
  return midiNotes.map(midi => midiToNoteName(midi)).join(', ');
};

/**
 * ChordProgressionDisplay - Shows selected chords with note names
 * Displays above the timeline for easy visibility
 */
const ChordProgressionDisplay = ({ chordProgression = [], onRemoveChord }) => {
  if (!chordProgression || chordProgression.length === 0) {
    return null; // Don't show anything if no chords
  }

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Chord Progression ({chordProgression.length} chords)
        </h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {chordProgression.map((chord, index) => {
          const chordName = chord?.chordName || chord?.name || `Chord ${index + 1}`;
          const midiNotes = chord?.midiNotes || [];
          const noteNames = midiArrayToNotes(midiNotes);
          
          return (
            <div
              key={index}
              className="group relative px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium shadow-sm transition-colors"
              title={noteNames}
            >
              <div className="font-bold text-white">{chordName}</div>
              {noteNames && (
                <div className="text-xs text-indigo-200 mt-0.5">{noteNames}</div>
              )}
              {onRemoveChord && (
                <button
                  onClick={() => onRemoveChord(index)}
                  className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove chord"
                >
                  <FaTimes size={8} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChordProgressionDisplay;
