const nodemailer = require('nodemailer');
const config = require('../config');

// 1) Gmail API (HTTPS) -> your own Gmail, works on Render free plan (SMTP ports are blocked there)
// 2) Brevo API (HTTPS) -> needs a verified domain for reliable delivery
// 3) SMTP              -> works on paid Render plans / other hosts
// 4) Console           -> development only
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

// ---- Gmail API (OAuth2 refresh token -> short-lived access token -> messages.send) ----
const gmailReady = () => config.gmail.clientId && config.gmail.clientSecret && config.gmail.refreshToken;
let gmailToken = { value: null, expiresAt: 0 };

async function getGmailAccessToken() {
  if (gmailToken.value && Date.now() < gmailToken.expiresAt - 60000) return gmailToken.value;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.gmail.clientId,
      client_secret: config.gmail.clientSecret,
      refresh_token: config.gmail.refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Gmail token error ${res.status}: ${data.error_description || data.error || 'unknown'}`);
  }
  gmailToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return gmailToken.value;
}

const noCRLF = (v) => String(v).replace(/[\r\n]+/g, ' ').trim(); // prevents header injection

function buildRawMessage(to, subject, text) {
  const from = parseFrom(config.smtp.from);
  const fromHeader = from.name ? `=?UTF-8?B?${Buffer.from(noCRLF(from.name)).toString('base64')}?= <${noCRLF(from.email)}>` : noCRLF(from.email);
  const lines = [
    `From: ${fromHeader}`,
    `To: ${noCRLF(to)}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(text).toString('base64').replace(/(.{76})/g, '$1\r\n'),
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

async function sendViaGmail(to, subject, text) {
  const accessToken = await getGmailAccessToken();
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw: buildRawMessage(to, subject, text) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendResetEmail(to, name, link) {
  const subject = 'Reset your password';
  const text = `Hi ${name},\n\nUse this link to reset your password (valid for 15 minutes):\n${link}\n\nIf you didn't request this, you can ignore this email.`;

  if (gmailReady()) return sendViaGmail(to, subject, text);
  if (config.brevoApiKey) return sendViaBrevo(to, name, subject, text);
  if (transporter) return transporter.sendMail({ from: config.smtp.from, to, subject, text });

  if (config.isProd) {
    // Never write reset links into production logs.
    throw new Error('No email provider configured (set GMAIL_* or BREVO_API_KEY or SMTP_HOST). Reset email not sent.');
  }
  console.log(`\n[DEV] Password reset link for ${to}:\n${link}\n`);
}

module.exports = { sendResetEmail };
