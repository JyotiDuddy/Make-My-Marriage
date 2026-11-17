import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const serverDirectory = new URL('../', import.meta.url).pathname;
const testDatabaseName = `mmm_m6_${randomUUID().replaceAll('-', '').slice(0, 12)}`;

let mongoose;
let User;
let Wedding;
let Event;
let app;
let createApp;
let connectDB;
let createEventService;
let testConfig;
let databaseCreated = false;

function safeError(message, error) {
  const code = error?.code ?? error?.name;
  return new Error(code ? `${message} (${code}).` : `${message}.`);
}

function uniqueEmail() {
  return `m6-${randomUUID().replaceAll('-', '').slice(0, 18)}@example.test`;
}

async function csrfToken(agent) {
  const response = await agent.get('/api/v1/auth/csrf');
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body.data.csrfToken;
}

async function mutation(agent, method, url, body) {
  const token = await csrfToken(agent);
  let request = agent[method](url).set('X-CSRF-Token', token);
  if (body !== undefined) request = request.send(body);
  return request;
}

async function createUser(role = 'ADMIN') {
  const password = 'M6EventPassword123';
  const user = await User.create({
    name: `M6 ${role}`,
    email: uniqueEmail(),
    passwordHash: await require('bcrypt').hash(password, testConfig.bcryptSaltRounds),
    role,
    status: 'ACTIVE',
    activatedAt: new Date(),
  });
  return { user, password };
}

async function loggedIn(user, password, targetApp = app) {
  const agent = require('supertest').agent(targetApp);
  const token = await csrfToken(agent);
  const response = await agent.post('/api/v1/auth/login')
    .set('X-CSRF-Token', token)
    .send({ email: user.email, password });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return agent;
}

async function createWedding(admin, managerId = null) {
  return Wedding.create({
    adminId: admin._id,
    managerId,
    title: 'M6 Test Wedding',
    partnerOneName: 'Asha',
    partnerTwoName: 'Dev',
    weddingDate: '2027-02-15',
    timeZone: 'Asia/Kolkata',
    slug: `m6-${randomUUID().replaceAll('-', '').slice(0, 12)}`,
    websitePublished: false,
  });
}

async function adminContext(targetApp = app) {
  const { user, password } = await createUser('ADMIN');
  const wedding = await createWedding(user);
  return { user, wedding, agent: await loggedIn(user, password, targetApp) };
}

async function managerContext() {
  const admin = await createUser('ADMIN');
  const manager = await createUser('MANAGER');
  const wedding = await createWedding(admin.user, manager.user._id);
  return {
    admin: admin.user,
    manager: manager.user,
    wedding,
    adminAgent: await loggedIn(admin.user, admin.password),
    agent: await loggedIn(manager.user, manager.password),
  };
}

function eventPayload(overrides = {}) {
  return {
    name: 'Haldi Ceremony',
    eventDate: '2027-02-13',
    startTime: '10:00',
    endTime: '13:00',
    venueName: 'The Wedding Garden',
    venueAddress: 'Delhi, India',
    status: 'UPCOMING',
    isPublished: false,
    ...overrides,
  };
}

async function createEvent(agent, body = eventPayload()) {
  return mutation(agent, 'post', '/api/v1/events', body);
}

describe('M6 Events API', () => {
  beforeAll(async () => {
    let probeConnection;
    let stage = 'prepare isolated test configuration';
    try {
      const uri = process.env.M6_TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017';
      const host = new URL(uri).hostname;
      if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
        throw new Error('M6 integration tests accept only a loopback MongoDB URI.');
      }
      process.env.NODE_ENV = 'test';
      process.env.MONGO_DB_URI = uri;
      process.env.MONGO_DB_NAME = testDatabaseName;
      process.env.SESSION_SECRET = randomBytes(64).toString('hex');
      process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
      process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';

      const dotenv = require('dotenv');
      const originalDotenvConfig = dotenv.config;
      dotenv.config = () => ({ parsed: {} });
      try {
        testConfig = require(`${serverDirectory}src/config/env.js`);
      } finally {
        dotenv.config = originalDotenvConfig;
      }

      mongoose = require('mongoose');
      stage = 'check the generated test database name';
      probeConnection = await mongoose.createConnection(uri, {
        dbName: 'admin',
        serverSelectionTimeoutMS: 15000,
      }).asPromise();
      const { databases } = await probeConnection.getClient().db('admin').admin()
        .listDatabases({ nameOnly: true });
      if (databases.some(({ name }) => name === testDatabaseName)) {
        throw new Error('Generated test database already exists; refusing to modify it.');
      }
      await probeConnection.close();
      probeConnection = undefined;

      stage = 'load models and test application';
      User = require(`${serverDirectory}src/modules/auth/user.model.js`);
      Wedding = require(`${serverDirectory}src/modules/wedding/wedding.model.js`);
      Event = require(`${serverDirectory}src/modules/events/event.model.js`);
      connectDB = require(`${serverDirectory}src/config/database.js`);
      createEventService = require(`${serverDirectory}src/modules/events/event.service.js`).createEventService;
      createApp = require(`${serverDirectory}src/app.js`).createApp;
      app = createApp({ authRateLimitOverrides: { login: 100 } });

      stage = 'connect to the isolated test database';
      await connectDB();
      if (mongoose.connection.name !== testDatabaseName) {
        throw new Error('The backend did not select the isolated M6 database.');
      }
      databaseCreated = true;
      await Event.createIndexes();
    } catch (error) {
      if (probeConnection) await probeConnection.close().catch(() => {});
      if (mongoose?.connection?.readyState === 1 && databaseCreated) {
        await mongoose.connection.dropDatabase().catch(() => {});
      }
      if (mongoose?.connection?.readyState) await mongoose.disconnect().catch(() => {});
      throw safeError(`Could not safely prepare M6 integration tests while trying to ${stage}`, error);
    }
  }, 60000);

  beforeEach(async () => {
    await Event.deleteMany({});
    await Wedding.deleteMany({});
    await User.deleteMany({});
  });

  afterAll(async () => {
    if (!mongoose?.connection?.readyState) return;
    try {
      if (databaseCreated) {
        await mongoose.connection.dropDatabase();
        databaseCreated = false;
      }
    } finally {
      await mongoose.disconnect();
    }
  }, 60000);

  it('creates an Event with the documented menu, Maps link, video metadata, and ownership from the session', async () => {
    const { user, wedding, agent } = await adminContext();
    const response = await createEvent(agent, eventPayload({
      googleMapsUrl: 'https://maps.google.com/?q=example',
      foodMenu: [{ category: 'Breakfast', items: ['Aloo Paratha', 'Curd'] }],
      video: { videoType: 'LIVE', provider: 'YOUTUBE', url: 'https://www.youtube.com/watch?v=abcdefghijk' },
      weddingId: new mongoose.Types.ObjectId().toString(),
      createdBy: new mongoose.Types.ObjectId().toString(),
    }));

    expect(response.status).toBe(400);
    const valid = await createEvent(agent, eventPayload({
      googleMapsUrl: 'https://maps.google.com/?q=example',
      foodMenu: [{ category: 'Breakfast', items: ['Aloo Paratha', 'Curd'] }],
      video: { videoType: 'LIVE', provider: 'YOUTUBE', url: 'https://www.youtube.com/watch?v=abcdefghijk' },
    }));
    expect(valid.status).toBe(201);
    expect(valid.body).toMatchObject({
      success: true,
      data: {
        name: 'Haldi Ceremony',
        eventDate: '2027-02-13',
        startTime: '10:00',
        status: 'UPCOMING',
        video: { videoType: 'LIVE', provider: 'YOUTUBE', videoId: 'abcdefghijk' },
      },
    });
    const stored = await Event.findById(valid.body.data.id).lean();
    expect(stored.weddingId.toString()).toBe(wedding._id.toString());
    expect(stored.createdBy.toString()).toBe(user._id.toString());
    expect(stored.video.videoId).toBe('abcdefghijk');
    expect(stored.weddingId.toString()).not.toBe(response.body.data?.weddingId);
  });

  it('requires all documented required fields, including an explicit status, and rejects invalid dates/times/statuses', async () => {
    const { agent } = await adminContext();
    for (const field of ['name', 'eventDate', 'startTime', 'venueName', 'venueAddress', 'status', 'isPublished']) {
      const body = eventPayload();
      delete body[field];
      const response = await createEvent(agent, body);
      expect(response.status, field).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
    for (const overrides of [
      { eventDate: '2027-02-30' },
      { eventDate: '13/02/2027' },
      { startTime: '25:00' },
      { endTime: '10:65' },
      { startTime: '10' },
      { status: 'POSTPONED' },
    ]) {
      const response = await createEvent(agent, eventPayload(overrides));
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(await Event.countDocuments()).toBe(0);
  });

  it('validates Maps URLs, embedded food menus, and YouTube metadata without trusting videoId', async () => {
    const { agent } = await adminContext();
    for (const overrides of [
      { googleMapsUrl: 'javascript:alert(1)' },
      { googleMapsUrl: 'https://attacker.example/maps' },
      { foodMenu: [{ category: '', items: ['Tea'] }] },
      { foodMenu: [{ category: 'Breakfast', items: [''] }] },
      { video: { videoType: 'RECORDED', provider: 'YOUTUBE', url: 'https://youtube.example/watch?v=abcdefghijk' } },
      { video: { videoType: 'RECORDED', provider: 'YOUTUBE', url: 'http://youtube.com/watch?v=abcdefghijk' } },
      { video: { videoType: 'RECORDED', provider: 'VIMEO', url: 'https://youtube.com/watch?v=abcdefghijk' } },
      { video: { videoType: 'RECORDED', provider: 'YOUTUBE', url: 'https://youtube.com/watch?v=abcdefghijk', videoId: 'client-value' } },
    ]) {
      const response = await createEvent(agent, eventPayload(overrides));
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('lists events with status, date and search filters plus bounded pagination', async () => {
    const { agent } = await adminContext();
    await createEvent(agent, eventPayload({ name: 'Haldi', eventDate: '2027-02-13' }));
    await createEvent(agent, eventPayload({ name: 'Sangeet', eventDate: '2027-02-14', status: 'COMPLETED' }));
    await createEvent(agent, eventPayload({ name: 'Reception', eventDate: '2027-02-15', status: 'CANCELLED' }));

    const response = await agent.get('/api/v1/events?page=1&limit=2');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.map((event) => event.name)).toEqual(['Haldi', 'Sangeet']);
    expect(response.body.pagination).toEqual({ page: 1, limit: 2, totalRecords: 3, totalPages: 2 });
    const filtered = await agent.get('/api/v1/events?status=CANCELLED&search=cep&eventDate=2027-02-15');
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.map((event) => event.name)).toEqual(['Reception']);
    for (const query of ['?page=0', '?limit=101', '?status=INVALID', '?eventDate=2027-02-30', '?unknown=x']) {
      expect((await agent.get(`/api/v1/events${query}`)).status).toBe(400);
    }
  });

  it('retrieves event details and returns 404 for invalid, missing, or deleted IDs', async () => {
    const { agent } = await adminContext();
    const created = await createEvent(agent);
    const eventId = created.body.data.id;
    const detail = await agent.get(`/api/v1/events/${eventId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ id: eventId, name: 'Haldi Ceremony', isPublished: false });
    expect((await agent.get('/api/v1/events/not-an-object-id')).status).toBe(404);
    expect((await agent.get(`/api/v1/events/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
  });

  it('updates permitted fields, supports video removal, and rejects ownership/status fields and invalid updates', async () => {
    const { agent } = await adminContext();
    const created = await createEvent(agent, eventPayload({
      video: { videoType: 'RECORDED', provider: 'YOUTUBE', url: 'https://youtu.be/abcdefghijk' },
    }));
    const eventId = created.body.data.id;
    const updated = await mutation(agent, 'patch', `/api/v1/events/${eventId}`, {
      name: 'Updated Haldi Ceremony',
      venueName: 'Updated Garden',
      foodMenu: [{ category: 'Snacks', items: ['Samosa'] }],
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      name: 'Updated Haldi Ceremony',
      venueName: 'Updated Garden',
      foodMenu: [{ category: 'Snacks', items: ['Samosa'] }],
    });
    const removedVideo = await mutation(agent, 'patch', `/api/v1/events/${eventId}`, { video: null });
    expect(removedVideo.status).toBe(200);
    expect(removedVideo.body.data.video).toBeNull();
    for (const body of [
      { weddingId: new mongoose.Types.ObjectId().toString() },
      { createdBy: new mongoose.Types.ObjectId().toString() },
      { status: 'CANCELLED' },
      { startTime: '25:00' },
      { videoId: 'abcdefghijk' },
      {},
    ]) {
      expect((await mutation(agent, 'patch', `/api/v1/events/${eventId}`, body)).status).toBe(400);
    }
    expect((await mutation(agent, 'patch', `/api/v1/events/${new mongoose.Types.ObjectId()}`, { name: 'Nope' })).status).toBe(404);
  });

  it('allows every transition among the approved statuses and rejects values outside the enum', async () => {
    const { agent } = await adminContext();
    const created = await createEvent(agent);
    const eventId = created.body.data.id;
    for (const status of ['CANCELLED', 'UPCOMING', 'COMPLETED', 'CANCELLED']) {
      const response = await mutation(agent, 'patch', `/api/v1/events/${eventId}/status`, { status });
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(status);
    }
    const invalid = await mutation(agent, 'patch', `/api/v1/events/${eventId}/status`, { status: 'POSTPONED' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect((await mutation(agent, 'patch', `/api/v1/events/${eventId}/status`, { status: 'UPCOMING', extra: true })).status).toBe(400);
  });

  it('enforces Admin/Manager access, CSRF, and Wedding isolation on all operations', async () => {
    const first = await managerContext();
    const created = await createEvent(first.adminAgent);
    const eventId = created.body.data.id;
    expect((await first.agent.get(`/api/v1/events/${eventId}`)).status).toBe(200);
    const managerUpdate = await mutation(first.agent, 'patch', `/api/v1/events/${eventId}/status`, { status: 'COMPLETED' });
    expect(managerUpdate.status).toBe(200);
    expect(managerUpdate.body.data.status).toBe('COMPLETED');

    const second = await adminContext();
    expect((await second.agent.get(`/api/v1/events/${eventId}`)).status).toBe(404);
    expect((await mutation(second.agent, 'patch', `/api/v1/events/${eventId}`, { name: 'Cross Wedding' })).status).toBe(404);
    expect((await mutation(second.agent, 'patch', `/api/v1/events/${eventId}/status`, { status: 'CANCELLED' })).status).toBe(404);
    expect((await mutation(second.agent, 'delete', `/api/v1/events/${eventId}`)).status).toBe(404);

    const anonymous = require('supertest').agent(app);
    expect((await anonymous.get('/api/v1/events')).status).toBe(401);
    expect((await anonymous.post('/api/v1/events').send(eventPayload())).status).toBe(401);
    expect((await first.agent.post('/api/v1/events').send(eventPayload())).status).toBe(403);
    expect((await first.agent.patch(`/api/v1/events/${eventId}`).send({ name: 'No CSRF' })).status).toBe(403);
    expect((await first.agent.patch(`/api/v1/events/${eventId}/status`).send({ status: 'CANCELLED' })).status).toBe(403);
    expect((await first.agent.delete(`/api/v1/events/${eventId}`)).status).toBe(403);
  });

  it('soft-deletes events with no current dependent records and hides them from normal reads', async () => {
    const { agent } = await adminContext();
    const created = await createEvent(agent);
    const eventId = created.body.data.id;
    const removed = await mutation(agent, 'delete', `/api/v1/events/${eventId}`);
    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({ success: true, data: { id: eventId } });
    const stored = await Event.findById(eventId).lean();
    expect(stored.deletedAt).toBeInstanceOf(Date);
    expect((await agent.get(`/api/v1/events/${eventId}`)).status).toBe(404);
    expect((await agent.get('/api/v1/events')).body.data).toEqual([]);
    expect((await mutation(agent, 'delete', `/api/v1/events/${eventId}`)).status).toBe(404);
  });

  it('refuses deletion when an injected dependency checker finds linked history', async () => {
    const guardedApp = createApp({
      authRateLimitOverrides: { login: 100 },
      eventService: createEventService({ eventDependencyChecks: [async () => true] }),
    });
    const { agent } = await adminContext(guardedApp);
    const created = await createEvent(agent);
    const eventId = created.body.data.id;
    const response = await mutation(agent, 'delete', `/api/v1/events/${eventId}`);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
    expect((await Event.findById(eventId).lean()).deletedAt).toBeUndefined();
  });

  it('declares and builds only the three approved Event indexes', async () => {
    const indexes = Event.schema.indexes();
    expect(indexes.map(([fields]) => fields)).toEqual([
      { weddingId: 1, eventDate: 1, startTime: 1 },
      { weddingId: 1, isPublished: 1, eventDate: 1 },
      { weddingId: 1, status: 1 },
    ]);
    const storedIndexes = await Event.collection.indexes();
    expect(storedIndexes.filter(({ key }) => key.weddingId).map(({ key }) => key)).toEqual([
      { weddingId: 1, eventDate: 1, startTime: 1 },
      { weddingId: 1, isPublished: 1, eventDate: 1 },
      { weddingId: 1, status: 1 },
    ]);
  });
});
