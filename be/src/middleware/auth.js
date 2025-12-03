import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { verifyToken as verifyJWT } from '../utils/jwt.js';

// Middleware xác thực token
export const verifyToken = async (req, res, next) => {
  // Lấy token từ header Authorization (case-insensitive)
  const authHeader = req.headers.authorization || req.headers.Authorization;
  
  // Debug logging
  if (!authHeader) {
    console.error('[verifyToken] No Authorization header found');
    return res.status(401).json({ message: 'Không tìm thấy access token' });
  }

  // Extract Bearer token - trim whitespace and handle edge cases
  const trimmedHeader = authHeader.trim();
  const parts = trimmedHeader.split(/\s+/); // Split by any whitespace (space, tab, etc.)

  console.log('[verifyToken] Header first 100 chars:', trimmedHeader.substring(0, 100));
  
  // Check if starts with Bearer (case-insensitive)
  if (parts.length < 2 || parts[0].toLowerCase() !== 'bearer') {
    console.error('[verifyToken] Invalid Authorization header format. Expected: "Bearer <token>"');
    console.error('[verifyToken] Received format:', parts[0] || 'empty');
    console.error('[verifyToken] Full header (first 100 chars):', trimmedHeader.substring(0, 100));
    return res.status(401).json({ 
      message: 'Invalid Authorization header format. Expected: "Bearer <token>"',
      received: parts[0] || 'empty'
    });
  }

  // Get token (everything after "Bearer")
  const token = trimmedHeader.substring(7).trim(); // Remove "Bearer " prefix
  
  if (!token || token.trim() === '') {
    console.error('[verifyToken] Token is empty');
    return res.status(401).json({ message: 'Không tìm thấy access token' });
  }

  try {
    // Xác thực token
    const decoded = verifyJWT(token);
    if (!decoded) {
      console.error('[verifyToken] Token verification failed - invalid or expired');
      return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    // Kiểm tra xem user có bị khóa không
    const userId = decoded.userId || decoded.id;
    const user = await User.findById(userId).select('isActive email');
    console.log('[verifyToken] Checking user isActive:', user?.email, 'isActive:', user?.isActive);
    if (!user || !user.isActive) {
      console.log('[verifyToken] User account is locked or not found:', user?.email);
      return res.status(403).json({ 
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.' 
      });
    }

    // Lưu thông tin user vào request để sử dụng ở các middleware khác
    req.userId = userId;
    req.userRole = decoded.roleId || decoded.role;
    
    next();
  } catch (error) {
    console.error('[verifyToken] Token verification error:', error.message);
    return res.status(403).json({ message: 'Token không hợp lệ' });
  }
};

// Middleware kiểm tra quyền admin
export const isAdmin = async (req, res, next) => {
  try {
    // If userRole is already set and is 'admin', allow access
    if (req.userRole && req.userRole.toLowerCase() === 'admin') {
      return next();
    }
    
    // If userRole is not set or not 'admin', check database to be sure
    if (req.userId) {
      const User = (await import('../models/User.js')).default;
      const user = await User.findById(req.userId).select('roleId');
      
      if (user && user.roleId === 'admin') {
        // Update req.userRole for consistency
        req.userRole = 'admin';
        return next();
      }
      
      return res.status(403).json({ 
        success: false,
        message: 'Yêu cầu quyền admin' 
      });
    }
    
    return res.status(403).json({ 
      success: false,
      message: 'Yêu cầu quyền admin' 
    });
  } catch (error) {
    console.error('Error checking admin role:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Lỗi kiểm tra quyền admin' 
    });
  }
};

// Middleware kiểm tra quyền user thông thường
export const isUser = (req, res, next) => {
  if (req.userRole !== 'user' && req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Yêu cầu đăng nhập' });
  }
  next();
};

// Middleware kiểm tra quyền dựa trên tài nguyên và hành động
export const checkPermission = (resource, action) => (req, res, next) => {
  // Tạm thời cho phép tất cả request qua
  next();
};

// Optional auth: nếu có Authorization thì verify và gán req.userId, nếu không thì bỏ qua
export const optionalVerifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return next();
  try {
    const trimmedHeader = authHeader.trim();
    const parts = trimmedHeader.split(/\s+/);
    if (parts.length >= 2 && parts[0].toLowerCase() === 'bearer') {
      const token = trimmedHeader.substring(7).trim();
      if (token) {
        const decoded = verifyJWT(token);
        if (decoded) {
          req.userId = decoded.userId || decoded.id;
          req.userRole = decoded.roleId || decoded.role;
        }
      }
    }
  } catch {}
  next();
};

export default {
  verifyToken,
  isAdmin,
  isUser,
  checkPermission,
  optionalVerifyToken
};
