const { sendSuccess } = require('../../shared/http/responses');

function createInvitationController(service) {
  return {
    list: async (req, res) => {
      const result = await service.listInvitations(req.authenticatedUser, req.query);
      return sendSuccess(res, result.invitations, { pagination: result.pagination });
    },
    upload: async (req, res) => {
      const invitation = await service.uploadInvitation(req.authenticatedUser, req.file, req.body);
      return sendSuccess(res, invitation, { message: 'Invitation uploaded successfully', statusCode: 201 });
    },
    remove: async (req, res) => {
      const result = await service.deleteInvitation(req.authenticatedUser, req.params.invitationId);
      return sendSuccess(res, result, { message: 'Invitation removed successfully' });
    },
  };
}

module.exports = { createInvitationController };
