import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const serverDirectory = new URL('../', import.meta.url).pathname;
const testDatabaseName = `mmm_m9_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
let mongoose; let User; let Wedding; let Event; let Guest; let app; let testConfig; let databaseCreated = false;

function uniqueEmail() { return `m9-${randomUUID().replaceAll('-', '').slice(0, 16)}@example.test`; }
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
  const password = 'M9GuestPassword123';
  const user = await User.create({ name: `M9 ${role}`, email: uniqueEmail(), passwordHash: await require('bcrypt').hash(password, testConfig.bcryptSaltRounds), role, status: 'ACTIVE', activatedAt: new Date() });
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
  const wedding = await Wedding.create({ adminId: user._id, managerId: null, title: 'M9 Test Wedding', partnerOneName: 'Asha', partnerTwoName: 'Dev', weddingDate: '2027-02-15', timeZone: 'Asia/Kolkata', slug: `m9-${randomUUID().replaceAll('-', '').slice(0, 12)}`, websitePublished: false });
  return { user, wedding, agent: await loggedIn(user, password) };
}
async function managerContext() {
  const admin = await createUser('ADMIN'); const manager = await createUser('MANAGER');
  const wedding = await Wedding.create({ adminId: admin.user._id, managerId: manager.user._id, title: 'M9 Manager Wedding', partnerOneName: 'Asha', partnerTwoName: 'Dev', weddingDate: '2027-02-15', timeZone: 'Asia/Kolkata', slug: `m9-${randomUUID().replaceAll('-', '').slice(0, 12)}`, websitePublished: false });
  return { wedding, adminAgent: await loggedIn(admin.user, admin.password), managerAgent: await loggedIn(manager.user, manager.password) };
}
function payload(overrides = {}) { return { familyName: 'Sharma Family', mobile: '+91 (98765) 43210', invitedEvents: [], ...overrides }; }
async function createGuest(agent, body = payload()) { return mutation(agent, 'post', '/api/v1/guests', body); }
async function importCsv(agent, csv, { filename = 'guests.csv', contentType = 'text/csv' } = {}) {
  const token = await csrfToken(agent);
  return agent.post('/api/v1/guests/import').set('X-CSRF-Token', token)
    .attach('file', Buffer.isBuffer(csv) ? csv : Buffer.from(csv), { filename, contentType });
}
async function createEvent(wedding, user, name = 'Haldi') {
  return Event.create({ weddingId: wedding._id, name, eventDate: '2027-02-13', startTime: '10:00', venueName: 'Garden', venueAddress: 'Delhi', status: 'UPCOMING', isPublished: false, createdBy: user._id });
}

describe('M9 Family Guests API', () => {
  beforeAll(async () => {
    let probeConnection; let stage = 'prepare isolated test configuration';
    try {
      const uri = process.env.M9_TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27018/?replicaSet=m9rs';
      if (!['localhost', '127.0.0.1', '::1'].includes(new URL(uri).hostname)) throw new Error('M9 integration tests accept only a loopback MongoDB URI.');
      process.env.NODE_ENV = 'test'; process.env.MONGO_DB_URI = uri; process.env.MONGO_DB_NAME = testDatabaseName;
      process.env.SESSION_SECRET = randomBytes(64).toString('hex'); process.env.FRONTEND_ORIGIN = 'http://localhost:5173'; process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
      const dotenv = require('dotenv'); const originalConfig = dotenv.config; dotenv.config = () => ({ parsed: {} });
      try { testConfig = require(`${serverDirectory}src/config/env.js`); } finally { dotenv.config = originalConfig; }
      mongoose = require('mongoose');
      stage = 'check generated database and replica-set support';
      probeConnection = await mongoose.createConnection(uri, { dbName: 'admin', serverSelectionTimeoutMS: 15000 }).asPromise();
      const hello = await probeConnection.getClient().db('admin').command({ hello: 1 });
      if (!hello.setName) throw new Error('M9 Event-association race tests require a local replica set.');
      const { databases } = await probeConnection.getClient().db('admin').admin().listDatabases({ nameOnly: true });
      if (databases.some(({ name }) => name === testDatabaseName)) throw new Error('Generated M9 database already exists; refusing to modify it.');
      await probeConnection.close(); probeConnection = undefined;
      stage = 'load models and application';
      User = require(`${serverDirectory}src/modules/auth/user.model.js`); Wedding = require(`${serverDirectory}src/modules/wedding/wedding.model.js`);
      Event = require(`${serverDirectory}src/modules/events/event.model.js`); Guest = require(`${serverDirectory}src/modules/guests/guest.model.js`);
      app = require(`${serverDirectory}src/app.js`).createApp({ authRateLimitOverrides: { login: 100 } });
      stage = 'connect to isolated test database'; await require(`${serverDirectory}src/config/database.js`)();
      if (mongoose.connection.name !== testDatabaseName) throw new Error('Backend did not select the isolated M9 test database.');
      databaseCreated = true;
      await Promise.all([Guest.createIndexes(), Event.createIndexes()]);
    } catch (error) {
      if (probeConnection) await probeConnection.close().catch(() => {});
      if (mongoose?.connection?.readyState === 1 && databaseCreated) await mongoose.connection.dropDatabase().catch(() => {});
      if (mongoose?.connection?.readyState) await mongoose.disconnect().catch(() => {});
      const code = error?.code ?? error?.name;
      throw new Error(`Could not safely prepare M9 tests while trying to ${stage}${code ? ` (${code})` : ''}.`, { cause: error });
    }
  }, 60000);

  beforeEach(async () => {
    await Promise.all([Guest.deleteMany({}), Event.deleteMany({}), Wedding.deleteMany({}), User.deleteMany({})]);
    await mongoose.connection.db.collection('rsvps').deleteMany({});
  });
  afterAll(async () => {
    if (!mongoose?.connection?.readyState) return;
    try { if (databaseCreated) { await mongoose.connection.dropDatabase(); databaseCreated = false; } }
    finally { await mongoose.disconnect(); }
  }, 60000);

  it('declares the documented Guest schema and indexes', async () => {
    expect(Object.keys(Guest.schema.paths).sort()).toEqual(['_id', '__v', 'weddingId', 'familyName', 'primaryContactName', 'mobile', 'email', 'familyGroupInfo', 'notes', 'weddingInvitationStatus', 'weddingInvitationSharedAt', 'weddingInvitationSharedBy', 'invitedEvents', 'rsvpAccess', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'deletedAt'].sort());
    expect(Guest.schema.path('weddingInvitationStatus').enumValues).toEqual(['NOT_SENT', 'SHARED']);
    const indexes = [
      [{ weddingId: 1, familyName: 1 }, {}],
      [{ weddingId: 1, mobile: 1 }, {}],
      [{ weddingId: 1, 'invitedEvents.eventId': 1 }, {}],
      [{ 'rsvpAccess.tokenHash': 1 }, { unique: true, partialFilterExpression: { 'rsvpAccess.tokenHash': { $type: 'string' } } }],
    ];
    expect(Guest.schema.indexes()).toEqual(indexes);
    const actual = await Guest.collection.indexes();
    for (const [key, options] of indexes) {
      const index = actual.find((item) => JSON.stringify(item.key) === JSON.stringify(key));
      expect(index).toBeTruthy();
      if (options.unique) { expect(index.unique).toBe(true); expect(index.partialFilterExpression).toEqual(options.partialFilterExpression); }
    }
  });

  it('creates family records, normalizes mobile formatting, and returns duplicate-mobile warnings', async () => {
    const { user, wedding, agent } = await context();
    const first = await createGuest(agent, payload({ primaryContactName: 'Amit', mobile: '+91 (98765) 43210', email: 'amit@example.test' }));
    expect(first.status).toBe(201); expect(first.body.data.mobile).toBe('+919876543210'); expect(first.body.data.warnings).toEqual([]);
    const stored = await Guest.findById(first.body.data.id).lean();
    expect(stored.weddingId.toString()).toBe(wedding._id.toString()); expect(stored.createdBy.toString()).toBe(user._id.toString());
    const duplicate = await createGuest(agent, payload({ mobile: '+91-98765-43210' }));
    expect(duplicate.status).toBe(201); expect(duplicate.body.data.warnings).toHaveLength(1);
    expect(await Guest.countDocuments({ weddingId: wedding._id })).toBe(2);
    for (const body of [payload({ familyName: '' }), payload({ mobile: 'no-number' }), payload({ invitedEvents: [{ eventId: 'bad' }] }), payload({ weddingId: wedding._id.toString() }), payload({ createdBy: user._id.toString() }), payload({ rsvpAccess: { tokenHash: 'secret' } })]) {
      expect((await createGuest(agent, body)).status).toBe(400);
    }
  });

  it('validates invited Event membership and excludes invalid, deleted, or cross-Wedding Events', async () => {
    const first = await context(); const event = await createEvent(first.wedding, first.user);
    const created = await createGuest(first.agent, payload({ invitedEvents: [{ eventId: event._id.toString() }] }));
    expect(created.status).toBe(201); expect(created.body.data.invitedEvents[0].eventId).toBe(event._id.toString());
    expect((await createGuest(first.agent, payload({ invitedEvents: [{ eventId: event._id.toString() }, { eventId: event._id.toString() }] }))).status).toBe(400);
    expect((await createGuest(first.agent, payload({ invitedEvents: [{ eventId: new mongoose.Types.ObjectId().toString() }] }))).status).toBe(404);
    const other = await context(); const otherEvent = await createEvent(other.wedding, other.user);
    expect((await createGuest(first.agent, payload({ invitedEvents: [{ eventId: otherEvent._id.toString() }] }))).status).toBe(404);
    await Event.updateOne({ _id: event._id }, { $set: { deletedAt: new Date() } });
    expect((await createGuest(first.agent, payload({ invitedEvents: [{ eventId: event._id.toString() }] }))).status).toBe(404);
  });

  it('lists active guests with search, event/common-sharing filters, stable order and pagination', async () => {
    const { user, wedding, agent } = await context(); const event = await createEvent(wedding, user);
    const a = await createGuest(agent, payload({ familyName: 'Z Sharma', mobile: '9876543210', invitedEvents: [{ eventId: event._id.toString() }] }));
    const b = await createGuest(agent, payload({ familyName: 'A Sharma', mobile: '9876543211' }));
    await mutation(agent, 'patch', `/api/v1/guests/${b.body.data.id}/invitation-sharing/common`, { status: 'SHARED' });
    const list = await agent.get('/api/v1/guests');
    expect(list.status).toBe(200); expect(list.body.pagination).toEqual({ page: 1, limit: 10, totalRecords: 2, totalPages: 1 });
    expect(list.body.data.map((item) => item.familyName)).toEqual(['A Sharma', 'Z Sharma']);
    expect((await agent.get('/api/v1/guests?search=sharma')).body.data).toHaveLength(2);
    expect((await agent.get(`/api/v1/guests?eventId=${event._id}`)).body.data.map((x) => x.id)).toEqual([a.body.data.id]);
    expect((await agent.get('/api/v1/guests?invitationStatus=SHARED')).body.data.map((x) => x.id)).toEqual([b.body.data.id]);
    expect((await agent.get('/api/v1/guests?page=2&limit=1')).body.pagination).toMatchObject({ page: 2, limit: 1, totalRecords: 2, totalPages: 2 });
    for (const q of ['?page=0', '?limit=101', '?eventId=bad', '?invitationStatus=BAD', '?other=x']) expect((await agent.get(`/api/v1/guests${q}`)).status).toBe(400);
  });

  it('reads and patches only active Wedding records and rejects protected fields', async () => {
    const { user, agent } = await context(); const created = await createGuest(agent);
    const id = created.body.data.id; expect((await agent.get(`/api/v1/guests/${id}`)).body.data.mobile).toBe('+919876543210');
    const update = await mutation(agent, 'patch', `/api/v1/guests/${id}`, { familyName: 'Updated Family', mobile: '98765 43210', notes: 'Updated' });
    expect(update.status).toBe(200); expect(update.body.data).toMatchObject({ familyName: 'Updated Family', mobile: '9876543210', notes: 'Updated', updatedBy: user._id.toString() });
    const duplicate = await createGuest(agent, payload({ familyName: 'Second Family', mobile: '9876543211' }));
    const duplicateWarning = await mutation(agent, 'patch', `/api/v1/guests/${duplicate.body.data.id}`, { mobile: '98765-43210' });
    expect(duplicateWarning.body.data.warnings).toHaveLength(1);
    for (const body of [{ weddingId: new mongoose.Types.ObjectId().toString() }, { createdBy: user._id.toString() }, { updatedBy: user._id.toString() }, { weddingInvitationStatus: 'SHARED' }, { deletedAt: new Date().toISOString() }, {}]) {
      expect((await mutation(agent, 'patch', `/api/v1/guests/${id}`, body)).status).toBe(400);
    }
    expect((await agent.get('/api/v1/guests/not-id')).status).toBe(404);
  });

  it('updates common and event sharing records with status timestamps and authenticated user IDs', async () => {
    const { user, wedding, agent } = await context(); const event = await createEvent(wedding, user);
    const created = await createGuest(agent, payload({ invitedEvents: [{ eventId: event._id.toString() }] })); const id = created.body.data.id;
    const common = await mutation(agent, 'patch', `/api/v1/guests/${id}/invitation-sharing/common`, { status: 'SHARED' });
    expect(common.body.data.weddingInvitationStatus).toBe('SHARED'); expect(common.body.data.weddingInvitationSharedBy).toBe(user._id.toString()); expect(common.body.data.weddingInvitationSharedAt).toBeTruthy();
    const perEvent = await mutation(agent, 'patch', `/api/v1/guests/${id}/invited-events/${event._id}/invitation-sharing`, { status: 'SHARED' });
    expect(perEvent.body.data.invitedEvents[0]).toMatchObject({ invitationStatus: 'SHARED', sharedBy: user._id.toString() }); expect(perEvent.body.data.invitedEvents[0].sharedAt).toBeTruthy();
    const reset = await mutation(agent, 'patch', `/api/v1/guests/${id}/invited-events/${event._id}/invitation-sharing`, { status: 'NOT_SENT' });
    expect(reset.body.data.invitedEvents[0]).toMatchObject({ invitationStatus: 'NOT_SENT' }); expect(reset.body.data.invitedEvents[0].sharedBy).toBeUndefined();
    expect((await mutation(agent, 'patch', `/api/v1/guests/${id}/invitation-sharing/common`, { status: 'DELIVERED' })).status).toBe(400);
    expect((await mutation(agent, 'patch', `/api/v1/guests/${id}/invited-events/${new mongoose.Types.ObjectId()}/invitation-sharing`, { status: 'SHARED' })).status).toBe(404);
  });

  it('soft-deletes guests with RSVP history and hard-deletes guests without history', async () => {
    const { user, wedding, agent } = await context();
    const historyGuest = await createGuest(agent, payload({ familyName: 'History Family' })); const historyId = historyGuest.body.data.id;
    const tokenHash = 'a'.repeat(64);
    await Guest.updateOne({ _id: historyId }, { $set: { rsvpAccess: { tokenHash, createdAt: new Date(), expiresAt: new Date(Date.now() + 10000) } } });
    await mongoose.connection.db.collection('rsvps').insertOne({ weddingId: wedding._id, guestId: new mongoose.Types.ObjectId(historyId), eventId: new mongoose.Types.ObjectId(), response: 'YES' });
    const soft = await mutation(agent, 'delete', `/api/v1/guests/${historyId}`);
    expect(soft.body.data.softDeleted).toBe(true);
    const stored = await Guest.findById(historyId).lean(); expect(stored.deletedAt).toBeTruthy(); expect(stored.rsvpAccess.revokedAt).toBeTruthy(); expect(stored.rsvpAccess.tokenHash).toBe(tokenHash);
    expect((await agent.get(`/api/v1/guests/${historyId}`)).status).toBe(404);
    expect((await agent.get('/api/v1/guests')).body.data).toHaveLength(0);
    expect(await mongoose.connection.db.collection('rsvps').countDocuments({ guestId: new mongoose.Types.ObjectId(historyId) })).toBe(1);
    const safe = await createGuest(agent, payload({ familyName: 'No History' }));
    expect((await mutation(agent, 'delete', `/api/v1/guests/${safe.body.data.id}`)).body.data.softDeleted).toBe(false);
    expect(await Guest.findById(safe.body.data.id)).toBeNull();
    expect(user).toBeTruthy();
  });

  it('keeps contact and RSVP token data private and enforces Admin/Manager, CSRF and Wedding isolation', async () => {
    const first = await managerContext(); const created = await createGuest(first.managerAgent, payload({ email: 'private@example.test', notes: 'private notes' }));
    const id = created.body.data.id;
    await Guest.updateOne({ _id: id }, { $set: { rsvpAccess: { tokenHash: 'b'.repeat(64), createdAt: new Date(), expiresAt: new Date(Date.now() + 10000) } } });
    const read = await first.adminAgent.get(`/api/v1/guests/${id}`);
    expect(read.status).toBe(200); expect(read.body.data).toMatchObject({ email: 'private@example.test', notes: 'private notes' });
    expect(JSON.stringify(read.body)).not.toContain('b'.repeat(64)); expect(read.body.data.rsvpAccess).toBeUndefined();
    const other = await context(); expect((await other.agent.get(`/api/v1/guests/${id}`)).status).toBe(404);
    expect((await mutation(other.agent, 'patch', `/api/v1/guests/${id}`, { familyName: 'Intrusion' })).status).toBe(404);
    const anonymous = require('supertest').agent(app);
    expect((await anonymous.get('/api/v1/guests')).status).toBe(401); expect((await anonymous.post('/api/v1/guests').send(payload())).status).toBe(401);
    expect((await first.managerAgent.post('/api/v1/guests').send(payload())).status).toBe(403);
    expect((await first.managerAgent.patch(`/api/v1/guests/${id}`).send({ familyName: 'No CSRF' })).status).toBe(403);
  });

  it('blocks Event deletion while any Guest retains an invitation reference and coordinates new associations', async () => {
    const { user, wedding, agent } = await context(); const event = await createEvent(wedding, user);
    const created = await createGuest(agent, payload({ invitedEvents: [{ eventId: event._id.toString() }] }));
    expect((await mutation(agent, 'delete', `/api/v1/events/${event._id}`)).status).toBe(409);
    expect((await mutation(agent, 'patch', `/api/v1/events/${event._id}/status`, { status: 'CANCELLED' })).status).toBe(200);
    expect((await Guest.findById(created.body.data.id).lean()).invitedEvents).toHaveLength(1);
    await Guest.updateOne({ _id: created.body.data.id }, { $set: { invitedEvents: [] } });
    expect((await mutation(agent, 'delete', `/api/v1/events/${event._id}`)).status).toBe(200);
  });

  it('coordinates concurrent Guest event association and Event deletion without leaving a dangling invitation', async () => {
    const { user, wedding, agent } = await context(); const event = await createEvent(wedding, user); const token = await csrfToken(agent);
    const [createResponse, deleteResponse] = await Promise.all([
      agent.post('/api/v1/guests').set('X-CSRF-Token', token).send(payload({ invitedEvents: [{ eventId: event._id.toString() }] })),
      agent.delete(`/api/v1/events/${event._id}`).set('X-CSRF-Token', token),
    ]);
    expect([201, 404, 409]).toContain(createResponse.status); expect([200, 409]).toContain(deleteResponse.status);
    const [guest, storedEvent] = await Promise.all([Guest.findOne({ 'invitedEvents.eventId': event._id }).lean(), Event.findById(event._id).lean()]);
    if (storedEvent.deletedAt) expect(guest).toBeNull();
    if (createResponse.status === 201) expect(deleteResponse.status).toBe(409);
    if (deleteResponse.status === 200) expect(createResponse.status).not.toBe(201);
  });

  it('coordinates adding an Event reference through Guest PATCH against Event deletion', async () => {
    const { user, wedding, agent } = await context(); const event = await createEvent(wedding, user);
    const created = await createGuest(agent, payload()); const guestId = created.body.data.id; const token = await csrfToken(agent);
    const [patchResponse, deleteResponse] = await Promise.all([
      agent.patch(`/api/v1/guests/${guestId}`).set('X-CSRF-Token', token).send({ invitedEvents: [{ eventId: event._id.toString() }] }),
      agent.delete(`/api/v1/events/${event._id}`).set('X-CSRF-Token', token),
    ]);
    expect([200, 404, 409]).toContain(patchResponse.status); expect([200, 409]).toContain(deleteResponse.status);
    const [guest, storedEvent] = await Promise.all([
      Guest.findById(guestId).lean(), Event.findById(event._id).lean(),
    ]);
    if (storedEvent.deletedAt) expect(guest.invitedEvents).toHaveLength(0);
    if (patchResponse.status === 200) expect(deleteResponse.status).toBe(409);
    if (deleteResponse.status === 200) expect(patchResponse.status).not.toBe(200);
  });

  it('imports valid CSV rows, reports row errors and duplicate warnings without leaking contact values', async () => {
    const { user, wedding, agent } = await context();
    const existing = await createGuest(agent, payload({ familyName: 'Already Listed', mobile: '+919876543210' }));
    const csv = [
      'familyName,primaryContactName,mobile,email,familyGroupInfo,notes',
      'Valid Family,Asha,+91 98765 11111,asha-private@example.test,Friends,one',
      'Missing Mobile,Dev,,dev-private@example.test,Family,two',
      'Duplicate Family,Uma,+91-98765-11111,uma-private@example.test,Family,three',
      'Existing Duplicate,Rahul,+91 (98765) 43210,private@example.test,Friends,four',
    ].join('\n');
    const response = await importCsv(agent, csv);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ totalRows: 4, importedCount: 3, skippedCount: 1 });
    expect(response.body.data.errors).toHaveLength(1);
    expect(response.body.data.errors[0]).toMatchObject({ rowNumber: 3 });
    expect(response.body.data.warnings).toHaveLength(2);
    expect(response.body.data.warnings.map(({ rowNumber }) => rowNumber)).toEqual([4, 5]);
    const imported = await Guest.find({ weddingId: wedding._id, _id: { $ne: existing.body.data.id } }).sort({ familyName: 1 });
    expect(imported).toHaveLength(3);
    expect(imported.every((guest) => guest.createdBy.toString() === user._id.toString())).toBe(true);
    expect(imported.every((guest) => guest.weddingId.toString() === wedding._id.toString())).toBe(true);
    const publicSummary = JSON.stringify(response.body.data);
    expect(publicSummary).not.toContain('asha-private@example.test');
    expect(publicSummary).not.toContain('private@example.test');
    expect(publicSummary).not.toContain('+919876543210');
  });

  it('rejects empty/invalid CSV files, unsupported headers, missing required headers and oversized row sets', async () => {
    const { agent } = await context();
    expect((await importCsv(agent, Buffer.alloc(0))).status).toBe(400);
    expect((await importCsv(agent, 'familyName,email\nAsha,asha@example.test')).status).toBe(400);
    expect((await importCsv(agent, 'familyName,mobile,unexpected\nAsha,123,yes')).status).toBe(400);
    expect((await importCsv(agent, 'familyName,mobile\n"unterminated,123')).status).toBe(400);
    expect((await importCsv(agent, 'familyName,mobile\nAsha,123', { filename: 'guests.txt' })).status).toBe(400);
    const rows = ['familyName,mobile', ...Array.from({ length: 501 }, (_, index) => `Family ${index},98765${String(index).padStart(5, '0')}`)].join('\n');
    const tooMany = await importCsv(agent, rows);
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.code).toBe('VALIDATION_ERROR');
    expect(await Guest.countDocuments()).toBe(0);
  });

  it('enforces the 2 MiB CSV limit and Admin/Manager, CSRF and Wedding isolation', async () => {
    const manager = await managerContext();
    expect((await manager.managerAgent.post('/api/v1/guests/import').attach('file', Buffer.from('familyName,mobile\nA,123'), 'guests.csv')).status).toBe(403);
    const allowed = await importCsv(manager.managerAgent, 'familyName,mobile\nManager Family,9876543210');
    expect(allowed.status).toBe(200); expect(allowed.body.data.importedCount).toBe(1);
    const anonymous = require('supertest').agent(app);
    expect((await anonymous.post('/api/v1/guests/import').attach('file', Buffer.from('a'), 'guests.csv')).status).toBe(401);
    const noCsrf = await manager.managerAgent.post('/api/v1/guests/import').attach('file', Buffer.from('familyName,mobile\nNo CSRF,123'), 'guests.csv');
    expect(noCsrf.status).toBe(403);
    const oversized = await importCsv(manager.managerAgent, Buffer.alloc(2 * 1024 * 1024 + 1, 'x'));
    expect(oversized.status).toBe(413); expect(oversized.body.error.code).toBe('FILE_TOO_LARGE');
    const other = await context();
    const result = await importCsv(manager.managerAgent, 'familyName,mobile\nOnly First Wedding,9876543211');
    expect(result.status).toBe(200);
    expect(await Guest.countDocuments({ weddingId: other.wedding._id })).toBe(0);
  });

  it('creates 90-day RSVP links with only hashed storage and atomically invalidates prior tokens', async () => {
    const { wedding, agent } = await context(); const created = await createGuest(agent);
    const guestId = created.body.data.id;
    const before = Date.now();
    const first = await mutation(agent, 'post', `/api/v1/guests/${guestId}/rsvp-link`);
    expect(first.status).toBe(200);
    const firstUrl = new URL(first.body.data.rsvpUrl);
    const firstToken = firstUrl.pathname.split('/').at(-1);
    expect(firstUrl.pathname).toBe(`/wedding/${wedding.slug}/rsvp/${firstToken}`);
    expect(firstToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Math.abs(Date.parse(first.body.data.expiresAt) - (before + (90 * 24 * 60 * 60 * 1000)))).toBeLessThanOrEqual(1000);
    const firstHash = require('../src/modules/auth/auth.service.js').hashToken(firstToken);
    const guestService = require('../src/modules/guests/guest.service.js').createGuestService();
    let stored = await Guest.findById(guestId).lean();
    expect(stored.rsvpAccess.tokenHash).toBe(firstHash);
    expect(stored.rsvpAccess.tokenHash).not.toBe(firstToken);
    expect(JSON.stringify(stored)).not.toContain(firstToken);
    const second = await mutation(agent, 'post', `/api/v1/guests/${guestId}/rsvp-link`);
    expect(second.status).toBe(200);
    const secondToken = new URL(second.body.data.rsvpUrl).pathname.split('/').at(-1);
    const secondHash = require('../src/modules/auth/auth.service.js').hashToken(secondToken);
    expect(secondHash).not.toBe(firstHash);
    expect(await guestService.findActiveGuestByRsvpToken(firstToken)).toBeNull();
    expect((await guestService.findActiveGuestByRsvpToken(secondToken))._id.toString()).toBe(guestId);
    stored = await Guest.findById(guestId).lean();
    expect(stored.rsvpAccess.tokenHash).toBe(secondHash);
    expect(stored.rsvpAccess.expiresAt.getTime()).toBeGreaterThan(Date.now());
    await Guest.updateOne({ _id: guestId }, { $set: { 'rsvpAccess.expiresAt': new Date(Date.now() - 1) } });
    expect(await guestService.findActiveGuestByRsvpToken(secondToken)).toBeNull();
    await Guest.updateOne({ _id: guestId }, { $set: { 'rsvpAccess.expiresAt': new Date(Date.now() + 10000), 'rsvpAccess.revokedAt': new Date() } });
    expect(await guestService.findActiveGuestByRsvpToken(secondToken)).toBeNull();
    const other = await context();
    expect((await mutation(other.agent, 'post', `/api/v1/guests/${guestId}/rsvp-link`)).status).toBe(404);
    expect((await agent.post(`/api/v1/guests/${guestId}/rsvp-link`)).status).toBe(403);
  });

  it('revokes a generated RSVP link when a Guest with RSVP history is deleted', async () => {
    const { wedding, agent } = await context(); const created = await createGuest(agent);
    const guestId = created.body.data.id;
    await mutation(agent, 'post', `/api/v1/guests/${guestId}/rsvp-link`);
    await mongoose.connection.db.collection('rsvps').insertOne({ weddingId: wedding._id, guestId: new mongoose.Types.ObjectId(guestId), eventId: new mongoose.Types.ObjectId(), response: 'YES' });
    const deleted = await mutation(agent, 'delete', `/api/v1/guests/${guestId}`);
    expect(deleted.body.data.softDeleted).toBe(true);
    const stored = await Guest.findById(guestId).lean();
    expect(stored.deletedAt).toBeTruthy(); expect(stored.rsvpAccess.revokedAt).toBeTruthy();
    expect((await agent.get(`/api/v1/guests/${guestId}`)).status).toBe(404);
  });
});
