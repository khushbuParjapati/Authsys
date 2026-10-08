// Creates .env from .env.example with a fresh random JWT_SECRET (only if .env doesn't exist).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const target = path.join(root, '.env');
if (fs.existsSync(target)) {
  console.log('.env already exists - nothing to do.');
  process.exit(0);
}
const secret = crypto.randomBytes(48).toString('hex');
const content = fs
  .readFileSync(path.join(root, '.env.example'), 'utf8')
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
fs.writeFileSync(target, content);
console.log('.env created with a random JWT_SECRET.');
