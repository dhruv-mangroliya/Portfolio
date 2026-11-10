// Server-side <head> tags for search engines and link previews. In production the SPA's index.html
// is served with these injected, so crawlers see the right title/description without running JS.
import { config } from '../../config/env.js';
import { isDbReady } from '../../db/connection.js';
import { Profile } from '../../models/index.js';
import { renderSnapshot } from './crawl.service.js';
import { DEFAULT_SEO } from './seo.defaults.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const BLOCK = /<!-- seo:start -->[\s\S]*?<!-- seo:end -->/;

export function buildHeadTags(profile) {
  const title = profile?.seo?.title || DEFAULT_SEO.title;
  const description = profile?.seo?.description || DEFAULT_SEO.description;
  const site = config.siteUrl;
  const image = site && profile?.photo?.url ? new URL(profile.photo.url, site).href : '';
  const socials = Object.values(profile?.socials ?? {}).filter((u) => /^https?:\/\//.test(u));

  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile?.name || 'Dhruv Mangroliya',
    jobTitle: profile?.role || 'Software Engineer',
    description,
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Indian Institute of Technology Guwahati' },
    ...(site && { url: site }),
    ...(image && { image }),
    ...(socials.length && { sameAs: socials }),
  };
  // JSON inside <script>: escape "<" so text can never close the tag.
  const jsonLd = JSON.stringify(person).replace(/</g, '\\u003c');

  return [
    '<!-- seo:start -->',
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    ...(site ? [`<link rel="canonical" href="${esc(site)}" />`, `<meta property="og:url" content="${esc(site)}" />`] : []),
    ...(image ? [`<meta property="og:image" content="${esc(image)}" />`] : []),
    `<script type="application/ld+json">${jsonLd}</script>`,
    '<!-- seo:end -->',
  ].join('\n    ');
}

/** index.html with up-to-date SEO tags (falls back to the built-in defaults if the DB isn't ready). */
export async function renderIndexHtml(template, content) {
  const profile = isDbReady() ? await Profile.findOne({ key: 'main' }).lean() : null;
  return template
    .replace(BLOCK, buildHeadTags(profile))
    .replace('<div id="root"></div>', `<div id="root">${renderSnapshot(content)}</div>`);
}
