import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, ConfigProvider, Select } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { register as registerUser } from '../../services/authService';
import './Register.css';

const Register = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [addressLoading, setAddressLoading] = useState(false);
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  // Configure message in useEffect to avoid React 18 concurrent mode warning
  useEffect(() => {
    message.config({
      top: 100,
      duration: 3,
      maxCount: 3,
    });
  }, []);

  useEffect(() => {
    const fetchProvinces = async () => {
      setAddressLoading(true);
      try {
        const response = await api.get('/locations/provinces', {
          params: { depth: 3 }
        });
        setProvinces(response.data || []);
      } catch (error) {
        console.error('Failed to fetch provinces', error);
        messageApi.error('Không thể tải danh sách địa chỉ. Vui lòng thử lại sau.');
      } finally {
        setAddressLoading(false);
      }
    };

    fetchProvinces();
  }, [messageApi]);

  const handleProvinceChange = (value) => {
    form.setFieldsValue({ district: undefined, ward: undefined });
    const province = provinces.find((item) => item.code.toString() === value);
    setSelectedProvince(province || null);
    setDistricts(province?.districts || []);
    setSelectedDistrict(null);
    setWards([]);
  };

  const handleDistrictChange = (value) => {
    form.setFieldsValue({ ward: undefined });
    const district = (selectedProvince?.districts || []).find((item) => item.code.toString() === value);
    setSelectedDistrict(district || null);
    setWards(district?.wards || []);
  };

  const handleWardChange = () => {
    // No additional logic needed for now, but function retained for clarity
  };

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
      
      const province = provinces.find((item) => item.code.toString() === values.province);
      const district = province?.districts?.find((item) => item.code.toString() === values.district);
      const ward = district?.wards?.find((item) => item.code.toString() === values.ward);

      const requestData = {
        fullName: values.name,
        email: values.email,
        password: values.password,
        birthday: birthday,
        gender: values.gender,
        addressLine: values.addressLine?.trim(),
        provinceCode: province?.code?.toString(),
        provinceName: province?.name,
        districtCode: district?.code?.toString(),
        districtName: district?.name,
        wardCode: ward?.code?.toString(),
        wardName: ward?.name
      };
      
      console.log('Sending registration data:', requestData);
      
      const result = await registerUser(requestData);
      
      console.log('Registration response:', result);
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
      console.error('Registration error:', error.message);
      messageApi.error(error.message || 'Registration failed. Please try again.');
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
                label={<span className="form-label">Tên hiển thị</span>}
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
                label={<span className="form-label">Mật khẩu </span>}
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
                label={<span className="form-label">Giới tính</span>}
                name="gender"
                rules={[{ required: true, message: 'Please select your gender!' }]}
              >
                <Select
                  placeholder="Select your gender"
                  className="custom-input"
                  options={[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' }
                  ]}
                />
              </Form.Item>

              <Form.Item
                label={<span className="form-label">Ngày sinh</span>}
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

              <Form.Item
                label={<span className="form-label">Địa chỉ chi tiết</span>}
                name="addressLine"
              >
                <Input 
                  placeholder="House number, street name, etc."
                  className="custom-input"
                />
              </Form.Item>

              <Form.Item
                label={<span className="form-label">Thành phố</span>}
                name="province"
              >
                <Select
                  placeholder="Select province/city"
                  className="custom-input"
                  loading={addressLoading && provinces.length === 0}
                  options={provinces.map((province) => ({
                    label: province.name,
                    value: province.code.toString()
                  }))}
                  showSearch
                  optionFilterProp="label"
                  onChange={handleProvinceChange}
                />
              </Form.Item>

              <Form.Item
                label={<span className="form-label">Quận huyện </span>}
                name="district"
              >
                <Select
                  placeholder="Select district"
                  className="custom-input"
                  disabled={!selectedProvince}
                  loading={addressLoading && !!selectedProvince && districts.length === 0}
                  options={districts.map((district) => ({
                    label: district.name,
                    value: district.code.toString()
                  }))}
                  showSearch
                  optionFilterProp="label"
                  onChange={handleDistrictChange}
                />
              </Form.Item>

              <Form.Item
                label={<span className="form-label">Xã/ phường</span>}
                name="ward"
              >
                <Select
                  placeholder="Select ward"
                  className="custom-input"
                  disabled={!selectedDistrict}
                  loading={addressLoading && !!selectedDistrict && wards.length === 0}
                  options={wards.map((ward) => ({
                    label: ward.name,
                    value: ward.code.toString()
                  }))}
                  showSearch
                  optionFilterProp="label"
                  onChange={handleWardChange}
                />
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