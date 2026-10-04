const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  const mongoUri = process.env.MONGODB_URI;

  try {
    if (mongoUri && !mongoUri.includes('username:password')) {
      const conn = await mongoose.connect(mongoUri);
      isConnected = true;
      console.log(`[Database] MongoDB Atlas Connected: ${conn.connection.host}`);
      return;
    }
  } catch (err) {
    console.warn(`[Database Warning] Could not connect to Atlas URI: ${err.message}`);
  }

  // Graceful local/fallback mode: Use mongodb-memory-server if Atlas URI is not supplied or unreachable in dev
  try {
    console.log('[Database] Starting in-memory MongoDB engine for zero-setup local operation...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    const conn = await mongoose.connect(uri);
    isConnected = true;
    console.log(`[Database] In-Memory MongoDB Engine Connected: ${conn.connection.host}`);

    // Auto-seed initial catalog if empty
    const Product = require('../models/Product');
    const count = await Product.countDocuments();
    if (count === 0) {
      console.log('[Database] Auto-seeding initial luxury shoes & shirts catalog...');
      const { seedDatabase } = require('../utils/seeder');
      await seedDatabase();
    }
  } catch (memErr) {
    console.error(`[Database Error] Could not initialize fallback MongoDB: ${memErr.message}`);
  }
};

module.exports = connectDB;
