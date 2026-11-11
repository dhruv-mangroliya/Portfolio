// Money tracker API (admin only). Everything is small, so one GET returns it all.
//   GET    /admin/money                         { incomes, accounts, transfers }
//   POST   /admin/money/incomes                 PATCH/DELETE /admin/money/incomes/:id
//   POST   /admin/money/accounts                PATCH/DELETE /admin/money/accounts/:id
//   POST   /admin/money/transfers               { accountId, amount (− = withdraw), date, note };  DELETE /admin/money/transfers/:id
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { IncomeEntry, MoneyAccount, MoneyTransfer } from '../../models/index.js';
import { AppError, NotFound, ValidationFailed } from '../../utils/errors.js';
import { zObjectId, zRequired, zText } from '../../utils/validators.js';

const zMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Pick a month.');
const zAmount = z.coerce.number({ invalid_type_error: 'Enter an amount.' }).min(0, 'Can’t be negative.').max(1e11, 'Too large.').transform((n) => Math.round(n * 100) / 100);
const zColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a colour like #3b82f6.').transform((c) => c.toLowerCase());
const idParam = z.object({ id: zObjectId });

const incomeBody = z.object({ month: zMonth, amount: zAmount, source: zText(80) });
const accountBody = z.object({ name: zRequired(40, 'Name'), color: zColor.default('#3b82f6') });

const DEFAULT_ACCOUNTS = [
  { name: 'Bank', color: '#3b82f6' },
  { name: 'Mutual funds', color: '#10b981' },
];

/** CRUD routes for a simple collection. */
function crud(router, path, Model, body) {
  router.post(path, validate({ body }), async (req, res) => {
    const extra = Model === MoneyAccount ? { order: ((await MoneyAccount.findOne().sort({ order: -1 }).lean())?.order ?? -1) + 1 } : {};
    res.status(201).json({ item: await Model.create({ ...req.valid.body, ...extra }) });
  });
  router.patch(`${path}/:id`, validate({ params: idParam, body: body.partial() }), async (req, res) => {
    const doc = await Model.findById(req.valid.params.id);
    if (!doc) throw NotFound();
    Object.assign(doc, req.valid.body);
    res.json({ item: await doc.save() });
  });
  router.delete(`${path}/:id`, validate({ params: idParam }), async (req, res) => {
    const r = await Model.deleteOne({ _id: req.valid.params.id });
    if (!r.deletedCount) throw NotFound();
    if (Model === MoneyAccount) await MoneyTransfer.deleteMany({ accountId: req.valid.params.id });
    res.status(204).end();
  });
}

export const moneyRoutes = Router();

// Extra lock on top of being signed in: every money request must carry the passcode.
export const MONEY_PASSCODE = '1808';
moneyRoutes.use((req, _res, next) => {
  const given = String(req.get('x-money-passcode') ?? '');
  const ok = given.length === MONEY_PASSCODE.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(MONEY_PASSCODE));
  next(ok ? undefined : new AppError(403, 'PASSCODE_REQUIRED', 'Wrong passcode.'));
});

moneyRoutes.get('/', async (_req, res) => {
  if (!(await MoneyAccount.exists({}))) await MoneyAccount.insertMany(DEFAULT_ACCOUNTS.map((a, order) => ({ ...a, order })));
  const [incomes, accounts, transfers] = await Promise.all([
    IncomeEntry.find().sort({ month: -1, createdAt: 1 }),
    MoneyAccount.find().sort({ order: 1, createdAt: 1 }),
    MoneyTransfer.find().sort({ date: -1, createdAt: -1 }),
  ]);
  res.json({ incomes, accounts, transfers });
});

crud(moneyRoutes, '/incomes', IncomeEntry, incomeBody);
crud(moneyRoutes, '/accounts', MoneyAccount, accountBody);

const zDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.')
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), 'Not a real date.');
const transferBody = z.object({
  accountId: zObjectId,
  amount: z.coerce
    .number({ invalid_type_error: 'Enter an amount.' })
    .refine((n) => n !== 0, 'Enter an amount.')
    .refine((n) => Math.abs(n) <= 1e11, 'Too large.')
    .transform((n) => Math.round(n * 100) / 100),
  date: zDate,
  note: zText(120),
});

moneyRoutes.post('/transfers', validate({ body: transferBody }), async (req, res) => {
  if (!(await MoneyAccount.exists({ _id: req.valid.body.accountId }))) throw ValidationFailed('Unknown place.', { accountId: 'Pick a place.' });
  res.status(201).json({ item: await MoneyTransfer.create(req.valid.body) });
});
moneyRoutes.delete('/transfers/:id', validate({ params: idParam }), async (req, res) => {
  const r = await MoneyTransfer.deleteOne({ _id: req.valid.params.id });
  if (!r.deletedCount) throw NotFound();
  res.status(204).end();
});
