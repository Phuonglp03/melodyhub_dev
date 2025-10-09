import mongoose from 'mongoose';

const userFollowSchema = new mongoose.Schema(
  {
    followerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    followingId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

userFollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

const UserFollow = mongoose.model('UserFollow', userFollowSchema);
export default UserFollow;


