'use strict';

const { getClient } = require('../config/redis');
const { REDIS_KEYS, SESSION_STATES } = require('../config/constants');
const logger = require('../config/logger');

class SessionStore {
  async save(sessionId, metadata) {
    const redis = getClient();
    const key = REDIS_KEYS.session(sessionId);
    await redis.hset(key, {
      ...metadata,
      updatedAt: Date.now(),
    });
    await redis.sadd(REDIS_KEYS.sessionIndex, sessionId);
    logger.debug('Session metadata saved', { sessionId, state: metadata.state });
  }

  async get(sessionId) {
    const redis = getClient();
    const data = await redis.hgetall(REDIS_KEYS.session(sessionId));
    if (!data || Object.keys(data).length === 0) return null;
    return this._deserialize(data);
  }

  async getAll() {
    const redis = getClient();
    const ids = await redis.smembers(REDIS_KEYS.sessionIndex);
    if (!ids.length) return [];
    const sessions = await Promise.all(ids.map((id) => this.get(id)));
    return sessions.filter(Boolean);
  }

  async updateState(sessionId, state, extra = {}) {
    const redis = getClient();
    await redis.hset(REDIS_KEYS.session(sessionId), {
      state,
      ...extra,
      updatedAt: Date.now(),
    });
    logger.debug('Session state updated', { sessionId, state });
  }

  async remove(sessionId) {
    const redis = getClient();
    await redis.del(REDIS_KEYS.session(sessionId));
    await redis.del(REDIS_KEYS.sessionReconnectAttempts(sessionId));
    await redis.srem(REDIS_KEYS.sessionIndex, sessionId);
    logger.debug('Session metadata removed', { sessionId });
  }

  async exists(sessionId) {
    const redis = getClient();
    return (await redis.exists(REDIS_KEYS.session(sessionId))) === 1;
  }

  async incrementReconnectAttempts(sessionId) {
    const redis = getClient();
    const attempts = await redis.incr(REDIS_KEYS.sessionReconnectAttempts(sessionId));
    await redis.expire(REDIS_KEYS.sessionReconnectAttempts(sessionId), 3600);
    return attempts;
  }

  async resetReconnectAttempts(sessionId) {
    const redis = getClient();
    await redis.del(REDIS_KEYS.sessionReconnectAttempts(sessionId));
  }

  async getReconnectAttempts(sessionId) {
    const redis = getClient();
    const val = await redis.get(REDIS_KEYS.sessionReconnectAttempts(sessionId));
    return val ? parseInt(val, 10) : 0;
  }

  _deserialize(data) {
    return {
      ...data,
      createdAt: data.createdAt ? parseInt(data.createdAt, 10) : null,
      updatedAt: data.updatedAt ? parseInt(data.updatedAt, 10) : null,
      connectedAt: data.connectedAt ? parseInt(data.connectedAt, 10) : null,
    };
  }
}

module.exports = new SessionStore();
