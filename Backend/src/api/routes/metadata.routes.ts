/**
 * Metadata Routes
 *
 * GET  /api/metadata/tree
 * GET  /api/metadata/tree/search?query=
 * GET  /api/metadata/:id/profile
 * GET  /api/metadata/:id/lineage
 * GET  /api/metadata/:id/history
 * GET  /api/metadata/:id/permissions
 * POST /api/metadata/:id/refresh
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db/connection';
import { userIdMiddleware } from '../middleware/user-id.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { TechnologyService } from '../../metadata/TechnologyService';

const router = Router();
router.use(userIdMiddleware);

function getUserId(res: Response): string {
  return (res.locals['userId'] as string) ?? 'system';
}

router.get('/technologies', requirePermission('CONNECTION_VIEW'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const technologies = await TechnologyService.getAllTechnologies();
    return res.json({ success: true, data: technologies });
  } catch (err) {
    return next(err);
  }
});

async function setSession(client: any, userId: string) {
  const key = process.env['APP_ENCRYPTION_KEY'];
  if (!key) throw new Error('APP_ENCRYPTION_KEY is required');
  await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
  await client.query(`SET LOCAL app.encryption_key = '${key.replace(/'/g, "''")}'`);
}

router.get('/tree', requirePermission('CONNECTION_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const search = typeof req.query['search'] === 'string' ? req.query['search'] : null;
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const result = await client.query(
        `SELECT
           dataset_id,
           connector_id,
           connector_display_name,
           connector_type_code,
           db_name_text,
           schema_name_text,
           table_name_text,
           dataset_type_code,
           estimated_row_count_num,
           last_introspection_dtm
         FROM catalog.fn_get_metadata_tree($1)`,
        [search],
      );
      return result.rows;
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/tree/search', requirePermission('CONNECTION_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const query = typeof req.query['query'] === 'string' ? req.query['query'].trim() : '';
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const result = await client.query(
        `SELECT
           dataset_id,
           connector_id,
           connector_display_name,
           connector_type_code,
           db_name_text,
           schema_name_text,
           table_name_text,
           dataset_type_code,
           estimated_row_count_num,
           last_introspection_dtm
         FROM catalog.fn_get_metadata_tree($1)`,
        [query || null],
      );
      return result.rows;
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/profile', requirePermission('CONNECTION_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const data = await db.transaction(async client => {
      await setSession(client, userId);
      const [profileResult, columnsResult] = await Promise.all([
        client.query(
          `SELECT
             dataset_id,
             connector_id,
             connector_display_name,
             connector_type_code,
             db_name_text,
             schema_name_text,
             table_name_text,
             dataset_type_code,
             estimated_row_count_num,
             last_introspection_dtm,
             classification_code,
             classification_notes_text
           FROM catalog.fn_get_metadata_profile($1::uuid)`,
          [req.params.id],
        ),
        client.query(
          `SELECT
             column_id,
             column_name_text,
             data_type_code,
             is_nullable_flag,
             ordinal_position_num
           FROM catalog.fn_get_dataset_columns($1::uuid)`,
          [req.params.id],
        ),
      ]);

      const profile = profileResult.rows[0] ?? null;
      if (!profile) return null;
      return {
        datasetId: profile.dataset_id,
        connectorId: profile.connector_id,
        connectorDisplayName: profile.connector_display_name,
        connectorTypeCode: profile.connector_type_code,
        dbName: profile.db_name_text,
        schemaName: profile.schema_name_text,
        tableName: profile.table_name_text,
        datasetTypeCode: profile.dataset_type_code,
        estimatedRowCount: profile.estimated_row_count_num,
        lastIntrospectionDtm: profile.last_introspection_dtm,
        classificationCode: profile.classification_code,
        classificationNotes: profile.classification_notes_text,
        columns: columnsResult.rows.map((row: any) => ({
          columnId: row.column_id,
          name: row.column_name_text,
          dataType: row.data_type_code,
          nullable: row.is_nullable_flag,
          ordinal: row.ordinal_position_num,
        })),
      };
    });

    if (!data) return res.status(404).json({ success: false, userMessage: 'Metadata object not found' });
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/lineage', requirePermission('CONNECTION_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const result = await client.query(
        `SELECT pipeline_id, pipeline_display_name, access_mode_code, version_num_seq
         FROM catalog.fn_get_metadata_lineage($1::uuid)`,
        [req.params.id],
      );
      return result.rows;
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/history', requirePermission('AUDIT_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const limit = Math.min(Math.max(parseInt(String(req.query['limit'] ?? '50'), 10) || 50, 1), 200);
    const offset = Math.max(parseInt(String(req.query['offset'] ?? '0'), 10) || 0, 0);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const result = await client.query(
        `SELECT
           hist_id,
           hist_action_cd,
           hist_action_dtm,
           hist_action_by,
           schema_name_text,
           table_name_text,
           estimated_row_count_num,
           last_introspection_dtm
         FROM catalog.fn_get_metadata_history($1::uuid, $2, $3)`,
        [req.params.id, limit, offset],
      );
      return result.rows;
    });

    return res.json({
      success: true,
      data: rows.map((row: any) => ({
        id: String(row.hist_id),
        timestamp: row.hist_action_dtm,
        action: row.hist_action_cd === 'I' ? 'CREATED' : row.hist_action_cd === 'U' ? 'UPDATED' : 'DELETED',
        actor: row.hist_action_by ?? 'system',
        objectArea: `${row.schema_name_text ?? ''}.${row.table_name_text ?? ''}`,
        comment: `Rows: ${row.estimated_row_count_num ?? 'unknown'} · Last introspection: ${row.last_introspection_dtm ?? 'n/a'}`,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/permissions', requirePermission('CONNECTION_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const result = await client.query(
        `SELECT
           access_id,
           user_id,
           role_id,
           user_full_name,
           email_address,
           role_display_name,
           granted_dtm,
           granted_by_user_id
         FROM catalog.fn_get_metadata_permissions($1::uuid)`,
        [req.params.id],
      );
      return result.rows;
    });

    return res.json({
      success: true,
      data: rows.map((row: any) => ({
        id: row.access_id,
        principalType: row.user_id ? 'user' : 'role',
        principalName: row.user_id
          ? (row.user_full_name ?? row.email_address ?? row.user_id)
          : (row.role_display_name ?? row.role_id ?? 'Unknown Role'),
        accessLevel: row.role_display_name ?? 'ACCESS',
        isInherited: true,
        inheritedFrom: 'Connector',
        grantedBy: row.granted_by_user_id ?? 'system',
        grantedOn: row.granted_dtm,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/refresh', requirePermission('CONNECTION_EDIT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    await db.transaction(async client => {
      await setSession(client, userId);
      await client.query(
        `CALL catalog.pr_mark_dataset_refreshed($1::uuid, $2::uuid)`,
        [req.params.id, userId],
      );
    });
    return res.json({ success: true });
  } catch (err: any) {
    if (err?.code === 'P0002') return res.status(404).json({ success: false, userMessage: 'Metadata object not found' });
    return next(err);
  }
});

export { router as metadataRouter };
