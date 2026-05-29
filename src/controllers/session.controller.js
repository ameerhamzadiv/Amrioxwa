'use strict';

const { randomUUID } = require('crypto');
const QRCode = require('qrcode');
const sessionManager = require('../sessions/session-manager');
const messageService = require('../services/message.service');
const { isValidPhone, toJid } = require('../utils/phone');
const { Errors } = require('../utils/errors');

// ── In-memory webhook store ──────────────────────────────────────────────────
// Map<sessionId, Array<{id, url, events, hmac}>>
// Resets on server restart — Laravel re-registers on boot so this is fine.
const webhookStore = new Map();

// ── State → WAHA-compatible status mapping ───────────────────────────────────
// Laravel's normalizeStatus() expects WAHA status values (ready, qr_ready, etc.)
function toWahaStatus(state) {
  switch (state) {
    case 'connected':
    case 'authenticated': return 'ready';
    case 'qr_ready':      return 'qr_ready';
    case 'initializing':
    case 'connecting':
    case 'reconnecting':  return 'initializing';
    case 'failed':        return 'failed';
    default:              return 'stopped'; // disconnected, terminated, unknown
  }
}

// ── Flatten session for Laravel ───────────────────────────────────────────────
// Laravel reads response keys directly (no {success,data} wrapper).
// Also adds `status` (WAHA style) alongside `state`, and builds `me` object.
function normalizeSession(session) {
  if (!session) return session;
  const sid = session.sessionId ?? session.id;
  const out = {
    ...session,
    id:     sid,
    name:   sid,
    status: toWahaStatus(session.state ?? session.status ?? ''),
  };
  // Build `me` object when phone is known (Baileys stores it after connect)
  if (session.phone && !out.me) {
    out.me = {
      phone:    session.phone,
      id:       session.phone,
      pushName: session.name ?? '',
    };
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session CRUD
// ─────────────────────────────────────────────────────────────────────────────

async function createSession(req, res, next) {
  try {
    const sessionId = req.body.name ?? req.body.sessionId;
    const session = await sessionManager.createSession(sessionId);
    res.status(201).json(normalizeSession(session));
  } catch (err) {
    next(err);
  }
}

async function listSessions(req, res, next) {
  try {
    const sessions = await sessionManager.getAllSessions();
    // Return plain array — Laravel's normalizeList() detects array_is_list and uses it directly
    res.json(sessions.map(normalizeSession));
  } catch (err) {
    next(err);
  }
}

async function getSession(req, res, next) {
  try {
    const session = await sessionManager.getSession(req.params.sessionId);
    res.json(normalizeSession(session));
  } catch (err) {
    next(err);
  }
}

async function getQr(req, res, next) {
  try {
    const raw = await sessionManager.getQr(req.params.sessionId);
    // Convert raw Baileys QR string → base64 PNG data URL for the frontend
    const dataUrl = await QRCode.toDataURL(raw);
    res.json({ qr: dataUrl, qrCode: dataUrl });
  } catch (err) {
    next(err);
  }
}

async function logoutSession(req, res, next) {
  try {
    await sessionManager.logoutSession(req.params.sessionId);
    res.json({ message: 'Session terminated' });
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
    res.json(normalizeSession(session));
  } catch (err) {
    next(err);
  }
}

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
    res.json(normalizeSession(session));
  } catch (err) {
    next(err);
  }
}

async function stopSession(req, res, next) {
  try {
    await sessionManager.logoutSession(req.params.sessionId);
    res.json({ message: 'Session stopped' });
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
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
}

async function sendText(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { chatId, text, idempotencyKey } = req.body;
    const to = chatId.replace(/@[^@]+$/, '');
    const result = await messageService.enqueue(sessionId, to, text, idempotencyKey);
    res.status(202).json(result);
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
    res.json({ phone, exists: result?.exists || false, jid: result?.jid });
  } catch (err) {
    next(err);
  }
}

async function checkContact(req, res, next) {
  try {
    const { sessionId, phone } = req.params;
    const digits = phone.replace(/\D/g, '');
    if (!isValidPhone(digits)) return next(Errors.invalidPhone(digits));
    const result = await sessionManager.checkNumber(sessionId, toJid(digits));
    res.json({ phone: digits, exists: result?.exists || false, whatsappId: result?.jid ?? null });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhooks (in-memory, Laravel compat)
// ─────────────────────────────────────────────────────────────────────────────

function listWebhooks(req, res) {
  const hooks = webhookStore.get(req.params.sessionId) ?? [];
  res.json(hooks);
}

function createWebhook(req, res) {
  const { sessionId } = req.params;
  const { url, events, hmac } = req.body;
  const hook = { id: randomUUID(), url, events, hmac: hmac ?? null, createdAt: Date.now() };
  const hooks = webhookStore.get(sessionId) ?? [];
  hooks.push(hook);
  webhookStore.set(sessionId, hooks);
  res.status(201).json(hook);
}

function deleteWebhook(req, res) {
  const { sessionId, hookId } = req.params;
  const hooks = (webhookStore.get(sessionId) ?? []).filter(h => h.id !== hookId);
  webhookStore.set(sessionId, hooks);
  res.json({ message: 'Webhook deleted' });
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
