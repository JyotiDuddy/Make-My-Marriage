const ApiError = require('../shared/errors/api-error');

function notFound(req, res, next) {
  next(new ApiError(404, 'NOT_FOUND', 'The requested resource was not found.'));
}

module.exports = notFound;
