// Validated, typed configuration. The process exits with a readable message if .env is invalid.
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5050),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://')
    .default('mongodb://127.0.0.1:27017/dhruv_site'),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),
  SESSION_DAYS: z.coerce.number().positive().max(90).default(7),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  CORS_ORIGINS: z.string().optional(),
  SITE_URL: z.string().url('must be a full URL like https://dhruv.dev').optional(),
});

// Treat empty values in .env ("FOO=") as "not set".
const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
const parsed = schema.safeParse(raw);
if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`\n✖ Invalid environment configuration (.env):\n${lines}\n`);
  process.exit(1);
}

const e = parsed.data;
const isProd = e.NODE_ENV === 'production';
if (isProd && !e.JWT_SECRET) {
  console.error('\n✖ JWT_SECRET must be set in production.\n');
  process.exit(1);
}

export const config = Object.freeze({
  root,
  distDir: path.join(root, 'dist'),
  env: e.NODE_ENV,
  isProd,
  isTest: e.NODE_ENV === 'test',
  port: e.PORT,
  logLevel: e.LOG_LEVEL ?? (e.NODE_ENV === 'test' ? 'silent' : 'info'),
  mongoUri: e.MONGODB_URI,
  siteUrl: e.SITE_URL ? e.SITE_URL.replace(/\/+$/, '') + '/' : '',
  auth: Object.freeze({
    jwtSecret: e.JWT_SECRET ?? crypto.randomBytes(48).toString('hex'),
    jwtSecretIsEphemeral: !e.JWT_SECRET,
    sessionDays: e.SESSION_DAYS,
    cookieName: 'sid',
    cookieSecure: e.COOKIE_SECURE ? e.COOKIE_SECURE === 'true' : isProd,
  }),
  http: Object.freeze({
    trustProxy: e.TRUST_PROXY,
    corsOrigins: (e.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    bodyLimit: '1mb',
  }),
});
