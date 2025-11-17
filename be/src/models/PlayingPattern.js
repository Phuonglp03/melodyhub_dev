import mongoose from 'mongoose';

const playingPatternSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    patternData: { type: String }, // Data describing the playing style
  },
  { timestamps: false }
);

const PlayingPattern = mongoose.model('PlayingPattern', playingPatternSchema);
export default PlayingPattern;
