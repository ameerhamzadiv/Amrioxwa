'use strict';

const path = require('path');
const fs = require('fs');
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const EventEmitter = require('events');

const env = require('../config/env');
const logger = require('../config/logger');
const { SESSION_STATES, DISCONNECT_REASONS, INTERNAL_EVENTS } = require('../config/constants');
const sessionStore = require('./session-store');
const reconnectManager = require('./reconnect-manager');
const { Errors } = require('../utils/errors');

// Baileys requires a Pino-style logger (trace/debug/info/warn/error/fatal + child).
// Winston has no `trace` or `fatal` — wrap it into a compatible adapter.
function makeBaileysLogger(bindings) {
  const child = logger.child(bindings);
  return {
    level: 'silent',
    trace: (...a) => child.silly(...a),
    debug: (...a) => child.debug(...a),
    info:  (...a) => child.info(...a),
    warn:  (...a) => child.warn(...a),
    error: (...a) => child.error(...a),
    fatal: (...a) => child.error(...a),
    child: (b)   => makeBaileysLogger({ ...bindings, ...b }),
  };
}

class SessionManager extends EventEmitter {
  constructor() {
    super();
    this._sessions = new Map();
    this._intentionalStops = new Set(); // sessions stopped on purpose — skip auto-reconnect
  }

  async initialize() {
    logger.info('Restoring sessions from storage');

    const stored = await sessionStore.getAll();
    const knownIds = new Set(stored.map((s) => s.sessionId));

    // Scan sessions dir for auth files not in Redis (after migration / Redis wipe).
    // Any folder with auth_info/creds.json is a valid session — register it automatically.
    try {
      const entries = fs.readdirSync(env.session.dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || knownIds.has(entry.name)) continue;
        const credsPath = path.join(env.session.dir, entry.name, 'auth_info', 'creds.json');
        if (!fs.existsSync(credsPath)) continue;
        logger.info('Found auth files without Redis record — registering', { sessionId: entry.name });
        await sessionStore.save(entry.name, {
          sessionId: entry.name,
          state:     SESSION_STATES.INITIALIZING,
          createdAt: Date.now(),
        });
        stored.push({ sessionId: entry.name, state: SESSION_STATES.INITIALIZING });
      }
    } catch (err) {
      logger.warn('Could not scan session directory', { error: err.message });
    }

    let restored = 0;
    for (const meta of stored) {
      if (meta.state !== SESSION_STATES.TERMINATED) {
        try {
          await this._createSocket(meta.sessionId);
          restored++;
        } catch (err) {
          logger.error('Failed to restore session', { sessionId: meta.sessionId, error: err.message });
        }
      }
    }
    logger.info('Session restore complete', { restored, total: stored.length });
  }

  async createSession(sessionId) {
    // Live socket exists — truly active, reject
    if (this._sessions.has(sessionId)) {
      throw Errors.sessionExists(sessionId);
    }

    // Stale Redis record may exist after logout due to async connection.update
    // firing after sessionStore.remove(). Clean it up if session is dead.
    const existing = await sessionStore.get(sessionId);
    if (existing) {
      const deadStates = [SESSION_STATES.TERMINATED, SESSION_STATES.DISCONNECTED, SESSION_STATES.FAILED];
      if (deadStates.includes(existing.state)) {
        await this._deleteAuthFiles(sessionId);
        await sessionStore.remove(sessionId);
      } else {
        throw Errors.sessionExists(sessionId);
      }
    }

    await sessionStore.save(sessionId, {
      sessionId,
      state: SESSION_STATES.INITIALIZING,
      createdAt: Date.now(),
    });

    await this._createSocket(sessionId);
    return sessionStore.get(sessionId);
  }

  async getSession(sessionId) {
    const meta = await sessionStore.get(sessionId);
    if (!meta) throw Errors.sessionNotFound(sessionId);
    return meta;
  }

  async getAllSessions() {
    return sessionStore.getAll();
  }

  async logoutSession(sessionId) {
    const sock = this._sessions.get(sessionId);
    reconnectManager.cancelReconnect(sessionId);

    if (sock) {
      try {
        await sock.logout();
      } catch (_) {}
      sock.end();
      this._sessions.delete(sessionId);
    }

    await this._deleteAuthFiles(sessionId);
    await sessionStore.remove(sessionId);
    logger.info('Session terminated', { sessionId });
  }

  // Disconnect without unlinking the device — auth files & Redis record are kept,
  // so the session can be restarted later WITHOUT scanning a QR code again.
  async stopSession(sessionId) {
    const meta = await sessionStore.get(sessionId);
    if (!meta) throw Errors.sessionNotFound(sessionId);

    reconnectManager.cancelReconnect(sessionId);
    this._intentionalStops.add(sessionId); // tell close handler not to reconnect

    const sock = this._sessions.get(sessionId);
    if (sock) {
      try { sock.end(); } catch (_) {} // close socket only — NO sock.logout()
      this._sessions.delete(sessionId);
    }

    await sessionStore.updateState(sessionId, SESSION_STATES.DISCONNECTED, {
      disconnectReason: 'manual_stop',
      disconnectedAt: Date.now(),
    });
    logger.info('Session stopped — auth retained', { sessionId });
  }

  async restartSession(sessionId) {
    const meta = await sessionStore.get(sessionId);
    if (!meta) throw Errors.sessionNotFound(sessionId);

    reconnectManager.cancelReconnect(sessionId);
    const sock = this._sessions.get(sessionId);
    if (sock) {
      sock.end();
      this._sessions.delete(sessionId);
    }

    await sessionStore.resetReconnectAttempts(sessionId);
    await this._createSocket(sessionId);
    logger.info('Session restarted manually', { sessionId });
    return sessionStore.get(sessionId);
  }

  async sendMessage(sessionId, to, content) {
    const sock = this._sessions.get(sessionId);
    if (!sock) throw Errors.sessionNotConnected(sessionId);

    const meta = await sessionStore.get(sessionId);
    if (meta?.state !== SESSION_STATES.CONNECTED) {
      throw Errors.sessionNotConnected(sessionId);
    }

    const result = await sock.sendMessage(to, content);
    return result;
  }

  async checkNumber(sessionId, jid) {
    const sock = this._sessions.get(sessionId);
    if (!sock) throw Errors.sessionNotConnected(sessionId);

    const [result] = await sock.onWhatsApp(jid);
    return result || { exists: false };
  }

  async getQr(sessionId) {
    const meta = await sessionStore.get(sessionId);
    if (!meta) throw Errors.sessionNotFound(sessionId);
    if (!meta.qr) throw Errors.sessionQrExpired();
    return meta.qr;
  }

  async _createSocket(sessionId) {
    // Re-activating a session — clear any pending intentional-stop flag.
    this._intentionalStops.delete(sessionId);

    const authDir = this._authDir(sessionId);
    fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: makeBaileysLogger({ sessionId, component: 'baileys' }),
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 2000,
      defaultQueryTimeoutMs: 30000, // fetchProps gets 30s instead of default 3s
    });

    this._sessions.set(sessionId, sock);
    await sessionStore.updateState(sessionId, SESSION_STATES.CONNECTING);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      await this._handleConnectionUpdate(sessionId, sock, update);
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        this.emit(INTERNAL_EVENTS.SESSION_MESSAGE, { sessionId, message: msg });
      }
    });

    sock.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        this.emit(INTERNAL_EVENTS.SESSION_ACK, { sessionId, update });
      }
    });

    return sock;
  }

  async _handleConnectionUpdate(sessionId, sock, update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      await sessionStore.updateState(sessionId, SESSION_STATES.QR_READY, { qr });
      this.emit(INTERNAL_EVENTS.SESSION_QR, { sessionId, qr });
      logger.info('QR code ready', { sessionId });
    }

    if (connection === 'open') {
      const phone = sock.user?.id?.split(':')[0] || '';
      const name = sock.user?.name || '';
      await sessionStore.updateState(sessionId, SESSION_STATES.CONNECTED, {
        phone,
        name,
        qr: null,
        connectedAt: Date.now(),
      });
      await sessionStore.resetReconnectAttempts(sessionId);
      this.emit(INTERNAL_EVENTS.SESSION_STATE_CHANGE, {
        sessionId,
        state: SESSION_STATES.CONNECTED,
        phone,
        name,
      });
      logger.info('Session connected', { sessionId, phone });
    }

    if (connection === 'close') {
      // Intentional stop — socket was closed by stopSession(). Don't reconnect.
      if (this._intentionalStops.has(sessionId)) {
        this._intentionalStops.delete(sessionId);
        this._sessions.delete(sessionId);
        logger.info('Session closed by manual stop — not reconnecting', { sessionId });
        return;
      }

      const reason = reconnectManager.classifyReason(lastDisconnect);
      const shouldReconnect = reconnectManager.shouldReconnect(reason);

      logger.warn('Session disconnected', { sessionId, reason, willReconnect: shouldReconnect });

      await sessionStore.updateState(sessionId, SESSION_STATES.DISCONNECTED, {
        disconnectReason: reason,
        disconnectedAt: Date.now(),
      });

      this.emit(INTERNAL_EVENTS.SESSION_STATE_CHANGE, {
        sessionId,
        state: SESSION_STATES.DISCONNECTED,
        reason,
        willReconnect: shouldReconnect,
      });

      this._sessions.delete(sessionId);

      if (shouldReconnect) {
        await reconnectManager.scheduleReconnect(
          sessionId,
          (id) => this._createSocket(id),
          async (id) => {
            this.emit(INTERNAL_EVENTS.SESSION_STATE_CHANGE, {
              sessionId: id,
              state: SESSION_STATES.FAILED,
              willReconnect: false,
            });
          }
        );
      } else {
        if (reason === DISCONNECT_REASONS.LOGOUT) {
          await this._deleteAuthFiles(sessionId);
          await sessionStore.updateState(sessionId, SESSION_STATES.TERMINATED);
        } else {
          await sessionStore.updateState(sessionId, SESSION_STATES.FAILED);
        }
        this.emit(INTERNAL_EVENTS.SESSION_STATE_CHANGE, {
          sessionId,
          state: reason === DISCONNECT_REASONS.LOGOUT ? SESSION_STATES.TERMINATED : SESSION_STATES.FAILED,
          reason,
          willReconnect: false,
        });
      }
    }
  }

  _authDir(sessionId) {
    return path.join(env.session.dir, sessionId, 'auth_info');
  }

  async _deleteAuthFiles(sessionId) {
    const dir = path.join(env.session.dir, sessionId);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      logger.debug('Auth files deleted', { sessionId });
    } catch (err) {
      logger.warn('Failed to delete auth files', { sessionId, error: err.message });
    }
  }

  async shutdown() {
    logger.info('Shutting down session manager');
    for (const [sessionId, sock] of this._sessions.entries()) {
      try {
        sock.end();
        logger.debug('Session socket closed', { sessionId });
      } catch (_) {}
    }
    this._sessions.clear();
  }
}

module.exports = new SessionManager();
