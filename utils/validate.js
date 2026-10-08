// All input validation lives here (backend). The browser only displays the returned messages.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const str = (v) => (typeof v === 'string' ? v : '');

function passwordError(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 64) return 'Password must be at most 64 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must contain letters and numbers.';
  return null;
}

const result = (errors, value) => (Object.keys(errors).length ? { errors } : { value });

function validateRegister(body = {}) {
  const errors = {};
  const name = str(body.name).trim();
  const username = str(body.username).trim().toLowerCase();
  const email = str(body.email).trim().toLowerCase();
  const password = str(body.password);
  const confirmPassword = str(body.confirmPassword);

  if (name.length < 2 || name.length > 60) errors.name = 'Name must be 2-60 characters.';
  if (!USERNAME_RE.test(username)) errors.username = 'Username must be 3-20 characters: letters, numbers, underscore.';
  if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  const pwErr = passwordError(password);
  if (pwErr) errors.password = pwErr;
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';

  return result(errors, { name, username, email, password });
}

function validateLogin(body = {}) {
  const errors = {};
  const identifier = str(body.identifier).trim().toLowerCase();
  const password = str(body.password);
  if (!identifier || identifier.length > 254) errors.identifier = 'Enter your email or username.';
  if (!password || password.length > 200) errors.password = 'Enter your password.';
  return result(errors, { identifier, password, remember: body.remember === true });
}

function validateForgot(body = {}) {
  const identifier = str(body.identifier).trim().toLowerCase();
  if (!identifier || identifier.length > 254) return { errors: { identifier: 'Enter your email or username.' } };
  return { value: { identifier } };
}

function validateReset(body = {}) {
  const errors = {};
  const token = str(body.token);
  const password = str(body.password);
  const confirmPassword = str(body.confirmPassword);
  if (!/^[a-f0-9]{64}$/.test(token)) errors.token = 'Reset link is invalid or has expired.';
  const pwErr = passwordError(password);
  if (pwErr) errors.password = pwErr;
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return result(errors, { token, password });
}

const firstError = (errors) => Object.values(errors)[0];

module.exports = { validateRegister, validateLogin, validateForgot, validateReset, firstError };
