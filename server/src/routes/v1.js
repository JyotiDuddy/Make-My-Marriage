const express = require('express');
const healthRouter = require('../modules/health/health.routes');
const { createAuthRouter } = require('../modules/auth/auth.routes');

function createV1Router(options) {
  const router = express.Router();

  router.use('/health', healthRouter);
  router.use('/auth', createAuthRouter(options));

  return router;
}

const router = createV1Router();
module.exports = router;
module.exports.createV1Router = createV1Router;
