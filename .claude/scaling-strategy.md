# Scaling Strategy

## V1: Single Node (Current)

All sessions run in one Node.js process.

Capacity: ~50-100 concurrent WhatsApp sessions per process (limited by memory and event loop).

Bottlenecks at scale:
- Memory: each Baileys session ~50-100MB
- CPU: event loop handles all session events
- Redis connections: one pool shared across all sessions

**When to scale:** If session count exceeds 50 or message throughput exceeds ~500/min.

## V2: Horizontal Workers (Next)

Split session ownership across multiple worker processes/containers.

```
┌──────────────────┐
│   API Gateway    │  ← Single entry point (or load balancer)
└────────┬─────────┘
         │
    ┌────▼─────┐
    │  Redis   │  ← Session registry: which worker owns which session
    └────┬─────┘
         │
┌────────▼────────────────────────────────────┐
│  Worker 1        Worker 2        Worker 3   │
│  sessions:       sessions:       sessions:  │
│  clinic-1,2,3    clinic-4,5,6    clinic-7,8 │
└─────────────────────────────────────────────┘
```

API calls are routed to the correct worker via Redis session registry.

## Session Distribution

Sessions are assigned to workers using consistent hashing or simple modulo.

On worker failure:
1. Redis detects stale worker heartbeat
2. Another worker claims orphaned sessions
3. Sessions reconnect via auth files on shared volume

## Shared Storage

All workers must share:
- `./sessions/` volume (auth files) — use NFS or object storage (S3)
- Redis — already shared

## V3: Cloud-Native (Future)

- Kubernetes deployment
- Sessions as Redis-backed state machines
- Baileys clients in isolated pods
- Autoscaling on session count and queue depth

## Practical Guidance

For the initial Booking SaaS deployment:
- V1 handles 50-100 clinics without any changes
- Plan the shared volume before adding more processes
- Monitor memory per session: `GET /api/v1/health/sessions` reports memory usage
- Add V2 only when V1 genuinely hits limits — don't prematurely optimize
