import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { themeSchema } from './theme.schema.js';
import { DEFAULT_THEME, getTheme, saveTheme } from './theme.service.js';

export const themeRoutes = Router()
  .get('/', async (_req, res) => res.json({ theme: await getTheme(), defaultTheme: DEFAULT_THEME }))
  .put('/', validate({ body: themeSchema }), async (req, res) => res.json({ theme: await saveTheme(req.valid.body) }));
