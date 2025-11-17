import React, { useEffect } from 'react';
import { Form, Input, Button, message, Divider, ConfigProvider } from 'antd';
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

    // Show error message if any
    if (isError && authMessage) {
      messageApi.error(authMessage);
    }
  }, [isError, authMessage, messageApi, location.state]);

  const onFinish = async (values) => {
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
          return;
        }

        // If login is successful
        messageApi.success('Đăng nhập thành công!');
        
        // Redirect to the intended page or home
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error('Login error:', error);
      // Error message will be shown by the useEffect hook
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
              layout="vertical"
              autoComplete="off"
            >
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

              <Divider>or continue with</Divider>

              <div className="social-login">
                <GoogleSignIn 
                  buttonText="Continue with Google"
                  onSuccess={(user) => {
                    messageApi.success('Logged in successfully!');
                    navigate(from, { replace: true });
                  }}
                  onError={(error) => {
                    messageApi.error(error || 'Login failed. Please try again.');
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