import mongoose from 'mongoose';

const roomChatSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveRoom', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    messageType: { type: String, enum: ['text', 'reaction', 'system'], default: 'text', required: true },
  },
  { timestamps: { createdAt: 'sentAt', updatedAt: false } }
);

const RoomChat = mongoose.model('RoomChat', roomChatSchema);
export default RoomChat;


