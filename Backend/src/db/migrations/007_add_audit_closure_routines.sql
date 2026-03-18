-- 007_add_audit_closure_routines.sql
-- Adds helper routines to close remaining implementation-audit gaps.

BEGIN;

DROP FUNCTION IF EXISTS catalog.fn_list_pipelines(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS catalog.fn_get_pipeline_by_id(UUID);
DROP PROCEDURE IF EXISTS catalog.pr_update_pipeline_metadata(UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS catalog.fn_get_pipeline_codegen_source(UUID);
DROP FUNCTION IF EXISTS catalog.fn_get_pipeline_lineage_edges(UUID);

DROP FUNCTION IF EXISTS catalog.fn_get_connection_usage(UUID);
DROP FUNCTION IF EXISTS catalog.fn_get_connection_history(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS gov.fn_get_connector_access_grants(UUID);
DROP PROCEDURE IF EXISTS gov.pr_revoke_connector_access(UUID, UUID, UUID);

DROP FUNCTION IF EXISTS gov.fn_get_role_detail(UUID);
DROP FUNCTION IF EXISTS gov.fn_get_role_members(UUID);
DROP FUNCTION IF EXISTS gov.fn_get_role_permission_map(UUID);
DROP FUNCTION IF EXISTS gov.fn_get_permissions();
DROP FUNCTION IF EXISTS gov.fn_get_project_user_role_grants(UUID);
DROP PROCEDURE IF EXISTS gov.pr_revoke_project_user_membership(UUID, UUID);
DROP PROCEDURE IF EXISTS gov.pr_update_role_profile(UUID, TEXT, TEXT);
DROP PROCEDURE IF EXISTS gov.pr_replace_role_permissions(UUID, UUID[]);

DROP FUNCTION IF EXISTS catalog.fn_get_metadata_tree(TEXT);
DROP FUNCTION IF EXISTS catalog.fn_get_metadata_profile(UUID);
DROP FUNCTION IF EXISTS catalog.fn_get_metadata_lineage(UUID);
DROP FUNCTION IF EXISTS catalog.fn_get_metadata_history(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS catalog.fn_get_metadata_permissions(UUID);
DROP PROCEDURE IF EXISTS catalog.pr_mark_dataset_refreshed(UUID, UUID);

DROP FUNCTION IF EXISTS execution.fn_get_orchestrator_run_detail(UUID);
DROP FUNCTION IF EXISTS execution.fn_get_orchestrator_run_pipeline_map(UUID);

-- ============================================================================
-- Pipeline helper routines
-- ============================================================================

CREATE OR REPLACE FUNCTION catalog.fn_list_pipelines(
    p_project_id UUID DEFAULT NULL,
    p_search_text TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 200,
    p_offset INTEGER DEFAULT 0,
    p_order_by TEXT DEFAULT 'updated_dtm',
    p_order_dir TEXT DEFAULT 'DESC'
)
RETURNS TABLE (
    pipeline_id UUID,
    project_id UUID,
    folder_id UUID,
    pipeline_display_name TEXT,
    pipeline_desc_text TEXT,
    active_version_id UUID,
    created_dtm TIMESTAMPTZ,
    updated_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    WITH filtered AS (
        SELECT
            p.pipeline_id,
            p.project_id,
            p.folder_id,
            p.pipeline_display_name,
            p.pipeline_desc_text,
            p.active_version_id,
            p.created_dtm,
            p.updated_dtm
        FROM catalog.pipelines p
        WHERE (p_project_id IS NULL OR p.project_id = p_project_id)
          AND (
                p_search_text IS NULL
                OR p.pipeline_display_name ILIKE '%' || p_search_text || '%'
                OR COALESCE(p.pipeline_desc_text, '') ILIKE '%' || p_search_text || '%'
          )
    )
    SELECT
        f.pipeline_id,
        f.project_id,
        f.folder_id,
        f.pipeline_display_name,
        f.pipeline_desc_text,
        f.active_version_id,
        f.created_dtm,
        f.updated_dtm
    FROM filtered f
    ORDER BY
        CASE WHEN lower(p_order_by) = 'pipeline_display_name' AND upper(p_order_dir) = 'ASC' THEN f.pipeline_display_name END ASC NULLS LAST,
        CASE WHEN lower(p_order_by) = 'pipeline_display_name' AND upper(p_order_dir) = 'DESC' THEN f.pipeline_display_name END DESC NULLS LAST,
        CASE WHEN lower(p_order_by) = 'created_dtm' AND upper(p_order_dir) = 'ASC' THEN f.created_dtm END ASC NULLS LAST,
        CASE WHEN lower(p_order_by) = 'created_dtm' AND upper(p_order_dir) = 'DESC' THEN f.created_dtm END DESC NULLS LAST,
        CASE WHEN lower(p_order_by) = 'updated_dtm' AND upper(p_order_dir) = 'ASC' THEN f.updated_dtm END ASC NULLS LAST,
        CASE WHEN lower(p_order_by) = 'updated_dtm' AND upper(p_order_dir) = 'DESC' THEN f.updated_dtm END DESC NULLS LAST,
        f.updated_dtm DESC
    LIMIT GREATEST(COALESCE(p_limit, 200), 1)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;
COMMENT ON FUNCTION catalog.fn_list_pipelines(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT)
IS 'Returns pipeline summaries with safe project/search/order/limit handling for API list screens.';

CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_by_id(p_pipeline_id UUID)
RETURNS TABLE (
    pipeline_id UUID,
    project_id UUID,
    folder_id UUID,
    pipeline_display_name TEXT,
    pipeline_desc_text TEXT,
    active_version_id UUID,
    created_dtm TIMESTAMPTZ,
    updated_dtm TIMESTAMPTZ,
    ir_payload_json JSONB,
    ui_layout_json JSONB
)
LANGUAGE sql STABLE AS $$
    SELECT
        p.pipeline_id,
        p.project_id,
        p.folder_id,
        p.pipeline_display_name,
        p.pipeline_desc_text,
        p.active_version_id,
        p.created_dtm,
        p.updated_dtm,
        pc.ir_payload_json,
        pc.ui_layout_json
    FROM catalog.pipelines p
    LEFT JOIN catalog.pipeline_versions pv ON pv.version_id = p.active_version_id
    LEFT JOIN catalog.pipeline_contents pc ON pc.version_id = pv.version_id
    WHERE p.pipeline_id = p_pipeline_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_by_id(UUID)
IS 'Returns one pipeline with active IR/body payload for designer load paths.';

CREATE OR REPLACE PROCEDURE catalog.pr_update_pipeline_metadata(
    p_pipeline_id UUID,
    p_pipeline_display_name TEXT,
    p_pipeline_desc_text TEXT,
    p_updated_by_user_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE catalog.pipelines
    SET
        pipeline_display_name = COALESCE(NULLIF(TRIM(p_pipeline_display_name), ''), pipeline_display_name),
        pipeline_desc_text = COALESCE(p_pipeline_desc_text, pipeline_desc_text),
        updated_by_user_id = p_updated_by_user_id,
        updated_dtm = CURRENT_TIMESTAMP
    WHERE pipeline_id = p_pipeline_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pipeline not found'
            USING ERRCODE = 'P0002';
    END IF;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_update_pipeline_metadata(UUID, TEXT, TEXT, UUID)
IS 'Updates pipeline display metadata only; raises P0002 when pipeline_id does not exist.';

CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_codegen_source(p_pipeline_id UUID)
RETURNS TABLE (
    pipeline_id UUID,
    pipeline_display_name TEXT,
    pipeline_desc_text TEXT,
    version_id UUID,
    version_num_seq INTEGER,
    release_tag_label TEXT,
    ir_payload_json JSONB,
    ui_layout_json JSONB
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
COMMENT ON FUNCTION catalog.fn_get_pipeline_codegen_source(UUID)
IS 'Returns active version payload used by validation/code-generation endpoints.';

CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_lineage_edges(p_pipeline_id UUID)
RETURNS TABLE (
    from_pipeline_id UUID,
    from_pipeline_display_name TEXT,
    to_pipeline_id UUID,
    to_pipeline_display_name TEXT
)
LANGUAGE sql STABLE AS $$
    WITH upstream_edges AS (
        SELECT DISTINCT
            up.pipeline_id AS from_pipeline_id,
            up_p.pipeline_display_name AS from_pipeline_display_name,
            cur.pipeline_id AS to_pipeline_id,
            cur_p.pipeline_display_name AS to_pipeline_display_name
        FROM catalog.pipeline_dataset_map cur
        JOIN catalog.pipelines cur_p
          ON cur_p.pipeline_id = cur.pipeline_id
         AND cur_p.active_version_id = cur.version_id
        JOIN catalog.pipeline_dataset_map up
          ON up.dataset_id = cur.dataset_id
        JOIN catalog.pipelines up_p
          ON up_p.pipeline_id = up.pipeline_id
         AND up_p.active_version_id = up.version_id
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
        JOIN catalog.pipelines cur_p
          ON cur_p.pipeline_id = cur.pipeline_id
         AND cur_p.active_version_id = cur.version_id
        JOIN catalog.pipeline_dataset_map dn
          ON dn.dataset_id = cur.dataset_id
        JOIN catalog.pipelines dn_p
          ON dn_p.pipeline_id = dn.pipeline_id
         AND dn_p.active_version_id = dn.version_id
        WHERE cur.pipeline_id = p_pipeline_id
          AND cur.access_mode_code IN ('WRITE', 'READ_WRITE')
          AND dn.access_mode_code IN ('READ', 'READ_WRITE')
          AND dn.pipeline_id <> cur.pipeline_id
    )
    SELECT * FROM upstream_edges
    UNION
    SELECT * FROM downstream_edges;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_lineage_edges(UUID)
IS 'Builds pipeline-level upstream/downstream lineage edges from active pipeline_dataset_map rows.';

-- ============================================================================
-- Connection helper routines
-- ============================================================================

CREATE OR REPLACE FUNCTION catalog.fn_get_connection_usage(p_connector_id UUID)
RETURNS TABLE (
    usage_type_code TEXT,
    object_id UUID,
    object_display_name TEXT,
    context_text TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT
        'DATASET'::TEXT AS usage_type_code,
        d.dataset_id AS object_id,
        CONCAT_WS('.', d.db_name_text, d.schema_name_text, d.table_name_text) AS object_display_name,
        'Registered dataset'::TEXT AS context_text
    FROM catalog.datasets d
    WHERE d.connector_id = p_connector_id

    UNION ALL

    SELECT DISTINCT
        'PIPELINE'::TEXT AS usage_type_code,
        p.pipeline_id AS object_id,
        p.pipeline_display_name AS object_display_name,
        CONCAT('Dataset access: ', dm.access_mode_code) AS context_text
    FROM catalog.pipeline_dataset_map dm
    JOIN catalog.pipelines p
      ON p.pipeline_id = dm.pipeline_id
     AND p.active_version_id = dm.version_id
    JOIN catalog.datasets d
      ON d.dataset_id = dm.dataset_id
    WHERE d.connector_id = p_connector_id

    UNION ALL

    SELECT DISTINCT
        'ORCHESTRATOR'::TEXT AS usage_type_code,
        o.orch_id AS object_id,
        o.orch_display_name AS object_display_name,
        'Includes dependent pipeline'::TEXT AS context_text
    FROM catalog.orchestrator_pipeline_map opm
    JOIN catalog.orchestrators o
      ON o.orch_id = opm.orch_id
    JOIN catalog.pipeline_dataset_map dm
      ON dm.pipeline_id = opm.pipeline_id
    JOIN catalog.pipelines p
      ON p.pipeline_id = dm.pipeline_id
     AND p.active_version_id = dm.version_id
    JOIN catalog.datasets d
      ON d.dataset_id = dm.dataset_id
    WHERE d.connector_id = p_connector_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_connection_usage(UUID)
IS 'Returns datasets, pipelines, and orchestrators that currently depend on the connector.';

CREATE OR REPLACE FUNCTION catalog.fn_get_connection_history(
    p_connector_id UUID,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    history_id TEXT,
    action_code TEXT,
    action_dtm TIMESTAMPTZ,
    action_by UUID,
    detail_text TEXT,
    test_passed_flag BOOLEAN,
    response_time_ms INTEGER,
    error_message_text TEXT
)
LANGUAGE sql STABLE AS $$
    WITH combined AS (
        SELECT
            h.hist_id::TEXT AS history_id,
            h.hist_action_cd::TEXT AS action_code,
            h.hist_action_dtm AS action_dtm,
            h.hist_action_by AS action_by,
            COALESCE(h.connector_display_name, 'Connector change') AS detail_text,
            NULL::BOOLEAN AS test_passed_flag,
            NULL::INTEGER AS response_time_ms,
            NULL::TEXT AS error_message_text
        FROM history.connectors_history h
        WHERE h.connector_id = p_connector_id

        UNION ALL

        SELECT
            t.test_result_id::TEXT AS history_id,
            'TEST'::TEXT AS action_code,
            t.tested_dtm AS action_dtm,
            t.tested_by_user_id AS action_by,
            'Connection test executed'::TEXT AS detail_text,
            t.test_passed_flag,
            t.response_time_ms,
            t.error_message_text
        FROM catalog.connection_test_results t
        WHERE t.connector_id = p_connector_id
    )
    SELECT
        c.history_id,
        c.action_code,
        c.action_dtm,
        c.action_by,
        c.detail_text,
        c.test_passed_flag,
        c.response_time_ms,
        c.error_message_text
    FROM combined c
    ORDER BY c.action_dtm DESC
    LIMIT GREATEST(COALESCE(p_limit, 100), 1)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;
COMMENT ON FUNCTION catalog.fn_get_connection_history(UUID, INTEGER, INTEGER)
IS 'Returns connector row-history plus explicit connection-test events in one timeline.';

CREATE OR REPLACE FUNCTION gov.fn_get_connector_access_grants(p_connector_id UUID)
RETURNS TABLE (
    access_id UUID,
    user_id UUID,
    role_id UUID,
    user_full_name TEXT,
    email_address TEXT,
    role_display_name TEXT,
    granted_dtm TIMESTAMPTZ,
    granted_by_user_id UUID
)
LANGUAGE sql STABLE AS $$
    SELECT
        ca.access_id,
        ca.user_id,
        ca.role_id,
        u.user_full_name,
        u.email_address,
        r.role_display_name,
        ca.granted_dtm,
        ca.granted_by_user_id
    FROM gov.connector_access ca
    LEFT JOIN etl.users u ON u.user_id = ca.user_id
    LEFT JOIN gov.roles r ON r.role_id = ca.role_id
    WHERE ca.connector_id = p_connector_id
    ORDER BY ca.granted_dtm DESC;
$$;
COMMENT ON FUNCTION gov.fn_get_connector_access_grants(UUID)
IS 'Lists connector-access grants with resolved user/role labels.';

CREATE OR REPLACE PROCEDURE gov.pr_revoke_connector_access(
    p_connector_id UUID,
    p_user_id UUID,
    p_role_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM gov.connector_access ca
    WHERE ca.connector_id = p_connector_id
      AND ((p_user_id IS NULL AND ca.user_id IS NULL) OR ca.user_id = p_user_id)
      AND ((p_role_id IS NULL AND ca.role_id IS NULL) OR ca.role_id = p_role_id);
END;
$$;
COMMENT ON PROCEDURE gov.pr_revoke_connector_access(UUID, UUID, UUID)
IS 'Revokes a connector-access grant using the same subject tuple used for grant creation.';

-- ============================================================================
-- Governance role helper routines
-- ============================================================================

CREATE OR REPLACE FUNCTION gov.fn_get_role_detail(p_role_id UUID)
RETURNS TABLE (
    role_id UUID,
    role_display_name TEXT,
    role_desc_text TEXT,
    is_system_role_flag BOOLEAN,
    created_dtm TIMESTAMPTZ,
    member_count BIGINT
)
LANGUAGE sql STABLE AS $$
    SELECT
        r.role_id,
        r.role_display_name,
        r.role_desc_text,
        r.is_system_role_flag,
        r.created_dtm,
        COUNT(ur.user_id) AS member_count
    FROM gov.roles r
    LEFT JOIN gov.user_roles ur ON ur.role_id = r.role_id
    WHERE r.role_id = p_role_id
    GROUP BY r.role_id;
$$;
COMMENT ON FUNCTION gov.fn_get_role_detail(UUID)
IS 'Returns role profile and current member count.';

CREATE OR REPLACE FUNCTION gov.fn_get_role_members(p_role_id UUID)
RETURNS TABLE (
    user_id UUID,
    user_full_name TEXT,
    email_address TEXT,
    is_account_active BOOLEAN,
    granted_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        u.user_id,
        u.user_full_name,
        u.email_address,
        u.is_account_active,
        NULL::TIMESTAMPTZ AS granted_dtm
    FROM gov.user_roles ur
    JOIN etl.users u ON u.user_id = ur.user_id
    WHERE ur.role_id = p_role_id
    ORDER BY u.user_full_name;
$$;
COMMENT ON FUNCTION gov.fn_get_role_members(UUID)
IS 'Returns users currently assigned to the role.';

CREATE OR REPLACE FUNCTION gov.fn_get_role_permission_map(p_role_id UUID)
RETURNS TABLE (
    permission_id UUID,
    perm_code_name TEXT,
    perm_display_name TEXT,
    perm_desc_text TEXT,
    is_assigned BOOLEAN
)
LANGUAGE sql STABLE AS $$
    SELECT
        p.permission_id,
        p.perm_code_name,
        p.perm_display_name,
        p.perm_desc_text,
        (rp.role_id IS NOT NULL) AS is_assigned
    FROM gov.permissions p
    LEFT JOIN gov.role_permissions rp
      ON rp.permission_id = p.permission_id
     AND rp.role_id = p_role_id
    ORDER BY p.perm_code_name;
$$;
COMMENT ON FUNCTION gov.fn_get_role_permission_map(UUID)
IS 'Returns full permission catalog with assignment flag for a specific role.';

CREATE OR REPLACE FUNCTION gov.fn_get_permissions()
RETURNS TABLE (
    permission_id UUID,
    perm_code_name TEXT,
    perm_display_name TEXT,
    perm_desc_text TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT
        p.permission_id,
        p.perm_code_name,
        p.perm_display_name,
        p.perm_desc_text
    FROM gov.permissions p
    ORDER BY p.perm_code_name;
$$;
COMMENT ON FUNCTION gov.fn_get_permissions()
IS 'Returns the full permission catalog for governance-management surfaces.';

CREATE OR REPLACE FUNCTION gov.fn_get_project_user_role_grants(p_project_id UUID)
RETURNS TABLE (
    project_id UUID,
    user_id UUID,
    user_full_name TEXT,
    email_address TEXT,
    role_id UUID,
    role_display_name TEXT,
    granted_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        pur.project_id,
        pur.user_id,
        u.user_full_name,
        u.email_address,
        pur.role_id,
        r.role_display_name,
        pur.granted_dtm
    FROM gov.project_user_roles pur
    JOIN etl.users u ON u.user_id = pur.user_id
    JOIN gov.roles r ON r.role_id = pur.role_id
    WHERE pur.project_id = p_project_id
    ORDER BY u.user_full_name, r.role_display_name;
$$;
COMMENT ON FUNCTION gov.fn_get_project_user_role_grants(UUID)
IS 'Returns project-scoped role grants with user and role labels.';

CREATE OR REPLACE PROCEDURE gov.pr_revoke_project_user_membership(
    p_project_id UUID,
    p_user_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM gov.project_user_roles
    WHERE project_id = p_project_id
      AND user_id = p_user_id;
END;
$$;
COMMENT ON PROCEDURE gov.pr_revoke_project_user_membership(UUID, UUID)
IS 'Revokes all project-scoped role grants for a user in a project.';

CREATE OR REPLACE PROCEDURE gov.pr_update_role_profile(
    p_role_id UUID,
    p_role_display_name TEXT,
    p_role_desc_text TEXT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_is_system BOOLEAN;
BEGIN
    SELECT r.is_system_role_flag
    INTO v_is_system
    FROM gov.roles r
    WHERE r.role_id = p_role_id;

    IF v_is_system IS NULL THEN
        RAISE EXCEPTION 'Role not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_is_system
       AND p_role_display_name IS NOT NULL
       AND NULLIF(TRIM(p_role_display_name), '') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM gov.roles r
           WHERE r.role_id = p_role_id
             AND r.role_display_name <> TRIM(p_role_display_name)
       ) THEN
        RAISE EXCEPTION 'System role name cannot be changed'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE gov.roles
    SET
        role_display_name = CASE
            WHEN v_is_system THEN role_display_name
            ELSE COALESCE(NULLIF(TRIM(p_role_display_name), ''), role_display_name)
        END,
        role_desc_text = COALESCE(p_role_desc_text, role_desc_text)
    WHERE role_id = p_role_id;
END;
$$;
COMMENT ON PROCEDURE gov.pr_update_role_profile(UUID, TEXT, TEXT)
IS 'Updates role name/description; system role names are immutable.';

CREATE OR REPLACE PROCEDURE gov.pr_replace_role_permissions(
    p_role_id UUID,
    p_permission_ids UUID[]
)
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM gov.roles r WHERE r.role_id = p_role_id) THEN
        RAISE EXCEPTION 'Role not found'
            USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM gov.role_permissions rp
    WHERE rp.role_id = p_role_id
      AND (
            p_permission_ids IS NULL
            OR array_length(p_permission_ids, 1) IS NULL
            OR rp.permission_id <> ALL(p_permission_ids)
      );

    IF p_permission_ids IS NULL OR array_length(p_permission_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO gov.role_permissions (role_id, permission_id)
    SELECT p_role_id, perm_id
    FROM unnest(p_permission_ids) AS perm_id
    ON CONFLICT DO NOTHING;
END;
$$;
COMMENT ON PROCEDURE gov.pr_replace_role_permissions(UUID, UUID[])
IS 'Replaces a role permission-set atomically using the provided permission UUID array.';

-- ============================================================================
-- Metadata helper routines
-- ============================================================================

CREATE OR REPLACE FUNCTION catalog.fn_get_metadata_tree(p_search_text TEXT DEFAULT NULL)
RETURNS TABLE (
    dataset_id UUID,
    connector_id UUID,
    connector_display_name TEXT,
    connector_type_code TEXT,
    db_name_text TEXT,
    schema_name_text TEXT,
    table_name_text TEXT,
    dataset_type_code TEXT,
    estimated_row_count_num BIGINT,
    last_introspection_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        d.dataset_id,
        d.connector_id,
        c.connector_display_name,
        c.connector_type_code,
        d.db_name_text,
        d.schema_name_text,
        d.table_name_text,
        d.dataset_type_code,
        d.estimated_row_count_num,
        d.last_introspection_dtm
    FROM catalog.datasets d
    JOIN catalog.connectors c ON c.connector_id = d.connector_id
    WHERE p_search_text IS NULL
       OR c.connector_display_name ILIKE '%' || p_search_text || '%'
       OR COALESCE(d.db_name_text, '') ILIKE '%' || p_search_text || '%'
       OR COALESCE(d.schema_name_text, '') ILIKE '%' || p_search_text || '%'
       OR COALESCE(d.table_name_text, '') ILIKE '%' || p_search_text || '%'
    ORDER BY c.connector_display_name, d.db_name_text, d.schema_name_text, d.table_name_text;
$$;
COMMENT ON FUNCTION catalog.fn_get_metadata_tree(TEXT)
IS 'Returns searchable dataset-catalog rows used to build the metadata browser tree.';

CREATE OR REPLACE FUNCTION catalog.fn_get_metadata_profile(p_dataset_id UUID)
RETURNS TABLE (
    dataset_id UUID,
    connector_id UUID,
    connector_display_name TEXT,
    connector_type_code TEXT,
    db_name_text TEXT,
    schema_name_text TEXT,
    table_name_text TEXT,
    dataset_type_code TEXT,
    estimated_row_count_num BIGINT,
    last_introspection_dtm TIMESTAMPTZ,
    classification_code TEXT,
    classification_notes_text TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT
        d.dataset_id,
        d.connector_id,
        c.connector_display_name,
        c.connector_type_code,
        d.db_name_text,
        d.schema_name_text,
        d.table_name_text,
        d.dataset_type_code,
        d.estimated_row_count_num,
        d.last_introspection_dtm,
        cls.sensitivity_code AS classification_code,
        cls.classification_notes_text
    FROM catalog.datasets d
    JOIN catalog.connectors c ON c.connector_id = d.connector_id
    LEFT JOIN LATERAL (
        SELECT
            dc.sensitivity_code,
            dc.classification_notes_text
        FROM gov.data_classifications dc
        WHERE dc.target_id = d.dataset_id
          AND UPPER(dc.target_type_code) = 'DATASET'
        ORDER BY dc.updated_dtm DESC NULLS LAST, dc.created_dtm DESC
        LIMIT 1
    ) cls ON TRUE
    WHERE d.dataset_id = p_dataset_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_metadata_profile(UUID)
IS 'Returns metadata profile summary for one dataset, including current classification.';

CREATE OR REPLACE FUNCTION catalog.fn_get_metadata_lineage(p_dataset_id UUID)
RETURNS TABLE (
    pipeline_id UUID,
    pipeline_display_name TEXT,
    access_mode_code TEXT,
    version_num_seq INTEGER
)
LANGUAGE sql STABLE AS $$
    SELECT
        x.pipeline_id,
        x.pipeline_display_name,
        x.access_mode_code,
        x.version_num_seq
    FROM catalog.fn_get_pipelines_impacted_by_dataset(p_dataset_id) x
    ORDER BY x.pipeline_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_metadata_lineage(UUID)
IS 'Returns active pipelines that read/write the selected dataset.';

CREATE OR REPLACE FUNCTION catalog.fn_get_metadata_history(
    p_dataset_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    hist_id BIGINT,
    hist_action_cd CHAR(1),
    hist_action_dtm TIMESTAMPTZ,
    hist_action_by UUID,
    schema_name_text TEXT,
    table_name_text TEXT,
    estimated_row_count_num BIGINT,
    last_introspection_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        h.hist_id,
        h.hist_action_cd,
        h.hist_action_dtm,
        h.hist_action_by,
        h.schema_name_text,
        h.table_name_text,
        h.estimated_row_count_num,
        h.last_introspection_dtm
    FROM history.datasets_history h
    WHERE h.dataset_id = p_dataset_id
    ORDER BY h.hist_action_dtm DESC
    LIMIT GREATEST(COALESCE(p_limit, 50), 1)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;
COMMENT ON FUNCTION catalog.fn_get_metadata_history(UUID, INTEGER, INTEGER)
IS 'Returns row-image history for dataset metadata changes.';

CREATE OR REPLACE FUNCTION catalog.fn_get_metadata_permissions(p_dataset_id UUID)
RETURNS TABLE (
    access_id UUID,
    user_id UUID,
    role_id UUID,
    user_full_name TEXT,
    email_address TEXT,
    role_display_name TEXT,
    granted_dtm TIMESTAMPTZ,
    granted_by_user_id UUID
)
LANGUAGE sql STABLE AS $$
    SELECT
        ca.access_id,
        ca.user_id,
        ca.role_id,
        u.user_full_name,
        u.email_address,
        r.role_display_name,
        ca.granted_dtm,
        ca.granted_by_user_id
    FROM catalog.datasets d
    JOIN gov.connector_access ca
      ON ca.connector_id = d.connector_id
    LEFT JOIN etl.users u ON u.user_id = ca.user_id
    LEFT JOIN gov.roles r ON r.role_id = ca.role_id
    WHERE d.dataset_id = p_dataset_id
    ORDER BY ca.granted_dtm DESC;
$$;
COMMENT ON FUNCTION catalog.fn_get_metadata_permissions(UUID)
IS 'Returns effective connector-level grants that govern dataset accessibility.';

CREATE OR REPLACE PROCEDURE catalog.pr_mark_dataset_refreshed(
    p_dataset_id UUID,
    p_updated_by_user_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE catalog.datasets
    SET
        last_introspection_dtm = CURRENT_TIMESTAMP,
        updated_dtm = CURRENT_TIMESTAMP,
        updated_by_user_id = p_updated_by_user_id
    WHERE dataset_id = p_dataset_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dataset not found'
            USING ERRCODE = 'P0002';
    END IF;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_mark_dataset_refreshed(UUID, UUID)
IS 'Marks dataset metadata as refreshed (timestamp update) for explicit UI refresh actions.';

-- ============================================================================
-- Orchestrator run detail helper routines
-- ============================================================================

CREATE OR REPLACE FUNCTION execution.fn_get_orchestrator_run_detail(p_orch_run_id UUID)
RETURNS TABLE (
    orch_run_id UUID,
    orch_id UUID,
    orch_display_name TEXT,
    project_id UUID,
    project_display_name TEXT,
    run_status_code TEXT,
    trigger_type_code TEXT,
    triggered_by_user_id UUID,
    submitted_by_full_name TEXT,
    start_dtm TIMESTAMPTZ,
    end_dtm TIMESTAMPTZ,
    run_duration_ms INTEGER,
    error_message_text TEXT,
    retry_count_num INTEGER,
    env_display_name TEXT,
    run_options_json JSONB,
    created_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        r.orch_run_id,
        r.orch_id,
        o.orch_display_name,
        o.project_id,
        p.project_display_name,
        r.run_status_code,
        r.trigger_type_code,
        r.triggered_by_user_id,
        u.user_full_name AS submitted_by_full_name,
        r.start_dtm,
        r.end_dtm,
        r.run_duration_ms,
        r.error_message_text,
        r.retry_count_num,
        e.env_display_name,
        r.run_options_json,
        r.created_dtm
    FROM execution.orchestrator_runs r
    JOIN catalog.orchestrators o ON o.orch_id = r.orch_id
    LEFT JOIN etl.projects p ON p.project_id = o.project_id
    LEFT JOIN etl.users u ON u.user_id = r.triggered_by_user_id
    LEFT JOIN execution.environments e ON e.env_id = r.env_id
    WHERE r.orch_run_id = p_orch_run_id;
$$;
COMMENT ON FUNCTION execution.fn_get_orchestrator_run_detail(UUID)
IS 'Returns one orchestrator-run detail record with project/user/environment labels.';

CREATE OR REPLACE FUNCTION execution.fn_get_orchestrator_run_pipeline_map(p_orch_run_id UUID)
RETURNS TABLE (
    pipeline_run_id UUID,
    pipeline_id UUID,
    pipeline_display_name TEXT,
    dag_node_id_text TEXT,
    execution_order_num INTEGER,
    run_status_code TEXT,
    start_dtm TIMESTAMPTZ,
    end_dtm TIMESTAMPTZ,
    run_duration_ms INTEGER,
    error_message_text TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT
        m.pipeline_run_id,
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
    JOIN execution.pipeline_runs pr ON pr.pipeline_run_id = m.pipeline_run_id
    JOIN catalog.pipelines p ON p.pipeline_id = pr.pipeline_id
    WHERE m.orch_run_id = p_orch_run_id
    ORDER BY m.execution_order_num, pr.start_dtm NULLS LAST;
$$;
COMMENT ON FUNCTION execution.fn_get_orchestrator_run_pipeline_map(UUID)
IS 'Returns pipeline-run children of an orchestrator run, including DAG node mapping and run statuses.';

COMMIT;
