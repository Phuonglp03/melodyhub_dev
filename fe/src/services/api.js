import axios from "axios";
import { store } from "../redux/store";
import { logout, updateTokens } from "../redux/authSlice";

// const API_BASE_URL = "https://localhost:9999/api", "https://api.melodyhub.website/api";
const API_BASE_URL = "https://api.melodyhub.website/api";

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
    console.log("[API]", config.method?.toUpperCase(), config.url);

    // Handle FormData
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
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

    // List of auth endpoints that should NOT trigger token refresh
    const authEndpoints = [
      "/auth/login",
      "/auth/register",
      "/auth/verify-email",
      "/auth/resend-otp",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/refresh-token",
      "/auth/google",
    ];
    const isAuthEndpoint = authEndpoints.some((endpoint) =>
      originalRequest.url?.includes(endpoint)
    );

    // Check if 403 is due to account locked
    const isAccountLocked = 
      error.response?.status === 403 && 
      error.response?.data?.message?.includes('Tài khoản của bạn đã bị khóa');

    // If account is locked, logout immediately
    if (isAccountLocked) {
      console.error("[API] Account is locked, logging out...");
      store.dispatch(logout());
      localStorage.clear();
      window.location.href = "/login";
      return Promise.reject(new Error(error.response?.data?.message || "Tài khoản của bạn đã bị khóa"));
    }

    // Only refresh token for 401 (Unauthorized) errors
    // 403 errors are typically permission issues, NOT token expiration
    const currentState = store.getState();
    const hasToken = !!currentState.auth?.user?.token;
    
    const shouldRefreshToken =
      error.response?.status === 401 &&  // Only 401, NOT 403
      !originalRequest._retry &&
      !isAuthEndpoint && // Don't retry for auth endpoints
      hasToken; // Chỉ refresh nếu user đã đăng nhập (có token)

    if (shouldRefreshToken) {
      originalRequest._retry = true;

      try {
        console.log("[API] Token expired, refreshing...");
        console.log("[API] Current token preview:", currentState.auth?.user?.token?.substring(0, 20) + '...');

        // Call refresh token endpoint
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        const { token, refreshToken, user } = response.data;

        if (!token) {
          throw new Error('Refresh token response missing access token');
        }

        console.log("[API] Token refreshed successfully");
        console.log("[API] New token preview:", token.substring(0, 20) + '...');

        // ✅ Update Redux store immediately (this is the key!)
        store.dispatch(
          updateTokens({
            token,
            refreshToken,
            user,
          })
        );

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("[API] Refresh token failed:", refreshError?.response?.data?.message || refreshError.message);

        // Chỉ logout nếu refresh token thực sự không hợp lệ (401/403)
        // Không logout nếu chỉ là lỗi mạng
        if (refreshError.response?.status === 401 || refreshError.response?.status === 403) {
          console.error("[API] Refresh token invalid, logging out...");
          store.dispatch(logout());
          localStorage.clear();
          window.location.href = "/login";
        } else {
          console.error("[API] Refresh failed due to network error, not logging out");
        }

        return Promise.reject(refreshError);
      }
    }
    
    // Nếu là 401 nhưng không có token (chưa đăng nhập), không cần xử lý đặc biệt
    if (error.response?.status === 401 && !hasToken && !isAuthEndpoint) {
      console.log("[API] 401 received but user not logged in, skipping refresh");
    }

    // Handle 403 permission/access denied errors - don't logout, just reject
    if (error.response?.status === 403 && !isAccountLocked) {
      const message = error?.response?.data?.message || "Không có quyền truy cập";
      console.warn("[API] Permission/Access denied (403):", message);
      return Promise.reject(new Error(message));
    }

    // Handle other errors
    const message =
      error?.response?.data?.message || error.message || "Request error";
    return Promise.reject(new Error(message));
  }
);

export default api;
