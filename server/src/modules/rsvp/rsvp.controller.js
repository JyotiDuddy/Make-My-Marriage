const { sendSuccess } = require('../../shared/http/responses');

function createRsvpController(service) {
  return {
    async get(req, res) {
      res.set('Referrer-Policy', 'no-referrer');
      return sendSuccess(res, await service.getFamilyRsvp(req.params.token), { message: 'Family RSVP retrieved successfully.' });
    },
    async put(req, res) {
      res.set('Referrer-Policy', 'no-referrer');
      return sendSuccess(res, await service.submitRsvp(req.params.token, req.params.eventId, req.body), { message: 'RSVP response saved' });
    },
  };
}

module.exports = { createRsvpController };
