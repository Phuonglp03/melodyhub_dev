import mongoose from 'mongoose';

const collectionLickSchema = new mongoose.Schema(
  {
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true },
    lickId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lick', required: true },
    position: { type: Number },
  },
  { timestamps: { createdAt: 'addedAt', updatedAt: false } }
);

collectionLickSchema.index({ collectionId: 1, lickId: 1 }, { unique: true });

const CollectionLick = mongoose.model('CollectionLick', collectionLickSchema);
export default CollectionLick;


