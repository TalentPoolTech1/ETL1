/**
 * Folders Routes
 *
 * GET  /api/folders/project/:projectId     — List root folders for a project
 * GET  /api/folders/:id/children           — Get direct sub-folders
 * GET  /api/folders/:id/pipelines          — Get pipelines in this folder
 * GET  /api/folders/:id/orchestrators      — Get orchestrators in this folder
 * GET  /api/folders/:id                    — Get single folder
 * POST /api/folders                        — Create folder (root or sub-folder)
 * PUT  /api/folders/:id/rename             — Rename folder
 * DELETE /api/folders/:id                  — Delete folder (cascades children)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db/connection';
import { userIdMiddleware } from '../middleware/user-id.middleware';
import { LoggerFactory } from '../../shared/logging';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();
router.use(userIdMiddleware);
const log = LoggerFactory.get('folders');



function getUserId(res: Response): string {
  return (res.locals['userId'] as string) ?? 'system';
}

async function setSession(client: any, userId: string) {
  const key = process.env['APP_ENCRYPTION_KEY'];
  if (!key) throw new Error('APP_ENCRYPTION_KEY is required');
  await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
  await client.query(`SET LOCAL app.encryption_key = '${key.replace(/'/g, "''")}'`);
}

// ─── List root folders for a project ──────────────────────────────────────────

router.get('/project/:projectId', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT folder_id, project_id, parent_folder_id, folder_display_name,
                folder_type_code, created_dtm, updated_dtm
         FROM etl.fn_get_project_root_folders($1::uuid)`,
        [req.params.projectId]
      );
      return r.rows;
    });
    res.json({ success: true, data: rows.map(mapFolder) });
  } catch (err) { next(err); }
});

// ─── List sub-folders of a parent folder ──────────────────────────────────────

router.get('/:id/children', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT folder_id, project_id, parent_folder_id, folder_display_name,
                folder_type_code, created_dtm, updated_dtm
         FROM etl.fn_get_folder_children($1::uuid)`,
        [req.params.id]
      );
      return r.rows;
    });
    res.json({ success: true, data: rows.map(mapFolder) });
  } catch (err) { next(err); }
});

// ─── Get pipelines in a folder ────────────────────────────────────────────────

router.get('/:id/pipelines', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT pipeline_id, project_id, folder_id, pipeline_display_name,
                pipeline_desc_text, active_version_id, created_dtm, updated_dtm
         FROM catalog.fn_get_pipelines_by_folder($1::uuid)`,
        [req.params.id]
      );
      return r.rows;
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Get orchestrators in a folder ────────────────────────────────────────────

router.get('/:id/orchestrators', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT orch_id, project_id, folder_id, orch_display_name,
                orch_desc_text, created_dtm, updated_dtm
         FROM catalog.fn_get_orchestrators_by_folder($1::uuid)`,
        [req.params.id]
      );
      return r.rows;
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Get single folder ────────────────────────────────────────────────────────

router.get('/:id', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           folder_id,
           project_id,
           parent_folder_id,
           folder_display_name,
           folder_type_code,
           created_dtm,
           updated_dtm
         FROM etl.fn_get_folder_by_id($1::uuid)`,
        [req.params.id],
      );
      return r.rows[0] ?? null;
    });
    if (!row) return res.status(404).json({ success: false, userMessage: 'Folder not found' });
    res.json({ success: true, data: mapFolder(row) });
  } catch (err) { next(err); }
});

// ─── Create folder ────────────────────────────────────────────────────────────

router.post('/', requirePermission('PIPELINE_CREATE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { projectId, parentFolderId, folderDisplayName, folderTypeCode = 'PIPELINE' } = req.body;
    if (!projectId) return res.status(400).json({ success: false, userMessage: 'projectId is required' });
    if (!folderDisplayName?.trim()) return res.status(400).json({ success: false, userMessage: 'folderDisplayName is required' });

    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const created = await client.query<{ p_folder_id: string }>(
        `CALL etl.pr_create_folder($1::uuid, $2::uuid, $3, $4, null)`,
        [projectId, parentFolderId ?? null, folderDisplayName.trim(), folderTypeCode],
      );
      const folderId = created.rows[0].p_folder_id;
      const r = await client.query(
        `SELECT
           folder_id,
           project_id,
           parent_folder_id,
           folder_display_name,
           folder_type_code,
           created_dtm,
           updated_dtm
         FROM etl.fn_get_folder_by_id($1::uuid)`,
        [folderId],
      );
      return r.rows[0];
    });
    log.info('folders.create', 'Folder created', { folderId: row.folder_id, projectId, parentFolderId: parentFolderId ?? null, userId });
    res.status(201).json({ success: true, data: mapFolder(row) });
  } catch (err) { log.warn('folders.create', 'Folder creation failed', { error: (err as Error).message }); next(err); }
});

// ─── Rename folder ────────────────────────────────────────────────────────────

router.put('/:id/rename', requirePermission('PIPELINE_EDIT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { folderDisplayName } = req.body;
    if (!folderDisplayName?.trim()) return res.status(400).json({ success: false, userMessage: 'folderDisplayName is required' });
    await db.transaction(async client => {
      await setSession(client, userId);
      await client.query(
        `CALL etl.pr_rename_folder($1::uuid, $2)`,
        [req.params.id, folderDisplayName.trim()],
      );
    });
    log.info('folders.rename', 'Folder renamed', { folderId: req.params.id, newName: folderDisplayName.trim(), userId });
    res.json({ success: true });
  } catch (err) { log.warn('folders.rename', 'Folder rename failed', { folderId: req.params.id, error: (err as Error).message }); next(err); }
});

// ─── Delete folder (cascades children via FK) ─────────────────────────────────

router.delete('/:id', requirePermission('PIPELINE_DELETE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const deleted = await db.transaction(async client => {
      await setSession(client, userId);
      const exists = await client.query(`SELECT folder_id FROM etl.fn_get_folder_by_id($1::uuid)`, [req.params.id]);
      if (!exists.rowCount) return false;
      await client.query(`CALL etl.pr_delete_folder($1::uuid)`, [req.params.id]);
      return true;
    });
    if (!deleted) return res.status(404).json({ success: false, userMessage: 'Folder not found' });
    log.info('folders.delete', 'Folder deleted', { folderId: req.params.id, userId });
    res.json({ success: true });
  } catch (err) { log.warn('folders.delete', 'Folder delete failed', { folderId: req.params.id, error: (err as Error).message }); next(err); }
});

function mapFolder(r: any) {
  return {
    folderId:          r.folder_id,
    projectId:         r.project_id,
    parentFolderId:    r.parent_folder_id ?? null,
    folderDisplayName: r.folder_display_name,
    folderTypeCode:    r.folder_type_code,
    createdDtm:        r.created_dtm,
    updatedDtm:        r.updated_dtm,
  };
}

export { router as foldersRouter };
