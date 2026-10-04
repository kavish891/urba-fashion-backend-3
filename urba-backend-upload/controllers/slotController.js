const SlotMachineConfig = require('../models/SlotMachineConfig');
const SlotSpinLog = require('../models/SlotSpinLog');
const User = require('../models/User');
const ApiError = require('../utils/apiError');

// @desc    Get Slot Machine Configuration & Player Status
// @route   GET /api/slot/config
// @access  Public / Optional Auth
exports.getSlotConfig = async (req, res, next) => {
  try {
    const config = await SlotMachineConfig.getOrCreateConfig();

    let playerStatus = null;
    if (req.user) {
      const user = await User.findById(req.user._id).select(
        'name email coin7Balance spinsAvailable hasUsedWelcomeSpin orderSpinsEarned totalSpinsPlayed totalCoinsWon role'
      );
      if (user) {
        playerStatus = {
          userId: user._id,
          name: user.name,
          email: user.email,
          coin7Balance: user.coin7Balance || 0,
          spinsAvailable: user.spinsAvailable !== undefined ? user.spinsAvailable : 1,
          hasUsedWelcomeSpin: !!user.hasUsedWelcomeSpin,
          orderSpinsEarned: user.orderSpinsEarned || 0,
          totalSpinsPlayed: user.totalSpinsPlayed || 0,
          totalCoinsWon: user.totalCoinsWon || 0,
          isAdmin: user.role === 'admin',
        };
      }
    }

    res.status(200).json({
      success: true,
      config,
      playerStatus,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Pull Lever / Execute Slot Spin
// @route   POST /api/slot/spin
// @access  Authenticated
exports.spinReels = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Please sign in or create an account to spin the slot machine');
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      throw new ApiError(404, 'User account not found');
    }

    const config = await SlotMachineConfig.getOrCreateConfig();

    // Verify user has at least 1 spin available
    if ((user.spinsAvailable || 0) < 1) {
      return res.status(400).json({
        success: false,
        error: 'NO_SPINS_LEFT',
        message:
          'No spins left! Purchase at least 5 Coin7 to get 2 spins, or place an order over ₹777 to earn extra spins.',
        spinsAvailable: user.spinsAvailable || 0,
        coin7Balance: user.coin7Balance || 0,
      });
    }

    // Determine spin type
    let spinType = 'coin7_play';
    if (!user.hasUsedWelcomeSpin) {
      spinType = 'welcome_signup';
      user.hasUsedWelcomeSpin = true;
    } else if ((user.orderSpinsEarned || 0) > 0) {
      spinType = 'order_reward_777';
      user.orderSpinsEarned = Math.max(0, user.orderSpinsEarned - 1);
    }

    // Deduct 1 spin
    user.spinsAvailable = Math.max(0, user.spinsAvailable - 1);
    user.totalSpinsPlayed = (user.totalSpinsPlayed || 0) + 1;

    // User Rule Specifications:
    // 1. Play ONLY on 3 matches (no 2-of-a-kind match rewards, mismatches are failure)
    // 2. 3 Matches:
    //    - Diamond (item #5): 5 points / Coin7 (0 spins)
    //    - Other than Diamond or 7 (Apple, Banana, Bottle, Plastic, Star): ONLY free spins, max 3 spins (0 coins)
    //    - 7 7 7: 5 coins + 5 spins (+ free clothing item).
    //      After getting 7 7 7 one time, there is only 0.5% chance of getting 7 7 7 again!

    const hasWonJackpotOnce = Boolean(user.hasWonJackpotOnce);
    // Probability of 777: 0.5% if won once, otherwise 3%
    const jackpotChance = hasWonJackpotOnce ? 0.005 : 0.03;
    // Probability of other 3-of-a-kind wins: ~16%
    const otherTripleChance = 0.16;

    const rand = Math.random();
    let r1, r2, r3;

    if (rand < jackpotChance) {
      // 7 7 7 JACKPOT HIT!
      r1 = 7;
      r2 = 7;
      r3 = 7;
    } else if (rand < jackpotChance + otherTripleChance) {
      // 3 of a kind for items 1..6 (excluding 7)
      const nonSevenItems = [1, 2, 3, 4, 5, 6];
      const winningItem = nonSevenItems[Math.floor(Math.random() * nonSevenItems.length)];
      r1 = winningItem;
      r2 = winningItem;
      r3 = winningItem;
    } else {
      // Failure / Mismatch (2 or 3 boxes different)
      r1 = Math.floor(Math.random() * 7) + 1;
      r2 = Math.floor(Math.random() * 7) + 1;
      r3 = Math.floor(Math.random() * 7) + 1;
      // Guarantee it is NOT an accidental 3-of-a-kind
      if (r1 === r2 && r2 === r3) {
        r3 = (r3 % 7) + 1;
      }
    }

    const reelsResult = [r1, r2, r3];

    // Calculate win, spins, coins, and free clothing rewards strictly per rules
    let isWin = false;
    let isJackpot = false;
    let matchedCount = 1;
    let coinsWon = 0;
    let spinsWon = 0;
    let freeClothingWon = false;
    let clothingVoucherCode = '';
    let winItemName = '';

    // Play ONLY on 3 matches
    if (r1 === r2 && r2 === r3) {
      isWin = true;
      matchedCount = 3;
      const itemConfig = config.items.find((item) => item.id === r1);
      winItemName = itemConfig ? itemConfig.name : `Item #${r1}`;

      if (r1 === 7) {
        // 7 7 7: 5 coins + 5 spins (+ free clothing voucher)
        isJackpot = true;
        freeClothingWon = true;
        coinsWon = 5;
        spinsWon = 5;
        user.hasWonJackpotOnce = true;
        clothingVoucherCode = 'JACKPOT777-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      } else if (r1 === 5) {
        // Diamond: user get 5 point which are only diamond (0 spins)
        coinsWon = 5;
        spinsWon = 0;
      } else {
        // Anything other than diamond or 7: ONLY rewarded with free spins, max free spin number are 3, 0 coins
        coinsWon = 0;
        if (r1 === 1) {
          // Banana -> 1 spin
          spinsWon = 1;
        } else if (r1 === 2) {
          // Apple -> max 3 spins
          spinsWon = 3;
        } else if (r1 === 3) {
          // Bottle -> 3 spins
          spinsWon = 3;
        } else if (r1 === 4) {
          // Plastic -> 2 spins
          spinsWon = 2;
        } else if (r1 === 6) {
          // Star -> 3 spins
          spinsWon = 3;
        } else {
          spinsWon = Math.min(3, Math.max(1, 3));
        }
      }
    } else {
      // 2 or 3 boxes are different -> Failure / Loss, 0 coins, 0 spins
      isWin = false;
      matchedCount = (r1 === r2 || r2 === r3 || r1 === r3) ? 2 : 1;
      coinsWon = 0;
      spinsWon = 0;
    }

    if (coinsWon > 0) {
      user.coin7Balance = (user.coin7Balance || 0) + coinsWon;
      user.totalCoinsWon = (user.totalCoinsWon || 0) + coinsWon;
    }
    if (spinsWon > 0) {
      user.spinsAvailable = (user.spinsAvailable || 0) + spinsWon;
    }
    if (freeClothingWon && clothingVoucherCode) {
      user.jackpotVouchers = user.jackpotVouchers || [];
      user.jackpotVouchers.push({
        code: clothingVoucherCode,
        reward: '1 Free Clothing Item of Your Choice',
        date: new Date(),
        redeemed: false,
      });
    }

    await user.save();

    // Log the spin in DB
    await SlotSpinLog.create({
      userId: user._id,
      userEmail: user.email,
      spinType,
      reelsResult,
      matchedCount,
      isWin,
      isJackpot,
      coinsWon,
      spinsWon,
      freeClothingWon,
      clothingVoucherCode,
      spinsRemaining: user.spinsAvailable,
      coin7BalanceAfter: user.coin7Balance,
    });

    let message = '';
    if (isJackpot) {
      message = `🎉 777 JACKPOT! 1 FREE CLOTHING ITEM + 5 COINS + 5 SPINS! Voucher: ${clothingVoucherCode}`;
    } else if (isWin && r1 === 5) {
      message = `💎 TRIPLE DIAMOND! +5 Coin7 Points won!`;
    } else if (isWin) {
      message = `✨ TRIPLE ${winItemName.toUpperCase()}! +${spinsWon} Free Spins won!`;
    } else {
      message = `Aw dang it! Try again.`;
    }

    res.status(200).json({
      success: true,
      reelsResult,
      isWin,
      isJackpot,
      matchedCount,
      coinsWon,
      spinsWon,
      freeClothingWon,
      clothingVoucherCode,
      spinsRemaining: user.spinsAvailable,
      coin7Balance: user.coin7Balance,
      message,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Exchange Coin7 for Spins
// @route   POST /api/slot/exchange-spins
// @access  Authenticated
// Rule 3: "user need at least 5 coin for 2 spin no one spin is allowed"
exports.exchangeSpins = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const { coinsToSpend } = req.body;
    const coins = parseInt(coinsToSpend, 10);

    const config = await SlotMachineConfig.getOrCreateConfig();
    const reqCoins = config.coinsRequiredPerPackage || 5;
    const spinsGranted = config.spinsPerPackage || 2;

    if (!coins || coins < reqCoins || coins % reqCoins !== 0) {
      throw new ApiError(
        400,
        `Invalid coin exchange! Rule: You need at least ${reqCoins} Coin7 for ${spinsGranted} spins (No single spin allowed). Please spend in batches of ${reqCoins} Coin7.`
      );
    }

    const packages = coins / reqCoins;
    const newSpins = packages * spinsGranted;

    const user = await User.findById(req.user._id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if ((user.coin7Balance || 0) < coins) {
      throw new ApiError(
        400,
        `Insufficient Coin7! You have ${user.coin7Balance || 0} Coin7, but need ${coins} Coin7.`
      );
    }

    user.coin7Balance -= coins;
    user.spinsAvailable = (user.spinsAvailable || 0) + newSpins;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Successfully exchanged ${coins} Coin7 for ${newSpins} spins!`,
      spinsAvailable: user.spinsAvailable,
      coin7Balance: user.coin7Balance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Buy Coin7 with Money
// @route   POST /api/slot/buy-coins
// @access  Authenticated
// Rule 3: 1 Coin7 = ₹15 (configurable by owner)
exports.buyCoins = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const { coin7Amount, paymentDetails } = req.body;
    const amount = parseInt(coin7Amount, 10);

    if (!amount || amount < 1) {
      throw new ApiError(400, 'Please provide a valid Coin7 amount (minimum 1)');
    }

    const config = await SlotMachineConfig.getOrCreateConfig();
    const costPerCoin = config.coinPrice || 15;
    const totalCost = amount * costPerCoin;

    const user = await User.findById(req.user._id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Credit coins to user's wallet
    user.coin7Balance = (user.coin7Balance || 0) + amount;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Successfully purchased ${amount} Coin7 for ₹${totalCost}!`,
      coinsPurchased: amount,
      costPaid: totalCost,
      coin7Balance: user.coin7Balance,
      spinsAvailable: user.spinsAvailable || 0,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update Slot Machine Config & 7 Items
// @route   PUT /api/slot/admin/config
// @access  Admin Only
exports.updateSlotConfig = async (req, res, next) => {
  try {
    const { items, coinPrice, minOrderForSpin, coinsRequiredPerPackage, spinsPerPackage } = req.body;

    const config = await SlotMachineConfig.getOrCreateConfig();

    if (coinPrice !== undefined) {
      const price = Number(coinPrice);
      if (price <= 0) throw new ApiError(400, 'Coin price must be greater than 0');
      config.coinPrice = price;
    }

    if (minOrderForSpin !== undefined) {
      config.minOrderForSpin = Number(minOrderForSpin);
    }

    if (coinsRequiredPerPackage !== undefined) {
      config.coinsRequiredPerPackage = Number(coinsRequiredPerPackage);
    }

    if (spinsPerPackage !== undefined) {
      config.spinsPerPackage = Number(spinsPerPackage);
    }

    if (items && Array.isArray(items)) {
      if (items.length !== 7) {
        throw new ApiError(400, 'Exactly 7 slot items must be provided for the wheels.');
      }

      // Update each item ensuring id 1 to 7
      config.items = items.map((item, idx) => ({
        id: idx + 1,
        name: item.name ? item.name.trim() : `Slot Item ${idx + 1}`,
        imageUrl: item.imageUrl ? item.imageUrl.trim() : '',
        clothingType: item.clothingType || 'shirt',
        payoutMultiplier: Number(item.payoutMultiplier) || (idx + 2),
        rarity: item.rarity || 'common',
        accentColor: item.accentColor || '#d4af37',
      }));
    }

    config.updatedBy = req.user ? req.user._id : null;
    await config.save();

    res.status(200).json({
      success: true,
      message: 'Slot machine configuration updated successfully',
      config,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get Recent Spin Activity Logs
// @route   GET /api/slot/admin/logs
// @access  Admin Only
exports.getSlotLogs = async (req, res, next) => {
  try {
    const logs = await SlotSpinLog.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'name email');

    res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get Users with Coin Balances and Adjustment Histories
// @route   GET /api/slot/admin/users
// @access  Admin Only
exports.getUsersForCoins = async (req, res, next) => {
  try {
    const { search = '' } = req.query;
    const query = {};
    if (search.trim()) {
      const q = search.trim();
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('name email phone role coin7Balance spinsAvailable totalCoinsWon coinAdjustmentHistory createdAt')
      .sort({ coin7Balance: -1, createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Increase User Coins (Only increase allowed per security rule)
// @route   POST /api/slot/admin/users/:userId/coins/increase
// @access  Admin Only
exports.increaseUserCoins = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { amount, reason = '' } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      throw new ApiError(400, 'Amount to add must be a positive number greater than 0');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const previousBalance = user.coin7Balance || 0;
    const newBalance = previousBalance + numAmount;
    const actionId = `ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const adjustmentRecord = {
      actionId,
      amountAdded: numAmount,
      previousBalance,
      newBalance,
      adminId: req.user ? req.user._id : null,
      adminName: req.user ? (req.user.name || 'Admin') : 'Admin',
      reason: reason.trim() || 'Admin manual reward increase',
      date: new Date(),
      isUndone: false,
    };

    user.coin7Balance = newBalance;
    user.coinAdjustmentHistory = user.coinAdjustmentHistory || [];
    user.coinAdjustmentHistory.unshift(adjustmentRecord);

    await user.save();

    res.status(200).json({
      success: true,
      message: `Successfully added ${numAmount} Coin7 to ${user.name}'s balance. New balance: ${newBalance} Coin7.`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        coin7Balance: user.coin7Balance,
        spinsAvailable: user.spinsAvailable,
        coinAdjustmentHistory: user.coinAdjustmentHistory,
      },
      adjustment: adjustmentRecord,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Undo Previous Coin Increase
// @route   POST /api/slot/admin/users/:userId/coins/undo
// @access  Admin Only
exports.undoUserCoinIncrease = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { actionId } = req.body;

    if (!actionId) {
      throw new ApiError(400, 'Action ID is required to undo a coin increase');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const history = user.coinAdjustmentHistory || [];
    const record = history.find((r) => r.actionId === actionId);

    if (!record) {
      throw new ApiError(404, 'Adjustment action record not found');
    }

    if (record.isUndone) {
      throw new ApiError(400, 'This coin adjustment has already been undone');
    }

    const amountToRevert = record.amountAdded;
    if (user.coin7Balance < amountToRevert) {
      // Revert as much as available down to 0
      user.coin7Balance = 0;
    } else {
      user.coin7Balance -= amountToRevert;
    }

    record.isUndone = true;
    record.undoneAt = new Date();
    record.undoneBy = req.user ? req.user._id : null;

    user.markModified('coinAdjustmentHistory');
    await user.save();

    res.status(200).json({
      success: true,
      message: `Successfully reverted addition of ${amountToRevert} Coin7. Current balance: ${user.coin7Balance} Coin7.`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        coin7Balance: user.coin7Balance,
        spinsAvailable: user.spinsAvailable,
        coinAdjustmentHistory: user.coinAdjustmentHistory,
      },
      undoneActionId: actionId,
    });
  } catch (error) {
    next(error);
  }
};
