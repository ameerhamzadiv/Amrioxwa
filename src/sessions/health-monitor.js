'use strict';

const env = require('../config/env');
const logger = require('../config/logger');
const { SESSION_STATES } = require('../config/constants');
const sessionStore = require('./session-store');

class HealthMonitor {
  constructor() {
    this._timer = null;
  }

  start(sessionManager) {
    this._sessionManager = sessionManager;
    this._timer = setInterval(
      () => this._check(),
      env.session.healthCheckInterval
    );
    logger.info('Session health monitor started', { intervalMs: env.session.healthCheckInterval });
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  async _check() {
    try {
      const sessions = await sessionStore.getAll();
      for (const meta of sessions) {
        if (meta.state === SESSION_STATES.CONNECTED) {
          const sock = this._sessionManager._sessions.get(meta.sessionId);
          // Redis says CONNECTED but there's no live socket — self-heal by
          // restoring the socket instead of abandoning the session.
          // Never rely on sock.ws?.readyState — Baileys abstracts the WS internally.
          if (!sock) {
            logger.warn('Health check: connected session missing live socket — restoring', { sessionId: meta.sessionId });
            try {
              await this._sessionManager.restartSession(meta.sessionId);
            } catch (err) {
              logger.error('Health check restore failed', { sessionId: meta.sessionId, error: err.message });
              await sessionStore.updateState(meta.sessionId, SESSION_STATES.DISCONNECTED, {
                disconnectReason: 'health_check_failed',
                disconnectedAt: Date.now(),
              });
            }
          }
        }
      }
    } catch (err) {
      logger.error('Health monitor check failed', { error: err.message });
    }
  }
}

module.exports = new HealthMonitor();
