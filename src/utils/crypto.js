'use strict';

const crypto = require('crypto');

function signPayload(secret, payload) {
  return crypto
    .createHmac('sha256', secret)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('hex');
}

function verifySignature(secret, payload, signature) {
  const expected = signPayload(secret, payload);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

module.exports = { signPayload, verifySignature };
