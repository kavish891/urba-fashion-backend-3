const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/apiError');

// Route imports
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const slotRoutes = require('./routes/slotRoutes');

const app = express();

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
        frameSrc: ["'self'", 'https://accounts.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://images.unsplash.com', 'https://res.cloudinary.com', 'https://lh3.googleusercontent.com'],
        connectSrc: ["'self'", 'http://localhost:5173', 'http://localhost:5000', 'https://urbafashions.netlify.app', 'https://elegant-semolina-1ae60e.netlify.app', 'https://accounts.google.com'],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://urbafashions.netlify.app',
  'https://elegant-semolina-1ae60e.netlify.app',
  process.env.CLIENT_URL,
].filter(Boolean).map((u) => u.replace(/\/+$/, ''));

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, '');
      const isAllowed =
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.endsWith('.netlify.app') ||
        cleanOrigin.includes('localhost');

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: Origin ${origin} not allowed.`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-csrf-token'],
  })
);

// Body parsers with payload size limits to mitigate DoS
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Static file serving for uploads (local fallback when Cloudinary is not used)
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Logging (Safe structured logging)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Global API rate limiting
app.use('/api', apiLimiter);

// Health check endpoints (both /health and /api/health)
const healthHandler = (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/slot', slotRoutes);

// 404 Handler for undefined routes
app.use('*', (req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found on this server.`));
});

// Centralized error handling
app.use(errorHandler);

module.exports = app;
