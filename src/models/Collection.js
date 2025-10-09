import mongoose from 'mongoose';

const collectionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    coverImageUrl: { type: String },
    isPublic: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

const Collection = mongoose.model('Collection', collectionSchema);
export default Collection;


