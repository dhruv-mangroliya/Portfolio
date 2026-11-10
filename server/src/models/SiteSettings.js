// Site-wide settings (singleton, key: 'main'). Currently: the colour theme.
import { Schema, model } from './_shared.js';

const hex = { type: String, match: /^#[0-9a-f]{6}$/i };

const settingsSchema = new Schema(
  {
    key: { type: String, default: 'main', unique: true, immutable: true },
    theme: {
      preset: { type: String, default: 'navy-gold' },
      colors: {
        background: hex,
        surface: hex,
        text: hex,
        primary: hex,
        accent: hex,
        dark: hex,
      },
      gradient: [hex],
      palette: [hex],
    },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false, transform: (_d, ret) => ({ theme: ret.theme, updatedAt: ret.updatedAt }) },
  }
);

export const SiteSettings = model('SiteSettings', settingsSchema, 'settings');
