const express = require('express');
const config = require('../../config/env');
const csrfProtection = require('../../middleware/csrf-protection');
const createRateLimiter = require('../../middleware/rate-limiter');
const ApiError = require('../../shared/errors/api-error');
const { requireAuthenticated, requireRole } = require('../auth/auth.middleware');
const weddingService = require('./wedding.service');
const { createWeddingController } = require('./wedding.controller');
const { createImageUploadMiddleware } = require('../../middleware/image-upload');

function createWeddingRouter({ service = weddingService, rateLimitOverrides = {} } = {}) {
  const router = express.Router();
  const controller = createWeddingController(service);
  const limits = { ...config.authRateLimits, ...rateLimitOverrides };
  const admin = requireRole('ADMIN');
  const authenticatedAdmin = [requireAuthenticated, admin];

  router.post(
    '/',
    ...authenticatedAdmin,
    csrfProtection,
    controller.create,
  );
  router.get('/me', requireAuthenticated, requireRole('ADMIN', 'MANAGER'), controller.getMe);
  router.patch('/me', ...authenticatedAdmin, csrfProtection, controller.updateMe);
  router.patch('/me/publication', ...authenticatedAdmin, csrfProtection, controller.updatePublication);
  router.put(
    '/me/cover-image',
    ...authenticatedAdmin,
    csrfProtection,
    createImageUploadMiddleware(),
    controller.uploadCoverImage,
  );
  router.delete('/me/cover-image', ...authenticatedAdmin, csrfProtection, controller.deleteCoverImage);
  router.patch('/me/our-story', ...authenticatedAdmin, csrfProtection, controller.updateOurStory);
  router.post(
    '/me/our-story/images',
    ...authenticatedAdmin,
    csrfProtection,
    createImageUploadMiddleware({ textFields: 1 }),
    controller.uploadOurStoryImage,
  );
  router.delete(
    '/me/our-story/images/:imageId',
    ...authenticatedAdmin,
    csrfProtection,
    controller.deleteOurStoryImage,
  );
  router.post(
    '/me/manager-invitation',
    ...authenticatedAdmin,
    createRateLimiter(limits.managerInvitation, 'Too many Manager invitations. Try again later.'),
    csrfProtection,
    controller.inviteManager,
  );
  router.post(
    '/me/manager-invitation/resend',
    ...authenticatedAdmin,
    createRateLimiter(limits.managerInvitationResend, 'Too many Manager invitation resend attempts. Try again later.'),
    csrfProtection,
    controller.resendManagerInvitation,
  );

  router.use((req, res, next) => {
    next(new ApiError(404, 'NOT_FOUND', 'The requested resource was not found.'));
  });

  return router;
}

module.exports = { createWeddingRouter };
