const mongoose = require('mongoose');
const path = require('node:path');
const ApiError = require('../../shared/errors/api-error');
const Wedding = require('../wedding/wedding.model');
const Event = require('../events/event.model');
const Invitation = require('./invitation.model');
const cloudinaryAdapter = require('../../shared/storage/cloudinary.adapter');
const { validateImageFile } = require('../wedding/image.validation');
const { validateInvitationInput, validateInvitationListQuery } = require('./invitation.validation');

function notFound(message = 'The Invitation or Event was not found.') {
  return new ApiError(404, 'NOT_FOUND', message);
}

function invalidImage() {
  return new ApiError(400, 'VALIDATION_ERROR', 'The image field is required.');
}

function cloudinaryFailure() {
  return new ApiError(
    502,
    'EXTERNAL_SERVICE_ERROR',
    'Image storage is unavailable. Configure the Cloudinary settings on the server.',
  );
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

function serializeInvitation(invitation) {
  return {
    id: invitation._id.toString(),
    type: invitation.type,
    ...(invitation.eventId ? { eventId: invitation.eventId.toString() } : {}),
    imageUrl: invitation.imageUrl,
    ...(invitation.fileName !== undefined ? { fileName: invitation.fileName } : {}),
    format: invitation.format,
    uploadedBy: invitation.uploadedBy.toString(),
    ...(invitation.updatedBy ? { updatedBy: invitation.updatedBy.toString() } : {}),
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
}

function createInvitationService({
  WeddingModel = Wedding,
  EventModel = Event,
  InvitationModel = Invitation,
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

  function invitationScope(weddingId, fields) {
    return fields.type === 'COMMON'
      ? { weddingId, type: 'COMMON' }
      : { weddingId, type: 'EVENT', eventId: fields.eventId };
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
      throw new ApiError(409, 'CONFLICT', 'The Event changed while its invitation was being saved. Please retry.');
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
    try {
      logger.error(JSON.stringify(record));
    } catch {
      // Cleanup failures must not change a completed database operation.
    }
  }

  async function deleteAsset(publicId, operation, weddingId) {
    if (!publicId) return;
    try {
      await cloudinary.deleteImage(publicId);
    } catch (error) {
      cleanupFailure(publicId, operation, weddingId, error);
    }
  }

  async function deleteAssetIfUnreferenced(publicId, operation, weddingId) {
    if (!publicId) return;
    if (await InvitationModel.exists({ storagePublicId: publicId })) return;
    await deleteAsset(publicId, operation, weddingId);
  }

  async function uploadAsset(file) {
    if (!file?.buffer?.length) throw invalidImage();
    const detected = await validateImageFile(file);
    if (cloudinary.isConfigured === false) throw cloudinaryFailure();
    try {
      const stored = await cloudinary.uploadImage({
        buffer: file.buffer,
        folder: 'make-my-marriage/invitations',
      });
      return { ...stored, format: detected.ext };
    } catch {
      throw cloudinaryFailure();
    }
  }

  async function validateRequest(user, file, body) {
    const fields = validateInvitationInput(body);
    if (!file?.buffer?.length) throw invalidImage();
    const wedding = await resolveWedding(user);
    if (fields.type === 'EVENT') await assertEventBelongsToWedding(wedding._id, fields.eventId);
    return { fields, wedding };
  }

  async function persistInvitation({ user, wedding, fields, image, file }) {
    const scope = invitationScope(wedding._id, fields);
    const update = {
      imageUrl: image.url,
      storagePublicId: image.publicId,
      format: image.format,
      updatedBy: user._id,
      ...(file.originalname ? { fileName: path.basename(file.originalname).slice(0, 255) } : {}),
    };

    async function save(session) {
      const options = { returnDocument: 'before', runValidators: true, ...(session ? { session } : {}) };
      const previous = await InvitationModel.findOneAndUpdate(scope, { $set: update }, options);
      if (previous) return { id: previous._id, previousPublicId: previous.storagePublicId };
      const document = {
        ...scope,
        ...update,
        uploadedBy: user._id,
      };
      const [created] = await InvitationModel.create([document], session ? { session } : {});
      return { id: created._id, previousPublicId: null };
    }

    let previous;
    if (fields.type === 'EVENT') {
      const session = await startSession();
      try {
        await session.withTransaction(async () => {
          await coordinateEventAssociation(wedding._id, fields.eventId, session);
          previous = await save(session);
        });
      } finally {
        await session.endSession();
      }
    } else {
      previous = await save();
    }
    return previous;
  }

  async function uploadInvitation(user, file, body) {
    const { fields, wedding } = await validateRequest(user, file, body);
    const image = await uploadAsset(file);
    let previous;
    try {
      previous = await persistInvitation({ user, wedding, fields, image, file });
    } catch (error) {
      await deleteAssetIfUnreferenced(
        image.publicId,
        'cleanup_new_invitation_after_database_failure',
        wedding._id,
      );
      if (isDuplicateKey(error)) throw new ApiError(409, 'CONFLICT', 'An invitation already exists for this Wedding or Event.');
      throw error;
    }

    await deleteAssetIfUnreferenced(
      previous?.previousPublicId,
      'delete_replaced_invitation',
      wedding._id,
    );
    const current = await InvitationModel.findById(previous.id);
    return serializeInvitation(current);
  }

  async function listInvitations(user, query) {
    const { page, limit } = validateInvitationListQuery(query);
    const wedding = await resolveWedding(user);
    const filter = { weddingId: wedding._id };
    const skip = (page - 1) * limit;
    const [invitations, totalRecords] = await Promise.all([
      InvitationModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
      InvitationModel.countDocuments(filter),
    ]);
    return {
      invitations: invitations.map(serializeInvitation),
      pagination: { page, limit, totalRecords, totalPages: Math.ceil(totalRecords / limit) },
    };
  }

  async function deleteInvitation(user, invitationId) {
    if (!mongoose.isValidObjectId(invitationId)) throw notFound('The Invitation was not found.');
    const wedding = await resolveWedding(user);
    const invitation = await InvitationModel.findOneAndDelete({ _id: invitationId, weddingId: wedding._id });
    if (!invitation) throw notFound('The Invitation was not found.');
    await deleteAssetIfUnreferenced(
      invitation.storagePublicId,
      'delete_invitation',
      wedding._id,
    );
    return { id: invitation._id.toString() };
  }

  return { listInvitations, uploadInvitation, deleteInvitation };
}

async function hasInvitationsForEvent(event, InvitationModel = Invitation) {
  return Boolean(await InvitationModel.exists({ weddingId: event.weddingId, eventId: event._id, type: 'EVENT' }));
}

module.exports = { createInvitationService, hasInvitationsForEvent, serializeInvitation };
