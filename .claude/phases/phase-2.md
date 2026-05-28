# Phase 2 — Session Management & QR Authentication

**Goal:** Create, authenticate, and persist WhatsApp sessions via Baileys.

**Deliverables:**
- [ ] Baileys integration (`src/sessions/`)
- [ ] Session store (in-memory + Redis metadata)
- [ ] Session state machine (initializing → connected → disconnected → etc.)
- [ ] QR code generation and delivery via Socket.io
- [ ] Auth state persistence to filesystem
- [ ] Session restore on service startup
- [ ] `POST /api/v1/sessions` — create session
- [ ] `GET /api/v1/sessions` — list all sessions
- [ ] `GET /api/v1/sessions/:id` — session status
- [ ] `GET /api/v1/sessions/:id/qr` — get QR code
- [ ] `DELETE /api/v1/sessions/:id` — logout session
- [ ] Session health monitor (periodic check of connection state)
- [ ] Webhook: `session.qr`, `session.connected`, `session.disconnected`

**Success Criteria:**
- Can create a session via API
- QR code delivered via Socket.io in real-time
- After scan, session state becomes `connected`
- Service restart restores session without re-scanning QR
- Logout cleans up all session data

**What is NOT in this phase:**
- Message sending
- Auto-reconnect (handled in Phase 3)
