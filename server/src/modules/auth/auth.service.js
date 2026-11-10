// Authentication: password check, JWT session cookie, password change (revokes other sessions).
import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import { User } from '../../models/index.js';
import { AppError, Unauthorized } from '../../utils/errors.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';

// Compared against when the username doesn't exist, so response time doesn't reveal valid usernames.
const DUMMY_HASH = hashPassword('not-a-real-password'); // promise, created once (no top-level await)
const { jwtSecret, sessionDays, cookieName, cookieSecure } = config.auth;

export async function authenticate(username, password) {
  const user = await User.findOne({ username }).select('+passwordHash');
  const ok = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH));
  if (!user || !ok) throw Unauthorized('Incorrect username or password.');
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export const signSession = (user) =>
  jwt.sign({ sub: String(user._id), v: user.tokenVersion }, jwtSecret, { expiresIn: `${sessionDays}d` });

export function verifySession(token) {
  try {
    return jwt.verify(token, jwtSecret);
  } catch {
    return null;
  }
}

const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: cookieSecure, path: '/' };

export function setSessionCookie(res, user) {
  res.cookie(cookieName, signSession(user), { ...cookieOptions, maxAge: sessionDays * 86_400_000 });
}

export const clearSessionCookie = (res) => res.clearCookie(cookieName, cookieOptions);

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Current password is incorrect.', {
      fields: { currentPassword: 'Current password is incorrect.' },
    });
  }
  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion += 1; // signs out every other session
  await user.save();
  return user;
}
