import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const serverDirectory = new URL('../', import.meta.url).pathname;
const testDatabaseName = `mmm_m13_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
let mongoose; let User; let Wedding; let Announcement; let app; let databaseCreated = false; let currentTime;

function uniqueEmail() { return `m13-${randomUUID().replaceAll('-', '').slice(0, 16)}@example.test`; }

async function createUser(role = 'ADMIN') {
  const password = 'M13AnnouncementPassword123';
  const user = await User.create({
    name: `M13 ${role}`,
    email: uniqueEmail(),
    passwordHash: await require('bcrypt').hash(password, 10),
    role,
    status: 'ACTIVE',
    activatedAt: new Date(),
  });
  return { user, password };
}

async function login(user, password) {
  const agent = require('supertest').agent(app);
  const csrf = await agent.get('/api/v1/auth/csrf');
  const response = await agent.post('/api/v1/auth/login')
    .set('X-CSRF-Token', csrf.body.data.csrfToken)
    .send({ email: user.email, password });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return agent;
}

async function context({ withManager = false } = {}) {
  const admin = await createUser('ADMIN');
  const manager = withManager ? await createUser('MANAGER') : undefined;
  const wedding = await Wedding.create({
    adminId: admin.user._id,
    ...(manager ? { managerId: manager.user._id } : { managerId: null }),
    title: 'M13 Test Wedding',
    partnerOneName: 'Asha',
    partnerTwoName: 'Dev',
    weddingDate: '2027-02-15',
    timeZone: 'Asia/Kolkata',
    slug: `m13-${randomUUID().replaceAll('-', '').slice(0, 12)}`,
    websitePublished: false,
  });
  return {
    admin: admin.user,
    adminAgent: await login(admin.user, admin.password),
    wedding,
    ...(manager ? { manager: manager.user, managerAgent: await login(manager.user, manager.password) } : {}),
  };
}

async function csrf(agent) {
  const response = await agent.get('/api/v1/auth/csrf');
  expect(response.status).toBe(200);
  return response.body.data.csrfToken;
}

async function mutation(agent, method, url, body) {
  let request = agent[method](url).set('X-CSRF-Token', await csrf(agent));
  if (body !== undefined) request = request.send(body);
  return request;
}

function payload(overrides = {}) {
  return { title: 'Venue Update', description: 'The entrance has changed.', status: 'DRAFT', ...overrides };
}

async function createAnnouncement(agent, body = payload()) {
  return mutation(agent, 'post', '/api/v1/announcements', body);
}

describe('M13 Announcements API', () => {
  beforeAll(async () => {
    let probeConnection; let stage = 'prepare isolated test configuration';
    try {
      const uri = process.env.M13_TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27018/?replicaSet=m9rs';
      if (!['localhost', '127.0.0.1', '::1'].includes(new URL(uri).hostname)) throw new Error('M13 integration tests accept only a loopback MongoDB URI.');
      process.env.NODE_ENV = 'test';
      process.env.MONGO_DB_URI = uri;
      process.env.MONGO_DB_NAME = testDatabaseName;
      process.env.SESSION_SECRET = randomBytes(64).toString('hex');
      process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
      process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
      const dotenv = require('dotenv'); const originalConfig = dotenv.config; dotenv.config = () => ({ parsed: {} });
      try { require(`${serverDirectory}src/config/env.js`); } finally { dotenv.config = originalConfig; }
      mongoose = require('mongoose');
      stage = 'check generated database and replica-set support';
      probeConnection = await mongoose.createConnection(uri, { dbName: 'admin', serverSelectionTimeoutMS: 15000 }).asPromise();
      const hello = await probeConnection.getClient().db('admin').command({ hello: 1 });
      if (!hello.setName) throw new Error('M13 tests require the local replica set.');
      const { databases } = await probeConnection.getClient().db('admin').admin().listDatabases({ nameOnly: true });
      if (databases.some(({ name }) => name === testDatabaseName)) throw new Error('Generated M13 database already exists; refusing to modify it.');
      await probeConnection.close(); probeConnection = undefined;
      stage = 'load models and application';
      User = require(`${serverDirectory}src/modules/auth/user.model.js`);
      Wedding = require(`${serverDirectory}src/modules/wedding/wedding.model.js`);
      Announcement = require(`${serverDirectory}src/modules/announcements/announcement.model.js`);
      const { createAnnouncementService } = require(`${serverDirectory}src/modules/announcements/announcement.service.js`);
      app = require(`${serverDirectory}src/app.js`).createApp({
        announcementService: createAnnouncementService({ now: () => new Date(currentTime) }),
      });
      stage = 'connect to isolated M13 database';
      await require(`${serverDirectory}src/config/database.js`)();
      if (mongoose.connection.name !== testDatabaseName) throw new Error('Backend did not select the isolated M13 test database.');
      databaseCreated = true;
      await Announcement.createIndexes();
    } catch (error) {
      if (probeConnection) await probeConnection.close().catch(() => {});
      if (mongoose?.connection?.readyState === 1 && databaseCreated) await mongoose.connection.dropDatabase().catch(() => {});
      if (mongoose?.connection?.readyState) await mongoose.disconnect().catch(() => {});
      const code = error?.code ?? error?.name;
      throw new Error(`Could not safely prepare M13 tests while trying to ${stage}${code ? ` (${code})` : ''}.`, { cause: error });
    }
  }, 60000);

  beforeEach(async () => {
    currentTime = new Date('2027-01-01T00:00:00.000Z');
    await Promise.all([Announcement.deleteMany({}), Wedding.deleteMany({}), User.deleteMany({})]);
  });

  afterAll(async () => {
    if (!mongoose?.connection?.readyState) return;
    try { if (databaseCreated) { await mongoose.connection.dropDatabase(); databaseCreated = false; } }
    finally { await mongoose.disconnect(); }
  }, 60000);

  it('matches Database Design §5.10 fields, states and exact index in schema and MongoDB', async () => {
    expect(Object.keys(Announcement.schema.paths).sort()).toEqual([
      '_id', '__v', 'weddingId', 'title', 'description', 'status', 'publishedAt', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt',
    ].sort());
    expect(Announcement.schema.path('status').enumValues).toEqual(['DRAFT', 'PUBLISHED']);
    expect(Announcement.schema.indexes()).toEqual([[{ weddingId: 1, status: 1, publishedAt: -1 }, {}]]);
    const actual = await Announcement.collection.indexes();
    expect(actual.some((index) => JSON.stringify(index.key) === JSON.stringify({ weddingId: 1, status: 1, publishedAt: -1 }))).toBe(true);
  });

  it('creates DRAFT and PUBLISHED announcements with server-controlled Wedding, creator and publication metadata', async () => {
    const { admin, adminAgent, wedding } = await context();
    const draft = await createAnnouncement(adminAgent);
    expect(draft.status).toBe(201);
    expect(draft.body.data).toMatchObject({ title: 'Venue Update', description: 'The entrance has changed.', status: 'DRAFT', createdBy: admin._id.toString() });
    expect(draft.body.data.publishedAt).toBeUndefined();
    const draftStored = await Announcement.findById(draft.body.data.id).lean();
    expect(draftStored.weddingId.toString()).toBe(wedding._id.toString());
    expect(draftStored.createdBy.toString()).toBe(admin._id.toString());
    const published = await createAnnouncement(adminAgent, payload({ status: 'PUBLISHED' }));
    expect(published.status).toBe(201);
    expect(new Date(published.body.data.publishedAt).toISOString()).toBe(currentTime.toISOString());
    for (const body of [payload({ title: '' }), payload({ description: '' }), payload({ status: 'HIDDEN' }), { title: 'No status', description: 'Missing status' }, payload({ weddingId: new mongoose.Types.ObjectId().toString() }), payload({ createdBy: new mongoose.Types.ObjectId().toString() }), payload({ publishedAt: new Date().toISOString() })]) {
      expect((await createAnnouncement(adminAgent, body)).status).toBe(400);
    }
  });

  it('filters and paginates only this Wedding’s management records in the documented status set', async () => {
    const { adminAgent, wedding } = await context();
    const first = await createAnnouncement(adminAgent, payload({ title: 'First' }));
    currentTime = new Date('2027-01-02T00:00:00.000Z');
    await createAnnouncement(adminAgent, payload({ title: 'Second' }));
    const published = await createAnnouncement(adminAgent, payload({ title: 'Published', status: 'PUBLISHED' }));
    const other = await context(); await createAnnouncement(other.adminAgent, payload({ title: 'Other wedding' }));
    const list = await adminAgent.get('/api/v1/announcements');
    expect(list.status).toBe(200);
    expect(list.body.pagination).toEqual({ page: 1, limit: 10, totalRecords: 3, totalPages: 1 });
    expect(list.body.data.map((entry) => entry.title)).toEqual(['Published', 'Second', 'First']);
    expect((await adminAgent.get('/api/v1/announcements?status=DRAFT')).body.data.map((entry) => entry.title)).toEqual(['Second', 'First']);
    expect((await adminAgent.get('/api/v1/announcements?status=PUBLISHED')).body.data.map((entry) => entry.title)).toEqual(['Published']);
    const page = await adminAgent.get('/api/v1/announcements?page=2&limit=1');
    expect(page.body.pagination).toEqual({ page: 2, limit: 1, totalRecords: 3, totalPages: 3 });
    for (const query of ['?status=BAD', '?page=0', '?limit=101', '?extra=x']) expect((await adminAgent.get(`/api/v1/announcements${query}`)).status).toBe(400);
    expect((await adminAgent.get(`/api/v1/announcements?status=DRAFT&weddingId=${other.wedding._id}`)).status).toBe(400);
    expect((await adminAgent.get(`/api/v1/announcements/${first.body.data.id}`)).body.data.title).toBe('First');
    expect((await adminAgent.get(`/api/v1/announcements/${published.body.data.id}`)).body.data.status).toBe('PUBLISHED');
    expect(wedding).toBeTruthy();
  });

  it('updates content while preserving or transitioning publication metadata', async () => {
    const { adminAgent, admin } = await context();
    const draft = await createAnnouncement(adminAgent);
    const draftId = draft.body.data.id;
    const editDraft = await mutation(adminAgent, 'patch', `/api/v1/announcements/${draftId}`, { title: 'Draft edited' });
    expect(editDraft.body.data).toMatchObject({ title: 'Draft edited', status: 'DRAFT' });
    expect(editDraft.body.data.publishedAt).toBeUndefined();
    currentTime = new Date('2027-01-02T00:00:00.000Z');
    const publish = await mutation(adminAgent, 'patch', `/api/v1/announcements/${draftId}`, { status: 'PUBLISHED' });
    expect(publish.body.data.publishedAt).toBe(currentTime.toISOString());
    const firstPublishedAt = publish.body.data.publishedAt;
    currentTime = new Date('2027-01-03T00:00:00.000Z');
    const contentEdit = await mutation(adminAgent, 'patch', `/api/v1/announcements/${draftId}`, { title: 'Published edit' });
    expect(contentEdit.body.data.publishedAt).toBe(firstPublishedAt);
    expect(contentEdit.body.data.updatedBy).toBe(admin._id.toString());
    const unpublish = await mutation(adminAgent, 'patch', `/api/v1/announcements/${draftId}`, { status: 'DRAFT' });
    expect(unpublish.body.data.status).toBe('DRAFT');
    expect(unpublish.body.data.publishedAt).toBeUndefined();
    currentTime = new Date('2027-01-04T00:00:00.000Z');
    const republish = await mutation(adminAgent, 'patch', `/api/v1/announcements/${draftId}`, { status: 'PUBLISHED' });
    expect(republish.body.data.publishedAt).toBe(currentTime.toISOString());
    for (const body of [{ status: 'ARCHIVED' }, { weddingId: new mongoose.Types.ObjectId().toString() }, { createdBy: admin._id.toString() }, { updatedBy: admin._id.toString() }, { publishedAt: currentTime.toISOString() }, {}]) {
      expect((await mutation(adminAgent, 'patch', `/api/v1/announcements/${draftId}`, body)).status).toBe(400);
    }
    expect((await adminAgent.get(`/api/v1/announcements/not-an-id`)).status).toBe(404);
  });

  it('deletes only a Wedding-owned Announcement and returns not found after deletion or on repeat', async () => {
    const first = await context(); const second = await context();
    const created = await createAnnouncement(first.adminAgent);
    const id = created.body.data.id;
    expect((await mutation(second.adminAgent, 'delete', `/api/v1/announcements/${id}`)).status).toBe(404);
    expect((await mutation(first.adminAgent, 'delete', `/api/v1/announcements/${id}`)).body.data).toEqual({ id });
    expect((await first.adminAgent.get(`/api/v1/announcements/${id}`)).status).toBe(404);
    expect((await mutation(first.adminAgent, 'delete', `/api/v1/announcements/${id}`)).status).toBe(404);
    expect(first.wedding._id.toString()).not.toBe(second.wedding._id.toString());
  });

  it('allows assigned Managers, denies anonymous users, enforces CSRF, and exposes no public M13 route', async () => {
    const { manager, managerAgent, adminAgent } = await context({ withManager: true });
    const created = await createAnnouncement(managerAgent);
    expect(created.status).toBe(201); expect(created.body.data.createdBy).toBe(manager._id.toString());
    const anon = require('supertest')(app);
    expect((await anon.get('/api/v1/announcements')).status).toBe(401);
    expect((await anon.post('/api/v1/announcements').send(payload())).status).toBe(401);
    expect((await managerAgent.patch(`/api/v1/announcements/${created.body.data.id}`).send({ title: 'No CSRF' })).status).toBe(403);
    expect((await adminAgent.get(`/api/v1/public/weddings/m13-unpublished/announcements`)).status).toBe(404);
  });
});
