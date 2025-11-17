import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sendMail from './sendMail.js';
import { validationResult } from 'express-validator';
import crypto from 'crypto';

// Generate access and refresh tokens
export const generateTokens = async (user) => {
  // Generate access token (15 minutes)
  const accessToken = jwt.sign(
    {
      userId: user._id,
      email: user.email,
      roleId: user.roleId
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '1h' }
  );

  // Generate refresh token (7 days)
  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );

  // Save refresh token to user
  user.refreshToken = refreshToken;
  await user.save();

  return { accessToken, refreshToken };
};

// Generate random OTP
const generateOTP = () => {
  // Generate 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp) => {
  const subject = 'Verify Your Email Address';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello,</h2>
      <p>Please use the OTP below to verify your email address:</p>
      <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
        ${otp}
      </div>
      <p>This OTP is valid for 10 minutes.</p>
      <p>If you did not request this code, please ignore this email.</p>
      <hr>
      <p>Regards,<br>The MelodyHub Team</p>
    </div>
  `;

  try {
    const result = await sendMail({ email, subject, html });
    if (result.success) {
      console.log('OTP email sent successfully');
      return true;
    } else {
      console.error('Failed to send OTP email:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
};

// Login controller
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Kiểm tra thông tin đăng nhập
    const user = await User.findOne({ email }).select('+passwordHash');
    
    // Kiểm tra xem tài khoản có tồn tại không
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Email hoặc mật khẩu không đúng' 
      });
    }

    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Email hoặc mật khẩu không đúng' 
      });
    }

    // Kiểm tra xem email đã được xác thực chưa
    if (!user.verifiedEmail) {
      return res.status(403).json({
        success: false,
        message: 'Vui lòng xác thực email trước khi đăng nhập',
        requiresVerification: true,
        email: user.email
      });
    }

    const { accessToken, refreshToken } = await generateTokens(user);

    // Set refresh token vào httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
    });

    // Trả về access token, refresh token và thông tin user
    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      token: accessToken,
      refreshToken: refreshToken,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        roleId: user.roleId,
        verifiedEmail: user.verifiedEmail
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

// Refresh token controller
export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Không tìm thấy refresh token' });
    }

    // Tìm user có refresh token này
    const user = await User.findOne({ refreshToken: refreshToken }).select('+refreshToken');
    if (!user) {
      return res.status(403).json({ message: 'Refresh token không hợp lệ' });
    }

    // Xác thực refresh token
    jwt.verify(refreshToken, process.env.JWT_SECRET || 'your-secret-key', (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
      }

      // Tạo access token mới
      const accessToken = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          roleId: user.roleId
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      res.json({
        token: accessToken,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          roleId: user.roleId,
          verifiedEmail: user.verifiedEmail
        }
      });
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

// Logout controller
export const logout = async (req, res) => {
  try {
    // Lấy refresh token từ cookie
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(200).json({ message: 'Đăng xuất thành công' });
    }

    // Tìm user có refresh token này
    const user = await User.findOne({ refreshToken });
    
    // Nếu tìm thấy user, xóa refresh token
    if (user) {
      user.refreshToken = undefined;
      await user.save();
    }

    // Xóa refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/'
    });

    res.json({ message: 'Đăng xuất thành công' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Verify email with OTP
export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).select('+refreshToken');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Email is not registered.'
      });
    }

    // Check if email is already verified
    if (user.verifiedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email has already been verified.'
      });
    }

    // Verify OTP and activate account
    if (user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP code' });
    }

    if (user.otpExpires < new Date()) {
      return res.status(400).json({ message: 'OTP code has expired' });
    }

    // Update user to verified
    user.verifiedEmail = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Send welcome email after successful verification
    try {
      await sendMail({
        email: user.email,
        subject: 'Welcome to MelodyHub!',
        html: `
          <h2>Welcome ${user.displayName} to MelodyHub - The Collaboration Space for Artists!</h2>
          <p>Thank you for verifying your MelodyHub account. We are excited to welcome you!</p>
          <p>Here is your account information:</p>
          <ul>
            <li><strong>Name:</strong> ${user.displayName}</li>
            <li><strong>Email:</strong> ${user.email}</li>  
          </ul>
          <p>You can now log in and start using all the features of MelodyHub.</p>
          <p>If you have any questions, please do not hesitate to contact us.</p>
          <br/>
          <p>Regards,</p>
          <p>The MelodyHub Team</p>
        `
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Continue even if welcome email fails
    }

    const { accessToken, refreshToken } = await generateTokens(user);

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      token: accessToken,
      refreshToken: refreshToken,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        roleId: user.roleId,
        verifiedEmail: true
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during email verification',
      error: error.message
    });
  }
};

// Resend OTP
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Email is not registered.'
      });
    }

    // Check if email is already verified
    if (user.verifiedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email has already been verified.'
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with new OTP
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Send new OTP email
    const emailSent = await sendOTPEmail(email, otp);

    if (!emailSent) {
      console.error('Failed to resend OTP email');
      return res.status(500).json({
        success: false,
        message: 'Could not resend OTP. Please try again later.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'OTP has been resent. Please check your email.'
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resending OTP',
      error: error.message
    });
  }
};

export const register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { fullName, email, password, birthday } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: 'Email already registered'
      });
    }

    // Generate OTP and set expiration (10 minutes from now)
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Generate username from email (before @)
    let username = email.split('@')[0].toLowerCase();

    // Check if username exists, if so, add random numbers
    let usernameExists = await User.findOne({ username });
    while (usernameExists) {
      username = `${email.split('@')[0].toLowerCase()}${Math.floor(Math.random() * 10000)}`;
      usernameExists = await User.findOne({ username });
    }

    // Hash password
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user with OTP
    const newUser = new User({
      email,
      passwordHash: password,
      username,
      displayName: fullName,
      birthday: birthday ? new Date(birthday) : null,
      otp,
      otpExpires,
      verifiedEmail: false,
      roleId: 'user',
      isActive: true
    });

    // First save the user to get _id
    await newUser.save();


    // Send verification email
    await sendOTPEmail(email, otp);

    // Return response with tokens and user data
    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
      user: {
        id: newUser._id,
        email: newUser.email,
        username: newUser.username,
        displayName: newUser.displayName,
        roleId: newUser.roleId,
        verifiedEmail: newUser.verifiedEmail
      },
      requiresVerification: true
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Server error during registration',
      error: error.message
    });
  }
};

// Generate reset password token
const generateResetToken = () => {
  // Generate a random 32-character token using Web Crypto API
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  // Convert the 32 bytes to a 64-character hexadecimal string
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Send reset password email
const sendResetPasswordEmail = async (email, resetToken) => {
  // Note: Replace http://localhost:3000 with your actual frontend domain in production
  const resetLink = `http://localhost:3000/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
  const subject = 'Your Password Reset Request';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello,</h2>
      <p>You have requested a password reset for your MelodyHub account.</p>
      <p>Please click the button below to reset your password:</p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${resetLink}" style="background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Reset Password
        </a>
      </div>
      <p>Or copy and paste the following link into your browser:</p>
      <p style="word-break: break-all; background: #f4f4f4; padding: 10px; border-radius: 4px;">
        ${resetLink}
      </p>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request a password reset, please ignore this email.</p>
      <hr>
      <p>Sincerely,<br>The MelodyHub Team</p>
    </div>
  `;

  try {
    // Assume 'sendMail' is an existing function to send the email
    const result = await sendMail({ email, subject, html }); 
    if (result.success) {
      console.log('Reset password email sent successfully');
      return true;
    } else {
      console.error('Failed to send reset password email:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Error sending reset password email:', error);
    return false;
  }
};

// Forgot password controller
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({ message: 'Please provide an email address' });
    }

    // Find user by email
    // Assume 'User' is your Mongoose/database model
    const user = await User.findOne({ email });
    
    // Always return success to prevent email enumeration attack
    if (!user) {
      return res.status(200).json({ 
        message: 'If the email exists, we have sent password reset instructions' 
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour (3600000 ms) from now

    // Save reset token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Send reset password email
    await sendResetPasswordEmail(user.email, resetToken);

    res.status(200).json({ 
      message: 'If the email exists, we have sent password reset instructions' 
    });
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
};

// Reset password controller
export const resetPassword = async (req, res) => {
  try {
    // Assume 'token' and 'email' are passed from the query string and 'newPassword' from the body
    const { token, email, newPassword } = req.body;

    // Validate input
    if (!token || !email || !newPassword) {
      return res.status(400).json({ 
        message: 'Missing required information' 
      });
    }

    // Find user by email, matching token, and checking expiration
    const user = await User.findOne({ 
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() } // Check if token is not expired
    });

    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid or expired password reset link' 
      });
    }

    // Hash the new password
    // Assume 'bcrypt' is imported and available
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update user password and clear reset token
    user.passwordHash = passwordHash; // Assuming your user model uses 'passwordHash'
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();

    res.status(200).json({ 
      message: 'Password reset successful. You can now log in with your new password.' 
    });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
};