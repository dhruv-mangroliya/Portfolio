// Create or reset an admin user directly in MongoDB.
//   npm run set-admin -- <username> [password]
// If no password is given a strong one is generated and printed once.
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { config } from '../server/src/config/env.js';
import { User } from '../server/src/models/User.js';
import { hashPassword } from '../server/src/utils/password.js';

const [username, given] = process.argv.slice(2);
if (!username || !/^[a-z0-9._-]{3,60}$/i.test(username)) {
  console.error('Usage: npm run set-admin -- <username> [password]   (username: 3–60 letters, digits, . _ -)');
  process.exit(1);
}
if (given && given.length < 10) {
  console.error('Password must be at least 10 characters.');
  process.exit(1);
}
const password = given || crypto.randomBytes(12).toString('base64url');

try {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  const passwordHash = await hashPassword(password);
  const existing = await User.findOne({ username: username.toLowerCase() });
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.tokenVersion += 1; // sign out existing sessions
    await existing.save();
    console.log(`✔ Password reset for "${existing.username}".`);
  } else {
    await User.create({ username, passwordHash });
    console.log(`✔ Admin user "${username.toLowerCase()}" created.`);
  }
  if (!given) console.log(`  Password: ${password}   (shown once — store it in a password manager)`);
} catch (err) {
  console.error(`✖ ${err.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
