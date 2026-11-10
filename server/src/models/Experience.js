import { contentSchema, model, str, strList } from './_shared.js';

export const Experience = model(
  'Experience',
  contentSchema({
    role: str({ required: true }),
    company: str({ required: true }),
    companyUrl: str(),
    location: str(),
    start: str(),
    end: str(),
    current: { type: Boolean, default: false },
    summary: str(),
    points: strList,
    tech: strList,
  }),
  'experiences'
);
