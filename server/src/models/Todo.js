// Weekly to-do board (private, dashboard only).
//  • TodoCategory — e.g. Gym, Design; a colour and a weekly target (number of cards to finish).
//  • TodoTask     — one card (weight 1) in a week (weekStart = that Monday) on a day (0 = Mon … 6 = Sun).
//    Unfinished cards from earlier weeks roll over to the current week's Monday (carriedFrom remembers
//    the week they were first planned for).
import { Schema, model, str, toJSON } from './_shared.js';
import { ACCENTS } from '../utils/validators.js';

const week = { type: String, match: /^\d{4}-\d{2}-\d{2}$/ };

const categorySchema = new Schema(
  {
    name: str({ required: true, maxlength: 40 }),
    // A hex colour (#rrggbb) or, for older categories, a theme slot name.
    color: {
      type: String,
      default: '#3b82f6',
      validate: { validator: (v) => /^#[0-9a-f]{6}$/i.test(v) || ACCENTS.includes(v), message: 'Invalid colour.' },
    },
    weeklyTarget: { type: Number, default: 0, min: 0, max: 100 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON }
);

const taskSchema = new Schema(
  {
    title: str({ required: true, maxlength: 200 }),
    categoryId: { type: Schema.Types.ObjectId, ref: 'TodoCategory', default: null },
    weekStart: { ...week, required: true, index: true },
    day: { type: Number, min: 0, max: 6, default: 0 },
    order: { type: Number, default: 0 },
    priority: { type: String, enum: ['high', 'medium', 'low', null], default: null },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
    carriedFrom: { ...week, default: null },
  },
  { timestamps: true, toJSON }
);
taskSchema.index({ done: 1, weekStart: 1 });

export const TodoCategory = model('TodoCategory', categorySchema);
export const TodoTask = model('TodoTask', taskSchema);
