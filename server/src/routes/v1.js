const express = require('express');
const healthRouter = require('../modules/health/health.routes');
const { createAuthRouter } = require('../modules/auth/auth.routes');
const { createWeddingRouter } = require('../modules/wedding/wedding.routes');
const { createEventRouter } = require('../modules/events/event.routes');
const Task = require('../modules/tasks/task.model');
const { createEventService } = require('../modules/events/event.service');
const { createTaskRouter } = require('../modules/tasks/task.routes');
const { hasTasksForEvent } = require('../modules/tasks/task.service');
const Expense = require('../modules/expenses/expense.model');
const { createExpenseRouter } = require('../modules/expenses/expense.routes');
const { hasExpensesForEvent } = require('../modules/expenses/expense.service');
const Guest = require('../modules/guests/guest.model');
const { createGuestRouter } = require('../modules/guests/guest.routes');
const { hasGuestsForEvent } = require('../modules/guests/guest.service');
const Invitation = require('../modules/invitations/invitation.model');
const { createInvitationRouter } = require('../modules/invitations/invitation.routes');
const { hasInvitationsForEvent } = require('../modules/invitations/invitation.service');
const RSVP = require('../modules/rsvp/rsvp.model');
const { createRsvpRouter } = require('../modules/rsvp/rsvp.routes');
const { hasRsvpsForEvent } = require('../modules/rsvp/rsvp.service');
const { createDashboardRouter } = require('../modules/dashboard/dashboard.routes');
const { createAnnouncementRouter } = require('../modules/announcements/announcement.routes');
const Photo = require('../modules/photos/photo.model');
const { createPhotoRouter, createPublicPhotoRouter } = require('../modules/photos/photo.routes');
const { hasPhotosForEvent } = require('../modules/photos/photo.service');

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
  const eventService = options?.eventService ?? createEventService({
    eventDependencyChecks: [
      (event) => hasTasksForEvent(event, Task),
      (event) => hasExpensesForEvent(event, Expense),
      (event) => hasGuestsForEvent(event, Guest),
      (event) => hasInvitationsForEvent(event, Invitation),
      (event) => hasRsvpsForEvent(event, RSVP),
      (event) => hasPhotosForEvent(event, Photo),
    ],
  });
  router.use('/events', createEventRouter({ service: eventService }));
  router.use('/tasks', createTaskRouter({ service: options?.taskService }));
  router.use('/expenses', createExpenseRouter({ service: options?.expenseService }));
  router.use('/guests', createGuestRouter({ service: options?.guestService }));
  router.use('/invitations', createInvitationRouter({ service: options?.invitationService }));
  router.use('/public/rsvp', createRsvpRouter({
    service: options?.rsvpService,
    rateLimitOverrides: options?.rsvpRateLimitOverrides,
  }));
  router.use('/dashboard', createDashboardRouter({ service: options?.dashboardService }));
  router.use('/announcements', createAnnouncementRouter({ service: options?.announcementService }));
  router.use('/photos', createPhotoRouter({ service: options?.photoService }));
  router.use('/public/weddings', createPublicPhotoRouter({
    service: options?.photoService,
    rateLimitOverrides: options?.publicPhotoRateLimitOverrides,
  }));

  return router;
}

const router = createV1Router();
module.exports = router;
module.exports.createV1Router = createV1Router;
