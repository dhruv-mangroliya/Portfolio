import { contentSchema, model, str } from './_shared.js';

export const Stat = model('Stat', contentSchema({ value: str({ required: true }), label: str({ required: true }) }));
