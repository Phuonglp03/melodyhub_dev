import mongoose from 'mongoose';

const projectCommentSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Number },
    comment: { type: String, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

const ProjectComment = mongoose.model('ProjectComment', projectCommentSchema);
export default ProjectComment;


