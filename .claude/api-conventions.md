# API Conventions

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

All requests must include:
```
X-API-Key: <internal_api_key>
```

The key is set via `INTERNAL_API_KEY` environment variable.

## Request Format

- `Content-Type: application/json`
- All request bodies are JSON

## Response Format

All responses use a consistent envelope:

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Success with pagination
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session with ID 'clinic-1' does not exist",
    "statusCode": 404
  }
}
```

## HTTP Status Codes

| Code | When |
|------|------|
| 200 | Successful GET, PUT, PATCH |
| 201 | Successful POST (resource created) |
| 202 | Request accepted, processing async |
| 400 | Validation error, bad request |
| 401 | Missing or invalid API key |
| 404 | Resource not found |
| 409 | Conflict (e.g., session already exists) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Error Codes

| Code | Meaning |
|------|---------|
| `SESSION_NOT_FOUND` | Session ID does not exist |
| `SESSION_EXISTS` | Session with this ID already created |
| `SESSION_NOT_CONNECTED` | Session exists but WhatsApp is not connected |
| `SESSION_QR_EXPIRED` | QR code has expired, need to regenerate |
| `INVALID_PHONE` | Phone number format is invalid |
| `MESSAGE_QUEUE_FULL` | Queue is at capacity |
| `VALIDATION_ERROR` | Request body failed validation |
| `UNAUTHORIZED` | Missing or invalid API key |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Unexpected server error |

## Endpoints

### Sessions

```
POST   /api/v1/sessions              Create a new session
GET    /api/v1/sessions              List all sessions
GET    /api/v1/sessions/:id          Get session status
GET    /api/v1/sessions/:id/qr       Get QR code (base64 or image)
DELETE /api/v1/sessions/:id          Logout and remove session
POST   /api/v1/sessions/:id/restart  Restart a session
```

### Messages

```
POST   /api/v1/sessions/:id/messages  Send a message (enqueue)
```

### Numbers

```
GET    /api/v1/sessions/:id/numbers/:phone/check  Check if number is on WhatsApp
```

### Health

```
GET    /api/v1/health              Service health check
GET    /api/v1/health/queues       Queue stats
GET    /api/v1/health/sessions     All session statuses summary
```

## Phone Number Format

Always use international format without `+` or spaces:

```
971501234567   ✓
+971 50 123 4567  ✗
0501234567  ✗
```

The service normalizes JIDs automatically: `971501234567@s.whatsapp.net`

## Webhook Events (Outbound to Laravel)

All webhooks POST to `WEBHOOK_URL` with signature header `X-Webhook-Signature`.

### Event: `session.qr`
```json
{
  "event": "session.qr",
  "sessionId": "clinic-1",
  "data": { "qr": "data:image/png;base64,..." }
}
```

### Event: `session.connected`
```json
{
  "event": "session.connected",
  "sessionId": "clinic-1",
  "data": { "phone": "971501234567", "name": "Clinic Name" }
}
```

### Event: `session.disconnected`
```json
{
  "event": "session.disconnected",
  "sessionId": "clinic-1",
  "data": { "reason": "connection_failure", "willReconnect": true }
}
```

### Event: `message.received`
```json
{
  "event": "message.received",
  "sessionId": "clinic-1",
  "data": {
    "messageId": "ABCD1234",
    "from": "971501234567",
    "body": "Hello, I'd like to book",
    "timestamp": 1700000000
  }
}
```

### Event: `message.delivered`
```json
{
  "event": "message.delivered",
  "sessionId": "clinic-1",
  "data": {
    "messageId": "ABCD1234",
    "to": "971509876543",
    "status": "delivered",
    "timestamp": 1700000000
  }
}
```
