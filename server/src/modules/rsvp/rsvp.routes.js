const express = require('express');
const config = require('../../config/env');
const createRateLimiter = require('../../middleware/rate-limiter');
const { createRsvpService } = require('./rsvp.service');
const { createRsvpController } = require('./rsvp.controller');

function createRsvpRouter({ service = createRsvpService(), rateLimitOverrides = {} } = {}) {
  const router = express.Router();
  const controller = createRsvpController(service);
  const limits = { ...config.publicRsvpRateLimits, ...rateLimitOverrides };
  const protect = (limit) => createRateLimiter(limit, 'Too many RSVP requests. Try again later.', config.publicRsvpRateLimitWindowMs);

  router.use((req, res, next) => {
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  router.get('/:token', protect(limits.get), controller.get);
  router.put('/:token/events/:eventId', protect(limits.put), controller.put);
  return router;
}

module.exports = { createRsvpRouter };
