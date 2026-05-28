'use strict';

const { v4: uuidv4 } = require('uuid');
const { SESSION_STATES, WEBHOOK_EVENTS } = require('../config/constants');
const { Errors } = require('../utils/errors');
const { isValidPhone, toJid } = require('../utils/phone');
const sessionStore = require('../sessions/session-store');
const { getMessageQueue } = require('../queues/queue-factory');
const webhookService = require('./webhook.service');
const logger = require('../config/logger');

class MessageService {
  async enqueue(sessionId, phone, text, idempotencyKey = null) {
    if (!isValidPhone(phone)) throw Errors.invalidPhone(phone);

    const meta = await sessionStore.get(sessionId);
    if (!meta) throw Errors.sessionNotFound(sessionId);
    if (meta.state !== SESSION_STATES.CONNECTED) throw Errors.sessionNotConnected(sessionId);

    const messageId = idempotencyKey || uuidv4();
    const to = toJid(phone);
    const content = { text };

    const queue = getMessageQueue(sessionId);
    await queue.add(
      'send-text',
      { sessionId, to, content, messageId },
      { jobId: messageId }
    );

    await webhookService.send(WEBHOOK_EVENTS.MESSAGE_QUEUED, sessionId, {
      messageId,
      to: phone,
      timestamp: Date.now(),
    });

    logger.info('Message enqueued', { sessionId, to: phone, messageId });
    return { messageId, status: 'queued' };
  }
}

module.exports = new MessageService();
