'use strict';

const { Errors } = require('../utils/errors');

function validate(schema, target = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map((d) => d.message).join('; ');
      return next(Errors.validationError(details));
    }
    req[target] = value;
    next();
  };
}

module.exports = { validate };
