const mongoose = require('mongoose');
const ApiError = require('../../shared/errors/api-error');

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED'];
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
const EDITABLE_FIELDS = new Set(['title', 'description', 'eventId', 'deadline', 'priority', 'status']);
const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:Z|([+-])([01]\d|2[0-3]):([0-5]\d))$/;

function invalid(message = 'The request contains invalid task data.') {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

function objectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
}

function validDeadline(value) {
  if (typeof value !== 'string') return false;
  const match = ISO_DATETIME.exec(value);
  if (!match) return false;
  const [, year, month, day, , , , , offsetHour, offsetMinute] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return false;
  if (offsetHour !== undefined && (Number(offsetHour) > 23 || Number(offsetMinute) > 59)) return false;
  return Number.isFinite(Date.parse(value));
}

function validateTaskInput(body, { partial = false } = {}) {
  objectBody(body);
  if (Object.keys(body).some((key) => !EDITABLE_FIELDS.has(key))) {
    throw invalid('The request contains fields that cannot be changed through this endpoint.');
  }

  const fields = {};
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) throw invalid('title must be a non-empty string.');
    fields.title = body.title.trim();
  } else if (!partial) throw invalid('title is required.');

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') throw invalid('description must be a string.');
    fields.description = body.description === '' ? '' : body.description.trim();
  }

  if (body.eventId !== undefined) {
    if (body.eventId === null && partial) fields.eventId = null;
    else if (typeof body.eventId !== 'string' || !mongoose.isValidObjectId(body.eventId)) {
      throw invalid('eventId must be a valid Event ID.');
    } else fields.eventId = body.eventId;
  }

  if (body.deadline !== undefined) {
    if (!validDeadline(body.deadline)) {
      throw invalid('deadline must be a valid ISO 8601 date-time with an explicit timezone.');
    }
    fields.deadline = new Date(body.deadline);
  } else if (!partial) throw invalid('deadline is required.');

  if (body.priority !== undefined) {
    if (!TASK_PRIORITIES.includes(body.priority)) throw invalid('priority must be LOW, MEDIUM, or HIGH.');
    fields.priority = body.priority;
  } else if (!partial) throw invalid('priority is required.');

  if (body.status !== undefined) {
    if (!TASK_STATUSES.includes(body.status)) throw invalid('status must be TODO, IN_PROGRESS, or COMPLETED.');
    fields.status = body.status;
  } else if (!partial) throw invalid('status is required.');

  if (partial && Object.keys(fields).length === 0) throw invalid('At least one editable Task field is required.');
  return fields;
}

function validateTaskQuery(query) {
  const allowed = new Set(['status', 'priority', 'eventId', 'page', 'limit']);
  if (Object.keys(query).some((key) => !allowed.has(key))) throw invalid('The query contains unsupported filters.');
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1) throw invalid('page must be a positive integer.');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw invalid('limit must be an integer between 1 and 100.');
  }
  if (query.status !== undefined && !TASK_STATUSES.includes(query.status)) {
    throw invalid('status must be TODO, IN_PROGRESS, or COMPLETED.');
  }
  if (query.priority !== undefined && !TASK_PRIORITIES.includes(query.priority)) {
    throw invalid('priority must be LOW, MEDIUM, or HIGH.');
  }
  if (query.eventId !== undefined && !mongoose.isValidObjectId(query.eventId)) {
    throw invalid('eventId must be a valid Event ID.');
  }
  return { page, limit, status: query.status, priority: query.priority, eventId: query.eventId };
}

module.exports = { TASK_PRIORITIES, TASK_STATUSES, validDeadline, validateTaskInput, validateTaskQuery };
