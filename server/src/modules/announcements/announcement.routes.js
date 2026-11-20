const express = require('express');
const csrfProtection = require('../../middleware/csrf-protection');
const { requireAuthenticated, requireRole } = require('../auth/auth.middleware');
const { createAnnouncementService } = require('./announcement.service');
const { createAnnouncementController } = require('./announcement.controller');

function createAnnouncementRouter({ service = createAnnouncementService() } = {}) {
  const router = express.Router();
  const controller = createAnnouncementController(service);
  const organizer = [requireAuthenticated, requireRole('ADMIN', 'MANAGER')];

  router.post('/', ...organizer, csrfProtection, controller.create);
  router.get('/', ...organizer, controller.list);
  router.get('/:announcementId', ...organizer, controller.get);
  router.patch('/:announcementId', ...organizer, csrfProtection, controller.update);
  router.delete('/:announcementId', ...organizer, csrfProtection, controller.remove);
  return router;
}

module.exports = { createAnnouncementRouter };
