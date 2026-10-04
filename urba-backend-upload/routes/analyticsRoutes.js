const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Public route to capture customer storefront interactions
router.post('/track', analyticsController.trackEvent);

module.exports = router;
