import React, { useEffect, useRef, useReducer } from 'react';
import { Form, Input, Button, message, Divider, ConfigProvider, Alert } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login } from '../../redux/authSlice';
import GoogleSignIn from '../../components/GoogleSignIn';
import './Login.css';

// Configure message globally
message.config({
  top: 100,
  duration: 3,
  maxCount: 3,
});

const Login = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { isLoading, isError, message: authMessage } = useSelector((state) => state.auth);
  const [messageApi, contextHolder] = message.useMessage();
  const isProcessingRef = useRef(false); // Prevent duplicate calls
  const lastErrorRef = useRef(null); // Track last error to prevent duplicate messages
  const errorMessageRef = useRef(''); // Ref to store error message
  const [errorMessage, setErrorMessage] = React.useState(''); // State to display error message
  const [errorKey, setErrorKey] = React.useState(0); // Key to force re-render
  const [, forceUpdate] = React.useReducer(x => x + 1, 0); // Force re-render

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    // Show success message if redirected from verification
    if (location.state?.message) {
      if (location.state.messageType === 'success') {
        messageApi.success(location.state.message);
      } else {
        messageApi.error(location.state.message);
      }
      // Clear the state to prevent showing the message again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [messageApi, location.state]);


  const onFinish = async (values) => {
    // Prevent duplicate calls (especially in StrictMode)
    if (isProcessingRef.current) {
      return;
    }
    
    // Clear previous error message
    setErrorMessage('');
    errorMessageRef.current = '';
    setErrorKey(0);
    isProcessingRef.current = true;
    
    try {
      const resultAction = await dispatch(login({
        email: values.email,
        password: values.password
      }));

      if (login.fulfilled.match(resultAction)) {
        const result = resultAction.payload;
        
        // If login requires email verification
        if (result.requiresVerification) {
          messageApi.warning(result.message || 'Vui lòng xác thực email trước khi đăng nhập');
          navigate('/verify-otp', { 
            state: { 
              email: result.email || values.email,
              fromLogin: true,
              message: result.message,
              messageType: 'warning'
            } 
          });
          isProcessingRef.current = false;
          return;
        }

        // If account is locked
        if (result.isAccountLocked) {
          const errorMessage = result.message || 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.';
          // Only show error if it's different from the last one (prevent duplicate)
          if (lastErrorRef.current !== errorMessage) {
            lastErrorRef.current = errorMessage;
            messageApi.error(errorMessage);
          }
          // Reset after a short delay to allow retry
          setTimeout(() => {
            isProcessingRef.current = false;
          }, 500);
          return;
        }

        // If login is successful
        setErrorMessage(''); // Clear any error message
        messageApi.success('Đăng nhập thành công!');
        
        if (result.user?.roleId === 'admin') {
          window.location.href = '/admin'; 
        } else {
          navigate(from, { replace: true });
        }
        isProcessingRef.current = false;
      } else if (login.rejected.match(resultAction)) {
        // Handle rejected case (including wrong password, account locked, etc.)
        const errorMsg = resultAction.payload || 'Đăng nhập thất bại. Vui lòng thử lại.';
        
        // Set lỗi trực tiếp cho trường password để luôn nhìn thấy dưới ô nhập
        form.setFields([
          {
            name: 'password',
            errors: [errorMsg],
          },
        ]);
        
        // Lưu lại errorMessage để Alert (nếu hiển thị) vẫn đồng bộ
        setErrorMessage(errorMsg);
        errorMessageRef.current = errorMsg;
        // Hiển thị toast lỗi rõ ràng
        messageApi.error(errorMsg);
        
        // Force form to re-validate and show error
        setTimeout(() => {
          forceUpdate();
        }, 0);
        
        // Reset after a short delay to allow retry
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 500);
      }
    } catch (error) {
      const errorMsg = error?.message || error?.toString() || 'Login failed. Please try again.';
      setErrorMessage(errorMsg);
      errorMessageRef.current = errorMsg;
      // Hiển thị toast lỗi khi xảy ra exception không mong muốn
      messageApi.error(errorMsg);
      // Reset after a short delay to allow retry
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 500);
    }
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#8b5cf6',
          colorError: '#f87171',
          colorSuccess: '#34d399',
        },
      }}
    >
      {contextHolder}
      <div className="login-container">
        <div className="login-background">
          <div className="wave-pattern"></div>
        </div>
        
        <div className="login-header">
          <div className="logo">MelodyHub</div>
          <div className="header-actions">
            <Link to="/login" className="login-link">Log in</Link>
            <Link to="/register" className="signup-btn">Sign up</Link>
          </div>
        </div>

        <div className="login-content">
          <div className="login-card">
            <h2 className="login-title">Welcome</h2>
            <p className="login-subtitle">Log in to your account to continue</p>
            
            <Form
              form={form}
              name="login"
              onFinish={onFinish}
              onFinishFailed={() => {}}
              layout="vertical"
              autoComplete="off"
            >
              {/* Error message display - Always render, show/hide based on errorMessage */}
              {errorMessage && (
                <Form.Item>
                  <Alert
                    message="Lỗi đăng nhập"
                    description={errorMessage}
                    type="error"
                    showIcon
                    closable
                    onClose={() => {
                      setErrorMessage('');
                      errorMessageRef.current = '';
                    }}
                    style={{ marginBottom: '20px' }}
                  />
                </Form.Item>
              )}
              
              <Form.Item
                label={<span className="form-label">Email</span>}
                name="email"
                rules={[
                  { required: true, message: 'Please input your email!' },
                  { type: 'email', message: 'Please enter a valid email!' }
                ]}
              >
                <Input 
                  placeholder="Enter your email" 
                  className="custom-input"
                />
              </Form.Item>

              <Form.Item
                label={<span className="form-label">Password</span>}
                name="password"
                rules={[
                  { required: true, message: 'Please input your password!' }
                ]}
              >
                <Input.Password
                  placeholder="Enter your password"
                  className="custom-input"
                  iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={isLoading}
                  block
                >
                  Log in
                </Button>
              </Form.Item>

              {/* Thông báo lỗi dựa trên state local */}
              {errorMessage && (
                <div style={{ color: '#f5222d', marginBottom: 16 }}>
                  {errorMessage}
                </div>
              )}

              {/* Thông báo lỗi fallback lấy trực tiếp từ Redux (auth.message) */}
              {isError && authMessage && !errorMessage && (
                <div style={{ color: '#f5222d', marginBottom: 16 }}>
                  {authMessage}
                </div>
              )}

              <Divider>or continue with</Divider>

              <div className="social-login">
                <GoogleSignIn 
                  buttonText="Continue with Google"
                  onSuccess={(user) => {
                    messageApi.success('Đăng nhập thành công!');
                    // Check if user is admin
                    if (user?.roleId === 'admin') {
                      window.location.href = '/admin';
                    } else {
                      navigate(from, { replace: true });
                    }
                  }}
                  onError={(error) => {
                    // Check if error message contains account locked message
                    if (error?.includes('Tài khoản của bạn đã bị khóa') || 
                        error?.includes('account is locked')) {
                      messageApi.error(error || 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.');
                    } else {
                      messageApi.error(error || 'Đăng nhập thất bại. Vui lòng thử lại.');
                    }
                  }}
                />
              </div>

              <div className="login-footer">
                <p>
                  Don't have an account? <Link to="/register">Sign up</Link>
                </p>
                <p>
                  <Link to="/forgot-password">Forgot password?</Link>
                </p>
              </div>
            </Form>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Login;