const mongoose = require('mongoose');

// Logged-out session tokens (by jti). Entry auto-deletes when the token would have expired anyway.
const schema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

module.exports = mongoose.model('RevokedToken', schema);
