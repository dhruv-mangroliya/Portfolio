// Process entry point: start HTTP immediately, connect to MongoDB in the background (with retry),
// run first-time setup, and shut down gracefully on Ctrl+C / SIGTERM.
import { createApp } from './app.js';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { bootstrapDb } from './db/bootstrap.js';
import { connectDb, disconnectDb } from './db/connection.js';

if (config.auth.jwtSecretIsEphemeral) {
  logger.warn('JWT_SECRET is not set — using a temporary secret (you will be signed out on every restart).');
}

const server = createApp().listen(config.port, () => {
  logger.info(`API (${config.env}) listening on http://localhost:${config.port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.fatal(`Port ${config.port} is already in use. Stop the other process or change PORT in .env.`);
    process.exit(1);
  }
  throw err;
});

connectDb()
  .then(bootstrapDb)
  .catch((err) => logger.error({ err }, 'Database setup failed — API will keep returning 503'));

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down`);
  setTimeout(() => process.exit(1), 10_000).unref();
  server.close();
  server.closeIdleConnections?.();
  await disconnectDb().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled promise rejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
