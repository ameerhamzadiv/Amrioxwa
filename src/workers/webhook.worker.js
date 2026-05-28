'use strict';

const { Worker } = require('bullmq');
const axios = require('axios');
const { getClient } = require('../config/redis');
const { QUEUE_NAMES } = require('../config/constants');
const env = require('../config/env');
const logger = require('../config/logger');
const { signPayload } = require('../utils/crypto');

let _worker = null;

function startWebhookWorker() {
  if (_worker) return;

  _worker = new Worker(
    QUEUE_NAMES.WEBHOOKS,
    async (job) => {
      const { event, sessionId, payload, webhookUrl } = job.data;
      const body = JSON.stringify(payload);
      const signature = signPayload(env.webhook.secret, body);

      logger.debug('Sending webhook', { event, sessionId, jobId: job.id, webhookUrl });

      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': event,
          'X-Session-Id': sessionId,
        },
        timeout: env.webhook.timeout,
      });

      if (response.status >= 400 && response.status < 500) {
        logger.warn('Webhook returned 4xx — not retrying', {
          event,
          sessionId,
          status: response.status,
        });
        return;
      }

      logger.info('Webhook delivered', { event, sessionId, status: response.status });
    },
    {
      connection: getClient(),
      concurrency: 5,
    }
  );

  _worker.on('failed', (job, err) => {
    logger.error('Webhook job failed', {
      event: job?.data?.event,
      sessionId: job?.data?.sessionId,
      attempt: job?.attemptsMade,
      error: err.message,
    });
  });

  _worker.on('error', (err) => {
    logger.error('Webhook worker error', { error: err.message });
  });

  logger.info('Webhook worker started');
}

async function close() {
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
}

module.exports = { startWebhookWorker, close };
