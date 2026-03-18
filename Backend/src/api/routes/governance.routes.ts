/**
 * Governance Routes
 *
 * GET    /api/governance/users                      — List all users (metadata only)
 * GET    /api/governance/users/:id                  — Get user detail
 * GET    /api/governance/roles                      — List all roles
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

const router = Router();
const log = LoggerFactory.get('governance');
router.use(userIdMiddleware);

function getCallerId(res: Response): string {
  return (res.locals['userId'] as string) ?? 'system';
}

async function setSession(client: any, userId: string) {
  const key = process.env['APP_ENCRYPTION_KEY'] ?? 'default-key';
  await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
  await client.query(`SET LOCAL app.encryption_key = '${key.replace(/'/g, "''")}'`);
}

// ─── Users list ────────────────────────────────────────────────────────────────

router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, callerId);
      const r = await client.query(`
        SELECT
          u.user_id,
          u.email_address,
          u.user_full_name,
          u.is_account_active,
          u.created_dtm,
          u.last_login_dtm
        FROM etl.users u
        ORDER BY u.user_full_name
      `);
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

router.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const row = await db.transaction(async client => {
      await setSession(client, callerId);
      const r = await client.query(`
        SELECT
          u.user_id,
          u.email_address,
          u.user_full_name,
          u.is_account_active,
          u.created_dtm,
          u.last_login_dtm,
          COALESCE(
            json_agg(DISTINCT jsonb_build_object('roleId', r.role_id, 'roleName', r.role_display_name))
            FILTER (WHERE r.role_id IS NOT NULL),
            '[]'
          ) AS roles
        FROM etl.users u
        LEFT JOIN gov.user_roles ur ON ur.user_id = u.user_id
        LEFT JOIN gov.roles r ON r.role_id = ur.role_id
        WHERE u.user_id = $1
        GROUP BY u.user_id
      `, [req.params.id]);
      return r.rows[0] ?? null;
    });
    if (!row) return res.status(404).json({ success: false, userMessage: 'User not found' });
    return res.json({ success: true, data: {
      userId:      row.user_id,
      email:       row.email_address,
      displayName: row.user_full_name,
      isActive:    row.is_account_active,
      createdOn:   row.created_dtm,
      lastLogin:   row.last_login_dtm,
      roles:       row.roles ?? [],
    }});
  } catch (err) { next(err); }
});

// ─── Roles list ────────────────────────────────────────────────────────────────

router.get('/roles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, callerId);
      const r = await client.query(`
        SELECT
          r.role_id,
          r.role_display_name,
          r.role_desc_text,
          r.created_dtm,
          COUNT(DISTINCT ur.user_id) AS member_count
        FROM gov.roles r
        LEFT JOIN gov.user_roles ur ON ur.role_id = r.role_id
        GROUP BY r.role_id
        ORDER BY r.role_display_name
      `);
      return r.rows.map((row: any) => ({
        roleId:      row.role_id,
        roleName:    row.role_display_name,
        description: row.role_desc_text,
        createdOn:   row.created_dtm,
        memberCount: parseInt(row.member_count ?? '0'),
      }));
    });
    return res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Permissions list ──────────────────────────────────────────────────────────

router.get('/permissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, callerId);
      const r = await client.query(`
        SELECT perm_id, perm_code_name, perm_desc_text
        FROM gov.permissions
        ORDER BY perm_code_name
      `);
      return r.rows.map((row: any) => ({
        permId:   row.perm_id,
        permCode: row.perm_code_name,
        permDesc: row.perm_desc_text,
      }));
    });
    return res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Assign global role to user ────────────────────────────────────────────────

router.post('/users/:id/roles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const { roleId } = req.body;
    if (!roleId) return res.status(400).json({ success: false, userMessage: 'roleId is required' });
    await db.transaction(async client => {
      await setSession(client, callerId);
      await client.query(`
        INSERT INTO gov.user_roles (user_id, role_id, granted_by_user_id)
        VALUES ($1::uuid, $2::uuid, $3::uuid)
        ON CONFLICT (user_id, role_id) DO NOTHING
      `, [req.params.id, roleId, callerId]);
    });
    log.info('governance.role.assign', 'Role assigned to user', { targetUserId: req.params.id, roleId, callerId });
    return res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Revoke global role from user ──────────────────────────────────────────────

router.delete('/users/:id/roles/:roleId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    await db.transaction(async client => {
      await setSession(client, callerId);
      await client.query(`
        DELETE FROM gov.user_roles
        WHERE user_id = $1::uuid AND role_id = $2::uuid
      `, [req.params.id, req.params.roleId]);
    });
    log.info('governance.role.revoke', 'Role revoked from user', { targetUserId: req.params.id, roleId: req.params.roleId, callerId });
    return res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Project members list ──────────────────────────────────────────────────────

router.get('/projects/:pid/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, callerId);
      const r = await client.query(`
        SELECT
          pur.user_id,
          u.user_full_name,
          u.email_address,
          r.role_id,
          r.role_display_name,
          pur.granted_dtm
        FROM gov.project_user_roles pur
        JOIN etl.users u ON u.user_id = pur.user_id
        JOIN gov.roles r ON r.role_id = pur.role_id
        WHERE pur.project_id = $1::uuid
        ORDER BY u.user_full_name
      `, [req.params.pid]);
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

router.post('/projects/:pid/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    const { userId, roleId } = req.body;
    if (!userId || !roleId) return res.status(400).json({ success: false, userMessage: 'userId and roleId are required' });
    await db.transaction(async client => {
      await setSession(client, callerId);
      await client.query(`
        INSERT INTO gov.project_user_roles (project_id, user_id, role_id, granted_by_user_id)
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid)
        ON CONFLICT (project_id, user_id, role_id) DO NOTHING
      `, [req.params.pid, userId, roleId, callerId]);
    });
    return res.status(201).json({ success: true });
  } catch (err) { next(err); }
});

// ─── Remove project member ────────────────────────────────────────────────────

router.delete('/projects/:pid/members/:uid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerId = getCallerId(res);
    await db.transaction(async client => {
      await setSession(client, callerId);
      await client.query(`
        DELETE FROM gov.project_user_roles
        WHERE project_id = $1::uuid AND user_id = $2::uuid
      `, [req.params.pid, req.params.uid]);
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export { router as governanceRouter };
