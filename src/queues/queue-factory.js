'use strict';

const { Queue } = require('bullmq');
const { getClient } = require('../config/redis');
const { QUEUE_NAMES } = require('../config/constants');
const logger = require('../config/logger');

const _queues = new Map();

function getConnection() {
  return getClient();
}

function getMessageQueue(sessionId) {
  const name = QUEUE_NAMES.messages(sessionId);
  if (!_queues.has(name)) {
    const queue = new Queue(name, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 8,
        backoff: {
          type: 'exponential',
          delay: 5000, // retries at 5s, 10s, 20s, 40s, 80s, 160s, 320s
        },
        removeOnComplete: { count: 1000, age: 86400 },
        removeOnFail: { count: 500, age: 604800 },
      },
    });
    _queues.set(name, queue);
    logger.debug('Message queue created', { queue: name });
  }
  return _queues.get(name);
}

function getWebhookQueue() {
  const name = QUEUE_NAMES.WEBHOOKS;
  if (!_queues.has(name)) {
    const queue = new Queue(name, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: { count: 1000, age: 86400 },
        removeOnFail: { count: 500, age: 604800 },
      },
    });
    _queues.set(name, queue);
    logger.debug('Webhook queue created');
  }
  return _queues.get(name);
}

async function closeAll() {
  for (const [name, queue] of _queues.entries()) {
    await queue.close();
    logger.debug('Queue closed', { queue: name });
  }
  _queues.clear();
}

async function getStats() {
  const stats = {};
  for (const [name, queue] of _queues.entries()) {
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    stats[name] = counts;
  }
  return stats;
}

module.exports = { getMessageQueue, getWebhookQueue, closeAll, getStats };
