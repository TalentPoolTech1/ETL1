# Logging & Tracing Framework — Requirements and Implementation Plan

> **Document status:** Draft v1.0  
> **Date:** 2026-03-01  
> **Scope:** ETL1 Backend — all service components

---

## 1. Purpose

Define a reusable, structured logging and tracing framework for the ETL1 backend that:

- Routes each component's log events to its own dedicated log file.
- Supports configurable log levels (`TRACE | DEBUG | INFO | WARN | ERROR | FATAL`).
- Produces machine-readable, structured JSON log lines so they can be ingested by any log aggregator (ELK, CloudWatch, Datadog, etc.) without changes.
- Provides trace correlation across service boundaries via a `correlationId` / `requestId` propagated through the request lifecycle.
- Requires zero boilerplate at the call site — a single import and a one-liner.

---

## 2. Log Levels

| Level | Numeric | When to Use |
|-------|---------|-------------|
| `TRACE` | 10 | Ultra-verbose step-by-step internals. Every function entry/exit, every SQL parameter. Dev/debugging only. |
| `DEBUG` | 20 | Intermediate values, branching decisions, resolved configs. Dev and staging. |
| `INFO`  | 30 | Normal operational events: service started, request received, record saved. |
| `WARN`  | 40 | Recoverable anomalies: retry attempted, deprecated path used, optional field missing. |
| `ERROR` | 50 | Handled failures: DB constraint violation, validation failure, downstream timeout. Always include stack trace. |
| `FATAL` | 60 | Unrecoverable: process crash imminent, DB connection pool exhausted. Triggers alert. |

Each service is started with `LOG_LEVEL=<level>` in its environment (or `.env`). The logger silently discards any event whose numeric value is below the configured threshold.

---

## 3. Service Components and Log Files

Each component writes **exclusively** to its own log file under a configurable `LOG_DIR` (default: `logs/`).

| Component | Log File | Logger Name |
|-----------|----------|-------------|
| Users & Auth | `logs/users.log` | `users` |
| Connections (Connectors) | `logs/connections.log` | `connections` |
| Metadata / Catalog | `logs/metadata.log` | `metadata` |
| Pipelines | `logs/pipelines.log` | `pipelines` |
| Executions / Runs | `logs/executions.log` | `executions` |
| Orchestrators | `logs/orchestrators.log` | `orchestrators` |
| Codegen Engine | `logs/codegen.log` | `codegen` |
| Governance / RBAC | `logs/governance.log` | `governance` |
| API / HTTP layer | `logs/api.log` | `api` |
| Database layer | `logs/db.log` | `db` |

> **Rule:** A logger instance is bound to exactly one file. Cross-component calls (e.g. a pipeline service calling the user service) each log to their own file with the shared `correlationId` linking them.

---

## 4. Structured Log Line Format (JSON)

Every log line is a single-line JSON object:

```json
{
  "ts":            "2026-03-01T10:23:45.123Z",
  "level":         "ERROR",
  "service":       "connections",
  "correlationId": "c7d3f1a2-...",
  "requestId":     "req-00421",
  "userId":        "usr-0099",
  "action":        "connections.create",
  "message":       "DB insert failed — unique constraint violation",
  "durationMs":    47,
  "meta": {
    "connectorType": "jdbc",
    "host":          "db.prod.internal"
  },
  "error": {
    "name":    "QueryFailedError",
    "message": "duplicate key value violates unique constraint ...",
    "stack":   "QueryFailedError: ...\n  at ..."
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `ts` | ✅ | ISO-8601 UTC timestamp |
| `level` | ✅ | String label of the log level |
| `service` | ✅ | Logger name (see table above) |
| `correlationId` | ✅ | End-to-end trace ID, propagated via HTTP header `X-Correlation-Id` |
| `requestId` | ✅ | Per-request UUID generated at API gateway entry |
| `userId` | when available | Extracted from JWT / session |
| `action` | ✅ | Dot-notation event name: `<service>.<verb>` |
| `message` | ✅ | Human-readable summary |
| `durationMs` | when timing | Elapsed time of the operation |
| `meta` | optional | Arbitrary key-value context (no PII, no secrets) |
| `error` | on ERROR/FATAL | Serialized Error object including stack |

---

## 5. Architecture

### 5.1 Core Abstraction — `ILogger` Interface

```
Backend/src/shared/logging/
├── ILogger.ts              ← Interface every logger must satisfy
├── LogLevel.ts             ← Enum + numeric helpers
├── LoggerFactory.ts        ← Factory: returns a named logger bound to its file
├── WinstonLogger.ts        ← Winston-backed implementation of ILogger
├── CorrelationContext.ts   ← AsyncLocalStorage context for correlationId / requestId / userId
└── index.ts                ← Re-exports
```

### 5.2 `ILogger` Interface

```typescript
export interface ILogger {
  trace(action: string, message: string, meta?: Record<string, unknown>): void;
  debug(action: string, message: string, meta?: Record<string, unknown>): void;
  info (action: string, message: string, meta?: Record<string, unknown>): void;
  warn (action: string, message: string, meta?: Record<string, unknown>): void;
  error(action: string, message: string, error?: Error, meta?: Record<string, unknown>): void;
  fatal(action: string, message: string, error?: Error, meta?: Record<string, unknown>): void;
  child(extraMeta: Record<string, unknown>): ILogger;  // returns a scoped child logger
}
```

### 5.3 `LoggerFactory`

```typescript
// Usage anywhere in the codebase:
import { LoggerFactory } from '@shared/logging';
const log = LoggerFactory.get('connections');

log.info('connections.create', 'Connector saved', { connectorType: 'jdbc' });
log.error('connections.test', 'Connection test failed', err, { host: 'db.prod' });
```

`LoggerFactory.get(serviceName)` is idempotent — it creates a Winston logger the first time and caches it. Each logger instance has exactly one `winston.transports.File` pointing to `${LOG_DIR}/${serviceName}.log` and, if `LOG_CONSOLE=true`, a `Console` transport as well (useful in development).

### 5.4 Correlation Context

`CorrelationContext` uses Node's built-in `AsyncLocalStorage` to make the `correlationId`, `requestId`, and `userId` available anywhere in the async call chain without passing them through every function signature.

```typescript
// Middleware sets it once per request:
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] as string ?? uuidv4();
  const requestId     = uuidv4();
  CorrelationContext.run({ correlationId, requestId, userId: req.user?.userId }, next);
});

// Any logger automatically reads from context — zero extra params needed.
log.info('pipelines.save', 'Pipeline IR saved');
// → log line includes correlationId and requestId automatically
```

### 5.5 Log Rotation

`winston-daily-rotate-file` is used for each transport:
- Rotates daily and when file size exceeds 100 MB.
- Retains 30 days of compressed archives.
- Archived files: `logs/connections.2026-03-01.log.gz`

---

## 6. Configuration

All settings are driven by environment variables (`.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `INFO` | Minimum level to emit (TRACE/DEBUG/INFO/WARN/ERROR/FATAL) |
| `LOG_DIR` | `logs/` | Directory for all log files (relative to project root) |
| `LOG_CONSOLE` | `false` | Also print to stdout (useful in development) |
| `LOG_MAX_SIZE` | `100m` | Max file size before rotation |
| `LOG_RETENTION_DAYS` | `30` | Days to retain archived log files |

---

## 7. Implementation Plan

### Phase 1 — Foundation (Sprint 1)

| Task | File(s) | Notes |
|------|---------|-------|
| Define `LogLevel` enum | `src/shared/logging/LogLevel.ts` | Numeric thresholds + string labels |
| Define `ILogger` interface | `src/shared/logging/ILogger.ts` | Full method signatures |
| Implement `CorrelationContext` | `src/shared/logging/CorrelationContext.ts` | `AsyncLocalStorage` wrapper |
| Implement `WinstonLogger` | `src/shared/logging/WinstonLogger.ts` | Reads from `CorrelationContext`, writes structured JSON |
| Implement `LoggerFactory` | `src/shared/logging/LoggerFactory.ts` | Cache + factory |
| Add `index.ts` re-exports | `src/shared/logging/index.ts` | Clean public API |
| Install dependencies | `package.json` | `winston`, `winston-daily-rotate-file` |
| Add path alias `@shared` | `tsconfig.json` | `"@shared/*": ["src/shared/*"]` |

### Phase 2 — Middleware Integration (Sprint 1)

| Task | File(s) |
|------|---------|
| Add `correlationId` middleware | `src/api/middleware/correlation.middleware.ts` |
| Add request/response logging middleware | `src/api/middleware/request-logger.middleware.ts` |
| Wire middlewares into `server.ts` | `src/api/server.ts` |

### Phase 3 — Per-Service Adoption (Sprint 2)

Adopt the logger in each service module in the order listed. Each adoption is a single `LoggerFactory.get('<service>')` call at the top of the service file, replacing any `console.log` / `console.error` statements.

| Component | Primary Files |
|-----------|--------------|
| Users & Auth | `src/services/users/` (to be created) |
| Connections | `src/services/connections/` (to be created) |
| Metadata / Catalog | `src/services/metadata/` (to be created) |
| Pipelines | `src/services/pipelines/` + `src/codegen/codegen.service.ts` |
| Executions | `src/services/executions/` (to be created) |
| Orchestrators | `src/services/orchestrators/` (to be created) |
| Governance / RBAC | `src/services/governance/` (to be created) |
| DB layer | `src/db/connection.ts` + repositories |

### Phase 4 — Observability Hardening (Sprint 3)

| Task | Notes |
|------|-------|
| Structured error serializer | Safely serializes circular refs, hides internal stack details in production |
| Redaction middleware | Strips PII / secrets from `meta` before writing (e.g. passwords, tokens) |
| Health-check log endpoint | `GET /internal/log-level` — returns current level; `PUT` allows runtime level change without restart |
| Unit tests | Jest tests for `WinstonLogger`, `CorrelationContext`, and `LoggerFactory` |
| Integration tests | Assert correct log file routing per service |

---

## 8. Call-Site Usage Examples

### 8.1 Users Service

```typescript
import { LoggerFactory } from '@shared/logging';
const log = LoggerFactory.get('users');

async function createUser(dto: CreateUserDto) {
  log.info('users.create', 'Creating new user', { email: dto.email });
  try {
    const user = await userRepository.insert(dto);
    log.info('users.create', 'User created', { userId: user.user_id });
    return user;
  } catch (err) {
    log.error('users.create', 'Failed to create user', err as Error, { email: dto.email });
    throw err;
  }
}
```

→ All events go to `logs/users.log` only.

### 8.2 Connections Service

```typescript
import { LoggerFactory } from '@shared/logging';
const log = LoggerFactory.get('connections');

async function testConnection(connId: string) {
  log.debug('connections.test', 'Testing connection', { connId });
  // ...
  log.warn('connections.test', 'Connection latency high', { latencyMs: 2400 });
}
```

→ All events go to `logs/connections.log` only.

### 8.3 Codegen Service (existing)

```typescript
import { LoggerFactory } from '@shared/logging';
const log = LoggerFactory.get('codegen');

// Replace existing console.log / console.error calls:
log.trace('codegen.generate', 'Node resolved', { nodeType, engine });
log.error('codegen.generate', 'IR parse failed', err);
```

→ All events go to `logs/codegen.log` only.

### 8.4 Scoped Child Logger (per-request)

```typescript
const reqLog = log.child({ pipelineId: 'pip-001', runId: 'run-042' });
reqLog.info('executions.run', 'Spark job submitted');
// → log line includes pipelineId and runId in every entry, automatically
```

---

## 9. Reusability Contract

Any new service or module added to the platform in future must:

1. Call `LoggerFactory.get('<service-name>')` at module scope — one per service file.
2. Use the returned `ILogger` instance throughout that module.
3. Never call `console.log`, `console.error`, or any other ad-hoc logging mechanism.
4. Never pass the logger instance across service boundaries — each service owns its own instance.
5. Always include an `action` string in `<service>.<verb>` format.
6. Never put PII or secrets in `meta`. Redact or omit before logging.

---

## 10. Dependencies to Add

```json
"dependencies": {
  "winston":                    "^3.11.0",
  "winston-daily-rotate-file":  "^4.7.1"
}
```

No other third-party logging libraries are needed. The `ILogger` interface ensures the concrete implementation (Winston) can be swapped out later (e.g. for Pino) without touching any service code.

---

## 11. File Creation Summary

All files to be created or edited are on the Backend:

```
Backend/src/shared/logging/
├── ILogger.ts
├── LogLevel.ts
├── LoggerFactory.ts
├── WinstonLogger.ts
├── CorrelationContext.ts
└── index.ts

Backend/src/api/middleware/
├── correlation.middleware.ts      (new)
└── request-logger.middleware.ts   (new)

Backend/logs/                      (gitignored directory, auto-created at runtime)
```

`Backend/.gitignore` must include:
```
logs/
```
