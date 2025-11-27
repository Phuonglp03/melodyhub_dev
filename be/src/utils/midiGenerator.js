import MidiWriter from 'midi-writer-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate a MIDI file from chord progression
 * @param {Array} chords - Array of chord objects with midiNotes and chordName
 * @param {Object} options - Generation options
 * @returns {Object} - {filepath, filename, url}
 */
export const generateMIDIFile = async (chords, options = {}) => {
  try {
    const {
      tempo = 120,
      chordDuration = 4, // beats per chord
      instrumentProgram = 0, // 0 = Acoustic Grand Piano
      outputDir = path.join(__dirname, '../../uploads/midi'),
      projectId = 'unknown',
    } = options;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create a new MIDI track
    const track = new MidiWriter.Track();

    // Set tempo
    track.setTempo(tempo);

    // Set time signature (4/4)
    track.setTimeSignature(4, 4);

    // Set instrument
    track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: instrumentProgram + 1 }));

    // Add each chord as simultaneous notes
    chords.forEach((chord) => {
      const midiNotes = Array.isArray(chord.midiNotes) ? chord.midiNotes : [];
      
      if (midiNotes.length > 0) {
        // Create note event for the chord (all notes play simultaneously)
        const noteEvent = new MidiWriter.NoteEvent({
          pitch: midiNotes, // Array of MIDI note numbers
          duration: `${chordDuration}`, // Duration in quarter notes ('4' = whole note, '2' = half, '1' = quarter)
          velocity: 80,
        });
        
        track.addEvent(noteEvent);
      }
    });

    // Generate MIDI file
    const writer = new MidiWriter.Writer(track);
    const midiData = writer.buildFile();

    // Save to file
    const filename = `backing_${projectId}_${Date.now()}.mid`;
    const filepath = path.join(outputDir, filename);
    
    fs.writeFileSync(filepath, midiData, 'binary');

    return {
      filepath,
      filename,
      url: `/uploads/midi/${filename}`, // Relative URL for frontend
      success: true,
    };

  } catch (error) {
    console.error('Error generating MIDI file:', error);
    throw error;
  }
};

/**
 * Apply rhythm pattern to chord MIDI notes
 * @param {Array} ch ordMidiNotes - Base MIDI notes for the chord
 * @param {Object} rhythmPattern - Pattern with timing information
 * @param {Number} chordDuration - Duration of chord in beats
 * @returns {Array} - Array of timed MIDI events
 */
export const applyRhythmPattern = (chordMidiNotes, rhythmPattern, chordDuration = 4) => {
  if (!rhythmPattern || !rhythmPattern.patternData) {
    // Default: play all notes together for full duration
    return chordMidiNotes.map((pitch) => ({
      pitch,
      startTime: 0,
      duration: chordDuration,
      velocity: 0.8,
    }));
  }

  const pattern = rhythmPattern.patternData;
  const events = [];

  // Pattern defines when notes should be played within the chord duration
  // Example: Arpeggio pattern plays notes sequentially
  if (pattern.type === 'arpeggio') {
    const noteInterval = chordDuration / chordMidiNotes.length;
    chordMidiNotes.forEach((pitch, index) => {
      events.push({
        pitch,
        startTime: index * noteInterval,
        duration: noteInterval,
        velocity: pattern.velocity || 0.8,
      });
    });
  } else {
    // Block chords: all notes together
    chordMidiNotes.forEach((pitch) => {
      events.push({
        pitch,
        startTime: 0,
        duration: chordDuration,
        velocity: pattern.velocity || 0.8,
      });
    });
  }

  return events;
};
