import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    postType: { type: String, enum: ['status_update', 'new_lick', 'new_project', 'shared_post'], required: true },
    textContent: { type: String },
    contentId: { type: mongoose.Schema.Types.ObjectId },
    contentType: { type: String, enum: ['lick', 'project'] },
    originalPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  },
  { timestamps: true }
);

postSchema.index({ userId: 1 });
postSchema.index({ createdAt: -1 });

const Post = mongoose.model('Post', postSchema);
export default Post;


