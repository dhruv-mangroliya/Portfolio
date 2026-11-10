import { waitForDb } from '../db/connection.js';
import { ServiceUnavailable } from '../utils/errors.js';

// Right after a (cold) start the database may still be connecting — wait briefly instead of failing.
export async function requireDb(_req, _res, next) {
  next((await waitForDb(15_000)) ? undefined : ServiceUnavailable());
}
