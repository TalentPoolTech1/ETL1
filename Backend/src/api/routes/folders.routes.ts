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

const router = Router();
router.use(userIdMiddleware);
const log = LoggerFactory.get('folders');



function getUserId(res: Response): string {
  return (res.locals['userId'] as string) ?? 'system';
}

async function setSession(client: any, userId: string) {
  const key = process.env['APP_ENCRYPTION_KEY'] ?? 'default-key';
  await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
  await client.query(`SET LOCAL app.encryption_key = '${key.replace(/'/g, "''")}'`);
}

// ─── List root folders for a project ──────────────────────────────────────────

router.get('/project/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT folder_id, project_id, parent_folder_id, folder_display_name,
                folder_type_code, created_dtm, updated_dtm
         FROM etl.folders
         WHERE project_id = $1::uuid AND parent_folder_id IS NULL
         ORDER BY folder_display_name`,
        [req.params.projectId]
      );
      return r.rows;
    });
    res.json({ success: true, data: rows.map(mapFolder) });
  } catch (err) { next(err); }
});

// ─── List sub-folders of a parent folder ──────────────────────────────────────

router.get('/:id/children', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT folder_id, project_id, parent_folder_id, folder_display_name,
                folder_type_code, created_dtm, updated_dtm
         FROM etl.folders
         WHERE parent_folder_id = $1::uuid
         ORDER BY folder_display_name`,
        [req.params.id]
      );
      return r.rows;
    });
    res.json({ success: true, data: rows.map(mapFolder) });
  } catch (err) { next(err); }
});

// ─── Get pipelines in a folder ────────────────────────────────────────────────

router.get('/:id/pipelines', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           p.pipeline_id,
           p.project_id,
           p.folder_id,
           p.pipeline_display_name,
           p.pipeline_desc_text,
           p.active_version_id,
           p.created_dtm,
           p.updated_dtm
         FROM catalog.pipelines p
         WHERE p.folder_id = $1::uuid
         ORDER BY p.pipeline_display_name`,
        [req.params.id]
      );
      return r.rows;
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Get orchestrators in a folder ────────────────────────────────────────────

router.get('/:id/orchestrators', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           o.orch_id,
           o.project_id,
           o.folder_id,
           o.orch_display_name,
           o.orch_desc_text,
           o.created_dtm,
           o.updated_dtm
         FROM catalog.orchestrators o
         WHERE o.folder_id = $1::uuid
         ORDER BY o.orch_display_name`,
        [req.params.id]
      );
      return r.rows;
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Get single folder ────────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT folder_id, project_id, parent_folder_id, folder_display_name,
                folder_type_code, created_dtm, updated_dtm
         FROM etl.folders WHERE folder_id = $1`,
        [req.params.id]
      );
      return r.rows[0] ?? null;
    });
    if (!row) return res.status(404).json({ success: false, userMessage: 'Folder not found' });
    res.json({ success: true, data: mapFolder(row) });
  } catch (err) { next(err); }
});

// ─── Create folder ────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { projectId, parentFolderId, folderDisplayName, folderTypeCode = 'PIPELINE' } = req.body;
    if (!projectId) return res.status(400).json({ success: false, userMessage: 'projectId is required' });
    if (!folderDisplayName?.trim()) return res.status(400).json({ success: false, userMessage: 'folderDisplayName is required' });

    const row = await db.transaction(async client => {
      await setSession(client, userId);

      // Build LTREE path: parent path + new slug
      let ltreePath: string;
      if (parentFolderId) {
        const parent = await client.query(
          `SELECT hierarchical_path_ltree FROM etl.folders WHERE folder_id = $1`,
          [parentFolderId]
        );
        if (!parent.rows[0]) throw new Error('Parent folder not found');
        const slug = folderDisplayName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
        ltreePath = `${parent.rows[0].hierarchical_path_ltree}.${slug}`;
      } else {
        const slug = folderDisplayName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
        ltreePath = slug;
      }

      const r = await client.query(
        `INSERT INTO etl.folders
           (project_id, parent_folder_id, folder_display_name, hierarchical_path_ltree, folder_type_code)
         VALUES ($1::uuid, $2::uuid, $3, $4::ltree, $5)
         RETURNING folder_id, project_id, parent_folder_id, folder_display_name, folder_type_code, created_dtm, updated_dtm`,
        [projectId, parentFolderId ?? null, folderDisplayName.trim(), ltreePath, folderTypeCode]
      );
      return r.rows[0];
    });
    log.info('folder.create', 'Folder created', { folderId: row.folder_id, projectId, parentFolderId: parentFolderId ?? null, userId });
    res.status(201).json({ success: true, data: mapFolder(row) });
  } catch (err) { log.warn('folder.create', 'Folder creation failed', { error: (err as Error).message }); next(err); }
});

// ─── Rename folder ────────────────────────────────────────────────────────────

router.put('/:id/rename', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { folderDisplayName } = req.body;
    if (!folderDisplayName?.trim()) return res.status(400).json({ success: false, userMessage: 'folderDisplayName is required' });
    await db.transaction(async client => {
      await setSession(client, userId);
      // Get current folder data
      const cur = await client.query(
        `SELECT hierarchical_path_ltree FROM etl.folders WHERE folder_id = $1`,
        [req.params.id]
      );
      if (!cur.rows[0]) throw Object.assign(new Error('Folder not found'), { status: 404 });
      const oldLtree = cur.rows[0].hierarchical_path_ltree as string;
      const newSlug = folderDisplayName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');

      // Compute new ltree for this folder
      const pathParts = oldLtree.split('.');
      pathParts[pathParts.length - 1] = newSlug;
      const newLtree = pathParts.join('.');

      // Update the folder itself
      await client.query(
        `UPDATE etl.folders SET folder_display_name = $2, hierarchical_path_ltree = $3::ltree, updated_dtm = CURRENT_TIMESTAMP WHERE folder_id = $1`,
        [req.params.id, folderDisplayName.trim(), newLtree]
      );

      // Update all children ltree paths (replace old prefix with new prefix)
      if (oldLtree !== newLtree) {
        await client.query(
          `UPDATE etl.folders
           SET hierarchical_path_ltree = ($3::ltree || subpath(hierarchical_path_ltree, nlevel($1::ltree)))
           WHERE hierarchical_path_ltree <@ $1::ltree AND folder_id != $2`,
          [oldLtree, req.params.id, newLtree]
        );
      }
    });
    log.info('folder.rename', 'Folder renamed', { folderId: req.params.id, newName: folderDisplayName.trim(), userId });
    res.json({ success: true });
  } catch (err) { log.warn('folder.rename', 'Folder rename failed', { folderId: req.params.id, error: (err as Error).message }); next(err); }
});

// ─── Delete folder (cascades children via FK) ─────────────────────────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    await db.transaction(async client => {
      await setSession(client, userId);
      await client.query(`DELETE FROM etl.folders WHERE folder_id = $1`, [req.params.id]);
    });
    log.info('folder.delete', 'Folder deleted', { folderId: req.params.id, userId });
    res.json({ success: true });
  } catch (err) { log.warn('folder.delete', 'Folder delete failed', { folderId: req.params.id, error: (err as Error).message }); next(err); }
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
