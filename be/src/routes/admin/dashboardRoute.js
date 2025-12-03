import express from 'express';
import { getDashboardStats, getRecentActivities } from '../../controllers/admin/dashboardController.js';
import { verifyToken, isAdmin } from '../../middleware/auth.js';

const router = express.Router();

// Apply admin middleware to all routes
router.use(verifyToken, isAdmin);

// GET /api/admin/dashboard/stats - Get dashboard statistics
router.get('/stats', getDashboardStats);

// GET /api/admin/dashboard/activities - Get recent activities
router.get('/activities', getRecentActivities);

export default router;

