'use strict';

const { INTERNAL_EVENTS, SESSION_STATES, WEBHOOK_EVENTS } = require('../config/constants');
const webhookService = require('./webhook.service');
const inboundMessageService = require('./inbound-message.service');
const { startMessageWorker, stopMessageWorker } = require('../workers/message.worker');
const logger = require('../config/logger');

class SessionEventService {
  attach(sessionManager) {
    sessionManager.on(INTERNAL_EVENTS.SESSION_STATE_CHANGE, (data) =>
      this._onStateChange(data, sessionManager)
    );

    sessionManager.on(INTERNAL_EVENTS.SESSION_QR, (data) =>
      this._onQr(data)
    );

    sessionManager.on(INTERNAL_EVENTS.SESSION_MESSAGE, (data) =>
      inboundMessageService.handle(data.sessionId, data.message)
    );

    logger.info('Session event listeners attached');
  }

  async _onStateChange({ sessionId, state, ...rest }, sessionManager) {
    switch (state) {
      case SESSION_STATES.CONNECTED:
        startMessageWorker(sessionId, sessionManager, webhookService);
        await webhookService.send(WEBHOOK_EVENTS.SESSION_CONNECTED, sessionId, {
          phone: rest.phone,
          name: rest.name,
        });
        break;

      case SESSION_STATES.DISCONNECTED:
        await webhookService.send(WEBHOOK_EVENTS.SESSION_DISCONNECTED, sessionId, {
          reason: rest.reason,
          willReconnect: rest.willReconnect,
        });
        break;

      case SESSION_STATES.RECONNECTING:
        await webhookService.send(WEBHOOK_EVENTS.SESSION_RECONNECTING, sessionId, {
          attempt: rest.attempt,
        });
        break;

      case SESSION_STATES.FAILED:
        await stopMessageWorker(sessionId);
        await webhookService.send(WEBHOOK_EVENTS.SESSION_FAILED, sessionId, {
          reason: rest.reason,
          willReconnect: false,
        });
        break;

      case SESSION_STATES.TERMINATED:
        await stopMessageWorker(sessionId);
        await webhookService.send(WEBHOOK_EVENTS.SESSION_TERMINATED, sessionId, {});
        break;
    }
  }

  async _onQr({ sessionId, qr }) {
    await webhookService.send(WEBHOOK_EVENTS.SESSION_QR, sessionId, { qr });
  }
}

module.exports = new SessionEventService();
