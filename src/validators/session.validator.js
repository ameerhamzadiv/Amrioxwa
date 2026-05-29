'use strict';

const Joi = require('joi');

const sessionIdField = Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).min(1).max(64);

const createSessionSchema = Joi.object({
  // Laravel sends `name`; native clients may send `sessionId` — accept both
  name:      sessionIdField.optional(),
  sessionId: sessionIdField.optional(),
  // PHP json_encode([]) produces [] not {} — accept either
  config: Joi.alternatives().try(
  Joi.object(),
  Joi.array()
).custom((value) => {
  if (Array.isArray(value)) return {};
  return value || {};
}).optional(),
}).or('name', 'sessionId');

const sendMessageSchema = Joi.object({
  to:             Joi.string().required(),
  message:        Joi.string().min(1).max(4096).required(),
  idempotencyKey: Joi.string().max(128).optional(),
});

// Laravel compat: POST /:id/messages/send-text  { chatId, text }
const sendTextSchema = Joi.object({
  chatId:         Joi.string().required(),
  text:           Joi.string().min(1).max(4096).required(),
  idempotencyKey: Joi.string().max(128).optional(),
});

const createWebhookSchema = Joi.object({
  url:    Joi.string().uri().required(),
  events: Joi.array().items(Joi.string()).min(1).required(),
  hmac:   Joi.object({ key: Joi.string().optional() }).optional(),
});

module.exports = { createSessionSchema, sendMessageSchema, sendTextSchema, createWebhookSchema };
