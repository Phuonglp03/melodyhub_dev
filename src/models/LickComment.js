import mongoose from 'mongoose';

const lickCommentSchema = new mongoose.Schema(
  {
    lickId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lick', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: 'LickComment' },
    comment: { type: String, required: true },
    timestamp: { type: Number },
  },
  { timestamps: true }
);

lickCommentSchema.index({ lickId: 1, createdAt: -1 });

const LickComment = mongoose.model('LickComment', lickCommentSchema);
export default LickComment;


