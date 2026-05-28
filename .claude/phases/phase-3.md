# Phase 3 — Reconnect & Stability

**Goal:** Sessions survive disconnects. Auto-reconnect with backoff. Service is production-stable.

**Deliverables:**
- [ ] Reconnect manager with exponential backoff + jitter
- [ ] Disconnect reason classification (logout vs network drop vs bad session)
- [ ] Session failure state after max reconnect attempts
- [ ] `POST /api/v1/sessions/:id/restart` — manual restart
- [ ] Reconnect metrics tracked in session metadata
- [ ] Webhook: `session.reconnecting`, `session.failed`
- [ ] Queue behavior during reconnect (jobs held, not dropped)
- [ ] PM2 ecosystem config (`pm2.config.js`)
- [ ] Graceful shutdown with in-flight job drain

**Success Criteria:**
- Killing the network connection → session auto-reconnects within 30 seconds
- After max attempts → session marked `failed`, webhook fired
- Restarting the service → sessions reconnect from auth files automatically
- PM2 restarts the process on crash within 5 seconds

**What is NOT in this phase:**
- Message sending
- Inbound message handling
