import mongoose from 'mongoose';

const liveRoomSchema = new mongoose.Schema(
  {
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String },
    streamKey: { type: String },
    status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled', required: true },
    isPublic: { type: Boolean, default: true, required: true },
    recordingUrl: { type: String },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

const LiveRoom = mongoose.model('LiveRoom', liveRoomSchema);
export default LiveRoom;


