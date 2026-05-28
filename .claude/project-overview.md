# AmrioxWA — Project Overview

## What Is This?

AmrioxWA is an internal WhatsApp microservice built for the Booking SaaS platform. It is a standalone Node.js service that handles all WhatsApp communication — session management, QR authentication, message sending/receiving, and webhook delivery.

It is NOT a public WhatsApp API platform. It is private infrastructure.

## Why Build It?

External solutions (OpenWA, WAHA) introduce:
- Dependency on third-party uptime
- Limited control over reconnect strategies
- Opaque session handling
- Costly per-message or subscription pricing
- No customization for SaaS-specific workflows

AmrioxWA gives full ownership of the WhatsApp layer.

## System Context

```
┌─────────────────────────────┐
│   Laravel Booking SaaS      │
│  (clinics, bookings, CRM)   │
│                             │
│  Calls REST APIs ───────────┼────────► AmrioxWA Node.js Service
│  Receives Webhooks ◄────────┼───────── (WhatsApp sessions)
└─────────────────────────────┘
```

## V1 Scope

### Included
- QR-based WhatsApp authentication
- Multi-session support (one per clinic/account)
- Session persistence and restore after restart
- Auto-reconnect with backoff
- Send text messages (via queue)
- Receive text messages (via webhook)
- Delivery status webhooks
- Session health monitoring
- REST API for all operations
- Docker deployment

### Explicitly Excluded (V1)
- Media messages (images, documents, audio, video)
- Voice notes
- AI chatbot / auto-reply
- Campaign broadcasting
- Shared inbox
- Analytics / reporting
- CRM features
- Group management
- WhatsApp Status / Stories
- Contact sync

## Key Engineering Priorities

1. **Stability** — long-running process without crashes
2. **Session recovery** — survive reboots, disconnects, and WhatsApp server drops
3. **Queue reliability** — no message loss on failures
4. **Observability** — structured logs, health endpoints, queue visibility
5. **Clean architecture** — modular, testable, maintainable code

## Related Documents

- [architecture.md](architecture.md) — system design and component map
- [phases/](phases/) — phased implementation roadmap
- [session-management.md](session-management.md) — session lifecycle and recovery
- [reconnect-strategy.md](reconnect-strategy.md) — reconnect and backoff logic
- [queue-management.md](queue-management.md) — BullMQ queue design
- [deployment.md](deployment.md) — Docker and production deployment
