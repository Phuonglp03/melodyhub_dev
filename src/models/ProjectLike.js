import mongoose from 'mongoose';

const projectLikeSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

projectLikeSchema.index({ projectId: 1, userId: 1 }, { unique: true });

const ProjectLike = mongoose.model('ProjectLike', projectLikeSchema);
export default ProjectLike;


