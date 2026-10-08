const mongoose = require('mongoose');
const config = require('./index');

module.exports = async function connectDB() {
  try {
    // Atlas on a sleeping/cold Render instance can need a few seconds, so allow 15s.
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    console.error(
      'Check: (1) MONGODB_URI is correct, (2) Atlas > Network Access allows 0.0.0.0/0, ' +
        '(3) the database user/password are right (special characters must be URL-encoded).'
    );
    process.exit(1);
  }
};
