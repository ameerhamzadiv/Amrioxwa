'use strict';

class AppError extends Error {
  constructor(code, message, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

const Errors = {
  sessionNotFound: (id) =>
    new AppError('SESSION_NOT_FOUND', `Session '${id}' does not exist`, 404),

  sessionExists: (id) =>
    new AppError('SESSION_EXISTS', `Session '${id}' already exists`, 409),

  sessionNotConnected: (id) =>
    new AppError('SESSION_NOT_CONNECTED', `Session '${id}' is not connected`, 409),

  sessionQrExpired: () =>
    new AppError('SESSION_QR_EXPIRED', 'QR code has expired, restart the session', 410),

  invalidPhone: (phone) =>
    new AppError('INVALID_PHONE', `Invalid phone number format: ${phone}`, 400),

  validationError: (details) =>
    new AppError('VALIDATION_ERROR', details, 400),

  unauthorized: () =>
    new AppError('UNAUTHORIZED', 'Missing or invalid API key', 401),

  rateLimited: () =>
    new AppError('RATE_LIMITED', 'Too many requests', 429),

  internalError: (message = 'Internal server error') =>
    new AppError('INTERNAL_ERROR', message, 500),
};

module.exports = { AppError, Errors };
