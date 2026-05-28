'use strict';

const { Server } = require('socket.io');
const { INTERNAL_EVENTS } = require('../config/constants');
const env = require('../config/env');
const logger = require('../config/logger');

let io = null;

function createSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.isDev ? '*' : false,
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    const key = socket.handshake.auth?.apiKey || socket.handshake.headers['x-api-key'];
    if (key !== env.auth.internalApiKey) {
      return next(new Error('Unauthorized'));
    }
    next();
  });

  io.on('connection', (socket) => {
    const { sessionId } = socket.handshake.query;
    if (sessionId) {
      socket.join(`session:${sessionId}`);
      logger.debug('Socket client connected', { sessionId, socketId: socket.id });
    }

    socket.on('disconnect', () => {
      logger.debug('Socket client disconnected', { socketId: socket.id });
    });
  });

  logger.info('Socket.io server initialized');
  return io;
}

function emitToSession(sessionId, event, data) {
  if (!io) return;
  io.to(`session:${sessionId}`).emit(event, data);
}

function getIo() {
  return io;
}

module.exports = { createSocketServer, emitToSession, getIo };
