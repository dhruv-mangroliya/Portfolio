// First-run setup — idempotent, runs on every start:
//  • makes sure all indexes exist,
//  • on an empty database, inserts the starter content from seed-data.js (once; after that,
//    everything is edited in the admin dashboard and lives only in MongoDB).
import mongoose from 'mongoose';
import { logger } from '../config/logger.js';
import { Profile, Project, User } from '../models/index.js';
import { COLLECTIONS } from '../modules/collections/collections.registry.js';
import { markDbInitialised } from './connection.js';
import { DEFAULT_SEO } from '../modules/seo/seo.defaults.js';
import { seedContent } from './seed-data.js';

const log = logger.child({ module: 'bootstrap' });

async function seedIfEmpty() {
  if (await Profile.exists({})) return;
  log.info('Empty database — inserting starter content (edit it in the admin dashboard).');
  await Profile.create(seedContent.profile);
  for (const [key, { Model }] of Object.entries(COLLECTIONS)) {
    const items = seedContent[key] ?? [];
    if (items.length) await Model.insertMany(items.map((item, order) => ({ ...item, order })));
  }
}

/** Empty search title/description → fill in the defaults (search engines need something). */
async function ensureSeo() {
  for (const field of ['title', 'description']) {
    await Profile.updateOne(
      { key: 'main', [`seo.${field}`]: { $in: [null, ''] } },
      { $set: { [`seo.${field}`]: DEFAULT_SEO[field] } }
    );
  }
}

/** Projects used to have one `imageUrl`; it's now the first image of the `images` gallery. */
async function migrateProjectCovers() {
  const old = await Project.collection.find({ imageUrl: { $exists: true } }).toArray();
  for (const p of old) {
    const images = p.images?.length ? p.images : p.imageUrl ? [p.imageUrl] : [];
    await Project.collection.updateOne({ _id: p._id }, { $set: { images }, $unset: { imageUrl: '' } });
  }
  if (old.length) log.info(`Moved ${old.length} project cover image(s) into galleries`);
}

export async function bootstrapDb() {
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
  await seedIfEmpty();
  await ensureSeo();
  await migrateProjectCovers();
  if (!(await User.exists({}))) {
    log.warn('No admin user yet — create one with: npm run set-admin -- <username>');
  }
  markDbInitialised();
  log.info('Database ready');
}
