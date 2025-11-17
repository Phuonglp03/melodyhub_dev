import mongoose from 'mongoose';

const instrumentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    soundfontKey: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: false }
);

const Instrument = mongoose.model('Instrument', instrumentSchema);
export default Instrument;
