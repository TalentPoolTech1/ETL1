# CLAUDE.md — Project Bootstrap Instructions

> **Every AI session must read this file first before making any changes.**
> Read `database/memory.md` before touching any database file.

---

## ⚡ OPERATING MODE — SILENT & LOCAL-FIRST

### Silent Mode (MANDATORY)
- **Zero explanation output.** Make the change. Stop.
- No preamble ("I'll now…"), no summaries ("Here's what I did…"), no postamble.
- No "thinking out loud." Do the work silently.
- Token budget is for code, not commentary.

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

## Project Overview

**ETL1** is a Cloud-Neutral, No-Code Spark ETL Platform.  
A drag-and-drop UI lets data engineers visually design Spark pipelines and orchestrate them.  
The backend generates optimised Spark code and submits it to any configured cluster.

```
ETL1/
├── Frontend/          # UI (React/Next.js — see Frontend/ for conventions)
├── Backend/           # Node.js API + Spark code generation
│   └── src/
│       ├── api/routes/
│       └── codegen/
├── database/          # PostgreSQL — THE GOLDEN SOURCE (read memory.md first)
│   ├── memory.md      # ← READ THIS BEFORE ANY DB CHANGE
│   ├── schema/    # Table DDL files
│   ├── audit/     # Trigger function + attachments
│   ├── logic/     # Functions and procedures
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

## Documentation

- Full PRD + TSD: `Docs/Cloud_Neutral_No_Code_Spark_ETL_Platform_PRD_TSD.md`
- Architecture: `Docs/NoCode_ETL_Detailed_Architecture_and_Requirements.md`
- Database rules: `database/memory.md`
