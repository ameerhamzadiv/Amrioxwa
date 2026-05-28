'use strict';

const { RECONNECT_BACKOFF, SESSION_STATES, DISCONNECT_REASONS } = require('../config/constants');
const env = require('../config/env');
const logger = require('../config/logger');
const sessionStore = require('./session-store');
const { sleep } = require('../utils/sleep');

class ReconnectManager {
  constructor() {
    this._timers = new Map();
  }

  classifyReason(lastDisconnect) {
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const message = lastDisconnect?.error?.message || '';

    if (statusCode === 401) return DISCONNECT_REASONS.LOGOUT;
    if (statusCode === 403) return DISCONNECT_REASONS.FORBIDDEN;
    if (statusCode === 408) return DISCONNECT_REASONS.TIMEDOUT;
    if (statusCode === 409) return DISCONNECT_REASONS.CONFLICT;
    if (statusCode === 411) return DISCONNECT_REASONS.BAD_SESSION;
    if (message.includes('restart required')) return DISCONNECT_REASONS.RESTART_REQUIRED;
    if (message.includes('Connection lost')) return DISCONNECT_REASONS.CONNECTION_LOST;

    return DISCONNECT_REASONS.CONNECTION_FAILURE;
  }

  shouldReconnect(reason) {
    return ![
      DISCONNECT_REASONS.LOGOUT,
      DISCONNECT_REASONS.FORBIDDEN,
      DISCONNECT_REASONS.BAD_SESSION,
    ].includes(reason);
  }

  calculateDelay(attempt) {
    const base = RECONNECT_BACKOFF.BASE_DELAY_MS;
    const max = RECONNECT_BACKOFF.MAX_DELAY_MS;
    const raw = Math.min(base * Math.pow(RECONNECT_BACKOFF.MULTIPLIER, attempt - 1), max);
    const jitter = raw * RECONNECT_BACKOFF.JITTER_FACTOR * (Math.random() * 2 - 1);
    return Math.round(raw + jitter);
  }

  async scheduleReconnect(sessionId, connectFn, onMaxAttempts) {
    if (this._timers.has(sessionId)) {
      clearTimeout(this._timers.get(sessionId));
    }

    const attempt = await sessionStore.incrementReconnectAttempts(sessionId);
    const maxAttempts = env.session.maxReconnectAttempts;

    if (attempt > maxAttempts) {
      logger.error('Session max reconnect attempts reached', { sessionId, attempt });
      await sessionStore.updateState(sessionId, SESSION_STATES.FAILED, { failedAt: Date.now() });
      await onMaxAttempts(sessionId);
      return;
    }

    const delayMs = this.calculateDelay(attempt);
    logger.info('Scheduling reconnect', { sessionId, attempt, delayMs });

    await sessionStore.updateState(sessionId, SESSION_STATES.RECONNECTING, {
      reconnectAttempt: attempt,
      reconnectAt: Date.now() + delayMs,
    });

    const timer = setTimeout(async () => {
      this._timers.delete(sessionId);
      try {
        await connectFn(sessionId);
      } catch (err) {
        logger.error('Reconnect attempt failed', { sessionId, attempt, error: err.message });
      }
    }, delayMs);

    this._timers.set(sessionId, timer);
  }

  cancelReconnect(sessionId) {
    if (this._timers.has(sessionId)) {
      clearTimeout(this._timers.get(sessionId));
      this._timers.delete(sessionId);
      logger.debug('Reconnect timer cancelled', { sessionId });
    }
  }
}

module.exports = new ReconnectManager();
