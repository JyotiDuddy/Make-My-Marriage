const ApiError = require('../shared/errors/api-error');
const { sendError } = require('../shared/http/responses');

function isMalformedJson(error) {
  return error instanceof SyntaxError && error.status === 400 && Object.hasOwn(error, 'body');
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof ApiError) {
    return sendError(res, {
      statusCode: error.statusCode,
      message: error.message,
      code: error.code,
    });
  }

  if (isMalformedJson(error)) {
    return sendError(res, {
      statusCode: 400,
      message: 'The request body contains invalid JSON.',
      code: 'VALIDATION_ERROR',
    });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  return sendError(res, {
    statusCode: 500,
    message: isProduction ? 'Internal server error.' : error.message || 'Internal server error.',
    code: 'INTERNAL_SERVER_ERROR',
  });
}

module.exports = errorHandler;
