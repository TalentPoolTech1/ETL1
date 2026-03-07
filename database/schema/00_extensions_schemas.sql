-- ############################################################################
-- # FILE: 00_extensions_schemas.sql
-- # PURPOSE: Step 1 of 12. Extensions and schema namespaces ONLY.
-- #          Must be executed FIRST before any other SQL file.
-- ############################################################################

BEGIN;

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
-- uuid-ossp: Required for uuid_generate_v4() primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- ltree: Required for hierarchical folder path (GIST-indexed tree traversal)
CREATE EXTENSION IF NOT EXISTS "ltree";
-- pgcrypto: Required for pgp_sym_encrypt / pgp_sym_decrypt on PII fields
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SCHEMAS
-- The public schema is deliberately avoided; all objects live in named schemas.
-- ============================================================================

-- etl: Core platform identity (users, projects, folders, hierarchy, drafts)
CREATE SCHEMA IF NOT EXISTS etl;
COMMENT ON SCHEMA etl IS 'Core platform identity: users, projects, and hierarchical asset navigation.';

-- catalog: Data assets (connectors, datasets, pipelines, orchestrators, versions)
CREATE SCHEMA IF NOT EXISTS catalog;
COMMENT ON SCHEMA catalog IS 'Data engineering asset catalog: connectors, datasets, pipelines, and versioned bodies.';

-- execution: Runtime plane (job runs, task runs, logs, metrics)
CREATE SCHEMA IF NOT EXISTS execution;
COMMENT ON SCHEMA execution IS 'Execution plane: job runs, task-level telemetry, and observability logs.';

-- gov: Governance (secrets, RBAC, glossary, DQ rules, contracts, policies)
CREATE SCHEMA IF NOT EXISTS gov;
COMMENT ON SCHEMA gov IS 'Governance: access control, secrets, business glossary, and compliance policies.';

-- history: Immutable row-level audit shadow tables only (no application logic)
CREATE SCHEMA IF NOT EXISTS history;
COMMENT ON SCHEMA history IS 'Immutable audit trail: shadow tables capturing pre-change row images for all critical entities.';

-- meta: Global registries (type mappings, transform libraries, CDC, search index)
CREATE SCHEMA IF NOT EXISTS meta;
COMMENT ON SCHEMA meta IS 'Platform-wide registries: type mappings, transform libraries, CDC configurations, and asset search.';

COMMIT;
