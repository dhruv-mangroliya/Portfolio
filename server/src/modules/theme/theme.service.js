// The site's colour theme. Defaults to Black · White · Navy · Yellow until changed in the dashboard.
import { SiteSettings } from '../../models/index.js';

export const DEFAULT_THEME = Object.freeze({
  preset: 'navy-gold',
  colors: { background: '#ffffff', surface: '#ffffff', text: '#0a0a0a', primary: '#0f2c6b', accent: '#facc15', dark: '#0a0a0a' },
  gradient: ['#0f2c6b', '#1f4fa8'],
  palette: ['#0f2c6b', '#facc15', '#1c1c1c', '#2563eb', '#eab308', '#334155'],
});

export async function getTheme() {
  const settings = await SiteSettings.findOne({ key: 'main' }).lean();
  return settings?.theme?.colors?.primary ? stripIds(settings.theme) : structuredClone(DEFAULT_THEME);
}

export async function saveTheme(theme) {
  const doc = await SiteSettings.findOneAndUpdate(
    { key: 'main' },
    { $set: { theme } },
    { new: true, upsert: true, runValidators: true, lean: true }
  );
  return stripIds(doc.theme);
}

const stripIds = ({ preset, colors, gradient, palette }) => {
  const { _id, ...c } = colors ?? {};
  return { preset, colors: c, gradient, palette };
};
