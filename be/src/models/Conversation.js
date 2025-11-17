import mongoose from 'mongoose';

// Conversation between exactly two participants
// status: 'pending' -> message request; 'active' -> accepted; 'declined' (optional)
const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
      validate: {
        validator: function (arr) {
          return Array.isArray(arr) && arr.length === 2;
        },
        message: 'Conversation must have exactly two participants'
      }
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'declined'],
      default: 'pending',
      required: true
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastMessage: { type: String },
    lastMessageAt: { type: Date },
    // Map<userIdString, number>
    unreadCounts: { type: Map, of: Number, default: {} }
  },
  { timestamps: true }
);

// Ensure unique conversation per pair regardless of order
// IMPORTANT: Do NOT use unique index on array field directly (multikey unique),
// it would enforce per-element uniqueness and block any two docs sharing an element.
// Instead, enforce uniqueness on fixed positions after sorting [min, max].
conversationSchema.index({ 'participants.0': 1, 'participants.1': 1 }, { unique: true });
conversationSchema.index({ lastMessageAt: -1 });

// Best-effort migrate: drop legacy wrong index if it exists (participants_1)
try {
  import('mongoose').then(({ default: mongoose }) => {
    mongoose.connection?.on('open', async () => {
      try {
        const coll = mongoose.connection.collection('conversations');
        const indexes = await coll.indexes();
        const legacy = indexes.find((i) => i.name === 'participants_1' && i.unique);
        if (legacy) {
          await coll.dropIndex('participants_1');
        }
      } catch {}
    });
  });
} catch {}

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;





