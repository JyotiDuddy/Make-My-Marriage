const ApiError = require('../../shared/errors/api-error');
const { normalizeEmail } = require('../auth/auth.validation');

const editableFields = new Set([
  'title',
  'partnerOneName',
  'partnerTwoName',
  'weddingDate',
  'timeZone',
  'introduction',
  'slug',
]);

function invalidRequest(message = 'The request body contains invalid data.') {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

function requireObjectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidRequest();
  }
}

function nonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalidRequest(`${field} is required and must be a non-empty string.`);
  }
  return value.trim();
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validTimeZone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function validateWeddingInput(body, { partial = false } = {}) {
  requireObjectBody(body);

  const unknownFields = Object.keys(body).filter((key) => !editableFields.has(key));
  if (unknownFields.length) {
    throw invalidRequest('The request contains fields that cannot be changed through this endpoint.');
  }

  const fields = {};
  for (const key of ['title', 'partnerOneName', 'partnerTwoName', 'slug']) {
    if (body[key] !== undefined) fields[key] = nonEmptyString(body[key], key);
    else if (!partial) throw invalidRequest(`${key} is required.`);
  }

  if (body.weddingDate !== undefined) {
    if (!validDate(body.weddingDate)) throw invalidRequest('weddingDate must use YYYY-MM-DD format.');
    fields.weddingDate = body.weddingDate;
  } else if (!partial) {
    throw invalidRequest('weddingDate is required.');
  }

  if (body.timeZone !== undefined) {
    if (typeof body.timeZone !== 'string' || !validTimeZone(body.timeZone)) {
      throw invalidRequest('timeZone must be a valid IANA timezone.');
    }
    fields.timeZone = body.timeZone;
  } else if (!partial) {
    throw invalidRequest('timeZone is required.');
  }

  if (body.introduction !== undefined) {
    if (typeof body.introduction !== 'string') throw invalidRequest('introduction must be a string.');
    fields.introduction = body.introduction.trim();
  }

  if (partial && Object.keys(fields).length === 0) {
    throw invalidRequest('At least one editable Wedding field is required.');
  }

  return fields;
}

function validatePublication(body) {
  requireObjectBody(body);
  if (Object.keys(body).length !== 1 || typeof body.websitePublished !== 'boolean') {
    throw invalidRequest('websitePublished must be a boolean.');
  }
  return body.websitePublished;
}

function validateManagerInvitation(body) {
  requireObjectBody(body);
  if (Object.keys(body).some((key) => !['name', 'email'].includes(key))) {
    throw invalidRequest('The request contains unsupported invitation fields.');
  }
  return {
    name: nonEmptyString(body.name, 'name'),
    email: normalizeEmail(body.email),
  };
}

module.exports = {
  validateManagerInvitation,
  validatePublication,
  validateWeddingInput,
};
