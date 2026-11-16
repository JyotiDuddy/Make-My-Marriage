const mongoose = require('mongoose');
const { MongoStore } = require('connect-mongo');
const session = require('express-session');
const config = require('./env');

function getCookieOptions(nodeEnv = config.nodeEnv) {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: config.sessionCookieSameSite,
    path: '/',
    maxAge: config.sessionMaxAgeMs,
  };
}

function createMongoClientPromise() {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection.getClient());
  }

  return new Promise((resolve, reject) => {
    const onOpen = () => {
      mongoose.connection.off('error', onError);
      resolve(mongoose.connection.getClient());
    };
    const onError = (error) => {
      mongoose.connection.off('open', onOpen);
      reject(error);
    };

    mongoose.connection.once('open', onOpen);
    mongoose.connection.once('error', onError);
  });
}

const sessionStore = MongoStore.create({
  clientPromise: createMongoClientPromise(),
  dbName: config.mongoDbName,
  collectionName: config.sessionCollectionName,
  ttl: Math.floor(config.sessionMaxAgeMs / 1000),
  autoRemove: 'native',
  stringify: false,
});

const sessionMiddleware = session({
  name: config.sessionCookieName,
  secret: config.sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: false,
  cookie: getCookieOptions(),
});

async function invalidateUserSessions(userId, databaseSession) {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw new Error('MongoDB must be connected before invalidating sessions.');
  }

  return mongoose.connection.db
    .collection(config.sessionCollectionName)
    .deleteMany(
      { 'session.userId': String(userId) },
      databaseSession ? { session: databaseSession } : {},
    );
}

module.exports = {
  getCookieOptions,
  invalidateUserSessions,
  sessionMiddleware,
  sessionStore,
};
