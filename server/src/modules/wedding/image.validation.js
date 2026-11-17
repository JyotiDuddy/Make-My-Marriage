const ApiError = require('../../shared/errors/api-error');

const MAX_DESCRIPTION_LENGTH = 1000;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function invalidRequest(message) {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

function unsupportedImage() {
  return new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Upload a JPEG, PNG, or WebP image with matching file content.');
}

function validateOurStoryDescription(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidRequest('The request body must contain a description string.');
  }
  if (Object.keys(body).length !== 1 || typeof body.description !== 'string') {
    throw invalidRequest('description must be the only field and must be a string.');
  }

  if ([...body.description].length > MAX_DESCRIPTION_LENGTH) {
    throw invalidRequest(`description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  }
  return body.description.trim();
}

function validateAltText(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidRequest('altText is required.');
  }
  if (Object.keys(body).some((key) => key !== 'altText')
    || typeof body.altText !== 'string'
    || body.altText.trim().length === 0) {
    throw invalidRequest('altText is required and must be a non-empty string.');
  }
  return body.altText.trim();
}

async function validateImageFile(file) {
  if (!file?.buffer || file.buffer.length === 0) {
    throw invalidRequest('The image field is required.');
  }

  const { fileTypeFromBuffer } = await import('file-type');
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !allowedMimeTypes.has(detected.mime) || file.mimetype !== detected.mime) {
    throw unsupportedImage();
  }

  return detected;
}

module.exports = {
  MAX_DESCRIPTION_LENGTH,
  validateAltText,
  validateImageFile,
  validateOurStoryDescription,
};
