# Phase 4 — Message Sending & Queues

**Goal:** Send text messages via queue with retry, delivery tracking, and rate limiting.

**Deliverables:**
- [ ] Message queue per session (`messages:{sessionId}`)
- [ ] Message queue worker (`src/workers/message.worker.js`)
- [ ] `POST /api/v1/sessions/:id/messages` — enqueue message
- [ ] Message deduplication (idempotency key support)
- [ ] Rate limiting: max 20 messages/min per session
- [ ] Delivery status tracking via Baileys ack events
- [ ] Webhook: `message.queued`, `message.sent`, `message.delivered`, `message.failed`
- [ ] Dead-letter handling (after max retries)
- [ ] `GET /api/v1/health/queues` — queue stats endpoint

**Success Criteria:**
- Message sent via API appears in WhatsApp within 5 seconds (normal conditions)
- Failed send is retried 3 times before dead-letter
- Service restart does NOT lose queued messages
- `message.delivered` webhook fires when recipient receives message

**What is NOT in this phase:**
- Inbound message handling
- Number checking
