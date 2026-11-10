// Protects admin routes: requires a valid session cookie whose tokenVersion still matches the user.
import { verifySession } from '../modules/auth/auth.service.js';
import { config } from '../config/env.js';
import { User } from '../models/index.js';
import { Unauthorized } from '../utils/errors.js';

export async function requireAuth(req, _res, next) {
  const token = req.cookies?.[config.auth.cookieName];
  if (!token) throw Unauthorized();
  const payload = verifySession(token);
  const user = payload && (await User.findById(payload.sub));
  if (!user || user.tokenVersion !== payload.v) throw Unauthorized('Your session has expired. Please sign in again.');
  req.user = user;
  next();
}
