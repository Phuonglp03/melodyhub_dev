import express from 'express';
import { body, validationResult } from 'express-validator';
import { uploadImage } from '../config/cloudinary.js';
import { 
  getCurrentUserProfile, 
  getUserProfileById, 
  getUserProfileByUsername, 
  updateUserProfile,
  uploadAvatar,
  uploadCoverPhoto,
  followUser,
  unfollowUser,
  getFollowSuggestions,
  getFollowingList,
  searchUsers
} from '../controllers/userController.js';
import middlewareController from '../middleware/auth.js';
const { verifyToken, optionalVerifyToken } = middlewareController;

const router = express.Router();

// Input validation rules for profile update
const validateProfileUpdate = [
  body('displayName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Display name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Display name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\u00C0-\u1EF9\-_.,()]+$/)
    .withMessage('Display name contains invalid characters'),
    
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must be less than 500 characters'),
    
  body('birthday')
    .optional()
    .isISO8601()
    .withMessage('Please enter a valid date in YYYY-MM-DD format'),
    
  // Avatar và Cover Photo chỉ được upload qua file, không cho phép URL string
  body('avatarUrl')
    .optional()
    .custom((value) => {
      // Reject nếu có avatarUrl trong JSON body (chỉ cho phép upload file)
      if (value !== undefined && value !== null && value !== '') {
        throw new Error('Avatar can only be updated via file upload. Please use POST /api/users/profile/avatar endpoint.');
      }
      return true;
    }),

  body('coverPhotoUrl')
    .optional()
    .custom((value) => {
      // Reject nếu có coverPhotoUrl trong JSON body (chỉ cho phép upload file)
      if (value !== undefined && value !== null && value !== '') {
        throw new Error('Cover photo can only be updated via file upload. Please use POST /api/users/profile/cover-photo endpoint.');
      }
      return true;
    }),

  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'unspecified'])
    .withMessage('Gender must be male, female, other, or unspecified'),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must be less than 100 characters')
    // Cho phép thêm một số ký tự thường dùng trong địa chỉ VN như "/" và "#"
    // Ví dụ: "12/3 Lý Thường Kiệt, P.5, Q.10"
    .matches(/^[a-zA-Z0-9\s\u00C0-\u1EF9\-_,.()\/#]+$/)
    .withMessage('Location contains invalid characters'),
    
  body('privacyProfile')
    .optional()
    .isIn(['public', 'followers', 'private'])
    .withMessage('Privacy profile must be public, followers, or private'),
    
  body('theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('Theme must be light, dark, or auto'),
    
  body('language')
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language must be between 2 and 5 characters'),
    
  body('links')
    .optional()
    .isArray()
    .withMessage('Links must be an array'),
    
  body('links.*')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Each link must be less than 500 characters')
    .custom((value) => {
      // Cho phép empty string
      if (value === '' || value === null || value === undefined) {
        return true;
      }
      // Nếu có giá trị thì phải là URL hợp lệ
      try {
        const url = new URL(value);
        // Chỉ cho phép http, https
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Invalid protocol');
        }
        return true;
      } catch {
        return false;
      }
    })
    .withMessage('Each link must be a valid HTTP/HTTPS URL or empty')
];

// User profile routes

// GET /api/users/profile - Get current user's profile (requires authentication)
router.get('/profile', verifyToken, getCurrentUserProfile);

// GET /api/users/following - Get list of users that current user is following (requires authentication)
// MUST be before /:userId route to avoid conflict
router.get('/following', verifyToken, getFollowingList);

// GET /api/users/suggestions/list - Suggested users to follow (requires authentication)
router.get('/suggestions/list', verifyToken, getFollowSuggestions);

// GET /api/users/search?q=... - Search users by name or username (public, but parse token if provided)
router.get('/search', optionalVerifyToken, searchUsers);

// GET /api/users/:userId - Get user profile by user ID (public, but parse token if provided)
// MUST be after specific routes like /following and /suggestions/list
router.get('/:userId', optionalVerifyToken, getUserProfileById);

// GET /api/users/username/:username - Get user profile by username (public, but parse token if provided)
router.get('/username/:username', optionalVerifyToken, getUserProfileByUsername);

// Middleware để xử lý upload file nếu là multipart và skip validation
const handleFileUpload = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  req.isMultipart = contentType.includes('multipart/form-data');
  
  // Nếu là multipart/form-data, dùng multer để upload file lên Cloudinary
  if (req.isMultipart) {
    // Sử dụng .single('avatar') - chỉ nhận field 'avatar' là file
    // Multer sẽ throw error nếu có field không mong đợi, NHƯNG nó vẫn có thể đã process file trước đó
    const multerMiddleware = uploadImage.single('avatar');
    
    return multerMiddleware(req, res, (err) => {
      // Kiểm tra xem file đã được upload chưa (multer có thể đã process file trước khi throw error)
      const hasFile = !!req.file;
      
      // Nếu có lỗi nhưng đã có file, bỏ qua lỗi (chỉ cần file avatar)
      if (err && err.code === 'LIMIT_UNEXPECTED_FILE' && hasFile) {
        console.warn('⚠️ Multer unexpected field:', err.field, '- ignoring because avatar file was uploaded successfully');
        console.log('📸 File uploaded successfully despite unexpected field:', {
          path: req.file.path,
          secure_url: req.file.secure_url,
          url: req.file.url
        });
        return next(); // Tiếp tục vì file đã upload thành công
      }
      
      // Nếu có lỗi nhưng không có file
      if (err && err.code === 'LIMIT_UNEXPECTED_FILE' && !hasFile) {
        console.error('❌ Upload failed - unexpected field but no avatar file:', err.field);
        return res.status(400).json({
          success: false,
          message: `Unexpected field "${err.field}". Please send only "avatar" file field.`
        });
      }
      
      // Các lỗi khác
      if (err) {
        console.error('❌ File upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }
      
      // Thành công
      console.log('📸 File uploaded, req.file:', req.file ? {
        path: req.file.path,
        secure_url: req.file.secure_url,
        url: req.file.url,
        public_id: req.file.public_id,
        keys: Object.keys(req.file || {})
      } : 'No file');
      
      // Skip validation cho multipart
      return next();
    });
  }
  
  // Nếu là JSON, tiếp tục với validation
  next();
};

// Validation middleware - chỉ chạy khi không phải multipart
const conditionalValidation = (req, res, next) => {
  if (req.isMultipart) {
    // Skip validation cho multipart
    return next();
  }
  // Chạy validation cho JSON
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

// PUT /api/users/profile - Update current user's profile (requires authentication)
// Hỗ trợ cả JSON và multipart/form-data
router.put('/profile', verifyToken, handleFileUpload, conditionalValidation, updateUserProfile);

// POST /api/users/profile/avatar - Upload avatar image (requires authentication)
router.post('/profile/avatar', verifyToken, uploadImage.single('avatar'), uploadAvatar);

// POST /api/users/profile/cover-photo - Upload cover photo image (requires authentication)
router.post('/profile/cover-photo', verifyToken, uploadImage.single('coverPhoto'), uploadCoverPhoto);

// POST /api/users/:userId/follow - Follow a user (requires authentication)
router.post('/:userId/follow', verifyToken, followUser);

// DELETE /api/users/:userId/follow - Unfollow a user (requires authentication)
router.delete('/:userId/follow', verifyToken, unfollowUser);

export default router;
