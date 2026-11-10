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

export function buildHeadTags(profile, content) {
  const title = profile?.seo?.title || DEFAULT_SEO.title;
  const description = profile?.seo?.description || DEFAULT_SEO.description;
  const site = config.siteUrl;
  const image = site && profile?.photo?.url ? new URL(profile.photo.url, site).href : '';
  const socials = Object.values(profile?.socials ?? {}).filter((u) => /^https?:\/\//.test(u));

  const name = profile?.name || 'Dhruv Mangroliya';
  const id = (frag) => `${site || '/'}#${frag}`;
  const person = {
    '@type': 'Person',
    '@id': id('person'),
    name,
    jobTitle: profile?.role || 'Software Engineer',
    description,
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Indian Institute of Technology Guwahati' },
    ...(profile?.email && { email: `mailto:${profile.email}` }),
    ...(profile?.location && { homeLocation: { '@type': 'Place', name: profile.location } }),
    ...(site && { url: site }),
    ...(image && { image }),
    ...(socials.length && { sameAs: socials }),
    ...(content?.skills?.length && { knowsAbout: content.skills.flatMap((g) => g.skills || []).slice(0, 40) }),
  };
  // The freelance side: what is offered, by whom, and how to get in touch.
  const services = content?.services ?? [];
  const business = {
    '@type': 'ProfessionalService',
    '@id': id('business'),
    name: `${name} — Software Development`,
    description,
    ...(site && { url: site, logo: `${site}favicon.svg` }),
    ...(image && { image }),
    founder: { '@id': id('person') },
    ...(profile?.email && {
      email: profile.email,
      contactPoint: { '@type': 'ContactPoint', contactType: 'sales', email: profile.email },
    }),
    ...(profile?.location && { address: { '@type': 'PostalAddress', addressLocality: profile.location.split(',')[0].trim(), addressCountry: 'IN' } }),
    areaServed: 'Worldwide',
    ...(socials.length && { sameAs: socials }),
    ...(services.length && {
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Services',
        itemListElement: services.map((s) => ({
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: s.title, description: s.description || undefined, provider: { '@id': id('person') } },
        })),
      },
    }),
  };
  const website = { '@type': 'WebSite', '@id': id('website'), name, ...(site && { url: site }), description, publisher: { '@id': id('person') }, inLanguage: 'en' };
  const projects = (content?.projects ?? []).map((p) => ({
    '@type': 'CreativeWork',
    name: p.title,
    ...(p.summary && { description: p.summary }),
    ...(/^https?:\/\//.test(p.liveUrl || '') && { url: p.liveUrl }),
    ...(p.tech?.length && { keywords: p.tech.join(', ') }),
    creator: { '@id': id('person') },
  }));
  const page = {
    '@type': 'ProfilePage',
    '@id': id('page'),
    name: title,
    ...(site && { url: site }),
    isPartOf: { '@id': id('website') },
    mainEntity: { '@id': id('person') },
    ...(projects.length && { hasPart: { '@type': 'ItemList', name: 'Projects', itemListElement: projects.map((item, i) => ({ '@type': 'ListItem', position: i + 1, item })) } }),
  };
  // JSON inside <script>: escape "<" so text can never close the tag.
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': [person, business, website, page] }).replace(/</g, '\\u003c');

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
    .replace(BLOCK, buildHeadTags(profile, content))
    .replace(
      '<div id="root"></div>',
      `<div id="root">${renderSnapshot(content)}</div>` +
        // Same data the site would fetch from /api/v1/content — saves a request, and crawlers never see a loading/error state.
        (content ? `\n    <script id="initial-content" type="application/json">${JSON.stringify(content).replace(/</g, '\\u003c')}</script>` : '')
    );
}
