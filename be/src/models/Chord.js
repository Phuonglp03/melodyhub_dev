import mongoose from 'mongoose';

const chordSchema = new mongoose.Schema(
  {
    chordName: { type: String, required: true, unique: true, trim: true },
    midiNotes: { type: String }, // JSON array of MIDI notes
  },
  { timestamps: false }
);

const Chord = mongoose.model('Chord', chordSchema);
export default Chord;
