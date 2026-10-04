const express = require('express');
const router = express.Router();
const slotController = require('../controllers/slotController');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

// Public / Player route to get active slot configuration & player balance
router.get('/config', optionalAuth, slotController.getSlotConfig);

// Player Spin action
router.post('/spin', authenticate, slotController.spinReels);

// Exchange Coin7 for Spins (Min 5 Coin7 = 2 spins, multiples only)
router.post('/exchange-spins', authenticate, slotController.exchangeSpins);

// Buy Coin7
router.post('/buy-coins', authenticate, slotController.buyCoins);

// Admin controls
router.put('/admin/config', authenticate, authorize('admin'), slotController.updateSlotConfig);
router.get('/admin/logs', authenticate, authorize('admin'), slotController.getSlotLogs);
router.get('/admin/users', authenticate, authorize('admin'), slotController.getUsersForCoins);
router.post('/admin/users/:userId/coins/increase', authenticate, authorize('admin'), slotController.increaseUserCoins);
router.post('/admin/users/:userId/coins/undo', authenticate, authorize('admin'), slotController.undoUserCoinIncrease);

module.exports = router;
