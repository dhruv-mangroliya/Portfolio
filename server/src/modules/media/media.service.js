// Stores and serves images. Content is verified by its magic bytes, not just the declared type.
import { Media } from '../../models/index.js';
import { NotFound, ValidationFailed } from '../../utils/errors.js';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SNIFFERS = [
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/png', (b) => b.subarray(0, 8).equals(PNG_SIG)],
  ['image/webp', (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'],
];

/** Turns a validated data URL into { mime, data, bytes }, checking the bytes really are that image type. */
export function decodeDataUrl(dataUrl, field) {
  const [, declared, base64] = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl) ?? [];
  const data = Buffer.from(base64 ?? '', 'base64');
  const actual = SNIFFERS.find(([, test]) => data.length > 12 && test(data))?.[0];
  if (!actual || actual !== declared) {
    throw ValidationFailed('That file is not a valid image.', { [field]: 'That file is not a valid image.' });
  }
  return { mime: actual, data, bytes: data.length };
}

/** Id of an image stored here, from its public URL (/api/v1/media/<id>); null for external links. */
export const mediaIdFromUrl = (url) => /^\/api\/v1\/media\/([a-f\d]{24})$/.exec(url ?? '')?.[1] ?? null;

export const createMedia = (image, purpose) => Media.create({ ...image, purpose });

export async function getMedia(id) {
  const media = await Media.findById(id);
  if (!media) throw NotFound('Image not found.');
  return media;
}

export async function deleteMedia(ids) {
  const list = ids.filter(Boolean);
  if (list.length) await Media.deleteMany({ _id: { $in: list } });
}
