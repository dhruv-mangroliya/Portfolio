import { Router } from 'express';
import { requireAuth } from '../../middleware/authenticate.js';
import { loginLimiter } from '../../middleware/rateLimiters.js';
import { validate } from '../../middleware/validate.js';
import * as ctrl from './auth.controller.js';
import { changePasswordSchema, loginSchema } from './auth.schema.js';

export const authRoutes = Router()
  .post('/login', loginLimiter, validate({ body: loginSchema }), ctrl.login)
  .post('/logout', ctrl.logout)
  .get('/me', requireAuth, ctrl.me)
  .put('/password', requireAuth, validate({ body: changePasswordSchema }), ctrl.changePassword);
