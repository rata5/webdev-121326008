// A rule was broken. Services throw this; they know nothing about HTTP status codes.
// The route layer turns `code` into a status (see src/routes/http.js).
class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

module.exports = { AppError };
