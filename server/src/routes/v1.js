const express = require('express');
const healthRouter = require('../modules/health/health.routes');
const { createAuthRouter } = require('../modules/auth/auth.routes');
const { createWeddingRouter } = require('../modules/wedding/wedding.routes');
const { createEventRouter } = require('../modules/events/event.routes');

function createV1Router(options) {
  const router = express.Router();

  router.use('/health', healthRouter);
  const authOptions = {
    service: options?.authService ?? options?.service,
    rateLimitOverrides: options?.authRateLimitOverrides ?? options?.rateLimitOverrides,
  };
  router.use('/auth', createAuthRouter(authOptions));
  router.use('/weddings', createWeddingRouter({
    service: options?.weddingService,
    rateLimitOverrides: options?.weddingRateLimitOverrides ?? options?.rateLimitOverrides,
  }));
  router.use('/events', createEventRouter({ service: options?.eventService }));

  return router;
}

const router = createV1Router();
module.exports = router;
module.exports.createV1Router = createV1Router;
