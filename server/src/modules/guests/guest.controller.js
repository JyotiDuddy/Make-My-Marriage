const { sendSuccess } = require('../../shared/http/responses');

function createGuestController(service) {
  return {
    async create(req, res) {
      const result = await service.createGuest(req.authenticatedUser, req.body);
      return sendSuccess(res, { ...result.guest, warnings: result.warnings }, { message: 'Guest created successfully.', statusCode: 201 });
    },
    async list(req, res) {
      const result = await service.listGuests(req.authenticatedUser, req.query);
      return sendSuccess(res, result.guests, { message: 'Guests retrieved successfully.', pagination: result.pagination });
    },
    async get(req, res) {
      return sendSuccess(res, await service.getGuest(req.authenticatedUser, req.params.guestId));
    },
    async update(req, res) {
      const result = await service.updateGuest(req.authenticatedUser, req.params.guestId, req.body);
      return sendSuccess(res, { ...result.guest, warnings: result.warnings }, { message: 'Guest updated successfully.' });
    },
    async remove(req, res) {
      return sendSuccess(res, await service.deleteGuest(req.authenticatedUser, req.params.guestId), { message: 'Guest deleted successfully.' });
    },
    async shareCommonInvitation(req, res) {
      return sendSuccess(res, await service.updateCommonInvitationSharing(req.authenticatedUser, req.params.guestId, req.body), { message: 'Common invitation sharing status updated successfully.' });
    },
    async shareEventInvitation(req, res) {
      return sendSuccess(res, await service.updateEventInvitationSharing(req.authenticatedUser, req.params.guestId, req.params.eventId, req.body), { message: 'Event invitation sharing status updated successfully.' });
    },
    async import(req, res) {
      return sendSuccess(res, await service.importGuests(req.authenticatedUser, req.file), { message: 'Guest import completed.' });
    },
    async generateRsvpLink(req, res) {
      return sendSuccess(res, await service.generateRsvpLink(req.authenticatedUser, req.params.guestId), { message: 'RSVP link generated.' });
    },
  };
}

module.exports = { createGuestController };
