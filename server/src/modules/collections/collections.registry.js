// Maps a URL segment (/admin/collections/:collection) to its model and validation schemas.
// Adding a new kind of content = a model + a Zod schema + one line here.
import { Education, Experience, Project, Service, SkillGroup, Stat } from '../../models/index.js';
import { collectionSchemas as s } from './collections.schema.js';

const entry = (Model, schema) => ({ Model, create: schema, update: schema.partial() });

export const COLLECTIONS = {
  experience: entry(Experience, s.experience),
  projects: entry(Project, s.projects),
  skills: entry(SkillGroup, s.skills),
  services: entry(Service, s.services),
  stats: entry(Stat, s.stats),
  education: entry(Education, s.education),
};
