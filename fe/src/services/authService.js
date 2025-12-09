import api from './api';

// Các hàm xử lý đăng nhập, đăng ký, đăng xuất
export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    
    if (!response.data) {
      throw new Error('Không nhận được phản hồi từ máy chủ');
    }

    console.log('Login response:', response.data);

    // Xử lý dữ liệu trả về
    const { token, user, refreshToken } = response.data;
    
    if (token && user) {
      // Tạo đối tượng userData để trả về cho Redux
      const userData = {
        token,
        refreshToken,
        user: {
          id: user._id || user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          roleId: user.roleId,
          verifiedEmail: user.verifiedEmail,
          permissions: user.permissions || [], // ⭐ THÊM permissions
          avatarUrl: user.avatarUrl
        }
      };
      
      // Note: Redux persist will automatically save to localStorage
      // Legacy localStorage is kept for backward compatibility only
      localStorage.setItem('user', JSON.stringify(userData));
      
      return { 
        success: true, 
        data: userData,
        message: 'Đăng nhập thành công!' 
      };
    }
    
    throw new Error('Đăng nhập thất bại: Dữ liệu không hợp lệ');
    
  } catch (error) {
    console.error('Login error:', error);
    console.log('Login error.response:', error.response);
    console.log('Login error.message:', error.message);
    
    // Nếu lỗi từ server (có response)
    if (error.response?.data) {
      // Nếu lỗi chưa xác thực email
      if (error.response.status === 403 && error.response.data.requiresVerification) {
        return {
          success: false,
          requiresVerification: true,
          email: error.response.data.email,
          message: error.response.data.message
        };
      }
      
      // Nếu tài khoản bị khóa
      if (error.response.status === 403 && 
          error.response.data.message?.includes('Tài khoản của bạn đã bị khóa')) {
        return {
          success: false,
          isAccountLocked: true,
          message: error.response.data.message || 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.'
        };
      }
      
      // Trả về error message từ server (401, 403, etc.)
      throw new Error(error.response.data.message || 'Đăng nhập thất bại');
    }
    
    // Nếu lỗi đã được xử lý bởi api.js interceptor (error.message đã có message từ server)
    // Hoặc lỗi mạng hoặc lỗi khác
    throw new Error(error.message || 'Lỗi kết nối máy chủ');
  }
};

export const register = async (userData) => {
  try {
    const response = await api.post('/auth/register', userData);
    
    if (!response.data) {
      throw new Error('Không nhận được phản hồi từ máy chủ');
    }

    console.log('Register response:', response.data);

    // If registration requires email verification
    if (response.data.requiresVerification) {
      return {
        success: true,
        requiresVerification: true,
        email: response.data.email,
        message: response.data.message
      };
    }

    // If registration includes tokens (for auto-login)
    if (response.data.token && response.data.refreshToken) {
      const { token, refreshToken, user } = response.data;
      
      // Prepare user data for Redux
      const userDataToStore = {
        token,
        refreshToken,
        user: {
          id: user._id || user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          roleId: user.roleId,
          verifiedEmail: user.verifiedEmail,
          permissions: user.permissions || [], // ⭐ THÊM permissions
          avatarUrl: user.avatarUrl
        }
      };
      
      // Note: Redux persist will automatically save to localStorage
      // Legacy localStorage is kept for backward compatibility only
      localStorage.setItem('user', JSON.stringify(userDataToStore));
      
      return {
        success: true,
        data: userDataToStore,
        message: 'Đăng ký và đăng nhập thành công!'
      };
    }
    
    return response.data;
  } catch (error) {
    console.error('Register error:', error);
    const errorMessage =
      error.response?.data?.message ||
      error.message ||
      'Đăng ký thất bại';
    throw new Error(errorMessage);
  }
};

export const logout = async () => {
  try {
    // Gọi API để xóa refresh token ở phía server
    await api.post('/auth/logout');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Xóa dữ liệu người dùng khỏi localStorage
    localStorage.removeItem('user');
    
    // Xóa cookie refreshToken bằng cách đặt hết hạn ngay lập tức
    document.cookie = 'refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    // Chuyển hướng về trang đăng nhập
    window.location.href = '/login';
  }
};

export const verifyEmail = async (email, otp) => {
  try {
    const response = await api.post('/auth/verify-email', { email, otp });
    
    if (response.data.token) {
      // Prepare user data for Redux
      const { token, refreshToken, user } = response.data;
      const userData = {
        token,
        refreshToken,
        user: {
          id: user._id || user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          roleId: user.roleId,
          verifiedEmail: user.verifiedEmail,
          permissions: user.permissions || [], // ⭐ THÊM permissions
          avatarUrl: user.avatarUrl
        }
      };
      
      // Note: Redux persist will automatically save to localStorage
      // Legacy localStorage is kept for backward compatibility only
      localStorage.setItem('user', JSON.stringify(userData));
      
      return { 
        success: true,
        data: userData,
        message: 'Email verified successfully!'
      };
    }
    
    return response.data;
  } catch (error) {
    console.error('Email verification error:', error);
    const errorMessage = error.response?.data?.message || 'Xác thực email thất bại';
    throw new Error(errorMessage);
  }
};

export const resendOTP = async (email) => {
  try {
    const response = await api.post('/auth/resend-otp', { email });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Gửi lại OTP thất bại' };
  }
};

export const forgotPassword = async (email) => {
  try {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Gửi yêu cầu đặt lại mật khẩu thất bại' };
  }
};

export const resetPassword = async (token, email, newPassword) => {
  try {
    const response = await api.post('/auth/reset-password', { token, email, newPassword });
    return response.data;
  } catch (error) {
    // Extract error message from response
    const errorData = error.response?.data;
    if (errorData) {
      // If there are validation errors, show them
      if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
        const firstError = errorData.errors[0];
        throw new Error(firstError.msg || firstError.message || errorData.message || 'Đặt lại mật khẩu thất bại');
      }
      // Otherwise use the main message
      throw new Error(errorData.message || 'Đặt lại mật khẩu thất bại');
    }
    throw new Error(error.message || 'Đặt lại mật khẩu thất bại');
  }
};

export const changePassword = async (currentPassword, newPassword) => {
  try {
    const response = await api.post('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Đổi mật khẩu thất bại' };
  }
};

// Google login
export const loginWithGoogle = async (googleToken) => {
  try {
    const response = await api.post('/auth/google', { token: googleToken });
    
    if (response.data.success) {
      // Backend returns: { success: true, token: accessToken, refreshToken, user: userData }
      const { token: accessToken, refreshToken, user } = response.data;
      
      // Format user data correctly with token structure
      const userData = {
        token: accessToken,
        refreshToken: refreshToken || null, // refreshToken from backend response
        user: {
          id: user._id || user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          roleId: user.roleId,
          verifiedEmail: user.verifiedEmail,
          permissions: user.permissions || [], // ⭐ THÊM permissions
        }
      };
      
      // Note: Redux persist will automatically save to localStorage
      // Legacy localStorage is kept for backward compatibility only
      localStorage.setItem('user', JSON.stringify(userData));
      
      return {
        success: true,
        data: userData
      };
    }
    
    return {
      success: false,
      message: response.data.message || 'Đăng nhập không thành công'
    };
  } catch (error) {
    console.error('Lỗi đăng nhập bằng Google:', error);
    
    // Nếu tài khoản bị khóa
    if (error.response?.status === 403 && 
        error.response?.data?.message?.includes('Tài khoản của bạn đã bị khóa')) {
      return {
        success: false,
        isAccountLocked: true,
        message: error.response.data.message || 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.'
      };
    }
    
    return {
      success: false,
      message: error.response?.data?.message || 'Đã xảy ra lỗi khi đăng nhập bằng Google'
    };
  }
};

// Lấy thông tin user hiện tại
// Note: Prefer using Redux store directly in components
// This is kept for backward compatibility
export const getCurrentUser = () => {
  // Try Redux persist first
  try {
    const persistAuth = localStorage.getItem('persist:auth');
    if (persistAuth) {
      const parsed = JSON.parse(persistAuth);
      const user = parsed.user ? JSON.parse(parsed.user) : null;
      return user;
    }
  } catch (e) {
    console.error('Error reading from Redux persist:', e);
  }
  
  // Fallback to legacy localStorage (for backward compatibility)
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch (e) {
    return null;
  }
};

// Kiểm tra xem người dùng đã đăng nhập chưa
export const isAuthenticated = () => {
  const user = getCurrentUser();
  return !!(user?.token || user?.user?.id);
};

// Kiểm tra xem người dùng có phải là admin không
export const isAdmin = () => {
  const user = getCurrentUser();
  const roleId = user?.user?.roleId || user?.roleId;
  return roleId === 'admin';
};

// Refresh access token (for compatibility, but api.js handles this automatically)
export const refreshAccessToken = async () => {
  try {
    const response = await api.post('/auth/refresh-token');
    const { token, refreshToken, user } = response.data;
    
    // Prepare user data
    const userData = {
      token,
      refreshToken,
      user: {
        id: user._id || user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        roleId: user.roleId,
        verifiedEmail: user.verifiedEmail
      }
    };
    
    // Note: api.js will dispatch updateTokens action to update Redux
    // Legacy localStorage is kept for backward compatibility only
    localStorage.setItem('user', JSON.stringify(userData));
    
    return token;
  } catch (error) {
    console.error('Refresh token error:', error);
    throw error;
  }
};
