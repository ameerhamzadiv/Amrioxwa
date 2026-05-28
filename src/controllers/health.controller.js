'use strict';

const sessionStore = require('../sessions/session-store');
const { getStats } = require('../queues/queue-factory');
const { getClient } = require('../config/redis');

async function health(req, res) {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: Date.now(),
    },
  });
}

async function healthSessions(req, res, next) {
  try {
    const sessions = await sessionStore.getAll();
    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
}

async function healthQueues(req, res, next) {
  try {
    const stats = await getStats();
    res.json({ success: true, data: { queues: stats } });
  } catch (err) {
    next(err);
  }
}

module.exports = { health, healthSessions, healthQueues };
