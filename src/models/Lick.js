import mongoose from 'mongoose';

const lickSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    audioUrl: { type: String, required: true },
    waveformData: { type: String },
    duration: { type: Number },
    tabNotation: { type: String },
    key: { type: String },
    tempo: { type: Number },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    isPublic: { type: Boolean, default: true, required: true },
    isFeatured: { type: Boolean, default: false, required: true },
  },
  { timestamps: true }
);

lickSchema.index({ userId: 1 });
lickSchema.index({ createdAt: -1 });

const Lick = mongoose.model('Lick', lickSchema);
export default Lick;


