'use strict';

require('dotenv').config();

const required = [
  'INTERNAL_API_KEY',
  'WEBHOOK_URL',
  'WEBHOOK_SECRET',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[startup] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  logLevel: process.env.LOG_LEVEL || 'info',

  auth: {
    internalApiKey: process.env.INTERNAL_API_KEY,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || undefined,
  },

  session: {
    dir: process.env.SESSION_DIR || './sessions',
    maxReconnectAttempts: parseInt(process.env.SESSION_MAX_RECONNECT_ATTEMPTS, 10) || 10,
    healthCheckInterval: parseInt(process.env.SESSION_HEALTH_CHECK_INTERVAL, 10) || 60000,
  },

  queue: {
    messageRateLimit: parseInt(process.env.QUEUE_MESSAGE_RATE_LIMIT, 10) || 20,
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY, 10) || 1,
  },

  webhook: {
    url: process.env.WEBHOOK_URL,
    secret: process.env.WEBHOOK_SECRET,
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT, 10) || 10000,
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES, 10) || 5,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 200,
  },

  admin: {
    enabled: process.env.ADMIN_ENABLED === 'true',
    key: process.env.ADMIN_KEY || '',
  },
};
