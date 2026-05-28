'use strict';

const PHONE_REGEX = /^\d{7,15}$/;

function normalizePhone(phone) {
  return String(phone).replace(/\D/g, '');
}

function isValidPhone(phone) {
  const normalized = normalizePhone(phone);
  return PHONE_REGEX.test(normalized);
}

function toJid(phone) {
  const normalized = normalizePhone(phone);
  return `${normalized}@s.whatsapp.net`;
}

function fromJid(jid) {
  return jid.split('@')[0];
}

module.exports = { normalizePhone, isValidPhone, toJid, fromJid };
