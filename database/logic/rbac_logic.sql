-- ############################################################################
-- # FILE: rbac_logic.sql (formerly 04_rbac_logic.sql)
-- # PURPOSE: Step 5 of 12. RBAC reads and writes for gov schema.
-- #          Execute AFTER 03_triggers.sql.
-- ############################################################################

BEGIN;

-- ============================================================================
-- READ OPERATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION gov.fn_get_user_permissions(p_user_id UUID)
RETURNS TABLE (perm_code_name TEXT, perm_display_name TEXT)
LANGUAGE sql STABLE AS $$
    SELECT DISTINCT p.perm_code_name, p.perm_display_name
    FROM gov.user_roles ur
    JOIN gov.role_permissions rp ON ur.role_id = rp.role_id
    JOIN gov.permissions p ON rp.permission_id = p.permission_id
    WHERE ur.user_id = p_user_id;
$$;
COMMENT ON FUNCTION gov.fn_get_user_permissions(UUID) IS 'Returns all effective permissions for a user via their role assignments.';
;
CREATE OR REPLACE FUNCTION gov.fn_check_permission(p_user_id UUID, p_perm_code_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM gov.fn_get_user_permissions(p_user_id) WHERE perm_code_name = p_perm_code_name
    );
$$;
COMMENT ON FUNCTION gov.fn_check_permission(UUID, TEXT) IS 'Returns TRUE if the user holds the specified permission through any assigned role.';
;
CREATE OR REPLACE FUNCTION gov.fn_get_roles()
RETURNS TABLE (role_id UUID, role_display_name TEXT, role_desc_text TEXT, is_system_role_flag BOOLEAN)
LANGUAGE sql STABLE AS $$
    SELECT role_id, role_display_name, role_desc_text, is_system_role_flag FROM gov.roles ORDER BY role_display_name;
$$;
COMMENT ON FUNCTION gov.fn_get_roles() IS 'Lists all roles defined in the platform for administrative display.';
;
-- ============================================================================
-- WRITE OPERATIONS
-- ============================================================================

CREATE OR REPLACE PROCEDURE gov.pr_create_role(
    p_role_display_name TEXT,
    p_role_desc_text TEXT,
    OUT p_role_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO gov.roles (role_display_name, role_desc_text)
    VALUES (p_role_display_name, p_role_desc_text)
    RETURNING role_id INTO p_role_id;
END;
$$;
COMMENT ON PROCEDURE gov.pr_create_role(TEXT, TEXT) IS 'Creates a new custom role. Returns the generated role_id.';
;
CREATE OR REPLACE PROCEDURE gov.pr_delete_role(p_role_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    -- Law 4: Physical delete. History captured by trigger.
    DELETE FROM gov.roles WHERE role_id = p_role_id AND is_system_role_flag = FALSE;
END;
$$;
COMMENT ON PROCEDURE gov.pr_delete_role(UUID) IS 'Physically deletes a non-system role. Protected against built-in role removal.';
;
CREATE OR REPLACE PROCEDURE gov.pr_assign_user_role(p_user_id UUID, p_role_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO gov.user_roles (user_id, role_id) VALUES (p_user_id, p_role_id)
    ON CONFLICT DO NOTHING;
END;
$$;
COMMENT ON PROCEDURE gov.pr_assign_user_role(UUID, UUID) IS 'Assigns a role to a user. Idempotent — duplicate assignment is silently ignored.';
;
CREATE OR REPLACE PROCEDURE gov.pr_revoke_user_role(p_user_id UUID, p_role_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM gov.user_roles WHERE user_id = p_user_id AND role_id = p_role_id;
END;
$$;
COMMENT ON PROCEDURE gov.pr_revoke_user_role(UUID, UUID) IS 'Removes a role assignment from a user.';
;
CREATE OR REPLACE PROCEDURE gov.pr_grant_permission_to_role(p_role_id UUID, p_permission_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO gov.role_permissions (role_id, permission_id) VALUES (p_role_id, p_permission_id)
    ON CONFLICT DO NOTHING;
END;
$$;
COMMENT ON PROCEDURE gov.pr_grant_permission_to_role(UUID, UUID) IS 'Grants a specific permission to a role.';
;
-- ============================================================================
-- PROJECT-SCOPED RBAC
-- ============================================================================

CREATE OR REPLACE FUNCTION gov.fn_get_project_user_roles(p_project_id UUID)
RETURNS TABLE (
    user_id           UUID,
    user_full_name    TEXT,
    email_address     TEXT,
    role_display_name TEXT,
    granted_dtm       TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT pur.user_id, u.user_full_name, u.email_address, r.role_display_name, pur.granted_dtm
    FROM gov.project_user_roles pur
    JOIN etl.users u ON pur.user_id = u.user_id
    JOIN gov.roles r ON pur.role_id = r.role_id
    WHERE pur.project_id = p_project_id
    ORDER BY u.user_full_name;
$$;
COMMENT ON FUNCTION gov.fn_get_project_user_roles(UUID) IS 'Returns all project-scoped role assignments for a project, including user and role names.';
;
CREATE OR REPLACE PROCEDURE gov.pr_grant_project_user_role(
    p_project_id UUID, p_user_id UUID, p_role_id UUID, p_granted_by_user_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO gov.project_user_roles (project_id, user_id, role_id, granted_by_user_id)
    VALUES (p_project_id, p_user_id, p_role_id, p_granted_by_user_id)
    ON CONFLICT DO NOTHING;
END;
$$;
COMMENT ON PROCEDURE gov.pr_grant_project_user_role(UUID, UUID, UUID, UUID) IS 'Grants a project-scoped role to a user. Idempotent.';
;
CREATE OR REPLACE PROCEDURE gov.pr_revoke_project_user_role(
    p_project_id UUID, p_user_id UUID, p_role_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM gov.project_user_roles
    WHERE project_id = p_project_id AND user_id = p_user_id AND role_id = p_role_id;
END;
$$;
COMMENT ON PROCEDURE gov.pr_revoke_project_user_role(UUID, UUID, UUID) IS 'Revokes a project-scoped role from a user.';
;
-- ============================================================================
-- CONNECTOR ACCESS CONTROL
-- ============================================================================

CREATE OR REPLACE FUNCTION gov.fn_can_user_access_connector(p_user_id UUID, p_connector_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM gov.connector_access ca
        WHERE ca.connector_id = p_connector_id
          AND (
              ca.user_id = p_user_id
              OR ca.role_id IN (
                  SELECT role_id FROM gov.user_roles WHERE user_id = p_user_id
                  UNION
                  SELECT pur.role_id FROM gov.project_user_roles pur
                  JOIN catalog.connectors c ON c.connector_id = p_connector_id
                  WHERE pur.user_id = p_user_id
              )
          )
    );
$$;
COMMENT ON FUNCTION gov.fn_can_user_access_connector(UUID, UUID) IS 'Returns TRUE if the user has explicit access to a connector via user-level or role-level connector_access grants.';
;
CREATE OR REPLACE PROCEDURE gov.pr_grant_connector_access(
    p_connector_id UUID, p_user_id UUID, p_role_id UUID, p_granted_by_user_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO gov.connector_access (connector_id, user_id, role_id, granted_by_user_id)
    VALUES (p_connector_id, p_user_id, p_role_id, p_granted_by_user_id);
END;
$$;
COMMENT ON PROCEDURE gov.pr_grant_connector_access(UUID, UUID, UUID, UUID) IS 'Grants connector access to a user or role. At least one of p_user_id or p_role_id must be non-NULL.';
;
-- ============================================================================
-- DATA CLASSIFICATION
-- ============================================================================

CREATE OR REPLACE PROCEDURE gov.pr_classify_asset(
    p_target_type_code TEXT, p_target_id UUID, p_sensitivity_code TEXT,
    p_notes TEXT, p_classified_by_user_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO gov.data_classifications
        (target_type_code, target_id, sensitivity_code, classification_notes_text, classified_by_user_id)
    VALUES (p_target_type_code, p_target_id, p_sensitivity_code, p_notes, p_classified_by_user_id)
    ON CONFLICT (target_type_code, target_id) DO UPDATE SET
        sensitivity_code          = EXCLUDED.sensitivity_code,
        classification_notes_text = EXCLUDED.classification_notes_text,
        classified_by_user_id     = EXCLUDED.classified_by_user_id,
        updated_dtm               = CURRENT_TIMESTAMP;
END;
$$;
COMMENT ON PROCEDURE gov.pr_classify_asset(TEXT, UUID, TEXT, TEXT, UUID) IS 'Upserts a sensitivity classification on a dataset or column. Replaces the prior classification if one already exists.';
;
CREATE OR REPLACE FUNCTION gov.fn_get_classified_assets(p_sensitivity_code TEXT DEFAULT NULL)
RETURNS TABLE (
    classification_id UUID, target_type_code TEXT, target_id UUID,
    sensitivity_code TEXT, classification_notes_text TEXT, classified_by_full_name TEXT, created_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT dc.classification_id, dc.target_type_code, dc.target_id, dc.sensitivity_code,
           dc.classification_notes_text, u.user_full_name AS classified_by_full_name, dc.created_dtm
    FROM gov.data_classifications dc
    LEFT JOIN etl.users u ON dc.classified_by_user_id = u.user_id
    WHERE p_sensitivity_code IS NULL OR dc.sensitivity_code = p_sensitivity_code
    ORDER BY dc.sensitivity_code, dc.target_type_code;
$$;
COMMENT ON FUNCTION gov.fn_get_classified_assets(TEXT) IS 'Lists all data classifications, optionally filtered by sensitivity tier. Used by compliance reporting and data catalogue UIs.';
;
-- ============================================================================
-- NOTIFICATION RULES
-- ============================================================================

CREATE OR REPLACE PROCEDURE gov.pr_create_notification_rule(
    p_entity_type_code TEXT, p_entity_id UUID, p_event_type_code TEXT,
    p_channel_type_code TEXT, p_channel_target_text TEXT,
    p_created_by_user_id UUID, OUT p_notification_rule_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO gov.notification_rules
        (entity_type_code, entity_id, event_type_code, channel_type_code, channel_target_text, created_by_user_id)
    VALUES (p_entity_type_code, p_entity_id, p_event_type_code, p_channel_type_code, p_channel_target_text, p_created_by_user_id)
    RETURNING notification_rule_id INTO p_notification_rule_id;
END;
$$;
COMMENT ON PROCEDURE gov.pr_create_notification_rule(TEXT, UUID, TEXT, TEXT, TEXT, UUID) IS 'Creates an alert routing rule for a given entity event. Returns the new rule ID.';
;
CREATE OR REPLACE FUNCTION gov.fn_get_notification_rules_for_event(
    p_entity_id UUID, p_event_type_code TEXT
)
RETURNS TABLE (
    notification_rule_id UUID, channel_type_code TEXT, channel_target_text TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT notification_rule_id, channel_type_code, channel_target_text
    FROM gov.notification_rules
    WHERE entity_id = p_entity_id
      AND event_type_code = p_event_type_code
      AND is_rule_active_flag = TRUE;
$$;
COMMENT ON FUNCTION gov.fn_get_notification_rules_for_event(UUID, TEXT) IS 'Returns all active alert routing targets for a specific entity and event type. Called by the notification dispatcher after a run completes.';
;
-- Secret Management
CREATE OR REPLACE PROCEDURE gov.pr_store_secret(p_key TEXT, p_plain_value TEXT, OUT p_secret_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO gov.secrets (secret_key_name, secret_value_encrypted)
    VALUES (p_key, pgp_sym_encrypt(p_plain_value, current_setting('app.encryption_key')))
    ON CONFLICT (secret_key_name) DO UPDATE SET
        secret_value_encrypted = pgp_sym_encrypt(p_plain_value, current_setting('app.encryption_key')),
        updated_dtm = CURRENT_TIMESTAMP
    RETURNING secret_id INTO p_secret_id;
END;
$$;
COMMENT ON PROCEDURE gov.pr_store_secret(TEXT, TEXT) IS 'Law 3: Encrypts and persists a secret using pgp_sym_encrypt and the app.encryption_key session variable.';
;
CREATE OR REPLACE FUNCTION gov.fn_get_secret(p_key TEXT)
RETURNS TEXT LANGUAGE sql STABLE AS $$
    SELECT pgp_sym_decrypt(secret_value_encrypted::BYTEA, current_setting('app.encryption_key'))
    FROM gov.secrets WHERE secret_key_name = p_key;
$$;
COMMENT ON FUNCTION gov.fn_get_secret(TEXT) IS 'Law 3: Decrypts and returns a secret value. Key must be set via SET app.encryption_key = ...;';
;
COMMIT;
