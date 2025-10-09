import mongoose from 'mongoose';

const backingTrackSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['system', 'user'], required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, required: true },
    genre: { type: String },
    key: { type: String },
    tempo: { type: Number },
    audioUrl: { type: String, required: true },
    duration: { type: Number },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

const BackingTrack = mongoose.model('BackingTrack', backingTrackSchema);
export default BackingTrack;


