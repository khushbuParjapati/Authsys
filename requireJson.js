// Basic CSRF defence (together with SameSite=Strict cookies): state-changing requests must be JSON.
// A cross-site <form> cannot send application/json without a CORS preflight, which we never allow.
module.exports = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!req.is('application/json')) return res.status(415).json({ message: 'Content-Type must be application/json.' });
  next();
};
