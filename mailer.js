const nodemailer = require('nodemailer');
const config = require('../config');

// 1) Brevo HTTPS API  -> works on Render free plan (SMTP ports are blocked there)
// 2) SMTP             -> works on paid Render plans / other hosts
// 3) Console          -> development only
const transporter = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

// "Name <a@b.com>"  ->  { name, email }
function parseFrom(from) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: from.trim() };
}

async function sendViaBrevo(to, name, subject, text) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': config.brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: parseFrom(config.smtp.from), to: [{ email: to, name }], subject, textContent: text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Brevo API ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendResetEmail(to, name, link) {
  const subject = 'Reset your password';
  const text = `Hi ${name},\n\nUse this link to reset your password (valid for 15 minutes):\n${link}\n\nIf you didn't request this, you can ignore this email.`;

  if (config.brevoApiKey) return sendViaBrevo(to, name, subject, text);
  if (transporter) return transporter.sendMail({ from: config.smtp.from, to, subject, text });

  if (config.isProd) {
    // Never write reset links into production logs.
    throw new Error('No email provider configured (set BREVO_API_KEY or SMTP_HOST). Reset email not sent.');
  }
  console.log(`\n[DEV] Password reset link for ${to}:\n${link}\n`);
}

module.exports = { sendResetEmail };
