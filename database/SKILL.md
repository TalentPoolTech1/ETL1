---
name: database-schema-change
description: How to make any database schema or logic change to the ETL1 PostgreSQL database correctly.
---

# DB Schema Change Skill

## Overview

This skill defines the exact steps for making any database change to the ETL1 platform.  
**The golden source principle:** the files listed below are always the ground truth.  
What is in those files = what is deployed.

---

## Pre-Flight: ALWAYS Read First

Before touching any SQL:

1. Read `database/memory.md` — all architectural laws and design decisions
2. Read `CLAUDE.md` at project root — project conventions
3. Identify which file(s) need changing (see File Map below)
4. Never create a new file for a change
5. **Only use a PostgreSQL client** (`psql` or similar) to execute SQL commands in the database.

---

## File Map

| File | What goes here |
|---|---|
| `database/schema/00_extensions_schemas.sql` | New PostgreSQL extensions or new schemas ONLY |
| `database/schema/base_tables.sql` | ALL `CREATE TABLE`, `ALTER TABLE`, `COMMENT ON TABLE/COLUMN` |
| `database/schema/02_history_tables.sql` | History shadow table additions (Law 7) |
| `database/audit/audit_triggers.sql` | Trigger function changes or new trigger attachments |
| `database/logic/lifecycle_logic.sql` | `etl.users` and `execution.environments` CRUD |
| `database/logic/rbac_logic.sql` | `gov.roles`, `gov.permissions`, `gov.secrets` CRUD |
| `database/logic/hierarchy_logic.sql` | `etl.projects`, `etl.folders` CRUD |
| `database/logic/catalog_logic.sql` | `catalog.connectors`, `catalog.datasets` CRUD |
| `database/logic/pipeline_logic.sql` | `catalog.pipelines`, `catalog.pipeline_versions`, `catalog.pipeline_contents` CRUD |
| `database/logic/execution_logic.sql` | `execution.pipeline_runs`, `execution.orchestrator_runs`, node/log/metric CRUD |
| `database/logic/governance_logic.sql` | `gov.glossary_terms`, `gov.dq_rules`, `gov.data_contracts` CRUD |
| `database/logic/persistence_logic.sql` | `etl.user_work_drafts` autosave/discard |

---

## Step-by-Step: Adding a New Column

1. Open `database/schema/base_tables.sql`
2. Find the `CREATE TABLE schema.tablename (` block
3. Add the column inside the parentheses
4. Immediately after the table's existing `COMMENT ON COLUMN` block, add:
   ```sql
   COMMENT ON COLUMN schema.tablename.new_column IS 'Meaningful description here.';
   ```
5. If the database is already running, also prepare the `ALTER TABLE` statement:
   ```sql
   ALTER TABLE schema.tablename ADD COLUMN new_column TEXT;
   COMMENT ON COLUMN schema.tablename.new_column IS 'Meaningful description.';
   ```

## Step-by-Step: Adding a New Function or Procedure

1. Open the relevant logic file (see File Map)
2. Add the function using `CREATE OR REPLACE FUNCTION` or `CREATE OR REPLACE PROCEDURE`
3. Immediately after, add:
   ```sql
   COMMENT ON FUNCTION/PROCEDURE schema.fn_name(...) IS 'What this does.';
   ```
4. Place it inside the existing `BEGIN; ... COMMIT;` block

## Step-by-Step: Renaming a Column

1. Edit `base_tables.sql` — rename in `CREATE TABLE` and its `COMMENT ON COLUMN`
2. Search all logic files for the old column name:
   ```
   grep -r "old_column_name" database/logic/
   ```
3. Update every occurrence in every logic file
4. Update the history table in `02_history_tables.sql` (it uses `LIKE ... INCLUDING DEFAULTS`)
5. For running databases: `ALTER TABLE schema.t RENAME COLUMN old TO new;`

## Step-by-Step: Adding a New Table

1. Add the `CREATE TABLE` block to `base_tables.sql` in the correct layer section
2. Add all `COMMENT ON TABLE` and `COMMENT ON COLUMN` statements
3. Add a corresponding history shadow table in `02_history_tables.sql`:
   ```sql
   CREATE TABLE history.new_table_history (
       LIKE schema.new_table INCLUDING DEFAULTS,
       hist_id         BIGSERIAL NOT NULL,
       hist_action_cd  CHAR(1) NOT NULL,
       hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
       hist_action_by  UUID
   );
   COMMENT ON TABLE history.new_table_history IS '...';
   -- + COMMENT ON COLUMN for the 4 hist_* columns
   ```
4. Add trigger attachment in `audit_triggers.sql`:
   ```sql
   CREATE TRIGGER tr_audit_schema_new_table
       BEFORE UPDATE OR DELETE ON schema.new_table
       FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();
   ```
5. Add CRUD functions in the appropriate logic file

---

## Laws to Verify Before Committing

Run this mental checklist on every change:

- [ ] Object schema-qualified? (`etl.`, `catalog.`, etc.)
- [ ] No `is_deleted`, `deleted_at`, `version INTEGER`, `tenant_id`?
- [ ] No reserved-word column names (`name`, `description`, `status`, `type`, `value`)?
- [ ] Every new column has a `COMMENT ON COLUMN`?
- [ ] Every new table has a `COMMENT ON TABLE` + `history.*_history` shadow table + trigger?
- [ ] Every new function/procedure has a `COMMENT ON FUNCTION/PROCEDURE`?
- [ ] Sensitive fields encrypted via `pgp_sym_encrypt`?
- [ ] Deletes are physical (`DELETE FROM`) not soft?
- [ ] New files were NOT created? (all changes are in-place in existing files)

---

## Deploying to the Database

### Clean install (empty database):
```bash
psql -U postgres -d etl_db -f database/master_install.sql
```

### Change on running database:
Run the specific `ALTER TABLE` / `CREATE OR REPLACE FUNCTION` statements directly.  
Then update the corresponding source file to keep it as the golden source.

```bash
# Example: apply a specific change
psql -U postgres -d etl_db -c "ALTER TABLE etl.projects ADD COLUMN region_code TEXT;"
```

Then immediately update `base_tables.sql` with the new column and comment.
