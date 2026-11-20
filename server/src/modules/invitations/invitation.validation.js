const ApiError = require('../../shared/errors/api-error');

function invalid(message) {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

function validateInvitationInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalid('Invitation type and image are required.');
  }
  const unknown = Object.keys(body).filter((key) => !['type', 'eventId'].includes(key));
  if (unknown.length) throw invalid('Only type and eventId are accepted upload fields.');

  const { type } = body;
  if (!['COMMON', 'EVENT'].includes(type)) throw invalid('type must be COMMON or EVENT.');
  const rawEventId = body.eventId;
  if (type === 'COMMON') {
    if (rawEventId !== undefined && rawEventId !== '' && rawEventId !== 'null') {
      throw invalid('A COMMON invitation must omit eventId or set it to null.');
    }
    return { type };
  }

  if (typeof rawEventId !== 'string' || rawEventId.length === 0 || rawEventId === 'null') {
    throw invalid('eventId is required for an EVENT invitation.');
  }
  if (!/^[a-f\d]{24}$/i.test(rawEventId)) throw invalid('eventId must be a valid Event ID.');
  return { type, eventId: rawEventId };
}

function validateInvitationListQuery(query) {
  const allowed = new Set(['page', 'limit']);
  for (const key of Object.keys(query ?? {})) {
    if (!allowed.has(key)) throw invalid(`Unsupported query parameter: ${key}.`);
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

  return { page: positiveInteger(query?.page, 1), limit: positiveInteger(query?.limit, 10, 100) };
}

module.exports = { validateInvitationInput, validateInvitationListQuery };
