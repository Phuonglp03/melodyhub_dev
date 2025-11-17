import mongoose from "mongoose";

const contentTagSchema = new mongoose.Schema(
  {
    tagId: { type: mongoose.Schema.Types.ObjectId, ref: "Tag", required: true },
    contentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    contentType: {
      type: String,
      enum: ["lick", "project", "playlist"],
      required: true,
    },
  },
  { timestamps: { createdAt: "addedAt", updatedAt: false } }
);

contentTagSchema.index(
  { tagId: 1, contentId: 1, contentType: 1 },
  { unique: true }
);

const ContentTag = mongoose.model("ContentTag", contentTagSchema);
export default ContentTag;
