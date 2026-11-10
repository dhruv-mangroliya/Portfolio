import { Profile } from '../../models/index.js';
import { BadRequest, NotFound } from '../../utils/errors.js';
import { createMedia, decodeDataUrl, deleteMedia } from '../media/media.service.js';

export const getProfile = () => Profile.findOne({ key: 'main' });

export const saveProfile = (data) =>
  Profile.findOneAndUpdate({ key: 'main' }, { $set: data }, { new: true, upsert: true, runValidators: true });

async function requireProfile() {
  const profile = await getProfile();
  if (!profile) throw NotFound('Profile not found.');
  return profile;
}

/**
 * Sets the profile photo. `image` is the cropped version shown on the site; `original` is the full
 * photo (sent on a new upload, omitted when only the crop changes). Replaced images are deleted.
 */
export async function setPhoto({ image, original, crop }) {
  const profile = await requireProfile();
  // Copy the old ids now — profile.photo is a live sub-document that changes when we assign below.
  const prev = { imageId: profile.photo?.imageId ?? null, originalId: profile.photo?.originalId ?? null };
  if (!original && !prev.originalId) throw BadRequest('Please upload a photo first.');

  const cropped = decodeDataUrl(image, 'image');
  const full = original ? decodeDataUrl(original, 'original') : null;

  const imageDoc = await createMedia(cropped, 'profile-photo');
  const originalId = full ? (await createMedia(full, 'profile-photo-original'))._id : prev.originalId;

  profile.photo = { url: `/api/v1/media/${imageDoc._id}`, imageId: imageDoc._id, originalId, crop };
  await profile.save();
  await deleteMedia([prev.imageId, full ? prev.originalId : null]);
  return profile;
}

export async function removePhoto() {
  const profile = await requireProfile();
  const imageId = profile.photo?.imageId ?? null;
  const originalId = profile.photo?.originalId ?? null;
  profile.photo = { url: '', imageId: null, originalId: null, crop: { x: 0.5, y: 0.5, zoom: 1 } };
  await profile.save();
  await deleteMedia([imageId, originalId]);
  return profile;
}
