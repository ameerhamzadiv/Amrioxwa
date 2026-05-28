# Security Rules

## API Authentication

All endpoints (except `/api/v1/health`) require:
```
X-API-Key: <INTERNAL_API_KEY>
```

The key is a 32+ character random string set via environment variable. Never hardcoded.

Middleware rejects unauthorized requests with `401 UNAUTHORIZED` before any business logic runs.

## Webhook Signature Verification

All outbound webhooks are signed:
```
X-Webhook-Signature: sha256=<hmac-hex>
```

Signature is HMAC-SHA256 of the raw JSON body using `WEBHOOK_SECRET` env var.

Laravel must verify this signature before processing webhook payloads.

## Environment Variables

- All secrets in `.env` — never committed to git
- `.env.example` committed with placeholder values only
- `src/config/env.js` validates all required vars at startup and throws if any are missing

## Input Validation

All API request bodies are validated with Joi schemas before reaching controllers.

Phone numbers are normalized and validated before being used as JIDs.

## Rate Limiting

Default limits (configurable via env):
- Global: 200 requests per minute per IP
- Send message: 60 requests per minute per session

Rate limit middleware uses Redis for distributed counting.

## Session File Security

Auth state files (`./sessions/*/auth_info/`) contain sensitive WhatsApp credentials.
- Docker volume should be mounted with restricted permissions
- Never expose the sessions directory via HTTP
- Never log auth credential content

## No Exposed Internal State

- Queue admin UI (`/admin/queues`) is disabled in production unless `ADMIN_ENABLED=true`
- If enabled, the admin UI must be protected by `ADMIN_KEY` header check
- Internal Redis keys are never exposed via API responses

## Dependency Security

- Keep dependencies updated; run `npm audit` regularly
- Pin major versions in `package.json`
- Review Baileys release notes for security fixes

## Docker Security

- Run as non-root user in container (see Dockerfile)
- No `--privileged` flag
- Expose only the necessary port (3000)
- Redis not exposed on host network in production

## Secrets Checklist

Never commit or log:
- `INTERNAL_API_KEY`
- `WEBHOOK_SECRET`
- `REDIS_PASSWORD`
- Session auth files
- Any WhatsApp credentials
