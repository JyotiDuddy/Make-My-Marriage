import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const serverDirectory = new URL('../', import.meta.url).pathname;
const testDatabaseName = `mmm_m8_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
let mongoose; let User; let Wedding; let Event; let Task; let Expense; let app; let testConfig; let databaseCreated = false;

function uniqueEmail() { return `m8-${randomUUID().replaceAll('-', '').slice(0, 16)}@example.test`; }
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
  const password = 'M8ExpensePassword123';
  const user = await User.create({
    name: `M8 ${role}`, email: uniqueEmail(),
    passwordHash: await require('bcrypt').hash(password, testConfig.bcryptSaltRounds),
    role, status: 'ACTIVE', activatedAt: new Date(),
  });
  return { user, password };
}
async function loggedIn(user, password) {
  const agent = require('supertest').agent(app);
  const token = await csrfToken(agent);
  const response = await agent.post('/api/v1/auth/login').set('X-CSRF-Token', token).send({ email: user.email, password });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return agent;
}
async function context() {
  const { user, password } = await createUser('ADMIN');
  const wedding = await Wedding.create({
    adminId: user._id, managerId: null, title: 'M8 Test Wedding', partnerOneName: 'Asha', partnerTwoName: 'Dev',
    weddingDate: '2027-02-15', timeZone: 'Asia/Kolkata', slug: `m8-${randomUUID().replaceAll('-', '').slice(0, 12)}`, websitePublished: false,
  });
  return { user, wedding, agent: await loggedIn(user, password) };
}
async function createManagerContext() {
  const admin = await createUser('ADMIN'); const manager = await createUser('MANAGER');
  const wedding = await Wedding.create({
    adminId: admin.user._id, managerId: manager.user._id, title: 'M8 Manager Wedding', partnerOneName: 'Asha', partnerTwoName: 'Dev',
    weddingDate: '2027-02-15', timeZone: 'Asia/Kolkata', slug: `m8-${randomUUID().replaceAll('-', '').slice(0, 12)}`, websitePublished: false,
  });
  return { wedding, admin: admin.user, adminAgent: await loggedIn(admin.user, admin.password), managerAgent: await loggedIn(manager.user, manager.password) };
}
function payload(overrides = {}) {
  return { title: 'Catering Payment', category: 'CATERING', amountPaise: 8000000, paymentDate: '2027-01-10T10:00:00.000Z', paymentMethod: 'UPI', notes: 'Advance payment', ...overrides };
}
async function createExpense(agent, body = payload()) { return mutation(agent, 'post', '/api/v1/expenses', body); }
async function createEvent(wedding, user, name = 'Haldi') {
  return Event.create({ weddingId: wedding._id, name, eventDate: '2027-02-13', startTime: '10:00', venueName: 'Garden', venueAddress: 'Delhi', status: 'UPCOMING', isPublished: false, createdBy: user._id });
}

describe('M8 Expenses API', () => {
  beforeAll(async () => {
    let probeConnection;
    let stage = 'prepare isolated test configuration';
    try {
      const uri = process.env.M8_TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27018';
      if (!['localhost', '127.0.0.1', '::1'].includes(new URL(uri).hostname)) throw new Error('M8 integration tests accept only a loopback MongoDB URI.');
      process.env.NODE_ENV = 'test'; process.env.MONGO_DB_URI = uri; process.env.MONGO_DB_NAME = testDatabaseName;
      process.env.SESSION_SECRET = randomBytes(64).toString('hex'); process.env.FRONTEND_ORIGIN = 'http://localhost:5173'; process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
      const dotenv = require('dotenv'); const originalConfig = dotenv.config; dotenv.config = () => ({ parsed: {} });
      try { testConfig = require(`${serverDirectory}src/config/env.js`); } finally { dotenv.config = originalConfig; }
      mongoose = require('mongoose');
      stage = 'check generated database name and replica-set support';
      probeConnection = await mongoose.createConnection(uri, { dbName: 'admin', serverSelectionTimeoutMS: 15000 }).asPromise();
      const hello = await probeConnection.getClient().db('admin').command({ hello: 1 });
      if (!hello.setName) throw new Error('M8 Event association race tests require a local replica set.');
      const { databases } = await probeConnection.getClient().db('admin').admin().listDatabases({ nameOnly: true });
      if (databases.some(({ name }) => name === testDatabaseName)) throw new Error('Generated M8 database already exists; refusing to modify it.');
      await probeConnection.close(); probeConnection = undefined;
      stage = 'load models and application';
      User = require(`${serverDirectory}src/modules/auth/user.model.js`);
      Wedding = require(`${serverDirectory}src/modules/wedding/wedding.model.js`);
      Event = require(`${serverDirectory}src/modules/events/event.model.js`);
      Task = require(`${serverDirectory}src/modules/tasks/task.model.js`);
      Expense = require(`${serverDirectory}src/modules/expenses/expense.model.js`);
      app = require(`${serverDirectory}src/app.js`).createApp({ authRateLimitOverrides: { login: 100 } });
      stage = 'connect to isolated test database';
      await require(`${serverDirectory}src/config/database.js`)();
      if (mongoose.connection.name !== testDatabaseName) throw new Error('Backend did not select the isolated M8 test database.');
      databaseCreated = true;
      await Promise.all([Expense.createIndexes(), Event.createIndexes()]);
    } catch (error) {
      if (probeConnection) await probeConnection.close().catch(() => {});
      if (mongoose?.connection?.readyState === 1 && databaseCreated) await mongoose.connection.dropDatabase().catch(() => {});
      if (mongoose?.connection?.readyState) await mongoose.disconnect().catch(() => {});
      const code = error?.code ?? error?.name;
      throw new Error(`Could not safely prepare M8 integration tests while trying to ${stage}${code ? ` (${code})` : ''}.`, { cause: error });
    }
  }, 60000);

  beforeEach(async () => {
    await Promise.all([Expense.deleteMany({}), Task.deleteMany({}), Event.deleteMany({}), Wedding.deleteMany({}), User.deleteMany({})]);
  });
  afterAll(async () => {
    if (!mongoose?.connection?.readyState) return;
    try { if (databaseCreated) { await mongoose.connection.dropDatabase(); databaseCreated = false; } }
    finally { await mongoose.disconnect(); }
  }, 60000);

  it('declares the documented Expense fields, timestamps and exact indexes', async () => {
    expect(Object.keys(Expense.schema.paths).sort()).toEqual(['_id', '__v', 'weddingId', 'title', 'category', 'amountPaise', 'paymentDate', 'paymentMethod', 'eventId', 'notes', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt'].sort());
    expect(Expense.schema.path('category').enumValues).toEqual(['CATERING', 'DECORATION', 'PHOTOGRAPHY', 'VENUE', 'CLOTHING', 'TRANSPORTATION', 'ENTERTAINMENT', 'MISCELLANEOUS']);
    expect(Expense.schema.options.timestamps).toBe(true);
    const expected = [{ weddingId: 1, paymentDate: -1 }, { weddingId: 1, category: 1 }, { weddingId: 1, eventId: 1 }];
    expect(Expense.schema.indexes().map(([fields]) => fields)).toEqual(expected);
    expect((await Expense.collection.indexes()).filter(({ key }) => key.weddingId).map(({ key }) => key)).toEqual(expected);
  });

  it('creates valid actual expenses, stores exact integer paise, derives ownership, and validates required inputs', async () => {
    const { user, wedding, agent } = await context();
    const response = await createExpense(agent);
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ title: 'Catering Payment', amountPaise: 8000000, category: 'CATERING' });
    const stored = await Expense.findById(response.body.data.id).lean();
    expect(stored.amountPaise).toBe(8000000); expect(stored.weddingId.toString()).toBe(wedding._id.toString());
    expect(stored.createdBy.toString()).toBe(user._id.toString());
    for (const field of ['title', 'category', 'amountPaise', 'paymentDate']) {
      const body = payload(); delete body[field]; expect((await createExpense(agent, body)).status, field).toBe(400);
    }
    for (const amountPaise of [0, -1, 1.5, '100', Number.MAX_SAFE_INTEGER + 1]) expect((await createExpense(agent, payload({ amountPaise }))).status).toBe(400);
    expect((await createExpense(agent, payload({ category: 'BUDGET' }))).status).toBe(400);
    expect((await createExpense(agent, payload({ paymentDate: '2027-02-30T10:00:00Z' }))).status).toBe(400);
    expect((await createExpense(agent, payload({ weddingId: new mongoose.Types.ObjectId().toString() }))).status).toBe(400);
    expect((await createExpense(agent, payload({ createdBy: user._id.toString() }))).status).toBe(400);
    expect((await createExpense(agent, payload({ forecast: 900 }))).status).toBe(400);
  });

  it('lists with category, event and inclusive date filters, stable newest-first order, and pagination', async () => {
    const { user, wedding, agent } = await context(); const event = await createEvent(wedding, user);
    const a = await createExpense(agent, payload({ title: 'Jan early', paymentDate: '2027-01-02T10:00:00.000Z', eventId: event._id.toString() }));
    const b = await createExpense(agent, payload({ title: 'Jan later', paymentDate: '2027-01-20T10:00:00.000Z', category: 'VENUE' }));
    await createExpense(agent, payload({ title: 'Feb', paymentDate: '2027-02-01T10:00:00.000Z' }));
    const all = await agent.get('/api/v1/expenses');
    expect(all.status).toBe(200); expect(all.body.pagination).toEqual({ page: 1, limit: 10, totalRecords: 3, totalPages: 1 });
    expect(all.body.data.map((item) => item.title)).toEqual(['Feb', 'Jan later', 'Jan early']);
    expect((await agent.get('/api/v1/expenses?category=VENUE')).body.data.map((x) => x.id)).toEqual([b.body.data.id]);
    expect((await agent.get(`/api/v1/expenses?eventId=${event._id}`)).body.data.map((x) => x.id)).toEqual([a.body.data.id]);
    expect((await agent.get('/api/v1/expenses?dateFrom=2027-01-01&dateTo=2027-01-31')).body.data).toHaveLength(2);
    const page = await agent.get('/api/v1/expenses?page=2&limit=2');
    expect(page.body.pagination).toEqual({ page: 2, limit: 2, totalRecords: 3, totalPages: 2 }); expect(page.body.data).toHaveLength(1);
    for (const query of ['?page=0', '?limit=101', '?category=BAD', '?eventId=bad', '?dateFrom=2027-02-30', '?dateFrom=2027-02-01&dateTo=2027-01-01', '?unknown=x']) expect((await agent.get(`/api/v1/expenses${query}`)).status).toBe(400);
  });

  it('reads and patches only the Wedding Expense, derives updater, and supports clearing optional values', async () => {
    const { user, agent } = await context(); const created = await createExpense(agent);
    const id = created.body.data.id; expect((await agent.get(`/api/v1/expenses/${id}`)).body.data.id).toBe(id);
    const patch = await mutation(agent, 'patch', `/api/v1/expenses/${id}`, { title: 'Final payment', amountPaise: 2000000, notes: '' });
    expect(patch.status).toBe(200); expect(patch.body.data).toMatchObject({ title: 'Final payment', amountPaise: 2000000, notes: '' });
    expect((await Expense.findById(id).lean()).updatedBy.toString()).toBe(user._id.toString());
    for (const body of [{ weddingId: new mongoose.Types.ObjectId().toString() }, { createdBy: user._id.toString() }, { updatedBy: user._id.toString() }, { createdAt: new Date().toISOString() }, { amountPaise: 1.25 }, { category: 'OTHER' }, {}]) {
      expect((await mutation(agent, 'patch', `/api/v1/expenses/${id}`, body)).status).toBe(400);
    }
    expect((await agent.get('/api/v1/expenses/not-an-id')).status).toBe(404);
    expect((await mutation(agent, 'delete', `/api/v1/expenses/${id}`)).status).toBe(200);
    expect(await Expense.findById(id)).toBeNull();
    expect((await agent.get(`/api/v1/expenses/${id}`)).status).toBe(404);
  });

  it('validates optional Event references and prevents cross-Wedding access', async () => {
    const first = await context(); const event = await createEvent(first.wedding, first.user);
    const linked = await createExpense(first.agent, payload({ eventId: event._id.toString() }));
    expect(linked.status).toBe(201); expect(linked.body.data.eventId).toBe(event._id.toString());
    const second = await context(); const otherEvent = await createEvent(second.wedding, second.user);
    expect((await createExpense(first.agent, payload({ eventId: 'bad' }))).status).toBe(400);
    expect((await createExpense(first.agent, payload({ eventId: new mongoose.Types.ObjectId().toString() }))).status).toBe(404);
    expect((await createExpense(first.agent, payload({ eventId: otherEvent._id.toString() }))).status).toBe(404);
    await Event.updateOne({ _id: event._id }, { $set: { deletedAt: new Date() } });
    expect((await createExpense(first.agent, payload({ eventId: event._id.toString() }))).status).toBe(404);
    expect((await second.agent.get(`/api/v1/expenses/${linked.body.data.id}`)).status).toBe(404);
  });

  it('allows Admin and Manager shared access and enforces authentication, role, and CSRF', async () => {
    const { admin, wedding, adminAgent, managerAgent } = await createManagerContext();
    const response = await createExpense(managerAgent);
    expect(response.status).toBe(201);
    expect((await adminAgent.get(`/api/v1/expenses/${response.body.data.id}`)).status).toBe(200);
    expect((await adminAgent.get('/api/v1/expenses')).body.data.map((item) => item.id)).toContain(response.body.data.id);
    expect((await Expense.findById(response.body.data.id).lean()).weddingId.toString()).toBe(wedding._id.toString());
    expect((await Expense.findById(response.body.data.id).lean()).createdBy.toString()).not.toBe(admin._id.toString());
    const anonymous = require('supertest').agent(app);
    expect((await anonymous.get('/api/v1/expenses')).status).toBe(401);
    expect((await anonymous.post('/api/v1/expenses').send(payload())).status).toBe(401);
    expect((await managerAgent.post('/api/v1/expenses').send(payload())).status).toBe(403);
    expect((await managerAgent.patch(`/api/v1/expenses/${response.body.data.id}`).send({ title: 'no csrf' })).status).toBe(403);
    expect((await managerAgent.delete(`/api/v1/expenses/${response.body.data.id}`)).status).toBe(403);
  });

  it('blocks Event deletion for linked Expenses and preserves them when the Event is cancelled', async () => {
    const { user, wedding, agent } = await context(); const event = await createEvent(wedding, user);
    const created = await createExpense(agent, payload({ eventId: event._id.toString() }));
    expect((await mutation(agent, 'delete', `/api/v1/events/${event._id}`)).status).toBe(409);
    expect((await Event.findById(event._id).lean()).deletedAt).toBeUndefined();
    expect((await mutation(agent, 'patch', `/api/v1/events/${event._id}/status`, { status: 'CANCELLED' })).status).toBe(200);
    expect((await Expense.findById(created.body.data.id).lean()).eventId.toString()).toBe(event._id.toString());
    expect((await mutation(agent, 'delete', `/api/v1/expenses/${created.body.data.id}`)).status).toBe(200);
    expect((await mutation(agent, 'delete', `/api/v1/events/${event._id}`)).status).toBe(200);
  });

  it('coordinates concurrent Expense association and Event deletion on the existing Event document', async () => {
    const { user, wedding, agent } = await context(); const event = await createEvent(wedding, user);
    const token = await csrfToken(agent);
    const [expenseResponse, deleteResponse] = await Promise.all([
      agent.post('/api/v1/expenses').set('X-CSRF-Token', token).send(payload({ eventId: event._id.toString() })),
      agent.delete(`/api/v1/events/${event._id}`).set('X-CSRF-Token', token),
    ]);
    expect([201, 404, 409]).toContain(expenseResponse.status); expect([200, 409]).toContain(deleteResponse.status);
    const [storedExpense, storedEvent] = await Promise.all([Expense.findOne({ eventId: event._id }).lean(), Event.findById(event._id).lean()]);
    if (storedEvent.deletedAt) expect(storedExpense).toBeNull();
    if (expenseResponse.status === 201) expect(deleteResponse.status).toBe(409);
    if (deleteResponse.status === 200) expect(expenseResponse.status).not.toBe(201);
  });

  it('coordinates adding an Event reference through PATCH against Event deletion', async () => {
    const { user, wedding, agent } = await context();
    const event = await createEvent(wedding, user);
    const expense = await createExpense(agent);
    const token = await csrfToken(agent);
    const [patchResponse, deleteResponse] = await Promise.all([
      agent.patch(`/api/v1/expenses/${expense.body.data.id}`).set('X-CSRF-Token', token).send({ eventId: event._id.toString() }),
      agent.delete(`/api/v1/events/${event._id}`).set('X-CSRF-Token', token),
    ]);
    expect([200, 404, 409]).toContain(patchResponse.status);
    expect([200, 409]).toContain(deleteResponse.status);
    const [storedExpense, storedEvent] = await Promise.all([
      Expense.findById(expense.body.data.id).lean(),
      Event.findById(event._id).lean(),
    ]);
    if (storedEvent.deletedAt) expect(storedExpense.eventId).toBeUndefined();
    if (patchResponse.status === 200) expect(deleteResponse.status).toBe(409);
    if (deleteResponse.status === 200) expect(patchResponse.status).not.toBe(200);
  });
});
