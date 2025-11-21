// src/controllers/admin/createAdmin.js

import User from '../../models/User.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';

// Map vai trò (roleKey) từ frontend sang Permissions (mảng chuỗi)
const PERMISSIONS_MAP = {
    'super_admin': ['manage_users', 'manage_content', 'manage_liverooms', 'handle_support', 'create_admin'], 
    'liveroom_admin': ['manage_liverooms', 'manage_content'], 
    'user_support': ['handle_support', 'manage_users'] 
};

// Quyền hạn bắt buộc của người tạo (chỉ Super Admin có thể tạo Admin khác)
const REQUIRED_PERMISSION_TO_CREATE = 'create_admin'; 

export const createAdminAccount = async (req, res) => {
    // 1. Kiểm tra Validation từ Route
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    // Lưu ý: Frontend đang gửi trường 'role', nhưng backend cần 'roleKey' (id).
    // Chúng ta giả định validation/route đã ánh xạ hoặc frontend đã được sửa để gửi roleKey.
    // Nếu frontend chưa sửa, bạn phải sửa để gửi roleKey (super_admin, liveroom_admin, v.v.)
    const { email, password, username, displayName, roleKey } = req.body; 

    try {
        // **2. Kiểm tra quyền của người tạo (Super Admin):**
        const requestingUser = await User.findById(req.userId); 
        const userPermissions = requestingUser?.permissions || [];
        
        // Kiểm tra người tạo có phải Admin và có quyền tạo Admin không.
        if (requestingUser.roleId !== 'admin' || !userPermissions.includes(REQUIRED_PERMISSION_TO_CREATE)) {
             return res.status(403).json({ success: false, message: 'Bạn không có quyền tạo tài khoản Admin cấp cao.' });
        }


        // 3. Kiểm tra User đã tồn tại
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Username hoặc Email đã được sử dụng.' });
        }

        // 4. Tạo User mới
        const newPermissions = PERMISSIONS_MAP[roleKey] || [];
        const newDisplayName = displayName || username; // Sử dụng username nếu displayName trống

        const newUser = new User({
            email,
            passwordHash: password, // Sẽ được hash qua pre('save') hook
            username,
            displayName: newDisplayName,
            roleId: 'admin', // Role chính trong schema
            permissions: newPermissions, // Gán các quyền chi tiết
            isActive: true,
            verifiedEmail: true,
        });

        await newUser.save();

        // 5. Phản hồi thành công (Loại bỏ các trường nhạy cảm)
        const userResponse = newUser.toObject();
        delete userResponse.passwordHash;
        delete userResponse.refreshToken;
        delete userResponse.otp;

        res.status(201).json({ 
            success: true, 
            message: `Tài khoản Admin (${roleKey.toUpperCase()}) đã được tạo thành công.`, 
            data: userResponse 
        });

    } catch (error) {
        console.error('Lỗi khi tạo tài khoản admin:', error);
        if (error.code === 11000) {
           return res.status(400).json({ success: false, message: 'Username hoặc Email đã tồn tại.' });
        }
        res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ.' });
    }
};