const { rateLimit } = require('express-rate-limit');
const config = require('../config/env');
const { sendError } = require('../shared/http/responses');

function createRateLimiter(limit, message = 'Too many requests. Try again later.', windowMs = config.authRateLimitWindowMs) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(req, res) {
      return sendError(res, {
        statusCode: 429,
        message,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    },
  });
}

module.exports = createRateLimiter;
