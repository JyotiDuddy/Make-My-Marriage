const express = require('express');
const csrfProtection = require('../../middleware/csrf-protection');
const { requireAuthenticated, requireRole } = require('../auth/auth.middleware');
const eventService = require('./event.service').createEventService();
const { createEventController } = require('./event.controller');

function createEventRouter({ service = eventService } = {}) {
  const router = express.Router();
  const controller = createEventController(service);
  const organizer = [requireAuthenticated, requireRole('ADMIN', 'MANAGER')];

  router.post('/', ...organizer, csrfProtection, controller.create);
  router.get('/', ...organizer, controller.list);
  router.get('/:eventId', ...organizer, controller.get);
  router.patch('/:eventId/status', ...organizer, csrfProtection, controller.updateStatus);
  router.patch('/:eventId', ...organizer, csrfProtection, controller.update);
  router.delete('/:eventId', ...organizer, csrfProtection, controller.remove);
  return router;
}

module.exports = { createEventRouter };
