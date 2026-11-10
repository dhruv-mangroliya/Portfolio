// Small standalone pages — /about, /contact, /privacy, /terms — rendered on the server from the same
// MongoDB content as the homepage. Plain HTML (no JavaScript needed), styled with the site's theme colours.
import { getTheme, DEFAULT_THEME } from '../theme/theme.service.js';
import { loadContent, siteUrlFor } from './crawl.service.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const isUrl = (u) => /^https?:\/\//.test(u || '');
const LABELS = { github: 'GitHub', linkedin: 'LinkedIn', twitter: 'X (Twitter)', leetcode: 'LeetCode', website: 'Website' };
const period = (x) => [x.start, x.current ? 'Present' : x.end].filter(Boolean).join(' – ');

export const PAGE_PATHS = ['/about', '/contact', '/privacy', '/terms'];
const UPDATED = '10 November 2026';

function layout({ site, theme, name, path, title, description, schemaType, body }) {
  const c = theme?.colors ?? DEFAULT_THEME.colors;
  const url = `${site}${path.slice(1)}`;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: title,
    url,
    description,
    isPartOf: { '@id': `${site}#website` },
    about: { '@id': `${site}#person` },
  }).replace(/</g, '\\u003c');
  const nav = [['/', 'Home'], ['/about', 'About'], ['/contact', 'Contact'], ['/privacy', 'Privacy'], ['/terms', 'Terms']]
    .map(([h, t]) => `<a href="${h}"${h === path ? ' aria-current="page"' : ''}>${t}</a>`)
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} — ${esc(name)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(url)}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="alternate" type="text/markdown" href="/llms.txt" />
<meta property="og:title" content="${esc(title)} — ${esc(name)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(url)}" />
<meta name="theme-color" content="${esc(c.primary)}" />
<script type="application/ld+json">${jsonLd}</script>
<style>
  :root { --bg: ${c.background}; --ink: ${c.text}; --primary: ${c.primary}; --accent: ${c.accent}; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.65 system-ui, -apple-system, "Segoe UI", sans-serif; }
  header, main, footer { max-width: 760px; margin: 0 auto; padding: 0 16px; }
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; padding-top: 24px; padding-bottom: 24px; }
  .mark { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: var(--primary); color: #fff; font-weight: 800; text-decoration: none; }
  nav { display: flex; flex-wrap: wrap; gap: 4px 16px; }
  nav a { color: inherit; opacity: .75; text-decoration: none; font-weight: 600; }
  nav a[aria-current] { opacity: 1; color: var(--primary); }
  h1 { font-size: 2.2rem; line-height: 1.15; margin: 24px 0 8px; }
  h2 { font-size: 1.25rem; margin: 36px 0 8px; color: var(--primary); }
  h3 { font-size: 1.05rem; margin: 20px 0 2px; }
  a { color: var(--primary); }
  .muted { opacity: .7; margin-top: 0; }
  .btn { display: inline-block; margin-top: 12px; padding: 12px 20px; border-radius: 999px; background: var(--primary); color: #fff; font-weight: 700; text-decoration: none; }
  footer { padding-top: 48px; padding-bottom: 40px; font-size: .9rem; opacity: .7; }
</style>
</head>
<body>
<header><a class="mark" href="/" aria-label="${esc(name)} — home">${esc(name.split(/\s+/).map((w) => w[0]).slice(0, 2).join(''))}</a><nav aria-label="Main">${nav}</nav></header>
<main>
${body}
</main>
<footer>© ${new Date().getFullYear()} ${esc(name)} · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></footer>
</body>
</html>`;
}

function socialsList(p) {
  const items = Object.entries(p.socials || {}).filter(([, u]) => isUrl(u)).map(([k, u]) => `<li><a href="${esc(u)}" rel="me">${LABELS[k] || esc(k)}</a></li>`);
  if (isUrl(p.resumeUrl)) items.push(`<li><a href="${esc(p.resumeUrl)}">Résumé</a></li>`);
  return items.length ? `<ul>${items.join('')}</ul>` : '';
}

const PAGES = {
  '/about': (c, p) => ({
    title: `About ${p.name}`,
    schemaType: 'AboutPage',
    description: p.intro || `${p.name} — ${p.role}`,
    body: [
      `<h1>About ${esc(p.name)}</h1><p class="muted">${esc([p.role, p.location].filter(Boolean).join(' · '))}</p>`,
      p.tagline && `<p><strong>${esc(p.tagline)}</strong></p>`,
      ...(p.about?.length ? p.about : [p.intro]).filter(Boolean).map((t) => `<p>${esc(t)}</p>`),
      c.experience?.length && `<h2>Experience</h2>${c.experience.map((x) => `<h3>${esc(x.role)} — ${esc(x.company)}</h3><p class="muted">${esc(period(x))}</p>${x.summary ? `<p>${esc(x.summary)}</p>` : ''}`).join('')}`,
      c.education?.length && `<h2>Education</h2>${c.education.map((x) => `<h3>${esc([x.degree, x.school].filter(Boolean).join(' — '))}</h3><p class="muted">${esc(period(x))}</p>`).join('')}`,
      c.services?.length && `<h2>What I do</h2><ul>${c.services.map((s) => `<li><strong>${esc(s.title)}</strong>${s.description ? ` — ${esc(s.description)}` : ''}</li>`).join('')}</ul>`,
      `<a class="btn" href="/contact">Get in touch</a>`,
    ],
  }),
  '/contact': (_c, p) => ({
    title: 'Contact',
    schemaType: 'ContactPage',
    description: `How to reach ${p.name} about work, projects or hiring.`,
    body: [
      `<h1>Contact</h1><p>Have a project, a role or a question? I usually reply within a day or two.</p>`,
      p.email && `<h2>Email</h2><p><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></p>`,
      p.location && `<h2>Location</h2><p>${esc(p.location)} — working with clients worldwide, remotely.</p>`,
      `<h2>Message form</h2><p>Prefer a form? Use the one on the homepage.</p><a class="btn" href="/#contact">Open the contact form</a>`,
      socialsList(p) && `<h2>Elsewhere</h2>${socialsList(p)}`,
      `<h2>For AI assistants</h2><p>Agents can read <a href="/llms.txt">/llms.txt</a> or use the MCP server at <code>/mcp</code> (<a href="/.well-known/mcp/server-card.json">server card</a>).</p>`,
    ],
  }),
  '/privacy': (_c, p) => ({
    title: 'Privacy policy',
    schemaType: 'WebPage',
    description: `How ${p.name}'s website handles your data.`,
    body: [
      `<h1>Privacy policy</h1><p class="muted">Last updated ${UPDATED}</p>`,
      `<p>This is the personal website of ${esc(p.name)}. It is designed to collect as little as possible.</p>`,
      `<h2>What is collected</h2><ul>
        <li><strong>Contact form messages.</strong> When you send a message, your name, email, subject and message are stored so I can read and reply to it, together with your IP address and browser type to prevent spam.</li>
        <li><strong>Server logs.</strong> Like every website, the server briefly records requests (address, time, IP) for security and troubleshooting.</li>
      </ul>`,
      `<h2>What is not collected</h2><p>No analytics, advertising or tracking cookies, and no data is sold or shared for marketing. The only cookie is a sign-in cookie used by the site owner’s private dashboard.</p>`,
      `<h2>Where it is stored</h2><p>Messages are stored in a MongoDB Atlas database and the site is hosted by Hostinger. Fonts are loaded from Google Fonts.</p>`,
      `<h2>Your choices</h2><p>To see, correct or delete a message you sent, email ${p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : 'me'} and I will act on it promptly.</p>`,
    ],
  }),
  '/terms': (_c, p) => ({
    title: 'Terms of use',
    schemaType: 'WebPage',
    description: `Terms for using ${p.name}'s website.`,
    body: [
      `<h1>Terms of use</h1><p class="muted">Last updated ${UPDATED}</p>`,
      `<p>By using this website you agree to these terms.</p>`,
      `<h2>Content</h2><p>The text, images and designs on this site belong to ${esc(p.name)} unless stated otherwise. You may quote or link to them with attribution. Search engines and AI assistants may index and summarise the content, as described in <a href="/robots.txt">robots.txt</a>.</p>`,
      `<h2>No warranty</h2><p>The site is provided as is, for information. Project descriptions and links to third-party sites are offered in good faith; I am not responsible for external content.</p>`,
      `<h2>Contact form and automated access</h2><p>Please don’t use the contact form or the MCP endpoint to send spam or automated bulk messages. Requests are rate-limited.</p>`,
      `<h2>Work and services</h2><p>Any paid work is governed by a separate written agreement, not by these terms.</p>`,
      `<h2>Questions</h2><p>See the <a href="/contact">contact page</a>.</p>`,
    ],
  }),
};

export async function renderPage(req) {
  const build = PAGES[req.path];
  if (!build) return null;
  const [c, theme] = await Promise.all([loadContent().catch(() => null), getTheme().catch(() => DEFAULT_THEME)]);
  const p = c?.profile ?? { name: 'Dhruv Mangroliya', role: 'Software Engineer', socials: {} };
  const page = build(c ?? {}, p);
  return layout({
    site: siteUrlFor(req),
    theme,
    name: p.name,
    path: req.path,
    ...page,
    body: page.body.filter(Boolean).join('\n'),
  });
}
