import mongoose from 'mongoose';

const contentReportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetContentType: { type: String, enum: ['lick', 'project', 'comment', 'user', 'room', 'post'], required: true },
    targetContentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: ['spam', 'inappropriate', 'copyright', 'harassment', 'other'], required: true },
    description: { type: String },
    status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending', required: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

const ContentReport = mongoose.model('ContentReport', contentReportSchema);
export default ContentReport;


