import { ACCENTS } from '../utils/validators.js';
import { contentSchema, model, str, strList } from './_shared.js';

export const Project = model(
  'Project',
  contentSchema({
    title: str({ required: true }),
    category: str(),
    summary: str(),
    points: strList,
    tech: strList,
    liveUrl: str(),
    repoUrl: str(),
    images: strList, // gallery; the first image is the card cover
    featured: { type: Boolean, default: false },
    accent: { type: String, enum: ACCENTS, default: 'auto' },
  })
);
