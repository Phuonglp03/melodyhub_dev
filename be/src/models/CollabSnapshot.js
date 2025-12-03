import mongoose from "mongoose";

const CollabSnapshotSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
      unique: true,
    },
    version: {
      type: Number,
      default: 0,
      min: 0,
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ops: {
      type: [
        {
          version: Number,
          type: String,
          payload: mongoose.Schema.Types.Mixed,
          senderId: String,
          timestamp: Number,
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const CollabSnapshot =
  mongoose.models.CollabSnapshot ||
  mongoose.model("CollabSnapshot", CollabSnapshotSchema);

export default CollabSnapshot;






