# ETL1 Platform — Architecture Validation Report

**Date:** 2026-03-08  
**Auditor:** Claude (Senior Full-Stack Review)  
**Codebase:** `/home/venkateswarlu/Documents/ETL1`  
**Standard:** No-Code ETL Platform Architecture & Implementation Checklist

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented and correct |
| ⚠️ | Partially implemented or needs improvement |
| ❌ | Not implemented / Missing |
| 🔒 | Security concern |

---

## 1. Repository Setup

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 1.1 | Separate `frontend` and `backend` folders | ✅ | `Frontend/` and `Backend/` exist at root |
| 1.2 | TypeScript configuration | ✅ | `tsconfig.json` present in both Frontend and Backend |
| 1.3 | Strict TypeScript mode | ⚠️ | Backend `tsconfig.json` needs verification — not confirmed `"strict": true` |
| 1.4 | ESLint configured | ⚠️ | `.eslintrc.cjs` present in Frontend only; Backend has no ESLint config found |
| 1.5 | Prettier configured | ❌ | No `.prettierrc` found in either Frontend or Backend |
| 1.6 | Environment configuration | ⚠️ | `.env.example` exists in Frontend; Backend relies on `dotenv/config` with no `.env.example` |
| 1.7 | `.env` management | ⚠️ | `dotenv` imported in `server.ts`; no documented env var list |
| 1.8 | Git branching strategy | ❌ | `.github/` folder exists but no branch protection or strategy documented |
| 1.9 | CI pipeline | ❌ | `.github/` present but no workflow files confirmed |

---

## 2. Backend Architecture

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 2.1 | Controllers contain only request handling logic | ✅ | `connections.controller.ts`, `pipeline.controller.ts` follow the pattern |
| 2.2 | Services contain business logic | ⚠️ | `connections.service.ts` exists; no `projects.service.ts`, `executions.service.ts`, `orchestrators.service.ts`, `metadata.service.ts` |
| 2.3 | Repository layer handles DB calls | ✅ | `repositories/` folder exists with `connections.repository.ts`, `pipeline.repository.ts`, `artifact.repository.ts` |
| 2.4 | DB access isolated | ✅ | `db/connection.ts` is the single DB entry point |
| 2.5 | No direct DB access from services | ⚠️ | Cannot fully confirm without reading all service files; architecture is correct but missing services leave gaps |
| 2.6 | No static SQL outside repository layer | ⚠️ | `migrations/001_create_codegen_tables.sql` contains raw DDL — acceptable for migrations only; needs verification in repositories |

---

## 3. Central Database Pool

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 3.1 | Only one PostgreSQL connection pool | ✅ | Single `Database` class singleton in `db/connection.ts` |
| 3.2 | Pool defined in a single file | ✅ | `db/connection.ts` only |
| 3.3 | Pool reused across all repositories | ✅ | `export const db = new Database()` — singleton exported and imported by repositories |
| 3.4 | No service creates its own pool | ✅ | No secondary pool instantiation found |
| 3.5 | Pool connection limits configured | ✅ | `max: config.max ?? 20` configured |
| 3.6 | Pool timeout configured | ✅ | `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000` |
| 3.7 | Pool retry logic implemented | ❌ | No retry logic on connection failure; pool error only logs via `pool.on('error', ...)` |

---

## 4. Database Execution Layer

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 4.1 | All DB calls go through central executor | ⚠️ | `db.query()`, `db.queryOne()`, `db.queryMany()`, `db.transaction()` exist; but no **central executor** that auto-injects session metadata — callers must do it manually |
| 4.2 | Executor injects service UUID | ❌ | No automatic injection — repositories must call `SET LOCAL app.service_uuid` manually before every query; not enforced |
| 4.3 | Executor sets DB session metadata | ❌ | `SET LOCAL app.user_id` and `SET LOCAL app.encryption_key` noted in `CLAUDE.md` as required but no middleware/executor enforces this automatically |
| 4.4 | Executor handles connection release | ✅ | `transaction()` has try/finally with `client.release()` |
| 4.5 | Executor handles DB error logging | ⚠️ | Pool-level errors are logged; individual query errors are not caught/logged at executor level — left to callers |
| 4.6 | Executor measures query execution time | ❌ | No timing instrumentation on `db.query()` |

---

## 5. Database Design Standards

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 5.1 | Only stored procedures for DML (INSERT/UPDATE/DELETE) | ❌ | No evidence of stored procedures being used; repositories likely use direct SQL — needs full repository audit |
| 5.2 | No direct INSERT statements | ❌ | Repositories exist (`pipeline.repository.ts`, `connections.repository.ts`) but use of raw `INSERT` vs `CALL sp_*` unconfirmed — high risk |
| 5.3 | No direct UPDATE statements | ❌ | Same as above |
| 5.4 | No direct DELETE statements | ❌ | Same as above |
| 5.5 | Only DB functions for SELECT (`fn_*`) | ❌ | No `fn_*` function pattern confirmed in any repository; likely using raw `SELECT` queries |

---

## 6. PostgreSQL Session Tracking

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 6.1 | `set_config('app.service_uuid', ...)` before every query | ❌ | Required by `CLAUDE.md` (`SET LOCAL app.user_id`) but no enforcement layer exists |
| 6.2 | `set_config('app.username', ...)` before every query | ❌ | `userIdMiddleware` extracts user ID from header but does not propagate to DB session |
| 6.3 | DB logs capture service UUID | ❌ | Not implemented |
| 6.4 | DB logs capture username | ❌ | Not implemented |
| 6.5 | DB logs capture executed SQL | ❌ | No query-level DB audit logging implemented |
| 6.6 | DB logs capture execution duration | ❌ | Not implemented |

---

## 7. Logging Architecture

### Level 1 — Click Logging (UI)

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 7.1.1 | UI generates `clickUUID` | ❌ | `api.ts` does not generate or attach any `clickUUID` to requests |
| 7.1.2 | `clickUUID` passed to backend | ❌ | No `X-Click-UUID` or equivalent header sent from Frontend |
| 7.1.3 | `clickUUID` logged immediately on receipt | ❌ | Not implemented |
| 7.1.4 | `clickUUID` included in API response | ❌ | Response shape does not include `clickUUID` |

### Level 2 — Service Logging

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 7.2.1 | Each service has its own log file | ✅ | `LoggerFactory.get('connections')` → `logs/connections.log` pattern is implemented in `WinstonLogger.ts` |
| 7.2.2 | Each service generates `serviceUUID` | ❌ | Logger exists but services do not generate or bind a per-invocation `serviceUUID` |
| 7.2.3 | `serviceUUID` logged at start and completion | ❌ | Not implemented |
| 7.2.4 | Input payload logged | ⚠️ | `requestLoggerMiddleware` logs incoming requests but not per-service payload |
| 7.2.5 | Execution time logged | ⚠️ | `requestLoggerMiddleware` likely captures response time; service-level timing not confirmed |
| 7.2.6 | Error stack captured | ✅ | `globalErrorHandler` in `errorHandler.middleware.ts` captures and logs errors |

### Level 3 — Database Logging

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 7.3.1 | DB session tagged with `serviceUUID` | ❌ | Not implemented — see Section 6 |
| 7.3.2 | DB audit logging enabled | ❌ | No PostgreSQL audit triggers or `pgaudit` configuration found |
| 7.3.3 | Slow queries logged | ❌ | No slow query threshold or logging configured |

---

## 8. UUID Tracking System

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 8.1 | `clickUUID` generated in frontend | ❌ | Not implemented anywhere in Frontend |
| 8.2 | `clickUUID` passed in request headers | ❌ | `api.ts` interceptors do not attach `clickUUID` |
| 8.3 | `correlationId` / `requestId` generated per request | ✅ | `correlationMiddleware` generates and injects `correlationId` and `requestId` via `AsyncLocalStorage` |
| 8.4 | `serviceUUID` generated per service invocation | ❌ | No service generates a per-invocation UUID |
| 8.5 | `serviceUUID` passed to DB | ❌ | Not implemented |
| 8.6 | UUIDs stored in logs | ⚠️ | `correlationId` and `requestId` are stored in logs; `clickUUID` and `serviceUUID` are not |

---

## 9. Encryption Strategy

### Transport Encryption

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 9.1.1 | HTTPS enabled | ❌ | Backend server uses plain `app.listen()` with no TLS configuration |
| 9.1.2 | TLS 1.3 enforced | ❌ | Not configured |
| 9.1.3 | HSTS enabled | ❌ | No HSTS header set |

### Application Encryption

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 9.2.1 | `encrypt()` function implemented | ❌ | No `security/` or `encryption/` module found in Backend |
| 9.2.2 | `decrypt()` function implemented | ❌ | Same as above |
| 9.2.3 | AES-256 encryption used | ❌ | Not implemented |
| 9.2.4 | Encryption keys not stored in DB | ✅ (by omission) | Keys not stored in DB — but only because encryption is not implemented yet |
| 9.2.5 | Encryption keys stored in secrets manager | ❌ | `CLAUDE.md` references `app.encryption_key` as a DB session var; no secrets manager integration |

### Database Encryption

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 9.3.1 | Credentials stored encrypted | ⚠️ | `CLAUDE.md` mandates `pgcrypto` and `conn_config_json_encrypted`; not confirmed in repository layer |
| 9.3.2 | Secrets never stored in plaintext | 🔒 | Cannot confirm — `connections.repository.ts` not fully audited; high risk |
| 9.3.3 | Credential payload is encrypted JSON blob | ❌ | No encrypt/decrypt utility exists to enforce this |

---

## 10. Credential Management

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 10.1 | `credential_store` table or equivalent | ⚠️ | `catalog.connectors` table exists in DB schema with `conn_config_json_encrypted` column per `CLAUDE.md`; dedicated `credential_store` table not confirmed |
| 10.2 | Credential encryption enforced | ❌ | No encryption utility to enforce this |
| 10.3 | Credential decryption only inside service layer | ❌ | Not enforceable without encryption implementation |
| 10.4 | No credential exposure to UI | ⚠️ | `connections.controller.ts` returns connection data — needs audit to confirm secrets are stripped |

---

## 11. Metadata Storage

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 11.1 | Pipeline definitions stored in DB | ✅ | `pipeline.repository.ts` exists; `etl.pipelines` table in schema |
| 11.2 | Transformation metadata stored | ⚠️ | Codegen module exists; whether transformation metadata is persisted to DB (vs generated on-the-fly) is unclear |
| 11.3 | Dataset schemas stored | ⚠️ | `catalog.dataset_columns` table mandated by `CLAUDE.md`; no repository confirmed |
| 11.4 | Pipeline versioning enabled | ⚠️ | `pipeline_versions` / `active_version_id` referenced in `CLAUDE.md`; `artifact.repository.ts` exists but full versioning flow unconfirmed |
| 11.5 | Connections metadata stored | ✅ | `connections.repository.ts` and `catalog.connectors` table confirmed |

---

## 12. PySpark Code Generation

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 12.1 | Codegen module exists | ✅ | `Backend/src/codegen/` — comprehensive module with PySpark and Scala engines |
| 12.2 | Transformation metadata converted to PySpark | ✅ | `pyspark.engine.ts`, `basic.transformation.generators.ts`, `advanced.transformation.generators.ts` etc. |
| 12.3 | Code generation deterministic | ✅ | Engine-based pattern with registry; deterministic by design |
| 12.4 | Pipeline DAG generated | ✅ | `topo-sort.ts` and `pipeline.scaffold.ts` present |
| 12.5 | Source connectors generated | ✅ | JDBC, file, Kafka, Delta/Hive/Iceberg source generators present |
| 12.6 | Transformation code generated | ✅ | Basic, advanced, extra, special transformation generators present |
| 12.7 | Target/sink connectors generated | ✅ | `all.sink.generators.ts` present |
| 12.8 | Multiple engine support | ✅ | Both PySpark and Scala Spark engines implemented |

---

## 13. Static Code Prevention

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 13.1 | Pipeline logic stored in DB metadata | ⚠️ | Pipeline CRUD in repository; but ExecutionSubTab and OrchestratorExecutionSubTab use `setTimeout` simulations — no real pipeline execution from stored metadata |
| 13.2 | Transformations stored in DB | ❌ | Transformations appear to be UI-local (Redux state) with no confirmed persistence flow to DB |
| 13.3 | Runtime code generated dynamically | ✅ | Codegen engine generates code from IR at runtime |
| 13.4 | No hardcoded pipelines | ⚠️ | No hardcoded pipelines in backend; but multiple frontend components use `MOCK_*` hardcoded data |

---

## 14. Frontend Architecture

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 14.1 | `pages/` structure | ❌ | No `pages/` directory; everything is in `components/`; no routing library (React Router) installed |
| 14.2 | `components/` structure | ✅ | Well-organised component tree |
| 14.3 | `services/` layer | ⚠️ | `services/api.ts` exists with all API methods defined; but none are called from most components |
| 14.4 | `store/` with Redux slices | ✅ | Redux Toolkit store with `pipelineSlice`, `tabsSlice`, `uiSlice`, `monitorSlice` |
| 14.5 | `hooks/` directory | ✅ | Custom hooks present |
| 14.6 | UI generates `clickUUID` | ❌ | Not implemented |
| 14.7 | API requests include `clickUUID` header | ❌ | Not implemented in `api.ts` interceptors |
| 14.8 | API responses capture `serviceUUID` | ❌ | Response interceptor only handles 401; no UUID capture |
| 14.9 | Global error handling | ⚠️ | No global React error boundary; API errors are not surfaced in the UI |

---

## 15. Data Transport Optimization

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 15.1 | Columnar format evaluated for large datasets | ❌ | Not evaluated or implemented |
| 15.2 | Metadata APIs restricted to JSON | ✅ | All API responses use `res.json()` |
| 15.3 | Large dataset APIs use optimized transport | ❌ | `DataPreviewPanel` uses hardcoded in-memory data; no optimized transport implemented |

---

## 16. Error Handling Standards

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 16.1 | Global error handler | ✅ | `globalErrorHandler` middleware in `errorHandler.middleware.ts` |
| 16.2 | Consistent `AppError` format | ✅ | `AppError.ts` with `code`, `errorClass`, `httpStatus`, `userMessage`, `internalMessage` |
| 16.3 | Error catalog per domain | ✅ | `catalog/conn.errors.ts`, `pipe.errors.ts`, `exec.errors.ts` etc. |
| 16.4 | Stack traces logged internally only | ✅ | `userMessage` vs `internalMessage` separation enforced by design |
| 16.5 | `clickUUID` in API error response | ❌ | `clickUUID` not in any response — it doesn't exist in the system yet |
| 16.6 | `serviceUUID` in API error response | ❌ | Not implemented |
| 16.7 | `correlationId` in error response | ✅ | `correlationId` attached to `INTERNAL` and `EXTERNAL_DEPENDENCY` errors per `CLAUDE.md` spec |
| 16.8 | Frontend global error handler | ❌ | No React error boundary; no toast/alert system wired to API errors |

---

## 17. Security Hardening

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 17.1 | Secrets stored in secrets manager | ❌ | Secrets managed via `.env` only; no Vault, AWS Secrets Manager, or equivalent |
| 17.2 | RBAC implemented | ❌ | `gov.user_roles` / `gov.project_user_roles` tables mandated in `CLAUDE.md`; no RBAC enforcement in any route middleware |
| 17.3 | API authentication (JWT/Bearer) | ❌ | `api.ts` reads `localStorage.getItem('authToken')` and sends `Authorization: Bearer`; backend has no auth middleware verifying tokens |
| 17.4 | Request validation | ⚠️ | `pipelineBodyGuard` middleware exists for pipeline routes; no validation on connections or other routes |
| 17.5 | SQL injection protection | ⚠️ | `pg` parameterised queries used in `db.query(sql, params)`; safe if all repositories use parameterised queries — unconfirmed |
| 17.6 | Rate limiting | ❌ | No rate limiting middleware configured |

---

## 18. Observability

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 18.1 | Service metrics collected | ❌ | No metrics endpoint (Prometheus/StatsD) implemented |
| 18.2 | Query performance tracked | ❌ | No query timing in executor layer |
| 18.3 | Log rotation implemented | ⚠️ | Winston is configured; log rotation (`winston-daily-rotate-file` or equivalent) not confirmed |
| 18.4 | Monitoring dashboards | ❌ | Not implemented |

---

## 19. Performance Strategy

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 19.1 | DB connection pooling configured | ✅ | Pool with `max: 20`, timeouts configured |
| 19.2 | DB indexes created | ⚠️ | Schema files exist in `database/schema/`; index coverage not audited |
| 19.3 | Caching layer evaluated | ❌ | No Redis or in-memory cache implemented or evaluated |
| 19.4 | Async processing where possible | ⚠️ | All API handlers are async; no job queue (BullMQ/etc.) for long-running Spark submissions |

---

## 20. Deployment Architecture

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 20.1 | Containerization (Docker) | ❌ | No `Dockerfile` or `docker-compose.yml` found |
| 20.2 | Environment configurations separated | ⚠️ | `.env` files present; no `dev/staging/prod` environment config separation |
| 20.3 | CI/CD pipeline | ❌ | `.github/` folder exists but no confirmed workflow files |
| 20.4 | Automated testing | ⚠️ | `vitest.config.ts` in Frontend; `pyspark.integration.test.ts` in Backend codegen; no broad test coverage |

---

## 21. Missing Backend Routes (Frontend Calls With No Backend Handler)

| Frontend API Call | Backend Route | Status |
|---|---|---|
| `GET /api/projects` | Not implemented | ❌ |
| `POST /api/projects` | Not implemented | ❌ |
| `PUT /api/projects/:id` | Not implemented | ❌ |
| `GET /api/executions/kpis` | Not implemented | ❌ |
| `GET /api/executions/pipeline-runs` | Not implemented | ❌ |
| `GET /api/executions/orchestrator-runs` | Not implemented | ❌ |
| `GET /api/executions/pipeline-runs/:id` | Not implemented | ❌ |
| `GET /api/executions/pipeline-runs/:id/logs` | Not implemented | ❌ |
| `GET /api/executions/pipeline-runs/:id/nodes` | Not implemented | ❌ |
| `POST /api/executions/pipeline-runs/:id/retry` | Not implemented | ❌ |
| `POST /api/executions/pipeline-runs/:id/cancel` | Not implemented | ❌ |
| `POST /api/executions/orchestrator-runs/:id/retry` | Not implemented | ❌ |
| `POST /api/executions/orchestrator-runs/:id/cancel` | Not implemented | ❌ |
| `GET /api/metadata/tree` | Not implemented | ❌ |
| `GET /api/metadata/tree/search` | Not implemented | ❌ |
| `GET /api/metadata/:id/profile` | Not implemented | ❌ |
| `GET /api/nodes/:id/preview` | Not implemented | ❌ |
| `GET /api/nodes/:id/lineage` | Not implemented | ❌ |
| `POST /api/pipelines/:id/run` | Route exists; no execution logic | ⚠️ |

---

## 22. Missing UI Screens

| Screen | Status | Notes |
|---|---|---|
| Login / Authentication | ❌ | No login page, no token issuance, no session management |
| Create Project dialog | ❌ | `// TODO` comment in `LeftSidebar.tsx` |
| Create Pipeline dialog | ❌ | No dialog component exists |
| Create Orchestrator dialog | ❌ | No dialog component exists |
| Connections Manager UI | ❌ | Backend API complete; zero UI built |
| Dashboard screen | ❌ | Nav button present; `onClick={() => {}}` |
| Governance screen | ❌ | Nav button present; `onClick={() => {}}` |
| Lineage explorer screen | ❌ | Nav button present; `onClick={() => {}}` |
| Settings screen | ❌ | Only `ThemeSettings.tsx` (theme toggle only) |
| Orchestrator DAG Editor | ❌ | Placeholder "Coming soon" component |

---

## 23. Frontend Components With Hardcoded Mock Data (Must Be Replaced)

| Component | Mock Data | Real API Call Needed |
|---|---|---|
| `OverviewSubTab.tsx` | `MOCK_RUNS` array | `api.getPipelineRuns({ pipelineId })` |
| `ExecutionHistorySubTab.tsx` | `MOCK_EXECUTIONS` array | `api.getPipelineRuns({ pipelineId })` |
| `AuditLogsSubTab.tsx` | `MOCK_ENTRIES` array | Backend audit log endpoint (missing) |
| `OrchestratorOverviewSubTab.tsx` | `MOCK_RUNS`, `MOCK_PIPELINES` | `api.getOrchestratorRuns()` |
| `ExecutionSubTab.tsx` | `setTimeout` simulation | `api.runPipeline()` + WebSocket/SSE for live logs |
| `OrchestratorExecutionSubTab.tsx` | `setTimeout` simulation | Orchestrator run API (missing) |
| `DataPreviewPanel.tsx` | 1000 rows generated with `Array.from` | `api.getPreview(nodeId)` |
| `PropertiesPanel.tsx` — connections dropdown | Hardcoded `pg1`, `s3`, `sf` | `api.getConnections()` |
| `PropertiesPanel.tsx` — schema mapping | Hardcoded column names | `api.listSchemas()` + `api.listTables()` |
| `PermissionsSubTab.tsx` | `INITIAL_GRANTS` local state | Permissions API (missing) |

---

## 24. Implementation Status Summary

| Module | Checklist Status | Detail |
|---|---|---|
| Backend architecture | ⚠️ Partial | Controller/Service/Repo pattern established; missing domains (projects, executions, orchestrators, metadata) |
| Logging system | ⚠️ Partial | Winston/LoggerFactory implemented; `clickUUID`, `serviceUUID`, DB-level logging missing |
| Encryption layer | ❌ Not started | No `encrypt()`/`decrypt()` utility; no AES-256; no secrets manager |
| DB executor | ⚠️ Partial | Pool and transaction helper exist; auto-inject of session metadata missing |
| DB session tracking | ❌ Not started | `SET LOCAL app.user_id` / `app.service_uuid` not enforced |
| Stored procedure / fn pattern | ❌ Not started | Repositories likely use raw SQL; `sp_*` / `fn_*` convention not implemented |
| Metadata engine | ⚠️ Partial | Pipeline + connection storage exists; datasets, lineage, audit tables unconfirmed |
| PySpark generator | ✅ Complete | Full engine with PySpark + Scala, sources, transforms, sinks |
| Frontend integration | ❌ Not started | `api.ts` defined but almost no component calls the API |
| Security hardening | ❌ Not started | No auth, no RBAC, no rate limiting, no HTTPS |
| Deployment pipeline | ❌ Not started | No Docker, no CI/CD workflows |
| UUID tracking | ⚠️ Partial | `correlationId`/`requestId` via AsyncLocalStorage; `clickUUID` and `serviceUUID` missing |

---

## 25. Priority Action Plan

### P0 — Blocking (Nothing Works Without These)

1. **Projects API** — `GET/POST /api/projects` with service + repository + DB schema
2. **Executions API** — full `/api/executions/*` domain (KPIs, pipeline runs, logs, nodes, retry, cancel)
3. **LeftSidebar API wiring** — load projects, render pipeline/orchestrator tree, dispatch `openTab`
4. **Pipeline load on tab open** — fetch pipeline from API when a pipeline tab is opened
5. **DB session injection** — wrap `db.query()` to auto-set `SET LOCAL app.user_id` and `app.service_uuid`

### P1 — Critical Functionality

6. **`clickUUID` in Frontend** — generate UUID per action, attach to all API request headers
7. **`serviceUUID` per service invocation** — generate and bind to logger context + DB session
8. **Pipeline Save** — wire "Save" button to `api.savePipeline()` 
9. **PropertiesPanel connections** — replace hardcoded dropdown with `api.getConnections()`
10. **DataPreviewPanel** — replace mock data with `api.getPreview(nodeId)`
11. **Execution sub-tabs** — replace all `MOCK_*` arrays with real API calls

### P2 — Security Baseline

12. **Encryption utility** — `encrypt()` / `decrypt()` with AES-256
13. **Auth middleware** — JWT verification on all protected routes
14. **Login screen** — token issuance and storage
15. **Rate limiting** — `express-rate-limit` on all API routes
16. **Credential masking** — ensure connections API never returns raw secrets

### P3 — Completeness

17. **Orchestrator DAG Editor** — build canvas
18. **Create Project / Pipeline / Orchestrator dialogs**
19. **Connections Manager UI**
20. **Docker + CI/CD**
21. **Stored procedure / fn pattern enforcement in repositories**

---

*End of Validation Report*
