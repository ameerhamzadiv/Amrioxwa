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
          // Only flag as dead when the socket object is gone entirely.
          // Baileys removes it from _sessions inside connection.update('close'),
          // so if it's still in the map the socket is alive.
          // Never rely on sock.ws?.readyState — Baileys abstracts the WS internally.
          if (!sock) {
            logger.warn('Health check detected dead session socket', { sessionId: meta.sessionId });
            await sessionStore.updateState(meta.sessionId, SESSION_STATES.DISCONNECTED, {
              disconnectReason: 'health_check_detected',
              disconnectedAt: Date.now(),
            });
          }
        }
      }
    } catch (err) {
      logger.error('Health monitor check failed', { error: err.message });
    }
  }
}

module.exports = new HealthMonitor();
