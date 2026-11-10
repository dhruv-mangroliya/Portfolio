export const ACCENTS = ['violet', 'pink', 'orange', 'cyan', 'lime', 'blue'];

/** Accent colour for the i-th item; an explicit item.accent (other than 'auto') wins. */
export const accentFor = (item, i) => (item?.accent && item.accent !== 'auto' ? item.accent : ACCENTS[i % ACCENTS.length]);

/** Only allow http(s)/mailto/tel/relative links to be rendered as hrefs. */
export function safeUrl(url) {
  if (!url) return '';
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const u = new URL(url);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol) ? url : '';
  } catch {
    return '';
  }
}

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export const cx = (...c) => c.filter(Boolean).join(' ');

export function timeAgo(date) {
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  const units = [
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.35, 'week'],
    [12, 'month'],
    [Infinity, 'year'],
  ];
  let v = s / 60;
  for (const [step, unit] of units) {
    if (v < step) return `${Math.floor(v)} ${unit}${Math.floor(v) === 1 ? '' : 's'} ago`;
    v /= step;
  }
  return '';
}
