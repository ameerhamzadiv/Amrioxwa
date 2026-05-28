# Phase 5 — Inbound Messages & Number Check

**Goal:** Receive WhatsApp messages and deliver them to Laravel via webhook. Check number registration.

**Deliverables:**
- [ ] Inbound message handler (Baileys `messages.upsert` event)
- [ ] Message deduplication (ignore duplicate events from Baileys)
- [ ] Webhook delivery for inbound messages (`message.received`)
- [ ] Webhook queue with retry (`webhooks` queue)
- [ ] HMAC signature on all webhook payloads
- [ ] `GET /api/v1/sessions/:id/numbers/:phone/check` — is number on WhatsApp?
- [ ] Filter: ignore group messages, broadcast, status messages (V1 is 1:1 only)
- [ ] Handle read receipts (mark message as read after delivery to webhook)

**Success Criteria:**
- Sending a WhatsApp message to the session phone → `message.received` webhook fires in Laravel
- Webhook signature verifiable by Laravel
- Failed webhook delivery is retried 5 times
- Number check returns correct result

**What is NOT in this phase:**
- Media handling (ignore media messages or acknowledge without processing)
- Group message handling
