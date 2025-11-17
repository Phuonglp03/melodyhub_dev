import mongoose from 'mongoose';

const directMessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Text storage: hybrid approach
    // - Tin ngắn (< 500 chars): lưu trong 'text' field
    // - Tin dài (>= 500 chars): lưu trong Cloudinary, chỉ giữ URL trong 'textStorageId'
    text: { type: String }, // Full text nếu ngắn, null nếu dài
    textStorageId: { type: String }, // Cloudinary URL nếu tin dài
    textStorageType: { 
      type: String, 
      enum: ['mongodb', 'cloudinary'],
      default: 'mongodb'
    },
    textPreview: { type: String }, // Preview 100 ký tự đầu (cho sidebar)
    
    // basic status timestamps
    deliveredAt: { type: Date },
    seenAt: { type: Date }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

directMessageSchema.index({ conversationId: 1, createdAt: -1 });

const DirectMessage = mongoose.model('DirectMessage', directMessageSchema);
export default DirectMessage;





