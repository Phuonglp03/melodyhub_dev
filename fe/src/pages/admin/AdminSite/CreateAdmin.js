// src/pages/admin/CreateAdmin.jsx
import React, { useState } from 'react';
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
  AlertCircle 
} from 'lucide-react';
import axios from 'axios';

const CreateAdmin = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Super Admin'
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roles = [
    { 
      id: 'super_admin', 
      label: 'Super Admin', 
      description: 'Full system access',
      color: 'from-purple-500 to-pink-500'
    },
    { 
      id: 'liveroom_admin', 
      label: 'Liveroom Admin', 
      description: 'Manage live rooms',
      color: 'from-blue-500 to-cyan-500'
    },
    { 
      id: 'user_support', 
      label: 'User Support', 
      description: 'Handle user issues',
      color: 'from-green-500 to-emerald-500'
    }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleRoleChange = (roleLabel) => {
    setFormData(prev => ({
      ...prev,
      role: roleLabel
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await axios.post('/api/admin/create', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role
      });

      // Success - redirect to user management
      alert('Admin account created successfully!');
      navigate('/admin/user-management');
    } catch (error) {
      console.error('Error creating admin:', error);
      alert(error.response?.data?.message || 'Failed to create admin account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/user-management');
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
          Create New Admin Account
        </h1>
        <p className="text-gray-400">Add a new administrator to the system</p>
      </div>

      {/* Form Container */}
      <div className="max-w-3xl">
        <form onSubmit={handleSubmit} className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-8 space-y-6">
          
          {/* Username Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <div className="relative">
              <UserPlus className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="admin1"
                className={`w-full pl-12 pr-4 py-3 bg-gray-800/50 rounded-xl focus:outline-none focus:ring-2 border transition-all duration-200 ${
                  errors.username 
                    ? 'border-red-500/50 focus:ring-red-500/50' 
                    : 'border-gray-700/50 focus:border-purple-500/50 focus:ring-purple-500/50'
                }`}
              />
            </div>
            {errors.username && (
              <p className="mt-2 text-sm text-red-400 flex items-center space-x-1">
                <AlertCircle size={14} />
                <span>{errors.username}</span>
              </p>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="admin1@gmail.com"
                className={`w-full pl-12 pr-4 py-3 bg-gray-800/50 rounded-xl focus:outline-none focus:ring-2 border transition-all duration-200 ${
                  errors.email 
                    ? 'border-red-500/50 focus:ring-red-500/50' 
                    : 'border-gray-700/50 focus:border-purple-500/50 focus:ring-purple-500/50'
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-2 text-sm text-red-400 flex items-center space-x-1">
                <AlertCircle size={14} />
                <span>{errors.email}</span>
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="12345@"
                className={`w-full pl-12 pr-12 py-3 bg-gray-800/50 rounded-xl focus:outline-none focus:ring-2 border transition-all duration-200 ${
                  errors.password 
                    ? 'border-red-500/50 focus:ring-red-500/50' 
                    : 'border-gray-700/50 focus:border-purple-500/50 focus:ring-purple-500/50'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-2 text-sm text-red-400 flex items-center space-x-1">
                <AlertCircle size={14} />
                <span>{errors.password}</span>
              </p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm Password"
                className={`w-full pl-12 pr-12 py-3 bg-gray-800/50 rounded-xl focus:outline-none focus:ring-2 border transition-all duration-200 ${
                  errors.confirmPassword 
                    ? 'border-red-500/50 focus:ring-red-500/50' 
                    : 'border-gray-700/50 focus:border-purple-500/50 focus:ring-purple-500/50'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-2 text-sm text-red-400 flex items-center space-x-1">
                <AlertCircle size={14} />
                <span>{errors.confirmPassword}</span>
              </p>
            )}
          </div>

          {/* Permissions/Role */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Permissions / Role
            </label>
            <div className="space-y-3">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className={`flex items-center p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                    formData.role === role.label
                      ? `bg-gradient-to-r ${role.color} bg-opacity-20 border-${role.color.split('-')[1]}-500/50`
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

          {/* Action Buttons */}
          <div className="flex items-center space-x-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-200 shadow-lg shadow-red-500/20 hover:shadow-red-500/40 flex items-center justify-center space-x-2"
            >
              <UserPlus size={20} />
              <span>{isSubmitting ? 'Creating...' : 'Create Account'}</span>
            </button>
            
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <X size={20} />
              <span>Cancel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAdmin;