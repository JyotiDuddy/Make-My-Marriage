const cors = require('cors');
const ApiError = require('../shared/errors/api-error');
const config = require('../config/env');

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || origin === config.frontendOrigin) {
      callback(null, true);
      return;
    }

    callback(new ApiError(403, 'FORBIDDEN', 'This origin is not allowed.'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  maxAge: 600,
});

module.exports = corsMiddleware;
