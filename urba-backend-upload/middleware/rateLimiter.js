const rateLimit = require('express-rate-limit');

// General API limiter: 200 requests per 15 mins per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for authentication attempts: 5 per 15 mins
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many failed login attempts. Please wait 15 minutes before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Order creation limiter: 10 orders per 10 mins per IP
const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Order submission limit reached. Please wait a few minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, loginLimiter, orderLimiter };
