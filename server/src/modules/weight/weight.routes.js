// Daily weight log (admin only). One entry per day: saving a day that already has an entry updates it.
//   GET    /admin/weight?from=YYYY-MM-DD&to=YYYY-MM-DD   entries, oldest first (both bounds optional)
//   PUT    /admin/weight/:date                           { weight, note } → create or update that day
//   DELETE /admin/weight/:date
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { WeightEntry } from '../../models/index.js';
import { NotFound } from '../../utils/errors.js';
import { zText } from '../../utils/validators.js';

const zDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.')
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), 'Not a real date.');

const rangeQuery = z.object({ from: zDate.optional(), to: zDate.optional() });
const entryBody = z.object({
  weight: z.coerce
    .number({ invalid_type_error: 'Enter your weight in kg.' })
    .min(20, 'Weight must be at least 20 kg.')
    .max(400, 'Weight must be at most 400 kg.')
    .transform((w) => Math.round(w * 100) / 100),
  note: zText(200),
});

export const weightRoutes = Router()
  .get('/', validate({ query: rangeQuery }), async (req, res) => {
    const { from, to } = req.valid.query;
    const filter = from || to ? { date: { ...(from && { $gte: from }), ...(to && { $lte: to }) } } : {};
    const [entries, total] = await Promise.all([WeightEntry.find(filter).sort({ date: 1 }), WeightEntry.countDocuments()]);
    res.json({ entries, total });
  })
  .put('/:date', validate({ params: z.object({ date: zDate }), body: entryBody }), async (req, res) => {
    const { date } = req.valid.params;
    const existed = await WeightEntry.exists({ date });
    const entry = await WeightEntry.findOneAndUpdate({ date }, { $set: { ...req.valid.body, date } }, { new: true, upsert: true, runValidators: true });
    res.status(existed ? 200 : 201).json({ entry, created: !existed });
  })
  .delete('/:date', validate({ params: z.object({ date: zDate }) }), async (req, res) => {
    const r = await WeightEntry.deleteOne({ date: req.valid.params.date });
    if (!r.deletedCount) throw NotFound('No entry for that day.');
    res.status(204).end();
  });
