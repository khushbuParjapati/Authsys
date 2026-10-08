const rateLimit = require('express-rate-limit');

const make = (windowMin, max) =>
  rateLimit({
    windowMs: windowMin * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please try again later.' },
  });

module.exports = {
  apiLimiter: make(15, 200),       // all /api/auth routes, per IP
  sensitiveLimiter: make(15, 20),  // login / register / forgot / reset, per IP
};
