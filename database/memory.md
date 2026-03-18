# Database Memory — Architectural Decisions & Rules
**ETL Platform — PostgreSQL Database**
**Last Updated:** 2026-03-01

> **CRITICAL OPERATING RULE**
> Any future database change MUST be made **in-place** in the existing SQL file and executed using a **PostgreSQL client** (`psql` or similar).
> **Never create a new file** for a schema change. The files listed below are the
> **single golden source of truth** at all times. What is in these files = what is in production.
>
> **Also read `CLAUDE.md` at project root and the relevant service SKILL.md before any change.**
> For schema changes that affect a service, append to that service's SKILL.md Living Decisions section too.

---

## File Map (Execution Order — DO NOT CHANGE)

| Order | File | Purpose |
|---|---|---|
| 1 | `schema/00_extensions_schemas.sql` | Extensions + `CREATE SCHEMA` only — no tables |
| 2 | `schema/base_tables.sql` | **ALL** table DDL — no functions |
| 3 | `schema/02_history_tables.sql` | Audit shadow tables only |
| 4 | `audit/audit_triggers.sql` | Trigger function + per-table trigger attachments |
| 5 | `logic/lifecycle_logic.sql` | User & environment CRUD |
| 6 | `logic/rbac_logic.sql` | Roles, permissions, secrets |
| 7 | `logic/hierarchy_logic.sql` | Projects, folders, LTREE |
| 8 | `logic/catalog_logic.sql` | Connectors, datasets, column introspection |
| 9 | `logic/pipeline_logic.sql` | Pipelines, versions, IR body (Law 14) |
| 10 | `logic/execution_logic.sql` | Pipeline runs, orchestrator runs, node telemetry |
| 11 | `logic/governance_logic.sql` | Glossary, DQ rules, data contracts |
| 12 | `logic/persistence_logic.sql` | Drafts, autosave, session recovery |
| — | `master_install.sql` | Calls all files in the order above |

### Rule: In-Place Edits Only
- **ADD a column** → edit `base_tables.sql`, add the column to the `CREATE TABLE` block.
- **ADD a function** → edit the relevant logic file.
- **RENAME a table or column** → edit `base_tables.sql` + every logic file that references it.
- **NEVER** create `base_tables_v2.sql`, `new_execution_tables.sql`, or any numbered patch file.
- The `master_install.sql` is for **clean installs on empty databases only**.  
  Incremental changes to a running database use `ALTER TABLE` / `CREATE OR REPLACE FUNCTION` applied **directly to the existing files**.

---

## Schemas

| Schema | Owns |
|---|---|
| `etl` | Users, user_attributes, projects, folders, user_work_drafts |
| `catalog` | Connectors, connector_health, file_format_options, datasets, dataset_columns, pipelines, pipeline_versions, pipeline_contents, orchestrators, branches |
| `execution` | Environments, pipeline_runs, orchestrator_runs, orchestrator_pipeline_run_map, pipeline_node_runs, pipeline_run_logs, pipeline_run_metrics |
| `gov` | Permissions, roles, role_permissions, user_roles, secrets, dq_rules, dq_results, glossary_terms, data_contracts |
| `history` | `*_history` shadow tables only — no application objects |
| `meta` | type_mapping_registry, transform_library, global_variable_registry |

---

## Non-Negotiable Architectural Laws

### Law 1 — Schema Qualification
Every object prefixed with its schema. `CREATE TABLE etl.users` not `CREATE TABLE users`.

### Law 2 — DDL Execution Order
No function/trigger may be created before the tables it references. See File Map above.

### Law 3 — Encryption of PII / Credentials
```sql
-- Store:    pgp_sym_encrypt(plain_text, current_setting('app.encryption_key'))
-- Retrieve: pgp_sym_decrypt(cipher_col::bytea, current_setting('app.encryption_key'))
-- Password: crypt(plain_pwd, gen_salt('bf', 12)) / crypt(plain_pwd, stored_hash)
```
Fields requiring encryption: `password_hash_text`, `mfa_secret_encrypted`,
`conn_config_json_encrypted`, `secret_value_encrypted`.

### Law 4 — Physical Deletes ONLY
`is_deleted` column is **banned**. Every `DELETE` is a real `DELETE FROM`.  
Audit trail is provided by history triggers (Law 7).

### Law 5 — No `deleted_at` Column
Deletion time lives in `history.*_history.hist_action_dtm`. No separate column needed.

### Law 6 — No Optimistic Lock / `version` Column
Version control is handled by `catalog.pipeline_versions`. No generic `version INTEGER` column anywhere.

### Law 7 — History Table Structure
Every `history.*_history` table:
1. Mirrors the original via `LIKE original_table INCLUDING DEFAULTS`
2. Adds exactly 4 extra columns at the end:
```sql
hist_id         BIGSERIAL PRIMARY KEY,
hist_action_cd  CHAR(1) NOT NULL,          -- 'I'=Insert  'U'=Update  'D'=Delete
hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
hist_action_by  UUID                       -- from session variable app.user_id
```
No `JSONB diff`, no `ip_address`. The row itself IS the audit record.

### Law 8 — Single-Tenant Architecture
No `tenants` table. No `tenant_id` column anywhere.  
Each customer = separate deployed database instance.

### Law 9 — No Workspaces Table
`etl.projects` is the top-level container. Workspaces do not exist.

### Law 10 — No Reserved-Word Column Names
**Banned column names:** `name`, `description`, `status`, `type`, `value`, `key`, `code`, `data`, `config`

Use context-prefixed names instead:

| Wrong | Correct |
|---|---|
| `name` | `project_display_name`, `pipeline_display_name` |
| `description` | `project_desc_text`, `pipeline_desc_text` |
| `status` | `run_status_code`, `node_status_code` |
| `type` | `dataset_type_code`, `folder_type_code` |

### Law 11 — Context-Aware Naming Everywhere
Applies to column names and table names. Every name must be readable without knowing its table.

### Law 12 — Folder Hierarchy
`etl.folders` uses **two mechanisms together**:
- `parent_folder_id UUID REFERENCES etl.folders(folder_id)` — self-referential FK
- `hierarchical_path_ltree LTREE` — materialised path for O(1) subtree queries  

No separate folder-mapping table is needed or wanted.

### Law 13 — 100% COMMENT Coverage
Every `CREATE TABLE` → `COMMENT ON TABLE`.  
Every column → `COMMENT ON COLUMN`.  
Every function/procedure → `COMMENT ON FUNCTION/PROCEDURE`.  
Comments must be meaningful, not echo the column name.

### Law 14 — Pipeline Body Must Be Stored
`catalog.pipeline_contents.ir_payload_json NOT NULL` is mandatory.  
`pr_commit_pipeline_version` atomically creates a version AND its body.  
There is no version without a body.

### Law 15 — Unsaved Changes Tracking
`etl.user_work_drafts` persists UI session state.  
`pr_autosave_draft` upserts on every keystroke.  
`pr_discard_draft` physically deletes on commit or rollback.

---

## Design Critique Resolutions (User-Approved)

These were reviewed and agreed during schema development. Do not re-introduce.

| Column / Feature | Decision | Reason |
|---|---|---|
| `lifecycle_status_code` on `etl.projects` | **Removed** | A project either exists or is deleted. No lifecycle state needed. |
| `owner_user_id` on `etl.projects` | **Removed** | Access governed by `gov.user_roles`. No single-owner concept. `created_by_user_id` + `updated_by_user_id` used for factual audit only. |
| `is_active_flag` on `catalog.connectors` | **Removed** | Connector is alive or physically deleted. No passive/inactive state. |
| `is_vetted_flag` on `catalog.datasets` | **Removed** | Vague manual flag with no backing workflow. Meaningless without an approval process table. |
| `dataset_metadata_json` on `catalog.datasets` | **Removed** | `catalog.dataset_columns` table IS the schema metadata. A JSONB blob is redundant and unqueryable at column level. |
| `is_template_flag` on `catalog.pipelines` | **Removed** | A pipeline is a pipeline. Reuse is achieved by copying / branching, not a boolean. |
| `lifecycle_status_code` on `catalog.pipelines` | **Removed** | State is implied by whether `active_version_id` is set. No separate flag needed. |
| `version INTEGER` column anywhere | **Removed** | Optimistic locking is a backend API concern, not a database schema concern. |
| `execution.job_runs` | **Renamed → `pipeline_runs`** | Name now reflects what it tracks. |
| `execution.task_runs` | **Renamed → `pipeline_node_runs`** | Name now reflects DAG-node telemetry, not generic tasks. |
| `execution.job_logs` | **Renamed → `pipeline_run_logs`** | Scoped to a pipeline run. |
| `execution.job_metrics` | **Renamed → `pipeline_run_metrics`** | Scoped to a pipeline run. |
| Orchestrator execution | **Added**: `orchestrator_runs` + `orchestrator_pipeline_run_map` | Orchestrators needed their own run records separate from individual pipeline runs. |

---

## New Tables Added 2026-03-01 (Session 2)

| Table | Schema | Purpose |
|---|---|---|
| `orchestrator_pipeline_map` | `catalog` | Design-time M2M: orchestrator → pipeline membership. Rebuilt on DAG save. |
| `run_lineage` | `execution` | Per-run runtime column-level lineage with actual row counts. |

---

## Living Decisions — Database (Dated)

> Append every database-specific decision, user ruling, or critical finding here.
> Format: `YYYY-MM-DD — [Decision / Instruction / Change / Fix]`

- `2026-03-01` — All execution plane tables renamed. See table above (execution.job_runs → pipeline_runs, etc.).
- `2026-03-01` — `catalog.orchestrator_pipeline_map` and `execution.run_lineage` tables added (Session 2).
- `2026-03-17` — Per-service SKILL.md files created at `Backend/src/<service>/SKILL.md`.
  Any DB change that affects a service must also update that service's SKILL.md Living Decisions.
- `2026-03-18` — **RBAC Permission Correction:** Resolved `403 Forbidden` on pipeline creation by granting `ADMIN` (7a788fb9) and `DEVELOPER` (d22bca7a) roles to the primary user (`admin@etl1.local`) using the `gov.pr_assign_user_role` procedure. This ensures full functional access across the platform.
- `2026-03-18` — **Notification Rules CRUD Expansion:** Added UI-support routines in `database/logic/rbac_logic.sql` for managing `gov.notification_rules`: `gov.fn_get_notification_rules_for_entity`, `gov.pr_set_notification_rule_active`, and `gov.pr_delete_notification_rule`. These preserve Law 4 (physical deletes) and rely on existing history triggers (`history.notification_rules_history`).
- `2026-03-18` — **Environment Listing Function:** Added `execution.fn_get_environments()` in `database/logic/lifecycle_logic.sql` to list registered deployment environments for UI run targeting (select via function, no static lists).
- `2026-03-17` — **Reference Map — Which service uses which DB tables:**

  | Service | Primary Tables |
  |---|---|
  | connections | `catalog.connectors`, `catalog.connector_health` |
  | projects | `etl.projects`, `etl.folders` |
  | pipelines | `catalog.pipelines`, `catalog.pipeline_versions`, `catalog.pipeline_contents` |
  | executions | `execution.pipeline_runs`, `execution.pipeline_node_runs`, `execution.pipeline_run_logs`, `execution.pipeline_run_metrics`, `execution.orchestrator_runs`, `execution.orchestrator_pipeline_run_map`, `execution.run_lineage` |
  | orchestrators | `catalog.orchestrators`, `catalog.orchestrator_pipeline_map` |
  | users | `etl.users`, `etl.user_attributes` |
  | governance | `gov.permissions`, `gov.roles`, `gov.role_permissions`, `gov.user_roles`, `gov.project_user_roles`, `gov.secrets`, `gov.dq_rules`, `gov.dq_results`, `gov.glossary_terms`, `gov.data_contracts` |
  | metadata | `catalog.datasets`, `catalog.dataset_columns`, `catalog.asset_tags`, `meta.type_mapping_registry`, `meta.transform_library`, `meta.global_variable_registry` |
  | codegen | *(stateless — no DB tables)* |
  | shared | *(infrastructure only)* |

---

## Rejected Design — `catalog.pipeline` Proposed Column Violations

A proposed column list was reviewed and rejected. These columns must NEVER be added:

| Proposed Column | Why Rejected |
|---|---|
| `name` | Law 10: reserved word. Use `pipeline_display_name`. |
| `description` | Law 10: reserved word. Use `pipeline_desc_text`. |
| `owner_id` / `owner_user_id` | Removed by design. Access via `gov.project_user_roles`. |
| `orchestrator_id` on pipelines | Wrong direction. A pipeline can run in many orchestrators. Use `catalog.orchestrator_pipeline_map`. |
| `workspace_id` | Law 9: No workspaces. `etl.projects` is the top-level container. |
| `created_at` / `updated_at` | Naming convention: use `created_dtm` / `updated_dtm`. |
| `is_active` | Law 4: physical deletes only. No soft-state flag. |
| `tags` (array column) | Use `catalog.asset_tags` join table. Never store tags as an array column. |
| `config` (JSON blob) | Law 10: reserved word. Name specifically: `dag_definition_json`, etc. |

## Source-System Constraint Tracking (`catalog.dataset_columns`)

```sql
constraint_type_code    TEXT,   -- PK, UK, FK, NONE (a column rows for composite keys)
fk_ref_dataset_id       UUID,   -- referenced parent dataset (FK columns only)
fk_ref_column_name_text TEXT    -- referenced parent column name (FK columns only)
```
**How composite keys work:** the same `column_name_text` can have multiple rows in `dataset_columns`
with different `constraint_type_code` values (e.g., both `PK` and `UK`).

---

## Audit Session Variable Convention

The application backend **must SET** the session user before every DML transaction:
```sql
SET LOCAL app.user_id = '<uuid-of-acting-user>';
SET LOCAL app.encryption_key = '<runtime-secret>';
```
The audit trigger reads `current_setting('app.user_id', TRUE)` to populate `hist_action_by`.

---

## Running Against a Live Database

For an existing database, apply changes using `ALTER TABLE` / `CREATE OR REPLACE`:
```sql
-- Add a column:
ALTER TABLE etl.projects ADD COLUMN new_col TEXT;
COMMENT ON COLUMN etl.projects.new_col IS '...';

-- Modify a function (always use CREATE OR REPLACE):
CREATE OR REPLACE FUNCTION etl.fn_get_projects() ...

-- Add a trigger attachment:
CREATE TRIGGER tr_audit_new_table BEFORE UPDATE OR DELETE ON etl.new_table
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();
```
Then **also update the corresponding source file** so it stays the golden source.
