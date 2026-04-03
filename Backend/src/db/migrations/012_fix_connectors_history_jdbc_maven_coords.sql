-- =============================================================================
-- Migration: 012_fix_connectors_history_jdbc_maven_coords.sql
-- Backfills audit history parity for catalog.connectors after JDBC Maven coords
-- were added to the base table.
-- =============================================================================

ALTER TABLE history.connectors_history
    ADD COLUMN IF NOT EXISTS conn_jdbc_driver_maven_coords TEXT;
