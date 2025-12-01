import mongoose from "mongoose";
import { DEFAULT_KEY, DEFAULT_TIME_SIGNATURE } from "../utils/musicTheory.js";

const BandMemberSchema = new mongoose.Schema(
  {
    instanceId: { type: String, required: true },
    name: { type: String, default: "New Instrument" },
    type: {
      type: String,
      enum: [
        "drums",
        "bass",
        "piano",
        "guitar",
        "pad",
        "strings",
        "percussion",
      ],
      required: true,
    },
    soundBank: { type: String, default: "grand-piano" },
    role: {
      type: String,
      enum: ["rhythm", "bass", "comping", "lead", "pad", "arpeggiator"],
      default: "comping",
    },
    volume: { type: Number, default: 0.8, min: 0, max: 1 },
    pan: { type: Number, default: 0, min: -1, max: 1 },
    isMuted: { type: Boolean, default: false },
    isSolo: { type: Boolean, default: false },
  },
  { _id: false }
);

const BandSettingsSchema = new mongoose.Schema(
  {
    style: { type: String, default: "Swing" },
    swingAmount: { type: Number, default: 0.6, min: 0, max: 1 },
    members: [BandMemberSchema],
  },
  { _id: false }
);

const BarSchema = new mongoose.Schema(
  {
    chord: { type: String, default: "" },
    beatCount: { type: Number, default: 4 },
    subBeats: [
      {
        chord: String,
        beat: Number,
        duration: Number,
      },
    ],
  },
  { _id: false }
);

const SectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: {
      type: String,
      enum: ["Intro", "A", "B", "C", "Bridge", "Outro", "Solo"],
      default: "A",
    },
    bars: [BarSchema],
    repeat: { type: Number, default: 1 },
    mixOverride: {
      drumsMuted: { type: Boolean },
      bassMuted: { type: Boolean },
      style: { type: String },
    },
  },
  { _id: false }
);

const TimelineClipSchema = new mongoose.Schema(
  {
    instanceId: { type: String, required: true },
    lickId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lick",
      required: true,
    },
    startBar: { type: Number, required: true },
    duration: { type: Number, required: true },
    offset: { type: Number, default: 0 },
    name: String,
    key: String,
  },
  { _id: false }
);

const TimelineLaneSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    isMuted: { type: Boolean, default: false },
    isSolo: { type: Boolean, default: false },
    volume: { type: Number, default: 1 },
    clips: [TimelineClipSchema],
  },
  { _id: false }
);

const CollaboratorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: {
      type: String,
      enum: ["owner", "editor", "viewer"],
      default: "editor",
    },
    joinedAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: "Untitled Project",
    },
    description: { type: String },
    coverImageUrl: { type: String },
    tempo: { type: Number, default: 120, min: 30, max: 300 },
    key: {
      type: {
        root: { type: Number, min: 0, max: 11, default: DEFAULT_KEY.root },
        scale: { type: String, default: DEFAULT_KEY.scale },
        name: { type: String, default: DEFAULT_KEY.name },
      },
      default: () => ({ ...DEFAULT_KEY }),
    },
    timeSignature: {
      type: {
        numerator: {
          type: Number,
          min: 1,
          max: 32,
          default: DEFAULT_TIME_SIGNATURE.numerator,
        },
        denominator: {
          type: Number,
          min: 1,
          max: 32,
          default: DEFAULT_TIME_SIGNATURE.denominator,
        },
        name: { type: String, default: DEFAULT_TIME_SIGNATURE.name },
      },
      default: () => ({ ...DEFAULT_TIME_SIGNATURE }),
    },
    swingAmount: { type: Number, min: 0, max: 100, default: 0 },
    masterVolume: { type: Number, default: 1.0 },
    status: {
      type: String,
      enum: ["draft", "active", "completed", "inactive"],
      default: "draft",
      required: true,
    },
    isPublic: { type: Boolean, default: false, required: true },
    structure: { type: [SectionSchema], default: [] },
    bandSettings: {
      type: BandSettingsSchema,
      default: () => ({
        style: "Swing",
        swingAmount: 0.6,
        members: [
          {
            instanceId: "default-drums",
            type: "drums",
            role: "rhythm",
            soundBank: "jazz-kit",
            name: "Drums",
          },
          {
            instanceId: "default-bass",
            type: "bass",
            role: "bass",
            soundBank: "upright",
            name: "Bass",
          },
          {
            instanceId: "default-piano",
            type: "piano",
            role: "comping",
            soundBank: "grand-piano",
            name: "Piano",
          },
        ],
      }),
    },
    lickLanes: {
      type: [TimelineLaneSchema],
      default: () => [{ id: "lane-1", clips: [] }],
    },
    audioUrl: { type: String },
    waveformData: [Number],
    audioDuration: Number,
    collaborators: [CollaboratorSchema],
    isCollaborative: { type: Boolean, default: false },
    version: { type: Number, default: 2 },
    chordProgression: { type: [String], default: [] },
    backingInstrumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Instrument",
    },
    backingPlayingPatternId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlayingPattern",
    },
  },
  { timestamps: true }
);

projectSchema.index({ creatorId: 1, updatedAt: -1 });
projectSchema.index({ "collaborators.user": 1 });
projectSchema.index({ isPublic: 1, status: 1 });

const Project = mongoose.model("Project", projectSchema);
export default Project;
