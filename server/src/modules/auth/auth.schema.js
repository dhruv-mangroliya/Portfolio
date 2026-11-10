import { z } from 'zod';
import { zRequired } from '../../utils/validators.js';

export const loginSchema = z.object({
  username: zRequired(60, 'Username').toLowerCase(),
  password: zRequired(200, 'Password'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: zRequired(200, 'Current password'),
    newPassword: zRequired(200, 'New password').pipe(z.string().min(10, 'New password must be at least 10 characters.')),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current one.',
  });
