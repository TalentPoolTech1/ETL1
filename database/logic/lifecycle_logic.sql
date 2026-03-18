-- ############################################################################
-- # FILE: lifecycle_logic.sql (formerly 10_lifecycle_logic.sql)
-- # PURPOSE: Step 11 of 12. Physical delete cascade logic using the etl/catalog schemas.
-- ############################################################################

BEGIN;

-- ============================================================================
-- User Lifecycle
-- ============================================================================

CREATE OR REPLACE PROCEDURE etl.pr_create_user(
    p_email_address TEXT, p_plain_password TEXT, p_user_full_name TEXT,
    OUT p_user_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Law 3: Hash password with pgcrypto before storage
    INSERT INTO etl.users (email_address, password_hash_text, user_full_name)
    VALUES (p_email_address, crypt(p_plain_password, gen_salt('bf', 12)), p_user_full_name)
    RETURNING user_id INTO p_user_id;
END;
$$;
COMMENT ON PROCEDURE etl.pr_create_user(TEXT, TEXT, TEXT) IS 'Law 3: Creates a user with bcrypt-hashed password (cost 12) via pgcrypto. Plain text is never stored.';
;
CREATE OR REPLACE FUNCTION etl.fn_verify_user_password(p_email_address TEXT, p_plain_password TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT password_hash_text = crypt(p_plain_password, password_hash_text)
    FROM etl.users WHERE email_address = p_email_address AND is_account_active = TRUE;
$$;
COMMENT ON FUNCTION etl.fn_verify_user_password(TEXT, TEXT) IS 'Law 3: Verifies a login attempt using pgcrypto constant-time comparison. Returns TRUE on success.';
;
CREATE OR REPLACE PROCEDURE etl.pr_deactivate_user(p_user_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE etl.users SET is_account_active = FALSE WHERE user_id = p_user_id;
END;
$$;
COMMENT ON PROCEDURE etl.pr_deactivate_user(UUID) IS 'Disables a user account without physical deletion (preserves audit trail references).';
;
CREATE OR REPLACE PROCEDURE etl.pr_delete_user(p_user_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    -- Law 4: Physical delete. History trigger captures row before removal.
    DELETE FROM etl.users WHERE user_id = p_user_id;
END;
$$;
COMMENT ON PROCEDURE etl.pr_delete_user(UUID) IS 'Law 4: Physically removes a user account. History trigger preserves the record before deletion.';
;
-- ============================================================================
-- Environment Lifecycle
-- ============================================================================

CREATE OR REPLACE PROCEDURE execution.pr_create_environment(
    p_env_display_name TEXT, p_is_prod_env_flag BOOLEAN,
    p_cluster_config_json JSONB, p_network_zone_code TEXT,
    OUT p_env_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO execution.environments (env_display_name, is_prod_env_flag, cluster_config_json, network_zone_code)
    VALUES (p_env_display_name, p_is_prod_env_flag, p_cluster_config_json, p_network_zone_code)
    RETURNING env_id INTO p_env_id;
END;
$$;
COMMENT ON PROCEDURE execution.pr_create_environment(TEXT, BOOLEAN, JSONB, TEXT) IS 'Registers a new deployment environment (e.g., DEV, STAGING, PROD) with cluster configuration.';
;
CREATE OR REPLACE PROCEDURE execution.pr_delete_environment(p_env_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    -- Law 4: Physical delete.
    DELETE FROM execution.environments WHERE env_id = p_env_id;
END;
$$;
COMMENT ON PROCEDURE execution.pr_delete_environment(UUID) IS 'Law 4: Physically removes an environment definition. Referenced job_runs are preserved.';
;

CREATE OR REPLACE FUNCTION execution.fn_get_environments()
RETURNS TABLE (
    env_id UUID,
    env_display_name TEXT,
    is_prod_env_flag BOOLEAN,
    created_dtm TIMESTAMPTZ,
    updated_dtm TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT env_id, env_display_name, is_prod_env_flag, created_dtm, updated_dtm
    FROM execution.environments
    ORDER BY is_prod_env_flag DESC, env_display_name;
$$;
COMMENT ON FUNCTION execution.fn_get_environments() IS 'Lists all registered deployment environments. Used by UI environment selector and run-targeting.';
;

COMMIT;
