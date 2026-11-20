const { sendSuccess } = require('../../shared/http/responses');

function createDashboardController(service) {
  return {
    async getSummary(req, res) {
      const summary = await service.getSummary(req.authenticatedUser);
      return sendSuccess(res, summary, { message: 'Dashboard summary retrieved successfully.' });
    },
  };
}

module.exports = { createDashboardController };
