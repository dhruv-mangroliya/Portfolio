// Diet tracker API (admin only).
//   GET  /admin/diet/plan                 the plan (created from the starter plan on first use)
//   PUT  /admin/diet/plan                 replace the plan
//   GET  /admin/diet/days?from=&to=       daily summaries (protein, calories, counts), oldest first
//   GET  /admin/diet/days/:date           one day's ticks (empty day if nothing logged)
//   PUT  /admin/diet/days/:date           save one day's ticks
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { DietDay, DietPlan } from '../../models/index.js';
import { zRequired, zText } from '../../utils/validators.js';
import { DEFAULT_PLAN } from './diet.defaults.js';

const zDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.')
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), 'Not a real date.');
const zId = z.string().trim().min(1).max(60);
const zAmount = z.coerce.number({ invalid_type_error: 'Enter a number.' }).min(0, 'Can’t be negative.').max(20000, 'Too large.');

const zFood = z.object({ id: zId, name: zRequired(80, 'Name'), protein: zAmount, calories: zAmount, quantity: zText(60) });
const planBody = z.object({
  sessions: z
    .array(z.object({ id: zId, name: zRequired(80, 'Session name'), target: z.object({ protein: zAmount, calories: zAmount }), items: z.array(zFood).max(60) }))
    .max(20),
  supplements: z.array(z.object({ id: zId, name: zRequired(60, 'Name') })).max(40),
  preparations: z.array(z.object({ id: zId, name: zRequired(60, 'Name') })).max(40),
});
const dayBody = z.object({
  items: z.array(z.object({ itemId: zId, sessionId: zId, name: zRequired(80, 'Name'), protein: zAmount, calories: zAmount, quantity: zText(60) })).max(400),
  extras: z.array(z.object({ id: zId, name: zRequired(80, 'Name'), protein: zAmount, calories: zAmount })).max(60),
  supplements: z.array(zId).max(40),
  preparations: z.array(zId).max(40),
});

const planOut = (doc) => {
  const { sessions, supplements, preparations, updatedAt } = doc.toJSON();
  return { sessions, supplements, preparations, updatedAt };
};
const emptyDay = (date) => ({ date, items: [], extras: [], supplements: [], preparations: [] });
const totals = (d) => {
  const all = [...(d.items ?? []), ...(d.extras ?? [])];
  return { protein: all.reduce((a, x) => a + x.protein, 0), calories: all.reduce((a, x) => a + x.calories, 0) };
};

async function getPlan() {
  return (await DietPlan.findOne({ key: 'main' })) ?? DietPlan.create({ key: 'main', ...DEFAULT_PLAN });
}

export const dietRoutes = Router()
  .get('/plan', async (_req, res) => res.json({ plan: planOut(await getPlan()) }))
  .put('/plan', validate({ body: planBody }), async (req, res) => {
    const doc = await DietPlan.findOneAndUpdate({ key: 'main' }, { $set: req.valid.body }, { new: true, upsert: true, runValidators: true });
    res.json({ plan: planOut(doc) });
  })
  .get('/days', validate({ query: z.object({ from: zDate.optional(), to: zDate.optional() }) }), async (req, res) => {
    const { from, to } = req.valid.query;
    const filter = from || to ? { date: { ...(from && { $gte: from }), ...(to && { $lte: to }) } } : {};
    const days = await DietDay.find(filter).sort({ date: 1 }).lean();
    res.json({
      days: days.map((d) => ({ date: d.date, ...totals(d), items: d.items.length + d.extras.length, supplements: d.supplements.length })),
    });
  })
  .get('/days/:date', validate({ params: z.object({ date: zDate }) }), async (req, res) => {
    const day = await DietDay.findOne({ date: req.valid.params.date });
    res.json({ day: day ? day.toJSON() : emptyDay(req.valid.params.date) });
  })
  .put('/days/:date', validate({ params: z.object({ date: zDate }), body: dayBody }), async (req, res) => {
    const { date } = req.valid.params;
    const day = await DietDay.findOneAndUpdate({ date }, { $set: { ...req.valid.body, date } }, { new: true, upsert: true, runValidators: true });
    res.json({ day: day.toJSON() });
  });
