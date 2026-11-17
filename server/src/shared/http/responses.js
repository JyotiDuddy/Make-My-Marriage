function sendSuccess(res, data, { message = 'Request successful', statusCode = 200, pagination } = {}) {
  const response = {
    success: true,
    message,
    data,
  };
  if (pagination !== undefined) response.pagination = pagination;
  return res.status(statusCode).json(response);
}

function sendError(res, { statusCode, message, code }) {
  return res.status(statusCode).json({
    success: false,
    message,
    error: { code },
  });
}

module.exports = { sendSuccess, sendError };
