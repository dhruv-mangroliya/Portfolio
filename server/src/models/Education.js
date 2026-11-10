import { contentSchema, model, str, strList } from './_shared.js';

export const Education = model(
  'Education',
  contentSchema({
    school: str({ required: true }),
    degree: str(),
    location: str(),
    start: str(),
    end: str(),
    points: strList,
  }),
  'education'
);
