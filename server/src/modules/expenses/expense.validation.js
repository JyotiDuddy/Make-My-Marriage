const mongoose = require('mongoose');
const ApiError = require('../../shared/errors/api-error');

const CATEGORIES = ['CATERING', 'DECORATION', 'PHOTOGRAPHY', 'VENUE', 'CLOTHING', 'TRANSPORTATION', 'ENTERTAINMENT', 'MISCELLANEOUS'];
const EDITABLE_FIELDS = new Set(['title', 'category', 'amountPaise', 'paymentDate', 'paymentMethod', 'eventId', 'notes']);
const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:Z|([+-])([01]\d|2[0-3]):([0-5]\d))$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function invalid(message = 'The request contains invalid expense data.') {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

function objectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
}

function validCalendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validPaymentDate(value) {
  if (typeof value !== 'string') return false;
  const match = ISO_DATETIME.exec(value);
  if (!match) return false;
  const [, year, month, day, , , , , offsetHour, offsetMinute] = match;
  if (!validCalendarDate(Number(year), Number(month), Number(day))) return false;
  if (offsetHour !== undefined && Number(offsetMinute) > 59) return false;
  return Number.isFinite(Date.parse(value));
}

function validateExpenseInput(body, { partial = false } = {}) {
  objectBody(body);
  if (Object.keys(body).some((key) => !EDITABLE_FIELDS.has(key))) {
    throw invalid('The request contains fields that cannot be changed through this endpoint.');
  }

  const fields = {};
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) throw invalid('title must be a non-empty string.');
    fields.title = body.title.trim();
  } else if (!partial) throw invalid('title is required.');

  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) throw invalid('category must be a supported Expense category.');
    fields.category = body.category;
  } else if (!partial) throw invalid('category is required.');

  if (body.amountPaise !== undefined) {
    if (!Number.isSafeInteger(body.amountPaise) || body.amountPaise <= 0) {
      throw invalid('amountPaise must be a positive integer in paise.');
    }
    fields.amountPaise = body.amountPaise;
  } else if (!partial) throw invalid('amountPaise is required.');

  if (body.paymentDate !== undefined) {
    if (!validPaymentDate(body.paymentDate)) {
      throw invalid('paymentDate must be an ISO 8601 date-time with an explicit timezone.');
    }
    fields.paymentDate = new Date(body.paymentDate);
  } else if (!partial) throw invalid('paymentDate is required.');

  for (const key of ['paymentMethod', 'notes']) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'string') throw invalid(`${key} must be a string.`);
      fields[key] = body[key] === '' ? '' : body[key].trim();
    }
  }

  if (body.eventId !== undefined) {
    if (body.eventId === null && partial) fields.eventId = null;
    else if (typeof body.eventId !== 'string' || !mongoose.isValidObjectId(body.eventId)) {
      throw invalid('eventId must be a valid Event ID.');
    } else fields.eventId = body.eventId;
  }

  if (partial && Object.keys(fields).length === 0) throw invalid('At least one editable Expense field is required.');
  return fields;
}

function validateExpenseQuery(query) {
  const allowed = new Set(['category', 'eventId', 'dateFrom', 'dateTo', 'page', 'limit']);
  if (Object.keys(query).some((key) => !allowed.has(key))) throw invalid('The query contains unsupported filters.');
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1) throw invalid('page must be a positive integer.');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw invalid('limit must be an integer between 1 and 100.');
  if (query.category !== undefined && !CATEGORIES.includes(query.category)) throw invalid('category must be a supported Expense category.');
  if (query.eventId !== undefined && !mongoose.isValidObjectId(query.eventId)) throw invalid('eventId must be a valid Event ID.');

  const dates = {};
  for (const key of ['dateFrom', 'dateTo']) {
    if (query[key] !== undefined) {
      const match = ISO_DATE.exec(query[key]);
      if (!match || !validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
        throw invalid(`${key} must be a valid YYYY-MM-DD date.`);
      }
      dates[key] = new Date(`${query[key]}T${key === 'dateFrom' ? '00:00:00.000' : '23:59:59.999'}Z`);
    }
  }
  if (dates.dateFrom && dates.dateTo && dates.dateFrom > dates.dateTo) throw invalid('dateFrom must be on or before dateTo.');
  return { page, limit, category: query.category, eventId: query.eventId, ...dates };
}

module.exports = { CATEGORIES, validPaymentDate, validateExpenseInput, validateExpenseQuery };
