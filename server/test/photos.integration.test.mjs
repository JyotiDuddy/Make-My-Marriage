import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const serverDirectory = new URL('../', import.meta.url).pathname;
const testDatabaseName = `mmm_m14_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/t7cAAAAASUVORK5CYII=', 'base64');
const jpeg = Buffer.from([255, 216, 255, 219, 0, 67]);
const webp = Buffer.from([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
const maxImageSize = 10 * 1024 * 1024;

let mongoose; let User; let Wedding; let Event; let Photo; let app; let testConfig;
let createApp; let createPhotoService; let createEventService; let hasPhotosForEvent;
let fakeCloudinary; let cleanupLog; let databaseCreated = false;

function safeError(message, error) {
  const code = error?.code ?? error?.name;
  return new Error(code ? `${message} (${code}).` : `${message}.`);
}

function uniqueEmail() { return `m14-${randomUUID().replaceAll('-', '').slice(0, 16)}@example.test`; }

async function csrfToken(agent) {
  const response = await agent.get('/api/v1/auth/csrf');
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body.data.csrfToken;
}

async function createUser(role = 'ADMIN') {
  const password = 'M14PhotoPassword123';
  const user = await User.create({
    name: `M14 ${role}`,
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
    title: 'M14 Wedding',
    partnerOneName: 'Asha',
    partnerTwoName: 'Dev',
    weddingDate: '2027-02-15',
    timeZone: 'Asia/Kolkata',
    slug: `m14-${randomUUID().replaceAll('-', '').slice(0, 12)}`,
    websitePublished: false,
  });
}

async function adminContext(targetApp = app) {
  const { user, password } = await createUser('ADMIN');
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

async function createEvent(wedding, createdBy, name = 'Haldi') {
  return Event.create({
    weddingId: wedding._id,
    name,
    eventDate: '2027-02-13',
    startTime: '10:00',
    venueName: 'The Garden',
    venueAddress: 'Delhi',
    status: 'UPCOMING',
    isPublished: false,
    createdBy,
  });
}

async function postPhoto(agent, { eventId, buffer = png, contentType = 'image/png', filename = 'memory.png', csrf = true } = {}) {
  let request = agent.post('/api/v1/photos');
  if (csrf) request = request.set('X-CSRF-Token', await csrfToken(agent));
  if (eventId !== undefined) request = request.field('eventId', eventId);
  if (buffer !== null) request = request.attach('image', buffer, { filename, contentType });
  return request;
}

async function postGuestPhoto(slug, { eventId, buffer = png, contentType = 'image/png', filename = 'guest-memory.png', fields = [], targetApp = app } = {}) {
  let request = require('supertest')(targetApp).post(`/api/v1/public/weddings/${slug}/photos`);
  if (eventId !== undefined) request = request.field('eventId', eventId);
  for (const [key, value] of fields) request = request.field(key, value);
  if (buffer !== null) request = request.attach('image', buffer, { filename, contentType });
  return request;
}

async function mutation(agent, method, url, body) {
  const request = agent[method](url).set('X-CSRF-Token', await csrfToken(agent));
  return body === undefined ? request : request.send(body);
}

describe('M14 Wedding Memories and Photo Review API', () => {
  beforeAll(async () => {
    let probeConnection;
    let stage = 'prepare isolated test configuration';
    try {
      const uri = process.env.M14_TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27018/?replicaSet=m9rs';
      if (!['localhost', '127.0.0.1', '::1'].includes(new URL(uri).hostname)) {
        throw new Error('M14 integration tests accept only a loopback MongoDB URI.');
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
      try { testConfig = require(`${serverDirectory}src/config/env.js`); } finally { dotenv.config = originalConfig; }

      mongoose = require('mongoose');
      stage = 'check replica-set support and generated database name';
      probeConnection = await mongoose.createConnection(uri, { dbName: 'admin', serverSelectionTimeoutMS: 15000 }).asPromise();
      const hello = await probeConnection.getClient().db('admin').command({ hello: 1 });
      if (!hello.setName) throw new Error('M14 Event association race tests require a local replica set.');
      const { databases } = await probeConnection.getClient().db('admin').admin().listDatabases({ nameOnly: true });
      if (databases.some(({ name }) => name === testDatabaseName)) throw new Error('Generated M14 database already exists; refusing to modify it.');
      await probeConnection.close();
      probeConnection = undefined;

      stage = 'load models and application';
      User = require(`${serverDirectory}src/modules/auth/user.model.js`);
      Wedding = require(`${serverDirectory}src/modules/wedding/wedding.model.js`);
      Event = require(`${serverDirectory}src/modules/events/event.model.js`);
      Photo = require(`${serverDirectory}src/modules/photos/photo.model.js`);
      ({ createPhotoService, hasPhotosForEvent } = require(`${serverDirectory}src/modules/photos/photo.service.js`));
      createEventService = require(`${serverDirectory}src/modules/events/event.service.js`).createEventService;

      fakeCloudinary = {
        uploads: [],
        deletions: [],
        failUpload: false,
        failDelete: false,
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
          if (this.failDelete) throw Object.assign(new Error('fake provider error'), { code: 'FAKE_DELETE' });
        },
      };
      cleanupLog = { entries: [], error(value) { this.entries.push(JSON.parse(value)); } };
      createApp = require(`${serverDirectory}src/app.js`).createApp;
      const photoService = createPhotoService({ cloudinary: fakeCloudinary, logger: cleanupLog });
      app = createApp({
        authRateLimitOverrides: { login: 100 },
        publicPhotoRateLimitOverrides: { upload: 500 },
        photoService,
      });

      stage = 'connect to generated disposable database';
      await require(`${serverDirectory}src/config/database.js`)();
      if (mongoose.connection.name !== testDatabaseName) throw new Error('Backend did not select the generated M14 database.');
      databaseCreated = true;
      await Promise.all([User, Wedding, Event, Photo].map((model) => model.createIndexes()));
    } catch (error) {
      if (probeConnection) await probeConnection.close().catch(() => {});
      if (mongoose?.connection?.readyState === 1 && databaseCreated) await mongoose.connection.dropDatabase().catch(() => {});
      if (mongoose?.connection?.readyState) await mongoose.disconnect().catch(() => {});
      throw safeError(`Could not safely prepare M14 integration tests while trying to ${stage}`, error);
    }
  }, 60000);

  beforeEach(async () => {
    fakeCloudinary.uploads.length = 0;
    fakeCloudinary.deletions.length = 0;
    fakeCloudinary.failUpload = false;
    fakeCloudinary.failDelete = false;
    fakeCloudinary.afterUpload = null;
    cleanupLog.entries.length = 0;
    await Promise.all([Photo.deleteMany({}), Event.deleteMany({}), Wedding.deleteMany({}), User.deleteMany({})]);
  });

  afterAll(async () => {
    if (!mongoose?.connection?.readyState) return;
    try {
      if (databaseCreated) {
        await mongoose.connection.dropDatabase();
        databaseCreated = false;
      }
    } finally { await mongoose.disconnect(); }
  }, 60000);

  it('matches the exact Photo schema and two documented MongoDB indexes', async () => {
    expect(Object.keys(Photo.schema.paths).sort()).toEqual([
      '_id', '__v', 'weddingId', 'eventId', 'imageUrl', 'storagePublicId', 'uploadedByType',
      'uploadedByUserId', 'status', 'reviewedBy', 'reviewedAt', 'createdAt', 'updatedAt',
    ].sort());
    expect(Photo.schema.options.timestamps).toBe(true);
    expect(Photo.schema.path('uploadedByType').enumValues).toEqual(['ADMIN', 'MANAGER', 'GUEST']);
    expect(Photo.schema.path('status').enumValues).toEqual(['PENDING', 'APPROVED', 'REJECTED']);
    const expected = [
      { weddingId: 1, status: 1, createdAt: -1 },
      { weddingId: 1, eventId: 1, status: 1 },
    ];
    expect(Photo.schema.indexes().map(([fields]) => fields)).toEqual(expected);
    expect((await Photo.collection.indexes()).filter(({ name }) => name !== '_id_').map(({ key }) => key)).toEqual(expected);

    const guestPhoto = new Photo({
      weddingId: new mongoose.Types.ObjectId(),
      imageUrl: 'https://res.cloudinary.test/guest.png',
      storagePublicId: 'private/guest',
      uploadedByType: 'GUEST',
      status: 'PENDING',
    });
    await expect(guestPhoto.validate()).resolves.toBeUndefined();
    const organizerPhoto = new Photo({
      weddingId: new mongoose.Types.ObjectId(),
      imageUrl: 'https://res.cloudinary.test/organizer.png',
      storagePublicId: 'private/organizer',
      uploadedByType: 'ADMIN',
      status: 'APPROVED',
    });
    await expect(organizerPhoto.validate()).rejects.toMatchObject({ name: 'ValidationError' });
  });

  it('allows Admin and Manager organizer uploads; derives uploader data and APPROVED status', async () => {
    const admin = await adminContext();
    const uploaded = await postPhoto(admin.agent);
    expect(uploaded.status, JSON.stringify(uploaded.body)).toBe(201);
    expect(uploaded.body.data).toMatchObject({
      imageUrl: fakeCloudinary.uploads[0].url,
      uploadedByType: 'ADMIN',
      uploadedByUserId: admin.user._id.toString(),
      status: 'APPROVED',
    });
    expect(uploaded.body.data).not.toHaveProperty('storagePublicId');
    const stored = await Photo.findById(uploaded.body.data.id).lean();
    expect(stored).toMatchObject({
      weddingId: admin.wedding._id,
      uploadedByType: 'ADMIN',
      uploadedByUserId: admin.user._id,
      status: 'APPROVED',
      storagePublicId: fakeCloudinary.uploads[0].publicId,
    });

    const manager = await managerContext();
    const managerPhoto = await postPhoto(manager.agent);
    expect(managerPhoto.status).toBe(201);
    expect(managerPhoto.body.data.uploadedByType).toBe('MANAGER');
    expect(managerPhoto.body.data.uploadedByUserId).toBe(manager.manager._id.toString());
  });

  it('requires authentication and CSRF; rejects missing, invalid, spoofed, or oversized uploads', async () => {
    const { agent } = await adminContext();
    const anonymous = require('supertest').agent(app);
    expect((await anonymous.get('/api/v1/photos')).status).toBe(401);
    expect((await anonymous.post('/api/v1/photos')).status).toBe(401);
    expect((await agent.post('/api/v1/photos').attach('image', png, { filename: 'x.png', contentType: 'image/png' })).status).toBe(403);
    expect((await postPhoto(agent, { buffer: null })).status).toBe(400);
    expect((await postPhoto(agent, { buffer: Buffer.from('not an image') })).status).toBe(415);
    expect((await postPhoto(agent, { contentType: 'image/jpeg' })).status).toBe(415);
    expect((await postPhoto(agent, { eventId: new mongoose.Types.ObjectId().toString(), buffer: png })).status).toBe(404);
    const spoofed = await postPhoto(agent, { buffer: png });
    expect((await mutation(agent, 'patch', `/api/v1/photos/${spoofed.body.data.id}/review`, { status: 'APPROVED', uploadedByType: 'GUEST' })).status).toBe(400);
    const tooLarge = Buffer.concat([png, Buffer.alloc(maxImageSize + 1 - png.length)]);
    expect((await postPhoto(agent, { buffer: tooLarge })).status).toBe(413);
  });

  it('validates optional Event references within the authenticated Wedding', async () => {
    const first = await adminContext();
    const sameWeddingEvent = await createEvent(first.wedding, first.user._id);
    const other = await adminContext();
    const otherWeddingEvent = await createEvent(other.wedding, other.user._id);
    const valid = await postPhoto(first.agent, { eventId: sameWeddingEvent._id.toString() });
    expect(valid.status).toBe(201);
    expect(valid.body.data.eventId).toBe(sameWeddingEvent._id.toString());
    expect((await postPhoto(first.agent, { eventId: otherWeddingEvent._id.toString() })).status).toBe(404);
    expect((await postPhoto(first.agent, { eventId: 'invalid' })).status).toBe(400);
    await Event.updateOne({ _id: sameWeddingEvent._id }, { $set: { deletedAt: new Date() } });
    expect((await postPhoto(first.agent, { eventId: sameWeddingEvent._id.toString() })).status).toBe(404);
  });

  it('lists Wedding-scoped photos with status/Event filters, pagination, detail reads and safe projection', async () => {
    const { user, wedding, agent } = await adminContext();
    const event = await createEvent(wedding, user._id);
    const one = await postPhoto(agent);
    const two = await postPhoto(agent, { eventId: event._id.toString() });
    const pending = await Photo.create({
      weddingId: wedding._id,
      eventId: event._id,
      imageUrl: 'https://res.cloudinary.test/pending.png',
      storagePublicId: 'private/pending',
      uploadedByType: 'GUEST',
      status: 'PENDING',
    });
    await Photo.create({
      weddingId: wedding._id,
      imageUrl: 'https://res.cloudinary.test/rejected.png',
      storagePublicId: 'private/rejected',
      uploadedByType: 'GUEST',
      status: 'REJECTED',
    });
    await adminContext();

    const all = await agent.get('/api/v1/photos');
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(4);
    expect(all.body.pagination).toEqual({ page: 1, limit: 10, totalRecords: 4, totalPages: 1 });
    expect(all.body.data.every((photo) => !Object.hasOwn(photo, 'storagePublicId'))).toBe(true);
    expect((await agent.get('/api/v1/photos?status=PENDING')).body.data.map(({ id }) => id)).toEqual([pending._id.toString()]);
    expect((await agent.get(`/api/v1/photos?eventId=${event._id}`)).body.data).toHaveLength(2);
    const paged = await agent.get('/api/v1/photos?page=2&limit=1');
    expect(paged.body.pagination).toEqual({ page: 2, limit: 1, totalRecords: 4, totalPages: 4 });
    expect((await agent.get('/api/v1/photos?status=BAD')).status).toBe(400);
    expect((await agent.get('/api/v1/photos?extra=x')).status).toBe(400);
    expect((await agent.get(`/api/v1/photos/${one.body.data.id}`)).body.data).toMatchObject({ id: one.body.data.id, status: 'APPROVED' });
    expect((await agent.get(`/api/v1/photos/${two.body.data.id}`)).status).toBe(200);
    const other = await adminContext();
    expect((await other.agent.get(`/api/v1/photos/${one.body.data.id}`)).status).toBe(404);
    expect((await other.agent.get('/api/v1/photos')).body.data).toHaveLength(0);

    const manager = await managerContext();
    await Photo.create({ weddingId: manager.wedding._id, imageUrl: 'https://res.cloudinary.test/pending.png', storagePublicId: 'private/manager-pending', uploadedByType: 'GUEST', status: 'PENDING' });
    expect((await manager.agent.get('/api/v1/photos?status=PENDING')).body.data).toHaveLength(1);
  });

  it('allows only an Admin to review pending guest submissions once and records reviewer metadata', async () => {
    const { user, wedding, agent } = await adminContext();
    const guestPhoto = await Photo.create({
      weddingId: wedding._id,
      imageUrl: 'https://res.cloudinary.test/guest.png',
      storagePublicId: 'private/guest',
      uploadedByType: 'GUEST',
      status: 'PENDING',
    });
    const manager = await managerContext();
    expect((await mutation(manager.agent, 'patch', `/api/v1/photos/${guestPhoto._id}/review`, { status: 'APPROVED' })).status).toBe(403);
    expect((await mutation(agent, 'patch', `/api/v1/photos/${guestPhoto._id}/review`, { status: 'INVALID' })).status).toBe(400);
    const reviewed = await mutation(agent, 'patch', `/api/v1/photos/${guestPhoto._id}/review`, { status: 'APPROVED' });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data).toMatchObject({ status: 'APPROVED', reviewedBy: user._id.toString() });
    expect(reviewed.body.data.reviewedAt).toBeTruthy();
    const stored = await Photo.findById(guestPhoto._id).lean();
    expect(stored.reviewedBy.toString()).toBe(user._id.toString());
    expect(stored.reviewedAt).toBeInstanceOf(Date);
    expect((await mutation(agent, 'patch', `/api/v1/photos/${guestPhoto._id}/review`, { status: 'REJECTED' })).status).toBe(409);

    const rejectedPhoto = await Photo.create({
      weddingId: wedding._id,
      imageUrl: 'https://res.cloudinary.test/guest-to-reject.png',
      storagePublicId: 'private/guest-to-reject',
      uploadedByType: 'GUEST',
      status: 'PENDING',
    });
    const rejected = await mutation(agent, 'patch', `/api/v1/photos/${rejectedPhoto._id}/review`, { status: 'REJECTED' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REJECTED');

    const organizerPhoto = await postPhoto(agent);
    expect((await mutation(agent, 'patch', `/api/v1/photos/${organizerPhoto.body.data.id}/review`, { status: 'REJECTED' })).status).toBe(409);
    expect(wedding._id).toBeTruthy();
  });

  it('deletes only Wedding-owned photo records and compensates Cloudinary cleanup failures', async () => {
    const first = await adminContext();
    const photo = await postPhoto(first.agent);
    const assetId = fakeCloudinary.uploads.at(-1).publicId;
    const other = await adminContext();
    expect((await mutation(other.agent, 'delete', `/api/v1/photos/${photo.body.data.id}`)).status).toBe(404);
    fakeCloudinary.failDelete = true;
    const deleted = await mutation(first.agent, 'delete', `/api/v1/photos/${photo.body.data.id}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data).toEqual({ id: photo.body.data.id });
    expect(await Photo.exists({ _id: photo.body.data.id })).toBeFalsy();
    expect(fakeCloudinary.deletions).toContain(assetId);
    expect(cleanupLog.entries).toContainEqual(expect.objectContaining({ event: 'cloudinary_cleanup_failed', operation: 'delete_photo' }));
    expect((await mutation(first.agent, 'delete', `/api/v1/photos/${photo.body.data.id}`)).status).toBe(404);
  });

  it('preserves linked photos on Event cancellation and blocks Event deletion until they are removed', async () => {
    const { user, wedding, agent } = await adminContext();
    const event = await createEvent(wedding, user._id);
    const photo = await postPhoto(agent, { eventId: event._id.toString() });
    expect((await mutation(agent, 'delete', `/api/v1/events/${event._id}`)).status).toBe(409);
    const cancelled = await mutation(agent, 'patch', `/api/v1/events/${event._id}/status`, { status: 'CANCELLED' });
    expect(cancelled.status).toBe(200);
    expect(await Photo.exists({ _id: photo.body.data.id, eventId: event._id })).toBeTruthy();
    expect((await mutation(agent, 'delete', `/api/v1/photos/${photo.body.data.id}`)).status).toBe(200);
    expect((await mutation(agent, 'delete', `/api/v1/events/${event._id}`)).status).toBe(200);
  });

  it('coordinates Event association with concurrent deletion and cleans an upload if the Event disappears during storage', async () => {
    let enteredCheck; let releaseCheck;
    const checkEntered = new Promise((resolve) => { enteredCheck = resolve; });
    const checkRelease = new Promise((resolve) => { releaseCheck = resolve; });
    const eventService = createEventService({ eventDependencyChecks: [async (event) => {
      const hasPhoto = await hasPhotosForEvent(event, Photo);
      enteredCheck();
      await checkRelease;
      return hasPhoto;
    }] });
    const guardedApp = createApp({
      authRateLimitOverrides: { login: 100 },
      eventService,
      photoService: createPhotoService({ cloudinary: fakeCloudinary, logger: cleanupLog }),
    });
    const { user, wedding, agent } = await adminContext(guardedApp);
    const event = await createEvent(wedding, user._id);
    const deleting = mutation(agent, 'delete', `/api/v1/events/${event._id}`);
    await checkEntered;
    const uploaded = await postPhoto(agent, { eventId: event._id.toString() });
    expect(uploaded.status).toBe(201);
    releaseCheck();
    expect((await deleting).status).toBe(409);
    expect(await Photo.exists({ _id: uploaded.body.data.id, eventId: event._id })).toBeTruthy();

    const eventTwo = await createEvent(wedding, user._id, 'Sangeet');
    let cloudUploaded; let continueUpload;
    const cloudUploadedPromise = new Promise((resolve) => { cloudUploaded = resolve; });
    const uploadContinue = new Promise((resolve) => { continueUpload = resolve; });
    fakeCloudinary.afterUpload = async (asset) => { cloudUploaded(asset); await uploadContinue; };
    const pendingUpload = postPhoto(agent, { eventId: eventTwo._id.toString() });
    const asset = await cloudUploadedPromise;
    expect((await mutation(agent, 'delete', `/api/v1/events/${eventTwo._id}`)).status).toBe(200);
    continueUpload();
    expect((await pendingUpload).status).toBe(404);
    expect(fakeCloudinary.deletions).toContain(asset.publicId);
    expect(await Photo.exists({ eventId: eventTwo._id })).toBeFalsy();
  }, 30000);

  it('cleans newly uploaded assets after a database write failure and refuses Cloudinary upload errors', async () => {
    const context = await adminContext();
    fakeCloudinary.failUpload = true;
    expect((await postPhoto(context.agent)).status).toBe(502);
    expect(await Photo.countDocuments({ weddingId: context.wedding._id })).toBe(0);
    fakeCloudinary.failUpload = false;

    const failingPhotoService = createPhotoService({
      cloudinary: fakeCloudinary,
      logger: cleanupLog,
      PhotoModel: { create: async () => { throw new Error('simulated database failure'); }, exists: (...args) => Photo.exists(...args) },
    });
    const failingApp = createApp({ photoService: failingPhotoService, authRateLimitOverrides: { login: 100 } });
    const { agent } = await adminContext(failingApp);
    const failed = await postPhoto(agent);
    expect(failed.status).toBe(500);
    expect(fakeCloudinary.deletions).toHaveLength(1);
  });

  it('provides an approved-only public projection without Cloudinary or reviewer metadata', async () => {
    const { user, wedding, agent } = await adminContext();
    const approved = await postPhoto(agent);
    await Photo.create({ weddingId: wedding._id, imageUrl: 'https://res.cloudinary.test/pending.png', storagePublicId: 'private/pending', uploadedByType: 'GUEST', status: 'PENDING' });
    await Photo.create({ weddingId: wedding._id, imageUrl: 'https://res.cloudinary.test/rejected.png', storagePublicId: 'private/rejected', uploadedByType: 'GUEST', status: 'REJECTED' });
    const publicPhotos = await createPhotoService().listApprovedPhotosForPublic(wedding._id);
    expect(publicPhotos).toHaveLength(1);
    expect(publicPhotos[0]).toMatchObject({ id: approved.body.data.id, imageUrl: approved.body.data.imageUrl });
    expect(publicPhotos[0]).not.toHaveProperty('storagePublicId');
    expect(publicPhotos[0]).not.toHaveProperty('uploadedByUserId');
    expect(publicPhotos[0]).not.toHaveProperty('reviewedBy');
    expect(user._id).toBeTruthy();
    expect((await agent.get('/api/v1/public/weddings/not-yet-published/photos')).status).toBe(404);
  });

  it('accepts approved JPEG, PNG and WebP content with matching MIME types', async () => {
    const { wedding } = await adminContext();
    await Wedding.updateOne({ _id: wedding._id }, { $set: { websitePublished: true } });
    for (const [buffer, contentType, filename] of [
      [jpeg, 'image/jpeg', 'memory.jpg'],
      [png, 'image/png', 'memory.png'],
      [webp, 'image/webp', 'memory.webp'],
    ]) {
      const response = await postGuestPhoto(wedding.slug, { buffer, contentType, filename });
      expect(response.status, JSON.stringify(response.body)).toBe(201);
    }
    expect(await Photo.countDocuments({ weddingId: wedding._id, uploadedByType: 'GUEST', status: 'PENDING' })).toBe(3);
  });

  it('accepts public uploads only for published Weddings and returns the approved minimal response', async () => {
    const { wedding } = await adminContext();
    const unpublished = await postGuestPhoto(wedding.slug);
    expect(unpublished.status).toBe(404);
    expect(fakeCloudinary.uploads).toHaveLength(0);

    await Wedding.updateOne({ _id: wedding._id }, { $set: { websitePublished: true } });
    const submitted = await postGuestPhoto(wedding.slug);
    expect(submitted.status).toBe(201);
    expect(submitted.body.data).toEqual({ status: 'PENDING' });
    expect(Object.keys(submitted.body.data)).toEqual(['status']);
    const stored = await Photo.findOne({ weddingId: wedding._id, uploadedByType: 'GUEST' }).lean();
    expect(stored).toMatchObject({ weddingId: wedding._id, uploadedByType: 'GUEST', status: 'PENDING' });
    expect(stored.uploadedByUserId).toBeUndefined();
    expect(submitted.body.data).not.toHaveProperty('imageUrl');
    expect(submitted.body.data).not.toHaveProperty('storagePublicId');
    expect((await postGuestPhoto('unknown-public-slug')).status).toBe(404);
    expect((await postGuestPhoto(wedding.slug, { buffer: null })).status).toBe(400);
    expect((await postGuestPhoto(wedding.slug, { buffer: Buffer.from('not an image') })).status).toBe(415);
    expect((await postGuestPhoto(wedding.slug, { contentType: 'image/jpeg' })).status).toBe(415);
    const tooLarge = Buffer.concat([png, Buffer.alloc(maxImageSize + 1 - png.length)]);
    expect((await postGuestPhoto(wedding.slug, { buffer: tooLarge })).status).toBe(413);
  });

  it('prevents guest control of approval metadata and validates optional same-Wedding Events', async () => {
    const first = await adminContext();
    await Wedding.updateOne({ _id: first.wedding._id }, { $set: { websitePublished: true } });
    const sameEvent = await createEvent(first.wedding, first.user._id);
    const other = await adminContext();
    await Wedding.updateOne({ _id: other.wedding._id }, { $set: { websitePublished: true } });
    const crossEvent = await createEvent(other.wedding, other.user._id);

    const valid = await postGuestPhoto(first.wedding.slug, { eventId: sameEvent._id.toString() });
    expect(valid.status).toBe(201);
    expect(await Photo.exists({ weddingId: first.wedding._id, eventId: sameEvent._id, status: 'PENDING', uploadedByType: 'GUEST' })).toBeTruthy();
    expect((await postGuestPhoto(first.wedding.slug, { eventId: crossEvent._id.toString() })).status).toBe(404);
    expect((await postGuestPhoto(first.wedding.slug, { eventId: 'invalid' })).status).toBe(400);
    await Event.updateOne({ _id: sameEvent._id }, { $set: { deletedAt: new Date() } });
    expect((await postGuestPhoto(first.wedding.slug, { eventId: sameEvent._id.toString() })).status).toBe(404);
    expect((await postGuestPhoto(first.wedding.slug, { fields: [['status', 'APPROVED']] })).status).toBe(400);
    expect((await postGuestPhoto(first.wedding.slug, { fields: [['uploadedByType', 'ADMIN']] })).status).toBe(400);
    expect((await postGuestPhoto(first.wedding.slug, { fields: [['reviewedBy', new mongoose.Types.ObjectId().toString()]] })).status).toBe(400);
  });

  it('applies the configured per-IP guest upload rate limit before parsing uploads', async () => {
    expect(testConfig.publicPhotoRateLimits.upload).toBe(5);
    expect(testConfig.publicPhotoRateLimitWindowMs).toBe(15 * 60 * 1000);
    const rateLimitedApp = createApp({
      photoService: createPhotoService({ cloudinary: fakeCloudinary, logger: cleanupLog }),
      publicPhotoRateLimitOverrides: { upload: 1, windowMs: 60000 },
    });
    const { wedding } = await adminContext();
    await Wedding.updateOne({ _id: wedding._id }, { $set: { websitePublished: true } });
    expect((await postGuestPhoto(wedding.slug, { targetApp: rateLimitedApp })).status).toBe(201);
    const limited = await postGuestPhoto(wedding.slug, { targetApp: rateLimitedApp });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(fakeCloudinary.uploads).toHaveLength(1);
  });

  it('applies approved guest Cloudinary failure and MongoDB compensation behavior', async () => {
    const context = await adminContext();
    await Wedding.updateOne({ _id: context.wedding._id }, { $set: { websitePublished: true } });
    fakeCloudinary.failUpload = true;
    expect((await postGuestPhoto(context.wedding.slug)).status).toBe(502);
    expect(await Photo.countDocuments({ weddingId: context.wedding._id, uploadedByType: 'GUEST' })).toBe(0);
    fakeCloudinary.failUpload = false;

    const failingPhotoService = createPhotoService({
      cloudinary: fakeCloudinary,
      logger: cleanupLog,
      PhotoModel: { create: async () => { throw new Error('simulated database failure'); }, exists: (...args) => Photo.exists(...args) },
    });
    const failingApp = createApp({
      photoService: failingPhotoService,
      publicPhotoRateLimitOverrides: { upload: 100 },
    });
    const failed = await postGuestPhoto(context.wedding.slug, { targetApp: failingApp });
    expect(failed.status).toBe(500);
    expect(fakeCloudinary.deletions).toHaveLength(1);
    expect(await Photo.countDocuments({ weddingId: context.wedding._id, uploadedByType: 'GUEST' })).toBe(0);

    fakeCloudinary.failDelete = true;
    const cleanupFailService = createPhotoService({
      cloudinary: fakeCloudinary,
      logger: cleanupLog,
      PhotoModel: { create: async () => { throw new Error('simulated database failure'); }, exists: (...args) => Photo.exists(...args) },
    });
    const cleanupFailApp = createApp({
      photoService: cleanupFailService,
      publicPhotoRateLimitOverrides: { upload: 100 },
    });
    const failedCleanup = await postGuestPhoto(context.wedding.slug, { targetApp: cleanupFailApp });
    expect(failedCleanup.status).toBe(500);
    expect(cleanupLog.entries).toContainEqual(expect.objectContaining({
      event: 'cloudinary_cleanup_failed',
      operation: 'cleanup_new_guest_photo_after_database_failure',
    }));
    expect(failedCleanup.body).not.toHaveProperty('data');
  });
});
