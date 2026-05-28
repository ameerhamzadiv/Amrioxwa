'use strict';

const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const start = Date.now();

  res.on('finish', () => {
    logger.http('HTTP request', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTimeMs: Date.now() - start,
      ip: req.ip,
    });
  });

  next();
}

module.exports = { requestLogger };
