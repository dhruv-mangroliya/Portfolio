import express, { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { photoSchema, profileSchema } from './profile.schema.js';
import { getProfile, removePhoto, saveProfile, setPhoto } from './profile.service.js';

export const profileRoutes = Router()
  .get('/', async (_req, res) => res.json({ profile: await getProfile() }))
  .put('/', validate({ body: profileSchema }), async (req, res) =>
    res.json({ profile: await saveProfile(req.valid.body) })
  )
  // Large JSON body allowed only here, and only after authentication (see app.js LARGE_BODY_ROUTES).
  .put('/photo', express.json({ limit: '10mb' }), validate({ body: photoSchema }), async (req, res) =>
    res.json({ profile: await setPhoto(req.valid.body) })
  )
  .delete('/photo', async (_req, res) => res.json({ profile: await removePhoto() }));
