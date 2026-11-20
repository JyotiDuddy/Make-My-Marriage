const express = require('express');
const csrfProtection = require('../../middleware/csrf-protection');
const { requireAuthenticated, requireRole } = require('../auth/auth.middleware');
const { createTaskService } = require('./task.service');
const { createTaskController } = require('./task.controller');

function createTaskRouter({ service = createTaskService() } = {}) {
  const router = express.Router();
  const controller = createTaskController(service);
  const organizer = [requireAuthenticated, requireRole('ADMIN', 'MANAGER')];

  router.post('/', ...organizer, csrfProtection, controller.create);
  router.get('/', ...organizer, controller.list);
  router.get('/:taskId', ...organizer, controller.get);
  router.patch('/:taskId', ...organizer, csrfProtection, controller.update);
  router.delete('/:taskId', ...organizer, csrfProtection, controller.remove);
  return router;
}

module.exports = { createTaskRouter };
