const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const ApiError = require('../../shared/errors/api-error');
const config = require('../../config/env');
const User = require('../auth/user.model');
const Wedding = require('./wedding.model');
const emailAdapter = require('../auth/email.adapter');
const { hashToken } = require('../auth/auth.service');
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

function createWeddingService({
  UserModel = User,
  WeddingModel = Wedding,
  mailer = emailAdapter,
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
  };
}

const weddingService = createWeddingService();

module.exports = weddingService;
module.exports.createWeddingService = createWeddingService;
