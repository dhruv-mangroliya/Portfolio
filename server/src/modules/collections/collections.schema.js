// Request validation for every editable content collection.
import { z } from 'zod';
import { SERVICE_ICONS } from '../../models/index.js';
import { ACCENTS, isSafeUrl, zBool, zList, zObjectId, zRequired, zText, zUrl } from '../../utils/validators.js';

const zImageList = z
  .array(z.string().trim().max(500).refine((v) => v && isSafeUrl(v), 'Invalid image.'), { invalid_type_error: 'Images must be a list.' })
  .max(10, 'At most 10 images per project.')
  .default([]);

const base = { hidden: zBool.default(false) };

export const collectionSchemas = {
  experience: z.object({
    ...base,
    role: zRequired(120, 'Role'),
    company: zRequired(120, 'Company'),
    companyUrl: zUrl,
    location: zText(120),
    start: zRequired(40, 'Start date'),
    end: zText(40),
    current: zBool.default(false),
    summary: zText(600),
    points: zList(20, 500, 'Each point'),
    tech: zList(30, 50, 'Each technology'),
  }),
  projects: z.object({
    ...base,
    title: zRequired(120, 'Title'),
    category: zText(80),
    summary: zRequired(500, 'Summary'),
    points: zList(12, 400, 'Each highlight'),
    tech: zList(20, 50, 'Each technology'),
    liveUrl: zUrl,
    repoUrl: zUrl,
    images: zImageList,
    featured: zBool.default(false),
    accent: z.enum(ACCENTS).default('auto'),
  }),
  skills: z.object({
    ...base,
    name: zRequired(80, 'Group name'),
    skills: zList(40, 60, 'Each skill'),
  }),
  services: z.object({
    ...base,
    title: zRequired(100, 'Title'),
    description: zRequired(400, 'Description'),
    icon: z.enum(SERVICE_ICONS).default('code'),
  }),
  stats: z.object({
    ...base,
    value: zRequired(20, 'Value'),
    label: zRequired(80, 'Label'),
  }),
  education: z.object({
    ...base,
    school: zRequired(150, 'School'),
    degree: zRequired(150, 'Degree'),
    location: zText(120),
    start: zText(40),
    end: zText(40),
    points: zList(10, 300, 'Each point'),
  }),
};

export const idParams = z.object({ collection: z.string(), id: zObjectId });
export const reorderSchema = z.object({ ids: z.array(zObjectId).max(500) });
