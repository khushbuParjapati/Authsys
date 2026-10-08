const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    // Bumped on password reset -> every older session token becomes invalid.
    tokenVersion: { type: Number, default: 0 },
    // Brute-force protection
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
  },
  { timestamps: true }
);

// Only these fields are ever sent to the browser.
userSchema.methods.toPublic = function () {
  return { name: this.name, username: this.username, email: this.email, createdAt: this.createdAt };
};

module.exports = mongoose.model('User', userSchema);
