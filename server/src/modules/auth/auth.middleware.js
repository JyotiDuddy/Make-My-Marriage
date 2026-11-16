const User = require('./user.model');
const ApiError = require('../../shared/errors/api-error');

async function requireAuthenticated(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    next(new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.'));
    return;
  }

  try {
    const user = await User.findById(userId).select('name email role status');

    if (!user || user.status !== 'ACTIVE' || user.role !== req.session.role) {
      await new Promise((resolve) => req.session.destroy(() => resolve()));
      next(new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.'));
      return;
    }

    req.authenticatedUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireAuthenticated };
