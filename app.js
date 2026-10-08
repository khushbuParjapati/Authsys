const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config');
const authRoutes = require('./routes/authRoutes');
const { guestOnly, requirePageAuth } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimit');
const requireJson = require('./middleware/requireJson');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
if (config.trustProxy) app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'upgrade-insecure-requests': config.isProd ? [] : null, // would break http://localhost
      },
    },
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ---- Health check (Render pings this; no auth, no DB) ----
app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));

// ---- Pages (HTML lives in /views; access rules are enforced here, on the server) ----
const view = (name) => (req, res) => {
  res.set('Cache-Control', 'no-store'); // back button must not show a cached dashboard after logout
  res.sendFile(path.join(__dirname, 'views', `${name}.html`));
};
app.get('/', guestOnly, view('index'));
app.get('/login', guestOnly, view('login'));
app.get('/register', guestOnly, view('register'));
app.get('/forgot', guestOnly, view('forgot'));
app.get('/reset', view('reset'));
app.get('/dashboard', requirePageAuth, view('dashboard'));

// ---- API ----
app.use('/api/auth', apiLimiter, requireJson, authRoutes);

// ---- Static assets (css/js only) ----
app.use(express.static(path.join(__dirname, 'public')));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
