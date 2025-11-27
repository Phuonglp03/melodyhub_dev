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
  resetPassword,
  changePassword
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
      .withMessage('Vui lòng nhập họ tên'),
    body('gender')
      .isIn(['male', 'female', 'other'])
      .withMessage('Vui lòng chọn giới tính hợp lệ'),
    body('addressLine')
      .isString()
      .notEmpty()
      .withMessage('Vui lòng nhập địa chỉ chi tiết'),
    body('provinceCode')
      .notEmpty()
      .withMessage('Vui lòng chọn tỉnh/thành phố'),
    body('provinceName')
      .notEmpty()
      .withMessage('Vui lòng chọn tỉnh/thành phố'),
    body('districtCode')
      .notEmpty()
      .withMessage('Vui lòng chọn quận/huyện'),
    body('districtName')
      .notEmpty()
      .withMessage('Vui lòng chọn quận/huyện'),
    body('wardCode')
      .notEmpty()
      .withMessage('Vui lòng chọn phường/xã'),
    body('wardName')
      .notEmpty()
      .withMessage('Vui lòng chọn phường/xã')
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

// Đổi mật khẩu (yêu cầu đăng nhập)
router.post(
  '/change-password',
  authMiddleware.verifyToken,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Vui lòng nhập mật khẩu hiện tại'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Mật khẩu phải có ít nhất 6 ký tự')
  ],
  changePassword
);

export default router;