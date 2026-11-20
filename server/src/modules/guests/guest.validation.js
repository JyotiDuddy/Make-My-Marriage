const mongoose = require('mongoose');
const ApiError = require('../../shared/errors/api-error');

const EDITABLE_FIELDS = new Set(['familyName', 'primaryContactName', 'mobile', 'email', 'familyGroupInfo', 'notes', 'invitedEvents']);
const OPTIONAL_TEXT = ['primaryContactName', 'email', 'familyGroupInfo', 'notes'];

function invalid(message = 'The request contains invalid guest data.') {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

function normalizeMobile(value) {
  if (typeof value !== 'string') throw invalid('mobile must be a string.');
  const trimmed = value.trim();
  if (!trimmed || !/^\+?[0-9\s().-]+$/.test(trimmed)) throw invalid('mobile must contain digits and optional phone-number separators.');
  const normalized = trimmed.replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(normalized)) throw invalid('mobile must contain digits and an optional leading +.');
  return normalized;
}

function validateGuestInput(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  if (Object.keys(body).some((key) => !EDITABLE_FIELDS.has(key))) {
    throw invalid('The request contains fields that cannot be changed through this endpoint.');
  }
  const fields = {};
  if (body.familyName !== undefined) {
    if (typeof body.familyName !== 'string' || !body.familyName.trim()) throw invalid('familyName must be a non-empty string.');
    fields.familyName = body.familyName.trim();
  } else if (!partial) throw invalid('familyName is required.');
  if (body.mobile !== undefined) fields.mobile = normalizeMobile(body.mobile);
  else if (!partial) throw invalid('mobile is required.');

  for (const key of OPTIONAL_TEXT) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'string') throw invalid(`${key} must be a string.`);
      fields[key] = body[key] === '' ? '' : body[key].trim();
    }
  }

  if (body.invitedEvents !== undefined) {
    if (!Array.isArray(body.invitedEvents)) throw invalid('invitedEvents must be an array.');
    const ids = body.invitedEvents.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some((key) => key !== 'eventId')) {
        throw invalid('Each invitedEvents item must contain only an eventId.');
      }
      if (typeof entry.eventId !== 'string' || !mongoose.isValidObjectId(entry.eventId)) throw invalid('Each invited event must have a valid eventId.');
      return entry.eventId;
    });
    if (new Set(ids.map((id) => id.toLowerCase())).size !== ids.length) throw invalid('invitedEvents cannot contain duplicate Event IDs.');
    fields.invitedEvents = ids;
  } else if (!partial) throw invalid('invitedEvents is required.');

  if (partial && !Object.keys(fields).length) throw invalid('At least one editable Guest field is required.');
  return fields;
}

function validateGuestQuery(query) {
  const allowed = new Set(['search', 'eventId', 'invitationStatus', 'page', 'limit']);
  if (Object.keys(query).some((key) => !allowed.has(key))) throw invalid('The query contains unsupported filters.');
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1) throw invalid('page must be a positive integer.');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw invalid('limit must be an integer between 1 and 100.');
  if (query.search !== undefined && typeof query.search !== 'string') throw invalid('search must be a string.');
  if (query.eventId !== undefined && !mongoose.isValidObjectId(query.eventId)) throw invalid('eventId must be a valid Event ID.');
  if (query.invitationStatus !== undefined && !['NOT_SENT', 'SHARED'].includes(query.invitationStatus)) throw invalid('invitationStatus must be NOT_SENT or SHARED.');
  return { page, limit, search: query.search, eventId: query.eventId, invitationStatus: query.invitationStatus };
}

function validateSharingStatus(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !['NOT_SENT', 'SHARED'].includes(body.status)) {
    throw invalid('status must be NOT_SENT or SHARED.');
  }
  return body.status;
}

module.exports = { normalizeMobile, validateGuestInput, validateGuestQuery, validateSharingStatus };
