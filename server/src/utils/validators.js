// Reusable Zod building blocks with human-friendly messages, plus `parse()` which turns
// a failed validation into a 400 VALIDATION_ERROR with per-field messages.
import { z } from 'zod';
import { ValidationFailed } from './errors.js';

export const ACCENTS = ['auto', 'violet', 'pink', 'orange', 'cyan', 'lime', 'blue'];

export function isSafeUrl(value) {
  if (!value) return true;
  if (value.startsWith('/')) return true; // site-relative link
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Optional text, defaults to "". */
export const zText = (max) => z.string().trim().max(max, `Must be at most ${max} characters.`).default('');

/** Required, non-empty text. */
export const zRequired = (max, label) =>
  z
    .string({ required_error: `${label} is required.`, invalid_type_error: `${label} must be text.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

export const zUrl = z
  .string()
  .trim()
  .max(500, 'Link is too long.')
  .refine(isSafeUrl, 'Must be a full link starting with https://')
  .default('');

export const zEmail = z.string().trim().toLowerCase().max(200).email('Enter a valid email address.');

/** List of short strings; blank entries are dropped. */
export const zList = (maxItems, maxLen, label = 'Each entry') =>
  z
    .array(z.string().trim().max(maxLen, `${label} must be at most ${maxLen} characters.`))
    .max(maxItems, `At most ${maxItems} entries.`)
    .default([])
    .transform((list) => list.filter(Boolean));

export const zBool = z.boolean({ invalid_type_error: 'Must be true or false.' });

export const zObjectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id.');

/** Validates `input` against `schema`; throws a 400 with field-level messages on failure. */
export function parse(schema, input) {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  throw ValidationFailed(Object.values(fields)[0] ?? 'Invalid data.', fields);
}
