-- ############################################################################
-- # FILE: pipeline_logic.sql (formerly 07_pipeline_logic.sql)
-- # PURPOSE: Step 8 of 12. Pipeline and orchestrator CRUD using catalog schema.
-- #          Law 14: Pipeline body (IR) always stored in catalog.pipeline_contents.
-- ############################################################################

BEGIN;

-- ============================================================================
-- READ OPERATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION catalog.fn_get_pipelines(p_project_id UUID)
RETURNS TABLE (
    pipeline_id           UUID,
    pipeline_display_name TEXT,
    pipeline_desc_text    TEXT,
    active_version_id     UUID,
    has_active_version    BOOLEAN,
    folder_id             UUID,
    updated_dtm           TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        pipeline_id,
        pipeline_display_name,
        pipeline_desc_text,
        active_version_id,
        (active_version_id IS NOT NULL) AS has_active_version,
        folder_id,
        updated_dtm
    FROM catalog.pipelines
    WHERE project_id = p_project_id
    ORDER BY pipeline_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipelines(UUID) IS 'Lists all pipelines in a project. lifecycle_status_code removed by design — state is implied by whether active_version_id is set.'
;
CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_versions(p_pipeline_id UUID)
RETURNS TABLE (version_id UUID, version_num_seq INTEGER, release_tag_label TEXT, created_dtm TIMESTAMPTZ)
LANGUAGE sql STABLE AS $$
    SELECT version_id, version_num_seq, release_tag_label, created_dtm
    FROM catalog.pipeline_versions WHERE pipeline_id = p_pipeline_id ORDER BY version_num_seq DESC;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_versions(UUID) IS 'Returns the version history of a pipeline in descending order.';
;
-- Law 14: Dedicated function to retrieve the pipeline body
CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_body(p_version_id UUID)
RETURNS TABLE (ir_payload_json JSONB, ui_layout_json JSONB, content_checksum_text TEXT)
LANGUAGE sql STABLE AS $$
    SELECT ir_payload_json, ui_layout_json, content_checksum_text
    FROM catalog.pipeline_contents WHERE version_id = p_version_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_body(UUID) IS 'Law 14: Retrieves the complete pipeline Internal Representation (IR) and UI layout for a specific version.';
;
-- ============================================================================
-- WRITE OPERATIONS
-- ============================================================================

CREATE OR REPLACE PROCEDURE catalog.pr_create_pipeline(
    p_project_id UUID,
    p_folder_id UUID,
    p_pipeline_display_name TEXT,
    p_pipeline_desc_text TEXT,
    p_created_by_user_id UUID,
    OUT p_pipeline_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO catalog.pipelines (project_id, folder_id, pipeline_display_name, pipeline_desc_text, created_by_user_id)
    VALUES (p_project_id, p_folder_id, p_pipeline_display_name, p_pipeline_desc_text, p_created_by_user_id)
    RETURNING pipeline_id INTO p_pipeline_id;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_create_pipeline(UUID, UUID, TEXT, TEXT, UUID) IS 'Creates a new pipeline definition record. The first version/body is created separately via pr_commit_pipeline_version.';
;
-- Law 14: A single atomic procedure for creating a new version + storing the body
CREATE OR REPLACE PROCEDURE catalog.pr_commit_pipeline_version(
    p_pipeline_id UUID,
    p_commit_msg_text TEXT,
    p_ir_payload_json JSONB,
    p_ui_layout_json JSONB,
    p_created_by_user_id UUID,
    OUT p_version_id UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_next_seq INTEGER;
BEGIN
    -- Get next sequential version number
    SELECT COALESCE(MAX(version_num_seq), 0) + 1 INTO v_next_seq
    FROM catalog.pipeline_versions WHERE pipeline_id = p_pipeline_id;

    -- Create the version record
    INSERT INTO catalog.pipeline_versions (pipeline_id, version_num_seq, commit_msg_text, created_by_user_id)
    VALUES (p_pipeline_id, v_next_seq, p_commit_msg_text, p_created_by_user_id)
    RETURNING version_id INTO p_version_id;

    -- Law 14: Immediately store the pipeline body (IR + UI layout)
    INSERT INTO catalog.pipeline_contents (version_id, ir_payload_json, ui_layout_json, content_checksum_text)
    VALUES (
        p_version_id, p_ir_payload_json, p_ui_layout_json,
        md5(p_ir_payload_json::TEXT)
    );

    -- Advance the active version pointer on the pipeline
    UPDATE catalog.pipelines SET active_version_id = p_version_id
    WHERE pipeline_id = p_pipeline_id;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_commit_pipeline_version(UUID, TEXT, JSONB, JSONB, UUID) IS 'Law 14: Atomic operation that creates a new version AND stores the full pipeline body (IR + UI) in pipeline_contents. There is no version without a body.';
;
CREATE OR REPLACE PROCEDURE catalog.pr_delete_pipeline(p_pipeline_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    -- Law 4: Physical delete. History trigger fires. Cascade handles versions and contents.
    DELETE FROM catalog.pipelines WHERE pipeline_id = p_pipeline_id;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_delete_pipeline(UUID) IS 'Law 4: Physically removes a pipeline and all its versions and content bodies.';
;
-- Orchestrator CRUD
CREATE OR REPLACE PROCEDURE catalog.pr_create_orchestrator(
    p_project_id UUID, p_folder_id UUID, p_orch_display_name TEXT, p_dag_definition_json JSONB,
    p_created_by_user_id UUID, OUT p_orch_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO catalog.orchestrators (project_id, folder_id, orch_display_name, dag_definition_json, created_by_user_id)
    VALUES (p_project_id, p_folder_id, p_orch_display_name, p_dag_definition_json, p_created_by_user_id)
    RETURNING orch_id INTO p_orch_id;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_create_orchestrator(UUID, UUID, TEXT, JSONB, UUID) IS 'Creates a new orchestrator DAG definition.';
;
CREATE OR REPLACE PROCEDURE catalog.pr_delete_orchestrator(p_orch_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    -- Law 4: Physical delete. History trigger fires.
    DELETE FROM catalog.orchestrators WHERE orch_id = p_orch_id;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_delete_orchestrator(UUID) IS 'Law 4: Physically removes an orchestrator record.';
;
-- ============================================================================
-- ORCHESTRATOR VERSION COMMIT (mirrors pipeline version pattern)
-- ============================================================================

CREATE OR REPLACE PROCEDURE catalog.pr_commit_orchestrator_version(
    p_orch_id UUID, p_commit_msg_text TEXT,
    p_created_by_user_id UUID, OUT p_orch_version_id UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_next_seq     INTEGER;
    v_dag_snapshot JSONB;
BEGIN
    -- Get current DAG definition as the snapshot
    SELECT dag_definition_json INTO v_dag_snapshot FROM catalog.orchestrators WHERE orch_id = p_orch_id;

    -- Increment version number
    SELECT COALESCE(MAX(version_num_seq), 0) + 1 INTO v_next_seq
    FROM catalog.orchestrator_versions WHERE orch_id = p_orch_id;

    INSERT INTO catalog.orchestrator_versions
        (orch_id, version_num_seq, dag_snapshot_json, commit_msg_text, created_by_user_id)
    VALUES (p_orch_id, v_next_seq, v_dag_snapshot, p_commit_msg_text, p_created_by_user_id)
    RETURNING orch_version_id INTO p_orch_version_id;

    -- Advance the active version pointer
    UPDATE catalog.orchestrators SET
        active_orch_version_id = p_orch_version_id,
        updated_by_user_id     = p_created_by_user_id
    WHERE orch_id = p_orch_id;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_commit_orchestrator_version(UUID, TEXT, UUID) IS 'Commits the current orchestrator DAG as an immutable versioned snapshot. Mirrors the pipeline version commit pattern. Advances active_orch_version_id.';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_orchestrator_versions(p_orch_id UUID)
RETURNS TABLE (orch_version_id UUID, version_num_seq INTEGER, release_tag_label TEXT, commit_msg_text TEXT, created_dtm TIMESTAMPTZ)
LANGUAGE sql STABLE AS $$
    SELECT orch_version_id, version_num_seq, release_tag_label, commit_msg_text, created_dtm
    FROM catalog.orchestrator_versions
    WHERE orch_id = p_orch_id
    ORDER BY version_num_seq DESC;
$$;
COMMENT ON FUNCTION catalog.fn_get_orchestrator_versions(UUID) IS 'Returns the full version history of an orchestrator in descending order.';
;
-- ============================================================================
-- PIPELINE PARAMETERS
-- ============================================================================

CREATE OR REPLACE PROCEDURE catalog.pr_upsert_pipeline_parameter(
    p_pipeline_id UUID, p_param_key_name TEXT, p_param_data_type_code TEXT,
    p_default_value_text TEXT, p_is_required_flag BOOLEAN, p_param_desc_text TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO catalog.pipeline_parameters
        (pipeline_id, param_key_name, param_data_type_code, default_value_text, is_required_flag, param_desc_text)
    VALUES (p_pipeline_id, p_param_key_name, p_param_data_type_code, p_default_value_text, p_is_required_flag, p_param_desc_text)
    ON CONFLICT (pipeline_id, param_key_name) DO UPDATE SET
        param_data_type_code = EXCLUDED.param_data_type_code,
        default_value_text   = EXCLUDED.default_value_text,
        is_required_flag     = EXCLUDED.is_required_flag,
        param_desc_text      = EXCLUDED.param_desc_text;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_upsert_pipeline_parameter(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT) IS 'Creates or updates a declared runtime parameter for a pipeline. Idempotent on param_key_name.';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_parameters(p_pipeline_id UUID)
RETURNS TABLE (param_id UUID, param_key_name TEXT, param_data_type_code TEXT, default_value_text TEXT, is_required_flag BOOLEAN, param_desc_text TEXT)
LANGUAGE sql STABLE AS $$
    SELECT param_id, param_key_name, param_data_type_code, default_value_text, is_required_flag, param_desc_text
    FROM catalog.pipeline_parameters
    WHERE pipeline_id = p_pipeline_id
    ORDER BY param_key_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_parameters(UUID) IS 'Returns all declared runtime parameters for a pipeline in alphabetical order.';
;
-- ============================================================================
-- DATA LINEAGE
-- ============================================================================

CREATE OR REPLACE PROCEDURE catalog.pr_record_lineage_edges(
    p_pipeline_id UUID, p_version_id UUID, p_lineage_json JSONB
)
LANGUAGE plpgsql AS $$
DECLARE
    v_edge JSONB;
BEGIN
    -- Clear existing lineage for this version before re-recording
    DELETE FROM catalog.data_lineage WHERE pipeline_id = p_pipeline_id AND version_id = p_version_id;

    FOR v_edge IN SELECT * FROM jsonb_array_elements(p_lineage_json)
    LOOP
        INSERT INTO catalog.data_lineage
            (pipeline_id, version_id, src_dataset_id, src_column_name_text,
             tgt_dataset_id, tgt_column_name_text, transformation_desc_text)
        VALUES (
            p_pipeline_id, p_version_id,
            (v_edge->>'src_dataset_id')::UUID,
            v_edge->>'src_column_name_text',
            (v_edge->>'tgt_dataset_id')::UUID,
            v_edge->>'tgt_column_name_text',
            v_edge->>'transformation_desc_text'
        );
    END LOOP;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_record_lineage_edges(UUID, UUID, JSONB) IS 'Replaces all column-level lineage edges for a pipeline version. Called by the codegen engine after IR analysis. Accepts a JSONB array of {src_dataset_id, src_column, tgt_dataset_id, tgt_column, transformation} objects.';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_column_lineage_upstream(p_dataset_id UUID, p_column_name TEXT)
RETURNS TABLE (
    pipeline_id UUID, pipeline_display_name TEXT,
    src_dataset_id UUID, src_column_name_text TEXT, transformation_desc_text TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT dl.pipeline_id, p.pipeline_display_name,
           dl.src_dataset_id, dl.src_column_name_text, dl.transformation_desc_text
    FROM catalog.data_lineage dl
    JOIN catalog.pipelines p ON dl.pipeline_id = p.pipeline_id
    WHERE dl.tgt_dataset_id = p_dataset_id
      AND dl.tgt_column_name_text = p_column_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_column_lineage_upstream(UUID, TEXT) IS 'Returns all upstream source columns and the pipelines that flow into a specific target column. Used for data traceability and GDPR subject-access requests.';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_column_lineage_downstream(p_dataset_id UUID, p_column_name TEXT)
RETURNS TABLE (
    pipeline_id UUID, pipeline_display_name TEXT,
    tgt_dataset_id UUID, tgt_column_name_text TEXT, transformation_desc_text TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT dl.pipeline_id, p.pipeline_display_name,
           dl.tgt_dataset_id, dl.tgt_column_name_text, dl.transformation_desc_text
    FROM catalog.data_lineage dl
    JOIN catalog.pipelines p ON dl.pipeline_id = p.pipeline_id
    WHERE dl.src_dataset_id = p_dataset_id
      AND dl.src_column_name_text = p_column_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_column_lineage_downstream(UUID, TEXT) IS 'Returns all downstream target columns that a source column feeds into. Used for impact analysis before modifying a source schema.';
;
-- ============================================================================
-- PIPELINE-DATASET MAP (Impact Analysis)
-- ============================================================================

CREATE OR REPLACE PROCEDURE catalog.pr_sync_pipeline_dataset_map(
    p_pipeline_id UUID, p_version_id UUID, p_dataset_map_json JSONB
)
LANGUAGE plpgsql AS $$
DECLARE
    v_entry JSONB;
BEGIN
    DELETE FROM catalog.pipeline_dataset_map WHERE pipeline_id = p_pipeline_id AND version_id = p_version_id;
    FOR v_entry IN SELECT * FROM jsonb_array_elements(p_dataset_map_json)
    LOOP
        INSERT INTO catalog.pipeline_dataset_map
            (pipeline_id, version_id, dataset_id, access_mode_code, node_id_text)
        VALUES (
            p_pipeline_id, p_version_id,
            (v_entry->>'dataset_id')::UUID,
            v_entry->>'access_mode_code',
            v_entry->>'node_id_text'
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_sync_pipeline_dataset_map(UUID, UUID, JSONB) IS 'Replaces the dataset dependency map for a pipeline version. Called on every commit alongside pr_record_lineage_edges to enable fast impact analysis without IR parsing.';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_pipelines_impacted_by_dataset(p_dataset_id UUID)
RETURNS TABLE (
    pipeline_id UUID, pipeline_display_name TEXT, access_mode_code TEXT, version_num_seq INTEGER
)
LANGUAGE sql STABLE AS $$
    SELECT dm.pipeline_id, p.pipeline_display_name, dm.access_mode_code, pv.version_num_seq
    FROM catalog.pipeline_dataset_map dm
    JOIN catalog.pipelines p ON dm.pipeline_id = p.pipeline_id
    JOIN catalog.pipeline_versions pv ON dm.version_id = pv.version_id
    WHERE dm.dataset_id = p_dataset_id
      AND p.active_version_id = dm.version_id   -- only show active version references
    ORDER BY p.pipeline_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipelines_impacted_by_dataset(UUID) IS 'Returns all active pipelines that READ from or WRITE to a specific dataset. Use before modifying a dataset schema to assess downstream impact.';
;
-- ============================================================================
-- CONNECTION TEST RESULTS
-- ============================================================================

CREATE OR REPLACE PROCEDURE catalog.pr_log_connection_test(
    p_connector_id UUID, p_test_passed_flag BOOLEAN,
    p_error_message_text TEXT, p_response_time_ms INTEGER, p_tested_by_user_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO catalog.connection_test_results
        (connector_id, test_passed_flag, error_message_text, response_time_ms, tested_by_user_id)
    VALUES (p_connector_id, p_test_passed_flag, p_error_message_text, p_response_time_ms, p_tested_by_user_id);
END;
$$;
COMMENT ON PROCEDURE catalog.pr_log_connection_test(UUID, BOOLEAN, TEXT, INTEGER, UUID) IS 'Records the outcome of a connector test. Appended on every test run. Physical deletes use ON DELETE CASCADE from the connector.';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_last_connection_test(p_connector_id UUID)
RETURNS TABLE (test_passed_flag BOOLEAN, error_message_text TEXT, response_time_ms INTEGER, tested_dtm TIMESTAMPTZ)
LANGUAGE sql STABLE AS $$
    SELECT test_passed_flag, error_message_text, response_time_ms, tested_dtm
    FROM catalog.connection_test_results
    WHERE connector_id = p_connector_id
    ORDER BY tested_dtm DESC
    LIMIT 1;
$$;
COMMENT ON FUNCTION catalog.fn_get_last_connection_test(UUID) IS 'Returns the most recent connection test result for a connector. Used to show connector health status in the UI.';
;
-- ============================================================================
-- PIPELINE VALIDATION RESULTS
-- ============================================================================

CREATE OR REPLACE PROCEDURE catalog.pr_log_pipeline_validation(
    p_pipeline_id UUID, p_validation_passed_flag BOOLEAN,
    p_validation_errors_json JSONB, p_validated_by_user_id UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_error_count INTEGER := COALESCE(jsonb_array_length(p_validation_errors_json), 0);
BEGIN
    INSERT INTO catalog.pipeline_validation_results
        (pipeline_id, validation_passed_flag, error_count_num, validation_errors_json, validated_by_user_id)
    VALUES (p_pipeline_id, p_validation_passed_flag, v_error_count, p_validation_errors_json, p_validated_by_user_id);
END;
$$;
COMMENT ON PROCEDURE catalog.pr_log_pipeline_validation(UUID, BOOLEAN, JSONB, UUID) IS 'Records the outcome of a pipeline validation run. Called by the backend gate before allowing pr_commit_pipeline_version.';
;
-- ============================================================================
-- TAGS & ASSET TAGGING
-- ============================================================================

CREATE OR REPLACE PROCEDURE catalog.pr_create_tag(
    p_tag_display_name TEXT, OUT p_tag_id UUID, p_tag_color_hex TEXT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO catalog.tags (tag_display_name, tag_color_hex)
    VALUES (p_tag_display_name, p_tag_color_hex)
    RETURNING tag_id INTO p_tag_id;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_create_tag(TEXT, TEXT) IS 'Creates a new tag in the global tag vocabulary.';
;
CREATE OR REPLACE PROCEDURE catalog.pr_tag_asset(
    p_tag_id UUID, p_asset_type_code TEXT, p_asset_id UUID, p_tagged_by_user_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO catalog.asset_tags (tag_id, asset_type_code, asset_id, tagged_by_user_id)
    VALUES (p_tag_id, p_asset_type_code, p_asset_id, p_tagged_by_user_id)
    ON CONFLICT DO NOTHING;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_tag_asset(UUID, TEXT, UUID, UUID) IS 'Applies a tag to a platform asset. Idempotent — duplicate tagging is silently ignored.';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_asset_tags(p_asset_type_code TEXT, p_asset_id UUID)
RETURNS TABLE (tag_id UUID, tag_display_name TEXT, tag_color_hex TEXT)
LANGUAGE sql STABLE AS $$
    SELECT t.tag_id, t.tag_display_name, t.tag_color_hex
    FROM catalog.asset_tags at
    JOIN catalog.tags t ON at.tag_id = t.tag_id
    WHERE at.asset_type_code = p_asset_type_code AND at.asset_id = p_asset_id
    ORDER BY t.tag_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_asset_tags(TEXT, UUID) IS 'Returns all tags applied to a specific asset.';
;
-- ============================================================================
-- ORCHESTRATOR-PIPELINE CATALOG MAP
-- ============================================================================

CREATE OR REPLACE PROCEDURE catalog.pr_sync_orchestrator_pipeline_map(
    p_orch_id UUID,
    p_map_entries_json JSONB
)
LANGUAGE plpgsql AS $$
DECLARE
    v_entry JSONB;
BEGIN
    -- Rebuild from scratch on every DAG save
    DELETE FROM catalog.orchestrator_pipeline_map WHERE orch_id = p_orch_id;
    FOR v_entry IN SELECT * FROM jsonb_array_elements(p_map_entries_json)
    LOOP
        INSERT INTO catalog.orchestrator_pipeline_map
            (orch_id, pipeline_id, dag_node_ref_text, dependency_order_num)
        VALUES (
            p_orch_id,
            (v_entry->>'pipeline_id')::UUID,
            v_entry->>'dag_node_ref_text',
            COALESCE((v_entry->>'dependency_order_num')::INTEGER, 0)
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_sync_orchestrator_pipeline_map(UUID, JSONB) IS 'Replaces the design-time pipeline membership map for an orchestrator. Called on every DAG save alongside pr_create_orchestrator and pr_commit_orchestrator_version. Input: [{pipeline_id, dag_node_ref_text, dependency_order_num}].';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_orchestrators_for_pipeline(p_pipeline_id UUID)
RETURNS TABLE (
    orch_id           UUID,
    orch_display_name TEXT,
    dag_node_ref_text TEXT,
    project_id        UUID
)
LANGUAGE sql STABLE AS $$
    SELECT o.orch_id, o.orch_display_name, m.dag_node_ref_text, o.project_id
    FROM catalog.orchestrator_pipeline_map m
    JOIN catalog.orchestrators o ON m.orch_id = o.orch_id
    WHERE m.pipeline_id = p_pipeline_id
    ORDER BY o.orch_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_orchestrators_for_pipeline(UUID) IS 'Reverse-lookup: returns all orchestrators that include a given pipeline in their DAG. Used for impact analysis before modifying or deleting a pipeline.';
;
CREATE OR REPLACE FUNCTION catalog.fn_get_pipelines_for_orchestrator(p_orch_id UUID)
RETURNS TABLE (
    pipeline_id           UUID,
    pipeline_display_name TEXT,
    dag_node_ref_text     TEXT,
    dependency_order_num  INTEGER
)
LANGUAGE sql STABLE AS $$
    SELECT p.pipeline_id, p.pipeline_display_name, m.dag_node_ref_text, m.dependency_order_num
    FROM catalog.orchestrator_pipeline_map m
    JOIN catalog.pipelines p ON m.pipeline_id = p.pipeline_id
    WHERE m.orch_id = p_orch_id
    ORDER BY m.dependency_order_num, p.pipeline_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipelines_for_orchestrator(UUID) IS 'Returns all pipelines coordinated by a given orchestrator in dependency order. Answers: which pipelines does this orchestrator run?';
;

-- ─── UI / API support functions ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_by_id(p_pipeline_id UUID)
RETURNS TABLE (
    pipeline_id           UUID,
    project_id            UUID,
    folder_id             UUID,
    pipeline_display_name TEXT,
    pipeline_desc_text    TEXT,
    active_version_id     UUID,
    version_num_seq       INTEGER,
    release_tag_label     TEXT,
    ir_payload_json       JSONB,
    ui_layout_json        JSONB,
    created_dtm           TIMESTAMPTZ,
    updated_dtm           TIMESTAMPTZ,
    created_by_user_id    UUID,
    updated_by_user_id    UUID
)
LANGUAGE sql STABLE AS $$
    SELECT
        p.pipeline_id,
        p.project_id,
        p.folder_id,
        p.pipeline_display_name,
        p.pipeline_desc_text,
        p.active_version_id,
        pv.version_num_seq,
        pv.release_tag_label,
        pc.ir_payload_json,
        pc.ui_layout_json,
        p.created_dtm,
        p.updated_dtm,
        p.created_by_user_id,
        p.updated_by_user_id
    FROM catalog.pipelines p
    LEFT JOIN catalog.pipeline_versions  pv ON p.active_version_id = pv.version_id
    LEFT JOIN catalog.pipeline_contents  pc ON pv.version_id       = pc.version_id
    WHERE p.pipeline_id = p_pipeline_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_by_id(UUID) IS 'Returns the full pipeline record with its active version body. Used by the pipeline workspace loader and API GET /pipelines/:id.';
;

CREATE OR REPLACE FUNCTION catalog.fn_list_pipelines(
    p_project_id  UUID    DEFAULT NULL::UUID,
    p_folder_id   UUID    DEFAULT NULL::UUID,
    p_search_text TEXT    DEFAULT NULL::TEXT,
    p_limit       INTEGER DEFAULT 50,
    p_offset      INTEGER DEFAULT 0
)
RETURNS TABLE (
    pipeline_id           UUID,
    pipeline_display_name TEXT,
    pipeline_desc_text    TEXT,
    active_version_id     UUID,
    has_active_version    BOOLEAN,
    folder_id             UUID,
    updated_dtm           TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        pipeline_id, pipeline_display_name, pipeline_desc_text,
        active_version_id, (active_version_id IS NOT NULL) AS has_active_version,
        folder_id, updated_dtm
    FROM catalog.pipelines
    WHERE project_id = p_project_id
      AND (p_folder_id IS NULL OR folder_id = p_folder_id)
      AND (p_search_text IS NULL OR pipeline_display_name ILIKE '%' || p_search_text || '%'
           OR pipeline_desc_text ILIKE '%' || p_search_text || '%')
    ORDER BY pipeline_display_name ASC
    LIMIT p_limit OFFSET p_offset;
$$;
COMMENT ON FUNCTION catalog.fn_list_pipelines(UUID, UUID, TEXT, INTEGER, INTEGER) IS 'Project-scoped paginated pipeline list with optional folder and search filters.';
;

CREATE OR REPLACE FUNCTION catalog.fn_list_pipelines(
    p_project_id  UUID    DEFAULT NULL::UUID,
    p_search_text TEXT    DEFAULT NULL::TEXT,
    p_limit       INTEGER DEFAULT 200,
    p_offset      INTEGER DEFAULT 0,
    p_order_by    TEXT    DEFAULT 'updated_dtm',
    p_order_dir   TEXT    DEFAULT 'DESC'
)
RETURNS TABLE (
    pipeline_id           UUID,
    project_id            UUID,
    folder_id             UUID,
    pipeline_display_name TEXT,
    pipeline_desc_text    TEXT,
    active_version_id     UUID,
    created_dtm           TIMESTAMPTZ,
    updated_dtm           TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT p.pipeline_id, p.project_id, p.folder_id,
               p.pipeline_display_name, p.pipeline_desc_text,
               p.active_version_id, p.created_dtm, p.updated_dtm
        FROM catalog.pipelines p
        WHERE (p_project_id IS NULL OR p.project_id = p_project_id)
          AND (p_search_text IS NULL
               OR p.pipeline_display_name ILIKE '%' || p_search_text || '%'
               OR COALESCE(p.pipeline_desc_text,'') ILIKE '%' || p_search_text || '%')
    )
    SELECT f.pipeline_id, f.project_id, f.folder_id,
           f.pipeline_display_name, f.pipeline_desc_text,
           f.active_version_id, f.created_dtm, f.updated_dtm
    FROM filtered f
    ORDER BY
        CASE WHEN lower(p_order_by)='pipeline_display_name' AND upper(p_order_dir)='ASC'  THEN f.pipeline_display_name END ASC NULLS LAST,
        CASE WHEN lower(p_order_by)='pipeline_display_name' AND upper(p_order_dir)='DESC' THEN f.pipeline_display_name END DESC NULLS LAST,
        CASE WHEN lower(p_order_by)='created_dtm'           AND upper(p_order_dir)='ASC'  THEN f.created_dtm END ASC NULLS LAST,
        CASE WHEN lower(p_order_by)='created_dtm'           AND upper(p_order_dir)='DESC' THEN f.created_dtm END DESC NULLS LAST,
        CASE WHEN lower(p_order_by)='updated_dtm'           AND upper(p_order_dir)='ASC'  THEN f.updated_dtm END ASC NULLS LAST,
        CASE WHEN lower(p_order_by)='updated_dtm'           AND upper(p_order_dir)='DESC' THEN f.updated_dtm END DESC NULLS LAST,
        f.updated_dtm DESC
    LIMIT GREATEST(COALESCE(p_limit,200),1)
    OFFSET GREATEST(COALESCE(p_offset,0),0);
$$;
COMMENT ON FUNCTION catalog.fn_list_pipelines(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT) IS 'Global/cross-project paginated pipeline list with sort and search. Used by the global pipelines API.';
;

CREATE OR REPLACE FUNCTION catalog.fn_get_root_pipelines(p_project_id UUID)
RETURNS TABLE (
    pipeline_id           UUID,
    project_id            UUID,
    folder_id             UUID,
    pipeline_display_name TEXT,
    pipeline_desc_text    TEXT,
    active_version_id     UUID,
    created_dtm           TIMESTAMPTZ,
    updated_dtm           TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT pipeline_id, project_id, folder_id, pipeline_display_name,
           pipeline_desc_text, active_version_id, created_dtm, updated_dtm
    FROM catalog.pipelines
    WHERE project_id = p_project_id AND folder_id IS NULL
    ORDER BY pipeline_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_root_pipelines(UUID) IS 'Returns project-root pipelines (folder_id IS NULL) for the left sidebar tree.';
;

CREATE OR REPLACE FUNCTION catalog.fn_get_root_orchestrators(p_project_id UUID)
RETURNS TABLE (
    orch_id           UUID,
    project_id        UUID,
    folder_id         UUID,
    orch_display_name TEXT,
    orch_desc_text    TEXT,
    created_dtm       TIMESTAMPTZ,
    updated_dtm       TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT orch_id, project_id, folder_id, orch_display_name,
           orch_desc_text, created_dtm, updated_dtm
    FROM catalog.orchestrators
    WHERE project_id = p_project_id AND folder_id IS NULL
    ORDER BY orch_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_root_orchestrators(UUID) IS 'Returns project-root orchestrators (folder_id IS NULL) for the left sidebar tree.';
;

CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_runtime_info(p_pipeline_id UUID)
RETURNS TABLE (pipeline_id UUID, active_version_id UUID)
LANGUAGE sql STABLE AS $$
    SELECT p.pipeline_id, p.active_version_id
    FROM catalog.pipelines p
    WHERE p.pipeline_id = p_pipeline_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_runtime_info(UUID) IS 'Returns minimal pipeline identity info needed to check existence and active version before initialising a run.';
;

CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_codegen_source(p_pipeline_id UUID)
RETURNS TABLE (
    pipeline_id           UUID,
    pipeline_display_name TEXT,
    pipeline_desc_text    TEXT,
    version_id            UUID,
    version_num_seq       INTEGER,
    release_tag_label     TEXT,
    ir_payload_json       JSONB,
    ui_layout_json        JSONB
)
LANGUAGE sql STABLE AS $$
    SELECT
        p.pipeline_id,
        p.pipeline_display_name,
        p.pipeline_desc_text,
        pv.version_id,
        pv.version_num_seq,
        pv.release_tag_label,
        pc.ir_payload_json,
        pc.ui_layout_json
    FROM catalog.pipelines p
    LEFT JOIN catalog.pipeline_versions pv ON pv.version_id = p.active_version_id
    LEFT JOIN catalog.pipeline_contents pc ON pc.version_id = pv.version_id
    WHERE p.pipeline_id = p_pipeline_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_codegen_source(UUID) IS 'Returns the IR and UI layout for the active version of a pipeline. This is the source contract for code generation engines.';
;

CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_lineage_edges(p_pipeline_id UUID)
RETURNS TABLE (
    from_pipeline_id           UUID,
    from_pipeline_display_name TEXT,
    to_pipeline_id             UUID,
    to_pipeline_display_name   TEXT
)
LANGUAGE sql STABLE AS $$
    WITH upstream_edges AS (
        SELECT DISTINCT
            up.pipeline_id AS from_pipeline_id,
            up_p.pipeline_display_name AS from_pipeline_display_name,
            cur.pipeline_id AS to_pipeline_id,
            cur_p.pipeline_display_name AS to_pipeline_display_name
        FROM catalog.pipeline_dataset_map cur
        JOIN catalog.pipelines cur_p ON cur_p.pipeline_id = cur.pipeline_id AND cur_p.active_version_id = cur.version_id
        JOIN catalog.pipeline_dataset_map up ON up.dataset_id = cur.dataset_id
        JOIN catalog.pipelines up_p ON up_p.pipeline_id = up.pipeline_id AND up_p.active_version_id = up.version_id
        WHERE cur.pipeline_id = p_pipeline_id
          AND cur.access_mode_code IN ('READ', 'READ_WRITE')
          AND up.access_mode_code IN ('WRITE', 'READ_WRITE')
          AND up.pipeline_id <> cur.pipeline_id
    ),
    downstream_edges AS (
        SELECT DISTINCT
            cur.pipeline_id AS from_pipeline_id,
            cur_p.pipeline_display_name AS from_pipeline_display_name,
            dn.pipeline_id AS to_pipeline_id,
            dn_p.pipeline_display_name AS to_pipeline_display_name
        FROM catalog.pipeline_dataset_map cur
        JOIN catalog.pipelines cur_p ON cur_p.pipeline_id = cur.pipeline_id AND cur_p.active_version_id = cur.version_id
        JOIN catalog.pipeline_dataset_map dn ON dn.dataset_id = cur.dataset_id
        JOIN catalog.pipelines dn_p ON dn_p.pipeline_id = dn.pipeline_id AND dn_p.active_version_id = dn.version_id
        WHERE cur.pipeline_id = p_pipeline_id
          AND cur.access_mode_code IN ('WRITE', 'READ_WRITE')
          AND dn.access_mode_code IN ('READ', 'READ_WRITE')
          AND dn.pipeline_id <> cur.pipeline_id
    )
    SELECT * FROM upstream_edges
    UNION
    SELECT * FROM downstream_edges;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_lineage_edges(UUID) IS 'Returns pipeline-to-pipeline lineage edges derived from shared dataset dependencies. Used in the Dependencies sub-tab.';
;

CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_permission_context(p_pipeline_id UUID)
RETURNS TABLE (pipeline_id UUID, project_id UUID)
LANGUAGE sql STABLE AS $$
    SELECT p.pipeline_id, p.project_id
    FROM catalog.pipelines p
    WHERE p.pipeline_id = p_pipeline_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_permission_context(UUID) IS 'Returns the project context of a pipeline for permission inheritance resolution.';
;

CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_permission_grants(p_pipeline_id UUID)
RETURNS TABLE (
    project_id        UUID,
    user_id           UUID,
    role_id           UUID,
    user_full_name    TEXT,
    email_address     TEXT,
    role_display_name TEXT,
    granted_dtm       TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT p.project_id, pur.user_id, pur.role_id,
           u.user_full_name, u.email_address,
           r.role_display_name, pur.granted_dtm
    FROM catalog.pipelines p
    JOIN gov.project_user_roles pur ON pur.project_id = p.project_id
    JOIN etl.users u ON u.user_id = pur.user_id
    JOIN gov.roles r ON r.role_id = pur.role_id
    WHERE p.pipeline_id = p_pipeline_id
    ORDER BY u.user_full_name, r.role_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_permission_grants(UUID) IS 'Returns all project-level permission grants for a pipeline including user and role details.';
;

CREATE OR REPLACE PROCEDURE catalog.pr_update_pipeline_metadata(
    p_pipeline_id           UUID,
    p_pipeline_display_name TEXT,
    p_pipeline_desc_text    TEXT,
    p_updated_by_user_id    UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE catalog.pipelines
    SET pipeline_display_name = COALESCE(p_pipeline_display_name, pipeline_display_name),
        pipeline_desc_text    = COALESCE(p_pipeline_desc_text,    pipeline_desc_text),
        updated_dtm           = CURRENT_TIMESTAMP,
        updated_by_user_id    = p_updated_by_user_id
    WHERE pipeline_id = p_pipeline_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pipeline % not found', p_pipeline_id;
    END IF;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_update_pipeline_metadata(UUID, TEXT, TEXT, UUID) IS 'Updates pipeline display name and/or description without touching version history.';
;

CREATE OR REPLACE PROCEDURE catalog.pr_clear_pipeline_parameters(p_pipeline_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM catalog.pipeline_parameters WHERE pipeline_id = p_pipeline_id;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_clear_pipeline_parameters(UUID) IS 'Removes all declared runtime parameters for a pipeline prior to a full re-sync from the UI.';
;

CREATE OR REPLACE PROCEDURE catalog.pr_grant_pipeline_permission(
    p_pipeline_id        UUID,
    p_user_id            UUID,
    p_role_id            UUID,
    p_granted_by_user_id UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_project_id UUID;
BEGIN
    SELECT project_id INTO v_project_id FROM catalog.pipelines WHERE pipeline_id = p_pipeline_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pipeline % not found', p_pipeline_id; END IF;
    INSERT INTO gov.project_user_roles (project_id, user_id, role_id, granted_by_user_id)
    VALUES (v_project_id, p_user_id, p_role_id, p_granted_by_user_id)
    ON CONFLICT (project_id, user_id, role_id) DO NOTHING;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_grant_pipeline_permission(UUID, UUID, UUID, UUID) IS 'Grants a project-level role to a user, giving them access to all pipelines within the project.';
;

CREATE OR REPLACE PROCEDURE catalog.pr_revoke_pipeline_permission(
    p_pipeline_id UUID,
    p_user_id     UUID,
    p_role_id     UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_project_id UUID;
BEGIN
    SELECT project_id INTO v_project_id FROM catalog.pipelines WHERE pipeline_id = p_pipeline_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pipeline % not found', p_pipeline_id; END IF;
    DELETE FROM gov.project_user_roles
    WHERE project_id = v_project_id AND user_id = p_user_id AND role_id = p_role_id;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_revoke_pipeline_permission(UUID, UUID, UUID) IS 'Revokes a project-level role from a user.';
;

CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_audit_logs(
    p_pipeline_id UUID,
    p_limit       INTEGER DEFAULT 50,
    p_offset      INTEGER DEFAULT 0
)
RETURNS TABLE (
    id          BIGINT,
    action_dtm  TIMESTAMPTZ,
    user_id     UUID,
    action_code CHAR(1)
)
LANGUAGE sql STABLE AS $$
    SELECT h.hist_id        AS id,
           h.hist_action_dtm AS action_dtm,
           h.hist_action_by  AS user_id,
           h.hist_action_cd  AS action_code
    FROM history.pipelines_history h
    WHERE h.pipeline_id = p_pipeline_id
    ORDER BY h.hist_action_dtm DESC
    LIMIT  GREATEST(COALESCE(p_limit,  50), 1)
    OFFSET GREATEST(COALESCE(p_offset,  0), 0);
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_audit_logs(UUID, INTEGER, INTEGER) IS 'Returns paginated audit history for a pipeline from the history shadow table. action_code: I=Insert U=Update D=Delete.';
;

COMMIT;
