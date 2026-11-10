// Uploaded images (e.g. the profile photo), stored as binary in MongoDB.
import { Schema, model } from './_shared.js';

const mediaSchema = new Schema(
  {
    mime: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp'] },
    data: { type: Buffer, required: true },
    bytes: { type: Number, required: true },
    purpose: { type: String, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => ({ id: String(ret._id), mime: ret.mime, bytes: ret.bytes, url: `/api/v1/media/${ret._id}` }),
    },
  }
);

export const Media = model('Media', mediaSchema, 'media');
