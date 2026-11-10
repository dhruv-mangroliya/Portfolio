// Copies all data from the local MongoDB (LOCAL_MONGODB_URI) into MONGODB_URI (e.g. Atlas).
// Uses the driver directly (no mongodump), so it works across MongoDB versions, keeps _ids and
// binary images, and verifies document counts afterwards.
//   npm run copy-to-atlas            → refuses if the target already has data
//   npm run copy-to-atlas -- --force → replaces the target's matching collections
import mongoose from 'mongoose';

const source = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017/dhruv_site';
const target = process.env.MONGODB_URI;
const force = process.argv.includes('--force');
const redact = (uri) => uri.replace(/\/\/([^:@/]+):[^@]*@/, '//$1:***@');

if (!target || target === source) {
  console.error('✖ Set MONGODB_URI in .env to your Atlas connection string first.');
  process.exit(1);
}
console.log(`From: ${redact(source)}\nTo:   ${redact(target)}\n`);

let src, dst;
try {
  src = await mongoose.createConnection(source, { serverSelectionTimeoutMS: 10000 }).asPromise();
  dst = await mongoose.createConnection(target, { serverSelectionTimeoutMS: 10000 }).asPromise();

  const names = (await src.db.listCollections({ type: 'collection' }).toArray()).map((c) => c.name).sort();
  const targetHasData = (
    await Promise.all(names.map((n) => dst.db.collection(n).estimatedDocumentCount()))
  ).some((n) => n > 0);
  if (targetHasData && !force) {
    console.error('✖ The target already has data. Re-run with --force to replace it: npm run copy-to-atlas -- --force');
    process.exit(1);
  }

  let failed = false;
  for (const name of names) {
    const docs = await src.db.collection(name).find().toArray();
    const col = dst.db.collection(name);
    await col.deleteMany({});
    if (docs.length) await col.insertMany(docs, { ordered: true });
    const copied = await col.countDocuments();
    const ok = copied === docs.length;
    failed ||= !ok;
    console.log(`${ok ? '✔' : '✖'} ${name.padEnd(12)} ${copied}/${docs.length}`);
  }
  if (failed) throw new Error('Some collections did not copy completely.');
  console.log('\n✔ All data copied. Indexes are recreated automatically when the server starts.');
} catch (err) {
  console.error(`\n✖ ${err.message}`);
  process.exitCode = 1;
} finally {
  await src?.close();
  await dst?.close();
}
