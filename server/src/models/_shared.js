// Shared Mongoose helpers used by every model.
import mongoose from 'mongoose';

export const { Schema, model } = mongoose;

/** JSON output: `id` instead of `_id`, no `__v`. */
export const toJSON = {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
};

export const str = (extra = {}) => ({ type: String, trim: true, default: '', ...extra });
export const strList = { type: [{ type: String, trim: true }], default: [] };

/**
 * Schema for an orderable, hideable piece of site content (a project, an experience…).
 * Request validation lives in Zod (modules/collections/collections.schema.js); this is the storage shape.
 */
export function contentSchema(fields) {
  const schema = new Schema(
    { ...fields, hidden: { type: Boolean, default: false }, order: { type: Number, default: 0 } },
    { timestamps: true, toJSON }
  );
  schema.index({ hidden: 1, order: 1 });
  return schema;
}
