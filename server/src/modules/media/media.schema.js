import { z } from 'zod';

// Images arrive as data URLs (data:image/jpeg;base64,…); ~9 MB of base64 ≈ 6.5 MB of image.
const MAX_DATA_URL = 9_000_000;

export const zDataUrl = (label) =>
  z
    .string({ required_error: `${label} is required.` })
    .max(MAX_DATA_URL, `${label} is too large (max ~6 MB).`)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, `${label} must be a JPG, PNG or WebP image.`);

export const uploadSchema = z.object({
  image: zDataUrl('Image'),
  purpose: z.enum(['project-cover']).default('project-cover'),
});
