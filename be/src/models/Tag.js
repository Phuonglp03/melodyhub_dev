import mongoose from "mongoose";

const { Schema } = mongoose;

// Canonical tag catalog
// - name is stored lowercased and trimmed to enforce uniqueness per type
// - unique compound index (type, name)
// - timestamps for auditability
const TagSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, lowercase: true },
    type: {
      type: String,
      required: true,
      enum: [
        "genre",
        "instrument",
        "mood",
        "timbre",
        "articulation",
        "character",
        "user_defined",
      ],
    },
  },
  { timestamps: true }
);

TagSchema.index({ type: 1, name: 1 }, { unique: true });

const Tag = mongoose.models.Tag || mongoose.model("Tag", TagSchema);
export default Tag;
