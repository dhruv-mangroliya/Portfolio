// SDE-2 prep: a YouTube playlist or channel followed lesson by lesson (L-1 … L-X).
import { Schema, model, str, toJSON } from './_shared.js';

const video = new Schema({ videoId: String, title: String, duration: String }, { _id: false });

const schema = new Schema(
  {
    title: str({ maxlength: 160 }),
    url: str({ maxlength: 500 }), // what was pasted
    kind: { type: String, enum: ['playlist', 'channel', 'manual'], default: 'playlist' },
    sourceId: str({ maxlength: 80 }), // playlist id (a channel uses its uploads playlist)
    channel: str({ maxlength: 120 }), // owner name, when known
    total: { type: Number, required: true, min: 1, max: 5000 }, // X — how many lessons to track
    skip: { type: Number, default: 0, min: 0, max: 5000 }, // L-1 starts at video #(skip+1)
    videos: { type: [video], default: [] }, // in lesson order (oldest first for channels)
    done: { type: [Number], default: [] }, // finished lesson numbers (1-based)
    order: { type: Number, default: 0 },
    fetchedAt: Date,
  },
  { timestamps: true, toJSON }
);

export const StudyTrack = model('StudyTrack', schema);
