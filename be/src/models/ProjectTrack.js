import mongoose from "mongoose";

const projectTrackSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    trackName: { type: String, default: "New Track" },
    trackOrder: { type: Number, default: 0 },
    trackType: {
      type: String,
      enum: ["audio", "midi", "backing"],
      default: "audio",
    },
    instrument: {
      instrumentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Instrument",
      },
      settings: { type: Map, of: mongoose.Schema.Types.Mixed },
    },
    defaultRhythmPatternId: { type: String },
    color: { type: String, default: "#2563eb" },
    volume: { type: Number, default: 1.0, required: true },
    pan: { type: Number, default: 0.0, required: true },
    muted: { type: Boolean, default: false, required: true },
    solo: { type: Boolean, default: false, required: true },
    // Deprecated but kept for backwards compatibility with existing clients
    isBackingTrack: { type: Boolean, default: false },
  },
  { timestamps: false }
);

projectTrackSchema.index({ projectId: 1, trackOrder: 1 });
projectTrackSchema.index({ projectId: 1, trackType: 1 });
projectTrackSchema.index({ projectId: 1, isBackingTrack: 1 });

const ProjectTrack = mongoose.model("ProjectTrack", projectTrackSchema);
export default ProjectTrack;
