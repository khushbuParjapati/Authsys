const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

const COOKIE = 'token';

function signSession(user, remember) {
  const ttl = remember ? config.session.rememberTtlSeconds : config.session.ttlSeconds;
  const token = jwt.sign({ tv: user.tokenVersion }, config.jwtSecret, {
    algorithm: 'HS256',
    subject: String(user._id),
    jwtid: crypto.randomUUID(),
    expiresIn: ttl,
  });
  return { token, ttl };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

// HttpOnly cookie: JavaScript in the browser can never read the token.
function setSessionCookie(res, token, ttl, remember) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProd,
    path: '/',
    ...(remember ? { maxAge: ttl * 1000 } : {}), // no maxAge = cleared when browser closes
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict', secure: config.isProd, path: '/' });
}

module.exports = { COOKIE, signSession, verifyToken, setSessionCookie, clearSessionCookie };
