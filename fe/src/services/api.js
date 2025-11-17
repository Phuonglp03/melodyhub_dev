import axios from 'axios';
import { store } from '../redux/store';
import { logout, updateTokens } from '../redux/authSlice';

const API_BASE_URL= 'http://localhost:9999/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for sending cookies (refreshToken)
});

// Request interceptor: Add token to headers
api.interceptors.request.use(
  (config) => {
    // Get token from Redux persist store
    const state = store.getState();
    const token = state.auth?.user?.token;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log request (optional, remove in production)
    console.log('[API]', config.method?.toUpperCase(), config.url);
    
    // Handle FormData
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle 401/403 and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 (Unauthorized) or 403 (Forbidden - token expired) and haven't retried yet
    const shouldRefreshToken = (error.response?.status === 401 || error.response?.status === 403) 
      && !originalRequest._retry
      && originalRequest.url !== '/auth/refresh-token'; // Don't retry refresh token endpoint
    
    if (shouldRefreshToken) {
      originalRequest._retry = true;
      
      try {
        console.log('[API] Token expired, refreshing...');
        
        // Call refresh token endpoint
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );
        
        const { token, refreshToken, user } = response.data;
        
        console.log('[API] Token refreshed successfully');
        
        // ✅ Update Redux store immediately (this is the key!)
        store.dispatch(updateTokens({
          token,
          refreshToken,
          user
        }));
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
        
      } catch (refreshError) {
        console.error('[API] Refresh token failed, logging out...');
        
        // Clear everything and redirect to login
        store.dispatch(logout());
        localStorage.clear();
        window.location.href = '/login';
        
        return Promise.reject(refreshError);
      }
    }
    
    // Handle other errors
    const message = error?.response?.data?.message || error.message || 'Request error';
    return Promise.reject(new Error(message));
  }
);

export default api;