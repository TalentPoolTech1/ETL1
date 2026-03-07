# Error Standards and Message Catalog

> **Document status:** Draft v1.0  
> **Date:** 2026-03-01  
> **Scope:** ETL1 Backend — all service components  
> **Companion doc:** `Docs/Logging_Framework_Requirements_and_Plan.md`

---

## 1. Why This Document Exists

A raw technology error like:

```
QueryFailedError: duplicate key value violates unique constraint "catalog_connectors_conn_display_name_key"
  at PostgresQueryRunner.query (.../typeorm/...)
```

is meaningless to a data engineer using the platform. Worse, it leaks internal implementation details — table names, constraint names, ORM internals — to the API consumer.

This document defines:

1. **Error classification** — what kind of error is it, and who is responsible?
2. **Error code catalog** — a stable, human-readable code for every known failure condition, keyed by domain.
3. **Error message standards** — what the message must say, to whom, and at what level of detail.
4. **The error transformation pipeline** — how a raw technical error becomes a structured `AppError`, gets logged internally with full detail, and surfaces to the API consumer with only the information they need.
5. **Implementation files** — the concrete TypeScript structures that enforce all of the above.

---

## 2. Core Principle: Two Audiences, Two Messages

Every error has two completely different consumers:

| Audience | Needs | What they see |
|----------|-------|---------------|
| **End user / API consumer** | A clear, actionable message. What went wrong, what they can do about it. No internals. | `userMessage` in the API response body |
| **Developer / Ops / Support** | Full technical context: raw exception, SQL, stack trace, correlationId. | `internalMessage` + full stack in the log file |

These two messages are **always different**. The rule is simple:

> **`userMessage` is written for a data engineer who has never seen the source code.**  
> **`internalMessage` is written for the engineer who wrote the failing code.**

---

## 3. Error Classification

Every error in the system belongs to one of four classes. The class drives the HTTP status, the log level, and the support action.

### 3.1 `VALIDATION` — Client sent invalid input

- **Cause:** Bad request body, missing required field, field fails a domain rule.
- **Responsibility:** Caller. The server behaved correctly.
- **HTTP status:** `400 Bad Request`
- **Log level:** `WARN` (it is expected and recoverable; no stack trace needed)
- **User message tone:** Precise and specific — tell the user exactly which field is wrong and why.

### 3.2 `NOT_FOUND` — Requested resource does not exist

- **Cause:** ID in URL does not match any record.
- **Responsibility:** Caller.
- **HTTP status:** `404 Not Found`
- **Log level:** `WARN`
- **User message tone:** Confirm what was looked for; suggest they check the ID or list the resource.

### 3.3 `CONFLICT` — Action violates a business or data integrity rule

- **Cause:** Duplicate name, state machine violation, referential integrity block.
- **Responsibility:** Caller.
- **HTTP status:** `409 Conflict`
- **Log level:** `WARN`
- **User message tone:** Explain the conflict precisely; tell them how to resolve it.

### 3.4 `AUTHORIZATION` — User lacks permission

- **Cause:** JWT valid, but the user's role does not grant the operation on this resource.
- **Responsibility:** Caller.
- **HTTP status:** `403 Forbidden`
- **Log level:** `WARN`
- **User message tone:** Generic — never reveal what roles exist or what the resource contains.

### 3.5 `AUTHENTICATION` — Identity not established

- **Cause:** Missing token, expired token, invalid signature.
- **Responsibility:** Caller.
- **HTTP status:** `401 Unauthorized`
- **Log level:** `WARN`
- **User message tone:** Generic — tell them to log in again.

### 3.6 `EXTERNAL_DEPENDENCY` — A downstream system failed

- **Cause:** Database unreachable, Spark cluster timeout, object storage unavailable, connector target unreachable.
- **Responsibility:** Infrastructure / Ops.
- **HTTP status:** `503 Service Unavailable` (or `502 Bad Gateway` for upstream failures)
- **Log level:** `ERROR` with full technical details
- **User message tone:** Acknowledge the failure, reference the correlationId for support, do not expose the internal system name or error.

### 3.7 `INTERNAL` — Unexpected programmer error

- **Cause:** Unhandled exception, null dereference, assertion failure, code bug.
- **Responsibility:** Engineering team.
- **HTTP status:** `500 Internal Server Error`
- **Log level:** `ERROR` (or `FATAL` if the process cannot continue)
- **User message tone:** Generic. Never expose any internals. Always include correlationId so support can trace.

---

## 4. `AppError` — The Canonical Error Object

All service code throws `AppError` instances. Raw exceptions from ORMs, drivers, and third-party libraries are caught at the boundary and wrapped into an `AppError` before propagating.

### 4.1 Shape

```typescript
export class AppError extends Error {
  /** Stable domain-keyed code from the catalog (Section 5). */
  readonly code: string;

  /** Error classification (Section 3). */
  readonly errorClass: ErrorClass;

  /** HTTP status code to return to the caller. */
  readonly httpStatus: number;

  /** What the API consumer sees. Plain English. No internals. */
  readonly userMessage: string;

  /** What goes into the log file. Full technical context. */
  readonly internalMessage: string;

  /** Arbitrary structured context for the log (no PII, no secrets). */
  readonly meta: Record<string, unknown>;

  /** The original raw error that caused this (DB error, fetch error, etc.). */
  readonly cause?: Error;

  /** Set to true for errors that should trigger an alert (FATAL / EXTERNAL_DEPENDENCY). */
  readonly alertable: boolean;
}
```

### 4.2 Construction

```typescript
throw new AppError({
  code:            'CONN-003',
  errorClass:      ErrorClass.CONFLICT,
  userMessage:     'A connection named "Prod Warehouse" already exists. Choose a different name.',
  internalMessage: 'DB unique constraint violation on catalog_connectors.conn_display_name',
  meta:            { connDisplayName: 'Prod Warehouse', connectorType: 'jdbc' },
  cause:           originalDbError,
});
```

### 4.3 Error Factory — `AppErrors`

Rather than constructing `AppError` inline everywhere, every known error condition is defined as a factory function in a central `AppErrors` namespace. Call-sites become one-liners:

```typescript
// Instead of a raw AppError constructor:
throw AppErrors.connections.duplicateName('Prod Warehouse');

// Instead of letting the DB error bubble:
throw AppErrors.connections.testFailed(connId, originalError);
```

This ensures the code catalog (Section 5) is the single source of truth and no one can invent ad-hoc error messages in service files.

---

## 5. Error Code Catalog

### 5.1 Code Format

```
<DOMAIN>-<NNN>
```

- `DOMAIN` — 3–5 uppercase letters identifying the service domain.
- `NNN` — zero-padded three-digit number within that domain, starting at `001`.

Codes are **stable and never reused**. If an error condition is retired, its code is tombstoned in the catalog with a `deprecated` flag — not reassigned.

### 5.2 Domain Prefixes

| Prefix | Domain |
|--------|--------|
| `USR`  | Users & Authentication |
| `CONN` | Connections (Connectors) |
| `META` | Metadata / Catalog |
| `PIPE` | Pipelines |
| `EXEC` | Executions / Pipeline Runs |
| `ORCH` | Orchestrators |
| `CGEN` | Codegen Engine |
| `GOV`  | Governance / RBAC |
| `DB`   | Database Layer |
| `SYS`  | System / Infrastructure |

---

### 5.3 Users & Auth — `USR`

| Code | Class | HTTP | User Message | Internal Note |
|------|-------|------|--------------|---------------|
| `USR-001` | `VALIDATION` | 400 | "Email address is required." | Missing `user_email` in request |
| `USR-002` | `VALIDATION` | 400 | "The email address format is invalid." | Failed RFC-5322 regex |
| `USR-003` | `CONFLICT` | 409 | "An account with this email address already exists." | Unique constraint on `gov.users.user_email` |
| `USR-004` | `VALIDATION` | 400 | "Password must be at least 12 characters and include a number and a special character." | Password policy failure |
| `USR-005` | `AUTHENTICATION` | 401 | "Incorrect email or password. Please try again." | Credential mismatch — keep generic to avoid enumeration |
| `USR-006` | `AUTHENTICATION` | 401 | "Your session has expired. Please log in again." | JWT `exp` exceeded |
| `USR-007` | `AUTHENTICATION` | 401 | "Your access token is invalid. Please log in again." | JWT signature invalid or malformed |
| `USR-008` | `NOT_FOUND` | 404 | "User not found." | `gov.users` lookup miss |
| `USR-009` | `AUTHORIZATION` | 403 | "You do not have permission to perform this action." | Role check failed |
| `USR-010` | `VALIDATION` | 400 | "First name is required." | Missing `user_first_name` |
| `USR-011` | `VALIDATION` | 400 | "Last name is required." | Missing `user_last_name` |
| `USR-012` | `CONFLICT` | 409 | "This user already has the role '{role}' on this project." | Duplicate `gov.project_user_roles` entry |
| `USR-013` | `VALIDATION` | 400 | "Invalid role. Allowed roles are: Viewer, Editor, Admin." | Unknown role code |
| `USR-014` | `INTERNAL` | 500 | "An unexpected error occurred while processing your account. Please try again. If this persists, contact support with reference {correlationId}." | Unhandled error in user service |

---

### 5.4 Connections — `CONN`

| Code | Class | HTTP | User Message | Internal Note |
|------|-------|------|--------------|---------------|
| `CONN-001` | `VALIDATION` | 400 | "Connection name is required." | Missing `conn_display_name` |
| `CONN-002` | `VALIDATION` | 400 | "Connection type is required. Supported types: JDBC, S3, GCS, ADLS, Kafka, Hive, Iceberg, Delta." | Missing `connector_type_code` |
| `CONN-003` | `CONFLICT` | 409 | "A connection named '{name}' already exists. Please choose a different name." | Unique constraint on `conn_display_name` |
| `CONN-004` | `NOT_FOUND` | 404 | "Connection not found. It may have been deleted." | `catalog.connectors` lookup miss |
| `CONN-005` | `EXTERNAL_DEPENDENCY` | 503 | "Could not reach the data source. Please verify the host, port, and network settings, then try again. (Ref: {correlationId})" | TCP/socket connect timeout or refused |
| `CONN-006` | `EXTERNAL_DEPENDENCY` | 503 | "Authentication to the data source failed. Please check the credentials stored in this connection. (Ref: {correlationId})" | Driver-level auth rejection |
| `CONN-007` | `EXTERNAL_DEPENDENCY` | 503 | "The data source connection test timed out after {timeoutSec}s. Check that the host is reachable from this environment. (Ref: {correlationId})" | Test-connection timeout |
| `CONN-008` | `VALIDATION` | 400 | "Host is required for this connection type." | Missing host field |
| `CONN-009` | `VALIDATION` | 400 | "Port must be a number between 1 and 65535." | Invalid port |
| `CONN-010` | `AUTHORIZATION` | 403 | "You do not have permission to view or edit this connection." | Resource-level role check failed |
| `CONN-011` | `CONFLICT` | 409 | "This connection cannot be deleted because it is used by {count} dataset(s). Remove those datasets first." | FK constraint from `catalog.datasets` |
| `CONN-012` | `VALIDATION` | 400 | "Connection string format is invalid for the selected connector type." | Malformed JDBC URL or connection string |
| `CONN-013` | `INTERNAL` | 500 | "An unexpected error occurred while saving the connection. (Ref: {correlationId})" | Unhandled error in connections service |

---

### 5.5 Metadata / Catalog — `META`

| Code | Class | HTTP | User Message | Internal Note |
|------|-------|------|--------------|---------------|
| `META-001` | `NOT_FOUND` | 404 | "Dataset not found. It may have been deleted or moved." | `catalog.datasets` lookup miss |
| `META-002` | `CONFLICT` | 409 | "A dataset named '{name}' already exists in this connection." | Unique constraint on `dataset_display_name` + `connector_id` |
| `META-003` | `VALIDATION` | 400 | "Dataset name is required." | Missing `dataset_display_name` |
| `META-004` | `EXTERNAL_DEPENDENCY` | 503 | "Schema discovery failed. Could not read table structure from the data source. (Ref: {correlationId})" | Remote schema introspection error |
| `META-005` | `CONFLICT` | 409 | "This dataset cannot be deleted because it is referenced by {count} pipeline(s)." | FK from `catalog.pipeline_dataset_map` |
| `META-006` | `VALIDATION` | 400 | "At least one column definition is required." | Empty `catalog.dataset_columns` |
| `META-007` | `INTERNAL` | 500 | "An unexpected error occurred while reading metadata. (Ref: {correlationId})" | Unhandled error in metadata service |

---

### 5.6 Pipelines — `PIPE`

| Code | Class | HTTP | User Message | Internal Note |
|------|-------|------|--------------|---------------|
| `PIPE-001` | `VALIDATION` | 400 | "Pipeline name is required." | Missing `pipeline_display_name` |
| `PIPE-002` | `CONFLICT` | 409 | "A pipeline named '{name}' already exists in this project." | Unique constraint |
| `PIPE-003` | `NOT_FOUND` | 404 | "Pipeline not found. It may have been deleted." | `catalog.pipelines` lookup miss |
| `PIPE-004` | `VALIDATION` | 400 | "A pipeline must have at least one source node." | No source in IR graph |
| `PIPE-005` | `VALIDATION` | 400 | "A pipeline must have at least one sink node." | No sink in IR graph |
| `PIPE-006` | `VALIDATION` | 400 | "The pipeline graph contains a cycle. Pipelines must be directed acyclic graphs (DAGs)." | Topological sort failed |
| `PIPE-007` | `VALIDATION` | 400 | "Node '{nodeId}' has a required input that is not connected." | Disconnected input port |
| `PIPE-008` | `VALIDATION` | 400 | "Node '{nodeId}' references dataset '{datasetId}' which no longer exists." | Stale dataset reference in IR |
| `PIPE-009` | `CONFLICT` | 409 | "This pipeline version has already been published. Create a new version to make further changes." | Attempt to mutate a published version |
| `PIPE-010` | `CONFLICT` | 409 | "This pipeline cannot be deleted because it is actively scheduled by {count} orchestrator(s). Remove the schedule first." | FK from `catalog.orchestrator_pipeline_map` |
| `PIPE-011` | `INTERNAL` | 500 | "Pipeline code generation failed. Please review the pipeline design. (Ref: {correlationId})" | Unhandled codegen error |
| `PIPE-012` | `INTERNAL` | 500 | "An unexpected error occurred while saving the pipeline. (Ref: {correlationId})" | Unhandled error in pipeline service |

---

### 5.7 Executions — `EXEC`

| Code | Class | HTTP | User Message | Internal Note |
|------|-------|------|--------------|---------------|
| `EXEC-001` | `NOT_FOUND` | 404 | "Pipeline run not found." | `execution.pipeline_runs` lookup miss |
| `EXEC-002` | `CONFLICT` | 409 | "This pipeline is already running. Wait for the current run to complete before starting a new one." | Duplicate run attempt for same pipeline |
| `EXEC-003` | `VALIDATION` | 400 | "Cannot start a run for a pipeline that has no published version." | `catalog.pipelines.active_version_id` is null |
| `EXEC-004` | `EXTERNAL_DEPENDENCY` | 503 | "The Spark cluster did not accept the job submission. Please check the cluster status and try again. (Ref: {correlationId})" | Cluster submission error |
| `EXEC-005` | `EXTERNAL_DEPENDENCY` | 503 | "The Spark cluster connection timed out during job submission. (Ref: {correlationId})" | Submit request timeout |
| `EXEC-006` | `AUTHORIZATION` | 403 | "You do not have permission to cancel this pipeline run." | Role check on run cancel |
| `EXEC-007` | `CONFLICT` | 409 | "This run has already completed and cannot be cancelled." | Attempt to cancel terminal run |
| `EXEC-008` | `INTERNAL` | 500 | "An unexpected error occurred while starting the pipeline run. (Ref: {correlationId})" | Unhandled error in execution service |

---

### 5.8 Orchestrators — `ORCH`

| Code | Class | HTTP | User Message | Internal Note |
|------|-------|------|--------------|---------------|
| `ORCH-001` | `VALIDATION` | 400 | "Orchestrator name is required." | Missing `orch_display_name` |
| `ORCH-002` | `CONFLICT` | 409 | "An orchestrator named '{name}' already exists." | Unique constraint |
| `ORCH-003` | `NOT_FOUND` | 404 | "Orchestrator not found. It may have been deleted." | Lookup miss |
| `ORCH-004` | `VALIDATION` | 400 | "Schedule expression is invalid. Use a valid cron expression (e.g. '0 2 * * *')." | Cron parse failure |
| `ORCH-005` | `VALIDATION` | 400 | "An orchestrator must reference at least one pipeline." | Empty pipeline list |
| `ORCH-006` | `EXTERNAL_DEPENDENCY` | 503 | "Failed to register the schedule with the scheduler engine. (Ref: {correlationId})" | Scheduler backend error |
| `ORCH-007` | `INTERNAL` | 500 | "An unexpected error occurred while saving the orchestrator. (Ref: {correlationId})" | Unhandled error |

---

### 5.9 Codegen Engine — `CGEN`

| Code | Class | HTTP | User Message | Internal Note |
|------|-------|------|--------------|---------------|
| `CGEN-001` | `VALIDATION` | 400 | "The pipeline design contains an unsupported node type: '{nodeType}'." | Unknown node type code in registry |
| `CGEN-002` | `VALIDATION` | 400 | "Spark engine '{engine}' is not supported. Supported engines: PySpark, Scala." | Unknown engine in codegen request |
| `CGEN-003` | `VALIDATION` | 400 | "Node '{nodeId}' is missing required configuration: {fieldName}." | Codegen config validation failure |
| `CGEN-004` | `INTERNAL` | 500 | "Code generation failed for this pipeline. The design may contain an unsupported configuration. (Ref: {correlationId})" | Unhandled codegen exception |
| `CGEN-005` | `INTERNAL` | 500 | "Generated code could not be stored as an artifact. (Ref: {correlationId})" | Artifact write failure |

---

### 5.10 Governance / RBAC — `GOV`

| Code | Class | HTTP | User Message | Internal Note |
|------|-------|------|--------------|---------------|
| `GOV-001` | `NOT_FOUND` | 404 | "Project not found. It may have been deleted." | `etl.projects` lookup miss |
| `GOV-002` | `CONFLICT` | 409 | "A project named '{name}' already exists." | Unique constraint |
| `GOV-003` | `VALIDATION` | 400 | "Project name is required." | Missing `project_display_name` |
| `GOV-004` | `AUTHORIZATION` | 403 | "You do not have permission to perform this action on this project." | Project-level role check failed |
| `GOV-005` | `CONFLICT` | 409 | "This project cannot be deleted because it contains active pipelines. Delete all pipelines first." | FK dependency |
| `GOV-006` | `INTERNAL` | 500 | "An unexpected error occurred in access control. (Ref: {correlationId})" | Unhandled RBAC error |

---

### 5.11 System / Infrastructure — `SYS`

| Code | Class | HTTP | User Message | Internal Note |
|------|-------|------|--------------|---------------|
| `SYS-001` | `EXTERNAL_DEPENDENCY` | 503 | "The database is temporarily unavailable. Please try again in a moment. (Ref: {correlationId})" | PG connection pool exhausted or connection refused |
| `SYS-002` | `EXTERNAL_DEPENDENCY` | 503 | "A required external service is temporarily unavailable. (Ref: {correlationId})" | Generic external dependency down |
| `SYS-003` | `INTERNAL` | 500 | "An unexpected error occurred. Please try again. If this persists, contact support with reference {correlationId}." | Catch-all for unclassified errors |
| `SYS-004` | `INTERNAL` | 500 | "Request processing failed due to an internal configuration error. (Ref: {correlationId})" | Missing env var / config at runtime |

---

## 6. Error Transformation Pipeline

This is the journey of an error from origin to client:

```
Raw Exception (DB / Driver / Network / Bug)
        │
        ▼
 ┌──────────────────────┐
 │  Service Catch Block │  — catches raw errors at domain service boundaries
 └──────────────────────┘
        │  wraps into
        ▼
 ┌──────────────────────┐
 │      AppError        │  — enriched with code, userMessage, internalMessage, meta, cause
 └──────────────────────┘
        │  thrown / re-thrown
        ▼
 ┌──────────────────────┐
 │  Error Logger        │  — log.error(action, appError.internalMessage, appError.cause, appError.meta)
 └──────────────────────┘  → writes full detail to service log file (NEVER to response)
        │
        ▼
 ┌──────────────────────┐
 │  Global Error        │
 │  Handler Middleware  │  — Express/Fastify error handler
 └──────────────────────┘
        │  sends
        ▼
 ┌──────────────────────────────────────────────────────────┐
 │  API Error Response (JSON)                               │
 │  {                                                       │
 │    "success":       false,                               │
 │    "errorCode":     "CONN-003",                          │
 │    "errorClass":    "CONFLICT",                          │
 │    "message":       "A connection named 'X' already…",   │
 │    "correlationId": "c7d3f1a2-…"                         │
 │  }                                                       │
 └──────────────────────────────────────────────────────────┘
```

### Strict Rules of the Pipeline

1. **Raw exceptions never reach the API response.** The error handler must check `instanceof AppError`; anything else is wrapped into `SYS-003` before responding.
2. **Stack traces never appear in the API response.** They exist only in the log file.
3. **Internal DB table/column/constraint names never appear in `userMessage`.** They belong only in `internalMessage` or `meta`.
4. **`correlationId` always appears in the API error response** so support can cross-reference the log file.
5. **`cause` is always logged** — the original raw exception is never silently swallowed.

---

## 7. API Error Response Schema

```json
{
  "success":       false,
  "errorCode":     "CONN-005",
  "errorClass":    "EXTERNAL_DEPENDENCY",
  "message":       "Could not reach the data source. Please verify the host, port, and network settings, then try again. (Ref: c7d3f1a2-...)",
  "correlationId": "c7d3f1a2-...",
  "fieldErrors":   []
}
```

For `VALIDATION` errors that span multiple fields, `fieldErrors` carries per-field detail:

```json
{
  "success":     false,
  "errorCode":   "USR-001",
  "errorClass":  "VALIDATION",
  "message":     "The request contains validation errors. Please review the fields below.",
  "correlationId": "...",
  "fieldErrors": [
    { "field": "user_email",      "message": "Email address is required." },
    { "field": "user_first_name", "message": "First name is required." }
  ]
}
```

---

## 8. `userMessage` Writing Rules

Good user-facing error messages follow these rules without exception:

| Rule | Example ❌ Bad | Example ✅ Good |
|------|---------------|----------------|
| No stack traces | `QueryFailedError at line 42...` | (never appears in response) |
| No table/column names | `unique constraint on catalog_connectors` | `A connection with this name already exists.` |
| No ORM/driver names | `TypeORM error: ...` | (never appears in response) |
| No HTTP status codes in the text | `500 error occurred` | `An unexpected error occurred.` |
| Specific before generic | `An error occurred.` | `Connection name is required.` |
| Actionable — tell them what to do | `Connection failed.` | `Could not reach the data source. Verify the host and port.` |
| Template placeholders in `{}` | — | `A connection named '{name}' already exists.` — filled at throw time |
| Include correlationId for `INTERNAL` / `EXTERNAL_DEPENDENCY` | — | `(Ref: {correlationId})` — filled at throw time |
| No blame language | `You sent an invalid request.` | `The email address format is not valid.` |
| Present tense | `The connection was unable to be saved.` | `The connection could not be saved.` |

---

## 9. Implementation File Structure

```
Backend/src/shared/errors/
├── ErrorClass.ts          ← Enum: VALIDATION | NOT_FOUND | CONFLICT | AUTHORIZATION | AUTHENTICATION | EXTERNAL_DEPENDENCY | INTERNAL
├── AppError.ts            ← AppError class (Section 4)
├── AppErrors.ts           ← Catalog factory namespace (Section 4.3) — one sub-namespace per domain
├── ErrorSerializer.ts     ← Safely serializes Error to log-safe object (strips circular refs, redacts secrets)
├── errorHandler.middleware.ts  ← Express global error handler — transforms AppError to API response
└── index.ts               ← Re-exports

Backend/src/shared/errors/catalog/
├── usr.errors.ts          ← USR-* factory functions
├── conn.errors.ts         ← CONN-* factory functions
├── meta.errors.ts         ← META-* factory functions
├── pipe.errors.ts         ← PIPE-* factory functions
├── exec.errors.ts         ← EXEC-* factory functions
├── orch.errors.ts         ← ORCH-* factory functions
├── cgen.errors.ts         ← CGEN-* factory functions
├── gov.errors.ts          ← GOV-* factory functions
└── sys.errors.ts          ← SYS-* factory functions
```

### 9.1 `AppErrors` Factory — Call-Site Examples

```typescript
// In connections service:
import { AppErrors } from '@shared/errors';

// CONN-003 — duplicate name
throw AppErrors.conn.duplicateName(dto.connDisplayName);

// CONN-005 — cannot reach host
throw AppErrors.conn.hostUnreachable(connId, originalSocketError);

// CONN-011 — has dependent datasets
throw AppErrors.conn.hasDependentDatasets(connId, 3);
```

```typescript
// In users service:
throw AppErrors.usr.emailAlreadyExists();          // USR-003
throw AppErrors.usr.invalidCredentials();          // USR-005 — never expose which field is wrong
throw AppErrors.usr.sessionExpired();              // USR-006
```

```typescript
// In pipeline service:
throw AppErrors.pipe.hasCycle();                   // PIPE-006
throw AppErrors.pipe.missingSource();              // PIPE-004
throw AppErrors.pipe.staleDatasetRef(nodeId, datasetId); // PIPE-008
```

### 9.2 `ErrorSerializer` — What Gets Logged

When the logger receives a `cause` (the original raw error), `ErrorSerializer` transforms it into a log-safe structure:

```typescript
{
  name:    'QueryFailedError',
  message: 'duplicate key value violates unique constraint "catalog_connectors_conn_display_name_key"',
  stack:   'QueryFailedError: ...\n  at ...',
  // pgError details from the driver:
  pgCode:  '23505',
  pgDetail: 'Key (conn_display_name)=(Prod Warehouse) already exists.'
}
```

This full detail goes into the log file's `error` field. **None of it reaches the API response.**

---

## 10. Integration with the Logging Framework

Errors flow into the logging framework defined in `Logging_Framework_Requirements_and_Plan.md` as follows:

| Error Class | Log Level | Logged Fields |
|-------------|-----------|---------------|
| `VALIDATION` | `WARN` | `action`, `internalMessage`, `meta`, error code only (no `cause` stack) |
| `NOT_FOUND` | `WARN` | `action`, `internalMessage`, `meta` |
| `CONFLICT` | `WARN` | `action`, `internalMessage`, `meta` |
| `AUTHORIZATION` | `WARN` | `action`, `internalMessage`, `meta` |
| `AUTHENTICATION` | `WARN` | `action`, `internalMessage`, `meta` |
| `EXTERNAL_DEPENDENCY` | `ERROR` | `action`, `internalMessage`, `meta`, full `cause` serialized |
| `INTERNAL` | `ERROR` | `action`, `internalMessage`, `meta`, full `cause` serialized |

The global error handler middleware does the logging automatically so individual service catch blocks do not need to log before re-throwing:

```typescript
// In a service — just throw. The middleware logs and responds.
throw AppErrors.conn.duplicateName(dto.connDisplayName);

// In the global error handler middleware:
const appError = err instanceof AppError ? err : AppErrors.sys.unexpected(err);
const log      = LoggerFactory.get(resolveServiceFromRoute(req));

if (appError.errorClass === ErrorClass.EXTERNAL_DEPENDENCY || appError.errorClass === ErrorClass.INTERNAL) {
  log.error(appError.action, appError.internalMessage, appError.cause, appError.meta);
} else {
  log.warn(appError.action, appError.internalMessage, appError.meta);
}

res.status(appError.httpStatus).json(appError.toApiResponse(correlationId));
```

---

## 11. Implementation Plan

### Phase 1 — Foundation (Sprint 1, alongside Logging Phase 1)

| Task | File |
|------|------|
| Define `ErrorClass` enum | `src/shared/errors/ErrorClass.ts` |
| Implement `AppError` class | `src/shared/errors/AppError.ts` |
| Implement `ErrorSerializer` | `src/shared/errors/ErrorSerializer.ts` |
| Wire `errorHandler.middleware.ts` into `server.ts` | `src/api/server.ts` |
| Add `index.ts` re-exports | `src/shared/errors/index.ts` |

### Phase 2 — Error Catalog (Sprint 1)

Implement all factory files under `src/shared/errors/catalog/`. Each file covers one domain prefix. Build alongside the corresponding service module so the catalog is exercised immediately.

### Phase 3 — Service Adoption (Sprint 2, alongside Logging Phase 3)

Replace any raw `throw new Error(...)` or bare `catch (e) { res.status(500)... }` patterns with `throw AppErrors.<domain>.<factory>(...)`. Adoption order mirrors the logging framework adoption order.

### Phase 4 — Hardening (Sprint 3)

| Task | Notes |
|------|-------|
| Secret redaction in `ErrorSerializer` | Strip `password`, `token`, `secret`, `key` from `cause` meta before logging |
| Unit tests for every catalog factory | Verify code, class, HTTP status, message template substitution |
| Integration test: raw DB error → API response | Assert no internal detail leaks in response body |
| `INTERNAL` error alerting hook | `alertable: true` errors emit to a configurable alert channel (Slack webhook, PagerDuty, etc.) |

---

## 12. Adding New Error Codes — Process

When a new failure condition is identified:

1. Determine the domain prefix.
2. Assign the next sequential number in that domain (check `catalog/<domain>.errors.ts` for the highest existing number).
3. Write the factory function in the catalog file.
4. Add a row to Section 5 of this document.
5. Add the code to `CLAUDE.md` logging rules section if it is a cross-cutting concern.

**Never reuse a retired code number. Tombstone it with a `// DEPRECATED — <reason>` comment instead.**
