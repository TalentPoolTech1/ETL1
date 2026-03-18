-- ############################################################################
-- # FILE: seed_rbac.sql
-- # PURPOSE: Step 13 of 13. Seed static permissions and system roles.
-- ############################################################################

BEGIN;

-- ============================================================================
-- 1. SEED STATIC PERMISSIONS
-- =================================################################===========

INSERT INTO gov.permissions (perm_code_name, perm_display_name, perm_desc_text, is_system_flag)
VALUES
    -- Pipeline Permissions
    ('PIPELINE_VIEW',   'View Pipelines',    'Can view pipeline definitions, history, and status.', TRUE),
    ('PIPELINE_CREATE', 'Create Pipeline',   'Can create brand-new pipeline assets.', TRUE),
    ('PIPELINE_EDIT',   'Edit Pipeline',     'Can modify existing pipeline definitions and bodies.', TRUE),
    ('PIPELINE_DELETE', 'Delete Pipeline',   'Can physically remove pipelines from the catalog.', TRUE),
    ('PIPELINE_RUN',    'Execute Pipeline',  'Can trigger manual or scheduled pipeline executions.', TRUE),

    -- Connection Permissions
    ('CONNECTION_VIEW',   'View Connections',  'Can see connection metadata (but not raw secrets).', TRUE),
    ('CONNECTION_CREATE', 'Create Connection', 'Can register new data source/sink connectors.', TRUE),
    ('CONNECTION_EDIT',   'Edit Connection',   'Can modify existing connector configurations.', TRUE),
    ('CONNECTION_DELETE', 'Delete Connection', 'Can remove connectors from the catalog.', TRUE),

    -- Governance & Admin Permissions
    ('USER_MANAGE', 'Manage Users',       'Can create users and assign instance-wide roles.', TRUE),
    ('ROLE_MANAGE', 'Manage Roles',       'Can create custom roles and modify permission mappings.', TRUE),
    ('AUDIT_VIEW',  'View Audit Logs',    'Can browse platform-wide activity and security logs.', TRUE),
    ('SECRET_MANAGE','Manage Secrets',    'Can store and rotate global system secrets.', TRUE)
ON CONFLICT (perm_code_name) DO UPDATE SET
    perm_display_name = EXCLUDED.perm_display_name,
    perm_desc_text    = EXCLUDED.perm_desc_text,
    is_system_flag    = TRUE;

-- ============================================================================
-- 2. SEED SYSTEM ROLES
-- ============================================================================

INSERT INTO gov.roles (role_display_name, role_desc_text, is_system_role_flag)
VALUES
    ('ADMIN',     'Full platform administrator. Can manage all assets and users.', TRUE),
    ('DEVELOPER', 'Data Engineer. Can manage pipelines and connectors, but not users.', TRUE),
    ('OPERATOR',  'Platform Operator. Can run and monitor pipelines but not edit them.', TRUE),
    ('VIEWER',    'Read-only observer. Can view metadata and execution status.', TRUE)
ON CONFLICT (role_display_name) DO NOTHING;

-- ============================================================================
-- 3. MAP PERMISSIONS TO ROLES
-- ============================================================================

-- helper function to avoid repeating UUID lookups
DO $$
DECLARE
    r_admin     UUID := (SELECT role_id FROM gov.roles WHERE role_display_name = 'ADMIN');
    r_dev       UUID := (SELECT role_id FROM gov.roles WHERE role_display_name = 'DEVELOPER');
    r_ops       UUID := (SELECT role_id FROM gov.roles WHERE role_display_name = 'OPERATOR');
    r_view      UUID := (SELECT role_id FROM gov.roles WHERE role_display_name = 'VIEWER');
BEGIN
    -- ADMIN: Everything
    INSERT INTO gov.role_permissions (role_id, permission_id)
    SELECT r_admin, permission_id FROM gov.permissions
    ON CONFLICT DO NOTHING;

    -- DEVELOPER: PIPELINE_*, CONNECTION_*, AUDIT_VIEW
    INSERT INTO gov.role_permissions (role_id, permission_id)
    SELECT r_dev, permission_id FROM gov.permissions 
    WHERE perm_code_name LIKE 'PIPELINE_%' OR perm_code_name LIKE 'CONNECTION_%' OR perm_code_name = 'AUDIT_VIEW'
    ON CONFLICT DO NOTHING;

    -- OPERATOR: PIPELINE_VIEW, PIPELINE_RUN, CONNECTION_VIEW
    INSERT INTO gov.role_permissions (role_id, permission_id)
    SELECT r_ops, permission_id FROM gov.permissions 
    WHERE perm_code_name IN ('PIPELINE_VIEW', 'PIPELINE_RUN', 'CONNECTION_VIEW')
    ON CONFLICT DO NOTHING;

    -- VIEWER: PIPELINE_VIEW, CONNECTION_VIEW
    INSERT INTO gov.role_permissions (role_id, permission_id)
    SELECT r_view, permission_id FROM gov.permissions 
    WHERE perm_code_name IN ('PIPELINE_VIEW', 'CONNECTION_VIEW')
    ON CONFLICT DO NOTHING;
END;
$$;

COMMIT;
