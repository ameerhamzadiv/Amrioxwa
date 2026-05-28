# Deployment Guide

## Prerequisites

- Docker 24+
- Docker Compose v2
- 1GB+ RAM (2GB recommended for 10+ sessions)
- Persistent storage for sessions volume

## First-Time Setup

```bash
# 1. Clone / copy the project
cd /opt/amrioxwa

# 2. Create environment file
cp .env.example .env
# Edit .env — set INTERNAL_API_KEY, WEBHOOK_URL, WEBHOOK_SECRET

# 3. Create required directories
mkdir -p sessions logs

# 4. Start services
docker compose up -d

# 5. Check health
curl http://localhost:3000/api/v1/health
```

## Environment Variables Reference

See `.env.example` for all variables. Required:

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` or `development` |
| `PORT` | HTTP port (default: 3000) |
| `INTERNAL_API_KEY` | 32+ char random key for API auth |
| `REDIS_URL` | Redis connection URL |
| `WEBHOOK_URL` | Laravel webhook endpoint |
| `WEBHOOK_SECRET` | HMAC secret for webhook signatures |
| `SESSION_DIR` | Path to store session auth files |

## Deployment Commands

```bash
# Start all services
docker compose up -d

# Stop all services (sessions preserved)
docker compose down

# View logs
docker compose logs -f amrioxwa

# Restart only the Node.js service (keep Redis)
docker compose restart amrioxwa

# Update to new version
docker compose pull
docker compose up -d --no-deps --build amrioxwa

# Scale workers (V2)
docker compose up -d --scale amrioxwa=3
```

## Health Monitoring

```bash
# Service health
curl -H "X-API-Key: $KEY" http://localhost:3000/api/v1/health

# All session statuses
curl -H "X-API-Key: $KEY" http://localhost:3000/api/v1/health/sessions

# Queue stats
curl -H "X-API-Key: $KEY" http://localhost:3000/api/v1/health/queues
```

## Backup & Recovery

### What to Backup
- `./sessions/` directory — WhatsApp auth credentials
- `.env` file — configuration

### Recovery After Data Loss
If sessions are lost, all active WhatsApp sessions will need to re-authenticate via QR scan. No message history is lost (it lives in WhatsApp/Laravel), only the session credentials.

## Log Access

```bash
# Live logs
docker compose logs -f amrioxwa

# Application log files (on host)
tail -f ./logs/app.log
tail -f ./logs/error.log
```

## Firewall Rules

Only expose port 3000 to Laravel's server IP. Do not expose publicly.

```bash
# Example UFW rule
ufw allow from <LARAVEL_SERVER_IP> to any port 3000
```

## Process Management

PM2 runs inside the container and manages:
- Automatic restart on crash (within container)
- Memory limit enforcement (restart if > 512MB)
- Log rotation

Docker Compose manages:
- Container-level restart (`restart: unless-stopped`)
- Health checks
- Network isolation
