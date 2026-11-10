// Public image delivery: GET /api/v1/media/:id. Ids change on every upload, so images are cached forever.
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { zObjectId } from '../../utils/validators.js';
import { getMedia } from './media.service.js';

export const mediaRoutes = Router().get('/:id', validate({ params: z.object({ id: zObjectId }) }), async (req, res) => {
  const media = await getMedia(req.valid.params.id);
  res.set({
    'Content-Type': media.mime,
    'Content-Length': String(media.bytes),
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  res.send(media.data);
});
