import mongoose from 'mongoose';

const projectCollaboratorSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['viewer', 'contributor', 'admin'], default: 'viewer', required: true },
  },
  { timestamps: { createdAt: 'joinedAt', updatedAt: false } }
);

projectCollaboratorSchema.index({ projectId: 1, userId: 1 }, { unique: true });

const ProjectCollaborator = mongoose.model('ProjectCollaborator', projectCollaboratorSchema);
export default ProjectCollaborator;


