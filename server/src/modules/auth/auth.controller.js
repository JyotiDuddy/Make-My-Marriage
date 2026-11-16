const { generateToken } = require('csrf-sync').csrfSync();
const config = require('../../config/env');
const { sendSuccess } = require('../../shared/http/responses');

function createAuthController(service) {
  return {
    csrf(req, res) {
      return sendSuccess(res, { csrfToken: generateToken(req) }, { message: 'CSRF token issued.' });
    },

    async register(req, res) {
      const data = await service.register(req.body, req);
      return sendSuccess(res, data, {
        message: 'Account registered successfully',
        statusCode: 201,
      });
    },

    async login(req, res) {
      const data = await service.login(req.body, req);
      return sendSuccess(res, data, { message: 'Login successful.' });
    },

    async logout(req, res, next) {
      req.session.destroy((error) => {
        if (error) {
          next(error);
          return;
        }

        res.clearCookie(config.sessionCookieName, {
          httpOnly: true,
          secure: config.nodeEnv === 'production',
          sameSite: config.sessionCookieSameSite,
          path: '/',
        });
        res.status(204).end();
      });
    },

    async me(req, res) {
      const data = await service.getCurrentUser(req.authenticatedUser._id);
      return sendSuccess(res, data);
    },

    async forgotPassword(req, res) {
      const { message } = await service.forgotPassword(req.body);
      return sendSuccess(res, {}, { message });
    },

    async resetPassword(req, res) {
      const { message } = await service.resetPassword(req.body);
      return sendSuccess(res, {}, { message });
    },

    async activateManager(req, res) {
      const data = await service.activateManager(req.body, req);
      return sendSuccess(res, data, { message: 'Manager account activated successfully.' });
    },
  };
}

module.exports = { createAuthController };
