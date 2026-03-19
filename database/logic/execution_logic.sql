-- ############################################################################
-- # FILE: execution_logic.sql
-- # PURPOSE: Step 9 of 12. Pipeline and orchestrator run CRUD.
-- #          References: pipeline_runs, orchestrator_runs,
-- #                      orchestrator_pipeline_run_map, pipeline_node_runs,
-- #                      pipeline_run_logs, pipeline_run_metrics
-- ############################################################################

BEGIN;

-- ============================================================================
-- READ OPERATIONS — PIPELINE RUNS
-- ============================================================================

-- Drop functions that have changed return types to allow CREATE OR REPLACE
DROP FUNCTION IF EXISTS execution.fn_get_pipeline_run_history(UUID, INTEGER);

CREATE OR REPLACE FUNCTION execution.fn_get_pipeline_run_status(p_pipeline_run_id UUID)
RETURNS TABLE (
    pipeline_run_id UUID, pipeline_display_name TEXT, run_status_code TEXT,
    triggered_by TEXT, start_dtm TIMESTAMPTZ, end_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT pr.pipeline_run_id, p.pipeline_display_name, pr.run_status_code,
           COALESCE(u.user_full_name, pr.trigger_type_code),
           pr.start_dtm, pr.end_dtm
    FROM execution.pipeline_runs pr
    JOIN catalog.pipelines p ON pr.pipeline_id = p.pipeline_id
    LEFT JOIN etl.users u ON pr.triggered_by_user_id = u.user_id
    WHERE pr.pipeline_run_id = p_pipeline_run_id;
$$;
COMMENT ON FUNCTION execution.fn_get_pipeline_run_status(UUID) IS 'Retrieves real-time status and timing for a pipeline execution run.';
;
CREATE OR REPLACE FUNCTION execution.fn_get_pipeline_run_history(p_pipeline_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    pipeline_run_id UUID, run_status_code TEXT, trigger_type_code TEXT,
    start_dtm TIMESTAMPTZ, end_dtm TIMESTAMPTZ, created_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT pipeline_run_id, run_status_code, trigger_type_code, start_dtm, end_dtm, created_dtm
    FROM execution.pipeline_runs
    WHERE pipeline_id = p_pipeline_id
    ORDER BY created_dtm DESC
    LIMIT p_limit;
$$;
COMMENT ON FUNCTION execution.fn_get_pipeline_run_history(UUID, INTEGER) IS 'Returns the most recent N execution runs for a pipeline in descending order.';
;
CREATE OR REPLACE FUNCTION execution.fn_get_pipeline_run_logs(
    p_pipeline_run_id UUID,
    p_level_code TEXT DEFAULT NULL
)
RETURNS TABLE (log_level_code TEXT, log_source_code TEXT, log_message_text TEXT, created_dtm TIMESTAMPTZ)
LANGUAGE sql STABLE AS $$
    SELECT log_level_code, log_source_code, log_message_text, created_dtm
    FROM execution.pipeline_run_logs
    WHERE pipeline_run_id = p_pipeline_run_id
      AND (p_level_code IS NULL OR log_level_code = p_level_code)
    ORDER BY created_dtm;
$$;
COMMENT ON FUNCTION execution.fn_get_pipeline_run_logs(UUID, TEXT) IS 'Returns ordered log lines for a pipeline run. Optional filter by severity level.';
;
CREATE OR REPLACE FUNCTION execution.fn_get_pipeline_node_runs(p_pipeline_run_id UUID)
RETURNS TABLE (
    node_id_in_ir_text TEXT, node_display_name TEXT, node_status_code TEXT,
    start_dtm TIMESTAMPTZ, end_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT node_id_in_ir_text, node_display_name, node_status_code, start_dtm, end_dtm
    FROM execution.pipeline_node_runs
    WHERE pipeline_run_id = p_pipeline_run_id;
$$;
COMMENT ON FUNCTION execution.fn_get_pipeline_node_runs(UUID) IS 'Returns per-DAG-node execution status for live pipeline monitoring.';
;
-- ============================================================================
-- READ OPERATIONS — ORCHESTRATOR RUNS
-- ============================================================================

CREATE OR REPLACE FUNCTION execution.fn_get_orchestrator_run_status(p_orch_run_id UUID)
RETURNS TABLE (
    orch_run_id UUID, orch_display_name TEXT, run_status_code TEXT,
    start_dtm TIMESTAMPTZ, end_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT r.orch_run_id, o.orch_display_name, r.run_status_code, r.start_dtm, r.end_dtm
    FROM execution.orchestrator_runs r
    JOIN catalog.orchestrators o ON r.orch_id = o.orch_id
    WHERE r.orch_run_id = p_orch_run_id;
$$;
COMMENT ON FUNCTION execution.fn_get_orchestrator_run_status(UUID) IS 'Returns aggregate status for an orchestrator run.';
;
CREATE OR REPLACE FUNCTION execution.fn_get_orchestrator_pipeline_runs(p_orch_run_id UUID)
RETURNS TABLE (
    pipeline_run_id UUID, dag_node_id_text TEXT, execution_order_num INTEGER,
    run_status_code TEXT, pipeline_display_name TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT m.pipeline_run_id, m.dag_node_id_text, m.execution_order_num,
           pr.run_status_code, p.pipeline_display_name
    FROM execution.orchestrator_pipeline_run_map m
    JOIN execution.pipeline_runs pr ON m.pipeline_run_id = pr.pipeline_run_id
    JOIN catalog.pipelines p ON pr.pipeline_id = p.pipeline_id
    WHERE m.orch_run_id = p_orch_run_id
    ORDER BY m.execution_order_num;
$$;
COMMENT ON FUNCTION execution.fn_get_orchestrator_pipeline_runs(UUID) IS 'Returns all pipeline runs belonging to an orchestrator run, ordered by DAG execution sequence.';
;
-- ============================================================================
-- WRITE OPERATIONS — PIPELINE RUNS
-- ============================================================================

CREATE OR REPLACE PROCEDURE execution.pr_initialize_pipeline_run(
    p_pipeline_id UUID, p_version_id UUID, p_env_id UUID,
    p_triggered_by_user_id UUID,
    OUT p_pipeline_run_id UUID,
    p_trigger_type_code TEXT DEFAULT 'MANUAL'
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO execution.pipeline_runs (
        pipeline_id, version_id, env_id, triggered_by_user_id, trigger_type_code
    )
    VALUES (p_pipeline_id, p_version_id, p_env_id, p_triggered_by_user_id, p_trigger_type_code)
    RETURNING pipeline_run_id INTO p_pipeline_run_id;
END;
$$;
COMMENT ON PROCEDURE execution.pr_initialize_pipeline_run(UUID, UUID, UUID, UUID, TEXT) IS 'Creates a pipeline run record in PENDING state. Returns the pipeline_run_id for the execution engine.';
;
CREATE OR REPLACE PROCEDURE execution.pr_start_pipeline_run(
    p_pipeline_run_id UUID,
    p_external_engine_job_id TEXT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE execution.pipeline_runs SET
        run_status_code = 'RUNNING',
        start_dtm = CURRENT_TIMESTAMP,
        external_engine_job_id = p_external_engine_job_id
    WHERE pipeline_run_id = p_pipeline_run_id AND run_status_code = 'PENDING';
END;
$$;
COMMENT ON PROCEDURE execution.pr_start_pipeline_run(UUID, TEXT) IS 'Transitions a pipeline run from PENDING to RUNNING and records the Spark Application ID.';
;
CREATE OR REPLACE PROCEDURE execution.pr_finalize_pipeline_run(
    p_pipeline_run_id UUID,
    p_final_status_code TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE execution.pipeline_runs SET
        run_status_code = p_final_status_code,
        end_dtm = CURRENT_TIMESTAMP
    WHERE pipeline_run_id = p_pipeline_run_id;
END;
$$;
COMMENT ON PROCEDURE execution.pr_finalize_pipeline_run(UUID, TEXT) IS 'Sets the terminal status (SUCCESS, FAILED, KILLED) and records end timestamp for a pipeline run.';
;
CREATE OR REPLACE PROCEDURE execution.pr_update_node_status(
    p_pipeline_run_id UUID, p_node_id TEXT, p_status_code TEXT,
    p_node_display_name TEXT DEFAULT NULL, p_node_metrics_json JSONB DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO execution.pipeline_node_runs
        (pipeline_run_id, node_id_in_ir_text, node_display_name, node_status_code)
    VALUES (p_pipeline_run_id, p_node_id, p_node_display_name, p_status_code)
    ON CONFLICT (pipeline_run_id, node_id_in_ir_text) DO UPDATE SET
        node_status_code = EXCLUDED.node_status_code,
        start_dtm = CASE
            WHEN execution.pipeline_node_runs.start_dtm IS NULL AND EXCLUDED.node_status_code = 'RUNNING'
            THEN CURRENT_TIMESTAMP ELSE execution.pipeline_node_runs.start_dtm END,
        end_dtm = CASE
            WHEN EXCLUDED.node_status_code IN ('SUCCESS', 'FAILED', 'SKIPPED')
            THEN CURRENT_TIMESTAMP ELSE execution.pipeline_node_runs.end_dtm END,
        node_metrics_json = COALESCE(EXCLUDED.node_metrics_json, execution.pipeline_node_runs.node_metrics_json);
END;
$$;
COMMENT ON PROCEDURE execution.pr_update_node_status(UUID, TEXT, TEXT, TEXT, JSONB) IS 'Upserts node execution status and metrics. Auto-timestamps start and end transitions.';
;
CREATE OR REPLACE PROCEDURE execution.pr_append_run_log(
    p_pipeline_run_id UUID, p_level_code TEXT, p_source_code TEXT, p_message_text TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO execution.pipeline_run_logs
        (pipeline_run_id, log_level_code, log_source_code, log_message_text)
    VALUES (p_pipeline_run_id, p_level_code, p_source_code, p_message_text);
END;
$$;
COMMENT ON PROCEDURE execution.pr_append_run_log(UUID, TEXT, TEXT, TEXT) IS 'Appends a single log line to the execution log for a pipeline run.';
;
CREATE OR REPLACE PROCEDURE execution.pr_record_run_metric(
    p_pipeline_run_id UUID, p_metric_name_text TEXT, p_metric_value_num NUMERIC
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO execution.pipeline_run_metrics
        (pipeline_run_id, metric_name_text, metric_value_num)
    VALUES (p_pipeline_run_id, p_metric_name_text, p_metric_value_num);
END;
$$;
COMMENT ON PROCEDURE execution.pr_record_run_metric(UUID, TEXT, NUMERIC) IS 'Records a single numeric telemetry data point for a pipeline run.';
;
-- ============================================================================
-- WRITE OPERATIONS — ORCHESTRATOR RUNS
-- ============================================================================

CREATE OR REPLACE PROCEDURE execution.pr_initialize_orchestrator_run(
    p_orch_id UUID, p_env_id UUID,
    p_triggered_by_user_id UUID,
    OUT p_orch_run_id UUID,
    p_trigger_type_code TEXT DEFAULT 'MANUAL'
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO execution.orchestrator_runs
        (orch_id, env_id, triggered_by_user_id, trigger_type_code)
    VALUES (p_orch_id, p_env_id, p_triggered_by_user_id, p_trigger_type_code)
    RETURNING orch_run_id INTO p_orch_run_id;
END;
$$;
COMMENT ON PROCEDURE execution.pr_initialize_orchestrator_run(UUID, UUID, UUID, TEXT) IS 'Creates an orchestrator run record in PENDING state. Returns orch_run_id.';
;
CREATE OR REPLACE PROCEDURE execution.pr_register_orchestrator_pipeline_run(
    p_orch_run_id UUID, p_pipeline_run_id UUID,
    p_dag_node_id_text TEXT, p_execution_order_num INTEGER
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO execution.orchestrator_pipeline_run_map
        (orch_run_id, pipeline_run_id, dag_node_id_text, execution_order_num)
    VALUES (p_orch_run_id, p_pipeline_run_id, p_dag_node_id_text, p_execution_order_num);
END;
$$;
COMMENT ON PROCEDURE execution.pr_register_orchestrator_pipeline_run(UUID, UUID, TEXT, INTEGER) IS 'Links a pipeline_run to its parent orchestrator_run with the DAG node ID and execution order.';
;
CREATE OR REPLACE PROCEDURE execution.pr_finalize_orchestrator_run(
    p_orch_run_id UUID,
    p_final_status_code TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE execution.orchestrator_runs SET
        run_status_code = p_final_status_code,
        end_dtm = CURRENT_TIMESTAMP
    WHERE orch_run_id = p_orch_run_id;
END;
$$;
COMMENT ON PROCEDURE execution.pr_finalize_orchestrator_run(UUID, TEXT) IS 'Sets the terminal aggregate status (SUCCESS, PARTIAL_FAIL, FAILED, KILLED) for an orchestrator run.';
;
-- ============================================================================
-- SCHEDULES
-- ============================================================================

CREATE OR REPLACE PROCEDURE execution.pr_create_schedule(
    p_entity_type_code TEXT, p_entity_id UUID,
    p_cron_expression_text TEXT, p_timezone_name_text TEXT, p_env_id UUID,
    p_created_by_user_id UUID, OUT p_schedule_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO execution.schedules
        (entity_type_code, entity_id, cron_expression_text, timezone_name_text, env_id, created_by_user_id)
    VALUES (p_entity_type_code, p_entity_id, p_cron_expression_text, p_timezone_name_text, p_env_id, p_created_by_user_id)
    RETURNING schedule_id INTO p_schedule_id;
END;
$$;
COMMENT ON PROCEDURE execution.pr_create_schedule(TEXT, UUID, TEXT, TEXT, UUID, UUID) IS 'Defines a new cron-based schedule for a pipeline or orchestrator.';
;

CREATE OR REPLACE FUNCTION execution.fn_get_entity_schedule(
    p_entity_type_code TEXT,
    p_entity_id UUID
)
RETURNS TABLE (
    schedule_id UUID,
    entity_type_code TEXT,
    entity_id UUID,
    cron_expression_text TEXT,
    timezone_name_text TEXT,
    env_id UUID,
    is_schedule_active BOOLEAN,
    next_run_dtm TIMESTAMPTZ,
    last_run_dtm TIMESTAMPTZ,
    created_dtm TIMESTAMPTZ,
    updated_dtm TIMESTAMPTZ,
    created_by_user_id UUID
)
LANGUAGE sql STABLE AS $$
    SELECT
        s.schedule_id,
        s.entity_type_code,
        s.entity_id,
        s.cron_expression_text,
        s.timezone_name_text,
        s.env_id,
        s.is_schedule_active,
        s.next_run_dtm,
        s.last_run_dtm,
        s.created_dtm,
        s.updated_dtm,
        s.created_by_user_id
    FROM execution.schedules s
    WHERE s.entity_type_code = p_entity_type_code
      AND s.entity_id = p_entity_id
    ORDER BY s.updated_dtm DESC
    LIMIT 1;
$$;
COMMENT ON FUNCTION execution.fn_get_entity_schedule(TEXT, UUID) IS 'Returns the most recently updated schedule for the given entity (PIPELINE or ORCHESTRATOR).';
;

CREATE OR REPLACE PROCEDURE execution.pr_set_entity_schedule(
    p_entity_type_code TEXT,
    p_entity_id UUID,
    p_cron_expression_text TEXT,
    p_timezone_name_text TEXT,
    p_env_id UUID,
    p_is_schedule_active BOOLEAN,
    p_updated_by_user_id UUID,
    OUT p_schedule_id UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_existing_id UUID;
BEGIN
    SELECT s.schedule_id
      INTO v_existing_id
    FROM execution.schedules s
    WHERE s.entity_type_code = p_entity_type_code
      AND s.entity_id = p_entity_id
    ORDER BY s.updated_dtm DESC
    LIMIT 1;

    IF v_existing_id IS NULL THEN
        INSERT INTO execution.schedules
            (entity_type_code, entity_id, cron_expression_text, timezone_name_text, env_id, is_schedule_active, created_by_user_id)
        VALUES
            (p_entity_type_code, p_entity_id, p_cron_expression_text, COALESCE(p_timezone_name_text, 'UTC'), p_env_id, COALESCE(p_is_schedule_active, TRUE), p_updated_by_user_id)
        RETURNING schedule_id INTO p_schedule_id;
    ELSE
        UPDATE execution.schedules SET
            cron_expression_text = p_cron_expression_text,
            timezone_name_text = COALESCE(p_timezone_name_text, timezone_name_text),
            env_id = p_env_id,
            is_schedule_active = COALESCE(p_is_schedule_active, is_schedule_active),
            updated_dtm = CURRENT_TIMESTAMP
        WHERE schedule_id = v_existing_id
        RETURNING schedule_id INTO p_schedule_id;
    END IF;
END;
$$;
COMMENT ON PROCEDURE execution.pr_set_entity_schedule(TEXT, UUID, TEXT, TEXT, UUID, BOOLEAN, UUID) IS 'Creates or updates the latest schedule for an entity. Used by API-driven schedule saves.';
;

CREATE OR REPLACE PROCEDURE execution.pr_delete_entity_schedule(
    p_entity_type_code TEXT,
    p_entity_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM execution.schedules
    WHERE entity_type_code = p_entity_type_code
      AND entity_id = p_entity_id;
END;
$$;
COMMENT ON PROCEDURE execution.pr_delete_entity_schedule(TEXT, UUID) IS 'Physically deletes all schedules for the given entity.';
;
CREATE OR REPLACE PROCEDURE execution.pr_update_schedule_next_run(
    p_schedule_id UUID, p_next_run_dtm TIMESTAMPTZ, p_last_run_dtm TIMESTAMPTZ DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE execution.schedules SET
        next_run_dtm = p_next_run_dtm,
        last_run_dtm = COALESCE(p_last_run_dtm, last_run_dtm)
    WHERE schedule_id = p_schedule_id;
END;
$$;
COMMENT ON PROCEDURE execution.pr_update_schedule_next_run(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Updates the next and last run timestamps on a schedule. Called by the scheduler engine after each triggered execution.';
;
CREATE OR REPLACE FUNCTION execution.fn_get_due_schedules(p_as_of_dtm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)
RETURNS TABLE (schedule_id UUID, entity_type_code TEXT, entity_id UUID, env_id UUID, cron_expression_text TEXT)
LANGUAGE sql STABLE AS $$
    SELECT schedule_id, entity_type_code, entity_id, env_id, cron_expression_text
    FROM execution.schedules
    WHERE is_schedule_active = TRUE
      AND (next_run_dtm IS NULL OR next_run_dtm <= p_as_of_dtm);
$$;
COMMENT ON FUNCTION execution.fn_get_due_schedules(TIMESTAMPTZ) IS 'Returns all active schedules that are due to fire at or before the given timestamp. Used by the scheduler daemon polling loop.';
;
-- ============================================================================
-- RUN PARAMETERS
-- ============================================================================

CREATE OR REPLACE PROCEDURE execution.pr_record_run_parameters(
    p_pipeline_run_id UUID, p_params_json JSONB
)
LANGUAGE plpgsql AS $$
DECLARE
    v_param JSONB;
BEGIN
    FOR v_param IN SELECT * FROM jsonb_each(p_params_json)
    LOOP
        INSERT INTO execution.run_parameters (pipeline_run_id, param_key_name, param_value_text)
        VALUES (p_pipeline_run_id, v_param->>'key', v_param->>'value')
        ON CONFLICT (pipeline_run_id, param_key_name) DO NOTHING;
    END LOOP;
END;
$$;
COMMENT ON PROCEDURE execution.pr_record_run_parameters(UUID, JSONB) IS 'Captures all parameter values used for a specific pipeline run. Called at run initialization for reproducibility tracking.';
;
CREATE OR REPLACE FUNCTION execution.fn_get_run_parameters(p_pipeline_run_id UUID)
RETURNS TABLE (param_key_name TEXT, param_value_text TEXT)
LANGUAGE sql STABLE AS $$
    SELECT param_key_name, param_value_text
    FROM execution.run_parameters
    WHERE pipeline_run_id = p_pipeline_run_id
    ORDER BY param_key_name;
$$;
COMMENT ON FUNCTION execution.fn_get_run_parameters(UUID) IS 'Returns all parameter values used during a specific pipeline run. Used for run comparison and reproducibility.';
;
-- ============================================================================
-- RUN ARTIFACTS
-- ============================================================================

CREATE OR REPLACE PROCEDURE execution.pr_record_run_artifact(
    p_pipeline_run_id UUID, p_artifact_type_code TEXT,
    p_artifact_name_text TEXT, p_storage_uri_text TEXT, p_artifact_size_bytes BIGINT
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO execution.run_artifacts
        (pipeline_run_id, artifact_type_code, artifact_name_text, storage_uri_text, artifact_size_bytes)
    VALUES (p_pipeline_run_id, p_artifact_type_code, p_artifact_name_text, p_storage_uri_text, p_artifact_size_bytes);
END;
$$;
COMMENT ON PROCEDURE execution.pr_record_run_artifact(UUID, TEXT, TEXT, TEXT, BIGINT) IS 'Registers a file artifact produced by a pipeline run (generated code, output data, profiling report).';
;
CREATE OR REPLACE FUNCTION execution.fn_get_run_artifacts(p_pipeline_run_id UUID)
RETURNS TABLE (artifact_id UUID, artifact_type_code TEXT, artifact_name_text TEXT, storage_uri_text TEXT, artifact_size_bytes BIGINT, created_dtm TIMESTAMPTZ)
LANGUAGE sql STABLE AS $$
    SELECT artifact_id, artifact_type_code, artifact_name_text, storage_uri_text, artifact_size_bytes, created_dtm
    FROM execution.run_artifacts
    WHERE pipeline_run_id = p_pipeline_run_id
    ORDER BY created_dtm;
$$;
COMMENT ON FUNCTION execution.fn_get_run_artifacts(UUID) IS 'Returns all artifacts produced by a pipeline run in creation order.';
;
-- ============================================================================
-- RUN LINEAGE
-- ============================================================================

CREATE OR REPLACE PROCEDURE execution.pr_record_run_lineage_edges(
    p_pipeline_run_id UUID,
    p_lineage_json    JSONB
)
LANGUAGE plpgsql AS $$
DECLARE
    v_edge JSONB;
BEGIN
    FOR v_edge IN SELECT * FROM jsonb_array_elements(p_lineage_json)
    LOOP
        INSERT INTO execution.run_lineage (
            pipeline_run_id,
            src_dataset_id, src_column_name_text,
            tgt_dataset_id, tgt_column_name_text,
            rows_read_num, rows_written_num,
            transformation_desc_text
        ) VALUES (
            p_pipeline_run_id,
            NULLIF(v_edge->>'src_dataset_id', '')::UUID,
            v_edge->>'src_column_name_text',
            NULLIF(v_edge->>'tgt_dataset_id', '')::UUID,
            v_edge->>'tgt_column_name_text',
            (v_edge->>'rows_read_num')::BIGINT,
            (v_edge->>'rows_written_num')::BIGINT,
            v_edge->>'transformation_desc_text'
        );
    END LOOP;
END;
$$;
COMMENT ON PROCEDURE execution.pr_record_run_lineage_edges(UUID, JSONB) IS 'Appends runtime column-level lineage edges for a pipeline run. Called by the execution engine after each sink node completes. Input: [{src_dataset_id, src_column_name_text, tgt_dataset_id, tgt_column_name_text, rows_read_num, rows_written_num, transformation_desc_text}].';
;
CREATE OR REPLACE FUNCTION execution.fn_get_run_lineage(p_pipeline_run_id UUID)
RETURNS TABLE (
    run_lineage_id           UUID,
    src_dataset_id           UUID,
    src_column_name_text     TEXT,
    tgt_dataset_id           UUID,
    tgt_column_name_text     TEXT,
    rows_read_num            BIGINT,
    rows_written_num         BIGINT,
    transformation_desc_text TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT run_lineage_id, src_dataset_id, src_column_name_text,
           tgt_dataset_id, tgt_column_name_text,
           rows_read_num, rows_written_num, transformation_desc_text
    FROM execution.run_lineage
    WHERE pipeline_run_id = p_pipeline_run_id
    ORDER BY created_dtm;
$$;
COMMENT ON FUNCTION execution.fn_get_run_lineage(UUID) IS 'Returns all runtime lineage edges observed during a specific pipeline run. Used in the run detail UI and post-run compliance reports.';
;
CREATE OR REPLACE FUNCTION execution.fn_get_runs_that_wrote_to_dataset(p_dataset_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    pipeline_run_id UUID,
    pipeline_display_name TEXT,
    run_status_code TEXT,
    rows_written_num BIGINT,
    end_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT DISTINCT ON (pr.pipeline_run_id)
        pr.pipeline_run_id, p.pipeline_display_name, pr.run_status_code,
        rl.rows_written_num, pr.end_dtm
    FROM execution.run_lineage rl
    JOIN execution.pipeline_runs pr ON rl.pipeline_run_id = pr.pipeline_run_id
    JOIN catalog.pipelines p ON pr.pipeline_id = p.pipeline_id
    WHERE rl.tgt_dataset_id = p_dataset_id
    ORDER BY pr.pipeline_run_id, pr.end_dtm DESC
    LIMIT p_limit;
$$;
COMMENT ON FUNCTION execution.fn_get_runs_that_wrote_to_dataset(UUID, INTEGER) IS 'Returns the most recent pipeline runs that wrote data to a specific dataset. Enables dataset-level data freshness tracking and lineage investigation.';
;

-- ─── UI / API support functions ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION execution.fn_get_environment_id_by_name(p_env_display_name text)
RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT e.env_id
    FROM execution.environments e
    WHERE lower(e.env_display_name) = lower(p_env_display_name)
    ORDER BY e.created_dtm DESC
    LIMIT 1;
$$;
COMMENT ON FUNCTION execution.fn_get_environment_id_by_name(text) IS 'Returns environment ID by display name, case-insensitive; NULL when not found.';
;

CREATE OR REPLACE PROCEDURE execution.pr_set_pipeline_run_options(IN p_pipeline_run_id uuid, IN p_run_options_json jsonb)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE execution.pipeline_runs
    SET run_options_json = p_run_options_json
    WHERE pipeline_run_id = p_pipeline_run_id;
END;
$$;
COMMENT ON PROCEDURE execution.pr_set_pipeline_run_options(uuid, jsonb) IS 'Stores the original trigger-time options payload for a pipeline run.';
;

CREATE OR REPLACE FUNCTION execution.fn_get_execution_kpis(p_date_from date, p_date_to date, p_project_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(total_today bigint, running_now bigint, success_rate_today numeric, failed_today bigint, avg_duration_ms_today numeric, sla_breaches_today bigint, data_volume_gb_today numeric, active_pipelines bigint)
LANGUAGE sql STABLE AS $$
    SELECT
        COUNT(*)                                                                           AS total_today,
        COUNT(*) FILTER (WHERE pr.run_status_code = 'RUNNING')                            AS running_now,
        ROUND(
            COUNT(*) FILTER (WHERE pr.run_status_code = 'SUCCESS')::NUMERIC
            / NULLIF(COUNT(*), 0) * 100, 2
        )                                                                                  AS success_rate_today,
        COUNT(*) FILTER (WHERE pr.run_status_code = 'FAILED')                             AS failed_today,
        AVG(pr.run_duration_ms) FILTER (WHERE pr.run_status_code = 'SUCCESS')             AS avg_duration_ms_today,
        COUNT(*) FILTER (WHERE pr.sla_status_code = 'BREACHED')                           AS sla_breaches_today,
        ROUND(
            COALESCE(
                SUM(COALESCE(pr.bytes_read_num, 0) + COALESCE(pr.bytes_written_num, 0))::NUMERIC
                / 1e9, 0
            ), 4
        )                                                                                  AS data_volume_gb_today,
        (
            SELECT COUNT(*)
            FROM catalog.pipelines p2
            WHERE p2.active_version_id IS NOT NULL
              AND (p_project_id IS NULL OR p2.project_id = p_project_id)
        )                                                                                  AS active_pipelines
    FROM execution.pipeline_runs pr
    LEFT JOIN catalog.pipelines p ON p.pipeline_id = pr.pipeline_id
    WHERE DATE(COALESCE(pr.start_dtm, pr.created_dtm)) BETWEEN p_date_from AND p_date_to
      AND (p_project_id IS NULL OR p.project_id = p_project_id);
$$;
COMMENT ON FUNCTION execution.fn_get_execution_kpis(date, date, uuid) IS 'Returns execution monitor KPI aggregates for a date range. p_project_id is optional; NULL returns platform-wide metrics.';
;

CREATE OR REPLACE FUNCTION execution.fn_list_pipeline_runs(
    p_pipeline_id   UUID    DEFAULT NULL,
    p_project_id    UUID    DEFAULT NULL,
    p_status        TEXT    DEFAULT NULL,
    p_trigger_type  TEXT    DEFAULT NULL,
    p_date_from     DATE    DEFAULT NULL,
    p_date_to       DATE    DEFAULT NULL,
    p_search        TEXT    DEFAULT NULL,
    p_my_jobs_only  BOOLEAN DEFAULT FALSE,
    p_user_id       UUID    DEFAULT NULL,
    p_limit         INTEGER DEFAULT 50,
    p_offset        INTEGER DEFAULT 0
)
RETURNS TABLE (
    pipeline_run_id UUID,
    pipeline_id     UUID,
    pipeline_name   TEXT,
    project_id      UUID,
    project_name    TEXT,
    version_label   TEXT,
    run_status      TEXT,
    trigger_type    TEXT,
    submitted_by    TEXT,
    start_dtm       TIMESTAMPTZ,
    end_dtm         TIMESTAMPTZ,
    duration_ms     INTEGER,
    rows_processed  BIGINT,
    bytes_read      BIGINT,
    bytes_written   BIGINT,
    error_message   TEXT,
    retry_count     INTEGER,
    sla_status      TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT
        pr.pipeline_run_id,
        pr.pipeline_id,
        p.pipeline_display_name                     AS pipeline_name,
        p.project_id,
        proj.project_display_name                   AS project_name,
        COALESCE(pv.release_tag_label, 'v' || pv.version_num_seq::text) AS version_label,
        pr.run_status_code                          AS run_status,
        pr.trigger_type_code                        AS trigger_type,
        u.user_full_name                             AS submitted_by,
        pr.start_dtm,
        pr.end_dtm,
        pr.run_duration_ms                          AS duration_ms,
        pr.rows_processed_num                       AS rows_processed,
        pr.bytes_read_num                           AS bytes_read,
        pr.bytes_written_num                        AS bytes_written,
        pr.error_message_text                       AS error_message,
        pr.retry_count_num                          AS retry_count,
        pr.sla_status_code                          AS sla_status
    FROM execution.pipeline_runs pr
    JOIN catalog.pipelines p          ON pr.pipeline_id = p.pipeline_id
    JOIN etl.projects      proj       ON p.project_id   = proj.project_id
    LEFT JOIN catalog.pipeline_versions pv ON pr.version_id = pv.version_id
    LEFT JOIN etl.users                 u  ON pr.triggered_by_user_id = u.user_id
    WHERE (p_pipeline_id   IS NULL OR pr.pipeline_id          = p_pipeline_id)
      AND (p_project_id    IS NULL OR p.project_id            = p_project_id)
      AND (p_status        IS NULL OR pr.run_status_code      = p_status)
      AND (p_trigger_type  IS NULL OR pr.trigger_type_code    = p_trigger_type)
      AND (p_date_from     IS NULL OR pr.created_dtm::date   >= p_date_from)
      AND (p_date_to       IS NULL OR pr.created_dtm::date   <= p_date_to)
      AND (p_search        IS NULL OR p.pipeline_display_name ILIKE '%' || p_search || '%')
      AND (NOT p_my_jobs_only OR pr.triggered_by_user_id = p_user_id)
    ORDER BY pr.created_dtm DESC
    LIMIT p_limit OFFSET p_offset;
$$;
COMMENT ON FUNCTION execution.fn_list_pipeline_runs IS 'Paginated pipeline run list with filters for the Monitor Executions tab.';
;

CREATE OR REPLACE FUNCTION execution.fn_count_pipeline_runs(
    p_pipeline_id   UUID    DEFAULT NULL,
    p_project_id    UUID    DEFAULT NULL,
    p_status        TEXT    DEFAULT NULL,
    p_trigger_type  TEXT    DEFAULT NULL,
    p_date_from     DATE    DEFAULT NULL,
    p_date_to       DATE    DEFAULT NULL,
    p_search        TEXT    DEFAULT NULL,
    p_my_jobs_only  BOOLEAN DEFAULT FALSE,
    p_user_id       UUID    DEFAULT NULL
)
RETURNS BIGINT LANGUAGE sql STABLE AS $$
    SELECT COUNT(*)
    FROM execution.pipeline_runs pr
    JOIN catalog.pipelines p ON pr.pipeline_id = p.pipeline_id
    WHERE (p_pipeline_id   IS NULL OR pr.pipeline_id          = p_pipeline_id)
      AND (p_project_id    IS NULL OR p.project_id            = p_project_id)
      AND (p_status        IS NULL OR pr.run_status_code      = p_status)
      AND (p_trigger_type  IS NULL OR pr.trigger_type_code    = p_trigger_type)
      AND (p_date_from     IS NULL OR pr.created_dtm::date   >= p_date_from)
      AND (p_date_to       IS NULL OR pr.created_dtm::date   <= p_date_to)
      AND (p_search        IS NULL OR p.pipeline_display_name ILIKE '%' || p_search || '%')
      AND (NOT p_my_jobs_only OR pr.triggered_by_user_id = p_user_id);
$$;
COMMENT ON FUNCTION execution.fn_count_pipeline_runs IS 'Total count of pipeline runs matching the same filters as fn_list_pipeline_runs. Used for pagination.';
;

CREATE OR REPLACE FUNCTION execution.fn_get_pipeline_run_detail(p_run_id UUID)
RETURNS TABLE (
    pipeline_run_id  UUID,
    pipeline_id      UUID,
    pipeline_name    TEXT,
    project_name     TEXT,
    version_label    TEXT,
    run_status       TEXT,
    trigger_type     TEXT,
    submitted_by     TEXT,
    start_dtm        TIMESTAMPTZ,
    end_dtm          TIMESTAMPTZ,
    duration_ms      INTEGER,
    rows_processed   BIGINT,
    bytes_read       BIGINT,
    bytes_written    BIGINT,
    error_message    TEXT,
    retry_count      INTEGER,
    sla_status       TEXT,
    spark_job_id     TEXT,
    spark_ui_url     TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT
        pr.pipeline_run_id,
        pr.pipeline_id,
        p.pipeline_display_name                     AS pipeline_name,
        proj.project_display_name                   AS project_name,
        COALESCE(pv.release_tag_label, 'v' || pv.version_num_seq::text) AS version_label,
        pr.run_status_code                          AS run_status,
        pr.trigger_type_code                        AS trigger_type,
        u.user_full_name                             AS submitted_by,
        pr.start_dtm,
        pr.end_dtm,
        pr.run_duration_ms                          AS duration_ms,
        pr.rows_processed_num                       AS rows_processed,
        pr.bytes_read_num                           AS bytes_read,
        pr.bytes_written_num                        AS bytes_written,
        pr.error_message_text                       AS error_message,
        pr.retry_count_num                          AS retry_count,
        pr.sla_status_code                          AS sla_status,
        pr.external_engine_job_id                   AS spark_job_id,
        pr.spark_ui_url_text                        AS spark_ui_url
    FROM execution.pipeline_runs pr
    JOIN catalog.pipelines p          ON pr.pipeline_id = p.pipeline_id
    JOIN etl.projects      proj       ON p.project_id   = proj.project_id
    LEFT JOIN catalog.pipeline_versions pv ON pr.version_id = pv.version_id
    LEFT JOIN etl.users                 u  ON pr.triggered_by_user_id = u.user_id
    WHERE pr.pipeline_run_id = p_run_id;
$$;
COMMENT ON FUNCTION execution.fn_get_pipeline_run_detail(UUID) IS 'Returns the full detail record for a single pipeline run including display names for all FK references.';
;

CREATE OR REPLACE FUNCTION execution.fn_get_pipeline_run_nodes_detail(p_run_id UUID)
RETURNS TABLE (
    node_run_id        UUID,
    node_id_in_ir_text TEXT,
    node_display_name  TEXT,
    node_status        TEXT,
    start_dtm          TIMESTAMPTZ,
    end_dtm            TIMESTAMPTZ,
    rows_in            BIGINT,
    rows_out           BIGINT,
    error_message      TEXT,
    node_metrics_json  JSONB
)
LANGUAGE sql STABLE AS $$
    SELECT
        node_run_id,
        node_id_in_ir_text,
        node_display_name,
        node_status_code   AS node_status,
        start_dtm,
        end_dtm,
        rows_in_num        AS rows_in,
        rows_out_num       AS rows_out,
        error_message_text AS error_message,
        node_metrics_json
    FROM execution.pipeline_node_runs
    WHERE pipeline_run_id = p_run_id
    ORDER BY start_dtm NULLS LAST;
$$;
COMMENT ON FUNCTION execution.fn_get_pipeline_run_nodes_detail(UUID) IS 'Returns per-node telemetry for all DAG nodes within a pipeline run, ordered by execution start time.';
;

CREATE OR REPLACE FUNCTION execution.fn_get_pipeline_run_logs_paginated(
    p_run_id UUID,
    p_level  TEXT    DEFAULT NULL,
    p_limit           INTEGER DEFAULT 500,
    p_offset          INTEGER DEFAULT 0
)
RETURNS TABLE (
    log_id           BIGINT,
    log_level_code   TEXT,
    log_source_code  TEXT,
    log_message_text TEXT,
    created_dtm      TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT log_id, log_level_code, log_source_code, log_message_text, created_dtm
    FROM execution.pipeline_run_logs
    WHERE pipeline_run_id = p_run_id
      AND (p_level IS NULL OR log_level_code = p_level)
    ORDER BY log_id
    LIMIT p_limit OFFSET p_offset;
$$;
COMMENT ON FUNCTION execution.fn_get_pipeline_run_logs_paginated(UUID, TEXT, INTEGER, INTEGER) IS 'Paginated log stream for a pipeline run with optional level filter. Ordered by insertion sequence.';
;

CREATE OR REPLACE FUNCTION execution.fn_list_orchestrator_runs(p_project_id uuid DEFAULT NULL::uuid, p_orch_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_trigger_type text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE(orch_run_id uuid, orchestrator_name text, orch_id uuid, project_id uuid, project_name text, run_status text, trigger_type text, start_dtm timestamp with time zone, end_dtm timestamp with time zone, duration_ms integer, error_message text, retry_count integer)
LANGUAGE sql STABLE AS $$
    SELECT
        orch.orch_run_id,
        o.orch_display_name                 AS orchestrator_name,
        orch.orch_id,
        o.project_id,
        proj.project_display_name           AS project_name,
        orch.run_status_code,
        orch.trigger_type_code,
        orch.start_dtm,
        orch.end_dtm,
        orch.run_duration_ms,
        orch.error_message_text,
        orch.retry_count_num
    FROM execution.orchestrator_runs orch
    LEFT JOIN catalog.orchestrators o ON o.orch_id    = orch.orch_id
    LEFT JOIN etl.projects proj       ON proj.project_id = o.project_id
    WHERE (p_project_id   IS NULL OR o.project_id         = p_project_id)
      AND (p_orch_id      IS NULL OR orch.orch_id          = p_orch_id)
      AND (p_status       IS NULL OR orch.run_status_code  = p_status)
      AND (p_trigger_type IS NULL OR orch.trigger_type_code = p_trigger_type)
    ORDER BY orch.start_dtm DESC NULLS LAST, orch.created_dtm DESC
    LIMIT  GREATEST(COALESCE(p_limit,  50), 1)
    OFFSET GREATEST(COALESCE(p_offset,  0), 0);
$$;
COMMENT ON FUNCTION execution.fn_list_orchestrator_runs(uuid, uuid, text, text, integer, integer) IS 'Paginated orchestrator-run list with optional project/orchestrator/status/trigger filters.';
;

CREATE OR REPLACE FUNCTION execution.fn_count_orchestrator_runs(p_project_id uuid DEFAULT NULL::uuid, p_orch_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_trigger_type text DEFAULT NULL::text)
RETURNS bigint LANGUAGE sql STABLE AS $$
    SELECT COUNT(*)
    FROM execution.orchestrator_runs orch
    LEFT JOIN catalog.orchestrators o ON o.orch_id = orch.orch_id
    WHERE (p_project_id   IS NULL OR o.project_id         = p_project_id)
      AND (p_orch_id      IS NULL OR orch.orch_id          = p_orch_id)
      AND (p_status       IS NULL OR orch.run_status_code  = p_status)
      AND (p_trigger_type IS NULL OR orch.trigger_type_code = p_trigger_type);
$$;
COMMENT ON FUNCTION execution.fn_count_orchestrator_runs(uuid, uuid, text, text) IS 'Returns total row count for orchestrator-run list with same filter set as fn_list_orchestrator_runs.';
;

CREATE OR REPLACE FUNCTION execution.fn_get_orchestrator_run_detail(p_orch_run_id uuid)
RETURNS TABLE (
    orch_run_id              uuid,
    orch_id                  uuid,
    orch_display_name        text,
    project_id               uuid,
    project_display_name     text,
    run_status_code          text,
    trigger_type_code        text,
    triggered_by_user_id     uuid,
    submitted_by_full_name   text,
    start_dtm                timestamp with time zone,
    end_dtm                  timestamp with time zone,
    run_duration_ms          integer,
    error_message_text       text,
    retry_count_num          integer,
    env_display_name         text,
    run_options_json         jsonb,
    created_dtm              timestamp with time zone
)
LANGUAGE sql STABLE AS $$
    SELECT
        orr.orch_run_id,
        orr.orch_id,
        o.orch_display_name,
        o.project_id,
        proj.project_display_name,
        orr.run_status_code,
        orr.trigger_type_code,
        orr.triggered_by_user_id,
        u.user_full_name         AS submitted_by_full_name,
        orr.start_dtm,
        orr.end_dtm,
        orr.run_duration_ms,
        orr.error_message_text,
        orr.retry_count_num,
        e.env_display_name,
        orr.run_options_json,
        orr.created_dtm
    FROM execution.orchestrator_runs orr
    JOIN catalog.orchestrators o  ON orr.orch_id   = o.orch_id
    JOIN etl.projects proj        ON o.project_id  = proj.project_id
    LEFT JOIN etl.users u         ON orr.triggered_by_user_id = u.user_id
    LEFT JOIN execution.environments e ON orr.env_id = e.env_id
    WHERE orr.orch_run_id = p_orch_run_id;
$$;
COMMENT ON FUNCTION execution.fn_get_orchestrator_run_detail(uuid) IS 'Returns the full detail record for a single orchestrator run with resolved display names including environment.';
;

CREATE OR REPLACE FUNCTION execution.fn_get_orchestrator_run_pipeline_map(p_orch_run_id uuid)
RETURNS TABLE (
    pipeline_run_id      uuid,
    pipeline_id          uuid,
    pipeline_display_name text,
    dag_node_id_text     text,
    execution_order_num  integer,
    run_status_code      text,
    start_dtm            timestamp with time zone,
    end_dtm              timestamp with time zone,
    run_duration_ms      integer,
    error_message_text   text
)
LANGUAGE sql STABLE AS $$
    SELECT
        pr.pipeline_run_id,
        pr.pipeline_id,
        p.pipeline_display_name,
        m.dag_node_id_text,
        m.execution_order_num,
        pr.run_status_code,
        pr.start_dtm,
        pr.end_dtm,
        pr.run_duration_ms,
        pr.error_message_text
    FROM execution.orchestrator_pipeline_run_map m
    JOIN execution.pipeline_runs pr  ON m.pipeline_run_id = pr.pipeline_run_id
    JOIN catalog.pipelines       p   ON pr.pipeline_id    = p.pipeline_id
    WHERE m.orch_run_id = p_orch_run_id
    ORDER BY m.execution_order_num, pr.start_dtm NULLS LAST;
$$;
COMMENT ON FUNCTION execution.fn_get_orchestrator_run_pipeline_map(uuid) IS 'Returns all pipeline runs spawned within a given orchestrator run with DAG position and status.';
;

CREATE OR REPLACE PROCEDURE execution.pr_retry_pipeline_run(IN p_original_run_id uuid, IN p_user_id uuid, OUT p_new_run_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
    v_pipeline_id UUID;
    v_version_id  UUID;
    v_retry_count INTEGER;
BEGIN
    SELECT pipeline_id, version_id, retry_count_num
    INTO v_pipeline_id, v_version_id, v_retry_count
    FROM execution.pipeline_runs
    WHERE pipeline_run_id = p_original_run_id;

    IF v_pipeline_id IS NULL THEN
        RAISE EXCEPTION 'Pipeline run not found' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO execution.pipeline_runs
        (pipeline_id, version_id, run_status_code, trigger_type_code,
         triggered_by_user_id, retry_count_num)
    VALUES
        (v_pipeline_id, v_version_id, 'PENDING', 'MANUAL',
         p_user_id, COALESCE(v_retry_count, 0) + 1)
    RETURNING pipeline_run_id INTO p_new_run_id;
END;
$$;
COMMENT ON PROCEDURE execution.pr_retry_pipeline_run(uuid, uuid, uuid) IS 'Creates a new PENDING pipeline run as a retry of the given original run. Increments retry_count_num. Returns the new run ID via OUT param.';
;

CREATE OR REPLACE PROCEDURE execution.pr_retry_orchestrator_run(IN p_original_run_id uuid, IN p_user_id uuid, OUT p_new_run_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
    v_orch_id     UUID;
    v_retry_count INTEGER;
BEGIN
    SELECT orch_id, retry_count_num
    INTO v_orch_id, v_retry_count
    FROM execution.orchestrator_runs
    WHERE orch_run_id = p_original_run_id;

    IF v_orch_id IS NULL THEN
        RAISE EXCEPTION 'Orchestrator run not found' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO execution.orchestrator_runs
        (orch_id, run_status_code, trigger_type_code,
         triggered_by_user_id, retry_count_num)
    VALUES
        (v_orch_id, 'PENDING', 'MANUAL',
         p_user_id, COALESCE(v_retry_count, 0) + 1)
    RETURNING orch_run_id INTO p_new_run_id;
END;
$$;
COMMENT ON PROCEDURE execution.pr_retry_orchestrator_run(uuid, uuid, uuid) IS 'Creates a new PENDING orchestrator run as a retry of the given original. Increments retry_count_num. Returns new run ID via OUT param.';
;

COMMIT;
