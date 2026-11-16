function sendSuccess(res, data, { message = 'Request successful', statusCode = 200 } = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function sendError(res, { statusCode, message, code }) {
  return res.status(statusCode).json({
    success: false,
    message,
    error: { code },
  });
}

module.exports = { sendSuccess, sendError };
