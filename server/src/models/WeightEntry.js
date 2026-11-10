// One body-weight reading per calendar day (private — only visible in the dashboard).
import { Schema, model, str, toJSON } from './_shared.js';

const schema = new Schema(
  {
    date: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // local calendar day, YYYY-MM-DD
    weight: { type: Number, required: true, min: 20, max: 400 }, // kg
    note: str({ maxlength: 200 }),
  },
  { timestamps: true, toJSON }
);

export const WeightEntry = model('WeightEntry', schema);
