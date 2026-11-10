// API integration tests against a real, throwaway MongoDB database.
//   npm test   (uses TEST_MONGODB_URI, default mongodb://127.0.0.1:27017/dhruv_site_test)
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { bootstrapDb } from '../src/db/bootstrap.js';
import { connectDb, disconnectDb } from '../src/db/connection.js';
import { User } from '../src/models/index.js';
import { hashPassword } from '../src/utils/password.js';
import { DEFAULT_SEO } from '../src/modules/seo/seo.defaults.js';
import { buildHeadTags, renderIndexHtml } from '../src/modules/seo/seo.service.js';

const TEST_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/dhruv_site_test';
const PASSWORD = 'correct-horse-battery';
const app = createApp();

/** Returns a supertest agent that keeps cookies, already signed in. */
async function signedIn(password = PASSWORD) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ username: 'tester', password }).expect(200);
  return agent;
}

before(async () => {
  const dbName = new URL(TEST_URI.replace(/^mongodb(\+srv)?:/, 'http:')).pathname.slice(1);
  if (!/test/i.test(dbName)) throw new Error(`Refusing to run tests against non-test database "${dbName}".`);
  await connectDb({ uri: TEST_URI, retry: false });
  await mongoose.connection.dropDatabase();
  await bootstrapDb();
  await User.create({ username: 'tester', passwordHash: await hashPassword(PASSWORD) });
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
});

describe('health & errors', () => {
  test('health reports the database as up', async () => {
    const res = await request(app).get('/api/v1/health').expect(200);
    assert.equal(res.body.db, 'up');
    assert.ok(res.headers['x-request-id']);
    await request(app).get('/api/v1/health/ready').expect(200);
  });

  test('unknown routes return the standard error shape', async () => {
    const res = await request(app).get('/api/v1/nope').expect(404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
    assert.ok(res.body.error.requestId);
  });

  test('malformed JSON is a 400, not a 500', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username":')
      .expect(400);
    assert.equal(res.body.error.code, 'BAD_REQUEST');
  });
});

describe('public content', () => {
  test('returns the seeded profile and collections without internal fields', async () => {
    const res = await request(app).get('/api/v1/content').expect(200);
    assert.equal(res.body.profile.name, 'Dhruv Mangroliya');
    assert.ok(res.body.experience.length >= 1);
    assert.ok(res.body.projects.length >= 1);
    const p = res.body.projects[0];
    assert.ok(p.id);
    for (const k of ['_id', 'hidden', 'order', '__v', 'createdAt']) assert.equal(p[k], undefined, k);
  });
});

describe('auth', () => {
  test('wrong password is rejected', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: 'tester', password: 'nope' }).expect(401);
    assert.equal(res.body.error.message, 'Incorrect username or password.');
  });

  test('missing fields give friendly validation messages', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({}).expect(400);
    assert.equal(res.body.error.fields.username, 'Username is required.');
    assert.equal(res.body.error.fields.password, 'Password is required.');
  });

  test('admin routes require a session', async () => {
    await request(app).get('/api/v1/admin/dashboard').expect(401);
    await request(app).get('/api/v1/auth/me').expect(401);
  });

  test('login sets an httpOnly cookie and /me returns the user', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: 'TESTER', password: PASSWORD }).expect(200);
    const cookie = res.headers['set-cookie'][0];
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.equal(res.body.user.passwordHash, undefined);
    const agent = await signedIn();
    const me = await agent.get('/api/v1/auth/me').expect(200);
    assert.equal(me.body.user.username, 'tester');
  });
});

describe('collections', () => {
  test('full lifecycle: create → hidden from public → publish → reorder → delete', async () => {
    const agent = await signedIn();
    const base = '/api/v1/admin/collections/projects';

    const created = await agent
      .post(base)
      .send({ title: '  Weight Tracker ', summary: 'Charts for my weight.', tech: ['React', ''], hidden: true })
      .expect(201);
    const item = created.body.item;
    assert.equal(item.title, 'Weight Tracker');
    assert.deepEqual(item.tech, ['React']);
    assert.equal(item.accent, 'auto');

    // New items go to the top of the list
    const { body: listed } = await agent.get(base).expect(200);
    assert.equal(listed.items[0].id, item.id);

    let pub = await request(app).get('/api/v1/content');
    assert.ok(!pub.body.projects.some((p) => p.id === item.id), 'hidden item must not be public');

    const patched = await agent.patch(`${base}/${item.id}`).send({ hidden: false }).expect(200);
    assert.equal(patched.body.item.title, 'Weight Tracker', 'PATCH must not reset other fields');
    pub = await request(app).get('/api/v1/content');
    assert.ok(pub.body.projects.some((p) => p.id === item.id));

    const ids = listed.items.map((i) => i.id).reverse();
    const reordered = await agent.put(`${base}/order`).send({ ids }).expect(200);
    assert.deepEqual(reordered.body.items.map((i) => i.id), ids);
    await agent.put(`${base}/order`).send({ ids: ids.slice(1) }).expect(400);

    await agent.delete(`${base}/${item.id}`).expect(204);
    await agent.get(`${base}/${item.id}`).expect(404);
  });

  test('validation errors are reported per field', async () => {
    const agent = await signedIn();
    const res = await agent
      .post('/api/v1/admin/collections/experience')
      .send({ company: 'Acme', companyUrl: 'javascript:alert(1)' })
      .expect(400);
    assert.equal(res.body.error.fields.role, 'Role is required.');
    assert.equal(res.body.error.fields.start, 'Start date is required.');
    assert.ok(res.body.error.fields.companyUrl);
  });

  test('unknown collection and bad id', async () => {
    const agent = await signedIn();
    await agent.get('/api/v1/admin/collections/unicorns').expect(404);
    await agent.get('/api/v1/admin/collections/projects/not-an-id').expect(400);
  });
});

describe('profile', () => {
  test('update profile', async () => {
    const agent = await signedIn();
    const { body } = await agent.get('/api/v1/admin/profile').expect(200);
    const res = await agent
      .put('/api/v1/admin/profile')
      .send({ ...body.profile, tagline: 'New tagline', email: 'Me@Example.com' })
      .expect(200);
    assert.equal(res.body.profile.tagline, 'New tagline');
    assert.equal(res.body.profile.email, 'me@example.com');
    await agent.put('/api/v1/admin/profile').send({ ...body.profile, name: '' }).expect(400);
  });
});

describe('contact & inbox', () => {
  test('visitor message appears in the admin inbox', async () => {
    await request(app)
      .post('/api/v1/contact')
      .send({ name: 'Asha', email: 'asha@example.com', message: 'Can you build me a dashboard?' })
      .expect(201);
    await request(app)
      .post('/api/v1/contact')
      .send({ name: 'Bot', email: 'b@example.com', message: 'spam spam spam', website: 'http://x' })
      .expect(400);

    const agent = await signedIn();
    const { body } = await agent.get('/api/v1/admin/messages?status=unread').expect(200);
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].meta, undefined, 'visitor IP must not be exposed');
    const id = body.items[0].id;

    const read = await agent.patch(`/api/v1/admin/messages/${id}`).send({ read: true }).expect(200);
    assert.equal(read.body.message.read, true);

    const dash = await agent.get('/api/v1/admin/dashboard').expect(200);
    assert.equal(dash.body.messages.unread, 0);
    assert.ok(dash.body.counts.projects.total >= 1);

    await agent.delete(`/api/v1/admin/messages/${id}`).expect(204);
  });
});

describe('password change', () => {
  test('revokes other sessions but keeps the current one', async () => {
    const a = await signedIn();
    const b = await signedIn();
    await a
      .put('/api/v1/auth/password')
      .send({ currentPassword: 'wrong-password', newPassword: 'another-long-password' })
      .expect(400);
    await a
      .put('/api/v1/auth/password')
      .send({ currentPassword: PASSWORD, newPassword: 'another-long-password' })
      .expect(204);
    await a.get('/api/v1/auth/me').expect(200);
    await b.get('/api/v1/auth/me').expect(401);
    const c = await signedIn('another-long-password');
    // restore the original password so later tests can sign in
    await c.put('/api/v1/auth/password').send({ currentPassword: 'another-long-password', newPassword: PASSWORD }).expect(204);
  });
});

describe('profile photo', () => {
  // 1×1 PNG
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const crop = { x: 0.5, y: 0.4, zoom: 1.5 };

  test('upload → served publicly → re-crop → remove', async () => {
    const agent = await signedIn();
    await request(app).put('/api/v1/admin/profile/photo').send({ image: PNG, original: PNG, crop }).expect(401);

    // re-cropping before any upload is refused
    await agent.put('/api/v1/admin/profile/photo').send({ image: PNG, crop }).expect(400);

    const up = await agent.put('/api/v1/admin/profile/photo').send({ image: PNG, original: PNG, crop }).expect(200);
    const { photo } = up.body.profile;
    assert.match(photo.url, /^\/api\/v1\/media\/[a-f\d]{24}$/);
    assert.deepEqual(photo.crop, crop);

    const img = await request(app).get(photo.url).expect(200);
    assert.equal(img.headers['content-type'], 'image/png');
    assert.match(img.headers['cache-control'], /immutable/);

    const pub = await request(app).get('/api/v1/content').expect(200);
    assert.equal(pub.body.profile.photoUrl, photo.url);
    assert.equal(pub.body.profile.photo, undefined, 'internal photo ids are not public');

    // change only the crop: new image, same original, old image deleted
    const re = await agent.put('/api/v1/admin/profile/photo').send({ image: PNG, crop: { ...crop, zoom: 2 } }).expect(200);
    assert.equal(re.body.profile.photo.originalId, photo.originalId);
    assert.notEqual(re.body.profile.photo.url, photo.url);
    await request(app).get(photo.url).expect(404);

    await agent.delete('/api/v1/admin/profile/photo').expect(200);
    await request(app).get(re.body.profile.photo.url).expect(404);
    const after = await request(app).get('/api/v1/content');
    assert.equal(after.body.profile.photoUrl, '');
  });

  test('rejects files that are not really images', async () => {
    const agent = await signedIn();
    const fake = `data:image/png;base64,${Buffer.from('<script>alert(1)</script> not a png').toString('base64')}`;
    const res = await agent.put('/api/v1/admin/profile/photo').send({ image: fake, original: fake, crop }).expect(400);
    assert.equal(res.body.error.message, 'That file is not a valid image.');
    await agent.put('/api/v1/admin/profile/photo').send({ image: 'data:text/html;base64,AAAA', crop }).expect(400);
  });
});

describe('theme', () => {
  const custom = {
    preset: 'custom',
    colors: { background: '#FFFFFF', surface: '#ffffff', text: '#000000', primary: '#001f54', accent: '#ffc300', dark: '#000814' },
    gradient: ['#001f54', '#034078'],
    palette: ['#001f54', '#ffc300', '#000814', '#034078', '#1282a2', '#fefcfb'],
  };

  test('defaults to black · white · navy · yellow and is public', async () => {
    const { body } = await request(app).get('/api/v1/content').expect(200);
    assert.equal(body.theme.preset, 'navy-gold');
    assert.equal(body.theme.colors.accent, '#facc15');
    assert.equal(body.theme.palette.length, 6);
  });

  test('admin can save a custom theme; invalid colours are rejected', async () => {
    await request(app).put('/api/v1/admin/theme').send(custom).expect(401);
    const agent = await signedIn();
    const saved = await agent.put('/api/v1/admin/theme').send(custom).expect(200);
    assert.equal(saved.body.theme.colors.background, '#ffffff', 'hex is normalised to lower case');
    assert.equal(saved.body.theme.colors._id, undefined);

    const pub = await request(app).get('/api/v1/content');
    assert.equal(pub.body.theme.colors.primary, '#001f54');

    const bad = await agent
      .put('/api/v1/admin/theme')
      .send({ ...custom, colors: { ...custom.colors, primary: 'navy' }, palette: ['#000000'] })
      .expect(400);
    assert.ok(bad.body.error.fields['colors.primary']);
    assert.ok(bad.body.error.fields.palette);

    const current = await agent.get('/api/v1/admin/theme').expect(200);
    assert.equal(current.body.theme.colors.primary, '#001f54');
    assert.equal(current.body.defaultTheme.preset, 'navy-gold');
  });
});

describe('seo', () => {
  test('defaults are set and public', async () => {
    const { body } = await request(app).get('/api/v1/content').expect(200);
    assert.equal(body.profile.seo.title, 'Dhruv Mangroliya | Software Engineer & Full-Stack Developer');
    assert.equal(body.profile.seo.description, DEFAULT_SEO.description);
  });

  test('head tags escape user text and include structured data', () => {
    const html = buildHeadTags({ name: 'Dhruv', seo: { title: 'A "quoted" <b>title</b>', description: "It's </script><script>x" } });
    assert.match(html, /<title>A &quot;quoted&quot; &lt;b&gt;title&lt;\/b&gt;<\/title>/);
    assert.ok(!html.includes('</script><script>x'), 'description cannot break out of the JSON-LD script');
    assert.match(html, /"@type":"Person"/);
  });

  test('index.html gets the saved title/description injected', async () => {
    const agent = await signedIn();
    const { body } = await agent.get('/api/v1/admin/profile');
    await agent
      .put('/api/v1/admin/profile')
      .send({ ...body.profile, seo: { title: 'Custom title', description: 'Custom description' } })
      .expect(200);
    const template = '<head>\n<!-- seo:start -->\n<title>old</title>\n<!-- seo:end -->\n</head>';
    const html = await renderIndexHtml(template);
    assert.match(html, /<title>Custom title<\/title>/);
    assert.match(html, /<meta name="description" content="Custom description" \/>/);
    assert.ok(!html.includes('<title>old</title>'));
  });
});

describe('project cover upload', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  test('gallery: upload → reorder/remove → deleted images are cleaned up', async () => {
    await request(app).post('/api/v1/admin/media').send({ image: PNG }).expect(401);
    const agent = await signedIn();
    const urls = [];
    for (let i = 0; i < 3; i++) urls.push((await agent.post('/api/v1/admin/media').send({ image: PNG }).expect(201)).body.media.url);

    const base = '/api/v1/admin/collections/projects';
    const { body } = await agent.post(base).send({ title: 'InventoryBook.in', summary: 'Inventory app.', images: urls }).expect(201);
    assert.deepEqual(body.item.images, urls);
    const pub = await request(app).get('/api/v1/content');
    assert.deepEqual(pub.body.projects.find((p) => p.id === body.item.id).images, urls);

    // reorder + drop the first one → only that one is deleted
    await agent.patch(`${base}/${body.item.id}`).send({ images: [urls[2], urls[1]] }).expect(200);
    await request(app).get(urls[0]).expect(404);
    await request(app).get(urls[1]).expect(200);

    await agent.post(base).send({ title: 'x', summary: 'y', images: Array(11).fill(urls[1]) }).expect(400);
    await agent.post(base).send({ title: 'x', summary: 'y', images: ['javascript:alert(1)'] }).expect(400);

    await agent.delete(`${base}/${body.item.id}`).expect(204);
    await request(app).get(urls[1]).expect(404);
    await request(app).get(urls[2]).expect(404);
  });

  test('rejects non-images', async () => {
    const agent = await signedIn();
    await agent.post('/api/v1/admin/media').send({ image: 'data:image/png;base64,' + Buffer.from('nope, not a png file').toString('base64') }).expect(400);
  });
});

describe('weight tracker', () => {
  test('is private', async () => {
    await request(app).get('/api/v1/admin/weight').expect(401);
    await request(app).put('/api/v1/admin/weight/2026-01-01').send({ weight: 70 }).expect(401);
  });

  test('log → update same day → range filter → delete', async () => {
    const agent = await signedIn();
    const base = '/api/v1/admin/weight';
    let res = await agent.put(`${base}/2026-03-02`).send({ weight: '72.46', note: 'morning' }).expect(201);
    assert.equal(res.body.entry.weight, 72.46);
    assert.equal(res.body.created, true);
    await agent.put(`${base}/2026-03-01`).send({ weight: 73 }).expect(201);
    await agent.put(`${base}/2026-03-05`).send({ weight: 71.8 }).expect(201);

    res = await agent.put(`${base}/2026-03-02`).send({ weight: 72.2 }).expect(200); // one entry per day
    assert.equal(res.body.created, false);

    res = await agent.get(base).expect(200);
    assert.deepEqual(res.body.entries.map((e) => [e.date, e.weight]), [['2026-03-01', 73], ['2026-03-02', 72.2], ['2026-03-05', 71.8]]);
    res = await agent.get(`${base}?from=2026-03-02&to=2026-03-04`).expect(200);
    assert.deepEqual(res.body.entries.map((e) => e.date), ['2026-03-02']);

    await agent.delete(`${base}/2026-03-05`).expect(204);
    await agent.delete(`${base}/2026-03-05`).expect(404);
  });

  test('rejects bad dates and weights', async () => {
    const agent = await signedIn();
    const base = '/api/v1/admin/weight';
    await agent.put(`${base}/2026-02-30`).send({ weight: 70 }).expect(400);
    await agent.put(`${base}/yesterday`).send({ weight: 70 }).expect(400);
    const res = await agent.put(`${base}/2026-03-10`).send({ weight: 5 }).expect(400);
    assert.ok(res.body.error.fields.weight);
    await agent.put(`${base}/2026-03-10`).send({}).expect(400);
  });
});

describe('diet tracker', () => {
  test('is private', async () => {
    await request(app).get('/api/v1/admin/diet/plan').expect(401);
    await request(app).put('/api/v1/admin/diet/days/2026-01-01').send({}).expect(401);
  });

  test('starter plan → edit plan → tick a day → summaries', async () => {
    const agent = await signedIn();
    let res = await agent.get('/api/v1/admin/diet/plan').expect(200);
    const plan = res.body.plan;
    assert.ok(plan.sessions.length >= 5);
    assert.ok(plan.supplements.some((s) => s.name === 'B12'));

    plan.sessions[0].items.push({ id: 'eggs', name: 'Eggs', protein: '12', calories: 140, quantity: '2' });
    res = await agent.put('/api/v1/admin/diet/plan').send({ sessions: plan.sessions, supplements: plan.supplements, preparations: plan.preparations }).expect(200);
    assert.equal(res.body.plan.sessions[0].items.at(-1).protein, 12);

    res = await agent.get('/api/v1/admin/diet/days/2026-03-03').expect(200);
    assert.deepEqual(res.body.day.items, []);

    const day = {
      items: [{ itemId: 'eggs', sessionId: plan.sessions[0].id, name: 'Eggs', protein: 12, calories: 140, quantity: '2' }],
      extras: [{ id: 'x1', name: 'Pizza', protein: 10, calories: 300 }],
      supplements: ['b12'],
      preparations: [],
    };
    await agent.put('/api/v1/admin/diet/days/2026-03-03').send(day).expect(200);
    res = await agent.get('/api/v1/admin/diet/days?from=2026-03-01&to=2026-03-31').expect(200);
    assert.deepEqual(res.body.days, [{ date: '2026-03-03', protein: 22, calories: 440, items: 2, supplements: 1 }]);
  });

  test('rejects bad input', async () => {
    const agent = await signedIn();
    await agent.put('/api/v1/admin/diet/days/2026-13-40').send({ items: [], extras: [], supplements: [], preparations: [] }).expect(400);
    await agent.put('/api/v1/admin/diet/days/2026-03-04').send({ items: [], extras: [{ id: 'x', name: 'A', protein: -1, calories: 1 }], supplements: [], preparations: [] }).expect(400);
    await agent.put('/api/v1/admin/diet/plan').send({ sessions: [{ id: 's', name: '', target: { protein: 0, calories: 0 }, items: [] }], supplements: [], preparations: [] }).expect(400);
  });
});

describe('to-do board', () => {
  test('is private', async () => {
    await request(app).get('/api/v1/admin/todo/week/2026-03-02').expect(401);
  });

  test('categories, tasks, move, tick, carry over', async () => {
    const agent = await signedIn();
    const T = '/api/v1/admin/todo';
    const { body: { category: gym } } = await agent.post(`${T}/categories`).send({ name: 'Gym', color: 'lime', weeklyTarget: 3 }).expect(201);

    // week of Mon 2 Mar 2026: two tasks, one done
    const a = (await agent.post(`${T}/tasks`).send({ title: 'Leg day', categoryId: gym.id, weekStart: '2026-03-02', day: 0 }).expect(201)).body.task;
    const b = (await agent.post(`${T}/tasks`).send({ title: 'Push day', categoryId: gym.id, weekStart: '2026-03-02', day: 2 }).expect(201)).body.task;
    await agent.patch(`${T}/tasks/${a.id}`).send({ done: true }).expect(200);
    assert.equal(b.priority, 'medium'); // default
    assert.equal((await agent.patch(`${T}/tasks/${b.id}`).send({ priority: 'high' }).expect(200)).body.task.priority, 'high');
    await agent.patch(`${T}/tasks/${b.id}`).send({ priority: 'urgent' }).expect(400);
    const moved = (await agent.patch(`${T}/tasks/${b.id}`).send({ day: 4, order: 0.5 }).expect(200)).body.task;
    assert.equal(moved.day, 4);

    let res = await agent.get(`${T}/week/2026-03-02`).expect(200);
    assert.equal(res.body.tasks.length, 2);
    assert.equal(res.body.categories[0].weeklyTarget, 3);

    // next week: the unfinished one rolls to Monday, the finished one stays
    res = await agent.post(`${T}/rollover`).send({ weekStart: '2026-03-09' }).expect(200);
    assert.equal(res.body.moved, 1);
    res = await agent.get(`${T}/week/2026-03-09`).expect(200);
    assert.deepEqual(res.body.tasks.map((t) => [t.title, t.day, t.carriedFrom]), [['Push day', 0, '2026-03-02']]);
    assert.equal((await agent.get(`${T}/week/2026-03-02`)).body.tasks.length, 1);

    // deleting a category keeps its tasks
    await agent.delete(`${T}/categories/${gym.id}`).expect(204);
    res = await agent.get(`${T}/week/2026-03-09`).expect(200);
    assert.equal(res.body.tasks[0].categoryId, null);
  });

  test('weeks must start on Monday; bad input rejected', async () => {
    const agent = await signedIn();
    const ok = await agent.post('/api/v1/admin/todo/categories').send({ name: 'Custom', color: '#AB12CD', weeklyTarget: 2 }).expect(201);
    assert.equal(ok.body.category.color, '#ab12cd');
    await agent.post('/api/v1/admin/todo/categories').send({ name: 'Bad', color: 'red; background:url(x)' }).expect(400);
    await agent.get('/api/v1/admin/todo/week/2026-03-03').expect(400);
    await agent.post('/api/v1/admin/todo/tasks').send({ title: '', weekStart: '2026-03-02' }).expect(400);
    await agent.post('/api/v1/admin/todo/tasks').send({ title: 'x', weekStart: '2026-03-02', day: 7 }).expect(400);
  });
});
