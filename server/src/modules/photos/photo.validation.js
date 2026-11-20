const mongoose = require('mongoose');
const ApiError = require('../../shared/errors/api-error');

const statuses = ['PENDING', 'APPROVED', 'REJECTED'];

function invalid(message) {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

function validatePhotoId(photoId) {
  if (!mongoose.isValidObjectId(photoId)) {
    throw new ApiError(404, 'NOT_FOUND', 'The Photo was not found.');
  }
}

function validateUploadFields(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalid('The multipart fields are invalid.');
  }
  if (Object.keys(body).some((key) => key !== 'eventId')) {
    throw invalid('Only eventId is accepted as a photo upload field.');
  }
  if (body.eventId === undefined) return {};
  if (typeof body.eventId !== 'string' || !/^[a-f\d]{24}$/i.test(body.eventId)) {
    throw invalid('eventId must be a valid Event ID.');
  }
  return { eventId: body.eventId };
}

function validatePhotoListQuery(query) {
  const allowed = new Set(['status', 'eventId', 'page', 'limit']);
  for (const key of Object.keys(query ?? {})) {
    if (!allowed.has(key)) throw invalid(`Unsupported query parameter: ${key}.`);
  }

  if (query?.status !== undefined && !statuses.includes(query.status)) {
    throw invalid('status must be PENDING, APPROVED, or REJECTED.');
  }
  if (query?.eventId !== undefined && !/^[a-f\d]{24}$/i.test(String(query.eventId))) {
    throw invalid('eventId must be a valid Event ID.');
  }

  function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(String(value))) throw invalid('page and limit must be positive integers.');
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
      throw invalid(`page must be positive and limit must not exceed ${maximum}.`);
    }
    return parsed;
  }

  return {
    status: query?.status,
    eventId: query?.eventId,
    page: positiveInteger(query?.page, 1),
    limit: positiveInteger(query?.limit, 10, 100),
  };
}

function validateReviewBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== 1 || !['APPROVED', 'REJECTED'].includes(body.status)) {
    throw invalid('status must be APPROVED or REJECTED.');
  }
  return body.status;
}

module.exports = {
  statuses,
  validatePhotoId,
  validatePhotoListQuery,
  validateReviewBody,
  validateUploadFields,
};
