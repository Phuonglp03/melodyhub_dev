import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { login, register, logout, refreshUser } from '../redux/authSlice';

const useAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { user, isError, isSuccess, isLoading, message } = useSelector(
    (state) => state.auth
  );

  // Auto refresh user on mount
  useEffect(() => {
    dispatch(refreshUser());
  }, [dispatch]);

  // Handle redirect after successful login/register
  useEffect(() => {
    if (isSuccess && user) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isSuccess, user, navigate, location]);

  // Handle errors
  useEffect(() => {
    if (isError && message) {
      console.error('Authentication error:', message);
    }
  }, [isError, message]);

  const loginUser = async (credentials) => {
    try {
      const result = await dispatch(login(credentials)).unwrap();
      return { success: true, data: result };
    } catch (error) {
      return { 
        success: false, 
        error: error || 'Đăng nhập thất bại. Vui lòng thử lại.' 
      };
    }
  };

  const registerUser = async (userData) => {
    try {
      const result = await dispatch(register(userData)).unwrap();
      return { success: true, data: result };
    } catch (error) {
      return { 
        success: false, 
        error: error || 'Đăng ký thất bại. Vui lòng thử lại.' 
      };
    }
  };

  const logoutUser = () => {
    dispatch(logout());
    navigate('/login');
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.roleId === 'admin'; // Điều chỉnh theo role của bạn

  return {
    user,
    isAuthenticated,
    isAdmin,
    isError,
    isSuccess,
    isLoading,
    message,
    login: loginUser,
    register: registerUser,
    logout: logoutUser,
  };
};

export default useAuth;
