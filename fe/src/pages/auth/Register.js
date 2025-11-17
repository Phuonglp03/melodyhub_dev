import React, { useState } from 'react';
import { Form, Input, Button, message, ConfigProvider } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Register.css';

message.config({
  top: 100,
  duration: 3,
  maxCount: 3,
});

const Register = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // Format birthday from separate day, month, year inputs
      let birthday = null;
      if (values.birthday && values.birthday.day && values.birthday.month && values.birthday.year) {
        const day = String(values.birthday.day).padStart(2, '0');
        const month = String(values.birthday.month).padStart(2, '0');
        const year = String(values.birthday.year);
        
        // Validate date
        const dateObj = new Date(`${year}-${month}-${day}`);
        if (isNaN(dateObj.getTime())) {
          messageApi.error('Invalid birthday date');
          setLoading(false);
          return;
        }
        
        birthday = `${year}-${month}-${day}`;
      }
      
      const requestData = {
        fullName: values.name,
        email: values.email,
        password: values.password,
        birthday: birthday
      };
      
      console.log('Sending registration data:', requestData);
      
      const response = await axios.post('http://localhost:9999/api/auth/register', requestData);
      
      console.log('Registration response:', response.data);
      messageApi.success('Please check your email for OTP verification code');
      
      // Navigate to OTP verification page after short delay
      setTimeout(() => {
        navigate('/verify-otp', { 
          state: { 
            email: values.email,
            message: 'Please check your email for OTP verification code' 
          } 
        });
      }, 1000);
    } catch (error) {
      console.error('Registration error:', error.response?.data || error.message);
      
      // Display detailed error message
      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map(err => err.msg).join(', ');
        messageApi.error(errorMessages);
      } else {
        messageApi.error(error.response?.data?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
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
      <div className="register-container">
        <div className="register-background">
          <div className="wave-pattern"></div>
        </div>
        
        <div className="register-header">
          <div className="logo">MelodyHub</div>
          <div className="header-actions">
            <Link to="/login" className="login-link">Log in</Link>
            <Link to="/register" className="signup-btn">Sign up</Link>
          </div>
        </div>

        <div className="register-content">
          <div className="register-card">
            <h2 className="register-title">Create an Account</h2>
            <p className="register-subtitle">Join Melodyhub and start your musical journey</p>
            
            <Form
              form={form}
              name="register"
              onFinish={onFinish}
              layout="vertical"
              autoComplete="off"
            >
              <Form.Item
                label={<span className="form-label">Name</span>}
                name="name"
                rules={[{ required: true, message: 'Please input your name!' }]}
              >
                <Input 
                  placeholder="Enter your name" 
                  className="custom-input"
                />
              </Form.Item>

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
                  { required: true, message: 'Please input your password!' },
                  { min: 6, message: 'Password must be at least 6 characters!' }
                ]}
              >
                <Input.Password
                  placeholder="Enter at least 6 characters"
                  className="custom-input"
                  iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>

              <Form.Item
                label={<span className="form-label">Birthday (Optional)</span>}
              >
                <div className="birthday-inputs">
                  <Form.Item
                    name={['birthday', 'day']}
                    noStyle
                  >
                    <Input 
                      placeholder="DD" 
                      className="custom-input birthday-input" 
                      maxLength={2}
                      type="number"
                      min={1}
                      max={31}
                    />
                  </Form.Item>
                  <Form.Item
                    name={['birthday', 'month']}
                    noStyle
                  >
                    <Input 
                      placeholder="MM" 
                      className="custom-input birthday-input" 
                      maxLength={2}
                      type="number"
                      min={1}
                      max={12}
                    />
                  </Form.Item>
                  <Form.Item
                    name={['birthday', 'year']}
                    noStyle
                  >
                    <Input 
                      placeholder="YYYY" 
                      className="custom-input birthday-input year-input" 
                      maxLength={4}
                      type="number"
                      min={1900}
                      max={new Date().getFullYear()}
                    />
                  </Form.Item>
                </div>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  className="signup-button"
                  block
                >
                  Sign up
                </Button>
              </Form.Item>

              <div className="login-footer">
                Have an account? <Link to="/login" className="login-footer-link">Log In</Link>
              </div>
            </Form>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Register;