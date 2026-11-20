const express = require('express');
const { requireAuthenticated, requireRole } = require('../auth/auth.middleware');
const { createDashboardService } = require('./dashboard.service');
const { createDashboardController } = require('./dashboard.controller');

function createDashboardRouter({ service = createDashboardService() } = {}) {
  const router = express.Router();
  const controller = createDashboardController(service);
  router.get('/summary', requireAuthenticated, requireRole('ADMIN', 'MANAGER'), controller.getSummary);
  return router;
}

module.exports = { createDashboardRouter };
