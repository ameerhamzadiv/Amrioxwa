'use strict';

const { INTERNAL_EVENTS, SESSION_STATES } = require('../config/constants');
const { emitToSession } = require('../websocket/socket.server');
const logger = require('../config/logger');

function attachEventBridge(sessionManager) {
  sessionManager.on(INTERNAL_EVENTS.SESSION_QR, ({ sessionId, qr }) => {
    emitToSession(sessionId, 'qr', { sessionId, qr });
    logger.debug('QR forwarded to socket', { sessionId });
  });

  sessionManager.on(INTERNAL_EVENTS.SESSION_STATE_CHANGE, ({ sessionId, state, ...rest }) => {
    emitToSession(sessionId, 'state', { sessionId, state, ...rest });
  });
}

module.exports = { attachEventBridge };
