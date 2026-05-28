# Phase 6 — Observability, Hardening & Production Readiness

**Goal:** Service is fully observable, hardened for production, and ready for Laravel integration.

**Deliverables:**
- [ ] Structured log review — ensure all critical paths are logged
- [ ] `GET /api/v1/health/sessions` — full session health summary
- [ ] Session uptime, message counts, last activity in health response
- [ ] Error rate tracking per session
- [ ] Request ID propagation (X-Request-ID header through all logs)
- [ ] API documentation finalized (based on `.claude/api-conventions.md`)
- [ ] Integration test suite (happy path: create session → send → receive)
- [ ] Load test: 50 concurrent sessions, 100 messages/min
- [ ] Docker image optimization (layer caching, .dockerignore)
- [ ] Deployment runbook (`.claude/deployment.md` finalized)
- [ ] Laravel integration guide

**Success Criteria:**
- Service runs for 72 hours in staging without crashes
- All webhook events reliably delivered to Laravel
- Health endpoints return accurate data
- Can deploy new version without losing sessions (rolling update)
- All documented APIs match actual implementation

**This completes V1. V2 planning starts after production validation.**
