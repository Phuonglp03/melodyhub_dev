// Middleware kiểm tra permissions cụ thể
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      // req.userId và req.userRole đã được set từ verifyToken middleware
      if (!req.userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Chưa đăng nhập' 
        });
      }

      // Import User model
      const User = (await import('../models/User.js')).default;
      
      // Lấy user với permissions
      const user = await User.findById(req.userId).select('+permissions');
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: 'Người dùng không tồn tại' 
        });
      }

      // Kiểm tra là admin
      if (user.roleId !== 'admin') {
        return res.status(403).json({ 
          success: false, 
          message: 'Yêu cầu quyền admin' 
        });
      }

      // Kiểm tra permissions
      const userPermissions = user.permissions || [];
      
      if (!userPermissions.includes(permission)) {
        return res.status(403).json({ 
          success: false, 
          message: `Không có quyền: ${permission}` 
        });
      }

      // Lưu permissions vào request để dùng ở các middleware/controller khác
      req.userPermissions = userPermissions;
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Lỗi kiểm tra quyền' 
      });
    }
  };
};

// Middleware kiểm tra một trong các permissions
export const requireAnyPermission = (...permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Chưa đăng nhập' 
        });
      }

      const User = (await import('../models/User.js')).default;
      const user = await User.findById(req.userId).select('+permissions');
      
      if (!user || user.roleId !== 'admin') {
        return res.status(403).json({ 
          success: false, 
          message: 'Yêu cầu quyền admin' 
        });
      }

      const userPermissions = user.permissions || [];
      const hasPermission = permissions.some(perm => userPermissions.includes(perm));
      
      if (!hasPermission) {
        return res.status(403).json({ 
          success: false, 
          message: `Không có quyền truy cập` 
        });
      }

      req.userPermissions = userPermissions;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Lỗi kiểm tra quyền' 
      });
    }
  };
};

