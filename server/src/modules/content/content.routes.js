// Public, read-only site content (hidden items excluded).
import { Router } from 'express';
import { COLLECTIONS } from '../collections/collections.registry.js';
import { list } from '../collections/collections.service.js';
import { getProfile } from '../profile/profile.service.js';
import { getTheme } from '../theme/theme.service.js';

const strip = ({ hidden, order, createdAt, updatedAt, ...rest }) => rest;

// Visitors only need the photo URL, not internal ids or crop settings.
function publicProfile(doc) {
  const { photo, ...rest } = strip(doc.toJSON());
  return { ...rest, photoUrl: photo?.url || '' };
}

export async function getPublicContent() {
  const keys = Object.keys(COLLECTIONS);
  const [theme, profile, ...lists] = await Promise.all([
    getTheme(),
    getProfile(),
    ...keys.map((k) => list(COLLECTIONS[k].Model, { publicOnly: true })),
  ]);
  const content = { theme, profile: profile ? publicProfile(profile) : null };
  keys.forEach((k, i) => (content[k] = lists[i].map((d) => strip(d.toJSON()))));
  return content;
}

export const contentRoutes = Router().get('/', async (_req, res) => res.json(await getPublicContent()));
