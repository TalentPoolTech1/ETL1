# CLAUDE.md — Project Bootstrap Instructions

> **Every AI session must read this file first before making any changes.**
> Read `database/memory.md` before touching any database file.
> Read the relevant **service SKILL.md** before touching any service file (see Service SKILL.md Map below).

---

## ⚡ OPERATING MODE — SILENT & LOCAL-FIRST

### Silent Mode (MANDATORY)
- **Zero explanation output.** Make the change. Stop.
- No preamble ("I'll now…"), no summaries ("Here's what I did…"), no postamble.
- No "thinking out loud." Do the work silently.
- Token budget is for code, not commentary.

### Surgical Fixes (MANDATORY — CRITICAL)
- **NEVER rewrite an entire file.** Every change must be a targeted `edit_file` on the exact lines that need changing.
- Identify the minimal diff: if one line is wrong, change one line.
- Full rewrites are STRICTLY PROHIBITED unless the user explicitly says "rewrite the whole file".
- Before any edit, take a backup note of what the old value was, then apply the minimum change.
- If a fix requires changes in multiple files, do each file as its own surgical `edit_file`, not as bulk rewrites.

### Local-First File Editing (MANDATORY)
- **ALL file writes go directly to the user's local filesystem** via the `Filesystem:write_file` or `Filesystem:edit_file` tools.
- **NEVER write to Claude's container** (`/home/claude`, `/mnt/...`) and then copy to local.
- **NEVER use `create_file` or `bash_tool` for project files.** Those tools write to Claude's remote container, not the user's machine.
- The correct tool chain for any project file change is:
  - Read → `Filesystem:read_text_file` or `Filesystem:read_multiple_files`
  - Edit existing → `Filesystem:edit_file`
  - Create new → `Filesystem:write_file`
- `present_files` and `bash_tool` are for Claude's container only. Do not use them for project deliverables.

---

## 📖 LIVING DOCUMENTATION RULE (MANDATORY)

Every time any of the following occurs, the relevant service SKILL.md (and this file if
platform-wide) **must be updated in the same session, before the session ends:**

- A new endpoint, route, or API contract is added or changed
- A user states a requirement, constraint, or preference about a service
- A critical architectural decision is made (approved or rejected)
- A bug with a root-cause finding is fixed
- A known issue is resolved or a new one is discovered
- A DB column, table, or function is added/renamed/removed that affects a service
- Any security, logging, or error-handling rule is established or changed

**Where to write:**
- Platform-wide decisions → append to the **"Living Decisions"** section at the bottom of this file
- Service-specific decisions → append to the **"Living Decisions"** section of the relevant `SKILL.md`
- Database decisions → append to `database/memory.md` **Design Critique Resolutions** or a new dated section

**Format for every Living Decisions entry:**
```
- YYYY-MM-DD — [Decision / Instruction / Change / Fix]
```

---

## Service SKILL.md Map

Before touching any service file, read its SKILL.md first.

| Service | SKILL.md Location | Routes File | Status |
|---|---|---|---|
| Connections | `Backend/src/connections/SKILL.md` | `api/routes/connections.routes.ts` | ✅ Implemented |
| Projects | `Backend/src/projects/SKILL.md` | `api/routes/projects.routes.ts` | ✅ Implemented |
| Pipelines | `Backend/src/pipelines/SKILL.md` | `api/routes/pipeline.routes.ts` | ⚠️ Dual-implementation split — read SKILL.md first |
| Executions | `Backend/src/executions/SKILL.md` | `api/routes/executions.routes.ts` | ⚠️ SQL injection risk in KPI endpoint |
| Orchestrators | `Backend/src/orchestrators/SKILL.md` | `api/routes/orchestrators.routes.ts` | ⚠️ Missing list endpoint + DAG map rebuild |
| Users & Auth | `Backend/src/users/SKILL.md` | `api/routes/auth.routes.ts`, `user.routes.ts` | ✅ Implemented |
| Code Generation | `Backend/src/codegen/SKILL.md` | `api/routes/codegen.routes.ts` | ✅ Implemented |
| Governance | `Backend/src/governance/SKILL.md` | *(not yet built)* | ❌ CRITICAL — No API layer |
| Metadata & Datasets | `Backend/src/metadata/SKILL.md` | `api/routes/node-template.routes.ts` | ❌ Dataset API missing |
| Shared Infra | `Backend/src/shared/SKILL.md` | Middleware, Logging, Errors | ✅ Implemented |
| Database | `database/SKILL.md` | SQL schema + logic files | ✅ Implemented |

---

## Project Overview

**ETL1** is a Cloud-Neutral, No-Code Spark ETL Platform.  
A drag-and-drop UI lets data engineers visually design Spark pipelines and orchestrate them.  
The backend generates optimised Spark code and submits it to any configured cluster.

```
ETL1/
├── Frontend/          # UI (React + Vite + Tailwind)
├── Backend/           # Node.js API + Spark code generation
│   └── src/
│       ├── api/
│       │   ├── routes/        # Express route files (primary implementation)
│       │   ├── controllers/   # Request handlers
│       │   ├── services/      # Business logic (connections, projects)
│       │   └── middleware/    # auth, correlation, RBAC, request-logger, userId
│       ├── codegen/           # Spark code generation engines
│       │   └── SKILL.md       # ← Read before touching codegen
│       ├── connections/
│       │   └── SKILL.md       # ← Read before touching connections service
│       ├── projects/
│       │   └── SKILL.md       # ← Read before touching projects service
│       ├── pipelines/
│       │   └── SKILL.md       # ← Read before touching pipelines service
│       ├── executions/
│       │   └── SKILL.md       # ← Read before touching executions service
│       ├── orchestrators/
│       │   └── SKILL.md       # ← Read before touching orchestrators service
│       ├── users/
│       │   └── SKILL.md       # ← Read before touching users/auth service
│       ├── governance/
│       │   └── SKILL.md       # ← Read before touching governance service
│       ├── metadata/
│       │   └── SKILL.md       # ← Read before touching metadata service
│       ├── connectors/        # Connector plugin architecture
│       ├── db/                # DB connection pool + repositories
│       └── shared/
│           ├── SKILL.md       # ← Read before touching logging/errors/security
│           ├── logging/       # LoggerFactory, Winston, CorrelationContext
│           ├── errors/        # AppError, ErrorClass, catalog/*.errors.ts
│           └── security/      # encryption.utils.ts
├── database/          # PostgreSQL — THE GOLDEN SOURCE
│   ├── memory.md      # ← READ THIS BEFORE ANY DB CHANGE
│   ├── SKILL.md       # ← Read before making any DB schema change
│   ├── schema/        # Table DDL files
│   ├── audit/         # Trigger function + attachments
│   ├── logic/         # Functions and procedures
│   └── master_install.sql
└── Docs/              # PRD and architecture documents
```

---

## Database — Critical Rules (summary; full detail in `database/memory.md`)

1. **Use a PostgreSQL Client.** You MUST use a standard PostgreSQL client (`psql` or similar) to execute SQL commands.
2. **Read `database/memory.md` first.** Always.
3. **In-place edits only.** Never create a new SQL file for a schema change. Edit the existing file.
4. **No `is_deleted`**. Physical deletes only. History triggers capture pre-delete images.
5. **No `tenant_id`**. Single-tenant deployment model (one DB instance per customer).
6. **No `workspace_id`** and no workspaces table. `etl.projects` is the top-level container. Law 9.
7. **No `owner_id` / `owner_user_id`**. Access is via `gov.user_roles` / `gov.project_user_roles`. No single-owner concept.
8. **No `is_active` / `is_active_flag`** on entity tables. An entity exists or is physically deleted.
9. **No reserved-word columns.** Use context-prefixed names: `pipeline_display_name`, not `name`.
10. **No JSON blob columns for schema metadata.** Use proper child tables (e.g. `catalog.dataset_columns`).
11. **No array columns for tags.** Use `catalog.asset_tags` join table.
12. **No `config` columns.** Name them specifically: `conn_config_json_encrypted`, `dag_definition_json`, etc.
13. **100% COMMENT coverage** on all tables, columns, functions, and procedures.
14. **pgcrypto everywhere** for PII and credentials. Never store plaintext passwords or secrets.
15. **All objects schema-qualified:** `etl.*`, `catalog.*`, `execution.*`, `gov.*`, `history.*`, `meta.*`

## Database — Execution Plane Table Names
These are the correct, user-approved names as of 2026-03-01:

| Old (WRONG — do not use) | Current (CORRECT) |
|---|---|
| `execution.job_runs` | `execution.pipeline_runs` |
| `execution.task_runs` | `execution.pipeline_node_runs` |
| `execution.job_logs` | `execution.pipeline_run_logs` |
| `execution.job_metrics` | `execution.pipeline_run_metrics` |
| *(did not exist)* | `execution.orchestrator_runs` |
| *(did not exist)* | `execution.orchestrator_pipeline_run_map` |

## Database — Columns Removed by Design (DO NOT RE-ADD)

| Column | Table | Why Removed |
|---|---|---|
| `lifecycle_status_code` | `etl.projects` | Project exists or is deleted. No lifecycle needed. |
| `owner_user_id` | `etl.projects` | Access via `gov.user_roles`. No single-owner concept. |
| `is_active_flag` | `catalog.connectors` | Connector is alive or deleted. No passive state. |
| `is_vetted_flag` | `catalog.datasets` | Vague flag, no workflow. Removed by user decision. |
| `dataset_metadata_json` | `catalog.datasets` | `dataset_columns` table IS the metadata. Redundant blob. |
| `is_template_flag` | `catalog.pipelines` | Reuse = copy/branch, not a flag. |
| `lifecycle_status_code` | `catalog.pipelines` | State implied by `active_version_id`. |
| `version INTEGER` | any table | Optimistic lock is a backend concern, not DB. |

---

## Database — Relationship Coverage Required

Every cross-entity relationship must be navigable via FK or explicit mapping table.
These must all be answerable by the DB without parsing JSON blobs:

| Question | Answered By |
|---|---|
| Which orchestrators run this pipeline? | `catalog.orchestrator_pipeline_map` |
| Which connectors does this pipeline use? | `catalog.pipeline_dataset_map` → `catalog.datasets.connector_id` |
| Which connector owns this dataset? | `catalog.datasets.connector_id` |
| Which pipeline was executed in this run? | `execution.pipeline_runs.pipeline_id` |
| Which orchestrator triggered this run? | `execution.orchestrator_runs.orch_id` |
| Which run does this node task belong to? | `execution.pipeline_node_runs.pipeline_run_id` |
| Which IR node is this task executing? | `execution.pipeline_node_runs.node_id_in_ir_text` |
| Which run does this lineage record belong to? | `execution.run_lineage.pipeline_run_id` |
| Which datasets are in this run's lineage? | `execution.run_lineage.src_dataset_id` / `tgt_dataset_id` |

---

## Logging Framework — Critical Rules

> Full spec: `Docs/Logging_Framework_Requirements_and_Plan.md`

1. **No `console.log` / `console.error` anywhere in the Backend.** Use only the logging framework.
2. **One logger per service, bound to its own log file.**  
   `const log = LoggerFactory.get('connections')` → writes only to `logs/connections.log`.
3. **Supported service names** (log file names are derived from these):  
   `users` | `connections` | `metadata` | `pipelines` | `executions` | `orchestrators` | `codegen` | `governance` | `api` | `db`
4. **Log levels** (ascending): `TRACE` → `DEBUG` → `INFO` → `WARN` → `ERROR` → `FATAL`  
   Service reads `LOG_LEVEL` from `.env`. Events below the configured level are silently discarded.
5. **Every log call must include an `action` string** in `<service>.<verb>` format (e.g. `connections.create`).
6. **`correlationId` and `requestId` are injected automatically** via `CorrelationContext` (AsyncLocalStorage). Never pass them manually.
7. **No PII or secrets in `meta`.** Redact or omit before logging.
8. **Logger location:** `Backend/src/shared/logging/` — `ILogger.ts`, `LogLevel.ts`, `LoggerFactory.ts`, `WinstonLogger.ts`, `CorrelationContext.ts`, `index.ts`.
9. **`logs/` directory is gitignored.** Auto-created at runtime by Winston.
10. When creating any new service module, adopt `LoggerFactory.get('<service>')` at module scope before writing any other code.

---

## Error Standards — Critical Rules

> Full spec: `Docs/Error_Standards_and_Message_Catalog.md`

1. **No raw exceptions ever reach the API response.** Every raw DB/driver/network error must be caught and wrapped into an `AppError` before propagating.
2. **Never expose internal detail in `userMessage`:** No stack traces, no table/column/constraint names, no ORM names, no HTTP status code text.
3. **Every known failure condition has a catalog code** (`USR-001`, `CONN-003`, etc.). Never invent ad-hoc error strings in service files. Use `AppErrors.<domain>.<factory>(...)` factory functions.
4. **Error code format:** `<DOMAIN>-<NNN>`. Domain prefixes: `USR` | `CONN` | `META` | `PIPE` | `EXEC` | `ORCH` | `CGEN` | `GOV` | `DB` | `SYS`.
5. **Two messages, always different:**
   - `userMessage` — plain English for the API consumer. Actionable. No internals.
   - `internalMessage` — full technical context for the log file only.
6. **Error classes and their HTTP status:**
   - `VALIDATION` → 400 · `NOT_FOUND` → 404 · `CONFLICT` → 409
   - `AUTHENTICATION` → 401 · `AUTHORIZATION` → 403
   - `EXTERNAL_DEPENDENCY` → 503 · `INTERNAL` → 500
7. **Log level by class:** `VALIDATION / NOT_FOUND / CONFLICT / AUTH*` → `WARN`. `EXTERNAL_DEPENDENCY / INTERNAL` → `ERROR`.
8. **`correlationId` always appears in the API error response body** for `INTERNAL` and `EXTERNAL_DEPENDENCY` errors.
9. **The global error handler middleware owns logging and responding.** Service catch blocks throw; they do not log and do not call `res.json()`.
10. **Error catalog files live at:** `Backend/src/shared/errors/catalog/<domain>.errors.ts`. One file per domain prefix.
11. **Never reuse a retired error code number.** Tombstone with `// DEPRECATED` comment.
12. **`AppError` shape:** `code`, `errorClass`, `httpStatus`, `userMessage`, `internalMessage`, `meta`, `cause`, `alertable`.

---

## Backend Conventions

- **Language:** TypeScript / Node.js
- **API:** REST (see `Backend/src/api/routes/`)
- **Code generation:** Spark SQL / PySpark (see `Backend/src/codegen/`)
- Before any DB call the backend must run:
  ```sql
  SET LOCAL app.user_id = '<uuid>';
  SET LOCAL app.encryption_key = '<secret>';
  ```

---

## Backend Conventions — Additional Rules

- **TypeScript strict mode.** No `any` except where absolutely unavoidable (document it).
- **No direct `db.query()` in route handlers.** Route handlers call services; services call repositories.
  Exception: the inline route handlers in `pipeline.routes.ts`, `executions.routes.ts`,
  `orchestrators.routes.ts`, `projects.routes.ts` are existing tech debt to be migrated, not a pattern to follow.
- **Session variables before every DB transaction:**
  ```typescript
  await client.query(`SET LOCAL app.user_id = '${userId}'`);
  await client.query(`SET LOCAL app.encryption_key = '${encKey}'`);
  ```
- **Physical deletes only.** No `UPDATE ... SET is_deleted = true`. Law 4.
- **New service module checklist:**
  1. Create `Backend/src/<service>/SKILL.md`
  2. Create `<service>.routes.ts` → `<service>.controller.ts` → `<service>.service.ts` → `<service>.repository.ts`
  3. Add `const log = LoggerFactory.get('<service>')` at module scope
  4. Add `<domain>.errors.ts` to `shared/errors/catalog/`
  5. Register route in `api/server.ts`
  6. Update **Service SKILL.md Map** table above

---

## Documentation

- Full PRD + TSD: `Docs/Cloud_Neutral_No_Code_Spark_ETL_Platform_PRD_TSD.md`
- Architecture: `Docs/NoCode_ETL_Detailed_Architecture_and_Requirements.md`
- Database rules: `database/memory.md`
- Database schema skill: `database/SKILL.md`
- Per-service skills: `Backend/src/<service>/SKILL.md` (see Service SKILL.md Map above)

---

## Living Decisions — Platform-Wide

- `2026-03-18` — **Backend Wiring + Stub Elimination Session:**
  1. `governance.routes.ts` — NEW. Full CRUD for users, roles, permissions, user-role assignments, project member management. Registered in `server.ts` at `/api/governance`.
  2. SQL injection fix in `executions.routes.ts` KPI endpoint — `projectId` was interpolated into SQL string; replaced with parameterised `$3::uuid`.
  3. `api.ts` — Added governance methods: `getUsers`, `getUser`, `getRoles`, `getPermissions`, `assignUserRole`, `revokeUserRole`, `getProjectMembers`, `addProjectMember`, `removeProjectMember`.
  4. `LeftSidebar.tsx` — `UsersSection` and `RolesSection` now call real API on expand (lazy-load). Refresh button wired. Stubs removed.
  5. `OrchestratorExecutionHistorySubTab.tsx` — Replaced MOCK_RUNS with real `api.getOrchestratorRuns()` call. Dark theme, pagination, real status badges, opens execution detail tab on double-click. `orchId` prop passed from `OrchestratorWorkspace`.

- `2026-03-18` — **v2 Execution & Scheduling Session:** Implemented nocode_etl_ui_requirements_v2.md.
  1. ExecutionHistorySubTab rewritten — full v2 column set (Exec ID, Status, Start, End, Duration, Run By, Trigger, Rows In/Out/Failed, Data Vol, Env, Version, Retries), multi-field filter panel (date range, status, trigger type, user, duration, rows), CSV export, dark theme.
  2. ExecutionDetailTab rewritten — dark theme, 5 sub-tabs (Summary, Steps, Logs, Code, Metrics), LogViewer with search + level filter + copy + download, Code tab with syntax highlight + copy + download.
  3. PipelineCodeSubTab — NEW. Generate PySpark/Scala/SQL via API, syntax highlighted viewer, copy + download.
  4. PipelineMetricsSubTab — NEW. Success rate, avg/min/max duration, status breakdown bar, duration trend chart. Loads from last 30 runs API.
  5. PipelineAlertsSubTab — NEW. Alert rule CRUD with event types (EXECUTION_FAILED, SLA_BREACHED, etc.) and channels (email, Slack, webhook, PagerDuty), silence window, enable/disable toggle.
  6. OrchestratorScheduleSubTab rewritten — 4 schedule types (Cron, Interval, Event, Manual), Name field, retry policy (fixed/exponential), failure handling (stop/continue/rollback/skip), blackout windows, holiday calendar.
  7. PipelineWorkspace expanded to 12 sub-tabs: Designer, Properties, Parameters, Validation, Executions, Metrics, Code, Alerts, History, Dependencies, Permissions, Activity.
  8. PipelineSubTab type extended with metrics, code, alerts, logs.

- `2026-03-18` — **UI Architecture Session:** Implemented full tab-based NoCode ETL workspace per nocode_etl_ui_requirements.md.
  Key decisions:
  1. All objects open as typed tabs — project, folder, connection, metadata, user, role added as tab types to `Tab` interface.
  2. `TabBar` rewritten with type icons, dirty italic+asterisk rendering, right-click context menu (close/close-others/close-all/pin/restore-last-closed), horizontal scroll on wheel.
  3. `tabsSlice` extended with: closeOthers, closeAll, pinTab, unpinTab, restoreLastClosed, updateTab.
  4. `Tab` interface extended with `hierarchyPath` (full breadcrumb string) and `isPinned`.
  5. New shared components: `ObjectHeader` (hierarchy breadcrumb, status badges, dirty indicators), `ObjectHistoryGrid` (sortable/filterable audit grid), `ObjectPermissionsGrid` (inherited vs direct permissions).
  6. New workspaces created: ProjectWorkspace (6 tabs), FolderWorkspace (5 tabs), ConnectionWorkspace (7 tabs), MetadataBrowserWorkspace (6 tabs), UserWorkspace (6 tabs), RoleWorkspace (6 tabs).
  7. PipelineWorkspace expanded from 7 to 9 sub-tabs per spec: added Properties, Parameters, Validation, Dependencies, Activity.
  8. OrchestratorWorkspace expanded from 6 to 9 sub-tabs per spec: added Properties, Schedule, Parameters, History, Dependencies, Activity.
  9. `LeftSidebar` updated: project nodes now open Project tab on click, connections open ConnectionWorkspace, Users/Roles sections added.
  10. `Header` rewritten with context-aware toolbar (Save, SaveAll, Undo, Redo, Validate, Run, Publish), environment selector dropdown, dirty-count badge.
  11. `ResizableAppShell` — right and bottom panels only render when content is passed AND `*Visible` flag is true.
  12. All new components use dark theme (`bg-[#0d0f1a]`, `border-slate-800`) consistent with existing dark design.
  13. HierarchyPath format: `Root → Parent → ... → ObjectName` using `→` separator.

- `2026-03-18` — **Enterprise UI Overhaul & RBAC Access Fix:**
  1. `Header.tsx` — Reduced height to 32px (h-8), logo to 20px (w-5 h-5), and `TBtn` to 22px high-density layout. Simplified spacer logic to prevent search bar overlap.
  2. `LeftSidebar.tsx` — Boosted icon opacity and label contrast. Brightened default text from `slate-400` to `slate-300` and bolstered hover states.
  3. RBAC Fix — Resolved `403 Forbidden` on pipeline creation by granting `ADMIN` and `DEVELOPER` roles to the default user (`admin@etl1.local`) using `gov.pr_assign_user_role` procedure.
> Service-specific decisions go in the relevant service SKILL.md instead.

- `2026-03-17` — **User Instruction:** All file writes go directly to the user's local
  filesystem via `Filesystem:write_file` / `Filesystem:edit_file`. Never write to Claude's
  container (`/home/claude`, `/mnt/...`). Never use `bash_tool` or `create_file` for project files.
- `2026-03-17` — **Service SKILL.md files created** for all 10 service domains.
  Each SKILL.md contains: purpose, file map, API surface, DB tables, business rules,
  known issues/tech debt, and a living decisions log.
- `2026-03-17` — **Living Documentation Rule established:** Every session that makes a
  change MUST append to the relevant SKILL.md Living Decisions section before ending.
- `2026-03-17` — **Critical Tech Debt Identified:**
  1. `pipeline.repository.ts` uses unqualified `pipelines` table with banned columns — must be eliminated.
  2. Governance service has NO API layer — `GovernanceView.tsx` renders nothing real.
  3. Metadata/Dataset API is missing — `MetadataTree.tsx` uses mock data.
  4. KPI endpoint in `executions.routes.ts` has SQL injection risk (string interpolation for projectFilter).
  5. RBAC is frontend-only — `rbac.middleware.ts` is not applied to any route.
  6. `GET /api/orchestrators` (list) endpoint does not exist.
