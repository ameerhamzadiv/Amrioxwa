'use strict';

const env = require('../config/env');
const { Errors } = require('../utils/errors');

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== env.auth.internalApiKey) {
    return next(Errors.unauthorized());
  }
  next();
}

module.exports = { requireApiKey };
