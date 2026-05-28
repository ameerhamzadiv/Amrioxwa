# Logging Strategy

## Logger

Winston with JSON output. All logs are structured JSON — never unstructured strings.

## Log Levels

| Level | When |
|-------|------|
| `error` | Unrecoverable errors, exceptions, job failures |
| `warn` | Recoverable issues, retries, degraded state |
| `info` | Normal lifecycle events (session connected, message sent) |
| `debug` | Detailed trace for development/troubleshooting |
| `http` | Every inbound HTTP request |

Production default: `info`. Development default: `debug`.

## Log Format

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Message sent",
  "service": "amrioxwa",
  "sessionId": "clinic-1",
  "to": "971501234567",
  "messageId": "abc-123",
  "durationMs": 245
}
```

All log entries include:
- `timestamp` — ISO 8601
- `level` — log level
- `message` — short human-readable description
- `service` — always `"amrioxwa"`
- Context fields — relevant IDs and metadata

## Log Transports

### Development
- Console (colorized, pretty-printed)

### Production
- Console (JSON) — captured by Docker/PM2
- File: `./logs/app.log` — all levels, 7-day rotation, 10MB max per file
- File: `./logs/error.log` — error level only, 30-day retention

## Logger Usage

```js
const logger = require('../utils/logger');

// Always include context
logger.info('Session created', { sessionId });
logger.error('Failed to send message', { sessionId, to, error: err.message, stack: err.stack });
logger.warn('Session reconnecting', { sessionId, attempt, delayMs });
logger.debug('Queue job picked up', { sessionId, jobId, to });
```

**Never use `console.log/warn/error` in application code.**

## Request Logging

Morgan-style HTTP logging via custom middleware:

```json
{
  "level": "http",
  "message": "POST /api/v1/sessions/clinic-1/messages 202",
  "method": "POST",
  "path": "/api/v1/sessions/clinic-1/messages",
  "statusCode": 202,
  "responseTimeMs": 12,
  "requestId": "req-uuid"
}
```

## Queue Logging

Every job lifecycle event is logged:

```json
{ "level": "info", "message": "Job started", "queue": "messages:clinic-1", "jobId": "42", "sessionId": "clinic-1" }
{ "level": "info", "message": "Job completed", "queue": "messages:clinic-1", "jobId": "42", "durationMs": 310 }
{ "level": "error", "message": "Job failed", "queue": "messages:clinic-1", "jobId": "42", "attempt": 2, "error": "..." }
```

## Session Logging

```json
{ "level": "info", "message": "Session connecting", "sessionId": "clinic-1" }
{ "level": "info", "message": "Session QR ready", "sessionId": "clinic-1" }
{ "level": "info", "message": "Session authenticated", "sessionId": "clinic-1", "phone": "971501234567" }
{ "level": "warn", "message": "Session disconnected", "sessionId": "clinic-1", "reason": "connection failure" }
{ "level": "info", "message": "Session reconnected", "sessionId": "clinic-1", "attempt": 2 }
```

## Log File Locations

```
./logs/
  app.log         — rotating application log
  error.log       — error-only rotating log
```

Mounted as a Docker volume: `./logs:/app/logs`
