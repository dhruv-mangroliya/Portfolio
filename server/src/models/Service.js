import { contentSchema, model, str } from './_shared.js';

export const SERVICE_ICONS = ['code', 'server', 'cloud', 'layout', 'database', 'zap', 'refresh', 'shield'];

export const Service = model(
  'Service',
  contentSchema({
    title: str({ required: true }),
    description: str(),
    icon: { type: String, enum: SERVICE_ICONS, default: 'code' },
  })
);
