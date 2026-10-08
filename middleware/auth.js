const User = require('../models/User');
const RevokedToken = require('../models/RevokedToken');
const { COOKIE, verifyToken } = require('../utils/session');

// Returns { user, payload } for a valid session, otherwise null.
async function loadSession(req) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  if (await RevokedToken.exists({ jti: payload.jti })) return null;
  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tv) return null; // e.g. password was reset
  return { user, payload };
}

// For API routes -> JSON 401
async function requireAuth(req, res, next) {
  try {
    const session = await loadSession(req);
    if (!session) return res.status(401).json({ message: 'Please log in.' });
    req.user = session.user;
    req.tokenPayload = session.payload;
    next();
  } catch (err) { next(err); }
}

// For HTML pages -> redirect to login
async function requirePageAuth(req, res, next) {
  try {
    const session = await loadSession(req);
    if (!session) return res.redirect('/login?expired=1');
    next();
  } catch (err) { next(err); }
}

// Login/register pages are not shown to users who are already logged in
async function guestOnly(req, res, next) {
  try {
    if (await loadSession(req)) return res.redirect('/dashboard');
    next();
  } catch (err) { next(err); }
}

module.exports = { loadSession, requireAuth, requirePageAuth, guestOnly };
