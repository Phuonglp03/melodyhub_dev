import express from 'express';
import { body, query } from 'express-validator';
import { adminGetUsers, adminUpdateUser, adminToggleUserLock } from '../../controllers/admin/userManagement.js';
import { verifyToken, isAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';

const router = express.Router();

// Apply admin middleware to all routes
router.use(verifyToken, isAdmin);
// Require manage_users permission (Super Admin và User Support)
router.use(requirePermission('manage_users'));

// GET /api/admin/users - Get all users with filtering and pagination
router.get('/users',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Trang phải là số dương'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Giới hạn phải từ 1 đến 100'),
    query('search').optional().trim(),
    query('status').optional().isIn(['active', 'locked']).withMessage('Trạng thái không hợp lệ'), 
    query('role').optional().isIn(['user', 'admin']).withMessage('Vai trò không hợp lệ'),
    query('sortBy').optional().isIn(['username', 'email', 'createdAt']).withMessage('Trường sắp xếp không hợp lệ'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Thứ tự sắp xếp không hợp lệ')
  ],
  adminGetUsers
);

// PATCH /api/admin/users/:userId/lock - Toggle user lock status
router.patch('/users/:userId/lock', adminToggleUserLock);

// PUT /api/admin/users/:userId - Update user details
router.put(
  '/users/:userId',
  [
    body('username').optional().trim().isLength({ min: 3, max: 30 }).withMessage('Tên đăng nhập phải từ 3 đến 30 ký tự'),
    body('email').optional().trim().isEmail().withMessage('Email không hợp lệ'),
    body('displayName').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Tên hiển thị phải từ 2 đến 100 ký tự'),
    body('birthday').optional().isISO8601().withMessage('Ngày sinh không hợp lệ'),
    body('roleId').optional().isIn(['user', 'admin']).withMessage('Vai trò không hợp lệ'),
    body('isActive').optional().isBoolean().withMessage('Trạng thái hoạt động không hợp lệ')
  ],
  adminUpdateUser
);

export default router;