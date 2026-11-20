const ApiError = require('../../shared/errors/api-error');

function invalid(message = 'The RSVP response must be YES or NO.') {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

function validateRsvpToken(token) {
  // M9 generates exactly 32 random bytes encoded as unpadded base64url.
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  try {
    return Buffer.from(token, 'base64url').length === 32;
  } catch {
    return false;
  }
}

function validateRsvpInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  if (Object.keys(body).some((key) => key !== 'response')) {
    throw invalid('Only the response field can be submitted.');
  }
  if (!['YES', 'NO'].includes(body.response)) throw invalid();
  return body.response;
}

module.exports = { validateRsvpInput, validateRsvpToken };
