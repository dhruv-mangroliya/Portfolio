// "The Secret": a habit allowed once a day for 365 days from a start date (365 tickets).
// Each use spends a ticket; using it more than once a day has to be saved back on later days.
import { Schema, model, str, toJSON } from './_shared.js';

const schema = new Schema(
  {
    name: str({ maxlength: 60, required: true }),
    startDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // first tracked day
    days: { type: Number, default: 365, min: 1, max: 3660 }, // tickets = 1 per day
    counts: { type: Map, of: Number, default: {} }, // 'YYYY-MM-DD' → times used that day
    order: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { ...toJSON, flattenMaps: true } }
);

export const SecretHabit = model('SecretHabit', schema);
