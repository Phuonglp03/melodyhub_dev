import express from 'express';
import { body, validationResult } from 'express-validator';
import { uploadImage } from '../../config/cloudinary.js';
import { 
  getAdminProfile, 
  updateAdminProfile,
  uploadAdminAvatar,
  uploadAdminCoverPhoto
} from '../../controllers/admin/adminProfileController.js';
import { verifyToken, isAdmin } from '../../middleware/auth.js';

const router = express.Router();

// Apply admin middleware to all routes
router.use(verifyToken, isAdmin);

// Input validation rules for profile update
const validateProfileUpdate = [
  body('displayName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Tên hiển thị không được để trống')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên hiển thị phải từ 2 đến 100 ký tự'),
    
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio không được quá 500 ký tự'),
    
  body('birthday')
    .optional()
    .isISO8601()
    .withMessage('Vui lòng nhập ngày hợp lệ theo định dạng YYYY-MM-DD'),
    
  body('avatarUrl')
    .optional()
    .custom((value) => {
      if (value !== undefined && value !== null && value !== '') {
        throw new Error('Avatar chỉ có thể cập nhật qua upload file.');
      }
      return true;
    }),

  body('coverPhotoUrl')
    .optional()
    .custom((value) => {
      if (value !== undefined && value !== null && value !== '') {
        throw new Error('Cover photo chỉ có thể cập nhật qua upload file.');
      }
      return true;
    }),

  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'unspecified'])
    .withMessage('Giới tính phải là male, female, other, hoặc unspecified'),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Địa điểm không được quá 100 ký tự'),
    
  body('theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('Theme phải là light, dark, hoặc auto'),
    
  body('language')
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage('Ngôn ngữ phải từ 2 đến 5 ký tự'),
    
  body('links')
    .optional()
    .isArray()
    .withMessage('Links phải là một mảng'),
    
  body('links.*')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Mỗi link không được quá 500 ký tự')
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true;
      }
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Invalid protocol');
        }
        return true;
      } catch {
        return false;
      }
    })
    .withMessage('Mỗi link phải là URL HTTP/HTTPS hợp lệ hoặc để trống'),

  body('emailNotifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications phải là boolean'),

  body('pushNotifications')
    .optional()
    .isBoolean()
    .withMessage('Push notifications phải là boolean')
];

// Middleware để xử lý upload file nếu là multipart và skip validation
const handleFileUpload = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  req.isMultipart = contentType.includes('multipart/form-data');
  
  if (req.isMultipart) {
    const multerMiddleware = uploadImage.single('avatar');
    
    return multerMiddleware(req, res, (err) => {
      const hasFile = !!req.file;
      
      if (err && err.code === 'LIMIT_UNEXPECTED_FILE' && hasFile) {
        console.warn('⚠️ Multer unexpected field:', err.field, '- ignoring because avatar file was uploaded successfully');
        return next();
      }
      
      if (err && err.code === 'LIMIT_UNEXPECTED_FILE' && !hasFile) {
        return res.status(400).json({
          success: false,
          message: `Unexpected field "${err.field}". Please send only "avatar" file field.`
        });
      }
      
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }
      
      return next();
    });
  }
  
  next();
};

// Validation middleware - chỉ chạy khi không phải multipart
const conditionalValidation = (req, res, next) => {
  if (req.isMultipart) {
    return next();
  }
  return Promise.all(
    validateProfileUpdate.map(validator => validator.run(req))
  ).then(() => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }).catch(next);
};

// GET /api/admin/profile - Get current admin's profile
router.get('/profile', getAdminProfile);

// PUT /api/admin/profile - Update current admin's profile (supports JSON and multipart/form-data)
router.put('/profile', handleFileUpload, conditionalValidation, updateAdminProfile);

// POST /api/admin/profile/avatar - Upload avatar image
router.post('/profile/avatar', uploadImage.single('avatar'), uploadAdminAvatar);

// POST /api/admin/profile/cover-photo - Upload cover photo image
router.post('/profile/cover-photo', uploadImage.single('coverPhoto'), uploadAdminCoverPhoto);

export default router;

