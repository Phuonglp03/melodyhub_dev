import User from '../../models/User.js';
import { normalizeAvatarUrl } from '../../utils/userConstants.js';

// Get current admin profile
export const getAdminProfile = async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware
    
    // Fetch user - permissions should be included by default (not in select: false)
    const user = await User.findById(userId)
      .select('-passwordHash -refreshToken -otp -otpExpires -resetPasswordToken -resetPasswordExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Admin không tồn tại'
      });
    }
    
    // Convert to plain object to check permissions
    const userObj = user.toObject ? user.toObject() : user;

    // Verify user is admin
    if (user.roleId !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Yêu cầu quyền admin'
      });
    }

    // Build response object - use userObj to ensure we get permissions
    const userResponse = {
      id: userObj._id || userObj.id,
      email: userObj.email,
      username: userObj.username,
      displayName: userObj.displayName,
      birthday: userObj.birthday,
      gender: userObj.gender,
      location: userObj.location,
      bio: userObj.bio,
      links: userObj.links || [],
      avatarUrl: normalizeAvatarUrl(userObj.avatarUrl),
      coverPhotoUrl: userObj.coverPhotoUrl,
      roleId: userObj.roleId,
      verifiedEmail: userObj.verifiedEmail,
      isActive: userObj.isActive,
      addressLine: userObj.addressLine,
      provinceCode: userObj.provinceCode,
      provinceName: userObj.provinceName,
      districtCode: userObj.districtCode,
      districtName: userObj.districtName,
      wardCode: userObj.wardCode,
      wardName: userObj.wardName,
      emailNotifications: userObj.emailNotifications,
      pushNotifications: userObj.pushNotifications,
      theme: userObj.theme,
      language: userObj.language,
      permissions: Array.isArray(userObj.permissions) ? userObj.permissions : (userObj.permissions ? [userObj.permissions] : []),
      createdAt: userObj.createdAt,
      updatedAt: userObj.updatedAt
    };

    res.json({
      success: true,
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin admin:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

// Update admin profile
export const updateAdminProfile = async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware
    
    const {
      displayName,
      bio,
      birthday,
      avatarUrl,
      coverPhotoUrl,
      gender,
      location,
      links,
      addressLine,
      provinceCode,
      provinceName,
      districtCode,
      districtName,
      wardCode,
      wardName,
      theme,
      language,
      emailNotifications,
      pushNotifications
    } = req.body;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Admin không tồn tại'
      });
    }

    // Verify user is admin
    if (user.roleId !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Yêu cầu quyền admin'
      });
    }

    // Update allowed fields
    if (displayName !== undefined) user.displayName = displayName;
    if (bio !== undefined) user.bio = bio;
    if (birthday !== undefined) user.birthday = birthday ? new Date(birthday) : undefined;
    
    // Xử lý avatar: CHỈ cho phép upload file, KHÔNG cho phép URL string từ JSON
    if (req.file) {
      const uploadedUrl = req.file.path || req.file.secure_url || req.file.url;
      if (uploadedUrl) {
        user.avatarUrl = uploadedUrl;
      }
    } else if (avatarUrl !== undefined && avatarUrl !== null && avatarUrl !== '') {
      return res.status(400).json({
        success: false,
        message: 'Avatar chỉ có thể cập nhật qua upload file. Vui lòng sử dụng endpoint POST /api/admin/profile/avatar.'
      });
    }
    
    // Xử lý cover photo: CHỈ cho phép upload file, KHÔNG cho phép URL string từ JSON
    if (req.files && req.files.coverPhoto) {
      const uploadedUrl = req.files.coverPhoto.path || req.files.coverPhoto.secure_url || req.files.coverPhoto.url;
      if (uploadedUrl) {
        user.coverPhotoUrl = uploadedUrl;
      }
    } else if (coverPhotoUrl !== undefined && coverPhotoUrl !== null && coverPhotoUrl !== '') {
      return res.status(400).json({
        success: false,
        message: 'Cover photo chỉ có thể cập nhật qua upload file. Vui lòng sử dụng endpoint POST /api/admin/profile/cover-photo.'
      });
    }
    
    if (gender !== undefined) user.gender = gender;
    if (location !== undefined) user.location = location;
    if (addressLine !== undefined) {
      user.addressLine = typeof addressLine === 'string' ? addressLine.trim() : '';
    }
    if (provinceCode !== undefined) {
      user.provinceCode = provinceCode ? provinceCode.toString() : '';
    }
    if (provinceName !== undefined) {
      user.provinceName = typeof provinceName === 'string' ? provinceName.trim() : '';
    }
    if (districtCode !== undefined) {
      user.districtCode = districtCode ? districtCode.toString() : '';
    }
    if (districtName !== undefined) {
      user.districtName = typeof districtName === 'string' ? districtName.trim() : '';
    }
    if (wardCode !== undefined) {
      user.wardCode = wardCode ? wardCode.toString() : '';
    }
    if (wardName !== undefined) {
      user.wardName = typeof wardName === 'string' ? wardName.trim() : '';
    }
    if (links !== undefined) {
      if (Array.isArray(links)) {
        user.links = links
          .map(link => typeof link === 'string' ? link.trim() : '')
          .filter(link => link !== '');
      } else {
        user.links = [];
      }
    }
    if (theme !== undefined) user.theme = theme;
    if (language !== undefined) user.language = language;
    if (emailNotifications !== undefined) user.emailNotifications = emailNotifications;
    if (pushNotifications !== undefined) user.pushNotifications = pushNotifications;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật profile thành công',
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          birthday: user.birthday,
          gender: user.gender,
          location: user.location,
          bio: user.bio,
          links: user.links || [],
          avatarUrl: normalizeAvatarUrl(user.avatarUrl),
          coverPhotoUrl: user.coverPhotoUrl,
          roleId: user.roleId,
          verifiedEmail: user.verifiedEmail,
          isActive: user.isActive,
          addressLine: user.addressLine,
          provinceCode: user.provinceCode,
          provinceName: user.provinceName,
          districtCode: user.districtCode,
          districtName: user.districtName,
          wardCode: user.wardCode,
          wardName: user.wardName,
          emailNotifications: user.emailNotifications,
          pushNotifications: user.pushNotifications,
          theme: user.theme,
          language: user.language,
          permissions: user.permissions || [],
          updatedAt: user.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Lỗi khi cập nhật profile admin:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

// Upload avatar for admin
export const uploadAdminAvatar = async (req, res) => {
  try {
    const userId = req.userId;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ success: false, message: 'Thiếu file avatar' });
    }

    const imageUrl = file.path || file.secure_url || file.url || (file.filename ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${file.filename}` : null);
    
    if (!imageUrl) {
      return res.status(500).json({ 
        success: false, 
        message: 'Upload thất bại - không có URL trả về từ Cloudinary'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { avatarUrl: imageUrl },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Admin không tồn tại' });
    }

    res.json({
      success: true,
      message: 'Upload avatar thành công',
      data: {
        avatarUrl: normalizeAvatarUrl(user.avatarUrl)
      }
    });
  } catch (error) {
    console.error('Lỗi khi upload avatar admin:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// Upload cover photo for admin
export const uploadAdminCoverPhoto = async (req, res) => {
  try {
    const userId = req.userId;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ success: false, message: 'Thiếu file cover photo' });
    }

    const imageUrl = file.path || file.secure_url || file.url || (file.filename ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${file.filename}` : null);
    
    if (!imageUrl) {
      return res.status(500).json({ 
        success: false, 
        message: 'Upload thất bại - không có URL trả về từ Cloudinary'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { coverPhotoUrl: imageUrl },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Admin không tồn tại' });
    }

    res.json({
      success: true,
      message: 'Upload cover photo thành công',
      data: {
        coverPhotoUrl: user.coverPhotoUrl
      }
    });
  } catch (error) {
    console.error('Lỗi khi upload cover photo admin:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

