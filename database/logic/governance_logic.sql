-- ############################################################################
-- # FILE: governance_logic.sql (formerly 09_governance_logic.sql)
-- # PURPOSE: Step 10 of 12. Glossary, DQ rules, and contracts using gov schema.
-- ############################################################################

BEGIN;

-- ============================================================================
-- READ OPERATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION gov.fn_get_glossary_terms(p_approval_status_code TEXT DEFAULT NULL)
RETURNS TABLE (term_id UUID, term_display_name TEXT, approval_status_code TEXT, owner_user_full_name TEXT)
LANGUAGE sql STABLE AS $$
    SELECT g.term_id, g.term_display_name, g.approval_status_code, u.user_full_name
    FROM gov.glossary_terms g
    LEFT JOIN etl.users u ON g.owner_user_id = u.user_id
    WHERE (p_approval_status_code IS NULL OR g.approval_status_code = p_approval_status_code)
    ORDER BY g.term_display_name;
$$;
COMMENT ON FUNCTION gov.fn_get_glossary_terms(TEXT) IS 'Lists business glossary terms, optionally filtered by approval status.';
;
CREATE OR REPLACE FUNCTION gov.fn_get_dq_rules(p_target_id UUID)
RETURNS TABLE (rule_id UUID, rule_type_code TEXT, severity_code TEXT, is_active_flag BOOLEAN)
LANGUAGE sql STABLE AS $$
    SELECT rule_id, rule_type_code, severity_code, is_active_flag
    FROM gov.dq_rules WHERE target_id = p_target_id;
$$;
COMMENT ON FUNCTION gov.fn_get_dq_rules(UUID) IS 'Returns all DQ rules associated with a specific dataset or column.';
;
-- ============================================================================
-- WRITE OPERATIONS
-- ============================================================================

CREATE OR REPLACE PROCEDURE gov.pr_create_glossary_term(
    p_term_display_name TEXT, p_term_def_text TEXT, p_owner_user_id UUID,
    OUT p_term_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO gov.glossary_terms (term_display_name, term_def_text, owner_user_id)
    VALUES (p_term_display_name, p_term_def_text, p_owner_user_id)
    RETURNING term_id INTO p_term_id;
END;
$$;
COMMENT ON PROCEDURE gov.pr_create_glossary_term(TEXT, TEXT, UUID) IS 'Adds a new term to the enterprise business glossary in DRAFT status.';
;
CREATE OR REPLACE PROCEDURE gov.pr_approve_glossary_term(p_term_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE gov.glossary_terms SET approval_status_code = 'APPROVED', updated_dtm = CURRENT_TIMESTAMP
    WHERE term_id = p_term_id;
END;
$$;
COMMENT ON PROCEDURE gov.pr_approve_glossary_term(UUID) IS 'Elevates a glossary term from DRAFT or IN_REVIEW to APPROVED status.';
;
CREATE OR REPLACE PROCEDURE gov.pr_delete_glossary_term(p_term_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    -- Law 4: Physical delete. History trigger captures row before removal.
    DELETE FROM gov.glossary_terms WHERE term_id = p_term_id;
END;
$$;
COMMENT ON PROCEDURE gov.pr_delete_glossary_term(UUID) IS 'Law 4: Physically removes a glossary term. History trigger preserves the record in history.glossary_terms_history.';
;
CREATE OR REPLACE PROCEDURE gov.pr_upsert_dq_rule(
    p_target_type_code TEXT, p_target_id UUID,
    p_rule_type_code TEXT, p_rule_config_json JSONB, p_severity_code TEXT DEFAULT 'ERROR'
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO gov.dq_rules (target_type_code, target_id, rule_type_code, rule_config_json, severity_code)
    VALUES (p_target_type_code, p_target_id, p_rule_type_code, p_rule_config_json, p_severity_code)
    ON CONFLICT DO NOTHING;
END;
$$;
COMMENT ON PROCEDURE gov.pr_upsert_dq_rule(TEXT, UUID, TEXT, JSONB, TEXT) IS 'Creates a data quality validation rule for a dataset or column.';
;
CREATE OR REPLACE PROCEDURE gov.pr_log_dq_result(
    p_pipeline_run_id UUID, p_rule_id UUID, p_passed_flag BOOLEAN,
    p_actual_value_text TEXT DEFAULT NULL, p_error_message_text TEXT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO gov.dq_results (pipeline_run_id, rule_id, passed_flag, actual_value_text, error_message_text)
    VALUES (p_pipeline_run_id, p_rule_id, p_passed_flag, p_actual_value_text, p_error_message_text);
END;
$$;
COMMENT ON PROCEDURE gov.pr_log_dq_result(UUID, UUID, BOOLEAN, TEXT, TEXT) IS 'Records the outcome of a DQ rule evaluation during a pipeline run. References execution.pipeline_runs.';
;
-- ============================================================================
-- PLATFORM SETTINGS (meta schema)
-- ============================================================================

CREATE OR REPLACE FUNCTION meta.fn_get_setting(p_setting_key_name TEXT)
RETURNS TEXT LANGUAGE sql STABLE AS $$
    SELECT setting_value_text
    FROM meta.platform_settings
    WHERE setting_key_name = p_setting_key_name;
$$;
COMMENT ON FUNCTION meta.fn_get_setting(TEXT) IS 'Returns the value of a named platform-wide setting. Returns NULL if not configured.';
;
CREATE OR REPLACE PROCEDURE meta.pr_upsert_setting(
    p_setting_key_name TEXT, p_setting_value_text TEXT,
    p_setting_desc_text TEXT, p_is_sensitive_flag BOOLEAN,
    p_updated_by_user_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO meta.platform_settings
        (setting_key_name, setting_value_text, setting_desc_text, is_sensitive_flag, updated_by_user_id)
    VALUES (p_setting_key_name, p_setting_value_text, p_setting_desc_text, p_is_sensitive_flag, p_updated_by_user_id)
    ON CONFLICT (setting_key_name) DO UPDATE SET
        setting_value_text = EXCLUDED.setting_value_text,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_dtm        = CURRENT_TIMESTAMP;
END;
$$;
COMMENT ON PROCEDURE meta.pr_upsert_setting(TEXT, TEXT, TEXT, BOOLEAN, UUID) IS 'Creates or updates a platform-wide setting. History trigger captures change before every update.';
;
-- ============================================================================
-- CDC CONFIGURATIONS (meta schema)
-- ============================================================================

CREATE OR REPLACE PROCEDURE meta.pr_upsert_cdc_configuration(
    p_dataset_id UUID, p_cdc_mode_code TEXT,
    p_watermark_column_name TEXT DEFAULT NULL, p_cdc_config_json JSONB DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO meta.cdc_configurations
        (dataset_id, cdc_mode_code, watermark_column_name, cdc_config_json)
    VALUES (p_dataset_id, p_cdc_mode_code, p_watermark_column_name, p_cdc_config_json)
    ON CONFLICT (dataset_id) DO UPDATE SET
        cdc_mode_code         = EXCLUDED.cdc_mode_code,
        watermark_column_name = EXCLUDED.watermark_column_name,
        cdc_config_json       = EXCLUDED.cdc_config_json,
        updated_dtm           = CURRENT_TIMESTAMP;
END;
$$;
COMMENT ON PROCEDURE meta.pr_upsert_cdc_configuration(UUID, TEXT, TEXT, JSONB) IS 'Creates or updates the CDC extraction strategy for a dataset. Idempotent.';
;
CREATE OR REPLACE FUNCTION meta.fn_get_cdc_configuration(p_dataset_id UUID)
RETURNS TABLE (cdc_id UUID, cdc_mode_code TEXT, watermark_column_name TEXT, cdc_config_json JSONB, updated_dtm TIMESTAMPTZ)
LANGUAGE sql STABLE AS $$
    SELECT cdc_id, cdc_mode_code, watermark_column_name, cdc_config_json, updated_dtm
    FROM meta.cdc_configurations
    WHERE dataset_id = p_dataset_id;
$$;
COMMENT ON FUNCTION meta.fn_get_cdc_configuration(UUID) IS 'Returns the CDC extraction configuration for a specific dataset.';
;
COMMIT;
