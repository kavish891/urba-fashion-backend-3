const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const { validateLogin, validateRegister } = require('../middleware/validators');

router.post('/register', validateRegister, authController.register);
router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/google', authController.googleAuth);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);
router.post('/forgot-password', loginLimiter, authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;

