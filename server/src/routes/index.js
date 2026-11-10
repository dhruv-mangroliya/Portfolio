// API v1 route table.
import { Router } from 'express';
import { dbState, isDbReady } from '../db/connection.js';
import { requireAuth } from '../middleware/authenticate.js';
import { requireDb } from '../middleware/requireDb.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { collectionRoutes } from '../modules/collections/collections.routes.js';
import { contactRoutes } from '../modules/contact/contact.routes.js';
import { contentRoutes } from '../modules/content/content.routes.js';
import { dashboardRoutes } from '../modules/dashboard/dashboard.routes.js';
import { mediaAdminRoutes } from '../modules/media/media.admin.routes.js';
import { mediaRoutes } from '../modules/media/media.routes.js';
import { messageRoutes } from '../modules/messages/messages.routes.js';
import { profileRoutes } from '../modules/profile/profile.routes.js';
import { themeRoutes } from '../modules/theme/theme.routes.js';

export function apiV1() {
  const api = Router();

  // Health checks work even while the database is down.
  api.get('/health', (_req, res) =>
    res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()), db: dbState() })
  );
  api.get('/health/ready', (_req, res) =>
    res.status(isDbReady() ? 200 : 503).json({ ready: isDbReady(), db: dbState() })
  );

  api.use(requireDb);

  // Public
  api.use('/content', contentRoutes);
  api.use('/contact', contactRoutes);
  api.use('/auth', authRoutes);
  api.use('/media', mediaRoutes);

  // Admin (signed in)
  const admin = Router();
  admin.use(requireAuth);
  admin.use('/dashboard', dashboardRoutes);
  admin.use('/profile', profileRoutes);
  admin.use('/theme', themeRoutes);
  admin.use('/media', mediaAdminRoutes);
  admin.use('/messages', messageRoutes);
  admin.use('/collections/:collection', collectionRoutes);
  api.use('/admin', admin);

  return api;
}
