-- 002_global_pipelines_orchestrators.sql
-- Allows pipelines and orchestrators to exist without a project (global/shared assets).
-- project_id NULL = global; project_id NOT NULL = project-scoped (existing behaviour).

BEGIN;

ALTER TABLE catalog.pipelines
    ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE catalog.orchestrators
    ALTER COLUMN project_id DROP NOT NULL;

COMMENT ON COLUMN catalog.pipelines.project_id
    IS 'FK to the owning project. NULL for global (cross-project) pipelines.';

COMMENT ON COLUMN catalog.orchestrators.project_id
    IS 'FK to the owning project. NULL for global (cross-project) orchestrators.';

COMMIT;
