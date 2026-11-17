const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const ApiError = require('../../shared/errors/api-error');
const config = require('../../config/env');
const User = require('../auth/user.model');
const Wedding = require('./wedding.model');
const emailAdapter = require('../auth/email.adapter');
const cloudinaryAdapter = require('../../shared/storage/cloudinary.adapter');
const { hashToken } = require('../auth/auth.service');
const {
  validateAltText,
  validateImageFile,
  validateOurStoryDescription,
} = require('./image.validation');
const {
  validateManagerInvitation,
  validatePublication,
  validateWeddingInput,
} = require('./wedding.validation');

function conflict(message) {
  return new ApiError(409, 'CONFLICT', message);
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

function publicManager(user) {
  return user ? {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    status: user.status,
  } : null;
}

function storyData(wedding) {
  return {
    ourStory: {
      description: wedding.ourStory?.description ?? '',
      images: (wedding.ourStory?.images ?? []).map((image) => ({
        id: image._id.toString(),
        url: image.url,
        altText: image.altText,
      })),
    },
  };
}

function cloudinaryFailure() {
  return new ApiError(
    502,
    'EXTERNAL_SERVICE_ERROR',
    'Image storage is unavailable. Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server.',
  );
}

function createWeddingService({
  UserModel = User,
  WeddingModel = Wedding,
  mailer = emailAdapter,
  cloudinary = cloudinaryAdapter,
  logger = console,
  now = () => new Date(),
  activationTokenTtlMs = config.managerActivationTokenTtlMs,
  startSession = () => mongoose.startSession(),
} = {}) {
  async function findWeddingForUser(user) {
    const ownership = user.role === 'ADMIN'
      ? { adminId: user._id }
      : { managerId: user._id };
    const wedding = await WeddingModel.findOne(ownership);
    if (!wedding) throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');
    return wedding;
  }

  async function toManagementData(wedding) {
    const manager = wedding.managerId
      ? await UserModel.findById(wedding.managerId).select('name email status')
      : null;

    return {
      wedding: {
        id: wedding._id.toString(),
        title: wedding.title,
        partnerOneName: wedding.partnerOneName,
        partnerTwoName: wedding.partnerTwoName,
        weddingDate: wedding.weddingDate,
        timeZone: wedding.timeZone,
        ...(wedding.introduction !== undefined ? { introduction: wedding.introduction } : {}),
        ...(wedding.coverImage ? {
          coverImage: { url: wedding.coverImage.url, publicId: wedding.coverImage.publicId },
        } : {}),
        ...(wedding.ourStory ? {
          ourStory: {
            description: wedding.ourStory.description,
            images: wedding.ourStory.images.map((image) => ({
              id: image._id.toString(),
              url: image.url,
              publicId: image.publicId,
              altText: image.altText,
            })),
          },
        } : {}),
        slug: wedding.slug,
        websitePublished: wedding.websitePublished,
        publishedAt: wedding.publishedAt ?? null,
        manager: publicManager(manager),
      },
    };
  }

  async function createWedding(user, body) {
    const fields = validateWeddingInput(body);
    if (await WeddingModel.exists({ adminId: user._id })) {
      throw conflict('This Admin already has a Wedding.');
    }

    try {
      const wedding = await WeddingModel.create({
        ...fields,
        adminId: user._id,
        managerId: null,
        websitePublished: false,
      });
      return toManagementData(wedding);
    } catch (error) {
      if (isDuplicateKey(error)) {
        if (error.keyPattern?.slug || Object.hasOwn(error.keyValue ?? {}, 'slug')) {
          throw conflict('This Wedding slug is already in use.');
        }
        throw conflict('This Admin already has a Wedding.');
      }
      throw error;
    }
  }

  async function getMyWedding(user) {
    return toManagementData(await findWeddingForUser(user));
  }

  async function updateMyWedding(user, body) {
    const fields = validateWeddingInput(body, { partial: true });
    let wedding;
    try {
      wedding = await WeddingModel.findOneAndUpdate(
        { adminId: user._id },
        { $set: fields },
        { returnDocument: 'after', runValidators: true },
      );
    } catch (error) {
      if (isDuplicateKey(error)) throw conflict('This Wedding slug is already in use.');
      throw error;
    }
    if (!wedding) throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');
    return toManagementData(wedding);
  }

  async function updatePublication(user, body) {
    const websitePublished = validatePublication(body);
    const publishedAt = websitePublished ? now() : null;
    const wedding = await WeddingModel.findOneAndUpdate(
      { adminId: user._id },
      { $set: { websitePublished, publishedAt } },
      { returnDocument: 'after', runValidators: true },
    );
    if (!wedding) throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');
    return { wedding: { id: wedding._id.toString(), websitePublished, publishedAt } };
  }

  function recordCleanupFailure(publicId, operation, weddingId, error) {
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
      // Cleanup logging must not change the already-committed MongoDB result.
    }
  }

  async function deleteAsset(publicId, operation, weddingId) {
    if (!publicId) return;
    try {
      await cloudinary.deleteImage(publicId);
    } catch (error) {
      recordCleanupFailure(publicId, operation, weddingId, error);
    }
  }

  async function deleteNewAsset(publicId, operation, weddingId) {
    try {
      await cloudinary.deleteImage(publicId);
    } catch (error) {
      recordCleanupFailure(publicId, operation, weddingId, error);
    }
  }

  async function uploadAsset(file, folder) {
    await validateImageFile(file);
    if (cloudinary.isConfigured === false) throw cloudinaryFailure();
    try {
      return await cloudinary.uploadImage({ buffer: file.buffer, folder });
    } catch {
      throw cloudinaryFailure();
    }
  }

  async function uploadCoverImage(user, file) {
    const currentWedding = await WeddingModel.findOne({ adminId: user._id }).select('_id');
    if (!currentWedding) throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');

    const image = await uploadAsset(file, 'make-my-marriage/wedding-covers');
    let previousWedding;
    try {
      previousWedding = await WeddingModel.findOneAndUpdate(
        { _id: currentWedding._id, adminId: user._id },
        { $set: { coverImage: image } },
        { returnDocument: 'before', runValidators: true },
      );
    } catch (error) {
      await deleteNewAsset(image.publicId, 'cleanup_new_cover_after_database_failure', currentWedding._id);
      throw error;
    }

    if (!previousWedding) {
      await deleteNewAsset(image.publicId, 'cleanup_new_cover_after_database_failure', currentWedding._id);
      throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');
    }

    await deleteAsset(previousWedding.coverImage?.publicId, 'delete_replaced_cover', previousWedding._id);
    return { coverImage: { url: image.url } };
  }

  async function deleteCoverImage(user) {
    const wedding = await WeddingModel.findOneAndUpdate(
      { adminId: user._id },
      { $unset: { coverImage: 1 } },
      { returnDocument: 'before', runValidators: true },
    );
    if (!wedding) throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');

    await deleteAsset(wedding.coverImage?.publicId, 'delete_cover', wedding._id);
    return { coverImage: null };
  }

  async function updateOurStory(user, body) {
    const description = validateOurStoryDescription(body);
    const wedding = await WeddingModel.findOneAndUpdate(
      { adminId: user._id },
      { $set: { 'ourStory.description': description } },
      { returnDocument: 'after', runValidators: true },
    );
    if (!wedding) throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');
    return storyData(wedding);
  }

  async function uploadOurStoryImage(user, file, body) {
    const altText = validateAltText(body);
    const currentWedding = await WeddingModel.findOne({ adminId: user._id }).select('_id');
    if (!currentWedding) throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');

    const image = await uploadAsset(file, 'make-my-marriage/our-story');
    let wedding;
    try {
      wedding = await WeddingModel.findOneAndUpdate(
        {
          _id: currentWedding._id,
          adminId: user._id,
          'ourStory.images.1': { $exists: false },
        },
        {
          $push: {
            'ourStory.images': {
              url: image.url,
              publicId: image.publicId,
              altText,
            },
          },
        },
        { returnDocument: 'after', runValidators: true },
      );
    } catch (error) {
      await deleteNewAsset(image.publicId, 'cleanup_new_story_image_after_database_failure', currentWedding._id);
      throw error;
    }

    if (!wedding) {
      await deleteNewAsset(image.publicId, 'cleanup_excess_story_image_after_concurrent_upload', currentWedding._id);
      const stillExists = await WeddingModel.exists({ _id: currentWedding._id, adminId: user._id });
      if (!stillExists) throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');
      throw new ApiError(409, 'STORY_IMAGE_LIMIT_REACHED', 'A Wedding can have at most two Our Story images.');
    }

    const storedImage = wedding.ourStory.images.at(-1);
    return {
      image: {
        id: storedImage._id.toString(),
        url: storedImage.url,
        altText: storedImage.altText,
      },
    };
  }

  async function deleteOurStoryImage(user, imageId) {
    if (!mongoose.isValidObjectId(imageId)) {
      throw new ApiError(404, 'NOT_FOUND', 'The Our Story image was not found.');
    }

    const wedding = await WeddingModel.findOne({
      adminId: user._id,
      'ourStory.images._id': imageId,
    }).select('_id ourStory.description ourStory.images');
    if (!wedding) throw new ApiError(404, 'NOT_FOUND', 'The Our Story image was not found.');

    const image = wedding.ourStory.images.id(imageId);
    const updatedWedding = await WeddingModel.findOneAndUpdate(
      {
        _id: wedding._id,
        adminId: user._id,
        'ourStory.images._id': imageId,
      },
      { $pull: { 'ourStory.images': { _id: imageId } } },
      { returnDocument: 'after', runValidators: true },
    );
    if (!updatedWedding) throw new ApiError(404, 'NOT_FOUND', 'The Our Story image was not found.');

    await deleteAsset(image.publicId, 'delete_story_image', wedding._id);
    return storyData(updatedWedding);
  }

  async function deliverInvitation(manager, token, expiresAt) {
    try {
      await mailer.sendManagerInvitationEmail({
        managerId: manager._id,
        to: manager.email,
        name: manager.name,
        token,
        expiresAt,
      });
      return true;
    } catch {
      return false;
    }
  }

  async function inviteManager(user, body) {
    const { name, email } = validateManagerInvitation(body);
    let manager;
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(now().getTime() + activationTokenTtlMs);
    const transaction = await startSession();

    try {
      await transaction.withTransaction(async () => {
        const wedding = await WeddingModel.findOne({ adminId: user._id }).session(transaction);
        if (!wedding) throw new ApiError(404, 'NOT_FOUND', 'Create a Wedding before inviting a Manager.');
        if (wedding.managerId) throw conflict('This Wedding already has a designated Manager.');

        const existingUser = await UserModel.exists({ email }).session(transaction);
        if (existingUser) throw conflict('An account with this email already exists.');

        const [createdManager] = await UserModel.create([{
          name,
          email,
          role: 'MANAGER',
          status: 'INVITED',
          activationTokenHash: tokenHash,
          activationExpiresAt: expiresAt,
        }], { session: transaction });

        const assignment = await WeddingModel.updateOne(
          {
            _id: wedding._id,
            adminId: user._id,
            $or: [{ managerId: null }, { managerId: { $exists: false } }],
          },
          { $set: { managerId: createdManager._id } },
          { session: transaction },
        );
        if (assignment.modifiedCount !== 1) {
          throw conflict('This Wedding already has a designated Manager.');
        }
        manager = createdManager;
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isDuplicateKey(error)) throw conflict('An account with this email already exists.');
      throw error;
    } finally {
      await transaction.endSession();
    }

    const emailDelivered = await deliverInvitation(manager, token, expiresAt);
    return { manager: publicManager(manager), emailDelivered };
  }

  async function resendManagerInvitation(user) {
    const wedding = await WeddingModel.findOne({ adminId: user._id });
    if (!wedding) throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');
    if (!wedding.managerId) throw conflict('There is no invited Manager to resend.');

    const manager = await UserModel.findOne({
      _id: wedding.managerId,
      role: 'MANAGER',
      status: 'INVITED',
    }).select('name email status activationTokenHash');
    if (!manager?.activationTokenHash) throw conflict('There is no invited Manager to resend.');

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now().getTime() + activationTokenTtlMs);
    const updatedManager = await UserModel.findOneAndUpdate(
      {
        _id: manager._id,
        role: 'MANAGER',
        status: 'INVITED',
        activationTokenHash: manager.activationTokenHash,
      },
      {
        $set: {
          activationTokenHash: hashToken(token),
          activationExpiresAt: expiresAt,
        },
      },
      { returnDocument: 'after', runValidators: true },
    );
    if (!updatedManager) throw conflict('There is no invited Manager to resend.');

    const emailDelivered = await deliverInvitation(updatedManager, token, expiresAt);
    return { manager: publicManager(updatedManager), emailDelivered };
  }

  return {
    createWedding,
    getMyWedding,
    inviteManager,
    resendManagerInvitation,
    updateMyWedding,
    updatePublication,
    uploadCoverImage,
    deleteCoverImage,
    updateOurStory,
    uploadOurStoryImage,
    deleteOurStoryImage,
  };
}

const weddingService = createWeddingService();

module.exports = weddingService;
module.exports.createWeddingService = createWeddingService;
