const mongoose = require('mongoose');

const slotItemSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      min: 1,
      max: 7,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
    imageUrl: {
      type: String,
      default: '', // Owner can edit/upload clothing item pictures. Initially empty placeholder per user request.
      trim: true,
    },
    symbolType: {
      type: String,
      enum: ['banana', 'apple', 'bottle', 'plastic', 'diamond', 'star', 'special', 'shirt', 'shoes', 'jacket', 'trousers', 'accessory', 'suit'],
      default: 'banana',
    },
    symbolIcon: {
      type: String,
      default: '🍌',
    },
    rewardText: {
      type: String,
      default: '',
    },
    spinsReward: {
      type: Number,
      default: 0,
    },
    payoutMultiplier: {
      type: Number,
      default: 2,
      min: 1,
    },
    rarity: {
      type: String,
      enum: ['common', 'rare', 'epic', 'legendary', 'grail'],
      default: 'common',
    },
    accentColor: {
      type: String,
      default: '#d4af37',
    },
  },
  { _id: false }
);

const slotMachineConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: 'Urban Threads Luxury Slot Machine',
    },
    // The 7 editable clothing items on each wheel
    items: {
      type: [slotItemSchema],
      validate: {
        validator: function (v) {
          return v && v.length === 7;
        },
        message: 'Slot machine must configure exactly 7 items per wheel.',
      },
    },
    // Rule 3: 15 currency = 1 Coin7 (editable by owner)
    coinPrice: {
      type: Number,
      default: 15,
      min: 1,
    },
    // Rule 3: "user need at least 5 coin for 2 spin no one spin is allowed"
    coinsRequiredPerPackage: {
      type: Number,
      default: 5,
      min: 1,
    },
    spinsPerPackage: {
      type: Number,
      default: 2,
      min: 2,
    },
    // Rule 2: "when they buy iteams more than 777"
    minOrderForSpin: {
      type: Number,
      default: 777,
      min: 1,
    },
    wheelCount: {
      type: Number,
      default: 3,
    },
    itemsPerWheel: {
      type: Number,
      default: 7,
    },
    jackpotMultiplier: {
      type: Number,
      default: 77,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Static method to get or initialize the singleton slot configuration
slotMachineConfigSchema.statics.getOrCreateConfig = async function () {
  const defaultItems = [
    { id: 1, name: 'Banana', symbolType: 'banana', symbolIcon: '🍌', imageUrl: '', spinsReward: 1, rewardText: '+1 Free Spin', payoutMultiplier: 1, rarity: 'common', accentColor: '#eab308' },
    { id: 2, name: 'Apple', symbolType: 'apple', symbolIcon: '🍎', imageUrl: '', spinsReward: 5, rewardText: '+5 Free Spins', payoutMultiplier: 5, rarity: 'rare', accentColor: '#ef4444' },
    { id: 3, name: 'Bottle', symbolType: 'bottle', symbolIcon: '🍾', imageUrl: '', spinsReward: 3, rewardText: '+3 Free Spins', payoutMultiplier: 3, rarity: 'common', accentColor: '#10b981' },
    { id: 4, name: 'Plastic', symbolType: 'plastic', symbolIcon: '🧴', imageUrl: '', spinsReward: 2, rewardText: '+2 Free Spins', payoutMultiplier: 2, rarity: 'common', accentColor: '#06b6d4' },
    { id: 5, name: 'Diamond', symbolType: 'diamond', symbolIcon: '💎', imageUrl: '', spinsReward: 7, rewardText: '+7 Free Spins', payoutMultiplier: 7, rarity: 'epic', accentColor: '#8b5cf6' },
    { id: 6, name: 'Star', symbolType: 'star', symbolIcon: '⭐', imageUrl: '', spinsReward: 10, rewardText: '+10 Free Spins', payoutMultiplier: 10, rarity: 'legendary', accentColor: '#f59e0b' },
    { id: 7, name: 'Lucky 7', symbolType: 'special', symbolIcon: '7️⃣', imageUrl: '', spinsReward: 20, rewardText: '1 FREE CLOTHING ITEM', payoutMultiplier: 77, rarity: 'grail', accentColor: '#d4af37' },
  ];

  let config = await this.findOne();
  if (!config) {
    config = await this.create({
      items: defaultItems,
      coinPrice: 15,
      coinsRequiredPerPackage: 5,
      spinsPerPackage: 2,
      minOrderForSpin: 777,
      wheelCount: 3,
      itemsPerWheel: 7,
    });
  } else if (!config.items || config.items.length !== 7 || config.items[0]?.name !== 'Banana') {
    // Migrate existing database config to the new banana, apple, bottle, plastic symbols
    config.items = defaultItems;
    await config.save();
  }
  return config;
};

module.exports = mongoose.model('SlotMachineConfig', slotMachineConfigSchema);
