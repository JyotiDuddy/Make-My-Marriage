const multer = require('multer');
const ApiError = require('../shared/errors/api-error');

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function createImageUploadMiddleware({ fieldName = 'image', textFields = 0 } = {}) {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_IMAGE_SIZE_BYTES,
      files: 1,
      fields: textFields,
      parts: textFields + 1,
    },
  }).single(fieldName);

  return (req, res, next) => {
    parser(req, res, (error) => {
      if (!error) return next();
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(413, 'FILE_TOO_LARGE', 'Image files must be 10 MB or smaller.'));
      }
      if (error instanceof multer.MulterError) {
        return next(new ApiError(400, 'VALIDATION_ERROR', 'The multipart upload contains unsupported fields or files.'));
      }
      return next(error);
    });
  };
}

module.exports = { createImageUploadMiddleware, MAX_IMAGE_SIZE_BYTES };
