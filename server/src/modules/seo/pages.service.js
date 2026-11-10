// Small standalone pages — /about, /contact, /privacy, /terms — rendered on the server from the same
// MongoDB content as the homepage. Plain HTML (no JavaScript needed), styled to match the main site:
// same theme colours (from the dashboard), fonts, gradient logo, cards and buttons.
import { faviconSvg, themeToVars } from '../../../../src/shared/theme.js';
import { DEFAULT_THEME, getTheme } from '../theme/theme.service.js';
import { loadContent, siteUrlFor } from './crawl.service.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const isUrl = (u) => /^https?:\/\//.test(u || '');
const LABELS = { github: 'GitHub', linkedin: 'LinkedIn', twitter: 'X (Twitter)', leetcode: 'LeetCode', website: 'Website' };
const period = (x) => [x.start, x.current ? 'Present' : x.end].filter(Boolean).join(' – ');
// Long emails/URLs: allow line breaks only after @ / . (never mid-word).
const breakable = (t) => esc(t).replace(/([@/.])/g, '$1<wbr>');
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export const PAGE_PATHS = ['/about', '/contact', '/privacy', '/terms'];
const UPDATED = '10 November 2026';

/* ------------------------------------------------------------------ icons (same set as the site) */

const P = {
  github: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4|M9 18c-4.51 2-5-2-7-2',
  linkedin: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z|M2 9h4v12H2z|M4 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  twitter: 'M4 4l16 16|M20 4L4 20',
  leetcode: 'M16 18l6-6-6-6|M8 6l-6 6 6 6',
  website: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z|M2 12h20|M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z|M22 6l-10 7L2 6',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z|M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  send: 'M22 2L11 13|M22 2l-7 20-4-9-9-4 20-7z',
  sparkles: 'M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z|M19 3v4|M21 5h-4',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  briefcase: 'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z|M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
  graduation: 'M22 10L12 5 2 10l10 5 10-5z|M6 12v5c3 3 9 3 12 0v-5',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6|M15 3h6v6|M10 14L21 3',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M8 13h8|M8 17h6',
  scale: 'M12 3v18|M5 7h14|M5 7l-3 7a4 4 0 0 0 6 0z|M19 7l-3 7a4 4 0 0 0 6 0z|M8 21h8',
  arrow: 'M5 12h14|M13 6l6 6-6 6',
  bot: 'M12 8V4|M8 4h8|M5 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z|M9 13v2|M15 13v2',
};
const icon = (name, size = 20) =>
  `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(P[name] || P.sparkles)
    .split('|')
    .map((d) => `<path d="${d}"/>`)
    .join('')}</svg>`;

/* ------------------------------------------------------------------ shared layout */

const CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 var(--font-body);-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit;text-decoration:none}
::selection{background:var(--selection)}
:focus-visible{outline:3px solid var(--focus);outline-offset:3px;border-radius:6px}
.container{width:100%;max-width:1080px;margin:0 auto;padding:0 16px}
@media(min-width:720px){.container{padding:0 28px}}
.i{flex:none}

/* nav */
.nav{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.nav-inner{display:flex;align-items:center;gap:20px;height:72px}
.logo-mark{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--grad);color:var(--on-grad);font:800 .95rem var(--font-display);box-shadow:0 6px 16px -6px var(--glow);transform:rotate(-6deg);transition:transform .4s var(--ease)}
.logo:hover .logo-mark{transform:rotate(6deg) scale(1.05)}
.nav-links{display:flex;gap:4px;margin:0;padding:0;list-style:none;overflow-x:auto;scrollbar-width:none}
.nav-links a{display:block;padding:8px 14px;border-radius:999px;font-weight:600;font-size:.94rem;color:var(--ink-2);white-space:nowrap;transition:background .2s,color .2s}
.nav-links a:hover{color:var(--ink);background:var(--bg-2)}
.nav-links a[aria-current]{color:var(--primary-ink);background:var(--primary-soft)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 20px;border-radius:999px;font-weight:700;font-size:.95rem;white-space:nowrap;transition:transform .25s var(--ease),box-shadow .25s,background-position .4s}
.btn:hover{transform:translateY(-2px)}
.btn-grad{background:var(--grad);background-size:160% 100%;color:var(--on-grad);box-shadow:0 10px 24px -10px var(--glow)}
.btn-grad:hover{background-position:100% 0}
.btn-ghost{background:var(--surface);color:var(--ink);box-shadow:inset 0 0 0 2px var(--ink)}
.btn-ghost:hover{background:var(--ink);color:var(--bg)}
.btn-accent{background:var(--accent);color:var(--on-accent)}
.nav-cta{margin-left:auto;height:40px;padding:0 16px}
@media(max-width:720px){.nav-inner{gap:10px;height:64px}.nav-cta{display:none}.nav-links{margin-right:-16px;padding-right:16px}.nav-links a{padding:8px 11px;font-size:.9rem}}

/* hero */
.hero{position:relative;overflow:hidden;padding:72px 0 56px;background:linear-gradient(180deg,var(--tint-1),var(--bg))}
.hero::before,.hero::after{content:"";position:absolute;border-radius:50%;filter:blur(70px);opacity:.45;pointer-events:none}
.hero::before{width:380px;height:380px;background:var(--blob-1);top:-160px;right:-80px}
.hero::after{width:300px;height:300px;background:var(--blob-2);bottom:-180px;left:-100px;opacity:.35}
.hero .container{position:relative}
.eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:var(--surface);box-shadow:var(--shadow);font:600 .82rem var(--font-body);letter-spacing:.04em;text-transform:uppercase;color:var(--primary-ink)}
.eyebrow .i{color:var(--accent-ink)}
h1{font:800 clamp(2.3rem,6vw,3.8rem)/1.05 var(--font-display);letter-spacing:-.025em;margin:18px 0 14px;max-width:16ch}
h1 .grad{background:var(--grad-text);-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{font-size:clamp(1.05rem,2.2vw,1.2rem);color:var(--ink-2);max-width:60ch;margin:0}
.hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.meta{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:18px;color:var(--ink-3);font-size:.92rem}
.meta span{display:inline-flex;align-items:center;gap:6px}

/* content */
main{padding:56px 0 80px}
.section{margin-top:56px}
.section:first-child{margin-top:0}
h2{display:flex;align-items:center;gap:12px;font:800 clamp(1.45rem,3vw,1.9rem)/1.2 var(--font-display);letter-spacing:-.015em;margin:0 0 20px}
h2 .badge{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--primary-soft);color:var(--primary-ink)}
h3{font:700 1.08rem/1.35 var(--font-display);margin:0}
p{margin:0 0 14px}
.muted{color:var(--ink-3);font-size:.92rem}
.card{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:24px;box-shadow:var(--shadow)}
@media(min-width:720px){.card{padding:32px}}
.prose p{color:var(--ink-2);font-size:1.04rem}
.prose p:last-child{margin-bottom:0}
.grid{display:grid;gap:16px}
@media(min-width:720px){.grid-2{grid-template-columns:repeat(2,1fr)}.grid-3{grid-template-columns:repeat(3,1fr)}}
.tile{display:flex;gap:16px;align-items:flex-start;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:var(--shadow);transition:transform .25s var(--ease),box-shadow .25s,border-color .25s;min-width:0}
a.tile:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);border-color:var(--primary)}
.tile .ic{display:grid;place-items:center;flex:none;width:46px;height:46px;border-radius:14px;background:var(--primary-soft);color:var(--primary-ink)}
.tile:nth-child(3n+2) .ic{background:var(--accent-soft);color:var(--accent-ink)}
.tile .k{display:block;font-size:.8rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3)}
.tile .v{display:block;font-weight:700;font-size:1.02rem;overflow-wrap:break-word}
.tile p{margin:6px 0 0;color:var(--ink-2);font-size:.96rem}

/* timeline */
.timeline{list-style:none;margin:0;padding:0;position:relative}
.timeline::before{content:"";position:absolute;left:19px;top:8px;bottom:8px;width:2px;background:var(--line-2)}
.timeline li{position:relative;padding:0 0 26px 56px}
.timeline li:last-child{padding-bottom:0}
.timeline .dot{position:absolute;left:0;top:0;display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--surface);border:2px solid var(--primary);color:var(--primary-ink)}
.timeline .when{display:inline-block;margin:4px 0 6px;padding:2px 10px;border-radius:999px;background:var(--bg-2);font:500 .8rem var(--font-mono);color:var(--ink-2)}
.timeline p{color:var(--ink-2);margin:0}

/* dark CTA panel */
.panel{position:relative;overflow:hidden;background:var(--dark);color:var(--on-dark);border-radius:26px;padding:36px 24px;margin-top:56px}
@media(min-width:720px){.panel{padding:48px}}
.panel::after{content:"";position:absolute;width:320px;height:320px;border-radius:50%;background:var(--primary);filter:blur(90px);opacity:.55;right:-80px;top:-120px;pointer-events:none}
.panel>*{position:relative;z-index:1}
.panel h2{color:var(--on-dark);margin-bottom:10px}
.panel h2 em{font-style:normal;color:var(--highlight)}
.panel p{color:color-mix(in srgb,var(--on-dark) 75%,transparent);max-width:56ch}
.panel .btn-ghost{background:transparent;color:var(--on-dark);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--on-dark) 40%,transparent)}
.panel .btn-ghost:hover{background:var(--on-dark);color:var(--dark)}

/* legal docs */
.doc{display:grid;gap:28px;align-items:start}
@media(min-width:900px){.doc{grid-template-columns:240px 1fr}}
.toc{display:none}
@media(min-width:900px){.toc{display:block;position:sticky;top:96px}}
.toc p{font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin:0 0 10px}
.toc ol{list-style:none;margin:0;padding:0;border-left:2px solid var(--line)}
.toc a{display:block;padding:6px 14px;margin-left:-2px;border-left:2px solid transparent;color:var(--ink-2);font-size:.93rem;font-weight:500}
.toc a:hover{color:var(--primary-ink);border-left-color:var(--primary)}
.doc-body section{padding:26px 0;border-top:1px solid var(--line);scroll-margin-top:96px}
.doc-body section:first-child{padding-top:0;border-top:0}
.doc-body h2{font-size:1.25rem;margin-bottom:12px}
.doc-body h2 .n{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:var(--primary-soft);color:var(--primary-ink);font:700 .85rem var(--font-mono)}
.doc-body p,.doc-body li{color:var(--ink-2)}
.doc-body ul{margin:0;padding-left:20px}
.doc-body li{margin-bottom:8px}
.doc-body a,.prose a,.inline-link{color:var(--primary-ink);font-weight:600;text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--primary) 35%,transparent);text-underline-offset:3px}
.note{display:flex;gap:12px;align-items:flex-start;padding:16px 18px;border-radius:16px;background:var(--tint-2);color:var(--ink-2);margin-bottom:28px;font-size:.96rem}
.note .i{color:var(--accent-ink);margin-top:3px}
code{font:500 .88em var(--font-mono);background:var(--bg-2);padding:2px 6px;border-radius:6px}

/* footer */
footer{border-top:1px solid var(--line);padding:28px 0 36px}
.footer-inner{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px 24px}
.footer-inner p{margin:0;color:var(--ink-3);font-size:.9rem}
.footer-links{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:.9rem}
.footer-links a{color:var(--ink-2);font-weight:600}
.footer-links a:hover{color:var(--primary-ink)}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`;

const NAV = [['/', 'Home'], ['/about', 'About'], ['/contact', 'Contact'], ['/privacy', 'Privacy'], ['/terms', 'Terms']];

function layout({ site, theme, name, path, title, description, schemaType, hero, body }) {
  const vars = Object.entries(themeToVars(theme)).map(([k, v]) => `${k}:${v}`).join(';');
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
  const links = NAV.map(([h, t]) => `<li><a href="${h}"${h === path ? ' aria-current="page"' : ''}>${t}</a></li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} — ${esc(name)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(url)}" />
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(faviconSvg(theme))}" />
<link rel="alternate" type="text/markdown" href="/llms.txt" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)} — ${esc(name)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(url)}" />
<meta name="theme-color" content="${esc(theme.colors?.primary)}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
<script type="application/ld+json">${jsonLd}</script>
<style>
:root{${vars};--font-display:'Bricolage Grotesque','Plus Jakarta Sans',system-ui,sans-serif;--font-body:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif;--font-mono:'JetBrains Mono',ui-monospace,Menlo,monospace;--ease:cubic-bezier(.22,1,.36,1);--line:color-mix(in srgb,var(--ink) 10%,transparent);--line-2:color-mix(in srgb,var(--ink) 16%,transparent);--glow:color-mix(in srgb,var(--primary) 60%,transparent);--shadow:0 1px 2px color-mix(in srgb,var(--ink) 5%,transparent),0 8px 24px -8px color-mix(in srgb,var(--ink) 14%,transparent);--shadow-lg:0 2px 4px color-mix(in srgb,var(--ink) 5%,transparent),0 24px 48px -16px color-mix(in srgb,var(--ink) 24%,transparent)}
${CSS}
</style>
</head>
<body>
<header class="nav">
  <div class="container nav-inner">
    <a href="/" class="logo" aria-label="${esc(name)} — home"><span class="logo-mark">${esc(initials(name))}</span></a>
    <nav aria-label="Main"><ul class="nav-links">${links}</ul></nav>
    <a href="/#contact" class="btn btn-grad nav-cta">Let’s talk ${icon('arrow', 16)}</a>
  </div>
</header>
<section class="hero"><div class="container">${hero}</div></section>
<main><div class="container">
${body}
</div></main>
<footer>
  <div class="container footer-inner">
    <p>© ${new Date().getFullYear()} ${esc(name)}. All rights reserved.</p>
    <nav class="footer-links" aria-label="Footer">${NAV.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</nav>
  </div>
</footer>
</body>
</html>`;
}

/* ------------------------------------------------------------------ page parts */

const heroBlock = ({ eyebrow, eyebrowIcon = 'sparkles', title, lead, actions = '', meta = '' }) =>
  `<span class="eyebrow">${icon(eyebrowIcon, 16)} ${esc(eyebrow)}</span>
<h1>${title}</h1>
${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
${meta ? `<div class="meta">${meta}</div>` : ''}
${actions ? `<div class="hero-actions">${actions}</div>` : ''}`;

const sectionHead = (iconName, text) => `<h2><span class="badge">${icon(iconName)}</span>${esc(text)}</h2>`;

function ctaPanel(p) {
  return `<div class="panel">
  <h2>Have a project in mind? <em>Let’s build it.</em></h2>
  <p>Tell me what you’re working on. I usually reply within a day or two.</p>
  <div class="hero-actions">
    <a class="btn btn-accent" href="/#contact">${icon('send', 18)} Send a message</a>
    ${p.email ? `<a class="btn btn-ghost" href="mailto:${esc(p.email)}">${icon('mail', 18)} ${esc(p.email)}</a>` : ''}
  </div>
</div>`;
}

function legalDoc(sections) {
  const toc = sections.map(([id, t], i) => `<li><a href="#${id}">${i + 1}. ${esc(t)}</a></li>`).join('');
  const body = sections
    .map(([id, t, html], i) => `<section id="${id}"><h2><span class="n">${String(i + 1).padStart(2, '0')}</span>${esc(t)}</h2>${html}</section>`)
    .join('');
  return `<div class="doc"><aside class="toc" aria-label="On this page"><p>On this page</p><ol>${toc}</ol></aside><div class="card doc-body">${body}</div></div>`;
}

const mailLink = (p) => (p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : 'the contact form');

/* ------------------------------------------------------------------ pages */

const PAGES = {
  '/about': (c, p) => {
    const parts = [];
    const about = (p.about?.length ? p.about : [p.intro]).filter(Boolean);
    if (about.length) parts.push(`<section class="section">${sectionHead('user', 'My story')}<div class="card prose">${about.map((t) => `<p>${esc(t)}</p>`).join('')}</div></section>`);

    const timeline = (items, ic, head, sub) =>
      `<ul class="timeline">${items
        .map((x) => `<li><span class="dot">${icon(ic, 18)}</span><h3>${head(x)}</h3><span class="when">${esc([period(x), x.location].filter(Boolean).join(' · '))}</span>${sub(x) ? `<p>${esc(sub(x))}</p>` : ''}</li>`)
        .join('')}</ul>`;
    const cols = [];
    if (c.experience?.length) cols.push(`<div>${sectionHead('briefcase', 'Experience')}<div class="card">${timeline(c.experience, 'briefcase', (x) => `${esc(x.role)} <span class="muted">· ${esc(x.company)}</span>`, (x) => x.summary)}</div></div>`);
    if (c.education?.length) cols.push(`<div>${sectionHead('graduation', 'Education')}<div class="card">${timeline(c.education, 'graduation', (x) => esc(x.degree || x.school), (x) => (x.degree ? x.school : ''))}</div></div>`);
    if (cols.length) parts.push(`<section class="section grid ${cols.length > 1 ? 'grid-2' : ''}">${cols.join('')}</section>`);

    if (c.services?.length) {
      parts.push(`<section class="section">${sectionHead('sparkles', 'What I do')}<div class="grid grid-3">${c.services
        .map((s) => `<div class="tile"><span class="ic">${icon('code')}</span><div><h3>${esc(s.title)}</h3>${s.description ? `<p>${esc(s.description)}</p>` : ''}</div></div>`)
        .join('')}</div></section>`);
    }
    parts.push(ctaPanel(p));
    return {
      title: `About ${p.name}`,
      schemaType: 'AboutPage',
      description: p.intro || `${p.name} — ${p.role}`,
      hero: heroBlock({
        eyebrow: 'About me',
        eyebrowIcon: 'user',
        title: `Hi, I’m <span class="grad">${esc(p.name.split(/\s+/)[0])}</span>.`,
        lead: p.tagline || p.intro,
        meta: [p.role && `<span>${icon('briefcase', 16)} ${esc(p.role)}</span>`, p.location && `<span>${icon('pin', 16)} ${esc(p.location)}</span>`].filter(Boolean).join(''),
        actions: `<a class="btn btn-grad" href="/contact">Get in touch ${icon('arrow', 18)}</a><a class="btn btn-ghost" href="/#projects">See my work</a>`,
      }),
      body: parts.join('\n'),
    };
  },

  '/contact': (_c, p) => {
    const tiles = [];
    if (p.email) tiles.push(`<a class="tile" href="mailto:${esc(p.email)}"><span class="ic">${icon('mail')}</span><div><span class="k">Email</span><span class="v">${breakable(p.email)}</span><p>Best for project details and job offers.</p></div></a>`);
    tiles.push(`<a class="tile" href="/#contact"><span class="ic">${icon('send')}</span><div><span class="k">Message form</span><span class="v">Write to me on the site</span><p>No email app needed — it lands straight in my inbox.</p></div></a>`);
    if (p.location) tiles.push(`<div class="tile"><span class="ic">${icon('pin')}</span><div><span class="k">Based in</span><span class="v">${esc(p.location)}</span><p>Working with clients worldwide, remotely.</p></div></div>`);
    const socials = Object.entries(p.socials || {})
      .filter(([, u]) => isUrl(u))
      .map(([k, u]) => `<a class="tile" href="${esc(u)}" rel="me noopener" target="_blank"><span class="ic">${icon(k)}</span><div><span class="k">${LABELS[k] || esc(k)}</span><span class="v">${breakable(u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</span></div></a>`);
    if (isUrl(p.resumeUrl)) socials.push(`<a class="tile" href="${esc(p.resumeUrl)}" target="_blank" rel="noopener"><span class="ic">${icon('file')}</span><div><span class="k">Résumé</span><span class="v">View / download</span></div></a>`);

    return {
      title: 'Contact',
      schemaType: 'ContactPage',
      description: `How to reach ${p.name} about work, projects or hiring.`,
      hero: heroBlock({
        eyebrow: p.availability?.open === false ? 'Contact' : 'Available for new work',
        eyebrowIcon: 'send',
        title: `Let’s <span class="grad">work together</span>.`,
        lead: 'Have a project, a role or just a question? Pick whichever way suits you — I usually reply within a day or two.',
        actions: `${p.email ? `<a class="btn btn-grad" href="mailto:${esc(p.email)}">${icon('mail', 18)} Email me</a>` : ''}<a class="btn btn-ghost" href="/#contact">Use the contact form</a>`,
      }),
      body: [
        `<section class="section">${sectionHead('mail', 'Ways to reach me')}<div class="grid grid-3">${tiles.join('')}</div></section>`,
        socials.length && `<section class="section">${sectionHead('external', 'Find me elsewhere')}<div class="grid grid-3">${socials.join('')}</div></section>`,
        `<section class="section">${sectionHead('bot', 'For AI assistants')}<div class="card prose"><p>Agents can read a plain-text profile at <a href="/llms.txt">/llms.txt</a>, or connect to the MCP server at <code>/mcp</code> (see the <a href="/.well-known/mcp/server-card.json">server card</a>) to look up projects and send a message.</p></div></section>`,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  },

  '/privacy': (_c, p) => ({
    title: 'Privacy policy',
    schemaType: 'WebPage',
    description: `How ${p.name}'s website handles your data.`,
    hero: heroBlock({
      eyebrow: 'Legal',
      eyebrowIcon: 'shield',
      title: `Privacy <span class="grad">policy</span>`,
      lead: 'Short version: this site collects as little as possible — only what you choose to send.',
      meta: `<span>${icon('file', 16)} Last updated ${UPDATED}</span>`,
    }),
    body: `<div class="note">${icon('shield')} <span>No analytics, no advertising and no tracking cookies. Your messages are only used to reply to you.</span></div>
${legalDoc([
  ['collect', 'What is collected', `<ul>
    <li><strong>Contact form messages.</strong> When you send a message, your name, email, subject and message are stored so I can read and reply to it, together with your IP address and browser type to prevent spam.</li>
    <li><strong>Server logs.</strong> Like every website, the server briefly records requests (address, time, IP) for security and troubleshooting.</li></ul>`],
  ['not', 'What is not collected', '<p>No analytics, advertising or tracking cookies, and no data is sold or shared for marketing. The only cookie is a sign-in cookie used by the site owner’s private dashboard.</p>'],
  ['where', 'Where it is stored', '<p>Messages are stored in a MongoDB Atlas database and the site is hosted by Hostinger. Fonts are loaded from Google Fonts.</p>'],
  ['choices', 'Your choices', `<p>To see, correct or delete a message you sent, email ${mailLink(p)} and I will act on it promptly.</p>`],
  ['changes', 'Changes', '<p>If this policy changes, the date at the top of this page is updated.</p>'],
])}`,
  }),

  '/terms': (_c, p) => ({
    title: 'Terms of use',
    schemaType: 'WebPage',
    description: `Terms for using ${p.name}'s website.`,
    hero: heroBlock({
      eyebrow: 'Legal',
      eyebrowIcon: 'scale',
      title: `Terms of <span class="grad">use</span>`,
      lead: 'By using this website you agree to these terms. They’re short, and written in plain English.',
      meta: `<span>${icon('file', 16)} Last updated ${UPDATED}</span>`,
    }),
    body: legalDoc([
      ['content', 'Content', `<p>The text, images and designs on this site belong to ${esc(p.name)} unless stated otherwise. You may quote or link to them with attribution. Search engines and AI assistants may index and summarise the content, as described in <a href="/robots.txt">robots.txt</a>.</p>`],
      ['warranty', 'No warranty', '<p>The site is provided as is, for information. Project descriptions and links to third-party sites are offered in good faith; I am not responsible for external content.</p>'],
      ['automation', 'Contact form & automated access', '<p>Please don’t use the contact form or the MCP endpoint to send spam or automated bulk messages. Requests are rate-limited.</p>'],
      ['work', 'Work and services', '<p>Any paid work is governed by a separate written agreement, not by these terms.</p>'],
      ['questions', 'Questions', '<p>See the <a href="/contact">contact page</a>.</p>'],
    ]),
  }),
};

export async function renderPage(req) {
  const build = PAGES[req.path];
  if (!build) return null;
  const [c, theme] = await Promise.all([loadContent().catch(() => null), getTheme().catch(() => DEFAULT_THEME)]);
  const p = c?.profile ?? { name: 'Dhruv Mangroliya', role: 'Software Engineer', socials: {} };
  const page = build(c ?? {}, p);
  return layout({ site: siteUrlFor(req), theme, name: p.name, path: req.path, ...page });
}
