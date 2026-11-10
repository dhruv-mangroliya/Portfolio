// Weekly to-do board API (admin only).
//   GET    /admin/todo/week/:monday        { categories, tasks } for that week
//   POST   /admin/todo/rollover            { weekStart } — move unfinished cards from earlier weeks to that Monday
//   POST   /admin/todo/tasks               create a card
//   PATCH  /admin/todo/tasks/:id           edit / move / tick a card
//   DELETE /admin/todo/tasks/:id
//   POST   /admin/todo/categories          create;  PATCH/DELETE /admin/todo/categories/:id
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { TodoCategory, TodoTask } from '../../models/index.js';
import { NotFound } from '../../utils/errors.js';
import { ACCENTS, zObjectId, zRequired } from '../../utils/validators.js';

const zMonday = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.')
  .refine((d) => {
    const t = Date.parse(`${d}T00:00:00Z`);
    return !Number.isNaN(t) && new Date(t).toISOString().startsWith(d) && new Date(t).getUTCDay() === 1;
  }, 'Week must start on a Monday.');
const zDay = z.coerce.number().int().min(0).max(6);
const zCategoryRef = z.union([zObjectId, z.null()]);
const zPriority = z.enum(['high', 'medium', 'low']).nullable();

const categoryBody = z.object({
  name: zRequired(40, 'Name'),
  color: z.union([z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a colour like #3b82f6.').transform((c) => c.toLowerCase()), z.enum(ACCENTS.filter((a) => a !== 'auto'))]).default('#3b82f6'),
  weeklyTarget: z.coerce.number().int('Whole number of cards.').min(0).max(100).default(0),
});
const taskBody = z.object({
  title: zRequired(200, 'Task'),
  categoryId: zCategoryRef.default(null),
  priority: zPriority.default('medium'),
  weekStart: zMonday,
  day: zDay.default(0),
  order: z.number().finite().optional(),
});
const taskPatch = z
  .object({
    title: zRequired(200, 'Task'),
    categoryId: zCategoryRef,
    priority: zPriority,
    weekStart: zMonday,
    day: zDay,
    order: z.number().finite(),
    done: z.boolean(),
  })
  .partial();
const idParam = z.object({ id: zObjectId });

async function nextOrder(weekStart, day) {
  const last = await TodoTask.findOne({ weekStart, day }).sort({ order: -1 }).select('order').lean();
  return (last?.order ?? 0) + 1;
}

export const todoRoutes = Router()
  .get('/week/:monday', validate({ params: z.object({ monday: zMonday }) }), async (req, res) => {
    const [categories, tasks] = await Promise.all([
      TodoCategory.find().sort({ order: 1, createdAt: 1 }),
      TodoTask.find({ weekStart: req.valid.params.monday }).sort({ day: 1, order: 1 }),
    ]);
    res.json({ categories, tasks });
  })
  .post('/rollover', validate({ body: z.object({ weekStart: zMonday }) }), async (req, res) => {
    const { weekStart } = req.valid.body;
    const stale = await TodoTask.find({ done: false, weekStart: { $lt: weekStart } }).sort({ weekStart: 1, day: 1, order: 1 });
    let order = (await TodoTask.findOne({ weekStart, day: 0 }).sort({ order: 1 }).select('order').lean())?.order ?? 1;
    // Carried cards go to the top of Monday, in their original order.
    for (const t of stale.reverse()) {
      order -= 1;
      await TodoTask.updateOne({ _id: t._id }, { $set: { weekStart, day: 0, order, carriedFrom: t.carriedFrom ?? t.weekStart } });
    }
    res.json({ moved: stale.length });
  })
  .post('/tasks', validate({ body: taskBody }), async (req, res) => {
    const b = req.valid.body;
    const task = await TodoTask.create({ ...b, order: b.order ?? (await nextOrder(b.weekStart, b.day)) });
    res.status(201).json({ task });
  })
  .patch('/tasks/:id', validate({ params: idParam, body: taskPatch }), async (req, res) => {
    const b = req.valid.body;
    const set = { ...b };
    if ('done' in b) set.doneAt = b.done ? new Date() : null;
    const task = await TodoTask.findByIdAndUpdate(req.valid.params.id, { $set: set }, { new: true, runValidators: true });
    if (!task) throw NotFound('Task not found.');
    res.json({ task });
  })
  .delete('/tasks/:id', validate({ params: idParam }), async (req, res) => {
    const r = await TodoTask.deleteOne({ _id: req.valid.params.id });
    if (!r.deletedCount) throw NotFound('Task not found.');
    res.status(204).end();
  })
  .post('/categories', validate({ body: categoryBody }), async (req, res) => {
    const last = await TodoCategory.findOne().sort({ order: -1 }).select('order').lean();
    const category = await TodoCategory.create({ ...req.valid.body, order: (last?.order ?? 0) + 1 });
    res.status(201).json({ category });
  })
  .patch('/categories/:id', validate({ params: idParam, body: categoryBody.partial() }), async (req, res) => {
    const category = await TodoCategory.findByIdAndUpdate(req.valid.params.id, { $set: req.valid.body }, { new: true, runValidators: true });
    if (!category) throw NotFound('Category not found.');
    res.json({ category });
  })
  .delete('/categories/:id', validate({ params: idParam }), async (req, res) => {
    const r = await TodoCategory.deleteOne({ _id: req.valid.params.id });
    if (!r.deletedCount) throw NotFound('Category not found.');
    await TodoTask.updateMany({ categoryId: req.valid.params.id }, { $set: { categoryId: null } }); // cards stay, uncategorised
    res.status(204).end();
  });
