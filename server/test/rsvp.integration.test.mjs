import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const serverDirectory = new URL('../', import.meta.url).pathname;
const testDatabaseName = `mmm_m11_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
let mongoose; let User; let Wedding; let Event; let Guest; let RSVP; let app; let rsvpConfig; let databaseCreated = false;

function hash(token) { return createHash('sha256').update(token).digest('hex'); }
function uniqueEmail() { return `m11-${randomUUID().replaceAll('-', '').slice(0, 16)}@example.test`; }
function token() { return randomBytes(32).toString('base64url'); }

async function createContext({ published = false } = {}) {
  const password = 'M11TestPassword123';
  const user = await User.create({ name: 'M11 Admin', email: uniqueEmail(), passwordHash: await require('bcrypt').hash(password, 10), role: 'ADMIN', status: 'ACTIVE', activatedAt: new Date() });
  const wedding = await Wedding.create({ adminId: user._id, managerId: null, title: 'M11 Wedding', partnerOneName: 'Asha', partnerTwoName: 'Dev', weddingDate: '2027-02-15', timeZone: 'Asia/Kolkata', slug: `m11-${randomUUID().replaceAll('-', '').slice(0, 12)}`, websitePublished: published });
  return { user, wedding, password };
}

async function adminAgent(user, password) {
  const agent = require('supertest').agent(app);
  const csrf = await agent.get('/api/v1/auth/csrf');
  const login = await agent.post('/api/v1/auth/login').set('X-CSRF-Token', csrf.body.data.csrfToken).send({ email: user.email, password });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  return agent;
}

async function createEvent(weddingId, createdBy, overrides = {}) {
  return Event.create({ weddingId, name: 'Haldi Ceremony', eventDate: '2027-02-13', startTime: '10:00', venueName: 'Garden', venueAddress: 'Delhi', status: 'UPCOMING', isPublished: false, createdBy, ...overrides });
}

async function createFamily(weddingId, invitedEvents = [], overrides = {}) {
  const rawToken = token();
  const guest = await Guest.create({
    weddingId,
    familyName: 'Sharma Family',
    primaryContactName: 'Private Name',
    mobile: '+919876543210',
    email: 'private@example.test',
    notes: 'private note',
    invitedEvents: invitedEvents.map((eventId) => ({ eventId, invitationStatus: 'NOT_SENT' })),
    rsvpAccess: { tokenHash: hash(rawToken), createdAt: new Date(), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
    createdBy: new mongoose.Types.ObjectId(),
    ...overrides,
  });
  return { guest, rawToken };
}

describe('M11 Family RSVP API', () => {
  beforeAll(async () => {
    let probeConnection; let stage = 'prepare isolated test configuration';
    try {
      const uri = process.env.M11_TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27018/?replicaSet=m9rs';
      if (!['localhost', '127.0.0.1', '::1'].includes(new URL(uri).hostname)) throw new Error('M11 integration tests accept only a loopback MongoDB URI.');
      process.env.NODE_ENV = 'test'; process.env.MONGO_DB_URI = uri; process.env.MONGO_DB_NAME = testDatabaseName;
      process.env.SESSION_SECRET = randomBytes(64).toString('hex'); process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
      process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100'; process.env.PUBLIC_RSVP_GET_RATE_LIMIT_MAX = '20'; process.env.PUBLIC_RSVP_PUT_RATE_LIMIT_MAX = '20';
      const dotenv = require('dotenv'); const originalConfig = dotenv.config; dotenv.config = () => ({ parsed: {} });
      try { rsvpConfig = require(`${serverDirectory}src/config/env.js`); } finally { dotenv.config = originalConfig; }
      mongoose = require('mongoose');
      stage = 'check generated database and replica-set support';
      probeConnection = await mongoose.createConnection(uri, { dbName: 'admin', serverSelectionTimeoutMS: 15000 }).asPromise();
      const hello = await probeConnection.getClient().db('admin').command({ hello: 1 });
      if (!hello.setName) throw new Error('M11 transactions require a local replica set.');
      const { databases } = await probeConnection.getClient().db('admin').admin().listDatabases({ nameOnly: true });
      if (databases.some(({ name }) => name === testDatabaseName)) throw new Error('Generated M11 database already exists; refusing to modify it.');
      await probeConnection.close(); probeConnection = undefined;
      stage = 'load application models and routes';
      User = require(`${serverDirectory}src/modules/auth/user.model.js`); Wedding = require(`${serverDirectory}src/modules/wedding/wedding.model.js`);
      Event = require(`${serverDirectory}src/modules/events/event.model.js`); Guest = require(`${serverDirectory}src/modules/guests/guest.model.js`);
      RSVP = require(`${serverDirectory}src/modules/rsvp/rsvp.model.js`);
      app = require(`${serverDirectory}src/app.js`).createApp({ rsvpRateLimitOverrides: { get: 20, put: 20 } });
      stage = 'connect to isolated M11 database'; await require(`${serverDirectory}src/config/database.js`)();
      if (mongoose.connection.name !== testDatabaseName) throw new Error('Backend did not select the isolated M11 test database.');
      databaseCreated = true;
      await Promise.all([RSVP.createIndexes(), Guest.createIndexes(), Event.createIndexes()]);
    } catch (error) {
      if (probeConnection) await probeConnection.close().catch(() => {});
      if (mongoose?.connection?.readyState === 1 && databaseCreated) await mongoose.connection.dropDatabase().catch(() => {});
      if (mongoose?.connection?.readyState) await mongoose.disconnect().catch(() => {});
      const code = error?.code ?? error?.name;
      throw new Error(`Could not safely prepare M11 tests while trying to ${stage}${code ? ` (${code})` : ''}.`, { cause: error });
    }
  }, 60000);

  beforeEach(async () => {
    await Promise.all([RSVP.deleteMany({}), Guest.deleteMany({}), Event.deleteMany({}), Wedding.deleteMany({}), User.deleteMany({})]);
  });

  afterAll(async () => {
    if (!mongoose?.connection?.readyState) return;
    try { if (databaseCreated) { await mongoose.connection.dropDatabase(); databaseCreated = false; } }
    finally { await mongoose.disconnect(); }
  }, 60000);

  it('declares the documented RSVP fields, enums and indexes', async () => {
    expect(Object.keys(RSVP.schema.paths).sort()).toEqual(['_id', '__v', 'weddingId', 'guestId', 'eventId', 'response', 'respondedAt', 'createdAt', 'updatedAt'].sort());
    expect(RSVP.schema.path('response').enumValues).toEqual(['YES', 'NO']);
    expect(RSVP.schema.indexes()).toEqual([
      [{ weddingId: 1, guestId: 1, eventId: 1 }, { unique: true }],
      [{ weddingId: 1, eventId: 1, response: 1 }, {}],
    ]);
    const actual = await RSVP.collection.indexes();
    expect(actual.some((index) => index.unique && JSON.stringify(index.key) === JSON.stringify({ weddingId: 1, guestId: 1, eventId: 1 }))).toBe(true);
    expect(actual.some((index) => JSON.stringify(index.key) === JSON.stringify({ weddingId: 1, eventId: 1, response: 1 }))).toBe(true);
  });

  it('returns only active invited non-cancelled events and that family’s responses, even for an unpublished wedding', async () => {
    const { user, wedding } = await createContext();
    const firstEvent = await createEvent(wedding._id, user._id);
    const secondEvent = await createEvent(wedding._id, user._id, { name: 'Wedding Ceremony', eventDate: '2027-02-15' });
    const cancelled = await createEvent(wedding._id, user._id, { status: 'CANCELLED' });
    const deleted = await createEvent(wedding._id, user._id, { deletedAt: new Date() });
    const other = await createFamily(wedding._id, [secondEvent._id]);
    const { guest, rawToken } = await createFamily(wedding._id, [firstEvent._id, secondEvent._id, cancelled._id, deleted._id]);
    await RSVP.create({ weddingId: wedding._id, guestId: guest._id, eventId: firstEvent._id, response: 'YES', respondedAt: new Date() });
    await RSVP.create({ weddingId: wedding._id, guestId: other.guest._id, eventId: secondEvent._id, response: 'NO', respondedAt: new Date() });

    const response = await require('supertest')(app).get(`/api/v1/public/rsvp/${rawToken}`);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.body.data).toMatchObject({ familyName: 'Sharma Family', wedding: { title: 'M11 Wedding', slug: wedding.slug } });
    expect(response.body.data.events).toEqual([
      expect.objectContaining({ eventId: firstEvent._id.toString(), name: firstEvent.name, existingResponse: 'YES', canRespond: true }),
      expect.objectContaining({ eventId: secondEvent._id.toString(), name: secondEvent.name, existingResponse: null, canRespond: true }),
    ]);
    expect(JSON.stringify(response.body)).not.toContain('private@example.test');
    expect(JSON.stringify(response.body)).not.toContain('9876543210');
    expect(JSON.stringify(response.body)).not.toContain(other.guest._id.toString());
    expect(JSON.stringify(response.body)).not.toContain(hash(rawToken));
    expect(wedding.websitePublished).toBe(false);
  });

  it('rejects malformed, unknown, expired, revoked, regenerated and deleted-family tokens uniformly', async () => {
    const { wedding } = await createContext();
    const { guest, rawToken } = await createFamily(wedding._id);
    const agent = require('supertest')(app);
    const invalid = await agent.get(`/api/v1/public/rsvp/${'a'.repeat(43)}`);
    const malformed = await agent.get('/api/v1/public/rsvp/not-a-token');
    expect(invalid.status).toBe(404); expect(malformed.status).toBe(404);
    expect(invalid.body).toEqual(malformed.body);
    const expired = token();
    await Guest.updateOne({ _id: guest._id }, { $set: { 'rsvpAccess.tokenHash': hash(expired), 'rsvpAccess.expiresAt': new Date(Date.now() - 1000) } });
    expect((await agent.get(`/api/v1/public/rsvp/${expired}`)).body).toEqual(invalid.body);
    await Guest.updateOne({ _id: guest._id }, { $set: { 'rsvpAccess.tokenHash': hash(rawToken), 'rsvpAccess.expiresAt': new Date(Date.now() + 60000), 'rsvpAccess.revokedAt': new Date() } });
    expect((await agent.get(`/api/v1/public/rsvp/${rawToken}`)).body).toEqual(invalid.body);
    const replacement = token();
    await Guest.updateOne({ _id: guest._id }, { $set: { 'rsvpAccess.tokenHash': hash(replacement), 'rsvpAccess.revokedAt': null } });
    expect((await agent.get(`/api/v1/public/rsvp/${rawToken}`)).body).toEqual(invalid.body);
    await Guest.deleteOne({ _id: guest._id });
    expect((await agent.get(`/api/v1/public/rsvp/${replacement}`)).body).toEqual(invalid.body);
  });

  it('creates, updates and idempotently repeats the same family-event response without session or CSRF', async () => {
    const { user, wedding } = await createContext(); const event = await createEvent(wedding._id, user._id);
    const { guest, rawToken } = await createFamily(wedding._id, [event._id]);
    const agent = require('supertest')(app); const url = `/api/v1/public/rsvp/${rawToken}/events/${event._id}`;
    const yes = await agent.put(url).send({ response: 'YES' });
    expect(yes.status).toBe(200); expect(yes.headers['referrer-policy']).toBe('no-referrer');
    expect(yes.body).toMatchObject({ success: true, message: 'RSVP response saved', data: { eventId: event._id.toString(), response: 'YES' } });
    const no = await agent.put(url).send({ response: 'NO' }); expect(no.body.data.response).toBe('NO');
    const respondedAt = no.body.data.respondedAt;
    const repeated = await agent.put(url).send({ response: 'NO' }); expect(repeated.body.data.response).toBe('NO');
    expect(repeated.body.data.respondedAt).toBe(respondedAt);
    expect(await RSVP.countDocuments({ weddingId: wedding._id, guestId: guest._id, eventId: event._id })).toBe(1);
    const get = await agent.get(`/api/v1/public/rsvp/${rawToken}`); expect(get.body.data.events[0].existingResponse).toBe('NO');
    expect(JSON.stringify(yes.body)).not.toContain(rawToken); expect(JSON.stringify(yes.body)).not.toContain(hash(rawToken));
  });

  it('rejects invalid payloads, uninvited/cross-Wedding/invalid/deleted/cancelled Events', async () => {
    const { user, wedding } = await createContext(); const invited = await createEvent(wedding._id, user._id);
    const { rawToken } = await createFamily(wedding._id, [invited._id]); const agent = require('supertest')(app);
    const url = `/api/v1/public/rsvp/${rawToken}/events`;
    for (const body of [{}, { response: 'MAYBE' }, { response: 'YES', guestId: new mongoose.Types.ObjectId().toString() }, null]) {
      expect((await agent.put(`${url}/${invited._id}`).send(body)).status).toBe(400);
    }
    expect((await agent.put(`${url}/not-id`).send({ response: 'YES' })).status).toBe(404);
    const uninvited = await createEvent(wedding._id, user._id);
    expect((await agent.put(`${url}/${uninvited._id}`).send({ response: 'YES' })).status).toBe(403);
    const otherContext = await createContext(); const crossWedding = await createEvent(otherContext.wedding._id, otherContext.user._id);
    expect((await agent.put(`${url}/${crossWedding._id}`).send({ response: 'YES' })).status).toBe(403);
    const family = await Guest.findOne({ 'rsvpAccess.tokenHash': hash(rawToken) });
    family.invitedEvents.push({ eventId: crossWedding._id, invitationStatus: 'NOT_SENT' });
    await family.save();
    expect((await agent.put(`${url}/${crossWedding._id}`).send({ response: 'YES' })).status).toBe(404);
    const cancelled = await createEvent(wedding._id, user._id, { status: 'CANCELLED' });
    const cancelledFamily = await createFamily(wedding._id, [cancelled._id]);
    expect((await agent.put(`/api/v1/public/rsvp/${cancelledFamily.rawToken}/events/${cancelled._id}`).send({ response: 'YES' })).status).toBe(409);
    const deleted = await createEvent(wedding._id, user._id); const deletedFamily = await createFamily(wedding._id, [deleted._id]);
    await Event.updateOne({ _id: deleted._id }, { $set: { deletedAt: new Date() } });
    expect((await agent.put(`/api/v1/public/rsvp/${deletedFamily.rawToken}/events/${deleted._id}`).send({ response: 'YES' })).status).toBe(404);
  });

  it('serializes concurrent submissions and keeps the unique family-event constraint', async () => {
    const { user, wedding } = await createContext(); const event = await createEvent(wedding._id, user._id);
    const { guest, rawToken } = await createFamily(wedding._id, [event._id]); const agent = require('supertest')(app);
    const url = `/api/v1/public/rsvp/${rawToken}/events/${event._id}`;
    const [first, second] = await Promise.all([agent.put(url).send({ response: 'YES' }), agent.put(url).send({ response: 'NO' })]);
    expect([first.status, second.status].every((status) => status === 200)).toBe(true);
    expect(await RSVP.countDocuments({ weddingId: wedding._id, guestId: guest._id, eventId: event._id })).toBe(1);
    const stored = await RSVP.findOne({ weddingId: wedding._id, guestId: guest._id, eventId: event._id });
    expect(['YES', 'NO']).toContain(stored.response);
  });

  it('lets one family read only its own invited event response and prevents Event deletion while RSVP history exists', async () => {
    const { user, wedding, password } = await createContext(); const event = await createEvent(wedding._id, user._id);
    const { guest, rawToken } = await createFamily(wedding._id, [event._id]);
    await RSVP.create({ weddingId: wedding._id, guestId: guest._id, eventId: event._id, response: 'NO', respondedAt: new Date() });
    const response = await require('supertest')(app).get(`/api/v1/public/rsvp/${rawToken}`);
    expect(response.body.data.events[0].existingResponse).toBe('NO');
    await Guest.updateOne({ _id: guest._id }, { $set: { invitedEvents: [] } });
    const organizer = await adminAgent(user, password);
    const csrf = await organizer.get('/api/v1/auth/csrf');
    const deleted = await organizer.delete(`/api/v1/events/${event._id}`).set('X-CSRF-Token', csrf.body.data.csrfToken);
    expect(deleted.status).toBe(409);
    expect(await require(`${serverDirectory}src/modules/rsvp/rsvp.service.js`).hasRsvpsForEvent(event, RSVP)).toBe(true);
    const statusCsrf = await organizer.get('/api/v1/auth/csrf');
    const cancelled = await organizer.patch(`/api/v1/events/${event._id}/status`).set('X-CSRF-Token', statusCsrf.body.data.csrfToken).send({ status: 'CANCELLED' });
    expect(cancelled.status).toBe(200);
    expect(await RSVP.countDocuments({ weddingId: wedding._id, guestId: guest._id, eventId: event._id })).toBe(1);
    expect((await require('supertest')(app).get(`/api/v1/public/rsvp/${rawToken}`)).body.data.events).toHaveLength(0);
  });

  it('applies the approved per-IP rate limit to public token lookups', async () => {
    expect(rsvpConfig.publicRsvpRateLimits).toEqual({ get: 20, put: 20 });
    expect(rsvpConfig.publicRsvpRateLimitWindowMs).toBe(15 * 60 * 1000);
    const limitedApp = require(`${serverDirectory}src/app.js`).createApp({ rsvpRateLimitOverrides: { get: 2, put: 2 } });
    const agent = require('supertest')(limitedApp);
    expect((await agent.get(`/api/v1/public/rsvp/${token()}`)).status).toBe(404);
    expect((await agent.get(`/api/v1/public/rsvp/${token()}`)).status).toBe(404);
    const limited = await agent.get(`/api/v1/public/rsvp/${token()}`);
    expect(limited.status).toBe(429); expect(limited.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(limited.headers['referrer-policy']).toBe('no-referrer');
    const putUrl = `/api/v1/public/rsvp/${token()}/events/${new mongoose.Types.ObjectId()}`;
    expect((await agent.put(putUrl).send({ response: 'YES' })).status).toBe(404);
    expect((await agent.put(putUrl).send({ response: 'YES' })).status).toBe(404);
    const putLimited = await agent.put(putUrl).send({ response: 'YES' });
    expect(putLimited.status).toBe(429); expect(putLimited.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(putLimited.headers['referrer-policy']).toBe('no-referrer');
  });
});
