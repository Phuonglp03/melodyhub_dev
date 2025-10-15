import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    bio: { type: String },
    avatarUrl: { type: String },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
    isActive: { type: Boolean, default: true, required: true },
    verifiedEmail: { type: Boolean, default: false, required: true },
    totalLikesReceived: { type: Number, default: 0, required: true },
    totalCommentsReceived: { type: Number, default: 0, required: true },
    followersCount: { type: Number, default: 0, required: true },
    followingCount: { type: Number, default: 0, required: true },
    emailNotifications: { type: Boolean, default: true, required: true },
    pushNotifications: { type: Boolean, default: true, required: true },
    privacyProfile: { type: String, enum: ['public', 'followers', 'private'], default: 'public', required: true },
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'dark', required: true },
    language: { type: String, default: 'en', required: true },
  },
  { timestamps: true }
);

userSchema.index({ username: 1 });

userSchema.methods.comparePassword = async function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

const User = mongoose.model('User', userSchema);
export default User;


