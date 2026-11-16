const { csrfSync } = require('csrf-sync');
const ApiError = require('../shared/errors/api-error');

const { csrfSynchronisedProtection } = csrfSync();

function csrfProtection(req, res, next) {
  csrfSynchronisedProtection(req, res, (error) => {
    if (error) {
      next(new ApiError(403, 'FORBIDDEN', 'A valid CSRF token is required.'));
      return;
    }
    next();
  });
}

module.exports = csrfProtection;
