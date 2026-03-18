import { Router, Request, Response, NextFunction } from 'express';
import { pipelineController as ctrl } from '../controllers/pipeline.controller';
import { db } from '../../db/connection';
import { userIdMiddleware } from '../middleware/user-id.middleware';
import { LoggerFactory } from '../../shared/logging';

const router = Router();
router.use(userIdMiddleware);
const log = LoggerFactory.get('pipelines');


function getUserId(res: Response): string {
  return (res.locals['userId'] as string) ?? 'system';
}
async function setSession(client: any, userId: string) {
  const key = process.env['APP_ENCRYPTION_KEY'] ?? 'default-key';
  await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
  await client.query(`SET LOCAL app.encryption_key = '${key.replace(/'/g, "''")}'`);
}

// ─── Global pipelines (project_id IS NULL) — must come before /:id ──────────

router.get('/global', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT pipeline_id, project_id, folder_id, pipeline_display_name,
                pipeline_desc_text, active_version_id, created_dtm, updated_dtm
         FROM catalog.pipelines
         WHERE project_id IS NULL AND folder_id IS NULL
         ORDER BY pipeline_display_name`
      );
      return r.rows;
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Pipeline CRUD ────────────────────────────────────────────────────────────
// Create pipeline — folderId and projectId optional; both NULL = global
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { projectId, pipelineDisplayName, pipelineDescText, folderId } = req.body ?? {};
    if (pipelineDisplayName) {
      const row = await db.transaction(async client => {
        await setSession(client, userId);
        const r = await client.query(
          `CALL catalog.pr_create_pipeline($1::uuid, $2::uuid, $3, $4, $5::uuid, null)`,
          [projectId ?? null, folderId ?? null, pipelineDisplayName.trim(), pipelineDescText ?? null, userId]
        );
        const newId = r.rows[0].p_pipeline_id;
        
        // Fetch the newly created record to return full data
        const getR = await client.query(
           `SELECT pipeline_id, project_id, folder_id, pipeline_display_name, pipeline_desc_text, created_dtm, updated_dtm
            FROM catalog.pipelines WHERE pipeline_id = $1`,
           [newId]
        );
        return getR.rows[0];
      });
      return res.status(201).json({ success: true, data: row });
    }
    log.info('pipeline.create', 'Delegating to controller', { userId });
    return ctrl.create(req, res, next);
  } catch (err) { log.warn('pipeline.create', 'Pipeline creation failed', { error: (err as Error).message }); return next(err); }
});
router.get('/', (req, res, next) => ctrl.list(req, res, next));

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(`
        SELECT p.pipeline_id, p.project_id, p.folder_id, p.pipeline_display_name,
               p.pipeline_desc_text, p.active_version_id, p.created_dtm, p.updated_dtm,
               pc.ir_payload_json, pc.ui_layout_json
        FROM catalog.pipelines p
        LEFT JOIN catalog.pipeline_versions pv ON pv.version_id = p.active_version_id
        LEFT JOIN catalog.pipeline_contents pc ON pc.version_id = pv.version_id
        WHERE p.pipeline_id = $1
      `, [req.params['id']]);
      return r.rows[0] ?? null;
    });
    if (!row) return res.status(404).json({ success: false, userMessage: 'Pipeline not found' });
    const payload = row.ir_payload_json as any ?? {};
    res.json({ success: true, data: {
      pipelineId:          row.pipeline_id,
      projectId:           row.project_id ?? null,
      folderId:            row.folder_id ?? null,
      pipelineDisplayName: row.pipeline_display_name,
      pipelineDescText:    row.pipeline_desc_text,
      activeVersionId:     row.active_version_id,
      createdDtm:          row.created_dtm,
      updatedDtm:          row.updated_dtm,
      nodes:               payload.nodes ?? [],
      edges:               payload.edges ?? [],
      uiLayout:            row.ui_layout_json ?? null,
    }});
  } catch (err) { return next(err); }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const body   = req.body ?? {};
    const id     = req.params['id']!;
    const isRename = body.pipelineDisplayName !== undefined && body.nodes === undefined;

    await db.transaction(async client => {
      await setSession(client, userId);
      if (isRename) {
        await client.query(
          `UPDATE catalog.pipelines SET pipeline_display_name=$2,
           pipeline_desc_text=COALESCE($3,pipeline_desc_text), updated_by_user_id=$4::uuid
           WHERE pipeline_id=$1`,
          [id, body.pipelineDisplayName, body.pipelineDescText ?? null, userId]
        );
        return;
      }
      
      const commitMsg = body.changeSummary ?? 'Auto-save';
      const payload = JSON.stringify({nodes: body.nodes ?? [], edges: body.edges ?? []});
      const layout = body.uiLayout ? JSON.stringify(body.uiLayout) : null;
      
      await client.query(
        `CALL catalog.pr_commit_pipeline_version($1, $2, $3::jsonb, $4::jsonb, $5::uuid, null)`,
        [id, commitMsg, payload, layout, userId]
      );
    });
    log.info('pipeline.save', isRename ? 'Pipeline renamed' : 'Pipeline version committed', { pipelineId: id, userId });
    return res.json({ success: true });
  } catch (err) { log.warn('pipeline.save', 'Pipeline save failed', { pipelineId: id, error: (err as Error).message }); return next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    await db.transaction(async client => {
      await setSession(client, userId);
      const check = await client.query(`SELECT 1 FROM catalog.pipelines WHERE pipeline_id=$1`, [req.params['id']]);
      if (!check.rowCount) throw Object.assign(new Error('Pipeline not found'), {status:404});
      
      await client.query(`CALL catalog.pr_delete_pipeline($1)`, [req.params['id']]);
    });
    log.info('pipeline.delete', 'Pipeline deleted', { pipelineId: req.params['id'], userId });
    return res.json({ success: true });
  } catch (err: any) {
    if (err.status === 404) return res.status(404).json({success:false,userMessage:'Pipeline not found'});
    return next(err);
  }
});

router.post('/:id/validate',  (req,res,next) => ctrl.validate(req,res,next));
router.post('/:id/generate',  (req,res,next) => ctrl.generate(req,res,next));
router.get('/:id/artifacts',                      (req,res,next) => ctrl.listArtifacts(req,res,next));
router.get('/:id/artifacts/:artifactId',          (req,res,next) => ctrl.getArtifact(req,res,next));
router.get('/:id/artifacts/:artifactId/download', (req,res,next) => ctrl.downloadArtifact(req,res,next));
router.get('/:id/history',    (req,res,next) => ctrl.getVersionHistory(req,res,next));
router.get('/:id/executions', (req,res,next) => ctrl.getExecutions(req,res,next));

router.post('/:id/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const pRow = await client.query(
        `SELECT pipeline_id,active_version_id FROM catalog.pipelines WHERE pipeline_id=$1`, [req.params['id']]);
      if (!pRow.rows[0]) throw new Error('Pipeline not found');
      const r = await client.query(
        `INSERT INTO execution.pipeline_runs (pipeline_id,version_id,run_status_code,trigger_type_code,triggered_by_user_id)
         VALUES ($1::uuid,$2,'PENDING','MANUAL',$3::uuid) RETURNING pipeline_run_id`,
        [pRow.rows[0].pipeline_id, pRow.rows[0].active_version_id, userId]);
      return r.rows[0];
    });
    log.info('pipeline.run', 'Pipeline run triggered', { pipelineId: req.params['id'], runId: row.pipeline_run_id, userId });
    return res.status(202).json({success:true,data:{pipelineRunId:row.pipeline_run_id}});
  } catch (err) { log.warn('pipeline.run', 'Run trigger failed', { pipelineId: req.params['id'], error: (err as Error).message }); return next(err); }
});

router.get('/:id/lineage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({success:true,data:{nodes:[{id:req.params['id'],label:'This Pipeline',kind:'pipeline',isCurrent:true}],edges:[]}});
  } catch (err) { return next(err); }
});

router.get('/:id/parameters', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT param_id, param_key_name, param_data_type_code, default_value_text, is_required_flag, param_desc_text
         FROM catalog.fn_get_pipeline_parameters($1)`,
        [req.params.id]
      );
      return r.rows.map((row: any) => {
        let isSensitive = false;
        let scope = 'pipeline';
        let desc = row.param_desc_text ?? '';
        if (desc.includes('[sensitive]')) { isSensitive = true; desc = desc.replace('[sensitive]', '').trim(); }
        if (desc.includes('[scope:execution]')) { scope = 'execution'; desc = desc.replace('[scope:execution]', '').trim(); }
        else if (desc.includes('[scope:global]')) { scope = 'global'; desc = desc.replace('[scope:global]', '').trim(); }
        return {
          id: row.param_id,
          name: row.param_key_name,
          dataType: row.param_data_type_code,
          required: row.is_required_flag,
          defaultValue: row.default_value_text ?? '',
          description: desc,
          isSensitive,
          scope
        };
      });
    });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

router.put('/:id/parameters', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { parameters } = req.body;
    if (!Array.isArray(parameters)) throw new Error('Parameters must be an array');
    
    await db.transaction(async client => {
      await setSession(client, userId);
      // Delete existing parameters first to align with full replacement strategy
      await client.query(`DELETE FROM catalog.pipeline_parameters WHERE pipeline_id = $1`, [req.params.id]);
      
      for (const p of parameters) {
        let encodedDesc = p.description || '';
        if (p.isSensitive) encodedDesc += ' [sensitive]';
        if (p.scope && p.scope !== 'pipeline') encodedDesc += ` [scope:${p.scope}]`;
        encodedDesc = encodedDesc.trim();
        
        await client.query(
          `CALL catalog.pr_upsert_pipeline_parameter($1, $2, $3, $4, $5, $6)`,
          [req.params.id, p.name || 'new_param', p.dataType || 'STRING', p.defaultValue || null, !!p.required, encodedDesc || null]
        );
      }
    });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

router.get('/:id/permissions', (_req,res) => res.json({success:true,data:{grants:[],inheritFromProject:true}}));
router.put('/:id/permissions', (_req,res) => res.json({success:true}));

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
         FROM history.pipelines_history h
         WHERE h.pipeline_id=$1 ORDER BY h.hist_action_dtm DESC LIMIT $2 OFFSET $3`,
        [req.params['id'], limit, offset]);
      return r.rows.map((row:any) => ({
        id:String(row.id), timestamp:row.timestamp, user:row.user_id??'system',
        action:row.action_code==='U'?'PIPELINE_SAVED':row.action_code==='I'?'PIPELINE_CREATED':'PIPELINE_DELETED',
        summary:`Pipeline ${row.action_code==='U'?'updated':row.action_code==='I'?'created':'deleted'}`,
      }));
    });
    res.json({success:true,data:rows});
  } catch { res.json({success:true,data:[]}); }
});

export { router as pipelineRouter };
