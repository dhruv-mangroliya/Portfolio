import { contentSchema, model, str, strList } from './_shared.js';

export const SkillGroup = model('SkillGroup', contentSchema({ name: str({ required: true }), skills: strList }));
