// Diet tracker (private, dashboard only).
//  • DietPlan — the one editable template: meal sessions with food items, supplements, preparations.
//  • DietDay  — what was ticked on a given day. Ticked foods are copied (name, protein, calories) so
//               editing the plan later never changes past days.
import { Schema, model, toJSON } from './_shared.js';

const num = { type: Number, default: 0, min: 0 };
const food = { id: String, name: String, protein: num, calories: num, quantity: { type: String, default: '' } };

const planSchema = new Schema(
  {
    key: { type: String, default: 'main', unique: true, immutable: true },
    sessions: [
      {
        _id: false,
        id: String,
        name: String,
        target: { protein: num, calories: num },
        items: [{ _id: false, ...food }],
      },
    ],
    supplements: [{ _id: false, id: String, name: String }],
    preparations: [{ _id: false, id: String, name: String }],
  },
  { timestamps: true, toJSON }
);

const daySchema = new Schema(
  {
    date: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    items: [{ _id: false, itemId: String, sessionId: String, name: String, protein: num, calories: num, quantity: { type: String, default: '' } }],
    extras: [{ _id: false, id: String, name: String, protein: num, calories: num }],
    supplements: [String],
    preparations: [String],
  },
  { timestamps: true, toJSON }
);

export const DietPlan = model('DietPlan', planSchema);
export const DietDay = model('DietDay', daySchema);
