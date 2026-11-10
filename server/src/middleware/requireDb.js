import { isDbReady } from '../db/connection.js';
import { ServiceUnavailable } from '../utils/errors.js';

export function requireDb(_req, _res, next) {
  next(isDbReady() ? undefined : ServiceUnavailable());
}
