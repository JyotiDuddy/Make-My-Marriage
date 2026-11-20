const express = require('express');
const csrfProtection = require('../../middleware/csrf-protection');
const { requireAuthenticated, requireRole } = require('../auth/auth.middleware');
const { createExpenseService } = require('./expense.service');
const { createExpenseController } = require('./expense.controller');

function createExpenseRouter({ service = createExpenseService() } = {}) {
  const router = express.Router();
  const controller = createExpenseController(service);
  const organizer = [requireAuthenticated, requireRole('ADMIN', 'MANAGER')];
  router.post('/', ...organizer, csrfProtection, controller.create);
  router.get('/', ...organizer, controller.list);
  router.get('/:expenseId', ...organizer, controller.get);
  router.patch('/:expenseId', ...organizer, csrfProtection, controller.update);
  router.delete('/:expenseId', ...organizer, csrfProtection, controller.remove);
  return router;
}

module.exports = { createExpenseRouter };
