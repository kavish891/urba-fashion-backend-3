const { body, validationResult } = require('express-validator');
const ApiError = require('../utils/apiError');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map((err) => `${err.path}: ${err.msg}`);
    return next(new ApiError(400, 'Input validation error', extractedErrors));
  }
  next();
};

const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .matches(/^[a-zA-Z\s'.]{2,60}$/)
    .withMessage('Please enter a valid human name (letters and spaces only, min 2 characters)'),
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit Indian phone number starting with +91 (e.g. +919876543210)'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  handleValidationErrors,
];

const validateLogin = [
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  handleValidationErrors,
];

const validateOrder = [
  body('customer.name').trim().notEmpty().withMessage('Customer name is required'),
  body('customer.email').isEmail().withMessage('Valid customer email is required').normalizeEmail(),
  body('customer.phone')
    .trim()
    .matches(/^[0-9+ -]{7,15}$/)
    .withMessage('Valid phone number is required'),
  body('shippingAddress.address').trim().notEmpty().withMessage('Shipping address is required'),
  body('shippingAddress.city').trim().notEmpty().withMessage('City is required'),
  body('shippingAddress.state').trim().notEmpty().withMessage('State is required'),
  body('shippingAddress.pincode')
    .trim()
    .matches(/^[a-zA-Z0-9 -]{4,10}$/)
    .withMessage('Valid postal / pincode is required'),
  body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
  body('items.*.productId').trim().notEmpty().withMessage('Valid product ID is required'),
  body('items.*.size').trim().notEmpty().withMessage('Item size is required'),
  body('items.*.quantity').isInt({ min: 1, max: 20 }).withMessage('Quantity must be between 1 and 20'),
  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateOrder,
  handleValidationErrors,
};
