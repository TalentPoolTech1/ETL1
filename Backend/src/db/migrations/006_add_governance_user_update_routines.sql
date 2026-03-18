-- Governance user-detail read/update routines used by user workspace.

BEGIN;

CREATE OR REPLACE FUNCTION gov.fn_get_user_detail(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  email_address TEXT,
  user_full_name TEXT,
  is_account_active BOOLEAN,
  created_dtm TIMESTAMPTZ,
  last_login_dtm TIMESTAMPTZ,
  roles_json JSONB
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    u.user_id,
    u.email_address,
    u.user_full_name,
    u.is_account_active,
    u.created_dtm,
    u.last_login_dtm,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object('roleId', r.role_id, 'roleName', r.role_display_name))
      FILTER (WHERE r.role_id IS NOT NULL),
      '[]'::jsonb
    ) AS roles_json
  FROM etl.users u
  LEFT JOIN gov.user_roles ur ON ur.user_id = u.user_id
  LEFT JOIN gov.roles r ON r.role_id = ur.role_id
  WHERE u.user_id = p_user_id
  GROUP BY u.user_id, u.email_address, u.user_full_name, u.is_account_active, u.created_dtm, u.last_login_dtm;
$$;
COMMENT ON FUNCTION gov.fn_get_user_detail(UUID) IS 'Returns one user profile with role objects for governance/user workspace.';

CREATE OR REPLACE PROCEDURE gov.pr_update_user_profile(
  p_user_id UUID,
  p_email_address TEXT,
  p_user_full_name TEXT,
  p_is_account_active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE etl.users
  SET email_address = COALESCE(NULLIF(TRIM(p_email_address), ''), email_address),
      user_full_name = COALESCE(NULLIF(TRIM(p_user_full_name), ''), user_full_name),
      is_account_active = COALESCE(p_is_account_active, is_account_active),
      updated_dtm = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;
COMMENT ON PROCEDURE gov.pr_update_user_profile(UUID, TEXT, TEXT, BOOLEAN) IS 'Updates editable governance user profile fields (display name, email, active flag).';

COMMIT;
