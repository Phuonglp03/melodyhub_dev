import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
  ensureConversationWith,
  acceptRequest,
  declineRequest,
  listConversations,
  listMessages,
  sendMessage,
  markSeen
} from '../controllers/dmController.js';

const router = express.Router();

router.use(verifyToken);

// Create or get conversation with peer (auto creates pending if one-way follow)
router.post('/conversations/:peerId', ensureConversationWith);

// Accept/decline message request
router.post('/conversations/:id/accept', acceptRequest);
router.post('/conversations/:id/decline', declineRequest);

// List conversations
router.get('/conversations', listConversations);

// Read messages (paginated)
router.get('/conversations/:id/messages', listMessages);

// Send message
router.post('/conversations/:id/messages', sendMessage);

// Mark seen
router.post('/conversations/:id/seen', markSeen);

export default router;





