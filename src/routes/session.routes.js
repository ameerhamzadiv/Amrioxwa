'use strict';

const router = require('express').Router();
const controller = require('../controllers/session.controller');
const { validate } = require('../middleware/validate.middleware');
const { sendMessageLimiter } = require('../middleware/rate-limit.middleware');
const { createSessionSchema, sendMessageSchema, sendTextSchema, createWebhookSchema } = require('../validators/session.validator');

// Session CRUD
router.post('/',              validate(createSessionSchema), controller.createSession);
router.get('/',               controller.listSessions);
router.get('/:sessionId',     controller.getSession);
router.get('/:sessionId/qr',  controller.getQr);
router.delete('/:sessionId',  controller.logoutSession);

// Lifecycle (native + Laravel compat)
router.post('/:sessionId/restart', controller.restartSession);
router.post('/:sessionId/start',   controller.startSession);
router.post('/:sessionId/stop',    controller.stopSession);

// Messaging — native: POST /messages  |  Laravel compat: POST /messages/send-text
router.post('/:sessionId/messages',           sendMessageLimiter, validate(sendMessageSchema), controller.sendMessage);
router.post('/:sessionId/messages/send-text', sendMessageLimiter, validate(sendTextSchema),    controller.sendText);

// Number check — native: /numbers/:phone/check  |  Laravel compat: /contacts/check/:phone
router.get('/:sessionId/numbers/:phone/check',   controller.checkNumber);
router.get('/:sessionId/contacts/check/:phone',  controller.checkContact);

// Webhooks (Laravel compat — in-memory store)
router.get('/:sessionId/webhooks',              controller.listWebhooks);
router.post('/:sessionId/webhooks',             validate(createWebhookSchema), controller.createWebhook);
router.delete('/:sessionId/webhooks/:hookId',   controller.deleteWebhook);

module.exports = router;
