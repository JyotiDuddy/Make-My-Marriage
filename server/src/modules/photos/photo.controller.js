const { sendSuccess } = require('../../shared/http/responses');

function createPhotoController(service) {
  return {
    async list(req, res) {
      const result = await service.listPhotos(req.authenticatedUser, req.query);
      return sendSuccess(res, result.photos, { pagination: result.pagination });
    },
    async get(req, res) {
      return sendSuccess(res, await service.getPhoto(req.authenticatedUser, req.params.photoId));
    },
    async upload(req, res) {
      const photo = await service.uploadOrganizerPhoto(req.authenticatedUser, req.file, req.body);
      return sendSuccess(res, photo, { message: 'Photo uploaded successfully.', statusCode: 201 });
    },
    async submitGuest(req, res) {
      const result = await service.submitGuestPhoto(req.params.slug, req.file, req.body);
      return sendSuccess(res, result, { message: 'Photo submitted for review.', statusCode: 201 });
    },
    async review(req, res) {
      return sendSuccess(res, await service.reviewPhoto(req.authenticatedUser, req.params.photoId, req.body), {
        message: 'Photo reviewed successfully.',
      });
    },
    async remove(req, res) {
      return sendSuccess(res, await service.deletePhoto(req.authenticatedUser, req.params.photoId), {
        message: 'Photo deleted successfully.',
      });
    },
  };
}

module.exports = { createPhotoController };
