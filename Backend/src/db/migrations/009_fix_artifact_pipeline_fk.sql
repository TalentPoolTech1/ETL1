-- =============================================================================
-- Migration: 009_fix_artifact_pipeline_fk.sql
-- Drop the FK on generated_artifacts.pipeline_id that references the legacy
-- public.pipelines table.  New pipelines are stored in catalog.pipelines so the
-- FK caused a constraint violation on every generate call.  The relationship is
-- enforced at the application layer — catalog.fn_get_pipeline_codegen_source()
-- is called before inserting the artifact.
-- =============================================================================

ALTER TABLE generated_artifacts
  DROP CONSTRAINT IF EXISTS generated_artifacts_pipeline_id_fkey;
