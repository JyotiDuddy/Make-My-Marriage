import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const serverDirectory = new URL('../', import.meta.url).pathname;
const testDatabaseName = `mmm_m12_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const FIXED_NOW = new Date('2027-02-13T04:30:00.000Z'); // 10:00 in Asia/Kolkata
let mongoose; let User; let Wedding; let Event; let Expense; let Guest; let RSVP; let Task; let app; let databaseCreated = false;

function uniqueEmail() { return `m12-${randomUUID().replaceAll('-', '').slice(0, 16)}@example.test`; }

async function createUser(role = 'ADMIN') {
  const password = 'M12DashboardPassword123';
  const user = await User.create({
    name: `M12 ${role}`,
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

async function context({ withManager = false, timeZone = 'Asia/Kolkata' } = {}) {
  const admin = await createUser('ADMIN');
  const manager = withManager ? await createUser('MANAGER') : undefined;
  const wedding = await Wedding.create({
    adminId: admin.user._id,
    ...(manager ? { managerId: manager.user._id } : { managerId: null }),
    title: 'M12 Test Wedding',
    partnerOneName: 'Asha',
    partnerTwoName: 'Dev',
    weddingDate: '2027-02-15',
    timeZone,
    slug: `m12-${randomUUID().replaceAll('-', '').slice(0, 12)}`,
    websitePublished: false,
  });
  return {
    admin: admin.user,
    adminAgent: await login(admin.user, admin.password),
    wedding,
    ...(manager ? { manager: manager.user, managerAgent: await login(manager.user, manager.password) } : {}),
  };
}

async function addEvent(weddingId, createdBy, overrides = {}) {
  return Event.create({
    weddingId,
    name: 'Haldi',
    eventDate: '2027-02-13',
    startTime: '10:00',
    venueName: 'Garden',
    venueAddress: 'Delhi',
    status: 'UPCOMING',
    isPublished: false,
    createdBy,
    ...overrides,
  });
}

async function addGuest(weddingId, createdBy, invitedEventIds = [], overrides = {}) {
  return Guest.create({
    weddingId,
    familyName: `Family ${randomUUID().slice(0, 6)}`,
    mobile: `98765${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
    email: 'private@example.test',
    invitedEvents: invitedEventIds.map((eventId) => ({ eventId, invitationStatus: 'NOT_SENT' })),
    createdBy,
    ...overrides,
  });
}

async function getSummary(agent, query = '') {
  return agent.get(`/api/v1/dashboard/summary${query}`);
}

describe('M12 Dashboard Summary API', () => {
  beforeAll(async () => {
    let probeConnection; let stage = 'prepare isolated test configuration';
    try {
      const uri = process.env.M12_TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27018/?replicaSet=m9rs';
      if (!['localhost', '127.0.0.1', '::1'].includes(new URL(uri).hostname)) throw new Error('M12 integration tests accept only a loopback MongoDB URI.');
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
      if (!hello.setName) throw new Error('M12 tests require the local replica set.');
      const { databases } = await probeConnection.getClient().db('admin').admin().listDatabases({ nameOnly: true });
      if (databases.some(({ name }) => name === testDatabaseName)) throw new Error('Generated M12 database already exists; refusing to modify it.');
      await probeConnection.close(); probeConnection = undefined;
      stage = 'load models and application';
      User = require(`${serverDirectory}src/modules/auth/user.model.js`);
      Wedding = require(`${serverDirectory}src/modules/wedding/wedding.model.js`);
      Event = require(`${serverDirectory}src/modules/events/event.model.js`);
      Expense = require(`${serverDirectory}src/modules/expenses/expense.model.js`);
      Guest = require(`${serverDirectory}src/modules/guests/guest.model.js`);
      RSVP = require(`${serverDirectory}src/modules/rsvp/rsvp.model.js`);
      Task = require(`${serverDirectory}src/modules/tasks/task.model.js`);
      const { createDashboardService } = require(`${serverDirectory}src/modules/dashboard/dashboard.service.js`);
      app = require(`${serverDirectory}src/app.js`).createApp({ dashboardService: createDashboardService({ now: () => new Date(FIXED_NOW) }) });
      stage = 'connect to isolated M12 database';
      await require(`${serverDirectory}src/config/database.js`)();
      if (mongoose.connection.name !== testDatabaseName) throw new Error('Backend did not select the isolated M12 test database.');
      databaseCreated = true;
      await Promise.all([Event.createIndexes(), Expense.createIndexes(), Guest.createIndexes(), RSVP.createIndexes(), Task.createIndexes()]);
    } catch (error) {
      if (probeConnection) await probeConnection.close().catch(() => {});
      if (mongoose?.connection?.readyState === 1 && databaseCreated) await mongoose.connection.dropDatabase().catch(() => {});
      if (mongoose?.connection?.readyState) await mongoose.disconnect().catch(() => {});
      const code = error?.code ?? error?.name;
      throw new Error(`Could not safely prepare M12 tests while trying to ${stage}${code ? ` (${code})` : ''}.`, { cause: error });
    }
  }, 60000);

  beforeEach(async () => {
    await Promise.all([RSVP.deleteMany({}), Guest.deleteMany({}), Expense.deleteMany({}), Task.deleteMany({}), Event.deleteMany({}), Wedding.deleteMany({}), User.deleteMany({})]);
  });

  afterAll(async () => {
    if (!mongoose?.connection?.readyState) return;
    try { if (databaseCreated) { await mongoose.connection.dropDatabase(); databaseCreated = false; } }
    finally { await mongoose.disconnect(); }
  }, 60000);

  it('returns the exact documented summary fields with zeroes for empty collections', async () => {
    const { adminAgent } = await context();
    const response = await getSummary(adminAgent);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(Object.keys(response.body.data).sort()).toEqual([
      'totalEvents', 'upcomingEvents', 'totalExpensesPaise', 'totalFamilies', 'acceptedRsvps', 'pendingRsvps', 'upcomingTasks',
    ].sort());
    expect(response.body.data).toEqual({ totalEvents: 0, upcomingEvents: 0, totalExpensesPaise: 0, totalFamilies: 0, acceptedRsvps: 0, pendingRsvps: 0, upcomingTasks: 0 });
  });

  it('counts all non-deleted Events but only UPCOMING Events at or after now in Wedding local time', async () => {
    const { admin, adminAgent, wedding } = await context();
    const exactBoundary = await addEvent(wedding._id, admin._id, { startTime: '10:00' });
    await addEvent(wedding._id, admin._id, { startTime: '10:01' });
    await addEvent(wedding._id, admin._id, { startTime: '09:59' });
    await addEvent(wedding._id, admin._id, { startTime: '10:00', status: 'COMPLETED' });
    await addEvent(wedding._id, admin._id, { startTime: '10:00', status: 'CANCELLED' });
    await addEvent(wedding._id, admin._id, { startTime: '10:00', deletedAt: new Date() });
    const other = await context();
    await addEvent(other.wedding._id, other.admin._id, { startTime: '10:00' });

    const response = await getSummary(adminAgent);
    expect(response.body.data).toMatchObject({ totalEvents: 5, upcomingEvents: 2 });
    expect(exactBoundary.startTime).toBe('10:00');
  });

  it('applies the Wedding IANA timezone when counting upcoming Events', async () => {
    const { admin, adminAgent, wedding } = await context({ timeZone: 'America/Los_Angeles' });
    await addEvent(wedding._id, admin._id, { eventDate: '2027-02-12', startTime: '20:29' });
    await addEvent(wedding._id, admin._id, { eventDate: '2027-02-12', startTime: '20:30' });
    const response = await getSummary(adminAgent);
    expect(response.body.data).toMatchObject({ totalEvents: 2, upcomingEvents: 1 });
  });

  it('sums actual expenses in integer paise and scopes the total to the Wedding', async () => {
    const { admin, adminAgent, wedding } = await context();
    const other = await context();
    await Expense.create([
      { weddingId: wedding._id, title: 'Venue', category: 'VENUE', amountPaise: 8000000, paymentDate: new Date('2027-01-01'), createdBy: admin._id },
      { weddingId: wedding._id, title: 'Food', category: 'CATERING', amountPaise: 1234567, paymentDate: new Date('2027-01-02'), createdBy: admin._id },
      { weddingId: other.wedding._id, title: 'Other', category: 'VENUE', amountPaise: 9999999, paymentDate: new Date('2027-01-03'), createdBy: other.admin._id },
    ]);
    const response = await getSummary(adminAgent);
    expect(response.body.data.totalExpensesPaise).toBe(9234567);
    expect(Number.isInteger(response.body.data.totalExpensesPaise)).toBe(true);
  });

  it('counts active family records and excludes soft-deleted Guests', async () => {
    const { admin, adminAgent, wedding } = await context();
    await addGuest(wedding._id, admin._id);
    await addGuest(wedding._id, admin._id, [], { deletedAt: new Date() });
    const other = await context(); await addGuest(other.wedding._id, other.admin._id);
    const response = await getSummary(adminAgent);
    expect(response.body.data.totalFamilies).toBe(1);
    expect(JSON.stringify(response.body)).not.toContain('private@example.test');
    expect(JSON.stringify(response.body)).not.toContain('98765');
  });

  it('counts accepted YES and pending invited family-Event pairs while excluding NO and ineligible pairs', async () => {
    const { admin, adminAgent, wedding } = await context();
    const eventA = await addEvent(wedding._id, admin._id);
    const eventB = await addEvent(wedding._id, admin._id, { name: 'Wedding', eventDate: '2027-02-15' });
    const eventC = await addEvent(wedding._id, admin._id, { name: 'Reception', eventDate: '2027-02-16' });
    const cancelled = await addEvent(wedding._id, admin._id, { status: 'CANCELLED' });
    const deleted = await addEvent(wedding._id, admin._id, { deletedAt: new Date() });
    const familyA = await addGuest(wedding._id, admin._id, [eventA._id, eventA._id, eventB._id, eventC._id, cancelled._id, deleted._id]);
    const familyB = await addGuest(wedding._id, admin._id, [eventA._id, eventB._id]);
    const familyDeleted = await addGuest(wedding._id, admin._id, [eventA._id], { deletedAt: new Date() });
    await RSVP.create([
      { weddingId: wedding._id, guestId: familyA._id, eventId: eventA._id, response: 'YES', respondedAt: FIXED_NOW },
      { weddingId: wedding._id, guestId: familyA._id, eventId: eventB._id, response: 'YES', respondedAt: FIXED_NOW },
      { weddingId: wedding._id, guestId: familyB._id, eventId: eventA._id, response: 'YES', respondedAt: FIXED_NOW },
      { weddingId: wedding._id, guestId: familyB._id, eventId: eventB._id, response: 'NO', respondedAt: FIXED_NOW },
      { weddingId: wedding._id, guestId: familyDeleted._id, eventId: eventA._id, response: 'YES', respondedAt: FIXED_NOW },
    ]);
    const other = await context(); const otherEvent = await addEvent(other.wedding._id, other.admin._id);
    const otherGuest = await addGuest(other.wedding._id, other.admin._id, [otherEvent._id]);
    await RSVP.create({ weddingId: other.wedding._id, guestId: otherGuest._id, eventId: otherEvent._id, response: 'YES', respondedAt: FIXED_NOW });

    const response = await getSummary(adminAgent);
    expect(response.body.data).toMatchObject({ acceptedRsvps: 3, pendingRsvps: 1 });
  });

  it('counts due Tasks by status and excludes past deadlines and cancelled/deleted Event associations', async () => {
    const { admin, adminAgent, wedding } = await context();
    const eligibleEvent = await addEvent(wedding._id, admin._id);
    const cancelledEvent = await addEvent(wedding._id, admin._id, { status: 'CANCELLED' });
    const deletedEvent = await addEvent(wedding._id, admin._id, { deletedAt: new Date() });
    const other = await context(); const otherEvent = await addEvent(other.wedding._id, other.admin._id);
    const due = new Date(FIXED_NOW);
    const taskBase = { weddingId: wedding._id, title: 'Task', deadline: due, priority: 'MEDIUM', status: 'TODO', createdBy: admin._id };
    await Task.create([
      { ...taskBase, title: 'No event' },
      { ...taskBase, title: 'Eligible Event', eventId: eligibleEvent._id, status: 'IN_PROGRESS' },
      { ...taskBase, title: 'Past deadline', deadline: new Date(FIXED_NOW.getTime() - 1) },
      { ...taskBase, title: 'Completed', status: 'COMPLETED' },
      { ...taskBase, title: 'Cancelled Event', eventId: cancelledEvent._id },
      { ...taskBase, title: 'Deleted Event', eventId: deletedEvent._id },
      { ...taskBase, weddingId: other.wedding._id, createdBy: other.admin._id, title: 'Other wedding', eventId: otherEvent._id },
    ]);
    const response = await getSummary(adminAgent);
    expect(response.body.data.upcomingTasks).toBe(2);
  });

  it('allows the assigned Manager and Admin, denies anonymous users, ignores client Wedding IDs, and preserves isolation', async () => {
    const first = await context({ withManager: true });
    const other = await context();
    await addEvent(first.wedding._id, first.admin._id);
    await addEvent(other.wedding._id, other.admin._id);
    const adminResponse = await getSummary(first.adminAgent, `?weddingId=${other.wedding._id}`);
    const managerResponse = await getSummary(first.managerAgent, `?weddingId=${other.wedding._id}`);
    expect(adminResponse.status).toBe(200); expect(adminResponse.body.data.totalEvents).toBe(1);
    expect(managerResponse.status).toBe(200); expect(managerResponse.body.data.totalEvents).toBe(1);
    expect((await require('supertest')(app).get('/api/v1/dashboard/summary')).status).toBe(401);
    expect(JSON.stringify(adminResponse.body)).not.toContain(other.wedding._id.toString());

    // Insert a legacy/invalid role directly to exercise route authorization
    // independently of the User schema's role enum validation.
    const password = 'M12UnauthorizedPassword123';
    const unauthorized = {
      _id: new mongoose.Types.ObjectId(),
      name: 'M12 Unauthorized Role',
      email: uniqueEmail(),
      passwordHash: await require('bcrypt').hash(password, 10),
      role: 'GUEST',
      status: 'ACTIVE',
      activatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await User.collection.insertOne(unauthorized);
    const unauthorizedAgent = await login(await User.findById(unauthorized._id), password);
    expect((await getSummary(unauthorizedAgent)).status).toBe(403);
  });
});
