import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Typography, message, ConfigProvider } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { verifyEmail, resendOTP } from '../../services/authService';
import './Register.css';
import './VerifyOTP.css';

const { Title, Text } = Typography;

message.config({
  top: 100,
  duration: 3,
  maxCount: 3,
});

const VerifyOTP = () => {
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [email, setEmail] = useState('');
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    // Check if email is provided in state
    const emailFromState = location.state?.email;
    const fromLogin = location.state?.fromLogin;
    
    if (!emailFromState) {
      // Check if email is in query params (for backward compatibility)
      const emailFromQuery = new URLSearchParams(location.search).get('email');
      if (emailFromQuery) {
        setEmail(emailFromQuery);
        startCountdown();
      } else {
        messageApi.warning(fromLogin ? 'Please login again' : 'Please register an account first');
        navigate(fromLogin ? '/login' : '/register');
      }
      return;
    }
    
    setEmail(emailFromState);
    startCountdown();
  }, [location]);

  const startCountdown = () => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  };

  useEffect(startCountdown, [countdown]);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      
      // Call the verify email API
      const result = await verifyEmail(email, values.otp);

      if (result.success) {
        messageApi.success('Xác thực email thành công! Vui lòng đăng nhập.');
        
        // Redirect to login page with success message
        navigate('/login', { 
          state: { 
            from: '/',
            message: 'Xác thực email thành công! Vui lòng đăng nhập.',
            messageType: 'success'
          } 
        });
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      messageApi.error(error.message || 'Có lỗi xảy ra khi xác thực OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!canResend) {
      messageApi.warning(`Please wait ${countdown} seconds before resending`);
      return;
    }
    
    setLoading(true);
    
    try {
      await resendOTP(email);
      
      messageApi.success('New OTP code sent to your email. Please check your inbox and spam folder.');
      
      setCountdown(60);
      setCanResend(false);
      startCountdown();
    } catch (error) {
      console.error('Error resending OTP:', error);
      messageApi.error(error.message || 'Failed to resend OTP code');
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    // If no email, redirect to registration page
    navigate('/register');
    return null;
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#8b5cf6',
          colorError: '#f87171',
          colorSuccess: '#34d399',
          colorWarning: '#fbbf24',
        },
      }}
    >
      {contextHolder}
      <div className="register-container">
        <div className="register-background">
          <div className="wave-pattern"></div>
        </div>
        
        <div className="register-header">
          <div className="logo">MelodyHub</div>
        </div>

        <div className="register-content">
          <div className="register-card">
            <h2 className="register-title">Verify Email</h2>
            <p className="register-subtitle">
              We've sent a verification code to <strong>{email}</strong>
            </p>
            {location.state?.fromLogin && (
              <Text style={{ 
                display: 'block', 
                textAlign: 'center', 
                marginBottom: 24, 
                color: '#fbbf24',
                fontSize: '14px'
              }}>
                ⚠️ Please verify your email to continue
              </Text>
            )}
            <Text type="secondary" style={{ 
              display: 'block', 
              textAlign: 'center', 
              marginBottom: 32,
              fontSize: '13px',
              color: '#9ca3af'
            }}>
              OTP code is valid for 10 minutes
            </Text>
            
            <Form
              form={form}
              name="verify-otp"
              onFinish={handleSubmit}
              layout="vertical"
              autoComplete="off"
              className="otp-form"
            >
              <Form.Item
                name="otp"
                rules={[
                  { required: true, message: 'Please enter OTP code' },
                  { pattern: /^\d{6}$/, message: 'OTP must be 6 digits' }
                ]}
              >
                <Input.OTP 
                  length={6} 
                  size="large"
                  className="otp-input"
                  inputType="number"
                  inputMode="numeric"
                />
              </Form.Item>

              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  className="signup-button"
                  size="large"
                  block
                >
                  Verify
                </Button>
              </Form.Item>

              <div className="resend-otp">
                <Text style={{ color: '#9ca3af' }}>
                  Didn't receive the code?{' '}
                  <Button 
                    type="link" 
                    onClick={handleResendOTP}
                    disabled={!canResend || loading}
                    className="resend-button"
                    style={{ 
                      color: canResend ? '#a78bfa' : '#6b7280',
                      padding: 0,
                      height: 'auto'
                    }}
                  >
                    {canResend ? 'Resend code' : `Resend in ${countdown}s`}
                  </Button>
                </Text>
              </div>
            </Form>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default VerifyOTP;