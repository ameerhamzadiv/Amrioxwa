# Session Management

## Session Lifecycle

```
CREATE → INITIALIZING → CONNECTING → QR_READY
                                          │
                                    (scan QR)
                                          │
                                   AUTHENTICATED → CONNECTED
                                          │              │
                                     (logout)      (disconnect)
                                          │              │
                                    TERMINATED    RECONNECTING
                                                       │
                                                 (backoff retry)
                                                       │
                                                  CONNECTED (or FAILED)
```

## Session States

| State | Description |
|-------|-------------|
| `initializing` | Baileys client being created, auth being loaded |
| `connecting` | TCP connection to WhatsApp servers in progress |
| `qr_ready` | QR code generated, waiting for scan |
| `authenticated` | Credentials saved, device registered |
| `connected` | Fully operational, can send/receive |
| `disconnected` | Connection dropped, reconnect not yet attempted |
| `reconnecting` | Actively attempting to reconnect |
| `failed` | Max reconnect attempts exhausted |
| `terminated` | Intentionally logged out and cleaned up |

## Persistence

Session auth credentials are stored in:
```
./sessions/{sessionId}/auth_info/
```

This directory is mounted as a Docker volume so it survives container restarts.

Session metadata (state, phone, timestamps) is stored in Redis under:
```
session:{sessionId}   → hash of metadata
sessions:index        → set of all session IDs
```

## Restore on Startup

On service start:
1. Load all session IDs from Redis `sessions:index`
2. For each session with auth files present → restore Baileys client
3. If auth files missing but Redis entry exists → mark session as `failed`, notify via webhook
4. Restored sessions connect automatically (no QR needed if credentials valid)

## Multi-Device Support

Baileys multi-device mode is always enabled. Sessions use `makeWASocket` with `auth: useMultiFileAuthState(path)`.

## Memory Management

- Each Baileys session holds an in-memory store for message history
- Store is kept minimal — only last N messages per chat (configurable, default 50)
- On logout, store is cleared and auth files deleted
- On service restart, stores are rebuilt from received messages (not persisted)

## Session Isolation

- Each session has its own Baileys instance
- Sessions do not share state or event listeners
- Errors in one session do not affect others
- Each session has its own BullMQ queue: `messages:{sessionId}`

## Cleanup on Logout

On `DELETE /api/v1/sessions/:id`:
1. Call `sock.logout()`
2. Remove auth files from `./sessions/{sessionId}/`
3. Remove Redis session metadata
4. Drain and remove BullMQ queue for session
5. Remove socket.io room for session
6. Emit `session.terminated` webhook

## Session Health Check

Every 60 seconds (configurable), the health monitor:
1. Checks each active session's `sock.ws.readyState`
2. If `CLOSED` or `CLOSING`, marks as `disconnected` and triggers reconnect
3. Logs session stats (uptime, message counts, last activity)
