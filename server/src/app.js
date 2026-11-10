// Express application factory — no side effects (no DB connection, no listen), so tests can import it.
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pinoHttp } from 'pino-http';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { faviconSvg } from '../../src/shared/theme.js';
import { waitForDb } from './db/connection.js';
import { DEFAULT_THEME, getTheme } from './modules/theme/theme.service.js';
import { mcpRoutes } from './modules/mcp/mcp.routes.js';
import { PAGE_PATHS, renderPage } from './modules/seo/pages.service.js';
import { renderIndexHtml } from './modules/seo/seo.service.js';
import { loadContent, renderLlmsTxt, renderRobots, renderSitemap, siteUrlFor } from './modules/seo/crawl.service.js';
import { apiV1 } from './routes/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.http.trustProxy) app.set('trust proxy', config.http.trustProxy);

  // ----- observability: request id + one compact log line per API request -----
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && /^[\w-]{1,64}$/.test(incoming) ? incoming : crypto.randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => !req.url.startsWith('/api') || req.url.startsWith('/api/v1/health') },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
        err: () => undefined, // errors are logged once, by the error handler
      },
      customLogLevel: (_req, res) =>
        res.statusCode >= 500 && res.statusCode !== 503 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      customSuccessMessage: (req, res, ms) => `${req.method} ${req.originalUrl} → ${res.statusCode} (${Math.round(ms)}ms)`,
      customErrorMessage: (req, res) => `${req.method} ${req.originalUrl} → ${res.statusCode}`,
      quietReqLogger: true,
    })
  );

  // ----- security -----
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );
  if (config.http.corsOrigins.length) {
    app.use('/api', cors({ origin: config.http.corsOrigins, credentials: true }));
  }

  // ----- parsing & performance -----
  app.use(compression());
  // Routes that accept large uploads parse their own body *after* authentication.
  const LARGE_BODY_ROUTES = new Set(['/api/v1/admin/profile/photo', '/api/v1/admin/media']);
  const json = express.json({ limit: config.http.bodyLimit });
  app.use((req, res, next) => (LARGE_BODY_ROUTES.has(req.path) ? next() : json(req, res, next)));
  app.use(cookieParser());

  // ----- API -----
  app.use('/api', apiLimiter, (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/v1', apiV1());
  app.use('/api', notFound);

  // ----- crawler files (search engines + AI assistants) -----
  const text = (type, build) => async (req, res) => {
    res.set('Cache-Control', 'public, max-age=3600').type(type).send(await build(req));
  };
  // MCP server for AI agents + its discovery card.
  app.use(['/mcp', '/.well-known'], apiLimiter);
  app.use(mcpRoutes);
  // About / Contact / Privacy / Terms — plain server-rendered pages.
  app.get(PAGE_PATHS, async (req, res) => {
    res.set('Cache-Control', 'no-cache').type('html').send(await renderPage(req));
  });

  // Tab icon in the current theme colours (Google's search results use it too).
  app.get('/favicon.svg', async (_req, res) => {
    const theme = (await waitForDb(5_000)) ? await getTheme().catch(() => DEFAULT_THEME) : DEFAULT_THEME;
    res.set('Cache-Control', 'public, max-age=3600').type('image/svg+xml').send(faviconSvg(theme));
  });
  app.get('/robots.txt', text('text/plain', (req) => renderRobots(siteUrlFor(req))));
  app.get('/sitemap.xml', text('application/xml', async (req) => {
    const c = await loadContent().catch(() => null);
    return renderSitemap(siteUrlFor(req), c?.profile?.updatedAt ? new Date(c.profile.updatedAt) : undefined);
  }));
  app.get(['/llms.txt', '/llms-full.txt'], text('text/markdown; charset=utf-8', async (req) =>
    renderLlmsTxt(await loadContent().catch(() => null), siteUrlFor(req))));

  // ----- frontend (production build) -----
  if (config.isProd) {
    app.use(express.static(config.distDir, { index: false, maxAge: '1y', immutable: true }));
    const template = fs.readFileSync(path.join(config.distDir, 'index.html'), 'utf8');
    // Paths the React app actually has; anything else is a real 404 (the app still shows its "not found" page).
    const isAppPath = (p) => p === '/' || p === '/index.html' || p === '/admin' || p.startsWith('/admin/');
    app.get('/{*path}', async (req, res) => {
      const known = isAppPath(req.path);
      const discovery = '</llms.txt>; rel="alternate"; type="text/markdown", </sitemap.xml>; rel="sitemap"; type="application/xml"';
      res.set({ Link: discovery, Vary: 'Accept' });
      // AI agents asking for Markdown get the same content without the HTML.
      if (known && !req.path.startsWith('/admin') && req.accepts(['text/html', 'text/markdown']) === 'text/markdown') {
        const md = renderLlmsTxt(await loadContent().catch(() => null), siteUrlFor(req));
        return res.set('Cache-Control', 'no-cache').type('text/markdown; charset=utf-8').send(md);
      }
      let html = template;
      try {
        html = await renderIndexHtml(template, await loadContent());
      } catch (err) {
        req.log.warn({ err }, 'SEO tags could not be rendered — serving defaults');
      }
      res.status(known ? 200 : 404).set('Cache-Control', 'no-cache').type('html').send(html);
    });
  }

  app.use(errorHandler);
  return app;
}
