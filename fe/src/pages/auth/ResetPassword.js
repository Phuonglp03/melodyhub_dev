import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, ConfigProvider } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword as resetPasswordRequest } from '../../services/authService';
import './Login.css';

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
    // Lấy token và email từ query trên URL
    const tokenParam = searchParams.get('token');
    const emailParam = searchParams.get('email');

    console.log('Reset password URL params:', { 
      tokenParam: tokenParam ? tokenParam.substring(0, 8) + '...' : 'missing',
      tokenLength: tokenParam?.length,
      emailParam: emailParam || 'missing',
      fullURL: window.location.href
    });

    if (!tokenParam || !emailParam) {
      // Báo lỗi ngay nếu thiếu tham số
      console.error('Missing token or email in URL');
      messageApi.error('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
      setValidToken(false);
      return;
    }

    // Decode URL-encoded values
    const decodedToken = decodeURIComponent(tokenParam);
    const decodedEmail = decodeURIComponent(emailParam);

    setToken(decodedToken);
    setEmail(decodedEmail);
    setValidToken(true);
    // Việc kiểm tra token có hợp lệ/hết hạn sẽ do backend xử lý khi submit form.
  }, [searchParams, messageApi]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      console.log('Submitting reset password:', {
        tokenLength: token?.length,
        tokenPreview: token ? token.substring(0, 8) + '...' : 'missing',
        email: email,
        hasNewPassword: !!values.newPassword,
        newPasswordLength: values.newPassword?.length
      });

      // Gọi API đặt lại mật khẩu
      await resetPasswordRequest(token, email, values.newPassword);
      
      messageApi.success('Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.');
      
      // Tự động chuyển về trang đăng nhập sau 2 giây
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      console.error('Error resetting password:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      messageApi.error(error.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Giao diện khi token không hợp lệ hoặc thiếu trên URL
  if (!validToken) {
    return (
      <div className="login-container">
        {contextHolder}
        <div className="login-content">
          <div className="login-card">
            <h2 className="login-title">Liên kết không hợp lệ</h2>
            <p>Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.</p>
            <Button 
              type="primary" 
              className="back-to-login"
              onClick={() => navigate('/forgot-password')}
            >
              Quên mật khẩu
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
            <Link to="/login" className="login-link">Đăng nhập</Link>
            <Link to="/register" className="signup-btn">Đăng ký</Link>
          </div>
        </div>

        <div className="login-content">
          <div className="login-card">
            <h2 className="login-title">Đặt lại mật khẩu</h2>
            <p className="login-subtitle">
              Nhập mật khẩu mới cho tài khoản <strong>{email}</strong>
            </p>
            
            <Form
              form={form}
              name="resetPassword"
              onFinish={onFinish}
              layout="vertical"
              autoComplete="off"
            >
              <Form.Item
                label={<span className="form-label">Mật khẩu mới</span>}
                name="newPassword"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu mới!' },
                  { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự!' }
                ]}
              >
                <Input.Password 
                  placeholder="Nhập mật khẩu mới" 
                  className="custom-input"
                />
              </Form.Item>

              <Form.Item
                label={<span className="form-label">Nhập lại mật khẩu</span>}
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: 'Vui lòng nhập lại mật khẩu mới!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Hai mật khẩu không trùng khớp!'));
                    },
                  }),
                ]}
              >
                <Input.Password 
                  placeholder="Nhập lại mật khẩu mới" 
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
                  Đặt lại mật khẩu
                </Button>
              </Form.Item>
            </Form>

            <div className="back-to-login">
              <Link to="/login" className="forgot-link">
                ← Quay lại đăng nhập
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default ResetPassword;