// Content for crawlers that don't run JavaScript (ChatGPT/GPTBot, ClaudeBot, Perplexity, Bing, link previews…):
//  • a plain-HTML copy of the whole site, put inside <div id="root"> (React replaces it on load),
//  • /llms.txt — the same content as Markdown, the emerging convention for AI assistants,
//  • /robots.txt and /sitemap.xml for search engines.
import { config } from '../../config/env.js';
import { waitForDb } from '../../db/connection.js';
import { getPublicContent } from '../content/content.routes.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LABELS = { github: 'GitHub', linkedin: 'LinkedIn', twitter: 'X (Twitter)', leetcode: 'LeetCode', website: 'Website' };
const label = (k) => LABELS[k] || k;
const isUrl = (u) => /^https?:\/\//.test(u || '');
const period = (x) => [x.start, x.current ? 'Present' : x.end].filter(Boolean).join(' – ');

/** Public site address: SITE_URL if set, otherwise the address the request came in on. */
export const siteUrlFor = (req) => config.siteUrl || `${req.protocol}://${req.get('host')}/`;

export async function loadContent() {
  return (await waitForDb(8_000)) ? getPublicContent() : null;
}

/* ------------------------------------------------------------------ HTML snapshot */

const ul = (items) => (items?.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
const link = (url, text) => (isUrl(url) ? `<a href="${esc(url)}">${esc(text)}</a>` : '');

export function renderSnapshot(c) {
  if (!c?.profile) return '';
  const p = c.profile;
  const out = [];
  out.push(`<header><h1>${esc(p.name)}</h1>`);
  if (p.role) out.push(`<p>${esc(p.role)}</p>`);
  if (p.tagline) out.push(`<p>${esc(p.tagline)}</p>`);
  if (p.intro) out.push(`<p>${esc(p.intro)}</p>`);
  out.push('</header><main>');

  if (p.about?.length) out.push(`<section id="about"><h2>About</h2>${p.about.map((t) => `<p>${esc(t)}</p>`).join('')}</section>`);

  if (c.experience?.length) {
    out.push('<section id="experience"><h2>Experience</h2>');
    for (const x of c.experience) {
      out.push(`<article><h3>${esc(x.role)} — ${esc(x.company)}</h3><p>${esc([period(x), x.location].filter(Boolean).join(' · '))}</p>`);
      if (x.summary) out.push(`<p>${esc(x.summary)}</p>`);
      out.push(ul(x.points));
      if (x.tech?.length) out.push(`<p>Tech: ${esc(x.tech.join(', '))}</p>`);
      out.push('</article>');
    }
    out.push('</section>');
  }

  if (c.projects?.length) {
    out.push('<section id="projects"><h2>Projects</h2>');
    for (const x of c.projects) {
      out.push(`<article><h3>${esc(x.title)}</h3>`);
      if (x.category) out.push(`<p>${esc(x.category)}</p>`);
      if (x.summary) out.push(`<p>${esc(x.summary)}</p>`);
      out.push(ul(x.points));
      if (x.tech?.length) out.push(`<p>Tech: ${esc(x.tech.join(', '))}</p>`);
      const links = [link(x.liveUrl, 'Live site'), link(x.repoUrl, 'Source code')].filter(Boolean);
      if (links.length) out.push(`<p>${links.join(' · ')}</p>`);
      out.push('</article>');
    }
    out.push('</section>');
  }

  if (c.services?.length) {
    out.push('<section id="services"><h2>Services</h2>');
    for (const x of c.services) out.push(`<article><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p></article>`);
    out.push('</section>');
  }

  if (c.skills?.length) {
    out.push('<section id="skills"><h2>Skills</h2>');
    for (const g of c.skills) out.push(`<h3>${esc(g.name)}</h3><p>${esc((g.skills || []).join(', '))}</p>`);
    out.push('</section>');
  }

  if (c.education?.length) {
    out.push('<section id="education"><h2>Education</h2>');
    for (const x of c.education) {
      out.push(`<article><h3>${esc([x.degree, x.school].filter(Boolean).join(' — '))}</h3><p>${esc([period(x), x.location].filter(Boolean).join(' · '))}</p>${ul(x.points)}</article>`);
    }
    out.push('</section>');
  }

  const contact = [
    p.email && `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`,
    p.location && esc(p.location),
    ...Object.entries(p.socials || {}).map(([k, u]) => link(u, label(k))),
    link(p.resumeUrl, 'Résumé'),
  ].filter(Boolean);
  if (contact.length) out.push(`<section id="contact"><h2>Contact</h2><p>${contact.join(' · ')}</p></section>`);

  out.push('</main>');
  // Shown only when JavaScript is off; crawlers read the text either way. React replaces it all on load.
  return `<div id="prerender">${out.join('')}</div>`;
}

/* ------------------------------------------------------------------ llms.txt */

export function renderLlmsTxt(c, site) {
  const p = c?.profile;
  if (!p) return `# Dhruv Mangroliya\n\n> Software Engineer & Full-Stack Developer.\n\nWebsite: ${site}\n`;
  const L = [];
  const list = (items) => (items || []).forEach((i) => L.push(`- ${i}`));
  L.push(`# ${p.name}`, '', `> ${[p.role, p.tagline].filter(Boolean).join(' — ')}`, '');
  if (p.intro) L.push(p.intro, '');
  L.push(`Website: ${site}`);
  if (p.email) L.push(`Email: ${p.email}`);
  if (p.location) L.push(`Location: ${p.location}`);
  for (const [k, u] of Object.entries(p.socials || {})) if (isUrl(u)) L.push(`${label(k)}: ${u}`);
  if (isUrl(p.resumeUrl)) L.push(`Résumé: ${p.resumeUrl}`);
  L.push('');
  if (p.about?.length) L.push('## About', '', ...p.about.flatMap((t) => [t, '']));
  if (c.experience?.length) {
    L.push('## Experience', '');
    for (const x of c.experience) {
      L.push(`### ${x.role} — ${x.company}`, [period(x), x.location].filter(Boolean).join(' · '));
      if (x.summary) L.push('', x.summary);
      list(x.points);
      if (x.tech?.length) L.push(`Tech: ${x.tech.join(', ')}`);
      L.push('');
    }
  }
  if (c.projects?.length) {
    L.push('## Projects', '');
    for (const x of c.projects) {
      L.push(`### ${x.title}${x.category ? ` (${x.category})` : ''}`);
      if (x.summary) L.push(x.summary);
      list(x.points);
      if (x.tech?.length) L.push(`Tech: ${x.tech.join(', ')}`);
      if (isUrl(x.liveUrl)) L.push(`Live: ${x.liveUrl}`);
      if (isUrl(x.repoUrl)) L.push(`Code: ${x.repoUrl}`);
      L.push('');
    }
  }
  if (c.services?.length) {
    L.push('## Services', '');
    c.services.forEach((x) => L.push(`- **${x.title}** — ${x.description || ''}`));
    L.push('');
  }
  if (c.skills?.length) {
    L.push('## Skills', '');
    c.skills.forEach((g) => L.push(`- **${g.name}:** ${(g.skills || []).join(', ')}`));
    L.push('');
  }
  if (c.education?.length) {
    L.push('## Education', '');
    for (const x of c.education) {
      L.push(`### ${[x.degree, x.school].filter(Boolean).join(' — ')}`, [period(x), x.location].filter(Boolean).join(' · '));
      list(x.points);
      L.push('');
    }
  }
  return L.join('\n').replace(/\n{3,}/g, '\n\n');
}

/* ------------------------------------------------------------------ robots / sitemap */

// Search engines and AI assistants are explicitly welcome; only the private dashboard and API are off-limits.
const BOTS = ['*', 'Googlebot', 'Bingbot', 'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended', 'CCBot'];

export function renderRobots(site) {
  const rules = BOTS.map((b) => `User-agent: ${b}\nAllow: /\nAllow: /api/v1/content\nAllow: /api/v1/media/\nDisallow: /admin\nDisallow: /api/\n`).join('\n');
  return `${rules}\nSitemap: ${site}sitemap.xml\n`;
}

export function renderSitemap(site, lastmod) {
  const urls = [site];
  const day = (lastmod || new Date()).toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${day}</lastmod></url>`).join('\n')}
</urlset>
`;
}
