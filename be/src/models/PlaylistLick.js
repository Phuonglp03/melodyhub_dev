import mongoose from 'mongoose';

const playlistLickSchema = new mongoose.Schema(
  {
    playlistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Playlist', required: true },
    lickId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lick', required: true },
    position: { type: Number },
  },
  { timestamps: { createdAt: 'addedAt', updatedAt: false } }
);

playlistLickSchema.index({ playlistId: 1, lickId: 1 }, { unique: true });
// Index for efficient position queries when adding licks to playlists
playlistLickSchema.index({ playlistId: 1, position: -1 });

const PlaylistLick = mongoose.model('PlaylistLick', playlistLickSchema);
export default PlaylistLick;
