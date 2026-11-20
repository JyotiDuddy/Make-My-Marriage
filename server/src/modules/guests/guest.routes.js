const express = require('express');
const csrfProtection = require('../../middleware/csrf-protection');
const { requireAuthenticated, requireRole } = require('../auth/auth.middleware');
const { createGuestService } = require('./guest.service');
const { createGuestController } = require('./guest.controller');
const { csvUploadMiddleware } = require('./csv-upload.middleware');

function createGuestRouter({ service = createGuestService() } = {}) {
  const router = express.Router();
  const controller = createGuestController(service);
  const organizer = [requireAuthenticated, requireRole('ADMIN', 'MANAGER')];
  router.post('/', ...organizer, csrfProtection, controller.create);
  router.post('/import', ...organizer, csrfProtection, csvUploadMiddleware, controller.import);
  router.post('/:guestId/rsvp-link', ...organizer, csrfProtection, controller.generateRsvpLink);
  router.get('/', ...organizer, controller.list);
  router.get('/:guestId', ...organizer, controller.get);
  router.patch('/:guestId', ...organizer, csrfProtection, controller.update);
  router.delete('/:guestId', ...organizer, csrfProtection, controller.remove);
  router.patch('/:guestId/invitation-sharing/common', ...organizer, csrfProtection, controller.shareCommonInvitation);
  router.patch('/:guestId/invited-events/:eventId/invitation-sharing', ...organizer, csrfProtection, controller.shareEventInvitation);
  return router;
}

module.exports = { createGuestRouter };
