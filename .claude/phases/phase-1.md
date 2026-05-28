# Phase 1 — Foundation & Core Infrastructure

**Goal:** Runnable service with Redis, BullMQ, structured logging, config validation, and health endpoint.

**Deliverables:**
- [ ] Project scaffold (package.json, folder structure)
- [ ] Environment validation at startup (`src/config/env.js`)
- [ ] Redis connection with reconnect handling
- [ ] Winston logger with JSON output and file rotation
- [ ] Express app with request logging and error handling
- [ ] API key authentication middleware
- [ ] Rate limiting middleware
- [ ] BullMQ setup — queue factory and base worker
- [ ] Health check endpoint (`GET /api/v1/health`)
- [ ] Graceful shutdown handler
- [ ] Dockerfile + docker-compose.yml
- [ ] `.env.example`

**Success Criteria:**
- `docker compose up` starts without errors
- `GET /api/v1/health` returns 200
- Logs output as structured JSON
- Missing env var at startup causes a clear error message and exit

**What is NOT in this phase:**
- Any WhatsApp / Baileys code
- Session management
- Message sending
