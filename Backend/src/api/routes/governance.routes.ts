/**
 * Governance Routes
 *
 * GET    /api/governance/users                      — List all users (metadata only)
 * GET    /api/governance/users/:id                  — Get user detail
 * PUT    /api/governance/users/:id                  — Update user profile
 * GET    /api/governance/roles                      — List all roles
 * GET    /api/governance/roles/:id                  — Get role detail
 * POST   /api/governance/roles                      — Create role
 * PUT    /api/governance/roles/:id                  — Update role profile
 * GET    /api/governance/roles/:id/members          — List role members
 * POST   /api/governance/roles/:id/members          — Assign user to role
 * DELETE /api/governance/roles/:id/members/:uid     — Revoke user from role
 * GET    /api/governance/roles/:id/permissions      — Get role permission map
 * PUT    /api/governance/roles/:id/permissions      — Replace role permissions
 * GET    /api/governance/permissions                — List all permissions
 * POST   /api/governance/users/:id/roles            — Assign global role to user
 * DELETE /api/governance/users/:id/roles/:roleId    — Revoke global role
 * GET    /api/governance/projects/:pid/members      — List project members + roles
 * POST   /api/governance/projects/:pid/members      — Add project member
 * DELETE /api/governance/projects/:pid/members/:uid — Remove project member
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db/connection';
import { userIdMiddleware } from '../middleware/user-id.middleware';
import { LoggerFactory } from '../../shared/logging';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();
const log = LoggerFactory.get('governance');
router.use(userIdMiddleware);

function getCallerId(res: Response): string {
  return (res.locals['userId'] as string) ?? 'system';
}

async function setSession(client: any, userId: string) {
  const key = process.env['APP_ENCRYPTION_KEY'];
  if (!key) throw new Error('APP_ENCRYPTION_KEY is required');
  await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
  await client.query(`SET LOCAL app.encryption_key = '${key.replace(/'/g, "''")}'`);
}

function mapUserDetail(row: any) {
  return {
    userId:      row.user_id,
    email:       row.email_address,
    displayName: row.user_full_name,
    isActive:    row.is_account_active,
    createdOn:   row.created_dtm,
    lastLogin:   row.last_login_dtm,
    roles:       row.roles_json ?? [],
  };
}

function mapRolePermission(row: any) {
  return {
    permissionId: row.permission_id,
    permCode: row.perm_code_name,
    permDisplayName: row.perm_display_name,
    permDesc: row.perm_desc_text,
    isAssigned: row.is_assigned ?? false,
  };
}

// ─── Users list ────────────────────────────────────────────────────────────────

router.get('/users', requirePermission('USER_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, callerId);
      const r = await client.query(`SELECT * FROM gov.fn_get_users()`);
      return r.rows.map((row: any) => ({
        userId:        row.user_id,
        email:         row.email_address,
        displayName:   row.user_full_name,
        isActive:      row.is_account_active,
        createdOn:     row.created_dtm,
        lastLogin:     row.last_login_dtm,
      }));
    });
    return res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── User detail ───────────────────────────────────────────────────────────────

router.get('/users/:id', requirePermission('USER_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const row = await db.transaction(async client => {
      await setSession(client, callerId);
      const r = await client.query(`
        SELECT user_id, email_address, user_full_name, is_account_active, created_dtm, last_login_dtm, roles_json
        FROM gov.fn_get_user_detail($1::uuid)
      `, [req.params.id]);
      return r.rows[0] ?? null;
    });
    if (!row) return res.status(404).json({ success: false, userMessage: 'User not found' });
    return res.json({ success: true, data: mapUserDetail(row) });
  } catch (err) { next(err); }
});

// ─── Update user profile ──────────────────────────────────────────────────────

router.put('/users/:id', requirePermission('USER_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const { displayName, email, isActive } = req.body ?? {};
    if (displayName === undefined && email === undefined && isActive === undefined) {
      return res.status(400).json({ success: false, userMessage: 'At least one field is required: displayName, email, isActive' });
    }

    const normalizedIsActive = typeof isActive === 'boolean'
      ? isActive
      : isActive === 'true'
      ? true
      : isActive === 'false'
      ? false
      : null;

    const row = await db.transaction(async client => {
      await setSession(client, callerId);
      await client.query(
        `CALL gov.pr_update_user_profile($1::uuid, $2, $3, $4)`,
        [req.params.id, email ?? null, displayName ?? null, normalizedIsActive],
      );
      const r = await client.query(
        `SELECT user_id, email_address, user_full_name, is_account_active, created_dtm, last_login_dtm, roles_json
         FROM gov.fn_get_user_detail($1::uuid)`,
        [req.params.id],
      );
      return r.rows[0] ?? null;
    });

    if (!row) return res.status(404).json({ success: false, userMessage: 'User not found' });
    return res.json({ success: true, data: mapUserDetail(row) });
  } catch (err: any) {
    if (err?.code === 'P0002') return res.status(404).json({ success: false, userMessage: 'User not found' });
    if (err?.code === '23505') return res.status(409).json({ success: false, userMessage: 'Email address already exists' });
    return next(err);
  }
});

// ─── Roles list ────────────────────────────────────────────────────────────────

router.get('/roles', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, callerId);
      const r = await client.query(
        `SELECT role_id, role_display_name, role_desc_text, is_system_role_flag
         FROM gov.fn_get_roles()`,
      );
      const mapped = await Promise.all(
        r.rows.map(async (row: any) => {
          const detail = await client.query(
            `SELECT member_count
             FROM gov.fn_get_role_detail($1::uuid)`,
            [row.role_id],
          );
          return {
            roleId: row.role_id,
            roleName: row.role_display_name,
            description: row.role_desc_text,
            isSystemRole: row.is_system_role_flag,
            memberCount: parseInt(detail.rows[0]?.member_count ?? '0'),
          };
        }),
      );
      return mapped;
    });
    return res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Role detail ─────────────────────────────────────────────────────────────

router.get('/roles/:id', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const data = await db.transaction(async client => {
      await setSession(client, callerId);
      const [detailResult, membersResult, permsResult] = await Promise.all([
        client.query(
          `SELECT
             role_id,
             role_display_name,
             role_desc_text,
             is_system_role_flag,
             created_dtm,
             member_count
           FROM gov.fn_get_role_detail($1::uuid)`,
          [req.params.id],
        ),
        client.query(
          `SELECT user_id, user_full_name, email_address, is_account_active, granted_dtm
           FROM gov.fn_get_role_members($1::uuid)`,
          [req.params.id],
        ),
        client.query(
          `SELECT
             permission_id,
             perm_code_name,
             perm_display_name,
             perm_desc_text,
             is_assigned
           FROM gov.fn_get_role_permission_map($1::uuid)`,
          [req.params.id],
        ),
      ]);
      const detail = detailResult.rows[0] ?? null;
      if (!detail) return null;
      return {
        roleId: detail.role_id,
        roleName: detail.role_display_name,
        description: detail.role_desc_text,
        isSystemRole: detail.is_system_role_flag,
        createdOn: detail.created_dtm,
        memberCount: parseInt(detail.member_count ?? '0'),
        members: membersResult.rows.map((member: any) => ({
          userId: member.user_id,
          displayName: member.user_full_name,
          email: member.email_address,
          isActive: member.is_account_active,
          grantedOn: member.granted_dtm ?? null,
        })),
        permissions: permsResult.rows.map(mapRolePermission),
      };
    });
    if (!data) return res.status(404).json({ success: false, userMessage: 'Role not found' });
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

// ─── Create role ─────────────────────────────────────────────────────────────

router.post('/roles', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const roleName = typeof req.body?.roleName === 'string' ? req.body.roleName.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description : null;
    if (!roleName) {
      return res.status(400).json({ success: false, userMessage: 'roleName is required' });
    }
    const data = await db.transaction(async client => {
      await setSession(client, callerId);
      const created = await client.query(
        `CALL gov.pr_create_role($1, $2, null)`,
        [roleName, description],
      );
      const roleId = created.rows[0]?.p_role_id as string | undefined;
      if (!roleId) return null;
      const detail = await client.query(
        `SELECT role_id, role_display_name, role_desc_text, is_system_role_flag, created_dtm, member_count
         FROM gov.fn_get_role_detail($1::uuid)`,
        [roleId],
      );
      return detail.rows[0] ?? null;
    });
    if (!data) {
      return res.status(500).json({ success: false, userMessage: 'Role could not be created' });
    }
    return res.status(201).json({
      success: true,
      data: {
        roleId: data.role_id,
        roleName: data.role_display_name,
        description: data.role_desc_text,
        isSystemRole: data.is_system_role_flag,
        createdOn: data.created_dtm,
        memberCount: parseInt(data.member_count ?? '0'),
      },
    });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ success: false, userMessage: 'Role name already exists' });
    return next(err);
  }
});

// ─── Update role profile ─────────────────────────────────────────────────────

router.put('/roles/:id', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const roleName = typeof req.body?.roleName === 'string' ? req.body.roleName : null;
    const description = typeof req.body?.description === 'string' ? req.body.description : null;
    const data = await db.transaction(async client => {
      await setSession(client, callerId);
      await client.query(
        `CALL gov.pr_update_role_profile($1::uuid, $2, $3)`,
        [req.params.id, roleName, description],
      );
      const detail = await client.query(
        `SELECT role_id, role_display_name, role_desc_text, is_system_role_flag, created_dtm, member_count
         FROM gov.fn_get_role_detail($1::uuid)`,
        [req.params.id],
      );
      return detail.rows[0] ?? null;
    });
    if (!data) return res.status(404).json({ success: false, userMessage: 'Role not found' });
    return res.json({
      success: true,
      data: {
        roleId: data.role_id,
        roleName: data.role_display_name,
        description: data.role_desc_text,
        isSystemRole: data.is_system_role_flag,
        createdOn: data.created_dtm,
        memberCount: parseInt(data.member_count ?? '0'),
      },
    });
  } catch (err: any) {
    if (err?.code === 'P0002') return res.status(404).json({ success: false, userMessage: 'Role not found' });
    if (err?.code === 'P0001') return res.status(409).json({ success: false, userMessage: 'System role name cannot be changed' });
    if (err?.code === '23505') return res.status(409).json({ success: false, userMessage: 'Role name already exists' });
    return next(err);
  }
});

// ─── Role members ────────────────────────────────────────────────────────────

router.get('/roles/:id/members', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, callerId);
      const result = await client.query(
        `SELECT user_id, user_full_name, email_address, is_account_active, granted_dtm
         FROM gov.fn_get_role_members($1::uuid)`,
        [req.params.id],
      );
      return result.rows.map((row: any) => ({
        userId: row.user_id,
        displayName: row.user_full_name,
        email: row.email_address,
        isActive: row.is_account_active,
        grantedOn: row.granted_dtm ?? null,
      }));
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/roles/:id/members', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const targetUserId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    if (!targetUserId) return res.status(400).json({ success: false, userMessage: 'userId is required' });
    await db.transaction(async client => {
      await setSession(client, callerId);
      await client.query(
        `CALL gov.pr_assign_user_role($1::uuid, $2::uuid)`,
        [targetUserId, req.params.id],
      );
    });
    return res.status(201).json({ success: true });
  } catch (err) {
    return next(err);
  }
});

router.delete('/roles/:id/members/:uid', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    await db.transaction(async client => {
      await setSession(client, callerId);
      await client.query(
        `CALL gov.pr_revoke_user_role($1::uuid, $2::uuid)`,
        [req.params.uid, req.params.id],
      );
    });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ─── Role permissions ────────────────────────────────────────────────────────

router.get('/roles/:id/permissions', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, callerId);
      const result = await client.query(
        `SELECT
           permission_id,
           perm_code_name,
           perm_display_name,
           perm_desc_text,
           is_assigned
         FROM gov.fn_get_role_permission_map($1::uuid)`,
        [req.params.id],
      );
      return result.rows.map(mapRolePermission);
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.put('/roles/:id/permissions', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const permissionIds = Array.isArray(req.body?.permissionIds)
      ? req.body.permissionIds.filter((v: unknown): v is string => typeof v === 'string')
      : [];
    await db.transaction(async client => {
      await setSession(client, callerId);
      await client.query(
        `CALL gov.pr_replace_role_permissions($1::uuid, $2::uuid[])`,
        [req.params.id, permissionIds],
      );
    });
    return res.json({ success: true });
  } catch (err: any) {
    if (err?.code === 'P0002') return res.status(404).json({ success: false, userMessage: 'Role not found' });
    return next(err);
  }
});

// ─── Permissions list ──────────────────────────────────────────────────────────

router.get('/permissions', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, callerId);
      const r = await client.query(`
        SELECT permission_id, perm_code_name, perm_display_name, perm_desc_text
        FROM gov.fn_get_permissions()
      `);
      return r.rows.map((row: any) => ({
        permId:   row.permission_id,
        permCode: row.perm_code_name,
        permDisplayName: row.perm_display_name,
        permDesc: row.perm_desc_text,
      }));
    });
    return res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Assign global role to user ────────────────────────────────────────────────

router.post('/users/:id/roles', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const { roleId } = req.body;
    if (!roleId) return res.status(400).json({ success: false, userMessage: 'roleId is required' });
    await db.transaction(async client => {
      await setSession(client, callerId);
      await client.query(
        `CALL gov.pr_assign_user_role($1::uuid, $2::uuid)`,
        [req.params.id, roleId],
      );
    });
    log.info('governance.role.assign', 'Role assigned to user', { targetUserId: req.params.id, roleId, callerId });
    return res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Revoke global role from user ──────────────────────────────────────────────

router.delete('/users/:id/roles/:roleId', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    await db.transaction(async client => {
      await setSession(client, callerId);
      await client.query(
        `CALL gov.pr_revoke_user_role($1::uuid, $2::uuid)`,
        [req.params.id, req.params.roleId],
      );
    });
    log.info('governance.role.revoke', 'Role revoked from user', { targetUserId: req.params.id, roleId: req.params.roleId, callerId });
    return res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Project members list ──────────────────────────────────────────────────────

router.get('/projects/:pid/members', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, callerId);
      const r = await client.query(
        `SELECT
           project_id,
           user_id,
           user_full_name,
           email_address,
           role_id,
           role_display_name,
           granted_dtm
         FROM gov.fn_get_project_user_role_grants($1::uuid)`,
        [req.params.pid],
      );
      return r.rows.map((row: any) => ({
        userId:      row.user_id,
        displayName: row.user_full_name,
        email:       row.email_address,
        roleId:      row.role_id,
        roleName:    row.role_display_name,
        grantedOn:   row.granted_dtm,
      }));
    });
    return res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Add project member ────────────────────────────────────────────────────────

router.post('/projects/:pid/members', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const { userId, roleId } = req.body;
    if (!userId || !roleId) return res.status(400).json({ success: false, userMessage: 'userId and roleId are required' });
    await db.transaction(async client => {
      await setSession(client, callerId);
      await client.query(
        `CALL gov.pr_grant_project_user_role($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
        [req.params.pid, userId, roleId, callerId],
      );
    });
    return res.status(201).json({ success: true });
  } catch (err) { next(err); }
});

// ─── Remove project member ────────────────────────────────────────────────────

router.delete('/projects/:pid/members/:uid', requirePermission('ROLE_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    await db.transaction(async client => {
      await setSession(client, callerId);
      await client.query(
        `CALL gov.pr_revoke_project_user_membership($1::uuid, $2::uuid)`,
        [req.params.pid, req.params.uid],
      );
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export { router as governanceRouter };
