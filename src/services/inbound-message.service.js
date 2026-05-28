'use strict';

const { WEBHOOK_EVENTS } = require('../config/constants');
const webhookService = require('./webhook.service');
const { fromJid } = require('../utils/phone');
const logger = require('../config/logger');

const _seen = new Set();
const MAX_SEEN = 10000;

class InboundMessageService {
  async handle(sessionId, message) {
    if (!message?.message) return;
    if (message.key?.fromMe) return;
    if (message.key?.remoteJid?.endsWith('@g.us')) return;
    if (message.key?.remoteJid === 'status@broadcast') return;

    const msgId = message.key?.id;
    if (_seen.has(msgId)) return;
    _seen.add(msgId);
    if (_seen.size > MAX_SEEN) {
      const first = _seen.values().next().value;
      _seen.delete(first);
    }

    const from = fromJid(message.key?.remoteJid || '');
    const body =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      '[unsupported message type]';

    const timestamp = message.messageTimestamp
      ? parseInt(message.messageTimestamp, 10)
      : Math.floor(Date.now() / 1000);

    logger.info('Inbound message received', { sessionId, from, msgId });

    await webhookService.send(WEBHOOK_EVENTS.MESSAGE_RECEIVED, sessionId, {
      messageId: msgId,
      from,
      body,
      timestamp,
    });
  }
}

module.exports = new InboundMessageService();
