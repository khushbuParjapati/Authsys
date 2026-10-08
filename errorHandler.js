const config = require('../config');

function notFound(req, res) {
  if (req.originalUrl.startsWith('/api')) return res.status(404).json({ message: 'Not found.' });
  res.status(404).type('text').send('404 - Page not found');
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request too large.' });
  console.error(err);
  res.status(500).json({ message: 'Something went wrong. Please try again.', ...(config.isProd ? {} : { detail: err.message }) });
}

module.exports = { notFound, errorHandler };
