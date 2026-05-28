'use strict';

const { randomUUID } = require('crypto');
const sessionManager = require('../sessions/session-manager');
const messageService = require('../services/message.service');
const { isValidPhone, toJid } = require('../utils/phone');
const { Errors } = require('../utils/errors');

// ── In-memory webhook store ──────────────────────────────────────────────────
// Map<sessionId, Array<{id, url, events, hmac}>>
// Resets on server restart — Laravel re-registers on boot so this is fine.
const webhookStore = new Map();

// ── Helper: normalise session object for Laravel ─────────────────────────────
// Laravel expects { id, name, ... } — we use sessionId as both.
function normalizeSession(session) {
  if (!session) return session;
  return {
    id:   session.sessionId ?? session.id,
    name: session.sessionId ?? session.id,
    ...session,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Session CRUD
// ─────────────────────────────────────────────────────────────────────────────

async function createSession(req, res, next) {
  try {
    // Accept `name` (Laravel) or `sessionId` (native)
    const sessionId = req.body.name ?? req.body.sessionId;
    const session = await sessionManager.createSession(sessionId);
    res.status(201).json({ success: true, data: normalizeSession(session) });
  } catch (err) {
    next(err);
  }
}

async function listSessions(req, res, next) {
  try {
    const sessions = await sessionManager.getAllSessions();
    res.json({ success: true, data: sessions.map(normalizeSession) });
  } catch (err) {
    next(err);
  }
}

async function getSession(req, res, next) {
  try {
    const session = await sessionManager.getSession(req.params.sessionId);
    res.json({ success: true, data: normalizeSession(session) });
  } catch (err) {
    next(err);
  }
}

async function getQr(req, res, next) {
  try {
    const qr = await sessionManager.getQr(req.params.sessionId);
    // Return both `qr` (native) and `qrCode` (Laravel compat)
    res.json({ success: true, data: { qr, qrCode: qr } });
  } catch (err) {
    next(err);
  }
}

async function logoutSession(req, res, next) {
  try {
    await sessionManager.logoutSession(req.params.sessionId);
    res.json({ success: true, data: { message: 'Session terminated' } });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

async function restartSession(req, res, next) {
  try {
    const session = await sessionManager.restartSession(req.params.sessionId);
    res.json({ success: true, data: normalizeSession(session) });
  } catch (err) {
    next(err);
  }
}

// POST /:sessionId/start — create if missing, restart if already exists
async function startSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    let session;
    try {
      session = await sessionManager.getSession(sessionId);
      session = await sessionManager.restartSession(sessionId);
    } catch {
      session = await sessionManager.createSession(sessionId);
    }
    res.json({ success: true, data: normalizeSession(session) });
  } catch (err) {
    next(err);
  }
}

// POST /:sessionId/stop — terminate session (auth files kept on disk for restart)
async function stopSession(req, res, next) {
  try {
    await sessionManager.logoutSession(req.params.sessionId);
    res.json({ success: true, data: { message: 'Session stopped' } });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Messaging
// ─────────────────────────────────────────────────────────────────────────────

// Native: POST /messages  { to, message }
async function sendMessage(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { to, message, idempotencyKey } = req.body;
    const result = await messageService.enqueue(sessionId, to, message, idempotencyKey);
    res.status(202).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Laravel compat: POST /messages/send-text  { chatId, text }
async function sendText(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { chatId, text, idempotencyKey } = req.body;
    // Strip @c.us / @s.whatsapp.net suffix if present — messageService expects raw digits
    const to = chatId.replace(/@[^@]+$/, '');
    const result = await messageService.enqueue(sessionId, to, text, idempotencyKey);
    res.status(202).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Number check
// ─────────────────────────────────────────────────────────────────────────────

// Native: GET /numbers/:phone/check  → { exists, jid }
async function checkNumber(req, res, next) {
  try {
    const { sessionId, phone } = req.params;
    if (!isValidPhone(phone)) return next(Errors.invalidPhone(phone));
    const result = await sessionManager.checkNumber(sessionId, toJid(phone));
    res.json({ success: true, data: { phone, exists: result?.exists || false, jid: result?.jid } });
  } catch (err) {
    next(err);
  }
}

// Laravel compat: GET /contacts/check/:phone  → { exists, whatsappId }
async function checkContact(req, res, next) {
  try {
    const { sessionId, phone } = req.params;
    const digits = phone.replace(/\D/g, '');
    if (!isValidPhone(digits)) return next(Errors.invalidPhone(digits));
    const result = await sessionManager.checkNumber(sessionId, toJid(digits));
    res.json({
      success: true,
      data: {
        phone:       digits,
        exists:      result?.exists || false,
        whatsappId:  result?.jid ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhooks (in-memory, Laravel compat)
// ─────────────────────────────────────────────────────────────────────────────

function listWebhooks(req, res) {
  const hooks = webhookStore.get(req.params.sessionId) ?? [];
  res.json({ success: true, data: hooks });
}

function createWebhook(req, res) {
  const { sessionId } = req.params;
  const { url, events, hmac } = req.body;
  const hook = { id: randomUUID(), url, events, hmac: hmac ?? null, createdAt: Date.now() };
  const hooks = webhookStore.get(sessionId) ?? [];
  hooks.push(hook);
  webhookStore.set(sessionId, hooks);
  res.status(201).json({ success: true, data: hook });
}

function deleteWebhook(req, res) {
  const { sessionId, hookId } = req.params;
  const hooks = (webhookStore.get(sessionId) ?? []).filter(h => h.id !== hookId);
  webhookStore.set(sessionId, hooks);
  res.json({ success: true, data: { message: 'Webhook deleted' } });
}

module.exports = {
  createSession,
  listSessions,
  getSession,
  getQr,
  logoutSession,
  restartSession,
  startSession,
  stopSession,
  sendMessage,
  sendText,
  checkNumber,
  checkContact,
  listWebhooks,
  createWebhook,
  deleteWebhook,
};
