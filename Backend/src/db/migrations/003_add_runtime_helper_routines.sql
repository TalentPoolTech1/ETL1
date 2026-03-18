-- 003_add_runtime_helper_routines.sql
-- Adds helper DB routines so API routes can avoid ad-hoc table SQL.

BEGIN;

DROP FUNCTION IF EXISTS etl.fn_get_folder_by_id(UUID);
DROP FUNCTION IF EXISTS catalog.fn_get_orchestrators(UUID);
DROP FUNCTION IF EXISTS catalog.fn_get_orchestrator_by_id(UUID);
DROP FUNCTION IF EXISTS catalog.fn_get_pipeline_runtime_info(UUID);
DROP FUNCTION IF EXISTS execution.fn_get_environment_id_by_name(TEXT);
DROP PROCEDURE IF EXISTS execution.pr_upsert_run_parameter(UUID, TEXT, TEXT);

-- ============================================================================
-- Folder read helper
-- ============================================================================

CREATE OR REPLACE FUNCTION etl.fn_get_folder_by_id(p_folder_id UUID)
RETURNS TABLE (
    folder_id UUID,
    project_id UUID,
    parent_folder_id UUID,
    folder_display_name TEXT,
    folder_type_code TEXT,
    created_dtm TIMESTAMPTZ,
    updated_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        f.folder_id,
        f.project_id,
        f.parent_folder_id,
        f.folder_display_name,
        f.folder_type_code,
        f.created_dtm,
        f.updated_dtm
    FROM etl.folders f
    WHERE f.folder_id = p_folder_id;
$$;

COMMENT ON FUNCTION etl.fn_get_folder_by_id(UUID)
IS 'Returns one folder row with core metadata. Used by API routes to avoid direct table reads.';

-- ============================================================================
-- Orchestrator read helpers
-- ============================================================================

CREATE OR REPLACE FUNCTION catalog.fn_get_orchestrators(p_project_id UUID DEFAULT NULL)
RETURNS TABLE (
    orch_id UUID,
    project_id UUID,
    folder_id UUID,
    orch_display_name TEXT,
    orch_desc_text TEXT,
    dag_definition_json JSONB,
    created_dtm TIMESTAMPTZ,
    updated_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        o.orch_id,
        o.project_id,
        o.folder_id,
        o.orch_display_name,
        o.orch_desc_text,
        o.dag_definition_json,
        o.created_dtm,
        o.updated_dtm
    FROM catalog.orchestrators o
    WHERE p_project_id IS NULL OR o.project_id = p_project_id
    ORDER BY o.orch_display_name;
$$;

COMMENT ON FUNCTION catalog.fn_get_orchestrators(UUID)
IS 'Returns orchestrators for a project or all orchestrators when p_project_id is NULL.';

CREATE OR REPLACE FUNCTION catalog.fn_get_orchestrator_by_id(p_orch_id UUID)
RETURNS TABLE (
    orch_id UUID,
    project_id UUID,
    folder_id UUID,
    orch_display_name TEXT,
    orch_desc_text TEXT,
    dag_definition_json JSONB,
    created_dtm TIMESTAMPTZ,
    updated_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        o.orch_id,
        o.project_id,
        o.folder_id,
        o.orch_display_name,
        o.orch_desc_text,
        o.dag_definition_json,
        o.created_dtm,
        o.updated_dtm
    FROM catalog.orchestrators o
    WHERE o.orch_id = p_orch_id;
$$;

COMMENT ON FUNCTION catalog.fn_get_orchestrator_by_id(UUID)
IS 'Returns one orchestrator by ID.';

-- ============================================================================
-- Pipeline runtime helpers
-- ============================================================================

CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_runtime_info(p_pipeline_id UUID)
RETURNS TABLE (
    pipeline_id UUID,
    active_version_id UUID
)
LANGUAGE sql STABLE AS $$
    SELECT p.pipeline_id, p.active_version_id
    FROM catalog.pipelines p
    WHERE p.pipeline_id = p_pipeline_id;
$$;

COMMENT ON FUNCTION catalog.fn_get_pipeline_runtime_info(UUID)
IS 'Returns minimal pipeline runtime info required to initialize execution runs.';

CREATE OR REPLACE FUNCTION execution.fn_get_environment_id_by_name(p_env_display_name TEXT)
RETURNS UUID
LANGUAGE sql STABLE AS $$
    SELECT e.env_id
    FROM execution.environments e
    WHERE lower(e.env_display_name) = lower(p_env_display_name)
    ORDER BY e.created_dtm DESC
    LIMIT 1;
$$;

COMMENT ON FUNCTION execution.fn_get_environment_id_by_name(TEXT)
IS 'Returns environment ID by display name, case-insensitive; NULL when not found.';

CREATE OR REPLACE PROCEDURE execution.pr_upsert_run_parameter(
    p_pipeline_run_id UUID,
    p_param_key_name TEXT,
    p_param_value_text TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO execution.run_parameters (pipeline_run_id, param_key_name, param_value_text)
    VALUES (p_pipeline_run_id, p_param_key_name, p_param_value_text)
    ON CONFLICT (pipeline_run_id, param_key_name) DO UPDATE
    SET param_value_text = EXCLUDED.param_value_text;
END;
$$;

COMMENT ON PROCEDURE execution.pr_upsert_run_parameter(UUID, TEXT, TEXT)
IS 'Upserts a run parameter value for a pipeline run.';

COMMIT;
