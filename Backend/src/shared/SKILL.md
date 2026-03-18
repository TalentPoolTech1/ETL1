# SKILL.md — Shared Infrastructure (Logging + Errors + Security)
**Service Domain:** `shared`  
**Last Updated:** 2026-03-17  
**Scope:** Cross-cutting concerns used by ALL services

> **Read before touching logging, error handling, or security utilities.**  
> Every change, user decision, or architectural rule must be appended to the  
> **"Living Decisions"** section at the bottom of this file.

---

## Purpose

Houses the logging framework, error catalog, error serialiser, and security utilities
that every service depends on. Changes here have platform-wide impact.

---

## File Map

```
Backend/src/shared/
├── logging/
│   ├── ILogger.ts              — Logger interface
│   ├── LogLevel.ts             — LogLevel enum: TRACE DEBUG INFO WARN ERROR FATAL
│   ├── LoggerFactory.ts        — Factory: LoggerFactory.get('service-name')
│   ├── WinstonLogger.ts        — Winston implementation (writes to logs/<service>.log)
│   ├── CorrelationContext.ts   — AsyncLocalStorage for correlationId + requestId
│   └── index.ts                — Re-exports
├── errors/
│   ├── AppError.ts             — AppError class
│   ├── AppErrors.ts            — Namespace facade: AppErrors.usr.*, AppErrors.conn.*, etc.
│   ├── ErrorClass.ts           — ErrorClass enum
│   ├── ErrorSerializer.ts      — Serialises AppError → HTTP response body
│   ├── errorHandler.middleware.ts — Global Express error handler
│   ├── index.ts                — Re-exports
│   └── catalog/
│       ├── conn.errors.ts      — CONN-* factories
│       ├── cgen.errors.ts      — CGEN-* factories
│       ├── exec.errors.ts      — EXEC-* factories
│       ├── gov.errors.ts       — GOV-* factories
│       ├── meta.errors.ts      — META-* factories
│       ├── orch.errors.ts      — ORCH-* factories
│       ├── pipe.errors.ts      — PIPE-* factories
│       ├── sys.errors.ts       — SYS-* factories
│       └── usr.errors.ts       — USR-* factories
├── security/
│   └── encryption.utils.ts     — Application-layer encryption helpers
└── types/
    └── api.types.ts            — Shared API response types (ProjectHierarchyNode, etc.)
```

---

## Logging Rules (MANDATORY for all services)

1. **No `console.log` / `console.error` anywhere in Backend.** Zero exceptions.
2. **One logger per service, at module scope:**
   ```typescript
   const log = LoggerFactory.get('connections');
   ```
3. **Supported service names** (determines log file name under `logs/`):
   `users` | `connections` | `metadata` | `pipelines` | `executions` | `orchestrators` | `codegen` | `governance` | `api` | `db`
4. **Every log call must include an `action` string** in `<service>.<verb>` format:
   ```typescript
   log.info('connections.create', 'Creating connector', { connectorId, typeCode });
   log.warn('connections.test', 'Test failed', { connectorId, error: err.message });
   log.error('connections.delete', 'Unexpected error', { err: String(err) });
   ```
5. **`correlationId` and `requestId` are auto-injected** by `CorrelationContext` (AsyncLocalStorage).
   Never pass them manually in the `meta` object.
6. **No PII or secrets in `meta`** — redact email addresses, passwords, tokens before logging.
7. Log level from `process.env.LOG_LEVEL`. Levels: `TRACE` < `DEBUG` < `INFO` < `WARN` < `ERROR` < `FATAL`.
8. The `logs/` directory is gitignored and created at runtime by Winston.

---

## Error Handling Rules (MANDATORY for all services)

1. **No raw exceptions ever reach the API response.** Every catch block wraps into `AppError`.
2. **Use domain error catalogs** — never invent ad-hoc error strings:
   ```typescript
   // CORRECT
   throw connErrors.notFound(connectorId);

   // WRONG
   throw new Error('connector not found');
   throw new AppError({ code: 'CONN-001', ... }); // inline — only in catalog files
   ```
3. **Two messages, always different:**
   - `userMessage` — plain English for API consumer. No internals, no stack traces.
   - `internalMessage` — full technical context for the log file.
4. **Error class → HTTP status mapping:**
   ```
   VALIDATION         → 400
   AUTHENTICATION     → 401
   AUTHORIZATION      → 403
   NOT_FOUND          → 404
   CONFLICT           → 409
   EXTERNAL_DEPENDENCY → 503
   INTERNAL           → 500
   ```
5. **Log level by error class:**
   - `VALIDATION / NOT_FOUND / CONFLICT / AUTH*` → `WARN`
   - `EXTERNAL_DEPENDENCY / INTERNAL` → `ERROR`
6. **`correlationId` in response** for `INTERNAL` and `EXTERNAL_DEPENDENCY` errors.
7. **Global error handler** (`errorHandler.middleware.ts`) owns all logging + responding.
   Service catch blocks only throw — never call `res.json()` in a catch.
8. **Never reuse a retired error code number.** Mark retired codes as `// DEPRECATED`.

---

## AppError Shape

```typescript
new AppError({
  code: 'CONN-001',              // Domain-NNN format
  errorClass: ErrorClass.NOT_FOUND,
  userMessage: 'Connector not found.',
  internalMessage: `Connector ${id} not in catalog.connectors`,
  meta: { connectorId: id },     // No PII here
  cause: originalError,          // Optional: original Error object
  alertable: false,              // If true: triggers alert (PagerDuty etc.)
})
```

---

## Adding a New Error Code

1. Open the relevant catalog file (e.g. `conn.errors.ts`)
2. Add factory function following the established pattern
3. Assign the next available `CONN-NNN` number (never reuse)
4. Update the SKILL.md for that service's error code table
5. If a new domain: create `<domain>.errors.ts` + register in `AppErrors.ts`

---

## Security Utilities (`encryption.utils.ts`)

Application-layer helpers that supplement the DB-level `pgp_sym_encrypt`. Use these
for any encryption operations needed outside of a PostgreSQL transaction context.

**Rule:** DB columns requiring encryption (`conn_config_json_encrypted`, `conn_secrets_json_encrypted`,
`secret_value_encrypted`, `mfa_secret_encrypted`) must ALWAYS use the DB-level functions
(`pgp_sym_encrypt` / `pgp_sym_decrypt`) inside a transaction with `app.encryption_key` set.
Never use application-layer encryption for DB-stored values.

---

## Shared API Types (`api.types.ts`)

Types shared across multiple services. Before adding a new shared type here,
ensure it genuinely belongs at the shared level (used by 2+ services).

---

## Known Issues & Tech Debt

| Issue | Severity | Notes |
|---|---|---|
| `executions.routes.ts` and `orchestrators.routes.ts` have ZERO logging (no `log` variable) | HIGH | Add `LoggerFactory.get('executions')` / `get('orchestrators')` |
| `pipeline.routes.ts` inline handlers have no logging | HIGH | Add `LoggerFactory.get('pipelines')` |
| `projects.routes.ts` uses `LoggerFactory.get('api')` instead of `'projects'` — wrong service name | MEDIUM | Change to `'projects'` to route logs to `logs/projects.log` |
| Several route files use raw `next(err)` without wrapping in `AppError` | HIGH | All catch blocks must map to domain error codes |
| `projects.service.ts` uses inline `AppError` with hardcoded `'PROJ-001'` instead of catalog | HIGH | Create `proj.errors.ts` |
| `api.types.ts` needs audit — may contain outdated types referencing old schema | MEDIUM | Audit after legacy pipeline repository is removed |

---

## Living Decisions

> Append every user decision, architectural ruling, or critical instruction here.

- `2026-03-17` — SKILL.md created. Logging framework and error catalog are fully
  implemented. Not all services are using them correctly (see Known Issues).
- `2026-03-17` — **Zero console.log Rule:** This is absolute. Even temporary debug
  statements must use `log.debug(...)`. No exceptions ever.
- `2026-03-17` — **Correlation Rule:** `correlationId` flows from `correlation.middleware.ts`
  through `CorrelationContext` (AsyncLocalStorage) automatically. Never pass it as a
  function parameter or include it manually in log `meta`.
- `2026-03-17` — **Error Boundary Rule:** The global `errorHandler.middleware.ts` is the
  ONLY place that calls `res.json()` for errors. Every service catch block ONLY throws.
