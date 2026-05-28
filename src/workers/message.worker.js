'use strict';

const { Worker } = require('bullmq');
const { getClient } = require('../config/redis');
const { QUEUE_NAMES, SESSION_STATES, WEBHOOK_EVENTS } = require('../config/constants');
const env = require('../config/env');
const logger = require('../config/logger');
const { toJid } = require('../utils/phone');
const sessionStore = require('../sessions/session-store');

const _workers = new Map();

function startMessageWorker(sessionId, sessionManager, webhookService) {
  const queueName = QUEUE_NAMES.messages(sessionId);

  if (_workers.has(queueName)) return;

  const worker = new Worker(
    queueName,
    async (job) => {
      const { to, content, messageId } = job.data;

      logger.debug('Processing message job', { sessionId, jobId: job.id, to, messageId });

      const meta = await sessionStore.get(sessionId);
      if (!meta || meta.state !== SESSION_STATES.CONNECTED) {
        throw new Error(`Session ${sessionId} not connected`);
      }

      const result = await sessionManager.sendMessage(sessionId, to, content);

      await webhookService.send(WEBHOOK_EVENTS.MESSAGE_SENT, sessionId, {
        messageId,
        to: to.split('@')[0],
        baileysId: result?.key?.id,
        timestamp: Date.now(),
      });

      logger.info('Message sent', { sessionId, to, messageId, jobId: job.id });

      return { baileysId: result?.key?.id };
    },
    {
      connection: getClient(),
      concurrency: env.queue.concurrency,
      limiter: {
        max: env.queue.messageRateLimit,
        duration: 60000,
      },
    }
  );

  worker.on('failed', async (job, err) => {
    logger.error('Message job failed', {
      sessionId,
      jobId: job?.id,
      to: job?.data?.to,
      messageId: job?.data?.messageId,
      attempt: job?.attemptsMade,
      error: err.message,
    });

    if (job?.attemptsMade >= job?.opts?.attempts) {
      await webhookService.send(WEBHOOK_EVENTS.MESSAGE_FAILED, sessionId, {
        messageId: job?.data?.messageId,
        to: job?.data?.to?.split('@')[0],
        error: err.message,
        timestamp: Date.now(),
      });
    }
  });

  worker.on('error', (err) => {
    logger.error('Message worker error', { sessionId, error: err.message });
  });

  _workers.set(queueName, worker);
  logger.info('Message worker started', { sessionId, queue: queueName });
}

async function stopMessageWorker(sessionId) {
  const queueName = QUEUE_NAMES.messages(sessionId);
  const worker = _workers.get(queueName);
  if (worker) {
    await worker.close();
    _workers.delete(queueName);
    logger.debug('Message worker stopped', { sessionId });
  }
}

async function closeAll() {
  for (const [name, worker] of _workers.entries()) {
    await worker.close();
    logger.debug('Worker closed', { queue: name });
  }
  _workers.clear();
}

module.exports = { startMessageWorker, stopMessageWorker, closeAll };
