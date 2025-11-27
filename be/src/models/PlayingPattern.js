import mongoose from 'mongoose';

// Schema for individual note events in the rhythm pattern
const noteEventSchema = new mongoose.Schema(
  {
    beat: { type: Number, required: true }, // Beat position (0-based)
    subdivision: { type: Number, default: 0 }, // Subdivision within the beat (0 = on beat, 0.5 = halfway)
    velocity: { type: Number, min: 0, max: 1, default: 0.8 },
    duration: { type: Number, default: 0.5 }, // Duration in beats
    noteOffset: { type: Number, default: 0 }, // Offset from root note (for arpeggios)
  },
  { _id: false }
);

const playingPatternSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String },
    patternType: {
      type: String,
      enum: ['block', 'arpeggiated', 'strumming', 'bass', 'custom'],
      default: 'block',
    },
    timeDivision: {
      type: String,
      enum: ['whole', 'half', 'quarter', 'eighth', 'sixteenth'],
      default: 'quarter',
    },
    beatsPerPattern: { type: Number, default: 4 }, // Number of beats the pattern spans
    noteEvents: [noteEventSchema], // Array of note events
    // Legacy field for backwards compatibility
    patternData: { type: String },
  },
  { timestamps: false }
);

const PlayingPattern = mongoose.model('PlayingPattern', playingPatternSchema);
export default PlayingPattern;
