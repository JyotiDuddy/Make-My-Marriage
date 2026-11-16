const { createHash, randomBytes } = require('node:crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const ApiError = require('../../shared/errors/api-error');
const config = require('../../config/env');
const User = require('./user.model');
const Wedding = require('../wedding/wedding.model');
const emailAdapter = require('./email.adapter');
const { invalidateUserSessions } = require('../../config/session');

const GENERIC_RESET_MESSAGE = 'If an account exists, reset instructions will be sent when email delivery is available.';

function hashResetToken(token) {
  return hashToken(token);
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function publicUser(user, weddingId) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    ...(weddingId ? { weddingId: weddingId.toString() } : {}),
  };
}

function isDuplicateEmail(error) {
  return error?.code === 11000 && (
    error.keyPattern?.email === 1
    || Object.hasOwn(error.keyValue ?? {}, 'email')
  );
}

function authenticationError() {
  return new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password.');
}

function tokenError(statusCode, code, message) {
  return new ApiError(statusCode, code, message);
}

function sessionMethod(req, method) {
  return new Promise((resolve, reject) => {
    req.session[method]((error) => (error ? reject(error) : resolve()));
  });
}

async function establishSession(req, user) {
  await sessionMethod(req, 'regenerate');
  req.session.userId = user._id.toString();
  req.session.role = user.role;
  await sessionMethod(req, 'save');
}

function createAuthService({
  UserModel = User,
  WeddingModel = Wedding,
  mailer = emailAdapter,
  now = () => new Date(),
  resetTokenTtlMs = config.passwordResetTokenTtlMs,
  saltRounds = config.bcryptSaltRounds,
  invalidateSessions = invalidateUserSessions,
} = {}) {
  async function register(body, req) {
    const { name, email, password } = require('./auth.validation').validateRegistration(body);
    const existing = await UserModel.exists({ email });
    if (existing) {
      throw new ApiError(409, 'CONFLICT', 'An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);
    let user;

    try {
      user = await UserModel.create({
        name,
        email,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        activatedAt: now(),
      });
    } catch (error) {
      if (isDuplicateEmail(error)) {
        throw new ApiError(409, 'CONFLICT', 'An account with this email already exists.');
      }
      throw error;
    }

    await establishSession(req, user);

    return {
      user: publicUser(user),
      onboardingRequired: true,
    };
  }

  async function login(body, req) {
    const { email, password } = require('./auth.validation').validateLogin(body);
    const user = await UserModel.findOne({ email }).select('+passwordHash');
    const passwordMatches = user?.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : (await bcrypt.hash(password, saltRounds), false);

    if (!user || !passwordMatches || user.status !== 'ACTIVE') {
      throw authenticationError();
    }

    await establishSession(req, user);
    return { user: publicUser(user) };
  }

  async function getCurrentUser(userId) {
    const user = await UserModel.findById(userId).select('name email role status');
    if (!user || user.status !== 'ACTIVE') {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
    }

    const weddingFilter = user.role === 'ADMIN'
      ? { adminId: user._id }
      : { managerId: user._id };
    const wedding = await WeddingModel.findOne(weddingFilter).select('_id');

    return { user: publicUser(user, wedding?._id) };
  }

  async function forgotPassword(body) {
    const { email } = require('./auth.validation').validateForgotPassword(body);
    const user = await UserModel.findOne({ email, status: 'ACTIVE' }).select('name email role');

    if (!user || !mailer.isConfigured) {
      return { message: GENERIC_RESET_MESSAGE };
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(now().getTime() + resetTokenTtlMs);

    await UserModel.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
        },
      },
    );

    try {
      await mailer.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        token,
      });
    } catch {
      await UserModel.updateOne(
        { _id: user._id, passwordResetTokenHash: tokenHash },
        { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } },
      );
    }

    return { message: GENERIC_RESET_MESSAGE };
  }

  async function resetPassword(body) {
    const { token, newPassword } = require('./auth.validation').validateResetPassword(body);
    const tokenHash = hashResetToken(token);
    const nowValue = now();
    const candidate = await UserModel.findOne({ passwordResetTokenHash: tokenHash })
      .select('_id passwordResetExpiresAt');

    if (!candidate) {
      throw tokenError(400, 'TOKEN_INVALID', 'The password reset token is invalid.');
    }

    if (!candidate.passwordResetExpiresAt || candidate.passwordResetExpiresAt <= nowValue) {
      throw tokenError(410, 'TOKEN_EXPIRED', 'The password reset token has expired.');
    }

    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    const databaseSession = await mongoose.startSession();

    try {
      await databaseSession.withTransaction(async () => {
        const user = await UserModel.findOneAndUpdate(
          {
            _id: candidate._id,
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: { $gt: nowValue },
          },
          {
            $set: { passwordHash },
            $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
          },
          { returnDocument: 'after', runValidators: true, session: databaseSession },
        );

        if (!user) {
          throw tokenError(400, 'TOKEN_INVALID', 'The password reset token is invalid.');
        }

        await invalidateSessions(user._id, databaseSession);
      });
    } finally {
      await databaseSession.endSession();
    }

    return { message: 'Password reset successfully. Please log in with your new password.' };
  }

  async function activateManager(body, req) {
    const { token, password } = require('./auth.validation').validateManagerActivation(body);
    const tokenHash = hashToken(token);
    const nowValue = now();
    const candidate = await UserModel.findOne({
      activationTokenHash: tokenHash,
      role: 'MANAGER',
    }).select('status activationExpiresAt');

    if (!candidate || candidate.status !== 'INVITED') {
      throw tokenError(400, 'TOKEN_INVALID', 'The Manager activation token is invalid.');
    }
    if (!candidate.activationExpiresAt || candidate.activationExpiresAt <= nowValue) {
      throw tokenError(410, 'TOKEN_EXPIRED', 'The Manager activation token has expired.');
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);
    const consumedAt = now();
    const manager = await UserModel.findOneAndUpdate(
      {
        activationTokenHash: tokenHash,
        role: 'MANAGER',
        status: 'INVITED',
        activationExpiresAt: { $gt: consumedAt },
      },
      {
        $set: {
          passwordHash,
          status: 'ACTIVE',
          activatedAt: consumedAt,
        },
        $unset: { activationTokenHash: 1, activationExpiresAt: 1 },
      },
      { returnDocument: 'after', runValidators: true },
    );

    if (!manager) {
      throw tokenError(400, 'TOKEN_INVALID', 'The Manager activation token is invalid.');
    }

    await establishSession(req, manager);
    return {
      user: {
        id: manager._id.toString(),
        name: manager.name,
        email: manager.email,
        role: manager.role,
      },
    };
  }

  return { activateManager, forgotPassword, getCurrentUser, login, register, resetPassword };
}

const authService = createAuthService();

module.exports = authService;
module.exports.createAuthService = createAuthService;
module.exports.hashResetToken = hashResetToken;
module.exports.hashToken = hashToken;
module.exports.GENERIC_RESET_MESSAGE = GENERIC_RESET_MESSAGE;
