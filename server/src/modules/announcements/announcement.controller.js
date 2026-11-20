const { sendSuccess } = require('../../shared/http/responses');

function createAnnouncementController(service) {
  return {
    async create(req, res) {
      return sendSuccess(res, await service.createAnnouncement(req.authenticatedUser, req.body), {
        message: 'Announcement created successfully.',
        statusCode: 201,
      });
    },
    async list(req, res) {
      const result = await service.listAnnouncements(req.authenticatedUser, req.query);
      return sendSuccess(res, result.announcements, {
        message: 'Announcements retrieved successfully.',
        pagination: result.pagination,
      });
    },
    async get(req, res) {
      return sendSuccess(res, await service.getAnnouncement(req.authenticatedUser, req.params.announcementId));
    },
    async update(req, res) {
      return sendSuccess(res, await service.updateAnnouncement(req.authenticatedUser, req.params.announcementId, req.body), {
        message: 'Announcement updated successfully.',
      });
    },
    async remove(req, res) {
      return sendSuccess(res, await service.deleteAnnouncement(req.authenticatedUser, req.params.announcementId), {
        message: 'Announcement deleted successfully.',
      });
    },
  };
}

module.exports = { createAnnouncementController };
