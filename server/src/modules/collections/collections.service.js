// Generic CRUD + ordering for content collections.
import { BadRequest, NotFound } from '../../utils/errors.js';
import { deleteMedia, mediaIdFromUrl } from '../media/media.service.js';

export const list = (Model, { publicOnly = false } = {}) =>
  Model.find(publicOnly ? { hidden: false } : {}).sort({ order: 1, createdAt: -1 });

export async function get(Model, id) {
  const doc = await Model.findById(id);
  if (!doc) throw NotFound('Item not found.');
  return doc;
}

/** New items go to the top of the list (most recent first); reorder in the dashboard. */
export async function create(Model, data) {
  const first = await Model.findOne().sort({ order: 1 }).select('order').lean();
  return Model.create({ ...data, order: (first?.order ?? 1) - 1 });
}

/** Uploaded images an item references (gallery), so they can be deleted with it. */
const imagesOf = (doc) => [...(doc.get('images') ?? [])].filter(Boolean);

export async function update(Model, id, data) {
  const doc = await get(Model, id);
  const before = imagesOf(doc);
  doc.set(data);
  const saved = await doc.save();
  const after = new Set(imagesOf(saved));
  await deleteMedia(before.filter((url) => !after.has(url)).map(mediaIdFromUrl));
  return saved;
}

export async function remove(Model, id) {
  const doc = await Model.findByIdAndDelete(id);
  if (!doc) throw NotFound('Item not found.');
  await deleteMedia(imagesOf(doc).map(mediaIdFromUrl));
}

/** `ids` must contain every item exactly once, in the new order. */
export async function reorder(Model, ids) {
  const existing = new Set((await Model.find().select('_id').lean()).map((d) => String(d._id)));
  const valid = ids.length === existing.size && new Set(ids).size === ids.length && ids.every((id) => existing.has(id));
  if (!valid) throw BadRequest('The new order must list every item exactly once. Refresh and try again.');
  await Model.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })));
  return list(Model);
}
