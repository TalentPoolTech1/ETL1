import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db/connection';
import { userIdMiddleware } from '../middleware/user-id.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { LoggerFactory } from '../../shared/logging';

const router = Router();
router.use(userIdMiddleware);
const log = LoggerFactory.get('api');

function getUserId(res: Response): string {
  return (res.locals['userId'] as string) ?? 'system';
}

async function setSession(client: any, userId: string) {
  const key = process.env['APP_ENCRYPTION_KEY'];
  if (!key) throw new Error('APP_ENCRYPTION_KEY is required');
  await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
  await client.query(`SET LOCAL app.encryption_key = '${key.replace(/'/g, "''")}'`);
}

// ─── GET /api/settings/compute ───────────────────────────────────────────────
router.get('/compute', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const result = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(`SELECT catalog.fn_get_compute_settings() AS compute_settings`);
      return r.rows[0]?.compute_settings ?? {};
    });
    res.json({ success: true, data: result });
  } catch (err) {
    log.error('settings.get_compute', 'Failed to retrieve compute settings', err as Error);
    next(err);
  }
});

// ─── PUT /api/settings/compute ───────────────────────────────────────────────
router.put('/compute', requirePermission('USER_MANAGE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const settingsPayload = req.body ?? {};
    
    // Explicitly shape the JSON to avoid storing unwanted fields
    const safePayload = {
      sparkMaster: String(settingsPayload.sparkMaster ?? ''),
      pysparkPath: String(settingsPayload.pysparkPath ?? ''),
      scalaVersion: String(settingsPayload.scalaVersion ?? '2.12'),
      pythonVersion: String(settingsPayload.pythonVersion ?? '3.10'),
      additionalLibraries: String(settingsPayload.additionalLibraries ?? '')
    };

    await db.transaction(async client => {
      await setSession(client, userId);
      await client.query(`CALL catalog.pr_update_compute_settings($1::jsonb, $2::uuid)`, [JSON.stringify(safePayload), userId]);
    });

    log.info('settings.update_compute', 'Compute settings updated successfully', { userId });
    res.json({ success: true, data: safePayload });
  } catch (err) {
    log.error('settings.update_compute', 'Failed to update compute settings', err as Error);
    next(err);
  }
});

export { router as settingsRouter };
