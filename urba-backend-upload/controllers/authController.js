const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/apiError');

// Generates signed JWT
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET || 'fashion_store_production_grade_jwt_secret_key_9988776655',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    }
  );
};

// Set secure auth cookie
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = generateToken(user._id, user.role);

  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  res.status(statusCode).json({
    success: true,
    message,
    token,
    user: {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
    },
  });
};

// @desc    Register new user account (Customer) with name, phone, email, password
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      throw new ApiError(400, 'Name, email, and password are required');
    }

    if (password.length < 6) {
      throw new ApiError(400, 'Password must be at least 6 characters long');
    }

    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      throw new ApiError(409, 'An account with this email address already exists. Please sign in.');
    }

    const passwordHash = await User.hashPassword(password);

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: phone ? phone.trim() : '',
      passwordHash,
      role: 'customer',
    });

    sendTokenResponse(user, 201, res, 'Account created successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Login for Admin and Customers
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, 'Please provide email and password');
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail }).select('+passwordHash');
    if (!user) {
      throw new ApiError(401, 'Invalid email or password credentials');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid email or password credentials');
    }

    sendTokenResponse(user, 200, res, 'Signed in successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Google OAuth / One-Tap / Firebase / Supabase Google Token Handler
// @route   POST /api/auth/google
// @access  Public
exports.googleAuth = async (req, res, next) => {
  try {
    const { email, name, avatar, googleId } = req.body;

    if (!email) {
      throw new ApiError(400, 'Google account email is required');
    }

    const cleanEmail = email.toLowerCase().trim();

    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      // Auto-create customer account
      user = await User.create({
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        googleId: googleId || '',
        avatar: avatar || '',
        role: 'customer',
      });
    } else {
      if (avatar && !user.avatar) user.avatar = avatar;
      if (googleId && !user.googleId) user.googleId = googleId;
      await user.save();
    }

    sendTokenResponse(user, 200, res, 'Google authentication successful');
  } catch (error) {
    next(error);
  }
};

// @desc    Logout (Clear session cookie)
// @route   POST /api/auth/logout
// @access  Public
exports.logout = (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    expires: new Date(0),
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

// @desc    Get current authenticated profile
// @route   GET /api/auth/me
// @access  Authenticated
exports.getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot Password - Send reset email link
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {

  try {
    const { email } = req.body;
    if (!email) {
      throw new ApiError(400, 'Please enter your account email address');
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    // Anti-enumeration: return identical success message even if account is not found
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been dispatched.',
      });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    // Link includes token parameter
    const resetUrl = `${clientUrl}/?view=reset-password&token=${resetToken}`;

    const sendEmail = require('../utils/sendEmail');
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #111827; margin-bottom: 12px;">Reset Your Password</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hello <strong>${user.name}</strong>,</p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">We received a request to reset your Urban Threads account password. Click the button below to choose a new password. This link is valid for <strong>15 minutes</strong>.</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background: #111827; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">Or copy and paste this link into your browser:<br/><a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a></p>
        <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
      </div>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset Your Password - Urban Threads',
        html: emailHtml,
        text: `Reset your password by opening: ${resetUrl}`,
      });

      res.status(200).json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been dispatched.',
      });
    } catch (mailErr) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      console.error('Mail delivery failure:', mailErr);
      throw new ApiError(500, 'Unable to deliver reset email. Please verify your email configuration.');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Password via secure token
// @route   POST /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) {
      throw new ApiError(400, 'Password reset token is missing or malformed');
    }

    if (!password || password.length < 6) {
      throw new ApiError(400, 'Password must be at least 6 characters long');
    }

    const crypto = require('crypto');
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+passwordHash');

    if (!user) {
      throw new ApiError(400, 'Password reset link is invalid or has expired. Please request a new one.');
    }

    // Set and hash new password
    user.passwordHash = await User.hashPassword(password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendTokenResponse(user, 200, res, 'Password updated successfully. You are now signed in.');
  } catch (error) {
    next(error);
  }
};

