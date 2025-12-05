// Wspólne helpery HTTP: statusy i ujednolicona odpowiedź błędu
const { StatusCodes, getReasonPhrase } = require('http-status-codes');

// Zwraca błąd w formacie JSON z kodem HTTP i krótką nazwą statusu
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
