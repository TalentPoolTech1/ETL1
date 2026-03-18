/**
 * Orchestrators Routes
 *
 * GET    /api/orchestrators/global             — Global orchestrators (project_id IS NULL)
 * GET    /api/orchestrators/:id                — Get orchestrator
 * POST   /api/orchestrators                    — Create (projectId + folderId both optional)
 * PUT    /api/orchestrators/:id                — Update
 * DELETE /api/orchestrators/:id                — Delete
 * POST   /api/orchestrators/:id/run            — Trigger run
 * GET    /api/orchestrators/:id/permissions
 * PUT    /api/orchestrators/:id/permissions
 * GET    /api/orchestrators/:id/audit-logs
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db/connection';
import { userIdMiddleware } from '../middleware/user-id.middleware';
import { LoggerFactory } from '../../shared/logging';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();
router.use(userIdMiddleware);
const log = LoggerFactory.get('orchestrators');



function getUserId(res: Response): string {
  return (res.locals['userId'] as string) ?? 'system';
}
async function setSession(client: any, userId: string) {
  const key = process.env['APP_ENCRYPTION_KEY'];
  if (!key) throw new Error('APP_ENCRYPTION_KEY is required');
  await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
  await client.query(`SET LOCAL app.encryption_key = '${key.replace(/'/g, "''")}'`);
}

type PermissionGrantPayload = {
  id: string;
  userId: string;
  roleId: string;
  principal: string;
  principalType: 'user';
  role: string;
  inherited: true;
  expiry: null;
  grantedDtm: string | null;
};

function normalizePermissionGrants(rawGrants: unknown): Array<{ userId: string; roleId: string }> {
  if (!Array.isArray(rawGrants)) return [];
  const normalized = new Map<string, { userId: string; roleId: string }>();
  for (const grant of rawGrants) {
    const userId = typeof (grant as { userId?: unknown }).userId === 'string'
      ? (grant as { userId: string }).userId.trim()
      : '';
    const roleId = typeof (grant as { roleId?: unknown }).roleId === 'string'
      ? (grant as { roleId: string }).roleId.trim()
      : '';
    if (!userId || !roleId) continue;
    normalized.set(`${userId}:${roleId}`, { userId, roleId });
  }
  return Array.from(normalized.values());
}

function mapPermissionGrantRows(rows: any[]): PermissionGrantPayload[] {
  return rows.map((row: any) => ({
    id: `${row.user_id}:${row.role_id}`,
    userId: String(row.user_id),
    roleId: String(row.role_id),
    principal: String(row.user_full_name ?? row.email_address ?? row.user_id),
    principalType: 'user',
    role: String(row.role_display_name ?? 'Viewer'),
    inherited: true,
    expiry: null,
    grantedDtm: row.granted_dtm ?? null,
  }));
}

async function resolveEnvironmentId(client: any, environment?: string): Promise<string | null> {
  const envName = environment?.trim();
  if (!envName) return null;
  const r = await client.query(
    `SELECT execution.fn_get_environment_id_by_name($1) AS env_id`,
    [envName],
  );
  return (r.rows[0]?.env_id as string | undefined) ?? null;
}

// ─── Global orchestrators (project_id IS NULL) — before /:id ─────────────────

router.get('/global', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const limit   = Math.min(parseInt(String(req.query['limit'] ?? '50'), 10), 200);
    const afterId = req.query['after'] as string | undefined;
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           orch_id,
           project_id,
           folder_id,
           orch_display_name,
           orch_desc_text,
           created_dtm,
           updated_dtm
         FROM catalog.fn_get_orchestrators(null::uuid)
         WHERE project_id IS NULL
           AND ($1::uuid IS NULL OR orch_id > $1::uuid)
         ORDER BY orch_id
         LIMIT $2`,
        [afterId ?? null, limit + 1],
      );
      return r.rows;
    });
    const hasMore = rows.length > limit;
    const page    = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor: string | null = hasMore ? page[page.length - 1].orch_id : null;
    res.json({ success: true, data: page, nextCursor });
  } catch (err) { next(err); }
});

// ─── List orchestrators (optionally filtered by projectId) ───────────────────

router.get('/', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const projectId = req.query['projectId'] as string | undefined;
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           orch_id,
           project_id,
           folder_id,
           orch_display_name,
           orch_desc_text,
           created_dtm,
           updated_dtm
         FROM catalog.fn_get_orchestrators($1::uuid)`,
        [projectId ?? null],
      );
      return r.rows;
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ─── Get orchestrator ──────────────────────────────────────────────────────────

router.get('/:id', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           orch_id,
           project_id,
           folder_id,
           orch_display_name,
           orch_desc_text,
           dag_definition_json,
           created_dtm,
           updated_dtm
         FROM catalog.fn_get_orchestrator_by_id($1::uuid)`,
        [req.params.id],
      );
      return r.rows[0] ?? null;
    });
    if (!row) return res.status(404).json({ success: false, userMessage: 'Orchestrator not found' });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

// ─── List pipelines in orchestrator (design-time map) ─────────────────────────

router.get('/:id/pipelines', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           pipeline_id,
           pipeline_display_name,
           pipeline_desc_text,
           active_version_id,
           created_dtm,
           updated_dtm
         FROM catalog.fn_get_pipelines_for_orchestrator($1::uuid)`,
        [req.params.id],
      );
      return r.rows;
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ─── Schedule (cron-based) ────────────────────────────────────────────────────

router.get('/:id/schedule', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           schedule_id,
           entity_type_code,
           entity_id,
           cron_expression_text,
           timezone_name_text,
           env_id,
           is_schedule_active,
           next_run_dtm,
           last_run_dtm,
           created_dtm,
           updated_dtm,
           created_by_user_id
         FROM execution.fn_get_entity_schedule('ORCHESTRATOR', $1::uuid)`,
        [req.params.id],
      );
      return r.rows[0] ?? null;
    });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id/schedule', requirePermission('PIPELINE_EDIT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { cronExpression, timezone, environment, isActive } = (req.body ?? {}) as {
      cronExpression?: string;
      timezone?: string;
      environment?: string;
      isActive?: boolean;
    };
    if (!cronExpression?.trim()) {
      return res.status(400).json({ success: false, userMessage: 'cronExpression is required' });
    }

    const saved = await db.transaction(async client => {
      await setSession(client, userId);
      const envId = await resolveEnvironmentId(client, environment);
      const r = await client.query(
        `CALL execution.pr_set_entity_schedule('ORCHESTRATOR', $1::uuid, $2, $3, $4::uuid, $5, $6::uuid, null)`,
        [req.params.id, cronExpression.trim(), (timezone ?? 'UTC').trim(), envId, isActive ?? true, userId],
      );
      const scheduleId = r.rows[0]?.p_schedule_id as string | undefined;
      const getR = await client.query(
        `SELECT
           schedule_id,
           entity_type_code,
           entity_id,
           cron_expression_text,
           timezone_name_text,
           env_id,
           is_schedule_active,
           next_run_dtm,
           last_run_dtm,
           created_dtm,
           updated_dtm,
           created_by_user_id
         FROM execution.fn_get_entity_schedule('ORCHESTRATOR', $1::uuid)`,
        [req.params.id],
      );
      return { scheduleId: scheduleId ?? null, row: getR.rows[0] ?? null };
    });

    log.info('orchestrators.scheduleSave', 'Orchestrator schedule saved', { orchId: req.params.id, userId });
    return res.json({ success: true, data: saved.row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id/schedule', requirePermission('PIPELINE_EDIT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    await db.transaction(async client => {
      await setSession(client, userId);
      await client.query(`CALL execution.pr_delete_entity_schedule('ORCHESTRATOR', $1::uuid)`, [req.params.id]);
    });
    log.info('orchestrators.scheduleDelete', 'Orchestrator schedule deleted', { orchId: req.params.id, userId });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ─── Create orchestrator — projectId + folderId both optional ─────────────────

router.post('/', requirePermission('PIPELINE_CREATE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { projectId, orchDisplayName, orchDescText, folderId } = req.body;
    if (!orchDisplayName?.trim())
      return res.status(400).json({ success: false, userMessage: 'orchDisplayName is required' });
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const created = await client.query<{ p_orch_id: string }>(
        `CALL catalog.pr_create_orchestrator($1::uuid, $2::uuid, $3, $4::jsonb, $5::uuid, null)`,
        [projectId ?? null, folderId ?? null, orchDisplayName.trim(), JSON.stringify({}), userId],
      );
      const orchId = created.rows[0].p_orch_id;
      const r = await client.query(
        `SELECT
           orch_id,
           project_id,
           folder_id,
           orch_display_name,
           orch_desc_text,
           created_dtm,
           updated_dtm
         FROM catalog.fn_get_orchestrator_by_id($1::uuid)`,
        [orchId],
      );
      return r.rows[0];
    });
    log.info('orchestrator.create', 'Orchestrator created', { orchId: row.orch_id, projectId: projectId ?? null, userId });
    res.status(201).json({ success: true, data: row });
  } catch (err) { log.warn('orchestrator.create', 'Orchestrator creation failed', { error: (err as Error).message }); next(err); }
});

// ─── Update orchestrator ───────────────────────────────────────────────────────

router.put('/:id', requirePermission('PIPELINE_EDIT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { orchDisplayName, orchDescText, dagDefinitionJson } = req.body;
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      await client.query(
        `CALL catalog.pr_update_orchestrator($1::uuid, $2, $3, $4::jsonb, $5::uuid)`,
        [req.params.id, orchDisplayName ?? null, orchDescText ?? null,
         dagDefinitionJson ? JSON.stringify(dagDefinitionJson) : null, userId],
      );
      const r = await client.query(
        `SELECT orch_id, orch_display_name, orch_desc_text, updated_dtm
         FROM catalog.fn_get_orchestrator_by_id($1::uuid)`,
        [req.params.id],
      );
      return r.rows[0] ?? null;
    });
    if (!row) return res.status(404).json({ success: false, userMessage: 'Orchestrator not found' });
    log.info('orchestrator.update', 'Orchestrator updated', { orchId: req.params.id, userId });
    res.json({ success: true, data: row });
  } catch (err) { log.warn('orchestrator.update', 'Orchestrator update failed', { orchId: req.params.id, error: (err as Error).message }); next(err); }
});

// ─── Delete orchestrator ───────────────────────────────────────────────────────

router.delete('/:id', requirePermission('PIPELINE_DELETE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const deleted = await db.transaction(async client => {
      await setSession(client, userId);
      const exists = await client.query(`SELECT orch_id FROM catalog.fn_get_orchestrator_by_id($1::uuid)`, [req.params.id]);
      if (!exists.rowCount) return false;
      await client.query(`CALL catalog.pr_delete_orchestrator($1::uuid)`, [req.params.id]);
      return true;
    });
    if (!deleted) return res.status(404).json({ success: false, userMessage: 'Orchestrator not found' });
    log.info('orchestrator.delete', 'Orchestrator deleted', { orchId: req.params.id, userId });
    res.json({ success: true });
  } catch (err) { log.warn('orchestrator.delete', 'Orchestrator delete failed', { orchId: req.params.id, error: (err as Error).message }); next(err); }
});

// ─── Trigger run ───────────────────────────────────────────────────────────────

router.post('/:id/run', requirePermission('PIPELINE_RUN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { environment, concurrency } = (req.body ?? {}) as { environment?: string; concurrency?: string };
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const envId = await resolveEnvironmentId(client, environment);
      const r = await client.query(
        `CALL execution.pr_initialize_orchestrator_run($1::uuid, $2::uuid, $3::uuid, null, $4)`,
        [req.params.id, envId, userId, 'MANUAL'],
      );
      const orchRunId = r.rows[0].p_orch_run_id as string;

      await client.query(
        `CALL execution.pr_set_orchestrator_run_options($1::uuid, $2::jsonb)`,
        [
          orchRunId,
          JSON.stringify({
            environment: environment?.trim() || null,
            concurrency: concurrency?.trim() || null,
            requestedBy: userId,
          }),
        ],
      );

      return { orch_run_id: orchRunId, environmentApplied: Boolean(envId) };
    });
    log.info('orchestrator.run', 'Orchestrator run triggered', {
      orchId: req.params.id,
      runId: row.orch_run_id,
      userId,
      environment: environment ?? null,
      concurrency: concurrency ?? null,
      environmentApplied: row.environmentApplied,
    });
    res.status(202).json({
      success: true,
      data: {
        orchRunId: row.orch_run_id,
        environment: environment ?? null,
        concurrency: concurrency ?? null,
        environmentApplied: row.environmentApplied,
      },
    });
  } catch (err: any) {
    if (err?.code === '23503') {
      return res.status(404).json({ success: false, userMessage: 'Orchestrator not found' });
    }
    log.warn('orchestrator.run', 'Orchestrator run trigger failed', { orchId: req.params.id, error: (err as Error).message });
    next(err);
  }
});

// ─── Permissions ───────────────────────────────────────────────────────────────

router.get('/:id/permissions', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const result = await db.transaction(async client => {
      await setSession(client, userId);
      const contextResult = await client.query(
        `SELECT orch_id, project_id
         FROM catalog.fn_get_orchestrator_by_id($1::uuid)`,
        [req.params.id],
      );
      const context = contextResult.rows[0] ?? null;
      if (!context) throw Object.assign(new Error('Orchestrator not found'), { status: 404 });
      if (!context.project_id) {
        return { projectScoped: false, grants: [] as PermissionGrantPayload[] };
      }

      const grantsResult = await client.query(
        `SELECT project_id, user_id, role_id, user_full_name, email_address, role_display_name, granted_dtm
         FROM catalog.fn_get_orchestrator_permission_grants($1::uuid)`,
        [req.params.id],
      );
      return { projectScoped: true, grants: mapPermissionGrantRows(grantsResult.rows) };
    });

    return res.json({
      success: true,
      data: {
        grants: result.grants,
        inheritFromProject: result.projectScoped,
        projectScoped: result.projectScoped,
      },
    });
  } catch (err: any) {
    if (err?.status === 404) return res.status(404).json({ success: false, userMessage: 'Orchestrator not found' });
    return next(err);
  }
});

router.put('/:id/permissions', requirePermission('PIPELINE_EDIT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const desiredGrants = normalizePermissionGrants((req.body ?? {}).grants);
    const desiredMap = new Map(desiredGrants.map(g => [`${g.userId}:${g.roleId}`, g]));
    const result = await db.transaction(async client => {
      await setSession(client, userId);
      const contextResult = await client.query(
        `SELECT orch_id, project_id
         FROM catalog.fn_get_orchestrator_by_id($1::uuid)`,
        [req.params.id],
      );
      const context = contextResult.rows[0] ?? null;
      if (!context) throw Object.assign(new Error('Orchestrator not found'), { status: 404 });
      if (!context.project_id) {
        if (desiredGrants.length > 0) {
          throw Object.assign(new Error('Global orchestrators do not support project-member permission changes'), { status: 409 });
        }
        return { projectScoped: false, grants: [] as PermissionGrantPayload[] };
      }

      const currentResult = await client.query(
        `SELECT project_id, user_id, role_id, user_full_name, email_address, role_display_name, granted_dtm
         FROM catalog.fn_get_orchestrator_permission_grants($1::uuid)`,
        [req.params.id],
      );
      const currentRows = currentResult.rows;
      const currentMap = new Map(currentRows.map((row: any) => [`${row.user_id}:${row.role_id}`, row]));

      for (const desired of desiredGrants) {
        if (!currentMap.has(`${desired.userId}:${desired.roleId}`)) {
          await client.query(
            `CALL catalog.pr_grant_orchestrator_permission($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
            [req.params.id, desired.userId, desired.roleId, userId],
          );
        }
      }

      for (const row of currentRows) {
        const key = `${row.user_id}:${row.role_id}`;
        if (!desiredMap.has(key)) {
          await client.query(
            `CALL catalog.pr_revoke_orchestrator_permission($1::uuid, $2::uuid, $3::uuid)`,
            [req.params.id, row.user_id, row.role_id],
          );
        }
      }

      const finalResult = await client.query(
        `SELECT project_id, user_id, role_id, user_full_name, email_address, role_display_name, granted_dtm
         FROM catalog.fn_get_orchestrator_permission_grants($1::uuid)`,
        [req.params.id],
      );
      return { projectScoped: true, grants: mapPermissionGrantRows(finalResult.rows) };
    });

    return res.json({
      success: true,
      data: {
        grants: result.grants,
        inheritFromProject: result.projectScoped,
        projectScoped: result.projectScoped,
      },
    });
  } catch (err: any) {
    if (err?.status === 404) return res.status(404).json({ success: false, userMessage: 'Orchestrator not found' });
    if (err?.status === 409) return res.status(409).json({ success: false, userMessage: err.message });
    if (err?.code === 'P0002') return res.status(404).json({ success: false, userMessage: 'Orchestrator not found or inaccessible' });
    return next(err);
  }
});

// ─── Audit logs ────────────────────────────────────────────────────────────────

router.get('/:id/audit-logs', requirePermission('AUDIT_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const limit  = parseInt(String(req.query['limit'] ?? 50));
    const offset = parseInt(String(req.query['offset'] ?? 0));
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT id, action_dtm, user_id, action_code
         FROM catalog.fn_get_orchestrator_audit_logs($1::uuid, $2, $3)`,
        [req.params.id, limit, offset]);
      return r.rows.map((row: any) => ({
        id: String(row.id), timestamp: row.action_dtm, user: row.user_id ?? 'system',
        action: row.action_code === 'U' ? 'ORCHESTRATOR_SAVED' : row.action_code === 'I' ? 'ORCHESTRATOR_CREATED' : 'ORCHESTRATOR_DELETED',
        summary: `Orchestrator ${row.action_code === 'U' ? 'updated' : row.action_code === 'I' ? 'created' : 'deleted'}`,
      }));
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

export { router as orchestratorsRouter };
