const { sendError, sendSuccess } = require('../../shared/http/responses');

function emailFailure(res, operation) {
  const description = operation === 'invite' ? 'created' : 'updated';
  return sendError(res, {
    statusCode: 502,
    message: `The Manager invitation was ${description}, but email delivery failed. Use the resend endpoint to try again.`,
    code: 'EXTERNAL_SERVICE_ERROR',
  });
}

function createWeddingController(service) {
  return {
    async create(req, res) {
      const data = await service.createWedding(req.authenticatedUser, req.body);
      return sendSuccess(res, data, { message: 'Wedding created successfully.', statusCode: 201 });
    },

    async getMe(req, res) {
      return sendSuccess(res, await service.getMyWedding(req.authenticatedUser));
    },

    async updateMe(req, res) {
      return sendSuccess(res, await service.updateMyWedding(req.authenticatedUser, req.body), {
        message: 'Wedding updated successfully.',
      });
    },

    async updatePublication(req, res) {
      return sendSuccess(res, await service.updatePublication(req.authenticatedUser, req.body), {
        message: 'Wedding publication status updated successfully.',
      });
    },

    async inviteManager(req, res) {
      const result = await service.inviteManager(req.authenticatedUser, req.body);
      if (!result.emailDelivered) return emailFailure(res, 'invite');
      return sendSuccess(res, { manager: result.manager }, {
        message: 'Manager invitation sent successfully.',
        statusCode: 201,
      });
    },

    async resendManagerInvitation(req, res) {
      const result = await service.resendManagerInvitation(req.authenticatedUser);
      if (!result.emailDelivered) return emailFailure(res, 'resend');
      return sendSuccess(res, { manager: result.manager }, {
        message: 'Manager invitation resent successfully.',
      });
    },
  };
}

module.exports = { createWeddingController };
