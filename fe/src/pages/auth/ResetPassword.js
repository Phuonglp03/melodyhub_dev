import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, ConfigProvider } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const ResetPassword = () => {
  const [loading, setLoading] = useState(false);
  // State to check if the URL parameters are present/valid
  const [validToken, setValidToken] = useState(false); 
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();

  useEffect(() => {
    // Get token and email from the URL query parameters
    const tokenParam = searchParams.get('token');
    const emailParam = searchParams.get('email');

    if (!tokenParam || !emailParam) {
      // Show error immediately if parameters are missing
      messageApi.error('Invalid or expired link');
      setValidToken(false);
      return;
    }

    setToken(tokenParam);
    setEmail(emailParam);
    setValidToken(true);
    // Note: The actual token validation (checking expiry/existence in DB)
    // happens on the backend when 'onFinish' is called.
  }, [searchParams, messageApi]);

  const onFinish = async (values) => {
    // Note: The Ant Design Form rules already handle the confirmation check, 
    // but this external check is redundant if using Antd's built-in validator.
    // We can rely solely on the Antd validator.

    setLoading(true);
    try {
      // Call the API to reset the password
      await axios.post('http://localhost:9999/api/auth/reset-password', {
        token,
        email,
        newPassword: values.newPassword,
      });
      
      messageApi.success('Password reset successful!');
      
      // Redirect automatically after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      console.error('Error resetting password:', error);
      
      if (error.response) {
        // Server responded with a status code outside the 2xx range (e.g., 400 for invalid token)
        messageApi.error(error.response.data?.message || 'An error occurred. Please try again later.');
      } else if (error.request) {
        // The request was made but no response was received (e.g., network error)
        messageApi.error('Cannot connect to the server. Please check your network connection.');
      } else {
        // Something else happened while setting up the request
        messageApi.error('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Render a special message if the token is missing from the URL
  if (!validToken) {
    return (
      <div className="login-container">
        {contextHolder}
        <div className="login-content">
          <div className="login-card">
            <h2 className="login-title">Invalid Link</h2>
            <p>The password reset link is invalid or has expired.</p>
            <Button 
              type="primary" 
              className="back-to-login"
              onClick={() => navigate('/forgot-password')}
            >
              Forgot Password
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
            <Link to="/login" className="login-link">Log In</Link>
            <Link to="/register" className="signup-btn">Sign Up</Link>
          </div>
        </div>

        <div className="login-content">
          <div className="login-card">
            <h2 className="login-title">Reset Password</h2>
            <p className="login-subtitle">Enter a new password for your account</p>
            
            <Form
              form={form}
              name="resetPassword"
              onFinish={onFinish}
              layout="vertical"
              autoComplete="off"
            >
              <Form.Item
                label={<span className="form-label">New Password</span>}
                name="newPassword"
                rules={[
                  { required: true, message: 'Please enter your new password!' },
                  { min: 6, message: 'Password must be at least 6 characters long!' }
                ]}
              >
                <Input.Password 
                  placeholder="Enter new password" 
                  className="custom-input"
                />
              </Form.Item>

              <Form.Item
                label={<span className="form-label">Confirm Password</span>}
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: 'Please confirm your new password!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('The two passwords that you entered do not match!'));
                    },
                  }),
                ]}
              >
                <Input.Password 
                  placeholder="Re-enter new password" 
                  className="custom-input"
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  className="login-button"
                  block
                >
                  Reset Password
                </Button>
              </Form.Item>
            </Form>

            <div className="back-to-login">
              <Link to="/login" className="forgot-link">
                ← Back to Log In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default ResetPassword;