/**
 * Projects Routes
 *
 * GET    /api/projects                          — List all projects
 * POST   /api/projects                          — Create a project
 * GET    /api/projects/:id                      — Get project by ID
 * PUT    /api/projects/:id                      — Update project
 * DELETE /api/projects/:id                      — Delete project
 * GET    /api/projects/:id/pipelines            — List ROOT-LEVEL pipelines (folder_id IS NULL)
 * GET    /api/projects/:id/orchestrators        — List ROOT-LEVEL orchestrators (folder_id IS NULL)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db/connection';
import { LoggerFactory } from '../../shared/logging';
import { userIdMiddleware } from '../middleware/user-id.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { AppErrors } from '../../shared/errors';

const router = Router();
const log = LoggerFactory.get('api');

router.use(userIdMiddleware);

function getUserId(res: Response): string {
  return (res.locals['userId'] as string) ?? 'system';
}

async function setSession(client: any, userId: string) {
  const key = process.env['APP_ENCRYPTION_KEY'];
  if (!key) throw new Error('APP_ENCRYPTION_KEY is required');
  await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
  await client.query(`SET LOCAL app.encryption_key = '${key.replace(/'/g, "''")}'`);
}

// ─── List projects ─────────────────────────────────────────────────────────────

router.get('/', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(`SELECT project_id, project_display_name, project_desc_text, created_dtm, updated_dtm FROM etl.fn_get_projects()`);
      return r.rows;
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Get project ───────────────────────────────────────────────────────────────

router.get('/:id', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT project_id, project_display_name, project_desc_text, created_dtm, updated_dtm
         FROM etl.fn_get_projects() WHERE project_id = $1`,
        [req.params.id]
      );
      return r.rows[0] ?? null;
    });
    if (!row) return res.status(404).json({ success: false, userMessage: 'Project not found' });
    return res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

// ─── Create project ────────────────────────────────────────────────────────────

router.post('/', requirePermission('PIPELINE_CREATE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { projectDisplayName, projectDescText } = req.body;
    if (!projectDisplayName?.trim()) {
      return next(AppErrors.gov.projectNameRequired());
    }
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r_call = await client.query(
        `CALL etl.pr_create_project($1, $2, $3::uuid, null)`,
        [projectDisplayName.trim(), projectDescText ?? null, userId]
      );
      const newProjectId = r_call.rows[0].project_id;
      const r_fetch = await client.query(
        `SELECT project_id, project_display_name, project_desc_text, created_dtm, updated_dtm
         FROM etl.fn_get_projects() WHERE project_id = $1`,
        [newProjectId]
      );
      return r_fetch.rows[0];
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err: any) {
    if (err.code === '23505' && err.constraint === 'projects_project_display_name_key') {
      return next(AppErrors.gov.projectDuplicateName(req.body.projectDisplayName));
    }
    return next(err);
  }
});

// ─── Update project ────────────────────────────────────────────────────────────

router.put('/:id', requirePermission('PIPELINE_EDIT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { projectDisplayName, projectDescText } = req.body;
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      await client.query(
        `CALL etl.pr_update_project($1, $2, $3, $4::uuid)`,
        [req.params.id, projectDisplayName ?? null, projectDescText ?? null, userId]
      );
      const r_fetch = await client.query(
        `SELECT project_id, project_display_name, project_desc_text, created_dtm, updated_dtm
         FROM etl.fn_get_projects() WHERE project_id = $1`,
        [req.params.id]
      );
      return r_fetch.rows[0] ?? null;
    });
    if (!row) return res.status(404).json({ success: false, userMessage: 'Project not found' });
    return res.json({ success: true, data: row });
  } catch (err: any) {
    if (err.code === '23505' && err.constraint === 'projects_project_display_name_key') {
      return next(AppErrors.gov.projectDuplicateName(req.body.projectDisplayName));
    }
    next(err);
  }
});

// ─── Delete project ────────────────────────────────────────────────────────────

router.delete('/:id', requirePermission('PIPELINE_DELETE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const deleted = await db.transaction(async client => {
      await setSession(client, userId);
      const check = await client.query(`SELECT 1 FROM etl.fn_get_projects() WHERE project_id = $1`, [req.params.id]);
      if (check.rowCount === 0) return false;
      await client.query(`CALL etl.pr_delete_project($1)`, [req.params.id]);
      return true;
    });
    if (!deleted) return res.status(404).json({ success: false, userMessage: 'Project not found' });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

// ─── List ROOT-LEVEL pipelines for project (folder_id IS NULL) ─────────────────
// Folder-scoped pipelines are retrieved via GET /api/folders/:id/pipelines

router.get('/:id/pipelines', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT pipeline_id, project_id, folder_id, pipeline_display_name,
                pipeline_desc_text, active_version_id, created_dtm, updated_dtm
         FROM catalog.fn_get_root_pipelines($1::uuid)`,
        [req.params.id]
      );
      return r.rows;
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── List ROOT-LEVEL orchestrators for project (folder_id IS NULL) ─────────────
// Folder-scoped orchestrators are retrieved via GET /api/folders/:id/orchestrators

router.get('/:id/orchestrators', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT orch_id, project_id, folder_id, orch_display_name,
                orch_desc_text, created_dtm, updated_dtm
         FROM catalog.fn_get_root_orchestrators($1::uuid)`,
        [req.params.id]
      );
      return r.rows;
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

export { router as projectsRouter };
