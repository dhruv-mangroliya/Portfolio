// Public contact form.
import { Router } from 'express';
import { z } from 'zod';
import { contactLimiter } from '../../middleware/rateLimiters.js';
import { validate } from '../../middleware/validate.js';
import { zEmail, zRequired, zText } from '../../utils/validators.js';
import { createMessage } from '../messages/messages.service.js';

export const contactSchema = z.object({
  name: zRequired(100, 'Name'),
  email: zEmail,
  subject: zText(150),
  message: zRequired(5000, 'Message').pipe(z.string().min(10, 'Message should be at least 10 characters.')),
  website: z.string().max(0, 'Spam detected.').optional(), // honeypot: hidden from humans
});

export const contactRoutes = Router().post('/', contactLimiter, validate({ body: contactSchema }), async (req, res) => {
  const { website: _hp, ...data } = req.valid.body;
  await createMessage({ ...data, meta: { ip: req.ip ?? '', userAgent: String(req.get('user-agent') ?? '').slice(0, 300) } });
  res.status(201).json({ ok: true });
});
