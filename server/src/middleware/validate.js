// Validates request parts against Zod schemas. Parsed values are stored on req.valid
// (Express 5's req.query is read-only), e.g. req.valid.body, req.valid.params.
import { parse } from '../utils/validators.js';

export const validate = (schemas) => (req, _res, next) => {
  req.valid = {};
  for (const part of ['params', 'query', 'body']) {
    if (schemas[part]) req.valid[part] = parse(schemas[part], req[part]);
  }
  next();
};
