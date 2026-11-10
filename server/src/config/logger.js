// Pino logger: pretty, human-readable output in development; JSON lines in production.
import pino from 'pino';
import { config } from './env.js';

const pretty = !config.isProd && !config.isTest;

export const logger = pino({
  level: config.logLevel,
  base: { service: 'dhruv-site' },
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', 'password', '*.password', '*.passwordHash'],
    censor: '[redacted]',
  },
  ...(pretty && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service,module,req,res,responseTime' },
    },
  }),
});
