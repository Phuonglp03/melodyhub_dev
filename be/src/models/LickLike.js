import mongoose from 'mongoose';

const lickLikeSchema = new mongoose.Schema(
  {
    lickId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lick', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

lickLikeSchema.index({ lickId: 1, userId: 1 }, { unique: true });

const LickLike = mongoose.model('LickLike', lickLikeSchema);
export default LickLike;


