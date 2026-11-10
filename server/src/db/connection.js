// MongoDB connection with retry/backoff, so the HTTP server can start (and report
// "unavailable") while the database is still coming up — it never crashes on a DB error.
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

mongoose.set('strictQuery', true);

const log = logger.child({ module: 'db' });
const redact = (uri) => uri.replace(/\/\/([^@/]+)@/, '//***@');

// "Ready" = connected AND first-run setup (indexes, seed) finished,
// so no request ever sees a half-initialised database.
let initialised = false;
export const markDbInitialised = () => {
  initialised = true;
};
export const isDbReady = () => initialised && mongoose.connection.readyState === 1;
export const dbState = () => (isDbReady() ? 'up' : mongoose.connection.readyState === 1 ? 'starting' : 'down');

let stopping = false;

/** A practical next step for the most common connection failures. */
function hintFor(err, uri) {
  const msg = String(err?.message ?? '');
  if (/auth/i.test(msg)) {
    return 'The username/password in MONGODB_URI were rejected — check the user in Atlas → Database Access and URL-encode special characters in the password (@ → %40).';
  }
  if (uri.startsWith('mongodb+srv://')) {
    return 'Check your internet connection and that your IP is allowed in Atlas → Network Access.';
  }
  return 'Is MongoDB running? Try: brew services start mongodb-community';
}

/** Connects, retrying with exponential backoff (1s → 30s). Pass { retry: false } to fail fast. */
export async function connectDb({ uri = config.mongoUri, retry = true } = {}) {
  let delay = 1000;
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 });
      log.info(`Connected to MongoDB (${redact(uri)})`);
      return mongoose.connection;
    } catch (err) {
      if (!retry || stopping) throw err;
      log.warn(`MongoDB unavailable (attempt ${attempt}): ${err.message}`);
      log.warn(`→ ${hintFor(err, uri)} Retrying in ${delay / 1000}s…`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 30_000);
    }
  }
}

export async function disconnectDb() {
  stopping = true;
  initialised = false;
  await mongoose.disconnect();
}

mongoose.connection.on('disconnected', () => !stopping && initialised && log.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => log.info('MongoDB reconnected'));
