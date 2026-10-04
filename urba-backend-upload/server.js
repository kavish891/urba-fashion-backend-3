require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB Database (Atlas with automatic Memory Server fallback for zero setup)
connectDB();

const server = app.listen(PORT, () => {
  console.log(`[Server] Fashion Store MERN API running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`[Unhandled Rejection] ${err.message}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`[Uncaught Exception] ${err.message}`);
  process.exit(1);
});
