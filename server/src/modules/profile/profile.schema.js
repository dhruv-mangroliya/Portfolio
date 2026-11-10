import { z } from 'zod';
import { zDataUrl } from '../media/media.schema.js';
import { zBool, zEmail, zList, zRequired, zText, zUrl } from '../../utils/validators.js';

export const profileSchema = z.object({
  name: zRequired(100, 'Name'),
  role: zText(120),
  tagline: zText(200),
  intro: zText(800),
  about: zList(8, 1500, 'Each paragraph'),
  location: zText(120),
  email: z.union([z.literal(''), zEmail]).default(''),
  phone: zText(40),
  resumeUrl: zUrl,
  availability: z.object({ open: zBool.default(true), text: zText(80) }).default({}),
  seo: z
    .object({
      title: zText(70),
      description: zText(320),
    })
    .default({}),
  socials: z
    .object({ github: zUrl, linkedin: zUrl, twitter: zUrl, leetcode: zUrl, website: zUrl })
    .default({}),
});

export const photoSchema = z.object({
  image: zDataUrl('Cropped photo'),
  original: zDataUrl('Original photo').optional(),
  crop: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    zoom: z.number().min(1).max(10),
  }),
});
