# Architecture

## High-Level Design

AmrioxWA is a single Node.js process (multi-worker capable) that manages multiple WhatsApp sessions simultaneously via Baileys.

```
┌──────────────────────────────────────────────────────────┐
│                     AmrioxWA Service                      │
│                                                          │
│  ┌─────────────┐    ┌──────────────┐   ┌─────────────┐  │
│  │  Express.js  │    │  Session     │   │  BullMQ     │  │
│  │  REST API    │───►│  Manager     │   │  Queue      │  │
│  │             │    │             │   │  Workers    │  │
│  └─────────────┘    └──────┬───────┘   └──────┬──────┘  │
│                            │                  │          │
│  ┌─────────────┐    ┌──────▼───────┐   ┌──────▼──────┐  │
│  │  Socket.io  │    │  Baileys     │   │  Redis      │  │
│  │  WebSocket  │    │  WA Client   │   │  (state +   │  │
│  │             │    │  (per session│   │   queues)   │  │
│  └─────────────┘    └─────────────┘   └─────────────┘  │
└──────────────────────────────────────────────────────────┘
           │                                  ▲
           ▼ Webhooks                         │ API calls
┌──────────────────┐               ┌──────────────────────┐
│  Laravel SaaS    │               │  Laravel SaaS        │
│  (receiver)      │               │  (caller)            │
└──────────────────┘               └──────────────────────┘
```

## Component Responsibilities

### Express.js REST API
- Receives commands from Laravel (create session, send message, etc.)
- Validates and authenticates requests
- Delegates to services, never directly touches Baileys

### Session Manager (`src/sessions/`)
- Owns the lifecycle of each WhatsApp session
- Creates, restores, monitors, and terminates Baileys clients
- Emits internal events on connection state changes
- Tracks session metadata in Redis

### Baileys Client
- One instance per WhatsApp session
- Handles QR generation, authentication, message send/receive
- Auth credentials persisted to disk and/or Redis

### BullMQ Queues (`src/queues/`)
- All outbound messages go through a queue
- Retries on failure with exponential backoff
- Dead-letter queue for permanently failed jobs
- Separate queue per session for isolation

### Webhook Dispatcher (`src/services/webhook.service.js`)
- Sends events to Laravel's configured webhook URL
- Retries failed webhook deliveries
- Signs payloads with HMAC for security

### Socket.io (`src/websocket/`)
- Real-time QR code delivery to frontend
- Session status updates
- Internal event bus bridge

### Redis
- Session metadata store
- BullMQ backing store
- Auth state persistence (optional)

## Data Flow — Outbound Message

```
Laravel POST /api/sessions/:id/messages
    │
    ▼
Express Controller (validate, auth)
    │
    ▼
Message Service (enqueue)
    │
    ▼
BullMQ Queue (message-{sessionId})
    │
    ▼
Queue Worker (dequeue, send)
    │
    ▼
Baileys Client.sendMessage()
    │
    ▼
WhatsApp Servers
    │
    ▼
Delivery callback → Webhook to Laravel
```

## Data Flow — Inbound Message

```
WhatsApp Servers → Baileys (messages.upsert event)
    │
    ▼
Session Event Handler
    │
    ▼
Webhook Dispatcher
    │
    ▼
Laravel POST /webhooks/whatsapp (message.received)
```

## Session States

```
INITIALIZING → CONNECTING → QR_READY → AUTHENTICATED
                                              │
                               ┌─────────────┴──────────────┐
                               │                            │
                           CONNECTED                  DISCONNECTED
                               │                            │
                               └──── auto-reconnect ────────┘
                                          │
                                     TERMINATED (logout)
```

## Technology Choices

| Concern | Choice | Reason |
|---|---|---|
| WhatsApp protocol | Baileys | Best maintained WA Web library, multi-device |
| Queue | BullMQ + Redis | Reliable, battle-tested, great observability |
| Auth persistence | `makeInMemoryStore` + file auth | Simple, reliable for V1 |
| Logging | Winston | Structured JSON logs, transports, rotation |
| Process manager | PM2 | Cluster mode, crash recovery, log management |
| Containerization | Docker | Reproducible deployment |

## Scaling Approach (V1 → V2)

V1: Single Node.js process, multiple Baileys sessions in-memory.
V2: Horizontal scaling — sessions distributed across worker pods, Redis as coordination layer.

See [scaling-strategy.md](scaling-strategy.md) for details.
