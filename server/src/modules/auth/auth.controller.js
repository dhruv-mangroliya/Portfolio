import * as auth from './auth.service.js';

export async function login(req, res) {
  const { username, password } = req.valid.body;
  const user = await auth.authenticate(username, password);
  auth.setSessionCookie(res, user);
  req.log.info({ user: user.username }, 'Admin signed in');
  res.json({ user });
}

export function logout(_req, res) {
  auth.clearSessionCookie(res);
  res.status(204).end();
}

export const me = (req, res) => res.json({ user: req.user });

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.valid.body;
  const user = await auth.changePassword(req.user._id, currentPassword, newPassword);
  auth.setSessionCookie(res, user); // keep this session signed in
  res.status(204).end();
}
