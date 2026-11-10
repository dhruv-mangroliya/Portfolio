// Contact-form enquiries.
import { Schema, model, str, toJSON } from './_shared.js';

const messageSchema = new Schema(
  {
    name: str({ required: true }),
    email: str({ required: true, lowercase: true }),
    subject: str(),
    message: str({ required: true }),
    read: { type: Boolean, default: false },
    meta: { ip: str(), userAgent: str() },
  },
  {
    timestamps: true,
    toJSON: {
      ...toJSON,
      transform: (doc, ret) => {
        toJSON.transform(doc, ret);
        delete ret.meta; // never exposed through the API
        return ret;
      },
    },
  }
);
messageSchema.index({ createdAt: -1 });
messageSchema.index({ read: 1, createdAt: -1 });

export const Message = model('Message', messageSchema);
