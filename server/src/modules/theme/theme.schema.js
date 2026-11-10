import { z } from 'zod';

const zHex = z
  .string({ required_error: 'Colour is required.' })
  .trim()
  .regex(/^#[0-9a-f]{6}$/i, 'Use a 6-digit hex colour like #0f2c6b.')
  .transform((v) => v.toLowerCase());

export const themeSchema = z.object({
  preset: z.string().trim().max(40).default('custom'),
  colors: z.object({
    background: zHex,
    surface: zHex,
    text: zHex,
    primary: zHex,
    accent: zHex,
    dark: zHex,
  }),
  gradient: z.array(zHex).min(2, 'The gradient needs at least 2 colours.').max(3, 'At most 3 gradient colours.'),
  palette: z.array(zHex).length(6, 'Pick exactly 6 card colours.'),
});
