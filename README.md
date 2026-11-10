# Dhruv Mangroliya — personal website

A vibrant portfolio with a private admin dashboard, built to grow into a personal life tracker
(weight, diet, habits) that replaces spreadsheets.

| Layer | Stack |
| --- | --- |
| Frontend | React 18 · Vite · React Router (admin is a lazy-loaded chunk) |
| Backend | Node.js · Express 5 — layered modules (routes → controller → service → model) |
| Storage | **MongoDB only** (Mongoose). No JSON files are used to store data. |
| Validation | Zod (requests) + Mongoose (storage) |
| Security | Helmet/CSP, rate limits, scrypt passwords, JWT in an httpOnly cookie, honeypot spam trap |
| Ops | Pino logs with request IDs, health/readiness probes, DB retry, graceful shutdown |
| Tests | `node:test` + Supertest against a real throwaway database |

## Run it locally

```bash
brew services start mongodb-community   # MongoDB (auto-starts on login)
npm install
cp .env.example .env                    # then set JWT_SECRET (see the comment in the file)
npm run set-admin -- dhruv              # creates your login and prints a password
npm run dev                             # website → http://localhost:5173 · API → :5050
```

- Website: http://localhost:5173
- Dashboard: http://localhost:5173/admin (not linked from the site)
- Tests: `npm test` (uses the separate `dhruv_site_test` database and wipes it)

On first start with an empty database, starter content from `server/src/db/seed-data.js` is inserted
once. From then on everything is edited in the dashboard and lives only in MongoDB.

## Dashboard

- **Overview** — counts, quick “New project / New experience”, latest messages
- **Profile** — photo upload with drag/zoom cropping (stored in MongoDB), name, role, tagline,
  About paragraphs, availability badge, contact and social links
- **Experience · Projects · Skills · Services · Key numbers · Education** — add, edit, reorder,
  hide/publish, delete. Bullet lists, tag inputs, card colour picker, unsaved-changes warning
- **Messages** — contact-form enquiries; reply by email, read/unread, delete
- **Appearance** — colour theme for the whole site: presets (default Black · White · Navy · Yellow,
  Vibrant, Midnight, Forest) or custom colours, gradient and card palette, with a live preview and
  contrast warnings. Stored in MongoDB.
- **Settings** — change password (signs out other devices)
- **Life tracker** — Weight, Diet & meals, Habits: placeholders for the next phase

## Project structure

```
server/src/
  server.js              start HTTP, connect DB with retry, first-run setup, graceful shutdown
  app.js                 Express app (middleware, /api/v1, serves dist/ in production)
  config/                env.js (validated .env) · logger.js
  db/                    connection · bootstrap (indexes + first-run seed) · seed-data
  middleware/            auth · validate · rate limits · requireDb · errorHandler
  models/                one Mongoose model per file
  modules/               auth · collections · profile · messages · contact · content · dashboard
  routes/index.js        API v1 route table
  utils/                 errors · password hashing · Zod helpers
server/tests/            API integration tests
scripts/set-admin.js     create/reset an admin user
src/
  site/                  public website (Site.jsx, sections.jsx, site.css)
  admin/                 dashboard (schema-driven forms: admin/schema.js)
  shared/                icons, utilities, design tokens (base.css)
```

**Adding a new kind of content:** a model in `server/src/models`, a Zod schema in
`modules/collections/collections.schema.js`, one line in `collections.registry.js`, and an entry in
`src/admin/schema.js`. The dashboard list and form are generated from that entry.

## API (v1)

Every error looks like `{ "error": { "code", "message", "fields"?, "requestId" } }`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/health` · `/health/ready` | – | Liveness / readiness |
| GET | `/api/v1/content` | – | Published site content |
| GET | `/api/v1/media/:id` | – | Uploaded image (cached forever) |
| POST | `/api/v1/contact` | – | Send an enquiry (rate-limited) |
| POST | `/api/v1/auth/login` · `/logout` | – | Sign in / out |
| GET · PUT | `/api/v1/auth/me` · `/auth/password` | ✓ | Current user · change password |
| GET | `/api/v1/admin/dashboard` | ✓ | Overview numbers |
| GET · PUT | `/api/v1/admin/profile` | ✓ | Profile |
| GET · PUT | `/api/v1/admin/theme` | ✓ | Colour theme |
| PUT · DELETE | `/api/v1/admin/profile/photo` | ✓ | Set (cropped + original) / remove photo |
| GET · PATCH · DELETE | `/api/v1/admin/messages[/:id]` | ✓ | Inbox |
| GET · POST | `/api/v1/admin/collections/:collection` | ✓ | List / create |
| GET · PATCH · DELETE | `/api/v1/admin/collections/:collection/:id` | ✓ | Read / update / delete |
| PUT | `/api/v1/admin/collections/:collection/order` | ✓ | Reorder (`{ ids }`) |

`:collection` is one of `experience, projects, skills, services, stats, education`.

## SEO

- Title and description are edited in **Profile → Google & sharing** (with a live Google preview).
- In production, Express injects them into `index.html` (title, description, Open Graph, Twitter and
  a schema.org `Person` block), so crawlers and link previews see them without running JavaScript.
- Set `SITE_URL` (e.g. `https://yourdomain.com`) to add the canonical URL and use your photo as the
  link-preview image. `robots.txt` keeps `/admin` and `/api` out of search results.

## Production

```bash
npm run build && npm start   # Express serves the built site + API on $PORT
```

Set `MONGODB_URI` (e.g. MongoDB Atlas), `JWT_SECRET` and `TRUST_PROXY=1` on your host, point its
health check at `/api/v1/health/ready`, and run `npm run set-admin -- <username>` once.
# Portfolio
