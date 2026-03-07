-- ############################################################################
-- # FILE: master_install.sql
-- # PURPOSE: Orchestrates the complete database installation in strict
-- #          dependency order. Execute this file only — it calls all others.
-- #
-- # EXECUTION ORDER (DO NOT CHANGE — EACH FILE DEPENDS ON THE PREVIOUS):
-- #   1.  00_extensions_schemas.sql  — Extensions + CREATE SCHEMA (no tables)
-- #   2.  01_base_tables.sql         — All table DDL (no functions)
-- #   3.  02_history_tables.sql      — Audit shadow tables (mirrors of base tables)
-- #   4.  audit/audit_triggers.sql   — Trigger function + attachments (needs tables)
-- #   5.  logic/lifecycle_logic.sql  — User/environment CRUD (needs users table)
-- #   6.  logic/rbac_logic.sql       — RBAC functions and procedures
-- #   7.  logic/hierarchy_logic.sql  — Project/folder CRUD with LTREE
-- #   8.  logic/catalog_logic.sql    — Connector/dataset CRUD with encryption
-- #   9.  logic/pipeline_logic.sql   — Pipeline/version/content CRUD (Law 14)
-- #   10. logic/execution_logic.sql  — Job run and observability CRUD
-- #   11. logic/governance_logic.sql — Glossary, DQ rules, contracts
-- #   12. logic/persistence_logic.sql — Draft/autosave session recovery (Law 15)
-- ############################################################################

\echo 'Step 1/12: Extensions and Schemas'
\ir schema/00_extensions_schemas.sql

\echo 'Step 2/12: Base Tables'
\ir schema/base_tables.sql

\echo 'Step 3/12: History Shadow Tables'
\ir schema/02_history_tables.sql

\echo 'Step 4/12: Audit Triggers'
\ir audit/audit_triggers.sql

\echo 'Step 5/12: Lifecycle Logic (Users, Environments)'
\ir logic/lifecycle_logic.sql

\echo 'Step 6/12: RBAC Logic (Roles, Permissions, Secrets)'
\ir logic/rbac_logic.sql

\echo 'Step 7/12: Hierarchy Logic (Projects, Folders)'
\ir logic/hierarchy_logic.sql

\echo 'Step 8/12: Catalog Logic (Connectors, Datasets)'
\ir logic/catalog_logic.sql

\echo 'Step 9/12: Pipeline Logic (Pipelines, Versions, IR Body)'
\ir logic/pipeline_logic.sql

\echo 'Step 10/12: Execution Logic (Jobs, Tasks, Logs, Metrics)'
\ir logic/execution_logic.sql

\echo 'Step 11/12: Governance Logic (Glossary, DQ Rules)'
\ir logic/governance_logic.sql

\echo 'Step 12/13: Persistence Logic (Drafts, Autosave)'
\ir logic/persistence_logic.sql

\echo 'Step 13/13: Validation Logic (Save Guards, Column Mapping, IR Validation)'
\ir src/logic/validation_logic.sql

\echo '============================================================'
\echo ' Installation complete. All 15 laws enforced.'
\echo '============================================================'
