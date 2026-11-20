const mongoose = require('mongoose');
const ApiError = require('../../shared/errors/api-error');
const Wedding = require('../wedding/wedding.model');
const Event = require('../events/event.model');
const Photo = require('./photo.model');
const cloudinaryAdapter = require('../../shared/storage/cloudinary.adapter');
const { validateImageFile } = require('../wedding/image.validation');
const {
  validatePhotoId,
  validatePhotoListQuery,
  validateReviewBody,
  validateUploadFields,
} = require('./photo.validation');

function notFound(message = 'The Photo was not found.') {
  return new ApiError(404, 'NOT_FOUND', message);
}

function cloudinaryFailure() {
  return new ApiError(502, 'EXTERNAL_SERVICE_ERROR', 'Image storage is unavailable. Configure the Cloudinary settings on the server.');
}

function serializePhoto(photo) {
  return {
    id: photo._id.toString(),
    ...(photo.eventId ? { eventId: photo.eventId.toString() } : {}),
    imageUrl: photo.imageUrl,
    uploadedByType: photo.uploadedByType,
    ...(photo.uploadedByUserId ? { uploadedByUserId: photo.uploadedByUserId.toString() } : {}),
    status: photo.status,
    ...(photo.reviewedBy ? { reviewedBy: photo.reviewedBy.toString() } : {}),
    ...(photo.reviewedAt ? { reviewedAt: photo.reviewedAt } : {}),
    createdAt: photo.createdAt,
    updatedAt: photo.updatedAt,
  };
}

function serializePublicPhoto(photo) {
  return {
    id: photo._id.toString(),
    ...(photo.eventId ? { eventId: photo.eventId.toString() } : {}),
    imageUrl: photo.imageUrl,
    createdAt: photo.createdAt,
  };
}

function createPhotoService({
  WeddingModel = Wedding,
  EventModel = Event,
  PhotoModel = Photo,
  cloudinary = cloudinaryAdapter,
  logger = console,
  startSession = () => mongoose.startSession(),
  now = () => new Date(),
} = {}) {
  async function resolveWedding(user) {
    const ownership = user.role === 'ADMIN' ? { adminId: user._id } : { managerId: user._id };
    const wedding = await WeddingModel.findOne(ownership).select('_id');
    if (!wedding) throw notFound('The Wedding was not found.');
    return wedding;
  }

  async function resolvePublishedWedding(slug) {
    const wedding = await WeddingModel.findOne({ slug, websitePublished: true }).select('_id');
    if (!wedding) throw notFound('The public Wedding was not found.');
    return wedding;
  }

  function weddingPhotoFilter(weddingId, photoId) {
    validatePhotoId(photoId);
    return { _id: photoId, weddingId };
  }

  async function assertEventBelongsToWedding(weddingId, eventId, session) {
    if (!mongoose.isValidObjectId(eventId)) throw new ApiError(400, 'VALIDATION_ERROR', 'eventId must be a valid Event ID.');
    const filter = { _id: eventId, weddingId, deletedAt: { $exists: false } };
    let query = EventModel.findOne(filter).select('_id updatedAt');
    if (session) query = query.session(session);
    const event = await query;
    if (!event) throw notFound('The Event was not found in this Wedding.');
    return { filter, event };
  }

  async function coordinateEventAssociation(weddingId, eventId, session) {
    const { filter, event } = await assertEventBelongsToWedding(weddingId, eventId, session);
    const nextUpdatedAt = new Date(Math.max(now().getTime(), event.updatedAt.getTime() + 1));
    const result = await EventModel.updateOne(
      { ...filter, updatedAt: event.updatedAt },
      { $set: { updatedAt: nextUpdatedAt } },
      { session, timestamps: false },
    );
    if (result.modifiedCount !== 1) {
      throw new ApiError(409, 'CONFLICT', 'The Event changed while the Photo was being saved. Please retry.');
    }
  }

  function cleanupFailure(publicId, operation, weddingId, error) {
    const record = {
      level: 'error',
      event: 'cloudinary_cleanup_failed',
      operation,
      publicId,
      weddingId: weddingId?.toString(),
      errorCode: error?.http_code ?? error?.code ?? error?.name ?? 'UNKNOWN',
    };
    try { logger.error(JSON.stringify(record)); } catch { /* Cleanup logging cannot change the request outcome. */ }
  }

  async function deleteAsset(publicId, operation, weddingId) {
    if (!publicId) return;
    try { await cloudinary.deleteImage(publicId); } catch (error) { cleanupFailure(publicId, operation, weddingId, error); }
  }

  async function deleteAssetIfUnreferenced(publicId, operation, weddingId) {
    if (!publicId || await PhotoModel.exists({ storagePublicId: publicId })) return;
    await deleteAsset(publicId, operation, weddingId);
  }

  async function uploadAsset(file) {
    await validateImageFile(file);
    if (cloudinary.isConfigured === false) throw cloudinaryFailure();
    try {
      const stored = await cloudinary.uploadImage({ buffer: file.buffer, folder: 'make-my-marriage/photos' });
      return stored;
    } catch {
      throw cloudinaryFailure();
    }
  }

  async function persistPhoto({ wedding, eventId, image, uploaderType, uploadedByUserId, status }) {
    const photoFields = {
      weddingId: wedding._id,
      ...(eventId ? { eventId } : {}),
      imageUrl: image.url,
      storagePublicId: image.publicId,
      uploadedByType: uploaderType,
      ...(uploadedByUserId ? { uploadedByUserId } : {}),
      status,
    };

    if (!eventId) return PhotoModel.create(photoFields);

    const session = await startSession();
    let created;
    try {
      await session.withTransaction(async () => {
        await coordinateEventAssociation(wedding._id, eventId, session);
        [created] = await PhotoModel.create([photoFields], { session });
      });
    } finally {
      await session.endSession();
    }
    return created;
  }

  async function uploadOrganizerPhoto(user, file, body) {
    const fields = validateUploadFields(body);
    if (!file?.buffer?.length) throw new ApiError(400, 'VALIDATION_ERROR', 'The image field is required.');
    const wedding = await resolveWedding(user);
    if (fields.eventId) await assertEventBelongsToWedding(wedding._id, fields.eventId);
    const image = await uploadAsset(file);
    let photo;
    try {
      photo = await persistPhoto({
        wedding,
        eventId: fields.eventId,
        image,
        uploaderType: user.role,
        uploadedByUserId: user._id,
        status: 'APPROVED',
      });
    } catch (error) {
      await deleteAssetIfUnreferenced(image.publicId, 'cleanup_new_photo_after_database_failure', wedding._id);
      throw error;
    }
    return serializePhoto(photo);
  }

  async function submitGuestPhoto(slug, file, body) {
    const fields = validateUploadFields(body);
    if (!file?.buffer?.length) throw new ApiError(400, 'VALIDATION_ERROR', 'The image field is required.');
    const wedding = await resolvePublishedWedding(slug);
    if (fields.eventId) await assertEventBelongsToWedding(wedding._id, fields.eventId);
    const image = await uploadAsset(file);
    try {
      await persistPhoto({
        wedding,
        eventId: fields.eventId,
        image,
        uploaderType: 'GUEST',
        status: 'PENDING',
      });
    } catch (error) {
      await deleteAssetIfUnreferenced(image.publicId, 'cleanup_new_guest_photo_after_database_failure', wedding._id);
      throw error;
    }
    return { status: 'PENDING' };
  }

  async function listPhotos(user, query) {
    const filters = validatePhotoListQuery(query);
    const wedding = await resolveWedding(user);
    const filter = { weddingId: wedding._id };
    if (filters.status) filter.status = filters.status;
    if (filters.eventId) filter.eventId = filters.eventId;
    const skip = (filters.page - 1) * filters.limit;
    const [photos, totalRecords] = await Promise.all([
      PhotoModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(filters.limit),
      PhotoModel.countDocuments(filter),
    ]);
    return {
      photos: photos.map(serializePhoto),
      pagination: { page: filters.page, limit: filters.limit, totalRecords, totalPages: Math.ceil(totalRecords / filters.limit) },
    };
  }

  async function getPhoto(user, photoId) {
    const wedding = await resolveWedding(user);
    const photo = await PhotoModel.findOne(weddingPhotoFilter(wedding._id, photoId));
    if (!photo) throw notFound();
    return serializePhoto(photo);
  }

  async function reviewPhoto(user, photoId, body) {
    const status = validateReviewBody(body);
    const wedding = await resolveWedding(user);
    const filter = weddingPhotoFilter(wedding._id, photoId);
    const photo = await PhotoModel.findOneAndUpdate(
      { ...filter, uploadedByType: 'GUEST', status: 'PENDING' },
      { $set: { status, reviewedBy: user._id, reviewedAt: now() } },
      { returnDocument: 'after', runValidators: true },
    );
    if (photo) return serializePhoto(photo);
    const existing = await PhotoModel.exists(filter);
    if (!existing) throw notFound();
    throw new ApiError(409, 'CONFLICT', 'Only pending guest submissions can be reviewed.');
  }

  async function deletePhoto(user, photoId) {
    const wedding = await resolveWedding(user);
    const photo = await PhotoModel.findOneAndDelete(weddingPhotoFilter(wedding._id, photoId));
    if (!photo) throw notFound();
    await deleteAssetIfUnreferenced(photo.storagePublicId, 'delete_photo', wedding._id);
    return { id: photo._id.toString() };
  }

  async function listApprovedPhotosForPublic(weddingId) {
    const photos = await PhotoModel.find({ weddingId, status: 'APPROVED' })
      .select('_id eventId imageUrl createdAt')
      .sort({ createdAt: -1, _id: -1 });
    return photos.map(serializePublicPhoto);
  }

  return { listPhotos, getPhoto, uploadOrganizerPhoto, submitGuestPhoto, reviewPhoto, deletePhoto, listApprovedPhotosForPublic };
}

async function hasPhotosForEvent(event, PhotoModel = Photo) {
  return Boolean(await PhotoModel.exists({ weddingId: event.weddingId, eventId: event._id }));
}

module.exports = { createPhotoService, hasPhotosForEvent, serializePhoto, serializePublicPhoto };
