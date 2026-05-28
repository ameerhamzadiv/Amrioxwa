'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const globalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please slow down',
      statusCode: 429,
    },
  },
});

const sendMessageLimiter = rateLimit({
  windowMs: 60000,
  max: 60,
  keyGenerator: (req) => `${req.ip}:${req.params.sessionId}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many messages, please slow down',
      statusCode: 429,
    },
  },
});

module.exports = { globalLimiter, sendMessageLimiter };
