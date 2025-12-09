const { StatusCodes, getReasonPhrase } = require('http-status-codes');

function sendError(res, status, message, details) {
  res.status(status).json({
    error: getReasonPhrase(status),
    message,
    ...(details ? { details } : {}),
  });
}

module.exports = {
  StatusCodes,
  sendError,
};
