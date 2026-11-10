// Admin image upload: POST /api/v1/admin/media { image: dataUrl } → { media: { id, url, … } }
import express, { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { uploadSchema } from './media.schema.js';
import { createMedia, decodeDataUrl } from './media.service.js';

// Large JSON body allowed only here, after authentication (see app.js LARGE_BODY_ROUTES).
export const mediaAdminRoutes = Router().post('/', express.json({ limit: '10mb' }), validate({ body: uploadSchema }), async (req, res) => {
  const { image, purpose } = req.valid.body;
  const media = await createMedia(decodeDataUrl(image, 'image'), purpose);
  res.status(201).json({ media });
});
