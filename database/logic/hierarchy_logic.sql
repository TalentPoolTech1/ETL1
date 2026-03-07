-- ############################################################################
-- # FILE: hierarchy_logic.sql (formerly 05_hierarchy_logic.sql)
-- # PURPOSE: Step 6 of 12. Project and folder CRUD using etl schema.
-- ############################################################################

BEGIN;

-- ============================================================================
-- READ OPERATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION etl.fn_get_projects()
RETURNS TABLE (
    project_id           UUID,
    project_display_name TEXT,
    project_desc_text    TEXT,
    created_by_full_name TEXT,
    updated_by_full_name TEXT,
    created_dtm          TIMESTAMPTZ,
    updated_dtm          TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        p.project_id,
        p.project_display_name,
        p.project_desc_text,
        cu.user_full_name AS created_by_full_name,
        uu.user_full_name AS updated_by_full_name,
        p.created_dtm,
        p.updated_dtm
    FROM etl.projects p
    LEFT JOIN etl.users cu ON p.created_by_user_id = cu.user_id
    LEFT JOIN etl.users uu ON p.updated_by_user_id = uu.user_id
    ORDER BY p.project_display_name;
$$;
COMMENT ON FUNCTION etl.fn_get_projects() IS 'Lists all projects with creator and last-editor names. No lifecycle_status_code or owner_user_id — a project exists or is deleted (Law 4).'
;
CREATE OR REPLACE FUNCTION etl.fn_get_folder_tree(p_project_id UUID)
RETURNS TABLE (folder_id UUID, folder_display_name TEXT, parent_folder_id UUID, hierarchical_path_ltree LTREE, folder_type_code TEXT)
LANGUAGE sql STABLE AS $$
    SELECT folder_id, folder_display_name, parent_folder_id, hierarchical_path_ltree, folder_type_code
    FROM etl.folders WHERE project_id = p_project_id ORDER BY hierarchical_path_ltree;
$$;
COMMENT ON FUNCTION etl.fn_get_folder_tree(UUID) IS 'Returns the full folder tree for a project sorted by LTREE path for easy hierarchical rendering.';
;
CREATE OR REPLACE FUNCTION etl.fn_get_folder_descendants(p_folder_id UUID)
RETURNS TABLE (folder_id UUID, folder_display_name TEXT, hierarchical_path_ltree LTREE)
LANGUAGE sql STABLE AS $$
    SELECT f.folder_id, f.folder_display_name, f.hierarchical_path_ltree
    FROM etl.folders f
    JOIN etl.folders root ON root.folder_id = p_folder_id
    WHERE f.hierarchical_path_ltree <@ root.hierarchical_path_ltree;
$$;
COMMENT ON FUNCTION etl.fn_get_folder_descendants(UUID) IS 'Recursively returns all descendant folders of a given folder using LTREE <@ operator.';
;
-- ============================================================================
-- WRITE OPERATIONS
-- ============================================================================

CREATE OR REPLACE PROCEDURE etl.pr_create_project(
    p_project_display_name TEXT,
    p_project_desc_text    TEXT,
    p_created_by_user_id   UUID,
    OUT p_project_id       UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO etl.projects (project_display_name, project_desc_text, created_by_user_id, updated_by_user_id)
    VALUES (p_project_display_name, p_project_desc_text, p_created_by_user_id, p_created_by_user_id)
    RETURNING project_id INTO p_project_id;
END;
$$;
COMMENT ON PROCEDURE etl.pr_create_project(TEXT, TEXT, UUID) IS 'Creates a new project and records the creating user. No owner concept — access is via gov.project_user_roles.'
;
CREATE OR REPLACE PROCEDURE etl.pr_update_project(
    p_project_id           UUID,
    p_project_display_name TEXT DEFAULT NULL,
    p_project_desc_text    TEXT DEFAULT NULL,
    p_updated_by_user_id   UUID DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE etl.projects SET
        project_display_name = COALESCE(p_project_display_name, project_display_name),
        project_desc_text    = COALESCE(p_project_desc_text, project_desc_text),
        updated_by_user_id   = COALESCE(p_updated_by_user_id, updated_by_user_id)
    WHERE project_id = p_project_id;
    -- updated_dtm auto-refreshed by tr_ts_etl_projects trigger
END;
$$;
COMMENT ON PROCEDURE etl.pr_update_project(UUID, TEXT, TEXT, UUID) IS 'Updates project display name or description. lifecycle_status_code removed by design — a project exists or is deleted.'
;
CREATE OR REPLACE PROCEDURE etl.pr_delete_project(p_project_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    -- Law 4: Physical delete. Cascade handles folders and pipelines.
    -- History trigger captures project row before deletion.
    DELETE FROM etl.projects WHERE project_id = p_project_id;
END;
$$;
COMMENT ON PROCEDURE etl.pr_delete_project(UUID) IS 'Law 4: Physical delete of a project. ON DELETE CASCADE propagates to all child folders and pipelines.';
;
CREATE OR REPLACE PROCEDURE etl.pr_create_folder(
    p_project_id UUID,
    p_parent_folder_id UUID,
    p_folder_display_name TEXT,
    p_folder_type_code TEXT,
    OUT p_folder_id UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_parent_path LTREE;
    v_new_path    LTREE;
BEGIN
    -- Build the LTREE path from parent
    IF p_parent_folder_id IS NOT NULL THEN
        SELECT hierarchical_path_ltree INTO v_parent_path FROM etl.folders WHERE folder_id = p_parent_folder_id;
        v_new_path := v_parent_path || replace(p_folder_display_name, ' ', '_')::LTREE;
    ELSE
        v_new_path := replace(p_folder_display_name, ' ', '_')::LTREE;
    END IF;

    INSERT INTO etl.folders (project_id, parent_folder_id, folder_display_name, hierarchical_path_ltree, folder_type_code)
    VALUES (p_project_id, p_parent_folder_id, p_folder_display_name, v_new_path, p_folder_type_code)
    RETURNING folder_id INTO p_folder_id;
END;
$$;
COMMENT ON PROCEDURE etl.pr_create_folder(UUID, UUID, TEXT, TEXT) IS 'Creates a folder within a project, computing its LTREE path from the parent. Supports unlimited depth nesting (Law 12).';
;
CREATE OR REPLACE PROCEDURE etl.pr_delete_folder(p_folder_id UUID)
LANGUAGE plpgsql AS $$
DECLARE
    v_path LTREE;
BEGIN
    SELECT hierarchical_path_ltree INTO v_path FROM etl.folders WHERE folder_id = p_folder_id;
    -- Law 4: Physical delete of entire subtree using LTREE <@ operator
    DELETE FROM etl.folders WHERE hierarchical_path_ltree <@ v_path;
END;
$$;
COMMENT ON PROCEDURE etl.pr_delete_folder(UUID) IS 'Law 4: Recursively physically deletes a folder and all its descendants using LTREE path matching.';
;
COMMIT;
