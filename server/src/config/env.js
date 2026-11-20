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
const publicRsvpRateLimitWindowMs = positiveInteger('PUBLIC_RSVP_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
const publicPhotoRateLimitWindowMs = positiveInteger('PUBLIC_PHOTO_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
const sessionMaxAgeMs = positiveInteger('SESSION_MAX_AGE_MS', 7 * 24 * 60 * 60 * 1000);
const passwordResetTokenTtlMs = positiveInteger('PASSWORD_RESET_TOKEN_TTL_MS', 60 * 60 * 1000);
const managerActivationTokenTtlMs = positiveInteger('MANAGER_ACTIVATION_TOKEN_TTL_MS', 24 * 60 * 60 * 1000);
const trustProxy = trustProxyValue === undefined
  ? (nodeEnv === 'production' ? false : 0)
  : Number(trustProxyValue);

if (trustProxy !== false && (!Number.isSafeInteger(trustProxy) || trustProxy < 0)) {
  throw new Error('TRUST_PROXY must be a non-negative proxy hop count.');
}

const smtpEnvNames = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];
const configuredSmtpValues = smtpEnvNames.map((name) => process.env[name]?.trim() ?? '');
const hasAnySmtpValue = configuredSmtpValues.some(Boolean);
let smtp;

if (hasAnySmtpValue) {
  if (configuredSmtpValues.some((value) => !value)) {
    throw new Error('SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM must all be configured together.');
  }

  const smtpPort = Number(process.env.SMTP_PORT);
  const smtpSecureValue = process.env.SMTP_SECURE.toLowerCase();
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535.');
  }
  if (!['true', 'false'].includes(smtpSecureValue)) {
    throw new Error('SMTP_SECURE must be true or false.');
  }

  smtp = {
    host: process.env.SMTP_HOST.trim(),
    port: smtpPort,
    secure: smtpSecureValue === 'true',
    auth: {
      user: process.env.SMTP_USER.trim(),
      pass: process.env.SMTP_PASSWORD,
    },
    from: process.env.SMTP_FROM.trim(),
  };
}

const cloudinaryEnvNames = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const configuredCloudinaryValues = cloudinaryEnvNames.map((name) => process.env[name]?.trim() ?? '');
const hasAnyCloudinaryValue = configuredCloudinaryValues.some(Boolean);
let cloudinary;

if (hasAnyCloudinaryValue) {
  if (configuredCloudinaryValues.some((value) => !value)) {
    throw new Error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must all be configured together.');
  }

  cloudinary = {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    apiKey: process.env.CLOUDINARY_API_KEY.trim(),
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  };
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
  managerActivationTokenTtlMs,
  authRateLimitWindowMs,
  publicRsvpRateLimitWindowMs,
  authRateLimits: {
    register: positiveInteger('AUTH_REGISTER_RATE_LIMIT_MAX', 5),
    login: positiveInteger('AUTH_LOGIN_RATE_LIMIT_MAX', 10),
    forgotPassword: positiveInteger('AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX', 5),
    resetPassword: positiveInteger('AUTH_RESET_PASSWORD_RATE_LIMIT_MAX', 10),
    managerInvitation: positiveInteger('AUTH_MANAGER_INVITATION_RATE_LIMIT_MAX', 5),
    managerInvitationResend: positiveInteger('AUTH_MANAGER_INVITATION_RESEND_RATE_LIMIT_MAX', 5),
    managerActivation: positiveInteger('AUTH_MANAGER_ACTIVATION_RATE_LIMIT_MAX', 10),
  },
  publicRsvpRateLimits: {
    get: positiveInteger('PUBLIC_RSVP_GET_RATE_LIMIT_MAX', 20),
    put: positiveInteger('PUBLIC_RSVP_PUT_RATE_LIMIT_MAX', 20),
  },
  publicPhotoRateLimitWindowMs,
  publicPhotoRateLimits: {
    upload: positiveInteger('PUBLIC_PHOTO_UPLOAD_RATE_LIMIT_MAX', 5),
  },
  smtp,
  cloudinary,
};
