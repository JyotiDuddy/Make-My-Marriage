const express = require('express');
const csrfProtection = require('../../middleware/csrf-protection');
const { createImageUploadMiddleware } = require('../../middleware/image-upload');
const { requireAuthenticated, requireRole } = require('../auth/auth.middleware');
const { createInvitationService } = require('./invitation.service');
const { createInvitationController } = require('./invitation.controller');

function createInvitationRouter({ service = createInvitationService() } = {}) {
  const router = express.Router();
  const controller = createInvitationController(service);
  const organizer = [requireAuthenticated, requireRole('ADMIN', 'MANAGER')];

  router.get('/', ...organizer, controller.list);
  router.post('/', ...organizer, csrfProtection, createImageUploadMiddleware({ textFields: 2 }), controller.upload);
  router.delete('/:invitationId', ...organizer, csrfProtection, controller.remove);
  return router;
}

module.exports = { createInvitationRouter };
