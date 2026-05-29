'use strict';

const SESSION_STATES = {
  INITIALIZING: 'initializing',
  CONNECTING: 'connecting',
  QR_READY: 'qr_ready',
  AUTHENTICATED: 'authenticated',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed',
  TERMINATED: 'terminated',
};

const DISCONNECT_REASONS = {
  LOGOUT: 'logout',
  CONFLICT: 'conflict',
  CONNECTION_FAILURE: 'connection_failure',
  CONNECTION_LOST: 'connection_lost',
  BAD_SESSION: 'bad_session',
  RESTART_REQUIRED: 'restart_required',
  TIMEDOUT: 'timedout',
  FORBIDDEN: 'forbidden',
  UNKNOWN: 'unknown',
};

const WEBHOOK_EVENTS = {
  SESSION_QR: 'session.qr',
  SESSION_CONNECTED: 'session.connected',
  SESSION_DISCONNECTED: 'session.disconnected',
  SESSION_RECONNECTING: 'session.reconnecting',
  SESSION_FAILED: 'session.failed',
  SESSION_TERMINATED: 'session.terminated',
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_QUEUED: 'message.queued',
  MESSAGE_SENT: 'message.sent',
  MESSAGE_DELIVERED: 'message.delivered',
  MESSAGE_FAILED: 'message.failed',
};

const INTERNAL_EVENTS = {
  SESSION_STATE_CHANGE: 'session:state_change',
  SESSION_QR: 'session:qr',
  SESSION_MESSAGE: 'session:message',
  SESSION_ACK: 'session:ack',
};

const QUEUE_NAMES = {
  messages: (sessionId) => `messages-${sessionId}`,
  WEBHOOKS: 'webhooks',
};

const REDIS_KEYS = {
  session: (id) => `session:${id}`,
  sessionIndex: 'sessions:index',
  sessionReconnectAttempts: (id) => `session:${id}:reconnect_attempts`,
};

const RECONNECT_BACKOFF = {
  BASE_DELAY_MS: 5000,
  MAX_DELAY_MS: 120000,
  MULTIPLIER: 2,
  JITTER_FACTOR: 0.2,
};

const MESSAGE_TYPES = {
  TEXT: 'text',
};

module.exports = {
  SESSION_STATES,
  DISCONNECT_REASONS,
  WEBHOOK_EVENTS,
  INTERNAL_EVENTS,
  QUEUE_NAMES,
  REDIS_KEYS,
  RECONNECT_BACKOFF,
  MESSAGE_TYPES,
};
