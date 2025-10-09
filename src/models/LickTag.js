import mongoose from 'mongoose';

const lickTagSchema = new mongoose.Schema(
  {
    lickId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lick', required: true },
    tagId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tag', required: true },
  },
  { timestamps: false }
);

lickTagSchema.index({ lickId: 1, tagId: 1 }, { unique: true });

const LickTag = mongoose.model('LickTag', lickTagSchema);
export default LickTag;


