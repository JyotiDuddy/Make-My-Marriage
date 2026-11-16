import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const testDatabaseName = `mmm_m3_auth_${runId}`;

let mongoose;
let User;
let Wedding;
let app;
let createApp;
let connectDB;
let authService;
let emailAdapter;
let hashResetToken;
let sessionOptions;
let testDatabaseCreated = false;
let serverConfig;

function uniqueEmail() {
  return `m3-${randomUUID().replaceAll('-', '').slice(0, 18)}@example.test`;
}

async function createActiveUser(overrides = {}) {
  const password = overrides.password ?? 'TestPassword123';
  const user = await User.create({
    name: overrides.name ?? 'M3 Test Admin',
    email: overrides.email ?? uniqueEmail(),
    passwordHash: await require('bcrypt').hash(password, serverConfig.bcryptSaltRounds),
    role: overrides.role ?? 'ADMIN',
    status: overrides.status ?? 'ACTIVE',
    ...(overrides.status === 'DISABLED' ? { activatedAt: new Date() } : {}),
  });
  return { user, password };
}

async function csrfToken(agent = require('supertest').agent(app)) {
  const response = await agent.get('/api/v1/auth/csrf');
  expect(response.status).toBe(200);
  expect(response.body.data.csrfToken).toEqual(expect.any(String));
  return { agent, token: response.body.data.csrfToken, response };
}

async function authenticatedAgent(user, password) {
  const agent = require('supertest').agent(app);
  const { token } = await csrfToken(agent);
  const response = await agent
    .post('/api/v1/auth/login')
    .set('X-CSRF-Token', token)
    .send({ email: user.email, password });
  expect(response.status).toBe(200);
  return agent;
}

async function postWithCsrf(agent, url, body, token) {
  const csrf = token ?? (await csrfToken(agent)).token;
  return agent.post(url).set('X-CSRF-Token', csrf).send(body);
}

async function register(agent, body) {
  return postWithCsrf(agent, '/api/v1/auth/register', body);
}

async function issueReset(email, agent = require('supertest').agent(app)) {
  const response = await postWithCsrf(agent, '/api/v1/auth/forgot-password', { email });
  expect(response.status).toBe(200);
  return response;
}

describe('M3 authentication, sessions, CSRF, reset, and rate limits', () => {
  beforeAll(async () => {
    let probeConnection;

    try {
      const dotenv = require('dotenv');
      const localConfig = dotenv.parse(readFileSync(path.join(serverDirectory, '.env')));
      const uri = localConfig.MONGO_DB_URI;
      const applicationDatabaseName = localConfig.MONGO_DB_NAME;
      const uriHost = uri ? new URL(uri).hostname : '';

      if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
        throw new Error('The local development MongoDB configuration is missing or invalid.');
      }
      if (localConfig.NODE_ENV !== 'development') {
        throw new Error('Auth integration tests require a connection explicitly configured for development.');
      }
      if (!applicationDatabaseName || /prod(uction)?|live/i.test(applicationDatabaseName)) {
        throw new Error('Refusing to run integration tests with a production-like database name.');
      }
      if (testDatabaseName === applicationDatabaseName) {
        throw new Error('The generated test database must differ from the application database.');
      }

      process.env.NODE_ENV = 'test';
      process.env.MONGO_DB_NAME = testDatabaseName;
      process.env.SESSION_SECRET = randomBytes(64).toString('hex');
      process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
      process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';
      process.env.AUTH_REGISTER_RATE_LIMIT_MAX = '30';
      process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '30';
      process.env.AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX = '30';
      process.env.AUTH_RESET_PASSWORD_RATE_LIMIT_MAX = '30';

      mongoose = require('mongoose');
      probeConnection = await mongoose.createConnection(uri, {
        dbName: 'admin',
        serverSelectionTimeoutMS: 15000,
      }).asPromise();
      const { databases } = await probeConnection.getClient().db('admin').admin()
        .listDatabases({ nameOnly: true });
      if (databases.some(({ name }) => name === testDatabaseName)) {
        throw new Error('The generated test database already exists; refusing to modify it.');
      }
      await probeConnection.close();
      probeConnection = undefined;

      const configPath = path.join(serverDirectory, 'src/config/env.js');
      serverConfig = require(configPath);
      User = require(path.join(serverDirectory, 'src/modules/auth/user.model.js'));
      Wedding = require(path.join(serverDirectory, 'src/modules/wedding/wedding.model.js'));
      connectDB = require(path.join(serverDirectory, 'src/config/database.js'));
      const serviceModule = require(path.join(serverDirectory, 'src/modules/auth/auth.service.js'));
      authService = serviceModule.createAuthService;
      hashResetToken = serviceModule.hashResetToken;
      sessionOptions = require(path.join(serverDirectory, 'src/config/session.js')).getCookieOptions;

      emailAdapter = {
        isConfigured: true,
        messages: [],
        async sendPasswordResetEmail(message) {
          this.messages.push(message);
        },
      };

      const injectedService = authService({ mailer: emailAdapter });
      const appModule = require(path.join(serverDirectory, 'src/app.js'));
      createApp = appModule.createApp;
      app = createApp({ service: injectedService });

      await connectDB();
      if (mongoose.connection.name !== testDatabaseName) {
        throw new Error('The application test connection did not select the isolated test database.');
      }
      testDatabaseCreated = true;
      await Promise.all([User.createIndexes(), Wedding.createIndexes()]);
      process.stdout.write(`Auth integration test connected to isolated ${uriHost ? 'configured' : 'test'} MongoDB.\n`);
    } catch (error) {
      if (probeConnection) await probeConnection.close().catch(() => {});
      if (mongoose?.connection?.readyState === 1) {
        if (testDatabaseCreated && mongoose.connection.name === testDatabaseName) {
          await mongoose.connection.dropDatabase().catch(() => {});
          testDatabaseCreated = false;
        }
        await mongoose.disconnect().catch(() => {});
      }
      // Intentionally omit `cause`: MongoDB driver errors may contain connection details.
      // eslint-disable-next-line preserve-caught-error
      throw new Error(`Could not safely prepare M3 integration tests (${error?.code ?? error?.name ?? 'setup failure'}).`);
    }
  }, 45000);

  afterAll(async () => {
    if (!mongoose?.connection || mongoose.connection.readyState !== 1) return;

    try {
      if (testDatabaseCreated && mongoose.connection.name === testDatabaseName) {
        await mongoose.connection.dropDatabase();
        testDatabaseCreated = false;
        process.stdout.write('Dropped the isolated M3 authentication test database.\n');
      }
    } finally {
      await mongoose.disconnect();
    }
  }, 30000);

  it('issues a session-bound CSRF token and restricts credentialed CORS to the configured origin', async () => {
    const request = require('supertest');
    const tokenResponse = await request(app)
      .get('/api/v1/auth/csrf')
      .set('Origin', 'http://localhost:5173');

    expect(tokenResponse.status).toBe(200);
    expect(tokenResponse.body.data.csrfToken).toEqual(expect.any(String));
    expect(tokenResponse.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(tokenResponse.headers['access-control-allow-credentials']).toBe('true');
    expect(tokenResponse.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(tokenResponse.headers['set-cookie'][0]).toContain('SameSite=Lax');

    const denied = await request(app)
      .get('/api/v1/auth/csrf')
      .set('Origin', 'https://attacker.example');
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
  });

  it('validates registration input, normalizes email, ignores client role, hashes passwords, and regenerates sessions', async () => {
    const request = require('supertest');
    const agent = request.agent(app);
    const { token, response: csrfResponse } = await csrfToken(agent);
    const invalid = await agent
      .post('/api/v1/auth/register')
      .set('X-CSRF-Token', token)
      .send({ name: ' ', email: 'not-an-email', password: '' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const email = uniqueEmail();
    const response = await agent
      .post('/api/v1/auth/register')
      .set('X-CSRF-Token', token)
      .send({
        name: 'M3 Admin',
        email: ` ${email.toUpperCase()} `,
        password: 'TestPassword123',
        role: 'MANAGER',
        status: 'INVITED',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Account registered successfully',
      data: {
        user: { name: 'M3 Admin', email, role: 'ADMIN' },
        onboardingRequired: true,
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|passwordResetTokenHash|activationTokenHash|sessionId/i);
    expect(response.headers['set-cookie'][0]).not.toBe(csrfResponse.headers['set-cookie'][0]);

    const user = await User.findOne({ email }).select('+passwordHash');
    expect(user.role).toBe('ADMIN');
    expect(user.status).toBe('ACTIVE');
    expect(user.passwordHash).not.toBe('TestPassword123');
    expect(await require('bcrypt').compare('TestPassword123', user.passwordHash)).toBe(true);
    expect(user.toObject()).not.toHaveProperty('passwordResetTokenHash');
  });

  it('rejects a normalized duplicate email with the documented conflict code', async () => {
    const email = uniqueEmail();
    const first = require('supertest').agent(app);
    expect((await register(first, { name: 'First Admin', email, password: 'TestPassword123' })).status).toBe(201);

    const second = require('supertest').agent(app);
    const duplicate = await register(second, { name: 'Second Admin', email: ` ${email.toUpperCase()} `, password: 'TestPassword123' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('allows active login, rejects bad credentials and inactive users generically, and keeps profile fields private', async () => {
    const { user, password } = await createActiveUser();
    const agent = require('supertest').agent(app);
    const { token, response: beforeLogin } = await csrfToken(agent);
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', token)
      .send({ email: user.email.toUpperCase(), password, role: 'GUEST' });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.user).toMatchObject({ id: user.id, email: user.email, role: 'ADMIN' });
    expect(loginResponse.headers['set-cookie'][0]).not.toBe(beforeLogin.headers['set-cookie'][0]);
    expect(JSON.stringify(loginResponse.body)).not.toMatch(/passwordHash|sessionId/i);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user).toMatchObject({ id: user.id, email: user.email, role: 'ADMIN' });
    expect(Object.keys(me.body.data.user).sort()).toEqual(['email', 'id', 'name', 'role']);

    const noSession = await require('supertest').agent(app).get('/api/v1/auth/me');
    expect(noSession.status).toBe(401);
    expect(noSession.body.error.code).toBe('UNAUTHORIZED');

    const wrongPassword = await postWithCsrf(require('supertest').agent(app), '/api/v1/auth/login', {
      email: user.email,
      password: 'incorrect-password',
    });
    const missingAccount = await postWithCsrf(require('supertest').agent(app), '/api/v1/auth/login', {
      email: uniqueEmail(),
      password: 'incorrect-password',
    });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toEqual(missingAccount.body);

    const invited = await User.create({ name: 'Invited Manager', email: uniqueEmail(), role: 'MANAGER', status: 'INVITED' });
    const disabled = await User.create({
      name: 'Disabled Manager',
      email: uniqueEmail(),
      passwordHash: await require('bcrypt').hash(password, serverConfig.bcryptSaltRounds),
      role: 'MANAGER',
      status: 'DISABLED',
    });

    for (const blockedUser of [invited, disabled]) {
      const result = await postWithCsrf(require('supertest').agent(app), '/api/v1/auth/login', {
        email: blockedUser.email,
        password,
      });
      expect(result.status).toBe(401);
      expect(result.body).toEqual(wrongPassword.body);
    }
  });

  it('includes weddingId in the authenticated Admin profile when a Wedding exists', async () => {
    const { user, password } = await createActiveUser();
    const wedding = await Wedding.create({
      adminId: user._id,
      title: 'M3 Test Wedding',
      partnerOneName: 'A',
      partnerTwoName: 'B',
      weddingDate: '2027-04-12',
      timeZone: 'Asia/Kolkata',
      slug: `m3-${randomUUID().replaceAll('-', '').slice(0, 12)}`,
    });
    const agent = await authenticatedAgent(user, password);
    const response = await agent.get('/api/v1/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.data.user.weddingId).toBe(wedding.id);
  });

  it('requires valid CSRF on cookie-backed mutations, including after the session rotates', async () => {
    const request = require('supertest');
    const missing = await request(app).post('/api/v1/auth/register').send({
      name: 'No CSRF',
      email: uniqueEmail(),
      password: 'TestPassword123',
    });
    expect(missing.status).toBe(403);

    const agent = request.agent(app);
    const { token } = await csrfToken(agent);
    const invalid = await agent
      .post('/api/v1/auth/register')
      .set('X-CSRF-Token', 'not-a-valid-token')
      .send({ name: 'Invalid CSRF', email: uniqueEmail(), password: 'TestPassword123' });
    expect(invalid.status).toBe(403);

    const email = uniqueEmail();
    const registered = await agent
      .post('/api/v1/auth/register')
      .set('X-CSRF-Token', token)
      .send({ name: 'Rotated Session', email, password: 'TestPassword123' });
    expect(registered.status).toBe(201);

    const stale = await agent
      .post('/api/v1/auth/logout')
      .set('X-CSRF-Token', token);
    expect(stale.status).toBe(403);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
  });

  it('destroys the current server session on logout and clears the cookie', async () => {
    const { user, password } = await createActiveUser();
    const agent = await authenticatedAgent(user, password);
    const { token } = await csrfToken(agent);
    const logout = await agent.post('/api/v1/auth/logout').set('X-CSRF-Token', token);

    expect(logout.status).toBe(204);
    expect(logout.text).toBe('');
    expect(logout.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('uses HttpOnly development cookies and secure production cookie options', () => {
    expect(sessionOptions('test')).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    expect(sessionOptions('production').secure).toBe(true);
  });

  it('returns the same forgot-password response and sends a raw token only through the injected adapter', async () => {
    const { user } = await createActiveUser();
    const beforeCount = emailAdapter.messages.length;
    const logSpies = ['log', 'info', 'warn', 'error'].map((method) => (
      vi.spyOn(console, method).mockImplementation(() => {})
    ));

    let known;
    let unknown;
    const logs = [];
    try {
      known = await issueReset(user.email);
      unknown = await issueReset(uniqueEmail());
    } finally {
      logs.push(...logSpies.flatMap((spy) => spy.mock.calls.flat()));
      for (const spy of logSpies) spy.mockRestore();
    }

    expect(known.body).toEqual(unknown.body);
    expect(known.body.message).toBe('If an account exists, reset instructions will be sent when email delivery is available.');
    expect(JSON.stringify(known.body)).not.toMatch(/token|passwordReset/i);
    expect(emailAdapter.messages).toHaveLength(beforeCount + 1);

    const sent = emailAdapter.messages.at(-1);
    expect(JSON.stringify(logs)).not.toContain(sent.token);
    expect(sent.to).toBe(user.email);
    expect(sent.token).toEqual(expect.any(String));
    const stored = await User.findById(user._id).select('passwordResetTokenHash passwordResetExpiresAt');
    expect(stored.passwordResetTokenHash).toBe(hashResetToken(sent.token));
    expect(stored.passwordResetTokenHash).not.toBe(sent.token);
    expect(stored.passwordResetExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('does not persist a reset token or claim delivery when no email provider is configured', async () => {
    const { user } = await createActiveUser();
    const defaultService = require(path.join(serverDirectory, 'src/modules/auth/auth.service.js'));
    const result = await defaultService.forgotPassword({ email: user.email });
    const refreshed = await User.findById(user._id).select('+passwordResetTokenHash');

    expect(result.message).toBe('If an account exists, reset instructions will be sent when email delivery is available.');
    expect(refreshed.passwordResetTokenHash).toBeUndefined();
  });

  it('resets passwords once, clears token fields, and invalidates only that user’s sessions', async () => {
    const target = await createActiveUser();
    const other = await createActiveUser();
    const targetSessionOne = await authenticatedAgent(target.user, target.password);
    const targetSessionTwo = await authenticatedAgent(target.user, target.password);
    const otherSession = await authenticatedAgent(other.user, other.password);
    await issueReset(target.user.email);
    const rawToken = emailAdapter.messages.at(-1).token;

    const resetAgent = require('supertest').agent(app);
    const { token: csrf } = await csrfToken(resetAgent);
    const response = await resetAgent
      .post('/api/v1/auth/reset-password')
      .set('X-CSRF-Token', csrf)
      .send({ token: rawToken, newPassword: 'NewTestPassword123' });

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain(rawToken);
    expect((await targetSessionOne.get('/api/v1/auth/me')).status).toBe(401);
    expect((await targetSessionTwo.get('/api/v1/auth/me')).status).toBe(401);
    expect((await otherSession.get('/api/v1/auth/me')).status).toBe(200);

    const refreshed = await User.findById(target.user._id).select('passwordHash passwordResetTokenHash passwordResetExpiresAt');
    expect(refreshed.passwordResetTokenHash).toBeUndefined();
    expect(refreshed.passwordResetExpiresAt).toBeUndefined();
    expect(await require('bcrypt').compare(target.password, refreshed.passwordHash)).toBe(false);
    expect(await require('bcrypt').compare('NewTestPassword123', refreshed.passwordHash)).toBe(true);

    const reuse = await postWithCsrf(require('supertest').agent(app), '/api/v1/auth/reset-password', {
      token: rawToken,
      newPassword: 'AnotherTestPassword123',
    });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('TOKEN_INVALID');
  }, 60000);

  it('rejects invalid and expired reset tokens without changing the password', async () => {
    const { user, password } = await createActiveUser();
    const invalid = await postWithCsrf(require('supertest').agent(app), '/api/v1/auth/reset-password', {
      token: randomBytes(32).toString('base64url'),
      newPassword: 'NewTestPassword123',
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('TOKEN_INVALID');

    const expiredToken = randomBytes(32).toString('base64url');
    await User.updateOne({ _id: user._id }, {
      $set: {
        passwordResetTokenHash: hashResetToken(expiredToken),
        passwordResetExpiresAt: new Date(Date.now() - 1000),
      },
    });
    const expired = await postWithCsrf(require('supertest').agent(app), '/api/v1/auth/reset-password', {
      token: expiredToken,
      newPassword: 'NewTestPassword123',
    });
    expect(expired.status).toBe(410);
    expect(expired.body.error.code).toBe('TOKEN_EXPIRED');
    expect(await require('bcrypt').compare(password, (await User.findById(user._id).select('+passwordHash')).passwordHash)).toBe(true);
  });

  it('applies configured rate limits to registration, login, forgot password, and reset password', async () => {
    const limitedApp = createApp({
      service: authService({ mailer: emailAdapter }),
      rateLimitOverrides: { register: 1, login: 1, forgotPassword: 1, resetPassword: 1 },
    });
    const routes = [
      ['/api/v1/auth/register', { name: ' ', email: 'invalid', password: '' }, 400],
      ['/api/v1/auth/login', { email: uniqueEmail(), password: 'TestPassword123' }, 401],
      ['/api/v1/auth/forgot-password', { email: uniqueEmail() }, 200],
      ['/api/v1/auth/reset-password', { token: 'not-a-real-token', newPassword: 'NewTestPassword123' }, 400],
    ];

    for (const [route, body, firstStatus] of routes) {
      const agent = require('supertest').agent(limitedApp);
      const { token } = await csrfToken(agent);
      const first = await agent.post(route).set('X-CSRF-Token', token).send(body);
      expect(first.status).toBe(firstStatus);
      const second = await agent.post(route).set('X-CSRF-Token', token).send(body);
      expect(second.status).toBe(429);
      expect(second.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    }
  });
});
