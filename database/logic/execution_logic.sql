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
COMMIT;
