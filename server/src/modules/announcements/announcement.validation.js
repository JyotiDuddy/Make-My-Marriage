const mongoose = require('mongoose');
const ApiError = require('../../shared/errors/api-error');

const STATUSES = ['DRAFT', 'PUBLISHED'];
const EDITABLE_FIELDS = new Set(['title', 'description', 'status']);

function invalid(message = 'The request contains invalid Announcement data.') {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

function objectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
}

function validateAnnouncementInput(body, { partial = false } = {}) {
  objectBody(body);
  if (Object.keys(body).some((key) => !EDITABLE_FIELDS.has(key))) {
    throw invalid('The request contains fields that cannot be changed through this endpoint.');
  }

  const fields = {};
  for (const field of ['title', 'description']) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'string' || !body[field].trim()) {
        throw invalid(`${field} must be a non-empty string.`);
      }
      fields[field] = body[field].trim();
    } else if (!partial) {
      throw invalid(`${field} is required.`);
    }
  }

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw invalid('status must be DRAFT or PUBLISHED.');
    fields.status = body.status;
  } else if (!partial) {
    throw invalid('status is required.');
  }

  if (partial && Object.keys(fields).length === 0) throw invalid('At least one editable Announcement field is required.');
  return fields;
}

function validateAnnouncementQuery(query) {
  const allowed = new Set(['status', 'page', 'limit']);
  if (Object.keys(query).some((key) => !allowed.has(key))) throw invalid('The query contains unsupported filters.');

  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1) throw invalid('page must be a positive integer.');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw invalid('limit must be an integer between 1 and 100.');
  }
  if (query.status !== undefined && !STATUSES.includes(query.status)) {
    throw invalid('status must be DRAFT or PUBLISHED.');
  }
  return { page, limit, status: query.status };
}

function validateAnnouncementId(announcementId) {
  if (!mongoose.isValidObjectId(announcementId)) {
    throw new ApiError(404, 'NOT_FOUND', 'The Announcement was not found.');
  }
}

module.exports = { STATUSES, validateAnnouncementId, validateAnnouncementInput, validateAnnouncementQuery };
