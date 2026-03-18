-- 008_add_static_sql_replacements.sql
-- Converts all remaining static SQL in TypeScript files to DB procedures/functions.
-- Rule: DML (INSERT/UPDATE/DELETE) → PROCEDURE. Data retrieval (SELECT) → FUNCTION.

BEGIN;

-- ============================================================================
-- etl schema: User auth helpers (replaces raw etl.users access in auth.routes.ts)
-- ============================================================================

CREATE OR REPLACE FUNCTION etl.fn_get_user_for_login(p_email TEXT)
RETURNS TABLE (
    user_id            UUID,
    email_address      TEXT,
    password_hash_text TEXT,
    user_full_name     TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT user_id, email_address, password_hash_text, user_full_name
    FROM etl.users
    WHERE email_address = p_email
      AND is_account_active = TRUE;
$$;
COMMENT ON FUNCTION etl.fn_get_user_for_login(TEXT) IS 'Returns minimal user row for login credential verification. Only for internal auth use — never expose password_hash to API responses.';

CREATE OR REPLACE FUNCTION etl.fn_get_active_user_by_id(p_user_id UUID)
RETURNS TABLE (
    user_id            UUID,
    email_address      TEXT,
    user_full_name     TEXT,
    password_hash_text TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT user_id, email_address, user_full_name, password_hash_text
    FROM etl.users
    WHERE user_id = p_user_id
      AND is_account_active = TRUE;
$$;
COMMENT ON FUNCTION etl.fn_get_active_user_by_id(UUID) IS 'Returns profile fields plus password hash for an active user. password_hash used only by change-password endpoint; never forwarded to API responses.';

CREATE OR REPLACE PROCEDURE etl.pr_record_user_login(p_user_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE etl.users
    SET last_login_dtm = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;
END;
$$;
COMMENT ON PROCEDURE etl.pr_record_user_login(UUID) IS 'Records a successful login by stamping last_login_dtm. Called after JWT issuance.';

CREATE OR REPLACE PROCEDURE etl.pr_update_user_password(p_user_id UUID, p_new_hash TEXT)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE etl.users
    SET password_hash_text = p_new_hash,
        updated_dtm        = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;
END;
$$;
COMMENT ON PROCEDURE etl.pr_update_user_password(UUID, TEXT) IS 'Stores a new bcrypt password hash. Called after successful current-password verification in change-password flow.';

-- ============================================================================
-- etl schema: Folder queries (replaces raw etl.folders access in folders.routes.ts)
-- ============================================================================

CREATE OR REPLACE FUNCTION etl.fn_get_project_root_folders(p_project_id UUID)
RETURNS TABLE (
    folder_id          UUID,
    project_id         UUID,
    parent_folder_id   UUID,
    folder_display_name TEXT,
    folder_type_code   TEXT,
    created_dtm        TIMESTAMPTZ,
    updated_dtm        TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT folder_id, project_id, parent_folder_id, folder_display_name,
           folder_type_code, created_dtm, updated_dtm
    FROM etl.folders
    WHERE project_id = p_project_id
      AND parent_folder_id IS NULL
    ORDER BY folder_display_name;
$$;
COMMENT ON FUNCTION etl.fn_get_project_root_folders(UUID) IS 'Returns top-level (root) folders for a project, i.e. those with no parent.';

CREATE OR REPLACE FUNCTION etl.fn_get_folder_children(p_parent_folder_id UUID)
RETURNS TABLE (
    folder_id          UUID,
    project_id         UUID,
    parent_folder_id   UUID,
    folder_display_name TEXT,
    folder_type_code   TEXT,
    created_dtm        TIMESTAMPTZ,
    updated_dtm        TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT folder_id, project_id, parent_folder_id, folder_display_name,
           folder_type_code, created_dtm, updated_dtm
    FROM etl.folders
    WHERE parent_folder_id = p_parent_folder_id
    ORDER BY folder_display_name;
$$;
COMMENT ON FUNCTION etl.fn_get_folder_children(UUID) IS 'Returns direct child folders of a given parent folder.';

CREATE OR REPLACE PROCEDURE etl.pr_rename_folder(p_folder_id UUID, p_new_display_name TEXT)
LANGUAGE plpgsql AS $$
DECLARE
    v_old_ltree TEXT;
    v_new_slug  TEXT;
    v_new_ltree TEXT;
    v_parts     TEXT[];
BEGIN
    SELECT hierarchical_path_ltree::TEXT
    INTO v_old_ltree
    FROM etl.folders
    WHERE folder_id = p_folder_id;

    IF v_old_ltree IS NULL THEN
        RAISE EXCEPTION 'Folder not found' USING ERRCODE = 'P0002';
    END IF;

    v_new_slug  := REGEXP_REPLACE(LOWER(TRIM(p_new_display_name)), '[^a-z0-9_]', '_', 'g');
    v_new_slug  := REGEXP_REPLACE(v_new_slug, '_+', '_', 'g');
    v_parts     := STRING_TO_ARRAY(v_old_ltree, '.');
    v_parts[ARRAY_UPPER(v_parts, 1)] := v_new_slug;
    v_new_ltree := ARRAY_TO_STRING(v_parts, '.');

    -- Rename folder itself
    UPDATE etl.folders
    SET folder_display_name     = TRIM(p_new_display_name),
        hierarchical_path_ltree = v_new_ltree::ltree,
        updated_dtm             = CURRENT_TIMESTAMP
    WHERE folder_id = p_folder_id;

    -- Re-root all descendant ltree paths
    IF v_old_ltree <> v_new_ltree THEN
        UPDATE etl.folders
        SET hierarchical_path_ltree = (v_new_ltree::ltree || SUBPATH(hierarchical_path_ltree, NLEVEL(v_old_ltree::ltree)))
        WHERE hierarchical_path_ltree <@ v_old_ltree::ltree
          AND folder_id <> p_folder_id;
    END IF;
END;
$$;
COMMENT ON PROCEDURE etl.pr_rename_folder(UUID, TEXT) IS 'Renames a folder and cascades the ltree path update to all descendant folders atomically.';

-- ============================================================================
-- gov schema: Users list (replaces raw SELECT FROM etl.users in governance.routes.ts)
-- ============================================================================

CREATE OR REPLACE FUNCTION gov.fn_get_users()
RETURNS TABLE (
    user_id           UUID,
    email_address     TEXT,
    user_full_name    TEXT,
    is_account_active BOOLEAN,
    created_dtm       TIMESTAMPTZ,
    last_login_dtm    TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT user_id, email_address, user_full_name, is_account_active, created_dtm, last_login_dtm
    FROM etl.users
    ORDER BY user_full_name;
$$;
COMMENT ON FUNCTION gov.fn_get_users() IS 'Lists all users for the governance user management screen. No password hashes returned.';

-- ============================================================================
-- meta schema: Technology lookups (replaces raw SELECTs in TechnologyService.ts)
-- ============================================================================

CREATE OR REPLACE FUNCTION meta.fn_get_technologies()
RETURNS TABLE (
    tech_id      UUID,
    tech_code    TEXT,
    display_name TEXT,
    category     TEXT,
    icon_name    TEXT,
    tech_desc_text TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT tech_id, tech_code, display_name, category, icon_name, tech_desc_text
    FROM meta.technology_types
    ORDER BY category, display_name;
$$;
COMMENT ON FUNCTION meta.fn_get_technologies() IS 'Returns all registered technology types ordered for UI display.';

CREATE OR REPLACE FUNCTION meta.fn_get_technology_by_code(p_tech_code TEXT)
RETURNS TABLE (
    tech_id      UUID,
    tech_code    TEXT,
    display_name TEXT,
    category     TEXT,
    icon_name    TEXT,
    tech_desc_text TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT tech_id, tech_code, display_name, category, icon_name, tech_desc_text
    FROM meta.technology_types
    WHERE tech_code = p_tech_code;
$$;
COMMENT ON FUNCTION meta.fn_get_technology_by_code(TEXT) IS 'Returns a single technology type by its unique code.';

-- ============================================================================
-- catalog schema: Connector helpers
-- ============================================================================

CREATE OR REPLACE FUNCTION catalog.fn_count_connector_datasets(p_connector_id UUID)
RETURNS BIGINT
LANGUAGE sql STABLE AS $$
    SELECT COUNT(*) FROM catalog.datasets WHERE connector_id = p_connector_id;
$$;
COMMENT ON FUNCTION catalog.fn_count_connector_datasets(UUID) IS 'Returns the number of datasets registered under a connector. Used as dependency guard before physical delete.';

CREATE OR REPLACE PROCEDURE catalog.pr_record_connection_test(
    p_connector_id    UUID,
    p_passed          BOOLEAN,
    p_latency_ms      INTEGER,
    p_error_text      TEXT,
    p_tested_by_user_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO catalog.connection_test_results
        (connector_id, test_passed_flag, response_time_ms, error_message_text, tested_by_user_id)
    VALUES
        (p_connector_id, p_passed, p_latency_ms, p_error_text, p_tested_by_user_id);
EXCEPTION
    WHEN undefined_table THEN
        -- Table may not exist in all environments; silently skip
        NULL;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_record_connection_test(UUID, BOOLEAN, INTEGER, TEXT, UUID) IS 'Appends a connection test result to catalog.connection_test_results. Silently no-ops if the table does not yet exist.';

CREATE OR REPLACE FUNCTION catalog.fn_get_connector_decrypted(p_connector_id UUID)
RETURNS TABLE (
    connector_id           UUID,
    connector_display_name TEXT,
    connector_type_code    TEXT,
    conn_ssl_mode          TEXT,
    conn_max_pool_size_num INTEGER,
    conn_idle_timeout_sec  INTEGER,
    conn_jdbc_driver_class TEXT,
    conn_test_query        TEXT,
    conn_spark_config_json JSONB,
    created_dtm            TIMESTAMPTZ,
    updated_dtm            TIMESTAMPTZ,
    created_by_user_id     UUID,
    updated_by_user_id     UUID,
    conn_config_json       JSONB,
    conn_secrets_json      JSONB,
    conn_ssh_tunnel_json   JSONB,
    conn_proxy_json        JSONB
)
LANGUAGE sql STABLE AS $$
    SELECT
        c.connector_id,
        c.connector_display_name,
        c.connector_type_code,
        c.conn_ssl_mode,
        c.conn_max_pool_size_num,
        c.conn_idle_timeout_sec,
        c.conn_jdbc_driver_class,
        c.conn_test_query,
        c.conn_spark_config_json,
        c.created_dtm,
        c.updated_dtm,
        c.created_by_user_id,
        c.updated_by_user_id,
        pgp_sym_decrypt(c.conn_config_json_encrypted::BYTEA,
            current_setting('app.encryption_key'))::JSONB  AS conn_config_json,
        CASE WHEN c.conn_secrets_json_encrypted IS NOT NULL
             THEN pgp_sym_decrypt(c.conn_secrets_json_encrypted::BYTEA,
                      current_setting('app.encryption_key'))::JSONB
             ELSE NULL END                                  AS conn_secrets_json,
        CASE WHEN c.conn_ssh_tunnel_json_encrypted IS NOT NULL
             THEN pgp_sym_decrypt(c.conn_ssh_tunnel_json_encrypted::BYTEA,
                      current_setting('app.encryption_key'))::JSONB
             ELSE NULL END                                  AS conn_ssh_tunnel_json,
        CASE WHEN c.conn_proxy_json_encrypted IS NOT NULL
             THEN pgp_sym_decrypt(c.conn_proxy_json_encrypted::BYTEA,
                      current_setting('app.encryption_key'))::JSONB
             ELSE NULL END                                  AS conn_proxy_json
    FROM catalog.connectors c
    WHERE c.connector_id = p_connector_id;
$$;
COMMENT ON FUNCTION catalog.fn_get_connector_decrypted(UUID) IS 'Returns a connector with all encrypted blobs decrypted via pgcrypto. Requires app.encryption_key session variable. Use only within execution engine or connection-test paths.';

-- ============================================================================
-- catalog schema: Folder-scoped pipeline/orchestrator lists
-- ============================================================================

CREATE OR REPLACE FUNCTION catalog.fn_get_pipelines_by_folder(p_folder_id UUID)
RETURNS TABLE (
    pipeline_id          UUID,
    project_id           UUID,
    folder_id            UUID,
    pipeline_display_name TEXT,
    pipeline_desc_text   TEXT,
    active_version_id    UUID,
    created_dtm          TIMESTAMPTZ,
    updated_dtm          TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT pipeline_id, project_id, folder_id, pipeline_display_name,
           pipeline_desc_text, active_version_id, created_dtm, updated_dtm
    FROM catalog.pipelines
    WHERE folder_id = p_folder_id
    ORDER BY pipeline_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_pipelines_by_folder(UUID) IS 'Returns pipelines directly inside a folder. Used by the folder-view sidebar and folder workspace.';

CREATE OR REPLACE FUNCTION catalog.fn_get_orchestrators_by_folder(p_folder_id UUID)
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
    WHERE folder_id = p_folder_id
    ORDER BY orch_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_orchestrators_by_folder(UUID) IS 'Returns orchestrators directly inside a folder.';

CREATE OR REPLACE FUNCTION catalog.fn_get_root_pipelines(p_project_id UUID)
RETURNS TABLE (
    pipeline_id          UUID,
    project_id           UUID,
    folder_id            UUID,
    pipeline_display_name TEXT,
    pipeline_desc_text   TEXT,
    active_version_id    UUID,
    created_dtm          TIMESTAMPTZ,
    updated_dtm          TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT pipeline_id, project_id, folder_id, pipeline_display_name,
           pipeline_desc_text, active_version_id, created_dtm, updated_dtm
    FROM catalog.pipelines
    WHERE project_id = p_project_id
      AND folder_id IS NULL
    ORDER BY pipeline_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_root_pipelines(UUID) IS 'Returns project-level pipelines not assigned to any folder (root-level only).';

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
    WHERE project_id = p_project_id
      AND folder_id IS NULL
    ORDER BY orch_display_name;
$$;
COMMENT ON FUNCTION catalog.fn_get_root_orchestrators(UUID) IS 'Returns project-level orchestrators not assigned to any folder (root-level only).';

-- ============================================================================
-- catalog schema: Orchestrator update + audit helpers
-- ============================================================================

CREATE OR REPLACE PROCEDURE catalog.pr_update_orchestrator(
    p_orch_id           UUID,
    p_orch_display_name TEXT,
    p_orch_desc_text    TEXT,
    p_dag_definition_json JSONB,
    p_updated_by_user_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE catalog.orchestrators
    SET orch_display_name   = COALESCE(p_orch_display_name, orch_display_name),
        orch_desc_text      = COALESCE(p_orch_desc_text, orch_desc_text),
        dag_definition_json = COALESCE(p_dag_definition_json, dag_definition_json),
        updated_by_user_id  = p_updated_by_user_id,
        updated_dtm         = CURRENT_TIMESTAMP
    WHERE orch_id = p_orch_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orchestrator not found' USING ERRCODE = 'P0002';
    END IF;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_update_orchestrator(UUID, TEXT, TEXT, JSONB, UUID) IS 'Updates orchestrator display name, description, and/or DAG JSON. Only non-NULL fields are applied. Raises P0002 on missing orchestrator.';

CREATE OR REPLACE PROCEDURE catalog.pr_clear_pipeline_parameters(p_pipeline_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM catalog.pipeline_parameters WHERE pipeline_id = p_pipeline_id;
END;
$$;
COMMENT ON PROCEDURE catalog.pr_clear_pipeline_parameters(UUID) IS 'Deletes all existing parameter definitions for a pipeline. Called before re-seeding from a PUT /parameters payload.';

CREATE OR REPLACE FUNCTION catalog.fn_get_pipeline_audit_logs(
    p_pipeline_id UUID,
    p_limit       INTEGER DEFAULT 50,
    p_offset      INTEGER DEFAULT 0
)
RETURNS TABLE (
    id          BIGINT,
    timestamp   TIMESTAMPTZ,
    user_id     UUID,
    action_code CHAR(1)
)
LANGUAGE sql STABLE AS $$
    SELECT h.hist_id        AS id,
           h.hist_action_dtm AS timestamp,
           h.hist_action_by  AS user_id,
           h.hist_action_cd  AS action_code
    FROM history.pipelines_history h
    WHERE h.pipeline_id = p_pipeline_id
    ORDER BY h.hist_action_dtm DESC
    LIMIT  GREATEST(COALESCE(p_limit,  50), 1)
    OFFSET GREATEST(COALESCE(p_offset,  0), 0);
$$;
COMMENT ON FUNCTION catalog.fn_get_pipeline_audit_logs(UUID, INTEGER, INTEGER) IS 'Returns paginated history.pipelines_history rows for pipeline audit log views.';

CREATE OR REPLACE FUNCTION catalog.fn_get_orchestrator_audit_logs(
    p_orch_id UUID,
    p_limit   INTEGER DEFAULT 50,
    p_offset  INTEGER DEFAULT 0
)
RETURNS TABLE (
    id          BIGINT,
    timestamp   TIMESTAMPTZ,
    user_id     UUID,
    action_code CHAR(1)
)
LANGUAGE sql STABLE AS $$
    SELECT h.hist_id        AS id,
           h.hist_action_dtm AS timestamp,
           h.hist_action_by  AS user_id,
           h.hist_action_cd  AS action_code
    FROM history.orchestrators_history h
    WHERE h.orch_id = p_orch_id
    ORDER BY h.hist_action_dtm DESC
    LIMIT  GREATEST(COALESCE(p_limit,  50), 1)
    OFFSET GREATEST(COALESCE(p_offset,  0), 0);
$$;
COMMENT ON FUNCTION catalog.fn_get_orchestrator_audit_logs(UUID, INTEGER, INTEGER) IS 'Returns paginated history.orchestrators_history rows for orchestrator audit log views.';

-- ============================================================================
-- execution schema: KPIs
-- ============================================================================

CREATE OR REPLACE FUNCTION execution.fn_get_execution_kpis(
    p_date_from DATE,
    p_date_to   DATE,
    p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
    total_today          BIGINT,
    running_now          BIGINT,
    success_rate_today   NUMERIC,
    failed_today         BIGINT,
    avg_duration_ms_today NUMERIC,
    sla_breaches_today   BIGINT,
    data_volume_gb_today NUMERIC,
    active_pipelines     BIGINT
)
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
COMMENT ON FUNCTION execution.fn_get_execution_kpis(DATE, DATE, UUID) IS 'Returns execution monitor KPI aggregates for a date range. p_project_id is optional; NULL returns platform-wide metrics.';

-- ============================================================================
-- execution schema: Pipeline run list + count (replaces dynamic SQL in executions.routes.ts)
-- ============================================================================

CREATE OR REPLACE FUNCTION execution.fn_list_pipeline_runs(
    p_pipeline_id    UUID    DEFAULT NULL,
    p_project_id     UUID    DEFAULT NULL,
    p_status         TEXT    DEFAULT NULL,
    p_trigger_type   TEXT    DEFAULT NULL,
    p_date_from      DATE    DEFAULT NULL,
    p_date_to        DATE    DEFAULT NULL,
    p_search         TEXT    DEFAULT NULL,
    p_my_jobs_only   BOOLEAN DEFAULT FALSE,
    p_user_id        UUID    DEFAULT NULL,
    p_limit          INTEGER DEFAULT 50,
    p_offset         INTEGER DEFAULT 0
)
RETURNS TABLE (
    pipeline_run_id  UUID,
    pipeline_name    TEXT,
    pipeline_id      UUID,
    project_id       UUID,
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
    sla_status       TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT
        pr.pipeline_run_id,
        p.pipeline_display_name                                          AS pipeline_name,
        pr.pipeline_id,
        p.project_id,
        proj.project_display_name                                        AS project_name,
        COALESCE(pv.release_tag_label, 'v' || pv.version_num_seq::TEXT) AS version_label,
        pr.run_status_code,
        pr.trigger_type_code,
        u.user_full_name                                                  AS submitted_by,
        pr.start_dtm,
        pr.end_dtm,
        pr.run_duration_ms,
        pr.rows_processed_num,
        pr.bytes_read_num,
        pr.bytes_written_num,
        pr.error_message_text,
        pr.retry_count_num,
        pr.sla_status_code
    FROM execution.pipeline_runs pr
    LEFT JOIN catalog.pipelines p          ON p.pipeline_id    = pr.pipeline_id
    LEFT JOIN catalog.pipeline_versions pv ON pv.version_id    = pr.version_id
    LEFT JOIN etl.projects proj            ON proj.project_id  = p.project_id
    LEFT JOIN etl.users u                  ON u.user_id        = pr.triggered_by_user_id
    WHERE (p_pipeline_id  IS NULL OR pr.pipeline_id          = p_pipeline_id)
      AND (p_project_id   IS NULL OR p.project_id            = p_project_id)
      AND (p_status       IS NULL OR pr.run_status_code       = p_status)
      AND (p_trigger_type IS NULL OR pr.trigger_type_code     = p_trigger_type)
      AND (p_date_from    IS NULL OR DATE(pr.start_dtm)      >= p_date_from)
      AND (p_date_to      IS NULL OR DATE(pr.start_dtm)      <= p_date_to)
      AND (p_search       IS NULL OR p.pipeline_display_name  ILIKE '%' || p_search || '%')
      AND (NOT COALESCE(p_my_jobs_only, FALSE) OR pr.triggered_by_user_id = p_user_id)
    ORDER BY pr.start_dtm DESC NULLS LAST, pr.created_dtm DESC
    LIMIT  GREATEST(COALESCE(p_limit,  50), 1)
    OFFSET GREATEST(COALESCE(p_offset,  0), 0);
$$;
COMMENT ON FUNCTION execution.fn_list_pipeline_runs(UUID, UUID, TEXT, TEXT, DATE, DATE, TEXT, BOOLEAN, UUID, INTEGER, INTEGER) IS 'Paginated pipeline-run list with optional filters. All filter params default to NULL (no filter). p_user_id required when p_my_jobs_only = TRUE.';

CREATE OR REPLACE FUNCTION execution.fn_count_pipeline_runs(
    p_pipeline_id    UUID    DEFAULT NULL,
    p_project_id     UUID    DEFAULT NULL,
    p_status         TEXT    DEFAULT NULL,
    p_trigger_type   TEXT    DEFAULT NULL,
    p_date_from      DATE    DEFAULT NULL,
    p_date_to        DATE    DEFAULT NULL,
    p_search         TEXT    DEFAULT NULL,
    p_my_jobs_only   BOOLEAN DEFAULT FALSE,
    p_user_id        UUID    DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE sql STABLE AS $$
    SELECT COUNT(*)
    FROM execution.pipeline_runs pr
    LEFT JOIN catalog.pipelines p ON p.pipeline_id = pr.pipeline_id
    WHERE (p_pipeline_id  IS NULL OR pr.pipeline_id          = p_pipeline_id)
      AND (p_project_id   IS NULL OR p.project_id            = p_project_id)
      AND (p_status       IS NULL OR pr.run_status_code       = p_status)
      AND (p_trigger_type IS NULL OR pr.trigger_type_code     = p_trigger_type)
      AND (p_date_from    IS NULL OR DATE(pr.start_dtm)      >= p_date_from)
      AND (p_date_to      IS NULL OR DATE(pr.start_dtm)      <= p_date_to)
      AND (p_search       IS NULL OR p.pipeline_display_name  ILIKE '%' || p_search || '%')
      AND (NOT COALESCE(p_my_jobs_only, FALSE) OR pr.triggered_by_user_id = p_user_id);
$$;
COMMENT ON FUNCTION execution.fn_count_pipeline_runs(UUID, UUID, TEXT, TEXT, DATE, DATE, TEXT, BOOLEAN, UUID) IS 'Returns total row count for pipeline-run list with the same filter set as fn_list_pipeline_runs.';

-- ============================================================================
-- execution schema: Pipeline run detail + nodes (full column set)
-- ============================================================================

CREATE OR REPLACE FUNCTION execution.fn_get_pipeline_run_detail(p_run_id UUID)
RETURNS TABLE (
    pipeline_run_id  UUID,
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
        p.pipeline_display_name                                          AS pipeline_name,
        proj.project_display_name                                        AS project_name,
        COALESCE(pv.release_tag_label, 'v' || pv.version_num_seq::TEXT) AS version_label,
        pr.run_status_code,
        pr.trigger_type_code,
        u.user_full_name                                                  AS submitted_by,
        pr.start_dtm,
        pr.end_dtm,
        pr.run_duration_ms,
        pr.rows_processed_num,
        pr.bytes_read_num,
        pr.bytes_written_num,
        pr.error_message_text,
        pr.retry_count_num,
        pr.sla_status_code,
        pr.external_engine_job_id,
        pr.spark_ui_url_text
    FROM execution.pipeline_runs pr
    LEFT JOIN catalog.pipelines p          ON p.pipeline_id    = pr.pipeline_id
    LEFT JOIN catalog.pipeline_versions pv ON pv.version_id    = pr.version_id
    LEFT JOIN etl.projects proj            ON proj.project_id  = p.project_id
    LEFT JOIN etl.users u                  ON u.user_id        = pr.triggered_by_user_id
    WHERE pr.pipeline_run_id = p_run_id;
$$;
COMMENT ON FUNCTION execution.fn_get_pipeline_run_detail(UUID) IS 'Returns full pipeline-run detail row with joined labels for the run detail UI.';

CREATE OR REPLACE FUNCTION execution.fn_get_pipeline_run_nodes_detail(p_run_id UUID)
RETURNS TABLE (
    node_run_id        UUID,
    node_id            TEXT,
    node_name          TEXT,
    run_status         TEXT,
    start_dtm          TIMESTAMPTZ,
    end_dtm            TIMESTAMPTZ,
    rows_in            BIGINT,
    rows_out           BIGINT,
    error_message      TEXT,
    metrics            JSONB
)
LANGUAGE sql STABLE AS $$
    SELECT
        node_run_id,
        node_id_in_ir_text,
        node_display_name,
        node_status_code,
        start_dtm,
        end_dtm,
        rows_in_num,
        rows_out_num,
        error_message_text,
        node_metrics_json
    FROM execution.pipeline_node_runs
    WHERE pipeline_run_id = p_run_id
    ORDER BY start_dtm NULLS LAST;
$$;
COMMENT ON FUNCTION execution.fn_get_pipeline_run_nodes_detail(UUID) IS 'Returns all node-run rows for a pipeline run including rows in/out and metrics. Full column set for run-detail and node-runs endpoints.';

CREATE OR REPLACE FUNCTION execution.fn_get_pipeline_run_logs_paginated(
    p_run_id  UUID,
    p_level   TEXT    DEFAULT NULL,
    p_limit   INTEGER DEFAULT 500,
    p_offset  INTEGER DEFAULT 0
)
RETURNS TABLE (
    log_dtm     TIMESTAMPTZ,
    log_level   TEXT,
    log_source  TEXT,
    log_message TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT
        created_dtm      AS log_dtm,
        log_level_code   AS log_level,
        log_source_code  AS log_source,
        log_message_text AS log_message
    FROM execution.pipeline_run_logs
    WHERE pipeline_run_id = p_run_id
      AND (p_level IS NULL OR log_level_code = p_level)
    ORDER BY created_dtm ASC
    LIMIT  GREATEST(COALESCE(p_limit,  500),   1)
    OFFSET GREATEST(COALESCE(p_offset,    0),  0);
$$;
COMMENT ON FUNCTION execution.fn_get_pipeline_run_logs_paginated(UUID, TEXT, INTEGER, INTEGER) IS 'Returns paginated log lines for a pipeline run. Extends fn_get_pipeline_run_logs with LIMIT/OFFSET support.';

-- ============================================================================
-- execution schema: Retry pipeline run
-- ============================================================================

CREATE OR REPLACE PROCEDURE execution.pr_retry_pipeline_run(
    p_original_run_id UUID,
    p_user_id         UUID,
    OUT p_new_run_id  UUID
)
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
COMMENT ON PROCEDURE execution.pr_retry_pipeline_run(UUID, UUID) IS 'Creates a new PENDING pipeline run as a retry of the given original run. Increments retry_count_num. Returns the new run ID via OUT param.';

-- ============================================================================
-- execution schema: Orchestrator run list + count
-- ============================================================================

CREATE OR REPLACE FUNCTION execution.fn_list_orchestrator_runs(
    p_project_id    UUID    DEFAULT NULL,
    p_orch_id       UUID    DEFAULT NULL,
    p_status        TEXT    DEFAULT NULL,
    p_trigger_type  TEXT    DEFAULT NULL,
    p_limit         INTEGER DEFAULT 50,
    p_offset        INTEGER DEFAULT 0
)
RETURNS TABLE (
    orch_run_id       UUID,
    orchestrator_name TEXT,
    orch_id           UUID,
    project_id        UUID,
    project_name      TEXT,
    run_status        TEXT,
    trigger_type      TEXT,
    start_dtm         TIMESTAMPTZ,
    end_dtm           TIMESTAMPTZ,
    duration_ms       INTEGER,
    error_message     TEXT,
    retry_count       INTEGER
)
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
COMMENT ON FUNCTION execution.fn_list_orchestrator_runs(UUID, UUID, TEXT, TEXT, INTEGER, INTEGER) IS 'Paginated orchestrator-run list with optional project/orchestrator/status/trigger filters.';

CREATE OR REPLACE FUNCTION execution.fn_count_orchestrator_runs(
    p_project_id    UUID    DEFAULT NULL,
    p_orch_id       UUID    DEFAULT NULL,
    p_status        TEXT    DEFAULT NULL,
    p_trigger_type  TEXT    DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE sql STABLE AS $$
    SELECT COUNT(*)
    FROM execution.orchestrator_runs orch
    LEFT JOIN catalog.orchestrators o ON o.orch_id = orch.orch_id
    WHERE (p_project_id   IS NULL OR o.project_id         = p_project_id)
      AND (p_orch_id      IS NULL OR orch.orch_id          = p_orch_id)
      AND (p_status       IS NULL OR orch.run_status_code  = p_status)
      AND (p_trigger_type IS NULL OR orch.trigger_type_code = p_trigger_type);
$$;
COMMENT ON FUNCTION execution.fn_count_orchestrator_runs(UUID, UUID, TEXT, TEXT) IS 'Returns total row count for orchestrator-run list with same filter set as fn_list_orchestrator_runs.';

-- ============================================================================
-- execution schema: Retry orchestrator run
-- ============================================================================

CREATE OR REPLACE PROCEDURE execution.pr_retry_orchestrator_run(
    p_original_run_id UUID,
    p_user_id         UUID,
    OUT p_new_run_id  UUID
)
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
COMMENT ON PROCEDURE execution.pr_retry_orchestrator_run(UUID, UUID) IS 'Creates a new PENDING orchestrator run as a retry of the given original. Increments retry_count_num. Returns new run ID via OUT param.';

COMMIT;
