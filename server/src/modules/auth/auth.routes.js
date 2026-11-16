const express = require('express');
const config = require('../../config/env');
const createRateLimiter = require('../../middleware/rate-limiter');
const csrfProtection = require('../../middleware/csrf-protection');
const authService = require('./auth.service');
const { createAuthController } = require('./auth.controller');
const { requireAuthenticated } = require('./auth.middleware');

function createAuthRouter({ service = authService, rateLimitOverrides = {} } = {}) {
  const router = express.Router();
  const controller = createAuthController(service);
  const limits = { ...config.authRateLimits, ...rateLimitOverrides };

  router.get('/csrf', controller.csrf);
  router.post('/register', createRateLimiter(limits.register, 'Too many authentication requests. Try again later.'), csrfProtection, controller.register);
  router.post('/login', createRateLimiter(limits.login, 'Too many authentication requests. Try again later.'), csrfProtection, controller.login);
  router.post('/logout', requireAuthenticated, csrfProtection, controller.logout);
  router.get('/me', requireAuthenticated, controller.me);
  router.post('/forgot-password', createRateLimiter(limits.forgotPassword, 'Too many authentication requests. Try again later.'), csrfProtection, controller.forgotPassword);
  router.post('/reset-password', createRateLimiter(limits.resetPassword, 'Too many authentication requests. Try again later.'), csrfProtection, controller.resetPassword);
  router.post('/manager-activation', createRateLimiter(limits.managerActivation, 'Too many activation attempts. Try again later.'), csrfProtection, controller.activateManager);

  return router;
}

module.exports = { createAuthRouter };
