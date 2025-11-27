import mongoose from "mongoose";

const midiEventSchema = new mongoose.Schema(
  {
    pitch: { type: Number, min: 0, max: 127, required: true },
    startTime: { type: Number, min: 0, required: true },
    duration: { type: Number, min: 0 },
    velocity: { type: Number, min: 0, max: 1, default: 0.8 },
  },
  { _id: false }
);

const projectTimelineItemSchema = new mongoose.Schema(
  {
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectTrack",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startTime: { type: Number, required: true },
    duration: { type: Number, required: true },
    offset: { type: Number, default: 0 },
    loopEnabled: { type: Boolean, default: false },
    playbackRate: { type: Number, default: 1 },
    type: {
      type: String,
      enum: ["lick", "chord", "midi"],
      default: "lick",
      required: true,
    },
    lickId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lick",
    },
    sourceDuration: { type: Number },
    chordName: { type: String },
    rhythmPatternId: { type: String },
    isCustomized: { type: Boolean, default: false },
    customMidiEvents: [midiEventSchema],
    audioUrl: { type: String }, // URL to audio file (Cloudinary or local)
    waveformData: { type: mongoose.Schema.Types.Mixed }, // Waveform visualization data
  },
  { timestamps: false }
);

projectTimelineItemSchema.index({ trackId: 1, startTime: 1 });

const ProjectTimelineItem = mongoose.model(
  "ProjectTimelineItem",
  projectTimelineItemSchema
);
export default ProjectTimelineItem;
