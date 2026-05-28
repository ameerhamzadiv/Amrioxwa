'use strict';

const { Redis } = require('ioredis');
const env = require('./env');
const logger = require('./logger');

let client = null;

function createClient() {
  const redis = new Redis(env.redis.url, {
    password: env.redis.password,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
      const delay = Math.min(times * 500, 5000);
      logger.warn('Redis reconnecting', { attempt: times, delayMs: delay });
      return delay;
    },
  });

  redis.on('connect', () => logger.info('Redis connected'));
  redis.on('ready', () => logger.info('Redis ready'));
  redis.on('error', (err) => logger.error('Redis error', { error: err.message }));
  redis.on('close', () => logger.warn('Redis connection closed'));
  redis.on('reconnecting', () => logger.warn('Redis reconnecting'));

  return redis;
}

function getClient() {
  if (!client) {
    client = createClient();
  }
  return client;
}

async function closeClient() {
  if (client) {
    await client.quit();
    client = null;
    logger.info('Redis connection closed gracefully');
  }
}

module.exports = { getClient, closeClient };
