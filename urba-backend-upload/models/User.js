const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    passwordHash: {
      type: String,
      select: false, // Hidden by default
    },
    googleId: {
      type: String,
      default: '',
    },
    avatar: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['admin', 'customer'],
      default: 'customer',
      index: true,
    },
    // ── Slot Machine / Gambling Luck System ──────────────────────
    coin7Balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    spinsAvailable: {
      type: Number,
      default: 1, // Rule 1: First-time signup grants 1 free spin!
      min: 0,
    },
    hasUsedWelcomeSpin: {
      type: Boolean,
      default: false,
    },
    orderSpinsEarned: {
      type: Number,
      default: 0, // Rule 2: Spins earned from orders > 777
      min: 0,
    },
    totalSpinsPlayed: {
      type: Number,
      default: 0,
    },
    totalCoinsWon: {
      type: Number,
      default: 0,
    },
    hasWonJackpotOnce: {
      type: Boolean,
      default: false,
    },
    jackpotVouchers: [
      {
        code: { type: String, default: '' },
        reward: { type: String, default: '1 Free Clothing Item' },
        date: { type: Date, default: Date.now },
        redeemed: { type: Boolean, default: false },
      },
    ],
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpire: {
      type: Date,
      select: false,
    },
    // Audit log of admin coin increments for undo capability
    coinAdjustmentHistory: [
      {
        actionId: { type: String, required: true },
        amountAdded: { type: Number, required: true },
        previousBalance: { type: Number, required: true },
        newBalance: { type: Number, required: true },
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        adminName: { type: String, default: 'Admin' },
        reason: { type: String, default: '' },
        date: { type: Date, default: Date.now },
        isUndone: { type: Boolean, default: false },
        undoneAt: { type: Date },
        undoneBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Method to verify password securely
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.passwordHash) return false;
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

// Generate and hash password reset token (valid for 15 minutes)
userSchema.methods.getResetPasswordToken = function () {
  const crypto = require('crypto');
  // Generate random 32-byte hex token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash token with SHA-256 and store in document
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Expiration set to 15 minutes
  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

  return resetToken;
};

// Static helper to hash passwords with salt factor 12
userSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(plainPassword, salt);
};

module.exports = mongoose.model('User', userSchema);

