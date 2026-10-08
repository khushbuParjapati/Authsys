require('dotenv').config();

const env = process.env;
const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : d);

if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
  console.error('\nJWT_SECRET is missing or too short (min 32 chars). Run `npm run setup` to create a .env file.\n');
  process.exit(1);
}

if (env.NODE_ENV === 'production' && !env.MONGODB_URI) {
  console.error('\nMONGODB_URI is not set. In production it must be your MongoDB Atlas connection string.\n');
  process.exit(1);
}

const isProd = env.NODE_ENV === 'production';
const onRender = Boolean(env.RENDER); // Render sets RENDER=true automatically
const port = num(env.PORT, 3000); // Render injects PORT

module.exports = {
  isProd,
  port,
  // On Render, RENDER_EXTERNAL_URL (https://<name>.onrender.com) is used if APP_URL is not set.
  appUrl: (env.APP_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017/auth_system',
  jwtSecret: env.JWT_SECRET,
  // Render (and most hosts) put a proxy in front of the app: needed for correct client IP + rate limiting.
  trustProxy: num(env.TRUST_PROXY, onRender ? 1 : 0),

  bcryptRounds: 12,
  session: {
    ttlSeconds: 60 * 60,                 // normal session: 1 hour
    rememberTtlSeconds: 7 * 24 * 60 * 60 // "remember me": 7 days
  },
  resetTtlMs: 15 * 60 * 1000,            // reset link valid for 15 minutes
  maxLoginAttempts: num(env.MAX_LOGIN_ATTEMPTS, 5),
  lockMs: num(env.LOCK_MINUTES, 15) * 60 * 1000,

  // HTTPS email APIs (work on Render free plan, where SMTP ports are blocked)
  brevoApiKey: env.BREVO_API_KEY,
  gmail: {
    clientId: env.GMAIL_CLIENT_ID,
    clientSecret: env.GMAIL_CLIENT_SECRET,
    refreshToken: env.GMAIL_REFRESH_TOKEN,
  },

  smtp: {
    host: env.SMTP_HOST,
    port: num(env.SMTP_PORT, 587),
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    // Name <email>  — with Brevo the email must be a verified sender
    from: env.MAIL_FROM || 'Auth System <no-reply@example.com>',
  },
};
