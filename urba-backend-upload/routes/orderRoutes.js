const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { orderLimiter } = require('../middleware/rateLimiter');
const { validateOrder } = require('../middleware/validators');
const { authenticate } = require('../middleware/auth');

// Public customer routes
router.post('/', orderLimiter, validateOrder, orderController.createOrder);
router.get('/lookup', orderController.lookupOrder);

// Authenticated customer order history
router.get('/my-orders', authenticate, orderController.getMyOrders);

module.exports = router;
