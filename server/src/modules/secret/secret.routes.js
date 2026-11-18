// "The Secret" (admin + passcode): habits allowed once a day for a year.
//   GET    /admin/secret                     { habits }
//   POST   /admin/secret                     { name, startDate }  → 365 daily tickets from startDate
//   PATCH  /admin/secret/:id                 { name?, startDate? }
//   DELETE /admin/secret/:id
//   POST   /admin/secret/:id/days/:date      { delta: 1 | -1 } → one more / one less use that day (never below 0)
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { SecretHabit } from '../../models/index.js';
import { NotFound, ValidationFailed } from '../../utils/errors.js';
import { zObjectId, zRequired } from '../../utils/validators.js';
import { requirePasscode } from '../money/money.routes.js';

const zDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.')
  .refine((d) => new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), 'Not a real date.');
const idParam = z.object({ id: zObjectId });
const habitBody = z.object({ name: zRequired(60, 'Name'), startDate: zDate });

const addDays = (key, n) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const secretRoutes = Router()
  .use(requirePasscode)
  .get('/', async (_req, res) => {
    res.json({ habits: await SecretHabit.find().sort({ order: 1, createdAt: 1 }) });
  })
  .post('/', validate({ body: habitBody }), async (req, res) => {
    const order = ((await SecretHabit.findOne().sort({ order: -1 }).lean())?.order ?? -1) + 1;
    res.status(201).json({ habit: await SecretHabit.create({ ...req.valid.body, order }) });
  })
  .patch('/:id', validate({ params: idParam, body: habitBody.partial() }), async (req, res) => {
    const habit = await SecretHabit.findById(req.valid.params.id);
    if (!habit) throw NotFound('Tracker not found.');
    Object.assign(habit, req.valid.body);
    // Uses outside the new 365-day window no longer belong to it.
    const end = addDays(habit.startDate, habit.days - 1);
    for (const key of [...habit.counts.keys()]) if (key < habit.startDate || key > end) habit.counts.delete(key);
    res.json({ habit: await habit.save() });
  })
  .delete('/:id', validate({ params: idParam }), async (req, res) => {
    const r = await SecretHabit.deleteOne({ _id: req.valid.params.id });
    if (!r.deletedCount) throw NotFound('Tracker not found.');
    res.status(204).end();
  })
  .post('/:id/days/:date', validate({ params: z.object({ id: zObjectId, date: zDate }), body: z.object({ delta: z.union([z.literal(1), z.literal(-1)]) }) }), async (req, res) => {
    const { id, date } = req.valid.params;
    const habit = await SecretHabit.findById(id);
    if (!habit) throw NotFound('Tracker not found.');
    if (date < habit.startDate || date > addDays(habit.startDate, habit.days - 1)) throw ValidationFailed('That day is outside this tracker’s year.');
    const next = Math.max(0, (habit.counts.get(date) ?? 0) + req.valid.body.delta);
    if (next) habit.counts.set(date, next);
    else habit.counts.delete(date);
    res.json({ habit: await habit.save() });
  });
