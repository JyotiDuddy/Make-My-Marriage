const express = require('express');
const config = require('../../config/env');
const createRateLimiter = require('../../middleware/rate-limiter');
const csrfProtection = require('../../middleware/csrf-protection');
const { createImageUploadMiddleware } = require('../../middleware/image-upload');
const { requireAuthenticated, requireRole } = require('../auth/auth.middleware');
const { createPhotoService } = require('./photo.service');
const { createPhotoController } = require('./photo.controller');

function createPhotoRouter({ service = createPhotoService() } = {}) {
  const router = express.Router();
  const controller = createPhotoController(service);
  const organizer = [requireAuthenticated, requireRole('ADMIN', 'MANAGER')];

  router.get('/', ...organizer, controller.list);
  router.post('/', ...organizer, csrfProtection, createImageUploadMiddleware({ textFields: 1 }), controller.upload);
  router.get('/:photoId', ...organizer, controller.get);
  router.patch('/:photoId/review', requireAuthenticated, requireRole('ADMIN'), csrfProtection, controller.review);
  router.delete('/:photoId', ...organizer, csrfProtection, controller.remove);
  return router;
}

function createPublicPhotoRouter({ service = createPhotoService(), rateLimitOverrides = {} } = {}) {
  const router = express.Router();
  const controller = createPhotoController(service);
  const limits = { ...config.publicPhotoRateLimits, ...rateLimitOverrides };
  const uploadRateLimit = createRateLimiter(
    limits.upload,
    'Too many photo submissions. Try again later.',
    rateLimitOverrides.windowMs ?? config.publicPhotoRateLimitWindowMs,
  );
  router.post('/:slug/photos', uploadRateLimit, createImageUploadMiddleware({ fieldName: 'image', textFields: 1 }), controller.submitGuest);
  return router;
}

module.exports = { createPhotoRouter, createPublicPhotoRouter };
