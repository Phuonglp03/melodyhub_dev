import mongoose from 'mongoose';

const playlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    coverImageUrl: { type: String },
    isPublic: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

const Playlist = mongoose.model('Playlist', playlistSchema);
export default Playlist;
