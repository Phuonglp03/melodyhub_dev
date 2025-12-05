import mongoose from "mongoose";

const lickSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    audioUrl: { type: String, required: true },
    waveformData: { type: [Number], default: [] },
    duration: { type: Number },
    tabNotation: { type: String },
    key: { type: String },
    tempo: { type: Number },
    status: {
      type: String,
      enum: ["draft", "active", "inactive", "pending"],
      default: "draft",
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
    },
    isPublic: { type: Boolean, default: false, required: true },
    isFeatured: { type: Boolean, default: false, required: true },
  },
  { timestamps: true }
);

lickSchema.index({ userId: 1 });
lickSchema.index({ createdAt: -1 });
// Compound index for efficient queries on isPublic and userId (used in playlist validation)
lickSchema.index({ isPublic: 1, userId: 1 });
// Text index for efficient search on title and description
lickSchema.index({ title: "text", description: "text" });

const Lick = mongoose.model("Lick", lickSchema);
export default Lick;
