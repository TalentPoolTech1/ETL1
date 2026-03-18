-- 004_add_run_options_support.sql
-- Persists user-selected run options for pipeline/orchestrator runs.

BEGIN;

ALTER TABLE execution.pipeline_runs
    ADD COLUMN IF NOT EXISTS run_options_json JSONB;

COMMENT ON COLUMN execution.pipeline_runs.run_options_json
IS 'Optional run-time options payload captured at trigger time (e.g., environment, technology, overrides).';

ALTER TABLE execution.orchestrator_runs
    ADD COLUMN IF NOT EXISTS run_options_json JSONB;

COMMENT ON COLUMN execution.orchestrator_runs.run_options_json
IS 'Optional run-time options payload captured at trigger time (e.g., environment, concurrency, execution flags).';

CREATE OR REPLACE PROCEDURE execution.pr_set_pipeline_run_options(
    p_pipeline_run_id UUID,
    p_run_options_json JSONB
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE execution.pipeline_runs
    SET run_options_json = p_run_options_json
    WHERE pipeline_run_id = p_pipeline_run_id;
END;
$$;

COMMENT ON PROCEDURE execution.pr_set_pipeline_run_options(UUID, JSONB)
IS 'Stores the original trigger-time options payload for a pipeline run.';

CREATE OR REPLACE PROCEDURE execution.pr_set_orchestrator_run_options(
    p_orch_run_id UUID,
    p_run_options_json JSONB
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE execution.orchestrator_runs
    SET run_options_json = p_run_options_json
    WHERE orch_run_id = p_orch_run_id;
END;
$$;

COMMENT ON PROCEDURE execution.pr_set_orchestrator_run_options(UUID, JSONB)
IS 'Stores the original trigger-time options payload for an orchestrator run.';

COMMIT;
