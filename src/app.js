'use strict';

const http = require('http');
const express = require('express');

const env = require('./config/env');
const logger = require('./config/logger');
const { getClient } = require('./config/redis');

const { requestLogger } = require('./middleware/request-logger.middleware');
const { errorHandler } = require('./middleware/error-handler.middleware');
const { globalLimiter } = require('./middleware/rate-limit.middleware');
const routes = require('./routes/index');

const sessionManager = require('./sessions/session-manager');
const healthMonitor = require('./sessions/health-monitor');
const sessionEventService = require('./services/session-event.service');
const { startWebhookWorker, close: closeWebhookWorker } = require('./workers/webhook.worker');
const { closeAll: closeQueues } = require('./queues/queue-factory');
const { closeAll: closeWorkers } = require('./workers/message.worker');
const { closeClient: closeRedis } = require('./config/redis');
const { createSocketServer } = require('./websocket/socket.server');
const { attachEventBridge } = require('./events/event-bridge');

async function start() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);
  app.use(globalLimiter);

  app.use('/api/v1', routes);
  app.use('/api', routes); // Laravel compat alias

  app.use((req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found', statusCode: 404 } });
  });

  app.use(errorHandler);

  const server = http.createServer(app);
  createSocketServer(server);

  attachEventBridge(sessionManager);
  sessionEventService.attach(sessionManager);

  getClient();

  startWebhookWorker();
  await sessionManager.initialize();
  healthMonitor.start(sessionManager);

  await new Promise((resolve) => server.listen(env.port, resolve));
  logger.info(`AmrioxWA running on port ${env.port}`, { env: env.nodeEnv });

  return server;
}

async function shutdown(server) {
  logger.info('Graceful shutdown initiated');

  healthMonitor.stop();

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
    setTimeout(resolve, 10000);
  });

  await sessionManager.shutdown();
  await closeWorkers();
  await closeWebhookWorker();
  await closeQueues();
  await closeRedis();

  logger.info('Shutdown complete');
  process.exit(0);
}

start()
  .then((server) => {
    process.on('SIGTERM', () => shutdown(server));
    process.on('SIGINT', () => shutdown(server));
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception', { error: err.message, stack: err.stack });
      process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason: String(reason) });
    });
  })
  .catch((err) => {
    console.error('Failed to start AmrioxWA:', err);
    process.exit(1);
  });
