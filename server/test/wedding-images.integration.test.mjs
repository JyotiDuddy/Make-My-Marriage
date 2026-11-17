import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const serverDirectory = new URL('../', import.meta.url).pathname;
const testDatabaseName = `mmm_m5_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/t7cAAAAASUVORK5CYII=',
  'base64',
);
const maxImageSize = 10 * 1024 * 1024;

let mongoose;
let User;
let Wedding;
let app;
let testConfig;
let fakeCloudinary;
let cleanupLog;
let dbCreated = false;

function safeError(message, error) {
  return new Error(error?.code ? `${message} (${error.code}).` : `${message}.`);
}

function uniqueEmail() {
  return `m5-${randomUUID().replaceAll('-', '').slice(0, 18)}@example.test`;
}

async function csrfToken(agent) {
  const response = await agent.get('/api/v1/auth/csrf');
  expect(response.status).toBe(200);
  return response.body.data.csrfToken;
}

async function createAdmin() {
  const password = 'M5AdminPassword123';
  const user = await User.create({
    name: 'M5 Test Admin',
    email: uniqueEmail(),
    passwordHash: await require('bcrypt').hash(password, testConfig.bcryptSaltRounds),
    role: 'ADMIN',
    status: 'ACTIVE',
    activatedAt: new Date(),
  });
  return { user, password };
}

async function createManager() {
  const password = 'M5ManagerPassword123';
  const user = await User.create({
    name: 'M5 Test Manager',
    email: uniqueEmail(),
    passwordHash: await require('bcrypt').hash(password, testConfig.bcryptSaltRounds),
    role: 'MANAGER',
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
  expect(response.status).toBe(200);
  return agent;
}

async function post(agent, url, body = {}) {
  const token = await csrfToken(agent);
  return agent.post(url).set('X-CSRF-Token', token).send(body);
}

async function createWedding(agent) {
  const response = await post(agent, '/api/v1/weddings', {
    title: 'M5 Test Wedding',
    partnerOneName: 'Asha',
    partnerTwoName: 'Dev',
    weddingDate: '2027-02-15',
    timeZone: 'Asia/Kolkata',
    slug: `m5-${randomUUID().replaceAll('-', '').slice(0, 12)}`,
  });
  expect(response.status).toBe(201);
  return response;
}

async function adminWithWedding() {
  const admin = await createAdmin();
  const agent = await loggedIn(admin.user, admin.password);
  const weddingResponse = await createWedding(agent);
  return {
    ...admin,
    agent,
    weddingId: weddingResponse.body.data.wedding.id,
  };
}

async function putCover(agent, buffer = png, contentType = 'image/png') {
  const token = await csrfToken(agent);
  return agent.put('/api/v1/weddings/me/cover-image')
    .set('X-CSRF-Token', token)
    .attach('image', buffer, { filename: 'cover.png', contentType });
}

async function postStoryImage(agent, buffer = png, contentType = 'image/png', altText = 'A memory') {
  const token = await csrfToken(agent);
  const request = agent.post('/api/v1/weddings/me/our-story/images')
    .set('X-CSRF-Token', token)
    .attach('image', buffer, { filename: 'story.png', contentType });
  if (altText !== undefined && altText !== null) request.field('altText', altText);
  return request;
}

describe('M5 Wedding images and Our Story', () => {
  beforeAll(async () => {
    let probeConnection;
    let setupStage = 'load server configuration';
    try {
      process.env.NODE_ENV = 'test';
      process.env.MONGO_DB_URI = process.env.M5_TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017';
      process.env.MONGO_DB_NAME = testDatabaseName;
      process.env.SESSION_SECRET = randomBytes(64).toString('hex');
      process.env.FRONTEND_ORIGIN = 'http://localhost:5173';

      const dotenv = require('dotenv');
      const originalDotenvConfig = dotenv.config;
      dotenv.config = () => ({ parsed: {} });
      const configPath = `${serverDirectory}src/config/env.js`;
      try {
        testConfig = require(configPath);
      } finally {
        dotenv.config = originalDotenvConfig;
      }
      const uri = testConfig.mongoUri;

      setupStage = 'validate local test database safety';
      const uriHost = new URL(uri).hostname;
      if (!['localhost', '127.0.0.1', '::1'].includes(uriHost)) {
        throw new Error('M5 tests accept only a loopback MongoDB URI.');
      }

      mongoose = require('mongoose');
      setupStage = 'check the generated database name';
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

      setupStage = 'initialize application models and adapters';
      User = require(`${serverDirectory}src/modules/auth/user.model.js`);
      Wedding = require(`${serverDirectory}src/modules/wedding/wedding.model.js`);
      const connectDB = require(`${serverDirectory}src/config/database.js`);
      const { createAuthService } = require(`${serverDirectory}src/modules/auth/auth.service.js`);
      const { createWeddingService } = require(`${serverDirectory}src/modules/wedding/wedding.service.js`);
      const { createApp } = require(`${serverDirectory}src/app.js`);

      fakeCloudinary = {
        uploads: [],
        deletions: [],
        failUpload: false,
        failDelete: false,
        get isConfigured() { return true; },
        async uploadImage({ buffer, folder }) {
          if (this.failUpload) throw Object.assign(new Error('fake provider error'), { code: 'FAKE_UPLOAD' });
          const publicId = `${folder}/${randomUUID()}`;
          const asset = { publicId, url: `https://res.cloudinary.test/${publicId}.webp`, size: buffer.length };
          this.uploads.push(asset);
          return { publicId: asset.publicId, url: asset.url };
        },
        async deleteImage(publicId) {
          this.deletions.push(publicId);
          if (this.failDelete) throw Object.assign(new Error('fake provider error'), { code: 'FAKE_DELETE' });
        },
      };
      cleanupLog = {
        entries: [],
        error(value) { this.entries.push(JSON.parse(value)); },
      };

      app = createApp({
        authService: createAuthService(),
        weddingService: createWeddingService({ cloudinary: fakeCloudinary, logger: cleanupLog }),
        authRateLimitOverrides: { login: 100 },
      });
      setupStage = 'connect to the isolated test database';
      await connectDB();
      if (mongoose.connection.name !== testDatabaseName) {
        throw new Error('The backend did not select the isolated M5 database.');
      }
      dbCreated = true;
    } catch (error) {
      if (probeConnection) await probeConnection.close().catch(() => {});
      if (mongoose?.connection?.readyState === 1 && dbCreated) {
        await mongoose.connection.dropDatabase().catch(() => {});
      }
      if (mongoose?.connection?.readyState) await mongoose.disconnect().catch(() => {});
      throw safeError(`Could not safely prepare M5 integration tests while trying to ${setupStage}`, error);
    }
  }, 60000);

  beforeEach(() => {
    fakeCloudinary.uploads.length = 0;
    fakeCloudinary.deletions.length = 0;
    fakeCloudinary.failUpload = false;
    fakeCloudinary.failDelete = false;
    cleanupLog.entries.length = 0;
  });

  afterAll(async () => {
    if (!mongoose?.connection?.readyState) return;
    try {
      if (dbCreated) {
        await mongoose.connection.dropDatabase();
        dbCreated = false;
      }
    } finally {
      await mongoose.disconnect();
    }
  }, 60000);

  it('uploads and replaces a cover without exposing Cloudinary IDs', async () => {
    const { agent, user, weddingId } = await adminWithWedding();
    const first = await putCover(agent);
    expect(first.status).toBe(200);
    expect(first.body.data.coverImage).toEqual({ url: fakeCloudinary.uploads[0].url });
    expect(first.body.data.coverImage).not.toHaveProperty('publicId');

    const replacement = await putCover(agent);
    expect(replacement.status).toBe(200);
    expect(replacement.body.data.coverImage).toEqual({ url: fakeCloudinary.uploads[1].url });
    expect(fakeCloudinary.deletions).toEqual([fakeCloudinary.uploads[0].publicId]);
    const wedding = await Wedding.findOne({ adminId: user._id }).lean();
    expect(wedding.coverImage).toEqual({ url: fakeCloudinary.uploads[1].url, publicId: fakeCloudinary.uploads[1].publicId });
    expect(wedding._id.toString()).toBe(weddingId);
  });

  it('rejects unsupported content and MIME/signature mismatches for both upload routes', async () => {
    const { agent } = await adminWithWedding();
    const invalidCover = await putCover(agent, Buffer.from('not an image'), 'image/png');
    expect(invalidCover.status).toBe(415);
    expect(invalidCover.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');

    const mismatchedCover = await putCover(agent, png, 'image/jpeg');
    expect(mismatchedCover.status).toBe(415);
    expect(mismatchedCover.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');

    const invalidStory = await postStoryImage(agent, Buffer.from('not an image'));
    expect(invalidStory.status).toBe(415);
    expect(invalidStory.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(fakeCloudinary.uploads).toHaveLength(0);
  });

  it('rejects files over 10 MB with the documented error envelope', async () => {
    const { agent } = await adminWithWedding();
    const tooLarge = Buffer.concat([png, Buffer.alloc(maxImageSize + 1 - png.length)]);
    const coverResponse = await putCover(agent, tooLarge);
    expect(coverResponse.status).toBe(413);
    expect(coverResponse.body).toMatchObject({ success: false, error: { code: 'FILE_TOO_LARGE' } });

    const storyResponse = await postStoryImage(agent, tooLarge);
    expect(storyResponse.status).toBe(413);
    expect(storyResponse.body.error.code).toBe('FILE_TOO_LARGE');
    expect(fakeCloudinary.uploads).toHaveLength(0);
  });

  it('cleans a new cover after a database failure and retains the previous cover', async () => {
    const { agent, user } = await adminWithWedding();
    expect((await putCover(agent)).status).toBe(200);
    const oldCover = (await Wedding.findOne({ adminId: user._id }).lean()).coverImage;
    const original = Wedding.findOneAndUpdate;
    const spy = vi.spyOn(Wedding, 'findOneAndUpdate').mockRejectedValueOnce(new Error('simulated database error'));
    const failed = await putCover(agent);
    spy.mockRestore();

    expect(failed.status).toBe(500);
    expect(fakeCloudinary.deletions).toEqual([fakeCloudinary.uploads[1].publicId]);
    expect((await Wedding.findOne({ adminId: user._id }).lean()).coverImage).toEqual(oldCover);
    expect(Wedding.findOneAndUpdate).toBe(original);
  });

  it('deletes covers idempotently and logs cleanup failures after removing the database reference', async () => {
    const { agent, user } = await adminWithWedding();
    const firstDeletion = await agent.delete('/api/v1/weddings/me/cover-image')
      .set('X-CSRF-Token', await csrfToken(agent));
    expect(firstDeletion.status).toBe(200);
    expect(firstDeletion.body.data.coverImage).toBeNull();

    await putCover(agent);
    const publicId = fakeCloudinary.uploads[0].publicId;
    fakeCloudinary.failDelete = true;
    const response = await agent.delete('/api/v1/weddings/me/cover-image')
      .set('X-CSRF-Token', await csrfToken(agent));

    expect(response.status).toBe(200);
    expect(response.body.data.coverImage).toBeNull();
    expect((await Wedding.findOne({ adminId: user._id }).lean()).coverImage).toBeUndefined();
    expect(cleanupLog.entries).toContainEqual(expect.objectContaining({
      event: 'cloudinary_cleanup_failed',
      operation: 'delete_cover',
      publicId,
    }));
  });

  it('updates and clears the description while preserving existing images', async () => {
    const { agent, user } = await adminWithWedding();
    const upload = await postStoryImage(agent, png, 'image/png', 'Story one');
    expect(upload.status).toBe(200);
    const id = upload.body.data.image.id;
    const token = await csrfToken(agent);
    const update = await agent.patch('/api/v1/weddings/me/our-story')
      .set('X-CSRF-Token', token)
      .send({ description: 'A story for our guests.' });
    expect(update.status).toBe(200);
    expect(update.body.data.ourStory).toMatchObject({
      description: 'A story for our guests.',
      images: [{ id, altText: 'Story one' }],
    });
    expect(update.body.data.ourStory.images[0]).not.toHaveProperty('publicId');

    const clear = await agent.patch('/api/v1/weddings/me/our-story')
      .set('X-CSRF-Token', await csrfToken(agent))
      .send({ description: '' });
    expect(clear.status).toBe(200);
    expect(clear.body.data.ourStory).toMatchObject({ description: '', images: [{ id }] });
    const wedding = await Wedding.findOne({ adminId: user._id }).lean();
    expect(wedding.ourStory.images).toHaveLength(1);
  });

  it('rejects descriptions longer than 1,000 characters and unsupported fields', async () => {
    const { agent } = await adminWithWedding();
    const tooLong = await agent.patch('/api/v1/weddings/me/our-story')
      .set('X-CSRF-Token', await csrfToken(agent))
      .send({ description: 'x'.repeat(1001) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.code).toBe('VALIDATION_ERROR');
    const extraField = await agent.patch('/api/v1/weddings/me/our-story')
      .set('X-CSRF-Token', await csrfToken(agent))
      .send({ description: 'Story', images: [] });
    expect(extraField.status).toBe(400);
  });

  it('allows two Story images, rejects a third, and cleans its excess Cloudinary asset', async () => {
    const { agent, user } = await adminWithWedding();
    const first = await postStoryImage(agent, png, 'image/png', 'First');
    const second = await postStoryImage(agent, png, 'image/png', 'Second');
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await postStoryImage(agent, png, 'image/png', 'Third')).status).toBe(409);
    const wedding = await Wedding.findOne({ adminId: user._id });
    expect(wedding.ourStory.images).toHaveLength(2);
    expect(fakeCloudinary.deletions).toEqual([fakeCloudinary.uploads[2].publicId]);
    expect(first.body.data.image).toMatchObject({ url: fakeCloudinary.uploads[0].url, altText: 'First' });
    expect(first.body.data.image).not.toHaveProperty('publicId');
  });

  it('rejects concurrent uploads that would exceed the two-image limit', async () => {
    const { agent, user } = await adminWithWedding();
    const token = await csrfToken(agent);
    const responses = await Promise.all([1, 2, 3].map((number) => agent.post('/api/v1/weddings/me/our-story/images')
      .set('X-CSRF-Token', token)
      .attach('image', png, { filename: `story-${number}.png`, contentType: 'image/png' })
      .field('altText', `Story ${number}`)));

    expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 409]);
    expect((await Wedding.findOne({ adminId: user._id })).ourStory.images).toHaveLength(2);
    expect(fakeCloudinary.uploads).toHaveLength(3);
    expect(fakeCloudinary.deletions).toHaveLength(1);
  });

  it('requires non-empty altText', async () => {
    const { agent } = await adminWithWedding();
    const missing = await postStoryImage(agent, png, 'image/png', null);
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');
    const blank = await postStoryImage(agent, png, 'image/png', '   ');
    expect(blank.status).toBe(400);
    expect(fakeCloudinary.uploads).toHaveLength(0);
  });

  it('deletes Story images by embedded ID, scopes deletion to its Wedding, and handles missing IDs', async () => {
    const firstAdmin = await adminWithWedding();
    const secondAdmin = await adminWithWedding();
    const uploaded = await postStoryImage(firstAdmin.agent, png, 'image/png', 'Private Story');
    const imageId = uploaded.body.data.image.id;

    const crossWedding = await secondAdmin.agent.delete(`/api/v1/weddings/me/our-story/images/${imageId}`)
      .set('X-CSRF-Token', await csrfToken(secondAdmin.agent));
    expect(crossWedding.status).toBe(404);
    expect((await Wedding.findById(firstAdmin.weddingId)).ourStory.images).toHaveLength(1);

    const removed = await firstAdmin.agent.delete(`/api/v1/weddings/me/our-story/images/${imageId}`)
      .set('X-CSRF-Token', await csrfToken(firstAdmin.agent));
    expect(removed.status).toBe(200);
    expect(removed.body.data.ourStory.images).toEqual([]);
    expect(removed.body.data.ourStory.images).toEqual([]);
    const missing = await firstAdmin.agent.delete(`/api/v1/weddings/me/our-story/images/${imageId}`)
      .set('X-CSRF-Token', await csrfToken(firstAdmin.agent));
    expect(missing.status).toBe(404);
  });

  it('keeps a removed Story image absent and records Cloudinary cleanup failure', async () => {
    const { agent, user, weddingId } = await adminWithWedding();
    const uploaded = await postStoryImage(agent, png, 'image/png', 'Remove me');
    const publicId = fakeCloudinary.uploads[0].publicId;
    fakeCloudinary.failDelete = true;
    const response = await agent.delete(`/api/v1/weddings/me/our-story/images/${uploaded.body.data.image.id}`)
      .set('X-CSRF-Token', await csrfToken(agent));

    expect(response.status).toBe(200);
    expect(response.body.data.ourStory.images).toEqual([]);
    expect((await Wedding.findOne({ adminId: user._id })).ourStory.images).toHaveLength(0);
    expect(cleanupLog.entries).toContainEqual(expect.objectContaining({
      event: 'cloudinary_cleanup_failed',
      operation: 'delete_story_image',
      publicId,
      weddingId,
      errorCode: 'FAKE_DELETE',
    }));
  });

  it('cleans a newly uploaded Story asset when the MongoDB update fails', async () => {
    const { agent, user } = await adminWithWedding();
    const spy = vi.spyOn(Wedding, 'findOneAndUpdate').mockRejectedValueOnce(new Error('simulated database error'));
    const response = await postStoryImage(agent, png, 'image/png', 'Story');
    spy.mockRestore();

    expect(response.status).toBe(500);
    expect(fakeCloudinary.deletions).toEqual([fakeCloudinary.uploads[0].publicId]);
    const wedding = await Wedding.findOne({ adminId: user._id }).lean();
    expect(wedding.ourStory).toBeUndefined();
  });

  it('records a failed compensating asset cleanup for manual retry', async () => {
    const { agent, user, weddingId } = await adminWithWedding();
    fakeCloudinary.failDelete = true;
    const spy = vi.spyOn(Wedding, 'findOneAndUpdate').mockRejectedValueOnce(new Error('simulated database error'));
    const response = await postStoryImage(agent, png, 'image/png', 'Cleanup case');
    spy.mockRestore();

    const publicId = fakeCloudinary.uploads[0].publicId;
    expect(response.status).toBe(500);
    expect(cleanupLog.entries).toContainEqual(expect.objectContaining({
      event: 'cloudinary_cleanup_failed',
      operation: 'cleanup_new_story_image_after_database_failure',
      publicId,
      weddingId,
      errorCode: 'FAKE_DELETE',
    }));
    expect((await Wedding.findOne({ adminId: user._id }).lean()).ourStory).toBeUndefined();
  });

  it('denies anonymous users and Managers and enforces CSRF for Admin mutations', async () => {
    const anonymous = require('supertest').agent(app);
    const denied = await anonymous.delete('/api/v1/weddings/me/cover-image');
    expect(denied.status).toBe(401);

    const manager = await createManager();
    const managerAgent = await loggedIn(manager.user, manager.password);
    const managerDenied = await postStoryImage(managerAgent);
    expect(managerDenied.status).toBe(403);

    const admin = await adminWithWedding();
    const noCsrf = await admin.agent.patch('/api/v1/weddings/me/our-story').send({ description: 'No token' });
    expect(noCsrf.status).toBe(403);
    const coverNoCsrf = await admin.agent.put('/api/v1/weddings/me/cover-image')
      .attach('image', png, { filename: 'cover.png', contentType: 'image/png' });
    expect(coverNoCsrf.status).toBe(403);
    expect(fakeCloudinary.uploads).toHaveLength(0);
  });
});
