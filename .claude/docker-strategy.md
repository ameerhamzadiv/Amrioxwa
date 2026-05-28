# Docker Strategy

## Container Architecture

```
docker-compose.yml
├── amrioxwa       — Node.js WhatsApp service
└── redis          — Redis for queues + session metadata
```

Optional in staging/prod:
```
├── redis-commander  — Redis GUI (dev only)
└── bull-board       — Queue dashboard (dev only)
```

## Volumes

| Volume | Purpose |
|--------|---------|
| `./sessions:/app/sessions` | WhatsApp auth credentials (survives restart) |
| `./logs:/app/logs` | Application logs |
| `redis_data:/data` | Redis persistence |

**Critical:** The `sessions` volume must be preserved across deployments. Losing it means all sessions need to re-authenticate (new QR scan).

## Environment Handling

- Development: `.env` file
- Production: environment variables injected by Docker/CI
- `.env.example` is the reference — always keep it in sync

## Build Strategy

Multi-stage build is NOT used in V1 (no build step for CommonJS). Single-stage Dockerfile.

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
USER node
EXPOSE 3000
CMD ["node", "src/app.js"]
```

## Production Deployment

For production, PM2 is used inside the container for process management:
```dockerfile
CMD ["npx", "pm2-runtime", "pm2.config.js"]
```

PM2 provides:
- Crash restart within the container
- Memory limit enforcement
- Log management
- Graceful reload

Docker provides:
- Container-level restart policy (`unless-stopped`)
- Health check monitoring
- Network isolation

## Health Check

Docker health check configured in `docker-compose.yml`:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/v1/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Networking

All services on a private Docker network (`amrioxwa_net`). Only the Node.js service port (3000) is published to the host.

Redis is NOT published to the host in production.

## Upgrade Strategy

1. Build new image
2. `docker-compose up -d --no-deps --build amrioxwa`
3. Docker starts new container, old one stops gracefully
4. Sessions volume is shared — no re-authentication needed

Zero-downtime upgrades are possible because WhatsApp sessions survive restarts (auth files persist on volume).
