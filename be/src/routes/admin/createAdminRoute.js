// src/routes/createAdminRoute.js

import express from 'express';
import { body } from 'express-validator';
import { verifyToken, isAdmin } from '../../middleware/auth.js';
import { createAdminAccount } from '../../controllers/admin/createAdminAccount.js'; 

const router = express.Router();

// Áp dụng middleware admin cho tất cả các route trong file này
router.use(verifyToken, isAdmin); 

// POST /api/admin/create-admin - Tạo tài khoản Admin mới
router.post(
  '/create-admin',
  [
    // Frontend gửi: username, email, password, roleKey
    body('username').trim().isLength({ min: 3 }).withMessage('Username phải có ít nhất 3 ký tự'),
    body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
    // Validation này cần được xử lý ở frontend, nhưng giữ lại cho backend
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Mật khẩu xác nhận không khớp');
      }
      return true;
    }),
    // Role key phải nằm trong danh sách các vai trò đã định nghĩa
    body('roleKey').isIn(['super_admin', 'liveroom_admin', 'user_support'])
                    .withMessage('Vai trò Admin không hợp lệ')
  ],
  createAdminAccount
);

export default router;