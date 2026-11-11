// SDE-2 prep tracker (admin only): YouTube playlists / channels followed as lessons L-1 … L-X.
//   GET    /admin/sde                     { tracks }
//   POST   /admin/sde                     { url, title?, total? } → reads the playlist/channel from YouTube
//                                         { title, items: [{ title, url }] } → your own list (tasks / any videos)
//   PATCH  /admin/sde/:id                 { title?, total?, skip? }
//   POST   /admin/sde/:id/refresh         re-reads the videos (new uploads, renamed videos)
//   PUT    /admin/sde/:id/done            { lessons: [n…], done } → tick / untick lessons
//   DELETE /admin/sde/:id
//   Own lists only (kind 'manual'):
//   POST   /admin/sde/:id/items           { items: [{ title, url }] } → appended as the next L-numbers
//   PATCH  /admin/sde/:id/items/:n        { title?, url? }
//   POST   /admin/sde/:id/items/:n/move   { to } → ticks move with the lesson
//   DELETE /admin/sde/:id/items/:n        later lessons move up one number
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { StudyTrack } from '../../models/index.js';
import { AppError, NotFound, ValidationFailed } from '../../utils/errors.js';
import { isSafeUrl, zObjectId, zText } from '../../utils/validators.js';
import { fetchSource, parseSource, refetch, videoIdFrom, videoTitle } from './youtube.service.js';

const zCount = (label) => z.coerce.number({ invalid_type_error: `${label} must be a number.` }).int(`${label} must be a whole number.`);
const idParam = z.object({ id: zObjectId });
const zLink = zText(500).refine((v) => !v || (/^https?:\/\//i.test(v) && isSafeUrl(v)), 'Use a full link starting with https://');
const zItem = z
  .object({ title: zText(200), url: zLink })
  .refine((i) => i.title || i.url, { message: 'Give each lesson a name or a link.', path: ['title'] });
const zItems = z.array(zItem).min(1, 'Add at least one lesson.').max(1000, 'At most 1000 at once.');
const lessonParams = z.object({ id: zObjectId, n: zCount('Lesson').min(1).max(5000) });

const createBody = z.object({
  items: zItems.optional(),
  url: zText(500),
  title: zText(160),
  total: z.union([z.literal(''), z.null(), zCount('Lessons').min(1, 'At least 1 lesson.').max(5000, 'At most 5000 lessons.')]).optional(),
});
const patchBody = z.object({
  title: zText(160).optional(),
  total: zCount('Lessons').min(1, 'At least 1 lesson.').max(5000, 'At most 5000 lessons.').optional(),
  skip: zCount('Skip').min(0, 'Can’t be negative.').max(5000).optional(),
});
const doneBody = z.object({ lessons: z.array(zCount('Lesson').min(1).max(5000)).min(1).max(5000), done: z.boolean() });

/** Turns { title, url } input into stored lessons; YouTube links get their video title when none is given. */
async function toLessons(items) {
  return Promise.all(
    items.map(async ({ title, url }) => {
      const videoId = url ? videoIdFrom(url) : '';
      return { title: title || (videoId && (await videoTitle(videoId))) || url, url, videoId };
    })
  );
}

/** Loads an own-list course; older ones made with only a count get "Lesson n" rows filled in first. */
async function ownList(id) {
  const track = await StudyTrack.findById(id);
  if (!track) throw NotFound('Course not found.');
  if (track.kind !== 'manual') throw ValidationFailed('Only your own lists can be edited lesson by lesson. YouTube courses follow YouTube — use refresh.');
  for (let n = track.videos.length + 1; n <= track.total; n++) track.videos.push({ title: `Lesson ${n}` });
  return track;
}
const lessonAt = (track, n) => {
  if (n > track.videos.length) throw NotFound(`There is no L-${n}.`);
  return track.videos[n - 1];
};

const youtubeFailed = (err) =>
  new AppError(502, 'YOUTUBE_UNAVAILABLE', `Couldn’t read that from YouTube (${err.message}) Enter the number of lessons to add it anyway.`);

export const sdeRoutes = Router()
  .get('/', async (_req, res) => {
    res.json({ tracks: await StudyTrack.find().sort({ order: 1, createdAt: 1 }) });
  })
  .post('/', validate({ body: createBody }), async (req, res) => {
    const { url, title } = req.valid.body;
    const total = req.valid.body.total || undefined;
    const order = ((await StudyTrack.findOne().sort({ order: -1 }).lean())?.order ?? -1) + 1;

    if (req.valid.body.items) {
      if (!title) throw ValidationFailed('Give your list a name.', { title: 'Name is required.' });
      const videos = await toLessons(req.valid.body.items);
      return res.status(201).json({ track: await StudyTrack.create({ title, kind: 'manual', videos, total: videos.length, order }) });
    }
    if (!url) {
      if (!title || !total) throw ValidationFailed('Paste a YouTube link, or give a name and number of lessons.', { url: 'Paste a playlist or channel link.' });
      return res.status(201).json({ track: await StudyTrack.create({ title, total, kind: 'manual', order }) });
    }
    const source = parseSource(url);
    if (!source) throw ValidationFailed('That doesn’t look like a YouTube playlist or channel link.', { url: 'Use a playlist link (…?list=…) or a channel link (youtube.com/@name).' });

    let info;
    try {
      info = await fetchSource(source);
    } catch (err) {
      if (!total) throw youtubeFailed(err);
      const track = await StudyTrack.create({ title: title || 'Untitled course', url, kind: source.kind, sourceId: source.kind === 'playlist' ? source.id : '', total, order });
      return res.status(201).json({ track, warning: `Added without video names — YouTube couldn’t be read (${err.message})` });
    }
    const track = await StudyTrack.create({
      ...info,
      title: title || info.title || 'Untitled course',
      url,
      total: total ?? Math.min(info.videos.length, 5000),
      order,
      fetchedAt: new Date(),
    });
    res.status(201).json({ track });
  })
  .patch('/:id', validate({ params: idParam, body: patchBody }), async (req, res) => {
    const track = await StudyTrack.findById(req.valid.params.id);
    if (!track) throw NotFound('Course not found.');
    const changes = { ...req.valid.body };
    if (track.kind === 'manual' && track.videos.length) delete changes.total, delete changes.skip; // an own list's X is its lesson count
    Object.assign(track, Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)));
    if (req.valid.body.title === '') track.title = 'Untitled course';
    track.done = track.done.filter((n) => n <= track.total); // lessons past the new X no longer exist
    await track.save();
    res.json({ track });
  })
  .post('/:id/refresh', validate({ params: idParam }), async (req, res) => {
    const track = await StudyTrack.findById(req.valid.params.id);
    if (!track) throw NotFound('Course not found.');
    if (!track.sourceId) throw ValidationFailed('This course has no YouTube link to refresh from.');
    try {
      track.videos = await refetch(track);
    } catch (err) {
      throw new AppError(502, 'YOUTUBE_UNAVAILABLE', `Couldn’t read YouTube right now (${err.message})`);
    }
    track.fetchedAt = new Date();
    await track.save();
    res.json({ track });
  })
  .put('/:id/done', validate({ params: idParam, body: doneBody }), async (req, res) => {
    const track = await StudyTrack.findById(req.valid.params.id);
    if (!track) throw NotFound('Course not found.');
    const lessons = req.valid.body.lessons.filter((n) => n <= track.total);
    const update = req.valid.body.done ? { $addToSet: { done: { $each: lessons } } } : { $pull: { done: { $in: lessons } } };
    res.json({ track: await StudyTrack.findByIdAndUpdate(track.id, update, { new: true }) });
  })
  .post('/:id/items', validate({ params: idParam, body: z.object({ items: zItems }) }), async (req, res) => {
    const track = await ownList(req.valid.params.id);
    if (track.videos.length + req.valid.body.items.length > 5000) throw ValidationFailed('A list can have at most 5000 lessons.');
    track.videos.push(...(await toLessons(req.valid.body.items)));
    track.total = track.videos.length;
    await track.save();
    res.status(201).json({ track });
  })
  .patch('/:id/items/:n', validate({ params: lessonParams, body: z.object({ title: zText(200).optional(), url: zLink.optional() }) }), async (req, res) => {
    const track = await ownList(req.valid.params.id);
    const lesson = lessonAt(track, req.valid.params.n);
    const { title, url } = req.valid.body;
    if (url !== undefined) {
      lesson.url = url;
      lesson.videoId = url ? videoIdFrom(url) : '';
    }
    if (title !== undefined) lesson.title = title || (lesson.videoId && (await videoTitle(lesson.videoId))) || lesson.url || `Lesson ${req.valid.params.n}`;
    track.total = track.videos.length;
    await track.save();
    res.json({ track });
  })
  .post('/:id/items/:n/move', validate({ params: lessonParams, body: z.object({ to: zCount('Position').min(1).max(5000) }) }), async (req, res) => {
    const track = await ownList(req.valid.params.id);
    const from = req.valid.params.n;
    lessonAt(track, from);
    const to = Math.min(req.valid.body.to, track.videos.length);
    const order = track.videos.map((_, i) => i + 1); // old lesson numbers in their new order
    order.splice(to - 1, 0, ...order.splice(from - 1, 1));
    const done = new Set(track.done);
    const videos = track.videos.map((v) => v.toObject());
    track.videos = order.map((old) => videos[old - 1]);
    track.done = order.flatMap((old, i) => (done.has(old) ? [i + 1] : []));
    track.total = track.videos.length;
    await track.save();
    res.json({ track });
  })
  .delete('/:id/items/:n', validate({ params: lessonParams }), async (req, res) => {
    const track = await ownList(req.valid.params.id);
    const n = req.valid.params.n;
    lessonAt(track, n);
    if (track.videos.length === 1) throw ValidationFailed('This is the last lesson — delete the whole list instead.');
    track.videos.splice(n - 1, 1);
    track.done = track.done.filter((d) => d !== n).map((d) => (d > n ? d - 1 : d));
    track.total = track.videos.length;
    await track.save();
    res.json({ track });
  })
  .delete('/:id', validate({ params: idParam }), async (req, res) => {
    const r = await StudyTrack.deleteOne({ _id: req.valid.params.id });
    if (!r.deletedCount) throw NotFound('Course not found.');
    res.status(204).end();
  });
