import mongoose from 'mongoose';

const tagSchema = new mongoose.Schema(
  {
    tagName: { type: String, required: true, unique: true, trim: true },
    tagType: { type: String, enum: ['genre', 'instrument', 'mood', 'user_defined'], required: true },
  },
  { timestamps: false }
);

const Tag = mongoose.model('Tag', tagSchema);
export default Tag;


