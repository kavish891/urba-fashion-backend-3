const mongoose = require('mongoose');

const slotSpinLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      default: '',
    },
    spinType: {
      type: String,
      enum: ['welcome_signup', 'order_reward_777', 'coin7_play'],
      default: 'welcome_signup',
    },
    reelsResult: {
      type: [Number], // e.g. [3, 3, 3] or [1, 4, 7]
      required: true,
    },
    matchedCount: {
      type: Number,
      default: 0,
    },
    isWin: {
      type: Boolean,
      default: false,
    },
    isJackpot: {
      type: Boolean,
      default: false,
    },
    coinsWon: {
      type: Number,
      default: 0,
    },
    spinsWon: {
      type: Number,
      default: 0,
    },
    freeClothingWon: {
      type: Boolean,
      default: false,
    },
    clothingVoucherCode: {
      type: String,
      default: '',
    },
    spinsRemaining: {
      type: Number,
      default: 0,
    },
    coin7BalanceAfter: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SlotSpinLog', slotSpinLogSchema);
