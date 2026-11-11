// Money tracker (private, dashboard only). Months are 'YYYY-MM'; amounts are rupees.
//  • IncomeEntry   — money earned in a month (several per month allowed: salary, freelance…)
//  • MoneyAccount  — where money is kept (Bank, Mutual funds, …)
//  • MoneyTransfer — money added to (positive) or taken out of (negative) an account on a date
import { Schema, model, str, toJSON } from './_shared.js';

const month = { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ };
const amount = { type: Number, required: true, min: 0 };
const opts = { timestamps: true, toJSON };

export const IncomeEntry = model('IncomeEntry', new Schema({ month: { ...month, index: true }, amount, source: str({ maxlength: 80 }) }, opts));
export const MoneyAccount = model('MoneyAccount', new Schema({ name: str({ required: true, maxlength: 40 }), color: { type: String, default: '#3b82f6' }, order: { type: Number, default: 0 } }, opts));

const transferSchema = new Schema(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    accountId: { type: Schema.Types.ObjectId, ref: 'MoneyAccount', required: true, index: true },
    amount: { type: Number, required: true }, // negative = withdrawal
    note: str({ maxlength: 120 }),
  },
  opts
);
transferSchema.index({ date: -1 });
export const MoneyTransfer = model('MoneyTransfer', transferSchema);
