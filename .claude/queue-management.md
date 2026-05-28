# Queue Management

## Overview

All outbound messages go through BullMQ queues backed by Redis. This ensures:
- No message loss on service restart
- Controlled retry behavior
- Backpressure management
- Visibility into pending/failed jobs

## Queue Architecture

One queue per session:
```
messages:{sessionId}   → outbound messages for that session
webhooks               → outbound webhook deliveries to Laravel
```

Using per-session queues provides:
- Isolation: one slow session doesn't block others
- Ordered delivery within a session
- Independent scaling of workers per session

## Message Queue

### Job Structure
```json
{
  "sessionId": "clinic-1",
  "to": "971501234567@s.whatsapp.net",
  "type": "text",
  "content": { "text": "Your appointment is confirmed." },
  "messageId": "uuid-v4",
  "laravelJobId": "optional-reference"
}
```

### Retry Policy
- Max attempts: 3
- Backoff: exponential, starting at 2 seconds
- Dead-letter: failed jobs move to `messages:{sessionId}:failed`

### Worker Behavior
- Concurrency: 1 per session (preserves order, avoids rate-limiting)
- Before processing: check session is `connected`; if not, delay job 30s and re-queue
- Rate limiting: max 20 messages/minute per session (WhatsApp limit awareness)

## Webhook Queue

### Job Structure
```json
{
  "event": "message.received",
  "sessionId": "clinic-1",
  "payload": { ... },
  "webhookUrl": "https://saas.example.com/webhooks/whatsapp",
  "signature": "hmac-sha256-hex"
}
```

### Retry Policy
- Max attempts: 5
- Backoff: exponential, starting at 1 second
- If Laravel returns 2xx → complete
- If Laravel returns 4xx → dead-letter immediately (no retry — bad config)
- If Laravel returns 5xx or timeout → retry

## Queue Monitoring

BullMQ Board (Bull-Board) is available at `/admin/queues` in development.

Health endpoint `/api/v1/health/queues` returns:
```json
{
  "queues": {
    "messages:clinic-1": {
      "waiting": 0,
      "active": 1,
      "completed": 452,
      "failed": 2,
      "delayed": 0
    }
  }
}
```

## Dead-Letter Handling

Failed jobs (exceeded retries) are logged with full context and emitted as `message.failed` webhook so Laravel can handle failure (e.g., mark message as failed in the UI).

Admin can inspect and retry via `POST /api/v1/admin/queues/{queue}/retry-failed`.

## Graceful Shutdown

On `SIGTERM`:
1. Stop accepting new API requests
2. Allow in-flight queue jobs to complete (up to 30 seconds)
3. Pause queue workers
4. Close Redis connections
5. Exit process
