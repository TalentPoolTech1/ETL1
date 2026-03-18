-- Asset permissions helper routines for pipeline/orchestrator permission endpoints.

BEGIN;

CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_permission_context(p_pipeline_id UUID)
RETURNS TABLE (
  pipeline_id UUID,
  project_id UUID
)
LANGUAGE sql
STABLE
AS $$
  SELECT p.pipeline_id, p.project_id
  FROM catalog.pipelines p
  WHERE p.pipeline_id = p_pipeline_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_permission_context(UUID) IS 'Returns minimal permission context for a pipeline (exists + owning project_id).';

CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_permission_grants(p_pipeline_id UUID)
RETURNS TABLE (
  project_id UUID,
  user_id UUID,
  role_id UUID,
  user_full_name TEXT,
  email_address TEXT,
  role_display_name TEXT,
  granted_dtm TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.project_id,
    pur.user_id,
    pur.role_id,
    u.user_full_name,
    u.email_address,
    r.role_display_name,
    pur.granted_dtm
  FROM catalog.pipelines p
  JOIN gov.project_user_roles pur ON pur.project_id = p.project_id
  JOIN etl.users u ON u.user_id = pur.user_id
  JOIN gov.roles r ON r.role_id = pur.role_id
  WHERE p.pipeline_id = p_pipeline_id
  ORDER BY u.user_full_name, r.role_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_permission_grants(UUID) IS 'Returns effective project-scoped grants for a pipeline by resolving the pipeline project_id and joining gov.project_user_roles with user and role labels.';

CREATE OR REPLACE PROCEDURE catalog.pr_grant_pipeline_permission(
  p_pipeline_id UUID,
  p_user_id UUID,
  p_role_id UUID,
  p_granted_by_user_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT p.project_id INTO v_project_id
  FROM catalog.pipelines p
  WHERE p.pipeline_id = p_pipeline_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline is not project-scoped or does not exist'
      USING ERRCODE = 'P0002';
  END IF;

  CALL gov.pr_grant_project_user_role(v_project_id, p_user_id, p_role_id, p_granted_by_user_id);
END;
$$;
COMMENT ON PROCEDURE catalog.pr_grant_pipeline_permission(UUID, UUID, UUID, UUID) IS 'Grants a project-scoped role for the pipeline parent project; used by pipeline permissions UI.';

CREATE OR REPLACE PROCEDURE catalog.pr_revoke_pipeline_permission(
  p_pipeline_id UUID,
  p_user_id UUID,
  p_role_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT p.project_id INTO v_project_id
  FROM catalog.pipelines p
  WHERE p.pipeline_id = p_pipeline_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline is not project-scoped or does not exist'
      USING ERRCODE = 'P0002';
  END IF;

  CALL gov.pr_revoke_project_user_role(v_project_id, p_user_id, p_role_id);
END;
$$;
COMMENT ON PROCEDURE catalog.pr_revoke_pipeline_permission(UUID, UUID, UUID) IS 'Revokes a project-scoped role assignment for the pipeline parent project.';

CREATE OR REPLACE FUNCTION catalog.fn_get_orchestrator_permission_grants(p_orch_id UUID)
RETURNS TABLE (
  project_id UUID,
  user_id UUID,
  role_id UUID,
  user_full_name TEXT,
  email_address TEXT,
  role_display_name TEXT,
  granted_dtm TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    o.project_id,
    pur.user_id,
    pur.role_id,
    u.user_full_name,
    u.email_address,
    r.role_display_name,
    pur.granted_dtm
  FROM catalog.orchestrators o
  JOIN gov.project_user_roles pur ON pur.project_id = o.project_id
  JOIN etl.users u ON u.user_id = pur.user_id
  JOIN gov.roles r ON r.role_id = pur.role_id
  WHERE o.orch_id = p_orch_id
  ORDER BY u.user_full_name, r.role_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_orchestrator_permission_grants(UUID) IS 'Returns effective project-scoped grants for an orchestrator by resolving its parent project.';

CREATE OR REPLACE PROCEDURE catalog.pr_grant_orchestrator_permission(
  p_orch_id UUID,
  p_user_id UUID,
  p_role_id UUID,
  p_granted_by_user_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT o.project_id INTO v_project_id
  FROM catalog.orchestrators o
  WHERE o.orch_id = p_orch_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Orchestrator is not project-scoped or does not exist'
      USING ERRCODE = 'P0002';
  END IF;

  CALL gov.pr_grant_project_user_role(v_project_id, p_user_id, p_role_id, p_granted_by_user_id);
END;
$$;
COMMENT ON PROCEDURE catalog.pr_grant_orchestrator_permission(UUID, UUID, UUID, UUID) IS 'Grants a project-scoped role for the orchestrator parent project; used by orchestrator permissions UI.';

CREATE OR REPLACE PROCEDURE catalog.pr_revoke_orchestrator_permission(
  p_orch_id UUID,
  p_user_id UUID,
  p_role_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT o.project_id INTO v_project_id
  FROM catalog.orchestrators o
  WHERE o.orch_id = p_orch_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Orchestrator is not project-scoped or does not exist'
      USING ERRCODE = 'P0002';
  END IF;

  CALL gov.pr_revoke_project_user_role(v_project_id, p_user_id, p_role_id);
END;
$$;
COMMENT ON PROCEDURE catalog.pr_revoke_orchestrator_permission(UUID, UUID, UUID) IS 'Revokes a project-scoped role assignment for the orchestrator parent project.';

COMMIT;
