// SDE-2 prep tracker (admin only): YouTube playlists / channels followed as lessons L-1 … L-X.
//   GET    /admin/sde                     { tracks }
//   POST   /admin/sde                     { url, title?, total? } → reads the playlist/channel from YouTube
//   PATCH  /admin/sde/:id                 { title?, total?, skip? }
//   POST   /admin/sde/:id/refresh         re-reads the videos (new uploads, renamed videos)
//   PUT    /admin/sde/:id/done            { lessons: [n…], done } → tick / untick lessons
//   DELETE /admin/sde/:id
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { StudyTrack } from '../../models/index.js';
import { AppError, NotFound, ValidationFailed } from '../../utils/errors.js';
import { zObjectId, zText } from '../../utils/validators.js';
import { fetchSource, parseSource, refetch } from './youtube.service.js';

const zCount = (label) => z.coerce.number({ invalid_type_error: `${label} must be a number.` }).int(`${label} must be a whole number.`);
const idParam = z.object({ id: zObjectId });
const createBody = z.object({
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
    Object.assign(track, Object.fromEntries(Object.entries(req.valid.body).filter(([, v]) => v !== undefined)));
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
  .delete('/:id', validate({ params: idParam }), async (req, res) => {
    const r = await StudyTrack.deleteOne({ _id: req.valid.params.id });
    if (!r.deletedCount) throw NotFound('Course not found.');
    res.status(204).end();
  });
