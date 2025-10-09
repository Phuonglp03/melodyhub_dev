import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    coverImageUrl: { type: String },
    tempo: { type: Number, default: 120 },
    key: { type: String },
    timeSignature: { type: String, default: '4/4' },
    status: { type: String, enum: ['draft', 'active', 'completed', 'archived'], default: 'draft', required: true },
    isPublic: { type: Boolean, default: false, required: true },
  },
  { timestamps: true }
);

projectSchema.index({ creatorId: 1 });

const Project = mongoose.model('Project', projectSchema);
export default Project;


