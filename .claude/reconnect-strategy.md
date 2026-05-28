# Reconnect Strategy

## Design Goals

- Sessions should recover automatically from transient network failures
- Avoid hammering WhatsApp servers (risk of ban)
- Give up gracefully after too many failures and notify Laravel
- Never lose messages that were queued before disconnect

## Disconnect Causes

| Cause | Baileys Reason | Action |
|-------|----------------|--------|
| Transient network drop | `connection failure` | Reconnect with backoff |
| WhatsApp server restart | `server restart` | Reconnect immediately |
| Logged out from phone | `logged out` | Mark terminated, no reconnect |
| QR expired without scan | `qr timeout` | Reset session, emit event |
| Multi-device conflict | `conflict` | Reconnect after short delay |
| Bad session state | `bad session` | Delete auth, require fresh QR |

## Exponential Backoff

```
Attempt 1: wait  5 seconds
Attempt 2: wait 10 seconds
Attempt 3: wait 20 seconds
Attempt 4: wait 40 seconds
Attempt 5: wait 60 seconds
Attempts 6+: wait 120 seconds (cap)
Max attempts: 10 (then mark as FAILED)
```

Jitter of ±20% is applied to avoid thundering herd if multiple sessions reconnect simultaneously.

## Implementation

The reconnect logic lives in `src/sessions/reconnect-manager.js`:

```js
// Pseudocode
async function handleDisconnect(sessionId, reason) {
  if (isLogout(reason)) return terminateSession(sessionId);
  if (isBadSession(reason)) return clearAuthAndNotify(sessionId);

  const attempt = incrementAttempt(sessionId);
  if (attempt > MAX_ATTEMPTS) return markFailed(sessionId);

  const delay = calculateBackoff(attempt);
  await sleep(delay + jitter());
  await reconnectSession(sessionId);
}
```

## Queue Behavior During Reconnect

- BullMQ jobs are NOT removed when session disconnects
- Jobs remain in `waiting` state in the queue
- When session reconnects, worker resumes processing automatically
- Jobs that were `active` (in-flight) at disconnect time are retried

## Reconnect vs Restart

| Situation | Action |
|-----------|--------|
| Session disconnects (network) | Auto-reconnect via backoff |
| Session enters `failed` state | Requires manual restart via API or admin |
| Service process crashes | PM2 restarts process, sessions restore from auth files |
| Container restart | Docker volume preserves auth, sessions restore on startup |

## Webhook Notifications

| Event | Fired when |
|-------|-----------|
| `session.disconnected` | Connection drops, `willReconnect: true` |
| `session.reconnecting` | Reconnect attempt starting, includes `attempt` number |
| `session.connected` | Session successfully reconnected |
| `session.failed` | Max attempts exhausted, `willReconnect: false` |

Laravel should use `session.failed` to alert the clinic admin to rescan QR.
