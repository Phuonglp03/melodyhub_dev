// src/pages/admin/CreateAdmin.jsx
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserPlus, 
  Mail, 
  Lock, 
  Shield, 
  Check, 
  X, 
  Eye, 
  EyeOff,
  AlertCircle,
  User 
} from 'lucide-react';
import api from '../../../services/api'; 

// ✅ DI CHUYỂN InputField RA NGOÀI - ĐÂY LÀ GIẢI PHÁP CHÍNH
const InputField = React.memo(({ 
  label, 
  name, 
  icon: Icon, 
  isPassword = false,
  value,
  onChange,
  error,
  isSubmitting,
  showPassword,
  toggleShowPassword
}) => {
  let inputType = 'text';
  
  if (isPassword) {
    inputType = showPassword ? 'text' : 'password';
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor={name}>
        {label}
      </label>
      <div className="relative">
        <Icon size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type={inputType} 
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={
            name === 'displayName' ? 'Tên hiển thị' : 
            name === 'username' ? 'admin1' : 
            name === 'email' ? 'admin1@gmail.com' : ''
          }
          className={`w-full pl-12 pr-12 py-3 bg-gray-800/50 rounded-xl focus:outline-none focus:ring-2 border transition-all duration-200 ${
            error 
              ? 'border-red-500/50 focus:ring-red-500/50' 
              : 'border-gray-700/50 focus:border-purple-500/50 focus:ring-purple-500/50'
          }`}
          disabled={isSubmitting}
        />
        {isPassword && (
          <button
            type="button"
            onClick={toggleShowPassword}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-400 flex items-center space-x-1">
          <AlertCircle size={14} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});

const CreateAdmin = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    displayName: '', 
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Super Admin' 
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalMessage, setGlobalMessage] = useState({ type: '', text: '' }); 

  const roles = [
    { id: 'super_admin', label: 'Super Admin', description: 'Full system access', color: 'from-purple-500 to-pink-500' },
    { id: 'liveroom_admin', label: 'Liveroom Admin', description: 'Manage live rooms', color: 'from-blue-500 to-cyan-500' },
    { id: 'user_support', label: 'User Support', description: 'Handle user issues', color: 'from-green-500 to-emerald-500' }
  ];

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setErrors(prev => ({ ...prev, [name]: '' }));
    setGlobalMessage({ type: '', text: '' }); 
  }, []);

  const handleRoleChange = useCallback((roleLabel) => {
    setFormData(prev => ({
      ...prev,
      role: roleLabel
    }));
  }, []);

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;
    
    if (!formData.displayName.trim()) { newErrors.displayName = 'Tên hiển thị là bắt buộc'; isValid = false; }
    if (!formData.username.trim()) { newErrors.username = 'Username là bắt buộc'; isValid = false; } 
    else if (formData.username.length < 3) { newErrors.username = 'Username phải có ít nhất 3 ký tự'; isValid = false; }

    if (!formData.email.trim()) { newErrors.email = 'Email là bắt buộc'; isValid = false; } 
    else if (!/\S+@\S+\.\S+/.test(formData.email)) { newErrors.email = 'Email không hợp lệ'; isValid = false; }

    if (!formData.password) { newErrors.password = 'Mật khẩu là bắt buộc'; isValid = false; } 
    else if (formData.password.length < 6) { newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự'; isValid = false; }

    if (!formData.confirmPassword) { newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu'; isValid = false; } 
    else if (formData.password !== formData.confirmPassword) { newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp'; isValid = false; }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalMessage({ type: '', text: '' });

    if (!validateForm()) {
      setGlobalMessage({ type: 'error', text: 'Vui lòng điền đầy đủ và chính xác các trường.' });
      return;
    }

    setIsSubmitting(true);
    
    const selectedRole = roles.find(r => r.label === formData.role);
    const roleKey = selectedRole ? selectedRole.id : 'super_admin'; 
    
    try {
      const payload = {
        username: formData.username,
        displayName: formData.displayName, 
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword, 
        roleKey: roleKey 
      };
      
      const response = await api.post('/admin/create-admin', payload);

      alert(response.data?.message || `Tạo tài khoản Admin ${selectedRole.label} thành công!`);
      
      setFormData({
        username: '',
        displayName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'Super Admin'
      });
      setErrors({});
      navigate('/admin/user-management'); 

    } catch (error) {
      console.error('Error creating admin:', error);
      const errorMessage = error.message || 'Lỗi kết nối hoặc lỗi máy chủ.';
      setGlobalMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/user-management');
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
          Tạo Tài Khoản Admin Mới
        </h1>
        <p className="text-gray-400">Thêm một quản trị viên mới vào hệ thống</p>
      </div>

      {globalMessage.text && (
        <div className={`p-3 mb-4 rounded-xl text-sm font-medium flex items-center space-x-2 ${
          globalMessage.type === 'error' ? 'bg-red-800/50 text-red-300 border border-red-700/50' : 
          'bg-green-800/50 text-green-300 border border-green-700/50'
        }`}>
          <AlertCircle size={18} />
          <span>{globalMessage.text}</span>
        </div>
      )}

      <div className="max-w-3xl">
        <form onSubmit={handleSubmit} className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-8 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField 
              label="Username" 
              name="username" 
              icon={UserPlus}
              value={formData.username}
              onChange={handleChange}
              error={errors.username}
              isSubmitting={isSubmitting}
            />
            <InputField 
              label="Tên Hiển Thị (DisplayName)" 
              name="displayName" 
              icon={User}
              value={formData.displayName}
              onChange={handleChange}
              error={errors.displayName}
              isSubmitting={isSubmitting}
            />
          </div>

          <InputField 
            label="Email" 
            name="email" 
            icon={Mail}
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            isSubmitting={isSubmitting}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField 
              label="Mật Khẩu" 
              name="password" 
              icon={Lock} 
              isPassword={true}
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              isSubmitting={isSubmitting}
              showPassword={showPassword}
              toggleShowPassword={() => setShowPassword(prev => !prev)}
            />
            <InputField 
              label="Xác Nhận Mật Khẩu" 
              name="confirmPassword" 
              icon={Lock} 
              isPassword={true}
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              isSubmitting={isSubmitting}
              showPassword={showConfirmPassword}
              toggleShowPassword={() => setShowConfirmPassword(prev => !prev)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Quyền Hạn / Vai Trò
            </label>
            <div className="space-y-3">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className={`flex items-center p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                    formData.role === role.label
                      ? `bg-gradient-to-r ${role.color} border-${role.color.split('-')[1]}-500/50`
                      : 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center flex-1">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 transition-all duration-200 ${
                      formData.role === role.label
                        ? `bg-gradient-to-r ${role.color} border-transparent`
                        : 'border-gray-600'
                    }`}>
                      {formData.role === role.label && (
                        <Check size={14} className="text-white" />
                      )}
                    </div>
                    <input
                      type="radio"
                      name="role"
                      value={role.label}
                      checked={formData.role === role.label}
                      onChange={() => handleRoleChange(role.label)}
                      className="hidden"
                    />
                    <div>
                      <p className="font-medium">{role.label}</p>
                      <p className="text-xs text-gray-400">{role.description}</p>
                    </div>
                  </div>
                  <Shield size={20} className={`${
                    formData.role === role.label ? 'text-white' : 'text-gray-600'
                  }`} />
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-200 shadow-lg shadow-red-500/20 hover:shadow-red-500/40 flex items-center justify-center space-x-2"
            >
              <UserPlus size={20} />
              <span>{isSubmitting ? 'Đang tạo...' : 'Tạo Tài Khoản'}</span>
            </button>
            
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <X size={20} />
              <span>Hủy</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAdmin;