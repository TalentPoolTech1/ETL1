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

const router = Router();
router.use(userIdMiddleware);
const log = LoggerFactory.get('orchestrators');



function getUserId(res: Response): string {
  return (res.locals['userId'] as string) ?? 'system';
}
async function setSession(client: any, userId: string) {
  const key = process.env['APP_ENCRYPTION_KEY'] ?? 'default-key';
  await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
  await client.query(`SET LOCAL app.encryption_key = '${key.replace(/'/g, "''")}'`);
}

async function resolveEnvironmentId(client: any, environment?: string): Promise<string | null> {
  const envName = environment?.trim();
  if (!envName) return null;
  const r = await client.query(
    `SELECT env_id
     FROM execution.environments
     WHERE lower(env_display_name) = lower($1)
     LIMIT 1`,
    [envName],
  );
  return (r.rows[0]?.env_id as string | undefined) ?? null;
}

// ─── Global orchestrators (project_id IS NULL) — before /:id ─────────────────

router.get('/global', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT orch_id, project_id, folder_id, orch_display_name, orch_desc_text,
                created_dtm, updated_dtm
         FROM catalog.orchestrators
         WHERE project_id IS NULL
         ORDER BY orch_display_name`
      );
      return r.rows;
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── List orchestrators (optionally filtered by projectId) ───────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const projectId = req.query['projectId'] as string | undefined;
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      if (projectId) {
        const r = await client.query(
          `SELECT orch_id, project_id, folder_id, orch_display_name, orch_desc_text, created_dtm, updated_dtm
           FROM catalog.orchestrators
           WHERE project_id = $1::uuid
           ORDER BY orch_display_name`,
          [projectId],
        );
        return r.rows;
      }

      const r = await client.query(
        `SELECT orch_id, project_id, folder_id, orch_display_name, orch_desc_text, created_dtm, updated_dtm
         FROM catalog.orchestrators
         ORDER BY orch_display_name`,
      );
      return r.rows;
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ─── Get orchestrator ──────────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT orch_id, project_id, folder_id, orch_display_name, orch_desc_text,
                dag_definition_json, created_dtm, updated_dtm
         FROM catalog.orchestrators WHERE orch_id = $1`,
        [req.params.id]
      );
      return r.rows[0] ?? null;
    });
    if (!row) return res.status(404).json({ success: false, userMessage: 'Orchestrator not found' });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

// ─── Create orchestrator — projectId + folderId both optional ─────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { projectId, orchDisplayName, orchDescText, folderId } = req.body;
    if (!orchDisplayName?.trim())
      return res.status(400).json({ success: false, userMessage: 'orchDisplayName is required' });
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `INSERT INTO catalog.orchestrators
           (project_id, folder_id, orch_display_name, orch_desc_text, created_by_user_id, updated_by_user_id)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $5::uuid)
         RETURNING orch_id, project_id, folder_id, orch_display_name, orch_desc_text, created_dtm, updated_dtm`,
        [projectId ?? null, folderId ?? null, orchDisplayName.trim(), orchDescText ?? null, userId]
      );
      return r.rows[0];
    });
    log.info('orchestrator.create', 'Orchestrator created', { orchId: row.orch_id, projectId: projectId ?? null, userId });
    res.status(201).json({ success: true, data: row });
  } catch (err) { log.warn('orchestrator.create', 'Orchestrator creation failed', { error: (err as Error).message }); next(err); }
});

// ─── Update orchestrator ───────────────────────────────────────────────────────

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { orchDisplayName, orchDescText, dagDefinitionJson } = req.body;
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `UPDATE catalog.orchestrators
         SET orch_display_name   = COALESCE($2, orch_display_name),
             orch_desc_text      = COALESCE($3, orch_desc_text),
             dag_definition_json = COALESCE($4::jsonb, dag_definition_json),
             updated_by_user_id  = $5::uuid,
             updated_dtm         = CURRENT_TIMESTAMP
         WHERE orch_id = $1
         RETURNING orch_id, orch_display_name, orch_desc_text, updated_dtm`,
        [req.params.id, orchDisplayName ?? null, orchDescText ?? null,
         dagDefinitionJson ? JSON.stringify(dagDefinitionJson) : null, userId]
      );
      return r.rows[0] ?? null;
    });
    if (!row) return res.status(404).json({ success: false, userMessage: 'Orchestrator not found' });
    log.info('orchestrator.update', 'Orchestrator updated', { orchId: req.params.id, userId });
    res.json({ success: true, data: row });
  } catch (err) { log.warn('orchestrator.update', 'Orchestrator update failed', { orchId: req.params.id, error: (err as Error).message }); next(err); }
});

// ─── Delete orchestrator ───────────────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const deleted = await db.transaction(async client => {
      await setSession(client, userId);
      const exists = await client.query(`SELECT 1 FROM catalog.orchestrators WHERE orch_id = $1::uuid`, [req.params.id]);
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

router.post('/:id/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { environment, concurrency } = (req.body ?? {}) as { environment?: string; concurrency?: string };
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const orchRow = await client.query(
        `SELECT orch_id FROM catalog.orchestrators WHERE orch_id = $1`, [req.params.id]);
      if (!orchRow.rows[0]) throw new Error('Orchestrator not found');
      const envId = await resolveEnvironmentId(client, environment);
      const r = await client.query(
        `CALL execution.pr_initialize_orchestrator_run($1::uuid, $2::uuid, $3::uuid, null, $4)`,
        [req.params.id, envId, userId, 'MANUAL'],
      );
      return { orch_run_id: r.rows[0].p_orch_run_id as string, environmentApplied: Boolean(envId) };
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
  } catch (err) { log.warn('orchestrator.run', 'Orchestrator run trigger failed', { orchId: req.params.id, error: (err as Error).message }); next(err); }
});

// ─── Permissions ───────────────────────────────────────────────────────────────

router.get('/:id/permissions', (_req, res) =>
  res.json({ success: true, data: { grants: [], inheritFromProject: true } }));

router.put('/:id/permissions', (_req, res) => res.json({ success: true }));

// ─── Audit logs ────────────────────────────────────────────────────────────────

router.get('/:id/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const limit  = parseInt(String(req.query['limit'] ?? 50));
    const offset = parseInt(String(req.query['offset'] ?? 0));
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT h.hist_id AS id, h.hist_action_dtm AS timestamp,
                h.hist_action_by AS user_id, h.hist_action_cd AS action_code
         FROM history.orchestrators_history h
         WHERE h.orch_id = $1 ORDER BY h.hist_action_dtm DESC LIMIT $2 OFFSET $3`,
        [req.params.id, limit, offset]);
      return r.rows.map((row: any) => ({
        id: String(row.id), timestamp: row.timestamp, user: row.user_id ?? 'system',
        action: row.action_code === 'U' ? 'ORCHESTRATOR_SAVED' : row.action_code === 'I' ? 'ORCHESTRATOR_CREATED' : 'ORCHESTRATOR_DELETED',
        summary: `Orchestrator ${row.action_code === 'U' ? 'updated' : row.action_code === 'I' ? 'created' : 'deleted'}`,
      }));
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

export { router as orchestratorsRouter };
