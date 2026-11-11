// Theme engine: turns a small theme (6 base colours + gradient + 6 card colours) into the full set
// of CSS variables the site and dashboard use. Text colours are derived with WCAG contrast checks,
// so any combination the owner picks in the dashboard stays readable.

export const PRESETS = {
  'navy-gold': {
    label: 'Black · White · Navy · Yellow',
    colors: { background: '#ffffff', surface: '#ffffff', text: '#0a0a0a', primary: '#0f2c6b', accent: '#facc15', dark: '#0a0a0a' },
    gradient: ['#0f2c6b', '#1f4fa8'],
    palette: ['#0f2c6b', '#facc15', '#1c1c1c', '#2563eb', '#eab308', '#334155'],
  },
  vibrant: {
    label: 'Vibrant',
    colors: { background: '#fff8f1', surface: '#ffffff', text: '#170f2f', primary: '#7c3aed', accent: '#ec4899', dark: '#170f2f' },
    gradient: ['#7c3aed', '#ec4899', '#f97316'],
    palette: ['#7c3aed', '#ec4899', '#f97316', '#06b6d4', '#65a30d', '#3b82f6'],
  },
  midnight: {
    label: 'Midnight (dark)',
    colors: { background: '#0b1020', surface: '#131a30', text: '#e6e9f5', primary: '#3b82f6', accent: '#facc15', dark: '#05070f' },
    gradient: ['#2563eb', '#7c3aed'],
    palette: ['#3b82f6', '#facc15', '#8b5cf6', '#22d3ee', '#f472b6', '#34d399'],
  },
  forest: {
    label: 'Forest',
    colors: { background: '#f7f5ee', surface: '#ffffff', text: '#16201b', primary: '#166534', accent: '#f59e0b', dark: '#10201a' },
    gradient: ['#166534', '#15803d', '#65a30d'],
    palette: ['#166534', '#f59e0b', '#0f766e', '#65a30d', '#b45309', '#334155'],
  },
};

export const DEFAULT_THEME = { preset: 'navy-gold', ...structuredClone(PRESETS['navy-gold']) };
delete DEFAULT_THEME.label;

/* ---------------------------------------------------------------- colour maths */

const rgb = (h) => {
  let s = String(h).replace('#', '');
  if (s.length === 3) s = [...s].map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

/** Blend a → b; t = share of b (0–1). */
export const mix = (a, b, t) => {
  const A = rgb(a);
  const B = rgb(b);
  return hex(A.map((v, i) => v + (B[i] - v) * t));
};

const luminance = (c) => {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** White or near-black — whichever reads better on `bg`. */
export const readableOn = (bg) => (contrast(bg, '#ffffff') >= contrast(bg, '#0b0b0f') ? '#ffffff' : '#0b0b0f');

/** `color`, darkened/lightened just enough to reach `min` contrast against `bg`. */
export function inkFor(color, bg, min = 4.5) {
  if (contrast(color, bg) >= min) return color;
  const target = luminance(bg) > 0.35 ? '#000000' : '#ffffff';
  for (let t = 0.08; t <= 1; t += 0.08) {
    const c = mix(color, target, t);
    if (contrast(c, bg) >= min) return c;
  }
  return target;
}

/* ---------------------------------------------------------------- theme → CSS variables */

export function themeToVars(theme = DEFAULT_THEME) {
  const { background: bg, surface, text, primary, accent, dark } = theme.colors;
  const grad = theme.gradient?.length >= 2 ? theme.gradient : [primary, mix(primary, '#ffffff', 0.25)];
  const gradMid = grad.length === 3 ? grad[1] : mix(grad[0], grad[grad.length - 1], 0.5);
  const palette = theme.palette?.length === 6 ? theme.palette : PRESETS['navy-gold'].palette;
  const isDark = luminance(bg) < 0.2;

  const vars = {
    '--bg': bg,
    '--bg-2': mix(bg, text, 0.04),
    '--surface': surface,
    '--surface-2': mix(surface, text, 0.03),
    '--ink': text,
    '--ink-2': mix(text, bg, 0.28),
    '--ink-3': mix(text, bg, 0.48),

    '--primary': primary,
    '--primary-ink': inkFor(primary, surface),
    '--primary-soft': mix(primary, surface, 0.9),
    '--on-primary': readableOn(primary),
    '--accent': accent,
    '--accent-ink': inkFor(accent, surface),
    '--accent-soft': mix(accent, surface, 0.8),
    '--on-accent': readableOn(accent),

    '--dark': dark,
    '--on-dark': readableOn(dark),
    '--highlight': inkFor(accent, dark, 3), // accent colour used on dark panels

    '--grad': `linear-gradient(110deg, ${grad.join(', ')})`,
    '--grad-text': `linear-gradient(110deg, ${grad.map((c) => inkFor(c, bg, 3)).join(', ')})`,
    '--on-grad': readableOn(gradMid),
    '--grad-highlight': contrast(accent, gradMid) >= 2.2 ? accent : readableOn(gradMid),

    '--tint-1': mix(bg, primary, isDark ? 0.12 : 0.06),
    '--tint-2': mix(bg, accent, isDark ? 0.08 : 0.12),
    '--blob-1': mix(primary, bg, 0.5),
    '--blob-2': mix(accent, bg, 0.35),
    '--blob-3': mix(grad[grad.length - 1], bg, 0.5),
    '--blob-4': mix(palette[3], bg, 0.5),
    '--admin-bg': mix(bg, primary, isDark ? 0.06 : 0.035),
    '--focus': inkFor(primary, bg, 3),
    '--selection': mix(accent, bg, 0.45),
    'color-scheme': isDark ? 'dark' : 'light',
  };

  palette.forEach((c, i) => {
    const soft = mix(c, surface, 0.86);
    vars[`--p${i}`] = c;
    vars[`--p${i}-soft`] = soft;
    vars[`--p${i}-ink`] = inkFor(c, soft);
    vars[`--p${i}-on`] = readableOn(c);
    vars[`--p${i}-2`] = mix(c, '#ffffff', 0.45);
  });
  return vars;
}

/** Applies a theme to an element (default: the whole page) and remembers it for the next visit. */
/** Browser-tab icon in the theme's colours — same look as the "DM" logo in the navbar. */
export function faviconSvg(theme = DEFAULT_THEME, text = 'DM') {
  const primary = theme.colors?.primary || DEFAULT_THEME.colors.primary;
  const grad = theme.gradient?.length >= 2 ? theme.gradient : [primary, mix(primary, '#ffffff', 0.25)];
  const ink = themeToVars(theme)['--on-grad'];
  const stops = grad.map((c, i) => `<stop offset="${i / (grad.length - 1)}" stop-color="${c}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#g)"/><text x="32" y="42" font-family="Arial, sans-serif" font-size="26" font-weight="800" fill="${ink}" text-anchor="middle">${text}</text></svg>`;
}

export function applyTheme(theme, el = document.documentElement, { remember = el === document.documentElement } = {}) {
  const vars = themeToVars(theme);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  if (remember) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors.primary);
    const icon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
    if (icon) icon.href = `data:image/svg+xml,${encodeURIComponent(faviconSvg(theme))}`;
    try {
      localStorage.setItem('site-theme', JSON.stringify(theme));
    } catch {
      /* storage unavailable — fine */
    }
  }
}

/** Last theme seen in this browser (avoids a colour flash before content loads). */
export function rememberedTheme() {
  try {
    const t = JSON.parse(localStorage.getItem('site-theme'));
    return t?.colors ? t : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}
