const multer = require('multer');
const ApiError = require('../../shared/errors/api-error');

const MAX_CSV_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CSV_FILE_SIZE_BYTES, files: 1, fields: 0, parts: 1 },
}).single('file');

function csvUploadMiddleware(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(413, 'FILE_TOO_LARGE', 'CSV files must be 2 MiB or smaller.'));
    }
    if (error instanceof multer.MulterError) {
      return next(new ApiError(400, 'VALIDATION_ERROR', 'The multipart upload must contain one file in the `file` field and no other parts.'));
    }
    return next(error);
  });
}

module.exports = { csvUploadMiddleware, MAX_CSV_FILE_SIZE_BYTES };
