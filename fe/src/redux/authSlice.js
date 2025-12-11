import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { 
  login as loginService, 
  register as registerService, 
  logout as logoutService, 
  getCurrentUser as getCurrentUserService,
  loginWithGoogle as loginWithGoogleService
} from '../services/authService';



const initialState = {
  user: null,
  isError: false,
  isSuccess: false,
  isLoading: false,
  message: '',
  requiresVerification: false,
  verificationEmail: '',
};

// Đăng ký người dùng mới
export const register = createAsyncThunk(
  'auth/register',
  async (userData, thunkAPI) => {
    try {
      return await registerService(userData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Đăng nhập
export const login = createAsyncThunk(
  'auth/login',
  async (credentials, thunkAPI) => {
    try {
      const response = await loginService(credentials.email, credentials.password);
      
      // If login requires email verification
      if (response.requiresVerification) {
        return { requiresVerification: true, ...response };
      }
      
      // If login is successful
      if (response.success) {
        return response.data;
      }
      
      return thunkAPI.rejectWithValue(response.message || 'Đăng nhập thất bại');
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Google Login
export const googleLogin = createAsyncThunk(
  'auth/googleLogin',
  async (token, thunkAPI) => {
    try {
      const response = await loginWithGoogleService(token);
      
      // If login is successful
      if (response.success && response.data) {
        return response;
      }
      
      return thunkAPI.rejectWithValue(response.message || 'Đăng nhập Google thất bại');
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Đăng xuất
export const logout = createAsyncThunk('auth/logout', async () => {
  await logoutService();
});

// Làm mới thông tin người dùng
export const refreshUser = createAsyncThunk(
  'auth/refresh',
  async (_, thunkAPI) => {
    try {
      const user = getCurrentUserService();
      if (!user) {
        return thunkAPI.rejectWithValue('Không tìm thấy thông tin đăng nhập');
      }
      return user;
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    reset: (state) => {
      state.isLoading = false;
      state.isSuccess = false;
      state.isError = false;
      state.message = '';
    },
    updateTokens: (state, action) => {
      // Update tokens after refresh
      if (action.payload) {
        if (state.user) {
          // Cập nhật user hiện tại với token mới
        state.user = {
          ...state.user,
          token: action.payload.token,
          refreshToken: action.payload.refreshToken,
          user: {
            ...state.user.user,
            ...action.payload.user
          }
        };
        } else {
          // Nếu không có user (edge case), tạo mới từ payload
          state.user = {
            token: action.payload.token,
            refreshToken: action.payload.refreshToken,
            user: action.payload.user
          };
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(register.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;

        // Check if registration requires verification
        if (action.payload?.requiresVerification) {
          state.requiresVerification = true;
          state.verificationEmail = action.payload.email;
          state.message = action.payload.message || 'Đăng ký thành công. Vui lòng xác thực email.';
          return; // Don't set user if verification required
        }
        
        // If registration includes auto-login (has token)
        if (action.payload?.data?.token) {
          state.user = action.payload.data;
        } else if (action.payload?.token) {
          // Direct token in payload
          state.user = action.payload;
        }
        
        state.message = action.payload.message || 'Đăng ký thành công';
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        state.user = null;
      })
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.message = '';
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        state.message = 'Đăng nhập thành công';
        
        // Handle email verification required
        if (action.payload?.requiresVerification) {
          state.requiresVerification = true;
          state.verificationEmail = action.payload.email;
          return; // Don't set user if verification required
        }
        
        // ✅ action.payload is already { token, refreshToken, user }
        // because login thunk returns response.data (see line 54)
        if (action.payload?.token) {
          state.user = action.payload;
        } else {
          console.error('[authSlice] Login payload missing token:', action.payload);
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload || 'Đăng nhập thất bại';
        state.user = null;
      })
      .addCase(googleLogin.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.message = '';
      })
      .addCase(googleLogin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        state.message = 'Đăng nhập Google thành công';
        
        // ✅ action.payload.data contains { token, refreshToken, user }
        if (action.payload?.data) {
          state.user = action.payload.data;
        } else {
          console.error('[authSlice] Google login payload missing data:', action.payload);
        }
      })
      .addCase(googleLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload || 'Đăng nhập Google thất bại';
        state.user = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
      })
      .addCase(refreshUser.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { reset, updateTokens } = authSlice.actions;

export default authSlice.reducer;