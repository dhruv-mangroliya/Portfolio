// Admin users. `tokenVersion` is bumped to revoke every existing session (e.g. on password change).
import { Schema, model } from './_shared.js';

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => ({ id: String(ret._id), username: ret.username, lastLoginAt: ret.lastLoginAt }),
    },
  }
);

export const User = model('User', userSchema);
