import express from 'express';
import { body } from 'express-validator';
import { 
  login, 
  register, 
  refreshToken, 
  logout,
  verifyEmail,
  resendOTP,
  forgotPassword,
  resetPassword
} from '../controllers/authController.js';
import { googleLogin } from '../controllers/googleAuthController.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Đăng ký
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Email không hợp lệ'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
    body('fullName')
      .notEmpty()
      .withMessage('Vui lòng nhập họ tên')
  ],
  register
);

// Đăng nhập
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email không hợp lệ'),
    body('password').notEmpty().withMessage('Vui lòng nhập mật khẩu')
  ],
  login
);

// Đăng nhập bằng Google
router.post('/google', googleLogin);

// Làm mới token
router.post('/refresh-token', refreshToken);

// Đăng xuất
router.post('/logout', authMiddleware.verifyToken, logout);

// Xác thực email với OTP
router.post(
  '/verify-email',
  [
    body('email').isEmail().withMessage('Email không hợp lệ'),
    body('otp').notEmpty().withMessage('Vui lòng nhập mã OTP')
  ],
  verifyEmail
);

// Gửi lại OTP
router.post(
  '/resend-otp',
  [
    body('email').isEmail().withMessage('Email không hợp lệ')
  ],
  resendOTP
);

// Quên mật khẩu
router.post(
  '/forgot-password',
  [
    body('email').isEmail().withMessage('Email không hợp lệ')
  ],
  forgotPassword
);

// Đặt lại mật khẩu
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token không hợp lệ'),
    body('email').isEmail().withMessage('Email không hợp lệ'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Mật khẩu phải có ít nhất 6 ký tự')
  ],
  resetPassword
);

export default router;