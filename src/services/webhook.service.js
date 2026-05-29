'use strict';

const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const logger = require('../config/logger');
const { getWebhookQueue } = require('../queues/queue-factory');

class WebhookService {
  async send(event, sessionId, data) {
    if (!env.webhook.enabled) return;

    const payload = {
      event,
      sessionId,
      data,
      timestamp: Date.now(),
    };

    const queue = getWebhookQueue();
    await queue.add(
      event,
      { event, sessionId, payload, webhookUrl: env.webhook.url },
      { jobId: uuidv4() }
    );

    logger.debug('Webhook enqueued', { event, sessionId });
  }
}

module.exports = new WebhookService();
