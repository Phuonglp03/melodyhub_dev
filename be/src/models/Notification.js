import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like_lick', 'comment_lick', 'follow', 'project_invite', 'system', 'like_post', 'comment_post'], required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Người thực hiện hành động (người like, comment, follow)
    message: { type: String }, // Nội dung thông báo bằng tiếng Việt
    linkUrl: { type: String },
    isRead: { type: Boolean, default: false, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;


