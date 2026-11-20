import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const serverDirectory = new URL('../', import.meta.url).pathname;
const testDatabaseName = `mmm_m7_${randomUUID().replaceAll('-', '').slice(0, 12)}`;

let mongoose;
let User;
let Wedding;
let Event;
let Task;
let app;
let testConfig;
let databaseCreated = false;

function safeError(message, error) {
  const code = error?.code ?? error?.name;
  return new Error(code ? `${message} (${code}).` : `${message}.`);
}

function uniqueEmail() {
  return `m7-${randomUUID().replaceAll('-', '').slice(0, 18)}@example.test`;
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
  const password = 'M7TaskPassword123';
  const user = await User.create({
    name: `M7 ${role}`,
    email: uniqueEmail(),
    passwordHash: await require('bcrypt').hash(password, testConfig.bcryptSaltRounds),
    role,
    status: 'ACTIVE',
    activatedAt: new Date(),
  });
  return { user, password };
}

async function loggedIn(user, password) {
  const agent = require('supertest').agent(app);
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
    title: 'M7 Test Wedding',
    partnerOneName: 'Asha',
    partnerTwoName: 'Dev',
    weddingDate: '2027-02-15',
    timeZone: 'Asia/Kolkata',
    slug: `m7-${randomUUID().replaceAll('-', '').slice(0, 12)}`,
    websitePublished: false,
  });
}

async function adminContext() {
  const { user, password } = await createUser('ADMIN');
  const wedding = await createWedding(user);
  const agent = await loggedIn(user, password);
  return { user, wedding, agent };
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

function taskPayload(overrides = {}) {
  return {
    title: 'Confirm Photographer',
    deadline: '2027-01-20T12:30:00.000Z',
    priority: 'HIGH',
    status: 'TODO',
    ...overrides,
  };
}

async function createTask(agent, body = taskPayload()) {
  return mutation(agent, 'post', '/api/v1/tasks', body);
}

async function createEvent(wedding, user) {
  return Event.create({
    weddingId: wedding._id,
    name: 'Haldi',
    eventDate: '2027-02-13',
    startTime: '10:00',
    venueName: 'Garden',
    venueAddress: 'Delhi',
    status: 'UPCOMING',
    isPublished: false,
    createdBy: user._id,
  });
}

describe('M7 Shared Tasks API', () => {
  beforeAll(async () => {
    let probeConnection;
    let stage = 'prepare isolated test configuration';
    try {
      const uri = process.env.M7_TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27018';
      const host = new URL(uri).hostname;
      if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
        throw new Error('M7 integration tests accept only a loopback MongoDB URI.');
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
      stage = 'check generated test database name and transaction support';
      probeConnection = await mongoose.createConnection(uri, {
        dbName: 'admin',
        serverSelectionTimeoutMS: 15000,
      }).asPromise();
      const hello = await probeConnection.getClient().db('admin').command({ hello: 1 });
      if (!hello.setName) throw new Error('M7 race-safe Event association tests require a local replica set.');
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
      Task = require(`${serverDirectory}src/modules/tasks/task.model.js`);
      app = require(`${serverDirectory}src/app.js`).createApp({ authRateLimitOverrides: { login: 100 } });

      stage = 'connect to the isolated test database';
      await require(`${serverDirectory}src/config/database.js`)();
      if (mongoose.connection.name !== testDatabaseName) {
        throw new Error('The backend did not select the isolated M7 database.');
      }
      databaseCreated = true;
      await Promise.all([Task.createIndexes(), Event.createIndexes()]);
    } catch (error) {
      if (probeConnection) await probeConnection.close().catch(() => {});
      if (mongoose?.connection?.readyState === 1 && databaseCreated) {
        await mongoose.connection.dropDatabase().catch(() => {});
      }
      if (mongoose?.connection?.readyState) await mongoose.disconnect().catch(() => {});
      throw safeError(`Could not safely prepare M7 integration tests while trying to ${stage}`, error);
    }
  }, 60000);

  beforeEach(async () => {
    await Task.deleteMany({});
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

  it('declares the exact Task schema fields, enums, timestamps and indexes', async () => {
    expect(Object.keys(Task.schema.paths).sort()).toEqual([
      '_id', 'createdAt', 'createdBy', 'deadline', 'description', 'eventId', 'priority', 'status',
      'title', 'updatedAt', 'updatedBy', 'weddingId', '__v',
    ].sort());
    expect(Task.schema.path('priority').enumValues).toEqual(['LOW', 'MEDIUM', 'HIGH']);
    expect(Task.schema.path('status').enumValues).toEqual(['TODO', 'IN_PROGRESS', 'COMPLETED']);
    expect(Task.schema.path('priority').defaultValue).toBeUndefined();
    expect(Task.schema.path('status').defaultValue).toBeUndefined();
    expect(Task.schema.options.timestamps).toBe(true);
    expect(Task.schema.indexes().map(([fields]) => fields)).toEqual([
      { weddingId: 1, status: 1, deadline: 1 },
      { weddingId: 1, eventId: 1 },
    ]);
    expect((await Task.collection.indexes()).filter(({ key }) => key.weddingId).map(({ key }) => key)).toEqual([
      { weddingId: 1, status: 1, deadline: 1 },
      { weddingId: 1, eventId: 1 },
    ]);
  });

  it('creates tasks with required fields, derives ownership, and validates deadline and enums', async () => {
    const { user, wedding, agent } = await adminContext();
    const response = await createTask(agent);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ success: true, data: { title: 'Confirm Photographer', status: 'TODO' } });
    const stored = await Task.findById(response.body.data.id).lean();
    expect(stored.weddingId.toString()).toBe(wedding._id.toString());
    expect(stored.createdBy.toString()).toBe(user._id.toString());

    for (const field of ['title', 'deadline', 'priority', 'status']) {
      const body = taskPayload();
      delete body[field];
      const invalid = await createTask(agent, body);
      expect(invalid.status, field).toBe(400);
    }
    for (const invalidDeadline of ['2027-01-20', '2027-02-30T12:30:00Z', '2027-01-20T12:30:00', 'not-a-date']) {
      expect((await createTask(agent, taskPayload({ deadline: invalidDeadline }))).status).toBe(400);
    }
    expect((await createTask(agent, taskPayload({ deadline: '2020-01-01T12:30:00-05:00' }))).status).toBe(201);
    expect((await createTask(agent, taskPayload({ status: 'CANCELLED' }))).status).toBe(400);
    expect((await createTask(agent, taskPayload({ priority: 'URGENT' }))).status).toBe(400);
    expect((await createTask(agent, taskPayload({ assignedTo: user._id.toString() }))).status).toBe(400);
    expect((await createTask(agent, taskPayload({ weddingId: new mongoose.Types.ObjectId().toString() }))).status).toBe(400);
    expect((await createTask(agent, taskPayload({ createdBy: new mongoose.Types.ObjectId().toString() }))).status).toBe(400);
  });

  it('accepts an optional same-Wedding Event and rejects malformed, missing, deleted, or cross-Wedding Events', async () => {
    const first = await adminContext();
    const event = await createEvent(first.wedding, first.user);
    const linked = await createTask(first.agent, taskPayload({ eventId: event._id.toString() }));
    expect(linked.status).toBe(201);
    expect(linked.body.data.eventId).toBe(event._id.toString());
    const filtered = await first.agent.get(`/api/v1/tasks?eventId=${event._id}`);
    expect(filtered.body.data.map((task) => task.id)).toEqual([linked.body.data.id]);

    const other = await adminContext();
    const otherEvent = await createEvent(other.wedding, other.user);
    for (const eventId of [
      'bad-id',
      new mongoose.Types.ObjectId().toString(),
      otherEvent._id.toString(),
    ]) {
      expect((await createTask(first.agent, taskPayload({ eventId }))).status).toBe(eventId === 'bad-id' ? 400 : 404);
    }
    await Event.updateOne({ _id: event._id }, { $set: { deletedAt: new Date() } });
    expect((await createTask(first.agent, taskPayload({ eventId: event._id.toString() }))).status).toBe(404);
  });

  it('lists shared tasks with documented filters, pagination, and stable deadline ordering', async () => {
    const { wedding, agent } = await adminContext();
    await createTask(agent, taskPayload({ title: 'Later', deadline: '2027-01-22T00:00:00Z', priority: 'LOW' }));
    await createTask(agent, taskPayload({ title: 'First tie', deadline: '2027-01-20T00:00:00Z' }));
    await createTask(agent, taskPayload({ title: 'Second tie', deadline: '2027-01-20T00:00:00Z', status: 'IN_PROGRESS' }));
    const expectedTieIds = (await Task.find({ weddingId: wedding._id, deadline: new Date('2027-01-20T00:00:00Z') }).sort({ _id: 1 })).map((task) => task._id.toString());

    const all = await agent.get('/api/v1/tasks');
    expect(all.status).toBe(200);
    expect(all.body.pagination).toEqual({ page: 1, limit: 10, totalRecords: 3, totalPages: 1 });
    expect(all.body.data.slice(0, 2).map((task) => task.id)).toEqual(expectedTieIds);
    expect((await agent.get('/api/v1/tasks?status=IN_PROGRESS')).body.data.map((task) => task.title)).toEqual(['Second tie']);
    expect((await agent.get('/api/v1/tasks?priority=LOW')).body.data.map((task) => task.title)).toEqual(['Later']);
    const paged = await agent.get('/api/v1/tasks?page=2&limit=2');
    expect(paged.body.pagination).toEqual({ page: 2, limit: 2, totalRecords: 3, totalPages: 2 });
    expect(paged.body.data).toHaveLength(1);
    for (const query of ['?page=0', '?limit=101', '?status=INVALID', '?priority=URGENT', '?eventId=bad', '?unknown=x']) {
      expect((await agent.get(`/api/v1/tasks${query}`)).status).toBe(400);
    }
    expect(await Task.countDocuments({ weddingId: wedding._id })).toBe(3);
  });

  it('reads and updates only the active Wedding task, supports clearing optional fields, and sets updatedBy', async () => {
    const { user, agent } = await adminContext();
    const { agent: managerAgent } = await managerContext();
    const created = await createTask(agent, taskPayload({ description: 'Book the photographer.' }));
    const taskId = created.body.data.id;
    expect((await agent.get(`/api/v1/tasks/${taskId}`)).body.data.id).toBe(taskId);
    const updated = await mutation(agent, 'patch', `/api/v1/tasks/${taskId}`, {
      title: 'Confirm final photographer',
      description: '',
      status: 'IN_PROGRESS',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ title: 'Confirm final photographer', description: '', status: 'IN_PROGRESS' });
    const stored = await Task.findById(taskId).lean();
    expect(stored.updatedBy.toString()).toBe(user._id.toString());

    const event = await createEvent(await Wedding.findOne({ adminId: user._id }), user);
    expect((await mutation(agent, 'patch', `/api/v1/tasks/${taskId}`, { eventId: event._id.toString() })).status).toBe(200);
    expect((await Task.findById(taskId).lean()).eventId.toString()).toBe(event._id.toString());
    const other = await adminContext();
    const otherEvent = await createEvent(other.wedding, other.user);
    expect((await mutation(agent, 'patch', `/api/v1/tasks/${taskId}`, { eventId: otherEvent._id.toString() })).status).toBe(404);
    expect((await mutation(agent, 'patch', `/api/v1/tasks/${taskId}`, { eventId: new mongoose.Types.ObjectId().toString() })).status).toBe(404);
    const cleared = await mutation(agent, 'patch', `/api/v1/tasks/${taskId}`, { eventId: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.eventId).toBeUndefined();
    expect((await Task.findById(taskId).lean()).eventId).toBeUndefined();

    for (const body of [
      { weddingId: new mongoose.Types.ObjectId().toString() },
      { createdBy: new mongoose.Types.ObjectId().toString() },
      { updatedBy: new mongoose.Types.ObjectId().toString() },
      { assignedTo: new mongoose.Types.ObjectId().toString() },
      { createdAt: new Date().toISOString() },
      { priority: 'URGENT' },
      { deadline: '2027-01-20' },
      {},
    ]) expect((await mutation(agent, 'patch', `/api/v1/tasks/${taskId}`, body)).status).toBe(400);
    expect((await agent.get('/api/v1/tasks/not-an-object-id')).status).toBe(404);
    expect((await agent.get(`/api/v1/tasks/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
    expect((await mutation(agent, 'delete', `/api/v1/tasks/${new mongoose.Types.ObjectId()}`)).status).toBe(404);

    const secondCreated = await createTask(managerAgent);
    expect(secondCreated.status).toBe(201);
    expect((await managerAgent.get(`/api/v1/tasks/${secondCreated.body.data.id}`)).status).toBe(200);
  });

  it('enforces Admin/Manager authorization, CSRF, and cross-Wedding isolation', async () => {
    const first = await managerContext();
    const task = await createTask(first.adminAgent);
    const taskId = task.body.data.id;
    expect((await first.agent.get(`/api/v1/tasks/${taskId}`)).status).toBe(200);
    expect((await first.agent.get('/api/v1/tasks')).body.data.map((item) => item.id)).toContain(taskId);
    const second = await adminContext();
    expect((await second.agent.get(`/api/v1/tasks/${taskId}`)).status).toBe(404);
    expect((await mutation(second.agent, 'patch', `/api/v1/tasks/${taskId}`, { title: 'Cross wedding' })).status).toBe(404);
    expect((await mutation(second.agent, 'delete', `/api/v1/tasks/${taskId}`)).status).toBe(404);
    const anonymous = require('supertest').agent(app);
    expect((await anonymous.get('/api/v1/tasks')).status).toBe(401);
    expect((await anonymous.post('/api/v1/tasks').send(taskPayload())).status).toBe(401);
    expect((await first.agent.patch(`/api/v1/tasks/${taskId}`).send({ title: 'Missing CSRF' })).status).toBe(403);
    expect((await first.agent.delete(`/api/v1/tasks/${taskId}`)).status).toBe(403);
    expect((await first.agent.post('/api/v1/tasks').send(taskPayload())).status).toBe(403);
  });

  it('blocks Event deletion while a linked Task exists and allows it after Task deletion', async () => {
    const { user, wedding, agent } = await adminContext();
    const event = await createEvent(wedding, user);
    const created = await createTask(agent, taskPayload({ eventId: event._id.toString() }));
    const eventDelete = await mutation(agent, 'delete', `/api/v1/events/${event._id}`);
    expect(eventDelete.status).toBe(409);
    expect((await Event.findById(event._id).lean()).deletedAt).toBeUndefined();
    const cancelled = await mutation(agent, 'patch', `/api/v1/events/${event._id}/status`, { status: 'CANCELLED' });
    expect(cancelled.status).toBe(200);
    expect((await Task.findById(created.body.data.id).lean()).eventId.toString()).toBe(event._id.toString());

    expect((await mutation(agent, 'delete', `/api/v1/tasks/${created.body.data.id}`)).status).toBe(200);
    expect((await mutation(agent, 'delete', `/api/v1/events/${event._id}`)).status).toBe(200);
    expect((await Event.findById(event._id).lean()).deletedAt).toBeInstanceOf(Date);
  });

  it('coordinates concurrent Task association and Event deletion so no successful Task points to a deleted Event', async () => {
    const { user, wedding, agent } = await adminContext();
    const event = await createEvent(wedding, user);
    const token = await csrfToken(agent);
    const [taskResponse, deleteResponse] = await Promise.all([
      agent.post('/api/v1/tasks')
        .set('X-CSRF-Token', token)
        .send(taskPayload({ eventId: event._id.toString() })),
      agent.delete(`/api/v1/events/${event._id}`).set('X-CSRF-Token', token),
    ]);
    expect([201, 404, 409]).toContain(taskResponse.status);
    expect([200, 409]).toContain(deleteResponse.status);
    const [storedTask, storedEvent] = await Promise.all([
      Task.findOne({ eventId: event._id }).lean(),
      Event.findById(event._id).lean(),
    ]);
    if (storedEvent.deletedAt) expect(storedTask).toBeNull();
    if (taskResponse.status === 201) expect(deleteResponse.status).toBe(409);
    if (deleteResponse.status === 200) expect(taskResponse.status).not.toBe(201);
  });
});
