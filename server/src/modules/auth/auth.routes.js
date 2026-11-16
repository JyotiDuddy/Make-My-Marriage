const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { csrfSync } = require('csrf-sync');
const config = require('../../config/env');
const ApiError = require('../../shared/errors/api-error');
const { sendError } = require('../../shared/http/responses');
const authService = require('./auth.service');
const { createAuthController } = require('./auth.controller');
const { requireAuthenticated } = require('./auth.middleware');

function createCsrfMiddleware() {
  const { csrfSynchronisedProtection } = csrfSync();

  return (req, res, next) => {
    csrfSynchronisedProtection(req, res, (error) => {
      if (error) {
        next(new ApiError(403, 'FORBIDDEN', 'A valid CSRF token is required.'));
        return;
      }
      next();
    });
  };
}

function createLimiter(limit) {
  return rateLimit({
    windowMs: config.authRateLimitWindowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(req, res) {
      return sendError(res, {
        statusCode: 429,
        message: 'Too many authentication requests. Try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      });
    },
  });
}

function createAuthRouter({ service = authService, rateLimitOverrides = {} } = {}) {
  const router = express.Router();
  const controller = createAuthController(service);
  const csrfProtection = createCsrfMiddleware();
  const limits = { ...config.authRateLimits, ...rateLimitOverrides };

  router.get('/csrf', controller.csrf);
  router.post('/register', createLimiter(limits.register), csrfProtection, controller.register);
  router.post('/login', createLimiter(limits.login), csrfProtection, controller.login);
  router.post('/logout', requireAuthenticated, csrfProtection, controller.logout);
  router.get('/me', requireAuthenticated, controller.me);
  router.post('/forgot-password', createLimiter(limits.forgotPassword), csrfProtection, controller.forgotPassword);
  router.post('/reset-password', createLimiter(limits.resetPassword), csrfProtection, controller.resetPassword);

  return router;
}

module.exports = { createAuthRouter };
