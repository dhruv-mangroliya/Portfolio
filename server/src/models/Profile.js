// The single "about me" document (key: 'main').
import { Schema, model, str, strList, toJSON } from './_shared.js';

const profileSchema = new Schema(
  {
    key: { type: String, default: 'main', unique: true, immutable: true },
    name: str({ required: true }),
    role: str(),
    tagline: str(),
    intro: str(),
    about: strList,
    location: str(),
    email: str({ lowercase: true }),
    phone: str(),
    resumeUrl: str(),
    // Text shown by Google and in link previews
    seo: {
      title: str(),
      description: str(),
    },
    // Profile photo: the cropped image shown on the site + the original (kept so the crop can be changed later)
    photo: {
      url: str(),
      imageId: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
      originalId: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
      crop: {
        x: { type: Number, default: 0.5 },
        y: { type: Number, default: 0.5 },
        zoom: { type: Number, default: 1 },
      },
    },
    availability: {
      open: { type: Boolean, default: true },
      text: str(),
    },
    socials: {
      github: str(),
      linkedin: str(),
      twitter: str(),
      leetcode: str(),
      website: str(),
    },
  },
  {
    timestamps: true,
    toJSON: {
      ...toJSON,
      transform: (doc, ret) => {
        toJSON.transform(doc, ret);
        delete ret.key;
        return ret;
      },
    },
  }
);

export const Profile = model('Profile', profileSchema);
