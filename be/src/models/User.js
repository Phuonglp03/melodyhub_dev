import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { DEFAULT_AVATAR_URL, normalizeAvatarUrl } from '../utils/userConstants.js';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    birthday: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', 'unspecified'], default: 'unspecified' },
    addressLine: { type: String, trim: true, default: '' },
    provinceCode: { type: String, trim: true, default: '' },
    provinceName: { type: String, trim: true, default: '' },
    districtCode: { type: String, trim: true, default: '' },
    districtName: { type: String, trim: true, default: '' },
    wardCode: { type: String, trim: true, default: '' },
    wardName: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    bio: { type: String },
    links: { type: [String], default: [] },
    avatarUrl: { type: String, trim: true, default: DEFAULT_AVATAR_URL },
    coverPhotoUrl: { type: String, trim: true, default: '' },
    roleId: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
    permissions: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, required: true },
    verifiedEmail: { type: Boolean, default: false, required: true },
    otp: { type: String },
    otpExpires: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    refreshToken: { type: String, select: false },
    googleId: {
      type: String,
      unique: true,
      sparse: true // Allows null values for non-Google users
    },
    totalLikesReceived: { type: Number, default: 0, required: true },
    totalCommentsReceived: { type: Number, default: 0, required: true },
    followersCount: { type: Number, default: 0, required: true },
    followingCount: { type: Number, default: 0, required: true },
    emailNotifications: { type: Boolean, default: true, required: true },
    pushNotifications: { type: Boolean, default: true, required: true },
    privacyProfile: { type: String, enum: ['public', 'followers', 'private'], default: 'public', required: true },
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'dark', required: true },
    language: { type: String, default: 'en', required: true },
    livestreamBanned: { type: Boolean, default: false },
    livestreamBannedAt: { type: Date },
    livestreamBannedReason: { type: String },
    chatBannedByHosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.passwordHash;
        delete ret.refreshToken;
        delete ret.otp;
        delete ret.otpExpires;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        ret.avatarUrl = normalizeAvatarUrl(ret.avatarUrl);
        return ret;
      },
    },
  }
);

userSchema.index({ username: 1 });

// Hash password trước khi lưu
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre('save', function (next) {
  this.avatarUrl = normalizeAvatarUrl(this.avatarUrl);
  next();
});

// Phương thức kiểm tra mật khẩu
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Phương thức tạo refresh token
userSchema.methods.generateRefreshToken = function () {
  const refreshToken = require('../utils/jwt').createRefreshToken({ id: this._id });
  this.refreshToken = refreshToken;
  return refreshToken;
};

// Phương thức xóa refresh token
userSchema.methods.clearRefreshToken = function () {
  this.refreshToken = undefined;
  return this.save();
};

const User = mongoose.model('User', userSchema);

export default User;