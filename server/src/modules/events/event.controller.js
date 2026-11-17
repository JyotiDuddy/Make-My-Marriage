const { sendSuccess } = require('../../shared/http/responses');

function createEventController(service) {
  return {
    async create(req, res) {
      return sendSuccess(res, await service.createEvent(req.authenticatedUser, req.body), {
        message: 'Event created successfully.',
        statusCode: 201,
      });
    },
    async list(req, res) {
      const result = await service.listEvents(req.authenticatedUser, req.query);
      return sendSuccess(res, result.events, {
        message: 'Events retrieved successfully.',
        pagination: result.pagination,
      });
    },
    async get(req, res) {
      return sendSuccess(res, await service.getEvent(req.authenticatedUser, req.params.eventId));
    },
    async update(req, res) {
      return sendSuccess(res, await service.updateEvent(req.authenticatedUser, req.params.eventId, req.body), {
        message: 'Event updated successfully.',
      });
    },
    async updateStatus(req, res) {
      return sendSuccess(res, await service.updateEventStatus(req.authenticatedUser, req.params.eventId, req.body), {
        message: 'Event status updated successfully.',
      });
    },
    async remove(req, res) {
      return sendSuccess(res, await service.deleteEvent(req.authenticatedUser, req.params.eventId), {
        message: 'Event deleted successfully.',
      });
    },
  };
}

module.exports = { createEventController };
