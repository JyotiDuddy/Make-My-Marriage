import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const testDatabaseName = `mmm_m4_${runId}`;

let mongoose;
let User;
let Wedding;
let app;
let createApp;
let connectDB;
let authService;
let weddingService;
let emailAdapter;
let hashToken;
let testDatabaseCreated = false;
let testConfig;
let failManagerEmail = false;
let checkManagerInvitationCommit = false;

function uniqueEmail() {
  return `m4-${randomUUID().replaceAll('-', '').slice(0, 18)}@example.test`;
}

function safeError(message, error) {
  const code = error?.code ?? error?.name;
  return new Error(code ? `${message} (${code}).` : `${message}.`);
}

async function csrfToken(agent) {
  const response = await agent.get('/api/v1/auth/csrf');
  expect(response.status).toBe(200);
  return response.body.data.csrfToken;
}

async function post(agent, url, body = {}) {
  const token = await csrfToken(agent);
  return agent.post(url).set('X-CSRF-Token', token).send(body);
}

async function patch(agent, url, body) {
  const token = await csrfToken(agent);
  return agent.patch(url).set('X-CSRF-Token', token).send(body);
}

async function createAdmin() {
  const password = 'AdminTestPassword123';
  const user = await User.create({
    name: 'M4 Test Admin',
    email: uniqueEmail(),
    passwordHash: await require('bcrypt').hash(password, testConfig.bcryptSaltRounds),
    role: 'ADMIN',
    status: 'ACTIVE',
    activatedAt: new Date(),
  });
  return { user, password };
}

async function createManager(overrides = {}) {
  const password = 'ManagerTestPassword123';
  const user = await User.create({
    name: 'M4 Test Manager',
    email: uniqueEmail(),
    passwordHash: await require('bcrypt').hash(password, testConfig.bcryptSaltRounds),
    role: 'MANAGER',
    status: 'ACTIVE',
    activatedAt: new Date(),
    ...overrides,
  });
  return { user, password };
}

async function loggedIn(user, password, targetApp = app) {
  const agent = require('supertest').agent(targetApp);
  const csrf = await csrfToken(agent);
  const response = await agent.post('/api/v1/auth/login')
    .set('X-CSRF-Token', csrf)
    .send({ email: user.email, password });
  expect(response.status).toBe(200);
  return agent;
}

async function createWedding(agent, overrides = {}) {
  return post(agent, '/api/v1/weddings', {
    title: 'M4 Test Wedding',
    partnerOneName: 'Asha',
    partnerTwoName: 'Dev',
    weddingDate: '2027-02-15',
    timeZone: 'Asia/Kolkata',
    slug: `m4-${randomUUID().replaceAll('-', '').slice(0, 12)}`,
    ...overrides,
  });
}

async function inviteManager(agent, email = uniqueEmail(), name = 'Invited Manager') {
  return post(agent, '/api/v1/weddings/me/manager-invitation', { name, email });
}

describe('M4 Wedding setup and Manager onboarding', () => {
  beforeAll(async () => {
    let probeConnection;
    try {
      const dotenv = require('dotenv');
      const uriOverride = process.env.M4_TEST_MONGO_URI;
      const localConfig = uriOverride
        ? {}
        : dotenv.parse(readFileSync(path.join(serverDirectory, '.env')));
      const uri = uriOverride ?? localConfig.MONGO_DB_URI;
      const applicationDatabaseName = uriOverride ? 'm4-test-override' : localConfig.MONGO_DB_NAME;
      const uriHost = uri ? new URL(uri).hostname : '';

      if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
        throw new Error('The local MongoDB connection configuration is missing or invalid.');
      }
      if (!['localhost', '127.0.0.1', '::1'].includes(uriHost)) {
        throw new Error('M4 integration tests require a loopback MongoDB URI.');
      }
      if (!uriOverride && localConfig.NODE_ENV !== 'development') {
        throw new Error('M4 integration tests require a connection configured for development.');
      }
      if (!applicationDatabaseName || /prod(uction)?|live/i.test(applicationDatabaseName)) {
        throw new Error('Refusing to use a production-like configured database.');
      }
      if (applicationDatabaseName === testDatabaseName) {
        throw new Error('The M4 test database must differ from the configured application database.');
      }

      for (const name of [
        'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM',
      ]) delete process.env[name];
      process.env.NODE_ENV = 'test';
      process.env.MONGO_DB_URI = uri;
      process.env.MONGO_DB_NAME = testDatabaseName;
      process.env.SESSION_SECRET = randomBytes(64).toString('hex');
      process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
      process.env.MANAGER_ACTIVATION_TOKEN_TTL_MS = '86400000';
      process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';
      process.env.AUTH_REGISTER_RATE_LIMIT_MAX = '100';
      process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
      process.env.AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX = '100';
      process.env.AUTH_RESET_PASSWORD_RATE_LIMIT_MAX = '100';
      process.env.AUTH_MANAGER_INVITATION_RATE_LIMIT_MAX = '100';
      process.env.AUTH_MANAGER_INVITATION_RESEND_RATE_LIMIT_MAX = '100';
      process.env.AUTH_MANAGER_ACTIVATION_RATE_LIMIT_MAX = '100';

      mongoose = require('mongoose');
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

      const originalDotenvConfig = dotenv.config;
      dotenv.config = () => ({ parsed: {} });
      let config;
      try {
        config = require(path.join(serverDirectory, 'src/config/env.js'));
      } finally {
        dotenv.config = originalDotenvConfig;
      }
      testConfig = config;
      User = require(path.join(serverDirectory, 'src/modules/auth/user.model.js'));
      Wedding = require(path.join(serverDirectory, 'src/modules/wedding/wedding.model.js'));
      connectDB = require(path.join(serverDirectory, 'src/config/database.js'));
      const authModule = require(path.join(serverDirectory, 'src/modules/auth/auth.service.js'));
      const weddingModule = require(path.join(serverDirectory, 'src/modules/wedding/wedding.service.js'));
      authService = authModule.createAuthService;
      weddingService = weddingModule.createWeddingService;
      hashToken = authModule.hashToken;

      emailAdapter = {
        messages: [],
        async sendPasswordResetEmail(message) {
          this.messages.push({ type: 'password-reset', ...message });
        },
        async sendManagerInvitationEmail(message) {
          if (failManagerEmail) throw new Error('Simulated SMTP failure.');
          if (checkManagerInvitationCommit) {
            const assignedWedding = await Wedding.findOne({ managerId: message.managerId });
            const savedManager = await User.findById(message.managerId)
              .select('activationTokenHash activationExpiresAt status');
            if (!assignedWedding || !savedManager || savedManager.status !== 'INVITED') {
              throw new Error('Invitation callback ran before its MongoDB transaction committed.');
            }
            if (savedManager.activationTokenHash !== hashToken(message.token)) {
              throw new Error('Persisted invitation token did not match the delivered token.');
            }
          }
          this.messages.push({ type: 'manager-invitation', ...message });
        },
      };

      const service = authService({ mailer: emailAdapter });
      const wedding = weddingService({ mailer: emailAdapter });
      const appModule = require(path.join(serverDirectory, 'src/app.js'));
      createApp = appModule.createApp;
      app = createApp({ authService: service, weddingService: wedding });

      await connectDB();
      if (mongoose.connection.name !== testDatabaseName) {
        throw new Error('The backend did not select the isolated M4 database.');
      }
      testDatabaseCreated = true;
    } catch (error) {
      if (probeConnection) await probeConnection.close().catch(() => {});
      if (mongoose?.connection?.readyState === 1 && testDatabaseCreated) {
        await mongoose.connection.dropDatabase().catch(() => {});
      }
      if (mongoose?.connection?.readyState) await mongoose.disconnect().catch(() => {});
      throw safeError('Could not safely prepare M4 integration tests', error);
    }
  }, 60000);

  afterAll(async () => {
    if (!mongoose?.connection?.readyState) return;
    try {
      if (testDatabaseCreated) {
        await mongoose.connection.dropDatabase();
        testDatabaseCreated = false;
      }
    } catch (error) {
      throw safeError('Could not clean up the isolated M4 database', error);
    } finally {
      await mongoose.disconnect();
    }
  }, 60000);

  it('allows an Admin to create one Wedding using session ownership and safe response fields', async () => {
    const admin = await createAdmin();
    const agent = await loggedIn(admin.user, admin.password);
    const response = await createWedding(agent, { adminId: new mongoose.Types.ObjectId().toString() });

    expect(response.status).toBe(400);
    const valid = await createWedding(agent);
    expect(valid.status).toBe(201);
    expect(valid.body.data.wedding).toMatchObject({
      title: 'M4 Test Wedding',
      websitePublished: false,
      manager: null,
    });
    expect(valid.body.data.wedding.adminId).toBeUndefined();
    expect(valid.body.data.wedding.managerId).toBeUndefined();
    const storedWedding = await Wedding.findOne({ adminId: admin.user._id }).lean();
    expect(storedWedding).toBeTruthy();
    expect(storedWedding.managerId).toBeNull();
  });

  it('rejects anonymous and Manager Wedding creation and prevents a second Wedding', async () => {
    const anonymous = await post(require('supertest').agent(app), '/api/v1/weddings', {});
    expect(anonymous.status).toBe(401);

    const admin = await createAdmin();
    const adminAgent = await loggedIn(admin.user, admin.password);
    const first = await createWedding(adminAgent);
    expect(first.status).toBe(201);
    const second = await createWedding(adminAgent);
    expect(second.status).toBe(409);

    const manager = await createManager();
    const managerAgent = await loggedIn(manager.user, manager.password);
    const managerCreate = await createWedding(managerAgent);
    expect(managerCreate.status).toBe(403);
  });

  it('handles duplicate slugs and invalid required Wedding fields', async () => {
    const adminOne = await createAdmin();
    const adminTwo = await createAdmin();
    const agentOne = await loggedIn(adminOne.user, adminOne.password);
    const agentTwo = await loggedIn(adminTwo.user, adminTwo.password);
    const first = await createWedding(agentOne, { slug: 'shared-m4-slug' });
    expect(first.status).toBe(201);
    expect((await createWedding(agentTwo, { slug: 'shared-m4-slug' })).status).toBe(409);
    const secondWedding = await createWedding(agentTwo);
    expect(secondWedding.status).toBe(201);
    expect((await patch(agentTwo, '/api/v1/weddings/me', { slug: 'shared-m4-slug' })).status).toBe(409);
    expect((await createWedding(agentTwo, { weddingDate: '2027-02-30' })).status).toBe(400);
    expect((await createWedding(agentTwo, { timeZone: 'Not/A_Zone' })).status).toBe(400);
  });

  it('resolves /me from Admin or Manager identity and enforces Manager read isolation', async () => {
    const admin = await createAdmin();
    const adminAgent = await loggedIn(admin.user, admin.password);
    const weddingResponse = await createWedding(adminAgent);
    const weddingId = weddingResponse.body.data.wedding.id;
    const invite = await inviteManager(adminAgent);
    expect(invite.status).toBe(201);
    const token = emailAdapter.messages.at(-1).token;
    const managerAgent = require('supertest').agent(app);
    const activation = await post(managerAgent, '/api/v1/auth/manager-activation', {
      token,
      password: 'ActivatedManager123',
    });
    expect(activation.status).toBe(200);

    const managerWedding = await managerAgent.get('/api/v1/weddings/me');
    expect(managerWedding.status).toBe(200);
    expect(managerWedding.body.data.wedding.id).toBe(weddingId);
    expect((await adminAgent.get('/api/v1/weddings/me')).body.data.wedding.id).toBe(weddingId);
    expect((await patch(managerAgent, '/api/v1/weddings/me/publication', { websitePublished: true })).status).toBe(403);
    expect((await inviteManager(managerAgent)).status).toBe(403);

    const otherAdmin = await createAdmin();
    const otherAdminAgent = await loggedIn(otherAdmin.user, otherAdmin.password);
    const otherWedding = await createWedding(otherAdminAgent);
    const byClientSuppliedId = await managerAgent.get(`/api/v1/weddings/me?weddingId=${otherWedding.body.data.wedding.id}`);
    expect(byClientSuppliedId.body.data.wedding.id).toBe(weddingId);
  }, 30000);

  it('allows only documented wedding updates and rejects Manager or protected-field changes', async () => {
    const admin = await createAdmin();
    const agent = await loggedIn(admin.user, admin.password);
    await createWedding(agent);

    const csrf = await csrfToken(agent);
    const deniedField = await agent.patch('/api/v1/weddings/me')
      .set('X-CSRF-Token', csrf)
      .send({ managerId: new mongoose.Types.ObjectId().toString() });
    expect(deniedField.status).toBe(400);

    const updated = await patch(agent, '/api/v1/weddings/me', {
      title: 'Updated M4 Test Wedding',
      introduction: 'A short welcome.',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.wedding).toMatchObject({
      title: 'Updated M4 Test Wedding',
      introduction: 'A short welcome.',
    });

    const manager = await createManager();
    const managerAgent = await loggedIn(manager.user, manager.password);
    const managerUpdate = await patch(managerAgent, '/api/v1/weddings/me', { title: 'Not allowed' });
    expect(managerUpdate.status).toBe(403);
  });

  it('requires CSRF and publishes/unpublishes without content prerequisites or RSVP-token changes', async () => {
    const admin = await createAdmin();
    const agent = await loggedIn(admin.user, admin.password);
    const created = await createWedding(agent);
    const weddingId = new mongoose.Types.ObjectId(created.body.data.wedding.id);
    const guestCollection = mongoose.connection.db.collection('guests');
    const guestFixture = {
      _id: new mongoose.Types.ObjectId(),
      weddingId,
      rsvpAccess: { tokenHash: `test-rsvp-${runId}`, revokedAt: null },
    };
    await guestCollection.insertOne(guestFixture);

    const missingCsrf = await agent.patch('/api/v1/weddings/me/publication').send({ websitePublished: true });
    expect(missingCsrf.status).toBe(403);

    const published = await patch(agent, '/api/v1/weddings/me/publication', { websitePublished: true });
    expect(published.status).toBe(200);
    expect(published.body.data.wedding.websitePublished).toBe(true);
    expect(published.body.data.wedding.publishedAt).toBeTruthy();

    const unpublished = await patch(agent, '/api/v1/weddings/me/publication', { websitePublished: false });
    expect(unpublished.status).toBe(200);
    expect(unpublished.body.data.wedding).toMatchObject({ websitePublished: false, publishedAt: null });
    const unchangedGuest = await guestCollection.findOne({ _id: guestFixture._id });
    expect(unchangedGuest.rsvpAccess).toEqual(guestFixture.rsvpAccess);
  });

  it('commits the Manager assignment before email and stores only a hashed token', async () => {
    const admin = await createAdmin();
    const agent = await loggedIn(admin.user, admin.password);
    await createWedding(agent);
    checkManagerInvitationCommit = true;
    const response = await inviteManager(agent);
    checkManagerInvitationCommit = false;

    expect(response.status).toBe(201);
    expect(response.body.data.manager).toMatchObject({ status: 'INVITED' });
    const message = emailAdapter.messages.at(-1);
    const manager = await User.findById(response.body.data.manager.id)
      .select('name email status activationTokenHash activationExpiresAt passwordHash');
    const assignedWedding = await Wedding.findOne({ adminId: admin.user._id });

    expect(assignedWedding.managerId.toString()).toBe(manager._id.toString());
    expect(manager.status).toBe('INVITED');
    expect(manager.passwordHash).toBeUndefined();
    expect(manager.activationTokenHash).toBe(hashToken(message.token));
    expect(manager.activationTokenHash).not.toBe(message.token);
    expect(manager.activationExpiresAt.getTime() - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(JSON.stringify(response.body)).not.toContain(message.token);
  });

  it('rejects an email already used by any account and prevents a second Manager invitation', async () => {
    const admin = await createAdmin();
    const agent = await loggedIn(admin.user, admin.password);
    await createWedding(agent);
    const existing = await createManager();
    const invitedEmail = uniqueEmail();
    const existingAddress = await inviteManager(agent, existing.user.email);
    expect(existingAddress.status).toBe(409);

    expect((await inviteManager(agent, invitedEmail)).status).toBe(201);
    const second = await inviteManager(agent, invitedEmail);
    expect(second.status).toBe(409);
    expect(await User.countDocuments({ email: invitedEmail, role: 'MANAGER', status: 'INVITED' })).toBe(1);
  });

  it('retains a committed invitation when SMTP fails and supports resending it', async () => {
    const admin = await createAdmin();
    const agent = await loggedIn(admin.user, admin.password);
    await createWedding(agent);
    failManagerEmail = true;
    const failed = await inviteManager(agent);
    failManagerEmail = false;

    expect(failed.status).toBe(502);
    expect(failed.body.message).toMatch(/invitation was created, but email delivery failed/i);
    const wedding = await Wedding.findOne({ adminId: admin.user._id });
    const manager = await User.findById(wedding.managerId).select('email status activationTokenHash');
    expect(manager.status).toBe('INVITED');
    const previousHash = manager.activationTokenHash;

    const resent = await post(agent, '/api/v1/weddings/me/manager-invitation/resend');
    expect(resent.status).toBe(200);
    const replacement = emailAdapter.messages.at(-1);
    const refreshed = await User.findById(manager._id).select('activationTokenHash status');
    expect(refreshed.status).toBe('INVITED');
    expect(refreshed.activationTokenHash).not.toBe(previousHash);
    expect(refreshed.activationTokenHash).toBe(hashToken(replacement.token));
  });

  it('resends for the same Manager, invalidates the prior token, and can replace an expired token', async () => {
    const admin = await createAdmin();
    const agent = await loggedIn(admin.user, admin.password);
    await createWedding(agent);
    expect((await inviteManager(agent)).status).toBe(201);
    const managerId = emailAdapter.messages.at(-1).managerId;
    const previousToken = emailAdapter.messages.at(-1).token;
    await User.updateOne({ _id: managerId }, { $set: { activationExpiresAt: new Date(Date.now() - 1000) } });

    const resent = await post(agent, '/api/v1/weddings/me/manager-invitation/resend');
    expect(resent.status).toBe(200);
    expect(resent.body.data.manager.id).toBe(managerId.toString());
    const replacementToken = emailAdapter.messages.at(-1).token;

    const invalid = await post(require('supertest').agent(app), '/api/v1/auth/manager-activation', {
      token: previousToken,
      password: 'ActivatedManager123',
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('TOKEN_INVALID');

    const manager = await User.findById(managerId).select('activationExpiresAt status');
    expect(manager.status).toBe('INVITED');
    expect(manager.activationExpiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(replacementToken).not.toBe(previousToken);
  });

  it('preserves a replacement activation token when resend email fails', async () => {
    const admin = await createAdmin();
    const agent = await loggedIn(admin.user, admin.password);
    await createWedding(agent);
    await inviteManager(agent);
    const managerId = emailAdapter.messages.at(-1).managerId;
    const oldHash = (await User.findById(managerId).select('activationTokenHash')).activationTokenHash;

    failManagerEmail = true;
    const response = await post(agent, '/api/v1/weddings/me/manager-invitation/resend');
    failManagerEmail = false;
    expect(response.status).toBe(502);
    const updated = await User.findById(managerId).select('activationTokenHash status activationExpiresAt');
    expect(updated.status).toBe('INVITED');
    expect(updated.activationTokenHash).not.toBe(oldHash);
    expect(updated.activationExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('activates a Manager once with a hashed password, clears token fields, and creates a session', async () => {
    const admin = await createAdmin();
    const adminAgent = await loggedIn(admin.user, admin.password);
    const wedding = await createWedding(adminAgent);
    await inviteManager(adminAgent);
    const message = emailAdapter.messages.at(-1);
    const managerAgent = require('supertest').agent(app);
    const previousCsrf = await managerAgent.get('/api/v1/auth/csrf');
    const response = await managerAgent.post('/api/v1/auth/manager-activation')
      .set('X-CSRF-Token', previousCsrf.body.data.csrfToken)
      .send({
      token: message.token,
      password: 'ActivatedManager123',
    });

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).not.toBe(previousCsrf.headers['set-cookie'][0]);
    expect(response.body.data.user).toMatchObject({ role: 'MANAGER', email: message.to });
    expect(JSON.stringify(response.body)).not.toContain(message.token);
    const manager = await User.findById(message.managerId)
      .select('passwordHash status activatedAt activationTokenHash activationExpiresAt');
    expect(manager.status).toBe('ACTIVE');
    expect(manager.activatedAt).toBeInstanceOf(Date);
    expect(manager.activationTokenHash).toBeUndefined();
    expect(manager.activationExpiresAt).toBeUndefined();
    expect(await require('bcrypt').compare('ActivatedManager123', manager.passwordHash)).toBe(true);
    expect((await managerAgent.get('/api/v1/auth/me')).status).toBe(200);
    expect((await managerAgent.get('/api/v1/weddings/me')).body.data.wedding.id)
      .toBe(wedding.body.data.wedding.id);
    expect((await post(adminAgent, '/api/v1/weddings/me/manager-invitation/resend')).status).toBe(409);

    const reused = await post(require('supertest').agent(app), '/api/v1/auth/manager-activation', {
      token: message.token,
      password: 'ActivatedManager123',
    });
    expect(reused.status).toBe(400);
  });

  it('rejects invalid, expired, and already active Manager activation attempts', async () => {
    const invalid = await post(require('supertest').agent(app), '/api/v1/auth/manager-activation', {
      token: randomBytes(32).toString('base64url'),
      password: 'ActivatedManager123',
    });
    expect(invalid.status).toBe(400);

    const admin = await createAdmin();
    const adminAgent = await loggedIn(admin.user, admin.password);
    await createWedding(adminAgent);
    await inviteManager(adminAgent);
    const message = emailAdapter.messages.at(-1);
    await User.updateOne({ _id: message.managerId }, { $set: { activationExpiresAt: new Date(Date.now() - 1000) } });
    const expired = await post(require('supertest').agent(app), '/api/v1/auth/manager-activation', {
      token: message.token,
      password: 'ActivatedManager123',
    });
    expect(expired.status).toBe(410);
    expect(expired.body.error.code).toBe('TOKEN_EXPIRED');

    const activeToken = randomBytes(32).toString('base64url');
    const active = await createManager();
    await User.updateOne({ _id: active.user._id }, {
      $set: {
        activationTokenHash: hashToken(activeToken),
        activationExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    const activeAttempt = await post(require('supertest').agent(app), '/api/v1/auth/manager-activation', {
      token: activeToken,
      password: 'ActivatedManager123',
    });
    expect(activeAttempt.status).toBe(400);
    expect((await User.findById(active.user._id)).status).toBe('ACTIVE');
  });

  it('applies configurable rate limits to invitations, resends, and activation', async () => {
    const admin = await createAdmin();
    const limitedApp = createApp({
      authService: authService({ mailer: emailAdapter }),
      weddingService: weddingService({ mailer: emailAdapter }),
      weddingRateLimitOverrides: { managerInvitation: 1, managerInvitationResend: 1 },
      authRateLimitOverrides: { managerActivation: 1 },
    });
    const agent = await loggedIn(admin.user, admin.password, limitedApp);
    await createWedding(agent);
    expect((await inviteManager(agent)).status).toBe(201);
    expect((await inviteManager(agent)).status).toBe(429);
    expect((await post(agent, '/api/v1/weddings/me/manager-invitation/resend')).status).toBe(200);
    expect((await post(agent, '/api/v1/weddings/me/manager-invitation/resend')).status).toBe(429);

    const activationAgent = require('supertest').agent(limitedApp);
    expect((await post(activationAgent, '/api/v1/auth/manager-activation', {
      token: 'invalid',
      password: 'ActivatedManager123',
    })).status).toBe(400);
    expect((await post(activationAgent, '/api/v1/auth/manager-activation', {
      token: 'invalid',
      password: 'ActivatedManager123',
    })).status).toBe(429);
  });

  it('does not log raw invitation tokens or SMTP configuration', async () => {
    const admin = await createAdmin();
    const agent = await loggedIn(admin.user, admin.password);
    await createWedding(agent);
    const spies = ['log', 'info', 'warn', 'error'].map((method) => (
      vi.spyOn(console, method).mockImplementation(() => {})
    ));
    let token;
    let logs;
    try {
      await inviteManager(agent);
      token = emailAdapter.messages.at(-1).token;
    } finally {
      logs = spies.flatMap((spy) => spy.mock.calls.flat());
      for (const spy of spies) spy.mockRestore();
    }
    expect(token).toBeTruthy();
    expect(JSON.stringify(logs)).not.toContain(token);
  });
});
