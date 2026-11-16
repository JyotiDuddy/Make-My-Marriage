const ApiError = require('../../shared/errors/api-error');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BCRYPT_PASSWORD_BYTES = 72;

function invalidRequest() {
  return new ApiError(400, 'VALIDATION_ERROR', 'The request body contains invalid data.');
}

function requireBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidRequest();
  }
}

function normalizeEmail(email) {
  if (typeof email !== 'string') throw invalidRequest();

  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !emailPattern.test(normalized)) throw invalidRequest();

  return normalized;
}

function requirePassword(password) {
  if (
    typeof password !== 'string'
    || password.length === 0
    || Buffer.byteLength(password, 'utf8') > MAX_BCRYPT_PASSWORD_BYTES
  ) {
    throw invalidRequest();
  }

  return password;
}

function validateRegistration(body) {
  requireBody(body);
  if (typeof body.name !== 'string' || body.name.trim().length === 0) throw invalidRequest();

  return {
    name: body.name.trim(),
    email: normalizeEmail(body.email),
    password: requirePassword(body.password),
  };
}

function validateLogin(body) {
  requireBody(body);

  return {
    email: normalizeEmail(body.email),
    password: requirePassword(body.password),
  };
}

function validateForgotPassword(body) {
  requireBody(body);
  return { email: normalizeEmail(body.email) };
}

function validateResetPassword(body) {
  requireBody(body);
  if (typeof body.token !== 'string' || body.token.length === 0 || body.token.length > 512) {
    throw invalidRequest();
  }

  return {
    token: body.token,
    newPassword: requirePassword(body.newPassword),
  };
}

function validateManagerActivation(body) {
  requireBody(body);
  if (typeof body.token !== 'string' || body.token.length === 0 || body.token.length > 512) {
    throw invalidRequest();
  }

  return {
    token: body.token,
    password: requirePassword(body.password),
  };
}

module.exports = {
  normalizeEmail,
  validateForgotPassword,
  validateLogin,
  validateManagerActivation,
  validateRegistration,
  validateResetPassword,
};
