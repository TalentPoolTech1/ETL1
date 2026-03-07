-- ############################################################################
-- # FILE: 02_history_tables.sql
-- # PURPOSE: Step 3 of 12. History/audit shadow tables ONLY.
-- #          Execute AFTER 01_base_tables.sql.
-- #
-- # LAW 7 ENFORCEMENT:
-- #   - Every history table MIRRORS the original table exactly
-- #   - PLUS 4 extra columns: hist_id, hist_action_cd, hist_action_dtm, hist_action_by
-- #   - NO ip_address, NO user_agent, NO JSONB diff — the row itself IS the audit record
-- ############################################################################

BEGIN;

-- ============================================================================
-- etl SCHEMA HISTORY TABLES
-- ============================================================================

CREATE TABLE history.users_history (
    LIKE etl.users INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);

COMMENT ON TABLE history.users_history IS 'Immutable row-image history for etl.users. Populated by trigger before DELETE or UPDATE.';
COMMENT ON COLUMN history.users_history.hist_id         IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.users_history.hist_action_cd  IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.users_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.users_history.hist_action_by  IS 'User ID from session variable app.user_id who performed the action.';


CREATE TABLE history.projects_history (
    LIKE etl.projects INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);

COMMENT ON TABLE history.projects_history IS 'Immutable row-image history for etl.projects.';
COMMENT ON COLUMN history.projects_history.hist_id         IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.projects_history.hist_action_cd  IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.projects_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.projects_history.hist_action_by  IS 'User ID who performed the action.';


CREATE TABLE history.folders_history (
    LIKE etl.folders INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);

COMMENT ON TABLE history.folders_history IS 'Immutable row-image history for etl.folders.';
COMMENT ON COLUMN history.folders_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.folders_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.folders_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.folders_history.hist_action_by IS 'User ID who performed the action.';


-- ============================================================================
-- catalog SCHEMA HISTORY TABLES
-- ============================================================================

CREATE TABLE history.pipelines_history (
    LIKE catalog.pipelines INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);

COMMENT ON TABLE history.pipelines_history IS 'Immutable row-image history for catalog.pipelines.';
COMMENT ON COLUMN history.pipelines_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.pipelines_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.pipelines_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.pipelines_history.hist_action_by IS 'User ID who performed the action.';


CREATE TABLE history.pipeline_versions_history (
    LIKE catalog.pipeline_versions INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);

COMMENT ON TABLE history.pipeline_versions_history IS 'Immutable row-image history for catalog.pipeline_versions.';
COMMENT ON COLUMN history.pipeline_versions_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.pipeline_versions_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.pipeline_versions_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.pipeline_versions_history.hist_action_by IS 'User ID who performed the action.';


CREATE TABLE history.orchestrators_history (
    LIKE catalog.orchestrators INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);

COMMENT ON TABLE history.orchestrators_history IS 'Immutable row-image history for catalog.orchestrators.';
COMMENT ON COLUMN history.orchestrators_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.orchestrators_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.orchestrators_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.orchestrators_history.hist_action_by IS 'User ID who performed the action.';


CREATE TABLE history.connectors_history (
    LIKE catalog.connectors INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);

COMMENT ON TABLE history.connectors_history IS 'Immutable row-image history for catalog.connectors.';
COMMENT ON COLUMN history.connectors_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.connectors_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.connectors_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.connectors_history.hist_action_by IS 'User ID who performed the action.';


CREATE TABLE history.datasets_history (
    LIKE catalog.datasets INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);

COMMENT ON TABLE history.datasets_history IS 'Immutable row-image history for catalog.datasets.';
COMMENT ON COLUMN history.datasets_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.datasets_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.datasets_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.datasets_history.hist_action_by IS 'User ID who performed the action.';


-- ============================================================================
-- gov SCHEMA HISTORY TABLES
-- ============================================================================

CREATE TABLE history.roles_history (
    LIKE gov.roles INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);

COMMENT ON TABLE history.roles_history IS 'Immutable row-image history for gov.roles.';
COMMENT ON COLUMN history.roles_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.roles_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.roles_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.roles_history.hist_action_by IS 'User ID who performed the action.';


CREATE TABLE history.glossary_terms_history (
    LIKE gov.glossary_terms INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);

COMMENT ON TABLE history.glossary_terms_history IS 'Immutable row-image history for gov.glossary_terms.';
COMMENT ON COLUMN history.glossary_terms_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.glossary_terms_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.glossary_terms_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.glossary_terms_history.hist_action_by IS 'User ID who performed the action.';



-- ============================================================================
-- NEW ENTITY HISTORY TABLES (Layers 14-29)
-- ============================================================================

CREATE TABLE history.orchestrator_versions_history (
    LIKE catalog.orchestrator_versions INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);
COMMENT ON TABLE history.orchestrator_versions_history IS 'Immutable row-image history for catalog.orchestrator_versions.';
COMMENT ON COLUMN history.orchestrator_versions_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.orchestrator_versions_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.orchestrator_versions_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.orchestrator_versions_history.hist_action_by IS 'User ID who performed the action.';


CREATE TABLE history.data_classifications_history (
    LIKE gov.data_classifications INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);
COMMENT ON TABLE history.data_classifications_history IS 'Immutable row-image history for gov.data_classifications. Required for compliance audit trails.';
COMMENT ON COLUMN history.data_classifications_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.data_classifications_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.data_classifications_history.hist_action_dtm IS 'Timestamp when the classification was changed.';
COMMENT ON COLUMN history.data_classifications_history.hist_action_by IS 'User ID who changed the classification.';


CREATE TABLE history.pipeline_parameters_history (
    LIKE catalog.pipeline_parameters INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);
COMMENT ON TABLE history.pipeline_parameters_history IS 'Immutable row-image history for catalog.pipeline_parameters.';
COMMENT ON COLUMN history.pipeline_parameters_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.pipeline_parameters_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.pipeline_parameters_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.pipeline_parameters_history.hist_action_by IS 'User ID who performed the action.';


CREATE TABLE history.schedules_history (
    LIKE execution.schedules INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);
COMMENT ON TABLE history.schedules_history IS 'Immutable row-image history for execution.schedules. Enables audit of schedule changes (cron updates, pauses, deletions).';
COMMENT ON COLUMN history.schedules_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.schedules_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.schedules_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.schedules_history.hist_action_by IS 'User ID who performed the action.';


CREATE TABLE history.notification_rules_history (
    LIKE gov.notification_rules INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);
COMMENT ON TABLE history.notification_rules_history IS 'Immutable row-image history for gov.notification_rules.';
COMMENT ON COLUMN history.notification_rules_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.notification_rules_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.notification_rules_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.notification_rules_history.hist_action_by IS 'User ID who performed the action.';


CREATE TABLE history.platform_settings_history (
    LIKE meta.platform_settings INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);
COMMENT ON TABLE history.platform_settings_history IS 'Immutable row-image history for meta.platform_settings. Enables audit of instance configuration changes.';
COMMENT ON COLUMN history.platform_settings_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.platform_settings_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.platform_settings_history.hist_action_dtm IS 'Timestamp when the setting was changed.';
COMMENT ON COLUMN history.platform_settings_history.hist_action_by IS 'User ID who performed the action.';


CREATE TABLE history.cdc_configurations_history (
    LIKE meta.cdc_configurations INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);
COMMENT ON TABLE history.cdc_configurations_history IS 'Immutable row-image history for meta.cdc_configurations.';
COMMENT ON COLUMN history.cdc_configurations_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.cdc_configurations_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.cdc_configurations_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.cdc_configurations_history.hist_action_by IS 'User ID who performed the action.';


CREATE TABLE history.orchestrator_pipeline_map_history (
    LIKE catalog.orchestrator_pipeline_map INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);
COMMENT ON TABLE  history.orchestrator_pipeline_map_history IS 'Immutable row-image history for catalog.orchestrator_pipeline_map. Captures DAG membership changes over time.';
COMMENT ON COLUMN history.orchestrator_pipeline_map_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.orchestrator_pipeline_map_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.orchestrator_pipeline_map_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.orchestrator_pipeline_map_history.hist_action_by IS 'User ID who performed the action.';


CREATE TABLE history.connector_health_history (
    LIKE catalog.connector_health INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);
COMMENT ON TABLE history.connector_health_history IS 'Immutable row-image history for catalog.connector_health. Tracks health status transitions over time for SLA reporting.';
COMMENT ON COLUMN history.connector_health_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.connector_health_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.connector_health_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.connector_health_history.hist_action_by IS 'User ID who performed the action.';


CREATE TABLE history.file_format_options_history (
    LIKE catalog.file_format_options INCLUDING DEFAULTS,
    hist_id         BIGSERIAL   NOT NULL,
    hist_action_cd  CHAR(1)     NOT NULL,
    hist_action_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hist_action_by  UUID
);
COMMENT ON TABLE history.file_format_options_history IS 'Immutable row-image history for catalog.file_format_options.';
COMMENT ON COLUMN history.file_format_options_history.hist_id IS 'Sequential audit record identifier.';
COMMENT ON COLUMN history.file_format_options_history.hist_action_cd IS 'I=Insert, U=Update, D=Delete.';
COMMENT ON COLUMN history.file_format_options_history.hist_action_dtm IS 'Timestamp when the audited change occurred.';
COMMENT ON COLUMN history.file_format_options_history.hist_action_by IS 'User ID who performed the action.';


COMMIT;
