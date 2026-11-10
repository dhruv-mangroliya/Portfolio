import { rateLimit } from 'express-rate-limit';
import { config } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const limiter = (windowMinutes, limit, message, extra = {}) =>
  rateLimit({
    windowMs: windowMinutes * 60_000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', message)),
    ...extra,
  });

export const apiLimiter = limiter(1, 300, 'Too many requests. Please slow down.');
export const loginLimiter = limiter(15, 10, 'Too many sign-in attempts. Try again in 15 minutes.', {
  skipSuccessfulRequests: true,
});
export const contactLimiter = limiter(60, 5, 'You have sent several messages already. Please try again later.');
