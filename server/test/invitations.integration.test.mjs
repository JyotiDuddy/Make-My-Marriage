import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const serverDirectory = new URL('../', import.meta.url).pathname;
const testDatabaseName = `mmm_m10_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/t7cAAAAASUVORK5CYII=',
  'base64',
);
const maxImageSize = 10 * 1024 * 1024;

let mongoose;
let User;
let Wedding;
let Event;
let Invitation;
let app;
let testConfig;
let createApp;
let createEventService;
let hasInvitationsForEvent;
let createInvitationService;
let fakeCloudinary;
let cleanupLog;
let databaseCreated = false;

function safeError(message, error) {
  const code = error?.code ?? error?.name;
  return new Error(code ? `${message} (${code}).` : `${message}.`);
}

function uniqueEmail(prefix = 'm10') {
  return `${prefix}-${randomUUID().replaceAll('-', '').slice(0, 18)}@example.test`;
}

async function csrfToken(agent) {
  const response = await agent.get('/api/v1/auth/csrf');
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body.data.csrfToken;
}

async function mutation(agent, method, url) {
  const token = await csrfToken(agent);
  return agent[method](url).set('X-CSRF-Token', token);
}

async function createUser(role = 'ADMIN') {
  const password = 'M10InvitationPassword123';
  const user = await User.create({
    name: `M10 ${role}`,
    email: uniqueEmail(role.toLowerCase()),
    passwordHash: await require('bcrypt').hash(password, testConfig.bcryptSaltRounds),
    role,
    status: 'ACTIVE',
    activatedAt: new Date(),
  });
  return { user, password };
}

async function loggedIn(user, password, targetApp = app) {
  const agent = require('supertest').agent(targetApp);
  const csrf = await csrfToken(agent);
  const response = await agent.post('/api/v1/auth/login')
    .set('X-CSRF-Token', csrf)
    .send({ email: user.email, password });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return agent;
}

async function createWedding(admin, managerId = null) {
  return Wedding.create({
    adminId: admin._id,
    managerId,
    title: 'M10 Invitation Wedding',
    partnerOneName: 'Asha',
    partnerTwoName: 'Dev',
    weddingDate: '2027-02-15',
    timeZone: 'Asia/Kolkata',
    slug: `m10-${randomUUID().replaceAll('-', '').slice(0, 12)}`,
    websitePublished: false,
  });
}

async function adminContext(targetApp = app) {
  const { user, password } = await createUser();
  const wedding = await createWedding(user);
  return { user, wedding, agent: await loggedIn(user, password, targetApp) };
}

async function managerContext(targetApp = app) {
  const admin = await createUser('ADMIN');
  const manager = await createUser('MANAGER');
  const wedding = await createWedding(admin.user, manager.user._id);
  return {
    admin: admin.user,
    manager: manager.user,
    wedding,
    adminAgent: await loggedIn(admin.user, admin.password, targetApp),
    agent: await loggedIn(manager.user, manager.password, targetApp),
  };
}

async function createEvent(wedding, createdBy) {
  return Event.create({
    weddingId: wedding._id,
    name: 'M10 Event',
    eventDate: '2027-02-13',
    startTime: '10:00',
    venueName: 'The Garden',
    venueAddress: 'Delhi',
    status: 'UPCOMING',
    isPublished: false,
    createdBy,
  });
}

async function postInvitation(agent, { type = 'COMMON', eventId, buffer = png, contentType = 'image/png', fileName = 'invite.png' } = {}) {
  const csrf = await csrfToken(agent);
  const request = agent.post('/api/v1/invitations')
    .set('X-CSRF-Token', csrf)
    .field('type', type);
  if (eventId !== undefined) request.field('eventId', eventId);
  if (buffer !== null) request.attach('image', buffer, { filename: fileName, contentType });
  return request;
}

describe('M10 Invitation Cards API', () => {
  beforeAll(async () => {
    let probeConnection;
    let stage = 'prepare isolated test configuration';
    try {
      const uri = process.env.M10_TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017';
      if (!['localhost', '127.0.0.1', '::1'].includes(new URL(uri).hostname)) {
        throw new Error('M10 integration tests accept only a loopback MongoDB URI.');
      }
      process.env.NODE_ENV = 'test';
      process.env.MONGO_DB_URI = uri;
      process.env.MONGO_DB_NAME = testDatabaseName;
      process.env.SESSION_SECRET = randomBytes(64).toString('hex');
      process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
      process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';

      const dotenv = require('dotenv');
      const originalConfig = dotenv.config;
      dotenv.config = () => ({ parsed: {} });
      try {
        testConfig = require(`${serverDirectory}src/config/env.js`);
      } finally {
        dotenv.config = originalConfig;
      }

      mongoose = require('mongoose');
      stage = 'check generated test database name';
      probeConnection = await mongoose.createConnection(uri, {
        dbName: 'admin',
        serverSelectionTimeoutMS: 15000,
      }).asPromise();
      const { databases } = await probeConnection.getClient().db('admin').admin()
        .listDatabases({ nameOnly: true });
      if (databases.some(({ name }) => name === testDatabaseName)) {
        throw new Error('Generated M10 test database already exists; refusing to modify it.');
      }
      await probeConnection.close();
      probeConnection = undefined;

      stage = 'load models and application';
      User = require(`${serverDirectory}src/modules/auth/user.model.js`);
      Wedding = require(`${serverDirectory}src/modules/wedding/wedding.model.js`);
      Event = require(`${serverDirectory}src/modules/events/event.model.js`);
      Invitation = require(`${serverDirectory}src/modules/invitations/invitation.model.js`);
      createEventService = require(`${serverDirectory}src/modules/events/event.service.js`).createEventService;
      hasInvitationsForEvent = require(`${serverDirectory}src/modules/invitations/invitation.service.js`).hasInvitationsForEvent;
      createInvitationService = require(`${serverDirectory}src/modules/invitations/invitation.service.js`).createInvitationService;

      fakeCloudinary = {
        uploads: [],
        deletions: [],
        failUpload: false,
        failDelete: false,
        beforeDelete: null,
        afterUpload: null,
        get isConfigured() { return true; },
        async uploadImage({ buffer, folder }) {
          if (this.failUpload) throw Object.assign(new Error('fake provider error'), { code: 'FAKE_UPLOAD' });
          const publicId = `${folder}/${randomUUID()}`;
          const asset = { publicId, url: `https://res.cloudinary.test/${publicId}.png`, size: buffer.length };
          this.uploads.push(asset);
          if (this.afterUpload) await this.afterUpload(asset);
          return { publicId, url: asset.url };
        },
        async deleteImage(publicId) {
          this.deletions.push(publicId);
          if (this.beforeDelete) await this.beforeDelete(publicId);
          if (this.failDelete) throw Object.assign(new Error('fake provider error'), { code: 'FAKE_DELETE' });
        },
      };
      cleanupLog = { entries: [], error(value) { this.entries.push(JSON.parse(value)); } };

      createApp = require(`${serverDirectory}src/app.js`).createApp;
      app = createApp({
        authRateLimitOverrides: { login: 100 },
        invitationService: createInvitationService({ cloudinary: fakeCloudinary, logger: cleanupLog }),
      });
      const connectDB = require(`${serverDirectory}src/config/database.js`);
      stage = 'connect to isolated test database';
      await connectDB();
      if (mongoose.connection.name !== testDatabaseName) {
        throw new Error('The backend did not select the generated M10 test database.');
      }
      databaseCreated = true;
      await Promise.all([User, Wedding, Event, Invitation].map((model) => model.createIndexes()));
    } catch (error) {
      if (probeConnection) await probeConnection.close().catch(() => {});
      if (mongoose?.connection?.readyState === 1 && databaseCreated) {
        await mongoose.connection.dropDatabase().catch(() => {});
      }
      if (mongoose?.connection?.readyState) await mongoose.disconnect().catch(() => {});
      throw safeError(`Could not safely prepare M10 tests while trying to ${stage}`, error);
    }
  }, 60000);

  beforeEach(async () => {
    fakeCloudinary.uploads.length = 0;
    fakeCloudinary.deletions.length = 0;
    fakeCloudinary.failUpload = false;
    fakeCloudinary.failDelete = false;
    fakeCloudinary.beforeDelete = null;
    fakeCloudinary.afterUpload = null;
    cleanupLog.entries.length = 0;
    await Invitation.deleteMany({});
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

  it('uploads a COMMON invitation and stores the documented metadata without exposing its Cloudinary ID', async () => {
    const { user, wedding, agent } = await adminContext();
    const response = await postInvitation(agent);
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      type: 'COMMON',
      imageUrl: fakeCloudinary.uploads[0].url,
      fileName: 'invite.png',
      format: 'png',
      uploadedBy: user._id.toString(),
    });
    expect(response.body.data).not.toHaveProperty('storagePublicId');
    expect(await Invitation.countDocuments({ weddingId: wedding._id, type: 'COMMON' })).toBe(1);
    const stored = await Invitation.findOne({ weddingId: wedding._id, type: 'COMMON' }).lean();
    expect(stored.storagePublicId).toBe(fakeCloudinary.uploads[0].publicId);
    expect(stored.eventId).toBeUndefined();
  });

  it('uploads an EVENT invitation only for an active Event in the same Wedding', async () => {
    const { user, wedding, agent } = await adminContext();
    const event = await createEvent(wedding, user._id);
    const response = await postInvitation(agent, { type: 'EVENT', eventId: event._id.toString() });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ type: 'EVENT', eventId: event._id.toString() });
    expect(await Invitation.countDocuments({ weddingId: wedding._id, eventId: event._id })).toBe(1);
  });

  it('rejects missing or malformed type and EVENT identifiers before uploading', async () => {
    const { agent } = await adminContext();
    const csrf = await csrfToken(agent);
    for (const fields of [
      [],
      [['type', 'OTHER']],
      [['type', 'EVENT']],
      [['type', 'EVENT'], ['eventId', 'not-an-id']],
    ]) {
      let request = agent.post('/api/v1/invitations').set('X-CSRF-Token', csrf);
      for (const [key, value] of fields) request = request.field(key, value);
      request = request.attach('image', png, { filename: 'invite.png', contentType: 'image/png' });
      const response = await request;
      expect(response.status).toBe(400);
    }
    expect(fakeCloudinary.uploads).toHaveLength(0);
  });

  it('rejects cross-Wedding and soft-deleted Event references without uploading', async () => {
    const first = await adminContext();
    const second = await adminContext();
    const event = await createEvent(first.wedding, first.user._id);
    const crossWedding = await postInvitation(second.agent, { type: 'EVENT', eventId: event._id.toString() });
    expect(crossWedding.status).toBe(404);
    await Event.updateOne({ _id: event._id }, { $set: { deletedAt: new Date() } });
    const deleted = await postInvitation(first.agent, { type: 'EVENT', eventId: event._id.toString() });
    expect(deleted.status).toBe(404);
    expect(fakeCloudinary.uploads).toHaveLength(0);
  });

  it('rejects invalid image MIME/signature combinations and files over 10 MB', async () => {
    const { agent } = await adminContext();
    const badSignature = await postInvitation(agent, { buffer: Buffer.from('not an image') });
    expect(badSignature.status).toBe(415);
    const wrongMime = await postInvitation(agent, { contentType: 'image/jpeg' });
    expect(wrongMime.status).toBe(415);
    const tooLarge = await postInvitation(agent, { buffer: Buffer.concat([png, Buffer.alloc(maxImageSize + 1)]) });
    expect(tooLarge.status).toBe(413);
    expect(fakeCloudinary.uploads).toHaveLength(0);
  });

  it('rejects a missing upload', async () => {
    const { agent } = await adminContext();
    const csrf = await csrfToken(agent);
    const response = await agent.post('/api/v1/invitations')
      .set('X-CSRF-Token', csrf)
      .send({ type: 'COMMON' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('replaces a COMMON invitation in place and deletes its old asset only after persistence', async () => {
    const { wedding, agent } = await adminContext();
    const initial = await postInvitation(agent);
    const firstPublicId = fakeCloudinary.uploads[0].publicId;
    fakeCloudinary.beforeDelete = async (publicId) => {
      if (publicId === firstPublicId) {
        expect(await Invitation.exists({ storagePublicId: publicId })).toBeFalsy();
      }
    };
    const replaced = await postInvitation(agent, { fileName: 'replacement.png' });
    expect(replaced.status).toBe(201);
    expect(replaced.body.data.id).toBe(initial.body.data.id);
    expect(replaced.body.data.fileName).toBe('replacement.png');
    expect(fakeCloudinary.deletions).toContain(firstPublicId);
    expect(await Invitation.countDocuments({ weddingId: wedding._id, type: 'COMMON' })).toBe(1);
    const final = await Invitation.findById(replaced.body.data.id).lean();
    expect(fakeCloudinary.deletions).not.toContain(final.storagePublicId);
  });

  it('enforces one COMMON and one EVENT record through the documented partial unique indexes', async () => {
    const { user, wedding, agent } = await adminContext();
    const event = await createEvent(wedding, user._id);
    await postInvitation(agent);
    await postInvitation(agent);
    await postInvitation(agent, { type: 'EVENT', eventId: event._id.toString() });
    await postInvitation(agent, { type: 'EVENT', eventId: event._id.toString() });
    expect(await Invitation.countDocuments({ weddingId: wedding._id, type: 'COMMON' })).toBe(1);
    expect(await Invitation.countDocuments({ weddingId: wedding._id, type: 'EVENT', eventId: event._id })).toBe(1);
    const schemaIndexes = Invitation.schema.indexes();
    expect(schemaIndexes.map(([fields, options]) => [fields, options])).toEqual([
      [{ weddingId: 1 }, { unique: true, partialFilterExpression: { type: 'COMMON' } }],
      [{ weddingId: 1, eventId: 1 }, { unique: true, partialFilterExpression: { type: 'EVENT' } }],
    ]);
    const stored = await Invitation.collection.indexes();
    expect(stored.find((index) => index.name === 'weddingId_1' && index.unique).partialFilterExpression)
      .toEqual({ type: 'COMMON' });
    expect(stored.find((index) => index.name === 'weddingId_1_eventId_1' && index.unique).partialFilterExpression)
      .toEqual({ type: 'EVENT' });
  });

  it('cleans up a newly uploaded asset and preserves the previous Invitation when MongoDB update fails', async () => {
    const { agent } = await adminContext();
    const initial = await postInvitation(agent);
    const previous = await Invitation.findById(initial.body.data.id).lean();
    const spy = vi.spyOn(Invitation, 'findOneAndUpdate').mockRejectedValueOnce(new Error('fake database failure'));
    const response = await postInvitation(agent, { fileName: 'failed-replacement.png' });
    spy.mockRestore();
    expect(response.status).toBe(500);
    const stored = await Invitation.findById(previous._id).lean();
    expect(stored.storagePublicId).toBe(previous.storagePublicId);
    expect(stored.imageUrl).toBe(previous.imageUrl);
    expect(fakeCloudinary.deletions).toContain(fakeCloudinary.uploads[1].publicId);
    expect(fakeCloudinary.deletions).not.toContain(previous.storagePublicId);
  });

  it('records Cloudinary cleanup failure after replacement without restoring the old reference', async () => {
    const { agent } = await adminContext();
    const initial = await postInvitation(agent);
    const firstPublicId = fakeCloudinary.uploads[0].publicId;
    fakeCloudinary.failDelete = true;
    const replaced = await postInvitation(agent);
    expect(replaced.status).toBe(201);
    const stored = await Invitation.findById(initial.body.data.id).lean();
    expect(stored.storagePublicId).toBe(fakeCloudinary.uploads[1].publicId);
    expect(fakeCloudinary.deletions).toContain(firstPublicId);
    expect(cleanupLog.entries).toContainEqual(expect.objectContaining({
      event: 'cloudinary_cleanup_failed',
      operation: 'delete_replaced_invitation',
      publicId: firstPublicId,
    }));
    expect(JSON.stringify(replaced.body)).not.toContain(firstPublicId);
  });

  it('lists only the authenticated Wedding invitations with bounded pagination', async () => {
    const first = await adminContext();
    const second = await adminContext();
    await postInvitation(first.agent);
    await postInvitation(first.agent, { type: 'COMMON' });
    await postInvitation(second.agent);
    const response = await first.agent.get('/api/v1/invitations?page=1&limit=1');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination).toEqual({ page: 1, limit: 1, totalRecords: 1, totalPages: 1 });
    expect(response.body.data[0]).not.toHaveProperty('storagePublicId');
    expect((await first.agent.get('/api/v1/invitations?limit=101')).status).toBe(400);
    expect((await first.agent.get('/api/v1/invitations?unexpected=x')).status).toBe(400);
  });

  it('deletes only a Wedding-owned Invitation, then removes its asset', async () => {
    const first = await adminContext();
    const second = await adminContext();
    const created = await postInvitation(first.agent);
    const publicId = fakeCloudinary.uploads[0].publicId;
    const crossWedding = await mutation(second.agent, 'delete', `/api/v1/invitations/${created.body.data.id}`);
    expect(crossWedding.status).toBe(404);
    expect(await Invitation.countDocuments()).toBe(1);
    const deleted = await mutation(first.agent, 'delete', `/api/v1/invitations/${created.body.data.id}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data).toEqual({ id: created.body.data.id });
    expect(await Invitation.countDocuments()).toBe(0);
    expect(fakeCloudinary.deletions).toContain(publicId);
  });

  it('returns not-found for invalid and missing Invitation IDs', async () => {
    const { agent } = await adminContext();
    expect((await mutation(agent, 'delete', '/api/v1/invitations/not-an-id')).status).toBe(404);
    expect((await mutation(agent, 'delete', `/api/v1/invitations/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
  });

  it('logs cleanup failures after deletion while leaving the database reference removed', async () => {
    const { agent } = await adminContext();
    const created = await postInvitation(agent);
    const publicId = fakeCloudinary.uploads[0].publicId;
    fakeCloudinary.failDelete = true;
    const deleted = await mutation(agent, 'delete', `/api/v1/invitations/${created.body.data.id}`);
    expect(deleted.status).toBe(200);
    expect(await Invitation.countDocuments()).toBe(0);
    expect(cleanupLog.entries).toContainEqual(expect.objectContaining({
      event: 'cloudinary_cleanup_failed', operation: 'delete_invitation', publicId,
    }));
    expect(JSON.stringify(deleted.body)).not.toContain(publicId);
  });

  it('allows Admin and Manager, rejects anonymous users and requires CSRF for mutations', async () => {
    const context = await managerContext();
    const managerUpload = await postInvitation(context.agent);
    expect(managerUpload.status).toBe(201);
    const anonymous = require('supertest').agent(app);
    expect((await anonymous.get('/api/v1/invitations')).status).toBe(401);
    expect((await anonymous.post('/api/v1/invitations')).status).toBe(401);
    expect((await context.agent.post('/api/v1/invitations').field('type', 'COMMON')
      .attach('image', png, { filename: 'invite.png', contentType: 'image/png' })).status).toBe(403);
    expect((await context.agent.delete(`/api/v1/invitations/${managerUpload.body.data.id}`)).status).toBe(403);
  });

  it('blocks Event deletion while an EVENT invitation is linked and cancellation preserves it', async () => {
    const { user, wedding, agent } = await adminContext();
    const event = await createEvent(wedding, user._id);
    const invitation = await postInvitation(agent, { type: 'EVENT', eventId: event._id.toString() });
    expect(invitation.status).toBe(201);
    const csrf = await csrfToken(agent);
    const blocked = await agent.delete(`/api/v1/events/${event._id}`).set('X-CSRF-Token', csrf);
    expect(blocked.status).toBe(409);
    const eventAfterBlockedDelete = await Event.findById(event._id).lean();
    expect(eventAfterBlockedDelete.deletedAt).toBeUndefined();
    const cancelled = await agent.patch(`/api/v1/events/${event._id}/status`)
      .set('X-CSRF-Token', csrf).send({ status: 'CANCELLED' });
    expect(cancelled.status).toBe(200);
    expect(await Invitation.exists({ _id: invitation.body.data.id })).toBeTruthy();
  });

  it('coordinates Event upload with a deletion that races after the dependency check', async () => {
    let enteredCheck;
    let releaseCheck;
    const checkEntered = new Promise((resolve) => { enteredCheck = resolve; });
    const checkRelease = new Promise((resolve) => { releaseCheck = resolve; });
    const eventService = createEventService({
      eventDependencyChecks: [async (event) => {
        const hasInvitation = await hasInvitationsForEvent(event, Invitation);
        enteredCheck();
        await checkRelease;
        return hasInvitation;
      }],
    });
    const guardedApp = createApp({
      authRateLimitOverrides: { login: 100 },
      eventService,
      invitationService: createInvitationService({ cloudinary: fakeCloudinary, logger: cleanupLog }),
    });
    const { user, wedding, agent } = await adminContext(guardedApp);
    const event = await createEvent(wedding, user._id);
    const csrf = await csrfToken(agent);
    const deletion = agent.delete(`/api/v1/events/${event._id}`)
      .set('X-CSRF-Token', csrf)
      .then((response) => response);
    await checkEntered;
    const uploaded = await postInvitation(agent, { type: 'EVENT', eventId: event._id.toString() });
    expect(uploaded.status).toBe(201);
    releaseCheck();
    const deletionResult = await deletion;
    expect(deletionResult.status).toBe(409);
    expect(await Event.findById(event._id).select('deletedAt')).toMatchObject({ deletedAt: undefined });
    expect(await Invitation.exists({ _id: uploaded.body.data.id })).toBeTruthy();
  }, 30000);

  it('cleans the uploaded asset when an Event is deleted during the Cloudinary upload', async () => {
    const { user, wedding, agent } = await adminContext();
    const event = await createEvent(wedding, user._id);
    let uploadedToCloudinary;
    let continueUpload;
    const cloudUploaded = new Promise((resolve) => { uploadedToCloudinary = resolve; });
    const uploadContinue = new Promise((resolve) => { continueUpload = resolve; });
    fakeCloudinary.afterUpload = async (asset) => {
      uploadedToCloudinary(asset);
      await uploadContinue;
    };
    const pendingUpload = postInvitation(agent, { type: 'EVENT', eventId: event._id.toString() });
    const uploadedAsset = await cloudUploaded;
    const csrf = await csrfToken(agent);
    const deleted = await agent.delete(`/api/v1/events/${event._id}`).set('X-CSRF-Token', csrf);
    expect(deleted.status).toBe(200);
    continueUpload();
    const rejectedUpload = await pendingUpload;
    expect(rejectedUpload.status).toBe(404);
    expect(await Invitation.countDocuments({ eventId: event._id })).toBe(0);
    expect(fakeCloudinary.deletions).toContain(uploadedAsset.publicId);
  }, 30000);

  it('keeps the final asset referenced by a successful concurrent replacement', async () => {
    const { agent } = await adminContext();
    const initial = await postInvitation(agent);
    const firstUploadId = fakeCloudinary.uploads[0].publicId;
    const [left, right] = await Promise.all([
      postInvitation(agent, { fileName: 'left.png' }),
      postInvitation(agent, { fileName: 'right.png' }),
    ]);
    expect([left.status, right.status].every((status) => status === 201)).toBe(true);
    expect(left.body.data.id).toBe(initial.body.data.id);
    expect(right.body.data.id).toBe(initial.body.data.id);
    const stored = await Invitation.findById(initial.body.data.id).lean();
    expect(fakeCloudinary.deletions).not.toContain(stored.storagePublicId);
    expect(await Invitation.countDocuments({ type: 'COMMON' })).toBe(1);
    expect(fakeCloudinary.deletions).toContain(firstUploadId);
  }, 30000);
});
