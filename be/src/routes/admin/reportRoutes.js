import express from 'express';
import { reportPost, getPostReports, checkPostReport, getAllReports, adminRestorePost, adminDeletePost } from '../../controllers/admin/reportController.js';
import { verifyToken, isAdmin } from '../../middleware/auth.js';

const router = express.Router();

// Get all reports (admin only) - MUST be before parameterized routes
router.get('/all', verifyToken, isAdmin, getAllReports);

// Report a post
router.post('/posts/:postId', verifyToken, reportPost);

// Check if current user has reported a post (MUST be before /posts/:postId)
router.get('/posts/:postId/check', verifyToken, checkPostReport);

// Admin restore post (admin only) - MUST be before /posts/:postId
router.post('/posts/:postId/restore', verifyToken, isAdmin, adminRestorePost);

// Admin delete post (admin only) - MUST be before GET /posts/:postId
router.delete('/posts/:postId', verifyToken, isAdmin, adminDeletePost);

// Get reports for a post (admin only - can add admin middleware later)
router.get('/posts/:postId', verifyToken, getPostReports);

export default router;

