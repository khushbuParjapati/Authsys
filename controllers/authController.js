const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const RevokedToken = require('../models/RevokedToken');
const asyncHandler = require('../utils/asyncHandler');
const { sendResetEmail } = require('../utils/mailer');
const { signSession, setSessionCookie, clearSessionCookie } = require('../utils/session');
const { validateRegister, validateLogin, validateForgot, validateReset, firstError } = require('../utils/validate');

// Used so "unknown user" takes as long as "wrong password" (prevents user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('timing-attack-dummy', config.bcryptRounds);
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const bad = (res, errors) => res.status(400).json({ message: firstError(errors), errors });

function waitText(seconds) {
  return seconds >= 60 ? `${Math.ceil(seconds / 60)} minute(s)` : `${seconds} second(s)`;
}

/* POST /api/auth/register */
exports.register = asyncHandler(async (req, res) => {
  const { errors, value } = validateRegister(req.body);
  if (errors) return bad(res, errors);

  try {
    const passwordHash = await bcrypt.hash(value.password, config.bcryptRounds);
    await User.create({ name: value.name, username: value.username, email: value.email, passwordHash });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      const message = field === 'email' ? 'Email is already registered.' : 'Username is already taken.';
      return res.status(409).json({ message, errors: { [field || 'username']: message } });
    }
    throw err;
  }
  res.status(201).json({ message: 'Account created.' });
});

/* POST /api/auth/login  (email OR username) */
exports.login = asyncHandler(async (req, res) => {
  const { errors, value } = validateLogin(req.body);
  if (errors) return bad(res, errors);

  const user = await User.findOne({ $or: [{ email: value.identifier }, { username: value.identifier }] }).select('+passwordHash');
  if (!user) {
    await bcrypt.compare(value.password, DUMMY_HASH);
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    const secs = Math.ceil((user.lockUntil - Date.now()) / 1000);
    res.set('Retry-After', String(secs));
    return res.status(429).json({ message: `Too many failed attempts. Try again in ${waitText(secs)}.` });
  }

  const ok = await bcrypt.compare(value.password, user.passwordHash);
  if (!ok) {
    const updated = await User.findByIdAndUpdate(user._id, { $inc: { failedAttempts: 1 } }, { new: true });
    if (updated.failedAttempts >= config.maxLoginAttempts) {
      await User.updateOne({ _id: user._id }, { $set: { lockUntil: new Date(Date.now() + config.lockMs), failedAttempts: 0 } });
      return res.status(429).json({ message: `Too many failed attempts. Account locked for ${waitText(config.lockMs / 1000)}.` });
    }
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  if (user.failedAttempts || user.lockUntil) {
    await User.updateOne({ _id: user._id }, { $set: { failedAttempts: 0 }, $unset: { lockUntil: 1 } });
  }
  const { token, ttl } = signSession(user, value.remember);
  setSessionCookie(res, token, ttl, value.remember);
  res.json({ message: 'Logged in.' });
});

/* GET /api/auth/me  (protected) */
exports.me = (req, res) => res.json({ user: req.user.toPublic() });

/* POST /api/auth/logout  (protected) - revokes the token so it can never be reused */
exports.logout = asyncHandler(async (req, res) => {
  const { jti, exp } = req.tokenPayload;
  await RevokedToken.updateOne({ jti }, { $setOnInsert: { jti, expiresAt: new Date(exp * 1000) } }, { upsert: true });
  clearSessionCookie(res);
  res.json({ message: 'Logged out.' });
});

/* POST /api/auth/forgot - always answers the same, so accounts can't be probed */
exports.forgot = asyncHandler(async (req, res) => {
  const { errors, value } = validateForgot(req.body);
  if (errors) return bad(res, errors);

  const user = await User.findOne({ $or: [{ email: value.identifier }, { username: value.identifier }] });
  if (user) {
    const raw = crypto.randomBytes(32).toString('hex');
    await PasswordReset.deleteMany({ user: user._id }); // only the newest link works
    await PasswordReset.create({ user: user._id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + config.resetTtlMs) });
    // Not awaited: response time must not reveal whether the account exists.
    sendResetEmail(user.email, user.name, `${config.appUrl}/reset?token=${raw}`).catch((e) => console.error('Mail error:', e.message));
  }
  res.json({ message: 'If an account matches, a password reset link has been sent.' });
});

/* POST /api/auth/reset */
exports.reset = asyncHandler(async (req, res) => {
  const { errors, value } = validateReset(req.body);
  if (errors) return bad(res, errors);

  // Atomically consume the one-time token
  const record = await PasswordReset.findOneAndDelete({ tokenHash: sha256(value.token), expiresAt: { $gt: new Date() } });
  if (!record) return res.status(400).json({ message: 'Reset link is invalid or has expired.' });

  const passwordHash = await bcrypt.hash(value.password, config.bcryptRounds);
  await User.updateOne(
    { _id: record.user },
    { $set: { passwordHash, failedAttempts: 0 }, $unset: { lockUntil: 1 }, $inc: { tokenVersion: 1 } } // logs out all old sessions
  );
  await PasswordReset.deleteMany({ user: record.user });
  clearSessionCookie(res);
  res.json({ message: 'Password updated.' });
});
