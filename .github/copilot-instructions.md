# GitHub Copilot Instructions for ETL1 Database Repository

This repository is almost entirely a **PostgreSQL metadata schema and logic** for a
cloud-neutral, no-code Spark ETL platform.  There is no application code here, but
the architecture docs at the top level explain the bigger system.

## Big picture & architecture

- **Control plane only.**  The code lives in `database/src` and defines the
  metadata repository used by the frontend, backend API and compiler service.
  Other components (React UI, Node.js API, Python compiler) are described in the
  `PRD`/`TSD` docs but reside in other repos.
- **PostgreSQL-centric design.**  The `master_install.sql` script boots the
  schema; it includes `schema/base_tables.sql`, then all `logic/*.sql` files.
  The database holds tenants, users, projects, pipelines, versions, connectors,
  etc.
- **Layered schema.**  Tables are grouped into numbered "layers" (identity,
  multi-tenancy, RBAC, pipelines, execution metadata, etc.) with a clear
  ordering.  See comments in `base_tables.sql` for the 23‑layer DDL.
- **Multi‑tenant & audit** are first‑class citizens.  Every table has `tenant_id`,
  `is_deleted`, `version` for optimistic locking, and a corresponding `_audit`
  shadow table.  Audit triggers are generated dynamically by
  `audit/audit_triggers.sql` and invoked from `master_install.sql`.

## Naming conventions & SQL standards

- **Object prefixes:**
  - `fn_` for `FUNCTION` (reads, stable SQL or plpgsql).
  - `pr_` for `PROCEDURE` (writes/atomic DML, always plpgsql).
  - `v_` for local `VARIABLE`, `p_` for parameters, `r_` for return values.
  - Tables use lowercase with underscores; audit tables suffixed `_audit`.
- **Function/procedure structure:**
  - Read-only queries return `RETURNS TABLE (...)` and are `STABLE`.
  - Procedures perform multi-step inserts/updates and use `OUT` parameters for
    generated UUIDs.
- **SQL contract:** all DML is wrapped in procedures so callers (API layer)
  never write ad‑hoc SQL.  Follow the patterns in existing logic files.
- **Session settings** such as `app.user_id`, `app.ip_address`, `app.user_agent`
  are used by audit triggers to record who made a change; set them in the
  client before running DML.

## Developer workflows

1. **Bootstrapping a database**
   ```sh
   psql -d mydb -f database/src/master_install.sql
   ```
   This will create extensions (`uuid-ossp`, `ltree`), the 23‑layer schema, all
   functions/procedures, and audit infrastructure.
2. **Incremental changes**
   - Add new tables to `schema/base_tables.sql` within the appropriate layer and
     update `master_install.sql` if a new file is needed.
   - Write new logic in `logic/<area>_logic.sql` following the naming and
     parameter conventions.  Ensure the file is included in
     `master_install.sql` in the correct order.
   - Use `fn_sys_generate_audit_infrastructure()` or modify
     `audit_triggers.sql` if new tables require audits.
3. **Testing & debugging**
   - There are no automated unit tests here; rely on a local PostgreSQL
     instance and manual `psql` scripts or integration tests in the API repo.
   - Use `RAISE NOTICE` inside procedures for debugging; check audit tables to
     verify triggers fire correctly.

## Project-specific patterns

- **Dynamic audit generation.**  The `audit/` folder contains a generic
  trigger generator.  When a new core table is added, simply call
  `fn_sys_generate_audit_infrastructure('table_name')` in the `DO` block.
- **Soft deletes** (`is_deleted`, `deleted_at`) are used everywhere so queries
  must filter them explicitly; procedures typically include `WHERE ... AND
  is_deleted = FALSE`.
- **Versioning logic** for pipelines, connectors, etc., lives in
  `pipeline_logic.sql` and similar files; `pr_publish_*` procedures compute the
  next version number and store an IR payload as JSONB.
- **Hierarchies** use `ltree` paths (`folders.path`, etc.) allowing recursive
  queries without adjacency lists.

## Integration points & external dependencies

- **PostgreSQL extensions**: `uuid-ossp` for UUID generation and `ltree` for
  hierarchical paths.
- **External services**: None in this repo; the control-plane services (Node/
  Python) interact with the database via standard drivers and set session
  variables before calling procedures.
- **Deployment**: The database is expected to be created or migrated from the
  `master_install.sql` script; migrations beyond initial install are manual and
  typically done by appending to the script or running ALTER statements in a
  transaction handled by the API layer.

## Notes and gotchas

- Don't hardcode tenant IDs or UUIDs; procedures always accept `tenant_id` and
  resolve foreign keys in a multi-tenant-safe way.
- Keep search paths clean; all objects are created in `public` and referenced
  without a schema prefix.
- `master_install.sql` is idempotent only insofar as `CREATE TABLE IF NOT
  EXISTS`/`CREATE OR REPLACE FUNCTION` statements are used; re-running it on a
  populated database may not be safe without review.

> _After creating or updating this file, ask the user if there are any
> unclear or missing sections so we can iterate._
