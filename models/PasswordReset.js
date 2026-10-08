const mongoose = require('mongoose');

// Only the SHA-256 hash of the reset token is stored. MongoDB deletes expired docs automatically (TTL).
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

module.exports = mongoose.model('PasswordReset', schema);
