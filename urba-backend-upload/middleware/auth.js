const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/apiError');

const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // Check cookie first (preferred HttpOnly mechanism)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new ApiError(401, 'Authentication required. Please log in.');
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fashion_store_production_grade_jwt_secret_key_9988776655'
    );

    const user = await User.findById(decoded.id);

    if (!user) {
      throw new ApiError(401, 'User associated with this token no longer exists.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Session invalid or expired. Please sign in again.'));
    }
    next(error);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'fashion_store_production_grade_jwt_secret_key_9988776655'
      );
      const user = await User.findById(decoded.id);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (err) {
    // If token error, proceed unauthenticated
    next();
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Forbidden: You do not have permission to perform this action.'));
    }
    next();
  };
};

module.exports = { authenticate, authorize, optionalAuth };
