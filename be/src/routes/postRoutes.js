import express from 'express';
import {
  createPost,
  getPosts,
  getPostsByUser,
  getPostById,
  updatePost,
  deletePost,
  restorePost,
  permanentlyDeletePost,
  getArchivedPosts,
  likePost,
  unlikePost,
  getPostStats,
  getPostLikes,
} from '../controllers/postController.js';
import middlewareController from '../middleware/auth.js';
import { 
  createPostComment,
  getPostComments,
  deletePostComment
} from '../controllers/postCommentController.js';
import { handlePostMediaUpload, handleUploadError } from '../middleware/file.js';

const router = express.Router();
const { verifyToken, optionalVerifyToken } = middlewareController;

// POST /api/posts - Create a new post with media upload (requires authentication)
router.post('/', verifyToken, (req, res, next) => {
  console.log('[POST /posts] Middleware - Content-Type:', req.headers['content-type']);
  console.log('[POST /posts] Middleware - UserId from token:', req.userId);
  console.log('[POST /posts] Middleware - Body keys before multer:', Object.keys(req.body || {}));
  next();
}, handlePostMediaUpload, (req, res, next) => {
  console.log('[POST /posts] After multer - Body keys:', Object.keys(req.body || {}));
  console.log('[POST /posts] After multer - userId from token:', req.userId);
  console.log('[POST /posts] After multer - postType:', req.body.postType);
  console.log('[POST /posts] After multer - Files:', req.files ? req.files.length : 0);
  next();
}, handleUploadError, createPost);

// GET /api/posts - Get all posts with pagination (optional auth to include isLiked)
router.get('/', optionalVerifyToken, getPosts);

// GET /api/posts/archived - Get archived posts for current user (requires authentication)
// MUST be before /:postId route to avoid matching "archived" as postId
router.get('/archived', verifyToken, getArchivedPosts);

// GET /api/posts/user/:userId - Get posts by user ID
router.get('/user/:userId', getPostsByUser);

// GET /api/posts/:postId - Get post by ID
router.get('/:postId', getPostById);

// GET /api/posts/:postId/stats - likesCount & commentsCount
router.get('/:postId/stats', getPostStats);

// GET /api/posts/:postId/likes - Get list of users who liked the post
router.get('/:postId/likes', getPostLikes);

// PUT /api/posts/:postId - Update post with media upload
router.put('/:postId', handlePostMediaUpload, handleUploadError, updatePost);

// DELETE /api/posts/:postId - Archive post (requires authentication)
router.delete('/:postId', verifyToken, deletePost);

// POST /api/posts/:postId/restore - Restore archived post (requires authentication)
router.post('/:postId/restore', verifyToken, restorePost);

// DELETE /api/posts/:postId/permanent - Permanently delete archived post (requires authentication)
router.delete('/:postId/permanent', verifyToken, permanentlyDeletePost);

// POST /api/posts/:postId/like - like a post
router.post('/:postId/like', verifyToken, likePost);

// DELETE /api/posts/:postId/like - unlike a post
router.delete('/:postId/like', verifyToken, unlikePost);

// COMMENTS
// POST /api/posts/:postId/comments - create comment
router.post('/:postId/comments', verifyToken, createPostComment);

// GET /api/posts/:postId/comments - list comments (parent or replies via ?parentCommentId=)
router.get('/:postId/comments', getPostComments);

// DELETE /api/posts/:postId/comments/:commentId - delete comment (owner/admin)
router.delete('/:postId/comments/:commentId', verifyToken, deletePostComment);

export default router;
