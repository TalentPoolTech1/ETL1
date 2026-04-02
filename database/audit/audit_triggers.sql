-- ############################################################################
-- # FILE: 03_triggers.sql
-- # PURPOSE: Step 4 of 12. Audit trigger function + attachments.
-- #          Execute AFTER 02_history_tables.sql.
-- #
-- # HOW IT WORKS:
-- #   1. A generic BEFORE trigger function captures the OLD row image
-- #      into the corresponding history.* shadow table.
-- #   2. The row is then physically deleted (Law 4 enforced).
-- #   3. The hist_action_by field is populated from the PostgreSQL session
-- #      variable app.user_id, which the application backend must SET
-- #      before every transaction.
-- ############################################################################

BEGIN;

-- ============================================================================
-- GENERIC AUDIT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION history.fn_capture_row_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_action_by UUID := NULLIF(current_setting('app.user_id', TRUE), '')::UUID;
    v_action_cd CHAR(1);
    v_base_columns TEXT;
    v_base_values  TEXT;
BEGIN
    -- Law 7: Capture old row image into the corresponding history table
    v_action_cd := LEFT(TG_OP, 1); -- 'I', 'U', or 'D'

    SELECT
        string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum),
        string_agg(format('($1).%I', a.attname), ', ' ORDER BY a.attnum)
    INTO v_base_columns, v_base_values
    FROM pg_attribute a
    WHERE a.attrelid = TG_RELID
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF TG_OP = 'DELETE' THEN
        -- Before a physical delete, snapshot the row into the history table
        EXECUTE format(
            'INSERT INTO history.%I (%s, hist_id, hist_action_cd, hist_action_dtm, hist_action_by)
             VALUES (%s, nextval(''history.%I_hist_id_seq''), $2, CURRENT_TIMESTAMP, $3)',
            TG_TABLE_NAME || '_history',
            v_base_columns,
            v_base_values,
            TG_TABLE_NAME || '_history'
        ) USING OLD, v_action_cd, v_action_by;

        RETURN OLD;

    ELSIF TG_OP = 'UPDATE' THEN
        -- On update, snapshot the BEFORE image
        EXECUTE format(
            'INSERT INTO history.%I (%s, hist_id, hist_action_cd, hist_action_dtm, hist_action_by)
             VALUES (%s, nextval(''history.%I_hist_id_seq''), $2, CURRENT_TIMESTAMP, $3)',
            TG_TABLE_NAME || '_history',
            v_base_columns,
            v_base_values,
            TG_TABLE_NAME || '_history'
        ) USING OLD, v_action_cd, v_action_by;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION history.fn_capture_row_history() IS 'Generic BEFORE trigger handler. Snapshots the OLD row image into the corresponding history shadow table before UPDATE or DELETE. The row IS the audit record (Law 7).';


-- ============================================================================
-- TRIGGER ATTACHMENTS (one per audited table)
-- ============================================================================

CREATE TRIGGER tr_audit_etl_users
    BEFORE UPDATE OR DELETE ON etl.users
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_etl_projects
    BEFORE UPDATE OR DELETE ON etl.projects
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_etl_folders
    BEFORE UPDATE OR DELETE ON etl.folders
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_catalog_pipelines
    BEFORE UPDATE OR DELETE ON catalog.pipelines
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_catalog_pipeline_versions
    BEFORE UPDATE OR DELETE ON catalog.pipeline_versions
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_catalog_orchestrators
    BEFORE UPDATE OR DELETE ON catalog.orchestrators
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_catalog_connectors
    BEFORE UPDATE OR DELETE ON catalog.connectors
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_catalog_datasets
    BEFORE UPDATE OR DELETE ON catalog.datasets
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_gov_roles
    BEFORE UPDATE OR DELETE ON gov.roles
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_gov_glossary_terms
    BEFORE UPDATE OR DELETE ON gov.glossary_terms
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

-- ============================================================================
-- AUTO-TIMESTAMP TRIGGER (updated_dtm maintenance)
-- ============================================================================

CREATE OR REPLACE FUNCTION etl.fn_set_updated_dtm()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_dtm := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION etl.fn_set_updated_dtm() IS 'Generic BEFORE UPDATE trigger to automatically refresh the updated_dtm column without requiring application-side logic.';

CREATE TRIGGER tr_ts_etl_users       BEFORE UPDATE ON etl.users              FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
CREATE TRIGGER tr_ts_etl_projects    BEFORE UPDATE ON etl.projects           FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
CREATE TRIGGER tr_ts_etl_folders     BEFORE UPDATE ON etl.folders            FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
-- Catalog tables also have updated_dtm — attach auto-timestamp trigger
CREATE TRIGGER tr_ts_catalog_connectors    BEFORE UPDATE ON catalog.connectors    FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
CREATE TRIGGER tr_ts_catalog_datasets      BEFORE UPDATE ON catalog.datasets      FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
CREATE TRIGGER tr_ts_catalog_pipelines     BEFORE UPDATE ON catalog.pipelines     FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
CREATE TRIGGER tr_ts_catalog_orchestrators BEFORE UPDATE ON catalog.orchestrators FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
CREATE TRIGGER tr_ts_gov_secrets           BEFORE UPDATE ON gov.secrets           FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
CREATE TRIGGER tr_ts_gov_dq_rules          BEFORE UPDATE ON gov.dq_rules          FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
CREATE TRIGGER tr_ts_gov_glossary_terms    BEFORE UPDATE ON gov.glossary_terms    FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
CREATE TRIGGER tr_ts_execution_schedules   BEFORE UPDATE ON execution.schedules   FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
CREATE TRIGGER tr_ts_gov_data_class        BEFORE UPDATE ON gov.data_classifications FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
CREATE TRIGGER tr_ts_meta_cdc_config       BEFORE UPDATE ON meta.cdc_configurations FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
CREATE TRIGGER tr_ts_meta_platform_set     BEFORE UPDATE ON meta.platform_settings  FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
CREATE TRIGGER tr_ts_etl_user_work_drafts  BEFORE UPDATE ON etl.user_work_drafts    FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();

-- ============================================================================
-- AUDIT TRIGGER ATTACHMENTS — NEW TABLES (Layers 14-29)
-- ============================================================================

CREATE TRIGGER tr_audit_catalog_orchestrator_versions
    BEFORE UPDATE OR DELETE ON catalog.orchestrator_versions
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_gov_data_classifications
    BEFORE UPDATE OR DELETE ON gov.data_classifications
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_catalog_pipeline_parameters
    BEFORE UPDATE OR DELETE ON catalog.pipeline_parameters
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_execution_schedules
    BEFORE UPDATE OR DELETE ON execution.schedules
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_gov_notification_rules
    BEFORE UPDATE OR DELETE ON gov.notification_rules
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_meta_platform_settings
    BEFORE UPDATE OR DELETE ON meta.platform_settings
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_meta_cdc_configurations
    BEFORE UPDATE OR DELETE ON meta.cdc_configurations
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_catalog_orchestrator_pipeline_map
    BEFORE UPDATE OR DELETE ON catalog.orchestrator_pipeline_map
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_catalog_connector_health
    BEFORE UPDATE OR DELETE ON catalog.connector_health
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

CREATE TRIGGER tr_audit_catalog_file_format_options
    BEFORE UPDATE OR DELETE ON catalog.file_format_options
    FOR EACH ROW EXECUTE FUNCTION history.fn_capture_row_history();

-- Auto-timestamp triggers for new tables
CREATE TRIGGER tr_ts_catalog_connector_health     BEFORE UPDATE ON catalog.connector_health     FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();
CREATE TRIGGER tr_ts_catalog_file_format_options  BEFORE UPDATE ON catalog.file_format_options  FOR EACH ROW EXECUTE FUNCTION etl.fn_set_updated_dtm();

COMMIT;
