-- =============================================================================
-- Migration: 011_add_compute_settings.sql
-- Creates catalog.system_settings and corresponding procedures to store global compute configs securely
-- =============================================================================

-- Table to store global system settings including Compute Engine Spark settings
CREATE TABLE IF NOT EXISTS catalog.system_settings (
    setting_key      VARCHAR(255) PRIMARY KEY,
    setting_value    JSONB NOT NULL,
    updated_by       UUID,
    updated_dtm      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments for documentation mapping
COMMENT ON TABLE catalog.system_settings IS 'Stores global system settings using JSONB documents per key';

-- =============================================================================
-- Function: catalog.fn_get_compute_settings()
-- Returns the latest compute settings.
-- =============================================================================
CREATE OR REPLACE FUNCTION catalog.fn_get_compute_settings()
RETURNS JSONB AS $$
DECLARE
    v_val JSONB;
BEGIN
    SELECT setting_value INTO v_val
    FROM catalog.system_settings
    WHERE setting_key = 'COMPUTE_ENGINE_SPARK';
    
    -- Provide sensible defaults if not set yet
    IF v_val IS NULL THEN
        v_val := '{
            "sparkMaster": "",
            "pysparkPath": "",
            "scalaVersion": "2.12",
            "pythonVersion": "3.10",
            "additionalLibraries": ""
        }'::jsonb;
    END IF;
    
    RETURN v_val;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- Procedure: catalog.pr_update_compute_settings()
-- Safely upserts the COMPUTE_ENGINE_SPARK settings
-- =============================================================================
CREATE OR REPLACE PROCEDURE catalog.pr_update_compute_settings(
    p_settings_jsonb JSONB,
    p_user_id UUID
) AS $$
BEGIN
    INSERT INTO catalog.system_settings (
        setting_key,
        setting_value,
        updated_by,
        updated_dtm
    ) VALUES (
        'COMPUTE_ENGINE_SPARK',
        p_settings_jsonb,
        p_user_id,
        NOW()
    )
    ON CONFLICT (setting_key) DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        updated_by = EXCLUDED.updated_by,
        updated_dtm = EXCLUDED.updated_dtm;
END;
$$ LANGUAGE plpgsql;
