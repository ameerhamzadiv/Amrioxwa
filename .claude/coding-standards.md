# Coding Standards

## Language

- Node.js 20+ LTS
- CommonJS modules (`.js` files, `require/module.exports`)
- No TypeScript in V1 — keep the stack simple and deployable without a build step
- ESLint with a standard config

## File Naming

- `kebab-case` for all file names: `session-manager.js`, `message.service.js`
- Suffix conventions:
  - `*.service.js` — business logic, no HTTP concerns
  - `*.controller.js` — HTTP handler, thin layer, delegates to service
  - `*.repository.js` — data access layer (Redis, file)
  - `*.worker.js` — BullMQ queue worker
  - `*.middleware.js` — Express middleware
  - `*.validator.js` — Joi/Zod request validation schemas
  - `*.routes.js` — Express router definitions

## Code Style

- 2-space indentation
- Single quotes for strings
- Semicolons required
- Max line length: 120 characters
- `async/await` over callbacks and `.then()` chains
- Explicit error handling — never swallow errors silently
- No `console.log` in production code — use the logger

## Module Exports

```js
// Services: export a singleton instance
class SessionService { ... }
module.exports = new SessionService();

// Utilities: export plain functions
module.exports = { formatPhone, normalizeJid };

// Controllers: export the router
const router = express.Router();
module.exports = router;
```

## Error Handling

All async functions must handle errors and pass them up the chain:

```js
// In services — throw typed errors
const { AppError } = require('../utils/errors');
throw new AppError('SESSION_NOT_FOUND', 'Session does not exist', 404);

// In controllers — catch and pass to Express error handler
try {
  const result = await sessionService.create(data);
  res.json({ success: true, data: result });
} catch (err) {
  next(err);
}
```

## Logging

- Use the shared logger, never `console.*`
- Always include context: `{ sessionId, action, ... }`
- Log at appropriate levels: `debug` for trace, `info` for normal ops, `warn` for recoverable issues, `error` for failures

```js
const logger = require('../utils/logger');
logger.info('Session connected', { sessionId, phone });
logger.error('Failed to send message', { sessionId, to, error: err.message });
```

## Constants

- Define all magic strings and numbers as named constants in `src/config/constants.js`
- Never hardcode queue names, event names, or status strings inline

## Environment Variables

- All config comes from environment variables via `src/config/env.js`
- Validate all required env vars at startup — fail fast if missing
- Never access `process.env` directly outside `src/config/env.js`

## No Over-Engineering

- Build only what the current phase requires
- No premature abstractions — three similar lines is fine
- No feature flags
- No backwards-compatibility shims
- Delete dead code; don't comment it out
