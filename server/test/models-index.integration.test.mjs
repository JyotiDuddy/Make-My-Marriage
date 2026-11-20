import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('../src/modules/auth/user.model.js');
const Wedding = require('../src/modules/wedding/wedding.model.js');

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const testDatabaseName = `make_my_marriage_m2_test_${runId}`;

let connection;
let TestUser;
let TestWedding;
let testDatabaseCreated = false;

function safeError(message, error) {
  const code = error?.code ?? error?.name;
  return new Error(code ? `${message} (${code}).` : `${message}.`);
}

function userDocument(overrides = {}) {
  const id = randomUUID().replaceAll('-', '').slice(0, 16);

  return {
    _id: new mongoose.Types.ObjectId(),
    name: `M2 Test ${id}`,
    email: `m2-${id}@example.test`,
    passwordHash: 'test-only-hash',
    role: 'ADMIN',
    status: 'ACTIVE',
    ...overrides,
  };
}

function weddingDocument(overrides = {}) {
  const id = randomUUID().replaceAll('-', '').slice(0, 16);

  return {
    _id: new mongoose.Types.ObjectId(),
    adminId: new mongoose.Types.ObjectId(),
    title: `M2 Test Wedding ${id}`,
    partnerOneName: 'Test Partner One',
    partnerTwoName: 'Test Partner Two',
    weddingDate: '2027-02-15',
    timeZone: 'Asia/Kolkata',
    slug: `m2-test-${id}`,
    websitePublished: false,
    ...overrides,
  };
}

function findIndex(indexes, expectedKey) {
  return indexes.find((index) => JSON.stringify(index.key) === JSON.stringify(expectedKey));
}

async function expectMongoDuplicate(collection, document) {
  try {
    await collection.insertOne(document);
  } catch (error) {
    expect(error.code).toBe(11000);
    expect(error.name).not.toBe('ValidationError');
    return;
  }

  throw new Error('Expected MongoDB to reject a duplicate index key.');
}

describe('M2 MongoDB index enforcement', () => {
  beforeAll(async () => {
    try {
      const uriOverride = process.env.M2_TEST_MONGO_URI;
      const localConfig = uriOverride
        ? {}
        : dotenv.parse(readFileSync(path.join(serverDirectory, '.env')));
      const uri = uriOverride ?? localConfig.MONGO_DB_URI;
      const applicationDatabaseName = uriOverride ? 'm2-test-override' : localConfig.MONGO_DB_NAME;
      const uriHost = uri ? new URL(uri).hostname : '';

      if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
        throw new Error('The local MongoDB connection configuration is missing or invalid.');
      }
      if (!['localhost', '127.0.0.1', '::1'].includes(uriHost)) {
        throw new Error('M2 integration tests require a loopback MongoDB URI.');
      }

      if (!applicationDatabaseName || testDatabaseName === applicationDatabaseName) {
        throw new Error('The isolated test database does not differ from the configured application database.');
      }

      connection = await mongoose.createConnection(uri, {
        dbName: testDatabaseName,
        serverSelectionTimeoutMS: 15000,
      }).asPromise();

      if (connection.name !== testDatabaseName || connection.db.databaseName !== testDatabaseName) {
        throw new Error('MongoDB did not select the explicit isolated test database.');
      }

      const { databases } = await connection.getClient()
        .db('admin')
        .admin()
        .listDatabases({ nameOnly: true });

      if (databases.some(({ name }) => name === testDatabaseName)) {
        throw new Error('The generated test database already exists; refusing to modify it.');
      }

      TestUser = connection.model('User', User.schema);
      TestWedding = connection.model('Wedding', Wedding.schema);
      testDatabaseCreated = true;

      await Promise.all([TestUser.createIndexes(), TestWedding.createIndexes()]);
    } catch (error) {
      if (testDatabaseCreated && connection) {
        await connection.dropDatabase().catch(() => {});
        testDatabaseCreated = false;
      }

      if (connection) {
        await connection.close().catch(() => {});
        connection = undefined;
      }

      throw safeError('Could not safely prepare the isolated MongoDB index test', error);
    }
  }, 30000);

  afterAll(async () => {
    if (!connection) return;

    try {
      if (testDatabaseCreated) {
        await connection.dropDatabase();
        testDatabaseCreated = false;
        console.info(`Dropped isolated test database ${testDatabaseName}.`);
      }
    } catch (error) {
      throw safeError('Could not clean up the isolated MongoDB test database', error);
    } finally {
      await connection.close();
      connection = undefined;
    }
  }, 30000);

  it('creates the six approved indexes with their actual MongoDB options', async () => {
    const userIndexes = await TestUser.collection.listIndexes().toArray();
    const weddingIndexes = await TestWedding.collection.listIndexes().toArray();

    const emailIndex = findIndex(userIndexes, { email: 1 });
    const activationIndex = findIndex(userIndexes, { activationTokenHash: 1 });
    const resetIndex = findIndex(userIndexes, { passwordResetTokenHash: 1 });
    const adminIndex = findIndex(weddingIndexes, { adminId: 1 });
    const managerIndex = findIndex(weddingIndexes, { managerId: 1 });
    const slugIndex = findIndex(weddingIndexes, { slug: 1 });

    expect(emailIndex?.unique).toBe(true);
    expect(activationIndex?.unique).toBe(true);
    expect(activationIndex?.partialFilterExpression).toEqual({ activationTokenHash: { $type: 'string' } });
    expect(resetIndex?.unique).toBe(true);
    expect(resetIndex?.partialFilterExpression).toEqual({ passwordResetTokenHash: { $type: 'string' } });
    expect(adminIndex?.unique).toBe(true);
    expect(managerIndex).toBeDefined();
    expect(managerIndex?.unique).not.toBe(true);
    expect(slugIndex?.unique).toBe(true);

    const verifiedIndexes = [emailIndex, activationIndex, resetIndex, adminIndex, managerIndex, slugIndex]
      .map(({ name, key, unique, partialFilterExpression }) => ({
        name,
        key,
        unique: unique ?? false,
        ...(partialFilterExpression ? { partialFilterExpression } : {}),
      }));

    expect(verifiedIndexes).toHaveLength(6);
    console.info(`MongoDB created the six approved indexes: ${JSON.stringify(verifiedIndexes)}`);
  });

  it('rejects duplicate User email values with a MongoDB duplicate-key error', async () => {
    const first = userDocument();
    await TestUser.collection.insertOne(first);

    await expectMongoDuplicate(TestUser.collection, userDocument({ email: first.email }));
  });

  it('allows multiple missing and explicit null token fields under the partial indexes', async () => {
    await TestUser.collection.insertOne(userDocument());
    await TestUser.collection.insertOne(userDocument());

    await TestUser.collection.insertOne(userDocument({
      activationTokenHash: null,
      passwordResetTokenHash: null,
    }));
    await TestUser.collection.insertOne(userDocument({
      activationTokenHash: null,
      passwordResetTokenHash: null,
    }));
  });

  it('rejects duplicate non-null activation and password-reset token hashes', async () => {
    const activationTokenHash = `activation-${runId}`;
    await TestUser.collection.insertOne(userDocument({ activationTokenHash }));
    await expectMongoDuplicate(
      TestUser.collection,
      userDocument({ activationTokenHash }),
    );

    const passwordResetTokenHash = `reset-${runId}`;
    await TestUser.collection.insertOne(userDocument({ passwordResetTokenHash }));
    await expectMongoDuplicate(
      TestUser.collection,
      userDocument({ passwordResetTokenHash }),
    );
  });

  it('rejects duplicate Wedding adminId values with a MongoDB duplicate-key error', async () => {
    const adminId = new mongoose.Types.ObjectId();
    await TestWedding.collection.insertOne(weddingDocument({ adminId }));

    await expectMongoDuplicate(TestWedding.collection, weddingDocument({ adminId }));
  });

  it('rejects duplicate Wedding slugs with a MongoDB duplicate-key error', async () => {
    const slug = `m2-duplicate-${runId}`;
    await TestWedding.collection.insertOne(weddingDocument({ slug }));

    await expectMongoDuplicate(TestWedding.collection, weddingDocument({ slug }));
  });

  it('allows two Wedding records to reference the same Manager User', async () => {
    const manager = userDocument({
      role: 'MANAGER',
      status: 'ACTIVE',
    });
    await TestUser.collection.insertOne(manager);

    const first = weddingDocument({ managerId: manager._id });
    const second = weddingDocument({ managerId: manager._id });
    await TestWedding.collection.insertOne(first);
    await TestWedding.collection.insertOne(second);

    const sharedManagerWeddings = await TestWedding.collection.countDocuments({ managerId: manager._id });
    expect(sharedManagerWeddings).toBe(2);
  });
});
