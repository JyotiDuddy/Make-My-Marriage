const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const port = Number(process.env.PORT ?? 4000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const mongoUri = process.env.MONGO_DB_URI;
const mongoDbName = process.env.MONGO_DB_NAME;
const nodeEnv = process.env.NODE_ENV ?? 'development';
const sessionSecret = process.env.SESSION_SECRET;
const sessionCookieSameSite = (process.env.SESSION_COOKIE_SAME_SITE ?? 'lax').toLowerCase();
const frontendOrigin = process.env.FRONTEND_ORIGIN
  ?? (nodeEnv === 'development' ? 'http://localhost:5173' : undefined);
const trustProxyValue = process.env.TRUST_PROXY;

function positiveInteger(name, defaultValue, minimum = 1) {
  const value = Number(process.env[name] ?? defaultValue);

  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}.`);
  }

  return value;
}

if (!mongoUri || !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) {
  throw new Error('MONGO_DB_URI must be a MongoDB connection URI.');
}

if (!mongoDbName) {
  throw new Error('MONGO_DB_NAME is required.');
}

if (
  !sessionSecret
  || Buffer.byteLength(sessionSecret) < 32
  || sessionSecret.toLowerCase().startsWith('replace-with-')
) {
  throw new Error('SESSION_SECRET must contain at least 32 bytes.');
}

if (!['lax', 'strict', 'none'].includes(sessionCookieSameSite)) {
  throw new Error('SESSION_COOKIE_SAME_SITE must be lax, strict, or none.');
}

if (sessionCookieSameSite === 'none' && nodeEnv !== 'production') {
  throw new Error('SESSION_COOKIE_SAME_SITE=none requires production HTTPS.');
}

if (nodeEnv === 'production' && !frontendOrigin) {
  throw new Error('FRONTEND_ORIGIN is required in production.');
}

if (frontendOrigin) {
  let configuredOrigin;
  try {
    configuredOrigin = new URL(frontendOrigin);
  } catch {
    throw new Error('FRONTEND_ORIGIN must be a valid origin URL.');
  }

  if (configuredOrigin.origin !== frontendOrigin || configuredOrigin.origin === '*') {
    throw new Error('FRONTEND_ORIGIN must be one exact origin without a path or wildcard.');
  }

  if (nodeEnv === 'production' && configuredOrigin.protocol !== 'https:') {
    throw new Error('FRONTEND_ORIGIN must use HTTPS in production.');
  }
}

const bcryptSaltRounds = positiveInteger('BCRYPT_SALT_ROUNDS', 12, 10);
if (bcryptSaltRounds > 15) {
  throw new Error('BCRYPT_SALT_ROUNDS must not exceed 15.');
}

const authRateLimitWindowMs = positiveInteger('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
const sessionMaxAgeMs = positiveInteger('SESSION_MAX_AGE_MS', 7 * 24 * 60 * 60 * 1000);
const passwordResetTokenTtlMs = positiveInteger('PASSWORD_RESET_TOKEN_TTL_MS', 60 * 60 * 1000);
const trustProxy = trustProxyValue === undefined
  ? (nodeEnv === 'production' ? false : 0)
  : Number(trustProxyValue);

if (trustProxy !== false && (!Number.isSafeInteger(trustProxy) || trustProxy < 0)) {
  throw new Error('TRUST_PROXY must be a non-negative proxy hop count.');
}

module.exports = {
  nodeEnv,
  port,
  mongoUri,
  mongoDbName,
  sessionSecret,
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? 'mmm.sid',
  sessionCookieSameSite,
  sessionMaxAgeMs,
  sessionCollectionName: process.env.SESSION_COLLECTION_NAME ?? 'sessions',
  frontendOrigin,
  trustProxy,
  bcryptSaltRounds,
  passwordResetTokenTtlMs,
  authRateLimitWindowMs,
  authRateLimits: {
    register: positiveInteger('AUTH_REGISTER_RATE_LIMIT_MAX', 5),
    login: positiveInteger('AUTH_LOGIN_RATE_LIMIT_MAX', 10),
    forgotPassword: positiveInteger('AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX', 5),
    resetPassword: positiveInteger('AUTH_RESET_PASSWORD_RATE_LIMIT_MAX', 10),
  },
};
