import User from '../../models/User.js';
import mongoose from 'mongoose';

export const adminGetUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      role,
      sortBy = 'username',
      sortOrder = 'asc'
    } = req.query;

    // Build query
    const query = {};

    // Search by username, email, or displayName
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by status
    if (status === 'locked') {
      query.isActive = false;
    }else if (status === 'active') {
      query.isActive = true;
    }

    // Filter by role
    if (role) {
      query.roleId = role;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const users = await User.find(query)
      .select('-passwordHash -refreshToken -otp -otpExpires -resetPasswordToken -resetPasswordExpires')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const adminUpdateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
    }

    // Remove any restricted fields
    const restrictedFields = ['passwordHash', 'refreshToken', 'otp', 'otpExpires'];
    restrictedFields.forEach(field => delete updates[field]);

    // If updating email, set verified to false
    if (updates.email) {
      updates.verifiedEmail = false;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    )
    .select('-passwordHash -refreshToken -otp -otpExpires -resetPasswordToken -resetPasswordExpires');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Lỗi khi cập nhật người dùng:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tên đăng nhập hoặc email đã tồn tại' 
      });
    }
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const adminToggleUserLock = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // Prevent locking admin accounts
    if (user.roleId === 'admin' && user._id.toString() !== req.userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Không thể khóa tài khoản admin khác' 
      });
    }

    // Toggle isLocked status
    user.isActive = !user.isActive;

    await user.save();

    // Remove sensitive data before sending response
    const userResponse = user.toObject();
    const fieldsToRemove = ['passwordHash', 'refreshToken', 'otp', 'otpExpires', 'resetPasswordToken', 'resetPasswordExpires'];
    fieldsToRemove.forEach(field => delete userResponse[field]);

    res.json({ 
      success: true, 
      data: userResponse,
      message: user.isActive ? 'Đã mở khóa tài khoản thành công' : 'Đã khóa tài khoản thành công'
    });
  } catch (error) {
    console.error('Lỗi khi thay đổi trạng thái khóa tài khoản:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};