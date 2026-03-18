/**
 * Executions Routes — Monitor KPIs, pipeline runs, orchestrator runs.
 *
 * GET  /api/executions/kpis
 * GET  /api/executions/pipeline-runs
 * GET  /api/executions/pipeline-runs/:runId
 * GET  /api/executions/pipeline-runs/:runId/logs
 * GET  /api/executions/pipeline-runs/:runId/nodes
 * POST /api/executions/pipeline-runs/:runId/retry
 * POST /api/executions/pipeline-runs/:runId/cancel
 * GET  /api/executions/orchestrator-runs
 * GET  /api/executions/orchestrator-runs/:runId
 * POST /api/executions/orchestrator-runs/:runId/retry
 * POST /api/executions/orchestrator-runs/:runId/cancel
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db/connection';
import { userIdMiddleware } from '../middleware/user-id.middleware';

const router = Router();
router.use(userIdMiddleware);

function getUserId(res: Response): string {
  return (res.locals['userId'] as string) ?? 'system';
}

async function setSession(client: any, userId: string) {
  const key = process.env['APP_ENCRYPTION_KEY'] ?? 'default-key';
  await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
  await client.query(`SET LOCAL app.encryption_key = '${key.replace(/'/g, "''")}'`);
}

// ─── KPIs ──────────────────────────────────────────────────────────────────────

router.get('/kpis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { projectId, dateFrom, dateTo } = req.query;

    const kpis = await db.transaction(async client => {
      await setSession(client, userId);
      const today = new Date().toISOString().slice(0, 10);
      const from  = (dateFrom as string) ?? today;
      const to    = (dateTo   as string) ?? today;

      // Parameterised — no string interpolation to prevent SQL injection
      const kpiParams: unknown[] = [from, to];
      const projectWhere = projectId ? 'AND p.project_id = $3::uuid' : '';
      if (projectId) kpiParams.push(String(projectId));

      const r = await client.query(`
        SELECT
          COUNT(*)                                                            AS total_today,
          COUNT(*) FILTER (WHERE pr.run_status_code = 'RUNNING')             AS running_now,
          COUNT(*) FILTER (WHERE pr.run_status_code = 'SUCCESS')::float
            / NULLIF(COUNT(*), 0) * 100                                      AS success_rate_today,
          COUNT(*) FILTER (WHERE pr.run_status_code = 'FAILED')              AS failed_today,
          AVG(pr.run_duration_ms) FILTER (WHERE pr.run_status_code = 'SUCCESS') AS avg_duration_ms_today,
          COUNT(*) FILTER (WHERE pr.sla_status_code = 'BREACHED')            AS sla_breaches_today,
          COALESCE(
            SUM(COALESCE(pr.bytes_read_num,0) + COALESCE(pr.bytes_written_num,0))::float / 1e9,
            0
          )                                                                   AS data_volume_gb_today,
          (SELECT COUNT(*) FROM catalog.pipelines p2 WHERE p2.active_version_id IS NOT NULL ${projectId ? 'AND p2.project_id = $3::uuid' : ''}) AS active_pipelines
        FROM execution.pipeline_runs pr
        LEFT JOIN catalog.pipelines p ON p.pipeline_id = pr.pipeline_id
        WHERE DATE(COALESCE(pr.start_dtm, pr.created_dtm)) BETWEEN $1 AND $2
        ${projectWhere}
      `, kpiParams);

      const row = r.rows[0] ?? {};
      return {
        totalToday:         parseInt(row.total_today          ?? '0'),
        runningNow:         parseInt(row.running_now          ?? '0'),
        successRateToday:   parseFloat(row.success_rate_today ?? '0'),
        failedToday:        parseInt(row.failed_today         ?? '0'),
        avgDurationMsToday: row.avg_duration_ms_today ? parseFloat(row.avg_duration_ms_today) : null,
        slaBreachesToday:   parseInt(row.sla_breaches_today   ?? '0'),
        dataVolumeGbToday:  parseFloat(row.data_volume_gb_today ?? '0'),
        activePipelines:    parseInt(row.active_pipelines ?? '0'),
      };
    });

    return res.json({ success: true, data: kpis });
  } catch (err) { return next(err); }
});

// ─── Pipeline runs list ────────────────────────────────────────────────────────

router.get('/pipeline-runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const {
      pipelineId, projectId, status, triggerType, search,
      dateFrom, dateTo, myJobsOnly,
      page = '1', pageSize = '50',
    } = req.query;

    const limit  = Math.min(parseInt(String(pageSize)), 500);
    const offset = (parseInt(String(page)) - 1) * limit;

    const rows = await db.transaction(async client => {
      await setSession(client, userId);

      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      const add = (cond: string, val: unknown) => {
        conditions.push(cond.replace('?', `$${idx++}`));
        params.push(val);
      };

      if (pipelineId)            add(`pr.pipeline_id = ?::uuid`, pipelineId);
      if (projectId)             add(`p.project_id   = ?::uuid`, projectId);
      if (status)                add(`pr.run_status_code   = ?`, status);
      if (triggerType)           add(`pr.trigger_type_code = ?`, triggerType);
      if (dateFrom)              add(`DATE(pr.start_dtm) >= ?::date`, dateFrom);
      if (dateTo)                add(`DATE(pr.start_dtm) <= ?::date`, dateTo);
      if (search)                add(`p.pipeline_display_name ILIKE ?`, `%${search}%`);
      if (myJobsOnly === 'true') add(`pr.triggered_by_user_id = ?::uuid`, userId);

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [data, count] = await Promise.all([
        client.query(`
          SELECT
            pr.pipeline_run_id,
            p.pipeline_display_name                                          AS pipeline_name,
            pr.pipeline_id,
            p.project_id,
            proj.project_display_name                                        AS project_name,
            COALESCE(pv.release_tag_label, 'v' || pv.version_num_seq::text) AS version_label,
            pr.run_status_code     AS run_status,
            pr.trigger_type_code   AS trigger_type,
            u.user_full_name       AS submitted_by,
            pr.start_dtm,
            pr.end_dtm,
            pr.run_duration_ms     AS duration_ms,
            pr.rows_processed_num  AS rows_processed,
            pr.bytes_read_num      AS bytes_read,
            pr.bytes_written_num   AS bytes_written,
            pr.error_message_text  AS error_message,
            pr.retry_count_num     AS retry_count,
            pr.sla_status_code     AS sla_status
          FROM execution.pipeline_runs pr
          LEFT JOIN catalog.pipelines p         ON p.pipeline_id   = pr.pipeline_id
          LEFT JOIN catalog.pipeline_versions pv ON pv.version_id  = pr.version_id
          LEFT JOIN etl.projects proj            ON proj.project_id = p.project_id
          LEFT JOIN etl.users u                  ON u.user_id       = pr.triggered_by_user_id
          ${where}
          ORDER BY pr.start_dtm DESC NULLS LAST, pr.created_dtm DESC
          LIMIT ${limit} OFFSET ${offset}
        `, params),
        client.query(`
          SELECT COUNT(*) AS cnt
          FROM execution.pipeline_runs pr
          LEFT JOIN catalog.pipelines p ON p.pipeline_id = pr.pipeline_id
          ${where}
        `, params),
      ]);

      return {
        items: data.rows.map((r: any) => ({
          pipelineRunId: r.pipeline_run_id,
          pipelineName:  r.pipeline_name  ?? '',
          pipelineId:    r.pipeline_id,
          projectId:     r.project_id,
          projectName:   r.project_name,
          versionLabel:  r.version_label  ?? '',
          runStatus:     r.run_status     ?? 'UNKNOWN',
          triggerType:   r.trigger_type   ?? 'MANUAL',
          submittedBy:   r.submitted_by,
          startDtm:      r.start_dtm,
          endDtm:        r.end_dtm,
          durationMs:    r.duration_ms,
          rowsProcessed: r.rows_processed,
          bytesRead:     r.bytes_read,
          bytesWritten:  r.bytes_written,
          errorMessage:  r.error_message,
          retryCount:    r.retry_count    ?? 0,
          slaStatus:     r.sla_status     ?? 'N_A',
          tags:          [],
        })),
        total: parseInt(count.rows[0]?.cnt ?? '0'),
      };
    });

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Pipeline run detail ───────────────────────────────────────────────────────

router.get('/pipeline-runs/:runId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(`
        SELECT
          pr.pipeline_run_id,
          p.pipeline_display_name                                          AS pipeline_name,
          proj.project_display_name                                        AS project_name,
          COALESCE(pv.release_tag_label, 'v' || pv.version_num_seq::text) AS version_label,
          pr.run_status_code     AS run_status,
          pr.trigger_type_code   AS trigger_type,
          u.user_full_name       AS submitted_by,
          pr.start_dtm,
          pr.end_dtm,
          pr.run_duration_ms     AS duration_ms,
          pr.rows_processed_num  AS rows_processed,
          pr.bytes_read_num      AS bytes_read,
          pr.bytes_written_num   AS bytes_written,
          pr.error_message_text  AS error_message,
          pr.retry_count_num     AS retry_count,
          pr.sla_status_code     AS sla_status,
          pr.external_engine_job_id AS spark_job_id,
          pr.spark_ui_url_text   AS spark_ui_url
        FROM execution.pipeline_runs pr
        LEFT JOIN catalog.pipelines p         ON p.pipeline_id   = pr.pipeline_id
        LEFT JOIN catalog.pipeline_versions pv ON pv.version_id  = pr.version_id
        LEFT JOIN etl.projects proj            ON proj.project_id = p.project_id
        LEFT JOIN etl.users u                  ON u.user_id       = pr.triggered_by_user_id
        WHERE pr.pipeline_run_id = $1
      `, [req.params.runId]);
      
      const nodesResult = await client.query(`
        SELECT
           node_run_id        AS "nodeRunId",
           node_id_in_ir_text AS "nodeId",
           node_display_name  AS "nodeName",
           node_status_code   AS "runStatus",
           start_dtm          AS "startDtm",
           end_dtm            AS "endDtm",
           rows_in_num        AS "rowsIn",
           rows_out_num       AS "rowsOut",
           error_message_text AS "errorMessage",
           node_metrics_json  AS "metrics"
         FROM execution.pipeline_node_runs
         WHERE pipeline_run_id = $1
         ORDER BY start_dtm NULLS LAST
      `, [req.params.runId]);
      
      const outRow = r.rows[0] ?? null;
      if (outRow) outRow.nodes = nodesResult.rows;
      return outRow;
    });
    if (!row) return res.status(404).json({ success: false, userMessage: 'Run not found' });
    return res.json({ success: true, data: {
      pipelineRunId:  row.pipeline_run_id,
      pipelineName:   row.pipeline_name  ?? '',
      projectName:    row.project_name,
      versionLabel:   row.version_label  ?? '',
      runStatus:      row.run_status,
      triggerType:    row.trigger_type,
      submittedBy:    row.submitted_by,
      startDtm:       row.start_dtm,
      endDtm:         row.end_dtm,
      durationMs:     row.duration_ms,
      rowsProcessed:  row.rows_processed,
      bytesRead:      row.bytes_read,
      bytesWritten:   row.bytes_written,
      errorMessage:   row.error_message,
      retryCount:     row.retry_count    ?? 0,
      slaStatus:      row.sla_status     ?? 'N_A',
      sparkJobId:     row.spark_job_id,
      sparkUiUrl:     row.spark_ui_url,
      nodes:          row.nodes,
    }});
  } catch (err) { return next(err); }
});

// ─── Pipeline run logs ─────────────────────────────────────────────────────────

router.get('/pipeline-runs/:runId/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const limit  = Math.min(parseInt(String(req.query['limit']  ?? 500)), 2000);
    const offset = parseInt(String(req.query['offset'] ?? 0));

    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT created_dtm AS log_dtm, log_level_code AS log_level,
                log_source_code AS log_source, log_message_text AS log_message
         FROM execution.pipeline_run_logs
         WHERE pipeline_run_id = $1
         ORDER BY created_dtm ASC
         LIMIT $2 OFFSET $3`,
        [req.params.runId, limit, offset]
      );
      return r.rows;
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Pipeline run nodes ────────────────────────────────────────────────────────

router.get('/pipeline-runs/:runId/nodes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           node_run_id,
           node_id_in_ir_text,
           node_display_name,
           node_status_code   AS run_status,
           start_dtm,
           end_dtm,
           rows_in_num        AS rows_in,
           rows_out_num       AS rows_out,
           error_message_text AS error_message,
           node_metrics_json  AS metrics
         FROM execution.pipeline_node_runs
         WHERE pipeline_run_id = $1
         ORDER BY start_dtm NULLS LAST`,
        [req.params.runId]
      );
      return r.rows;
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Retry pipeline run ────────────────────────────────────────────────────────

router.post('/pipeline-runs/:runId/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const existing = await client.query(
        `SELECT pipeline_id, version_id, retry_count_num FROM execution.pipeline_runs WHERE pipeline_run_id = $1`,
        [req.params.runId]
      );
      if (!existing.rows[0]) throw new Error('Run not found');
      const orig = existing.rows[0];
      const r = await client.query(
        `INSERT INTO execution.pipeline_runs
           (pipeline_id, version_id, run_status_code, trigger_type_code,
            triggered_by_user_id, retry_count_num)
         VALUES ($1, $2, 'PENDING', 'MANUAL', $3::uuid, $4)
         RETURNING pipeline_run_id`,
        [orig.pipeline_id, orig.version_id, userId, (orig.retry_count_num ?? 0) + 1]
      );
      return r.rows[0];
    });
    return res.status(202).json({ success: true, data: { pipelineRunId: row.pipeline_run_id } });
  } catch (err) { return next(err); }
});

// ─── Cancel pipeline run ───────────────────────────────────────────────────────

router.post('/pipeline-runs/:runId/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const result = await db.transaction(async client => {
      await setSession(client, userId);
      const existing = await client.query(
        `SELECT run_status_code FROM execution.pipeline_runs WHERE pipeline_run_id = $1::uuid`,
        [req.params.runId]
      );
      if (!existing.rowCount) return { ok: false as const, status: 404 as const };

      const runStatus = existing.rows[0].run_status_code as string;
      if (!['PENDING', 'QUEUED', 'RUNNING'].includes(runStatus)) {
        return { ok: false as const, status: 409 as const, runStatus };
      }

      await client.query(
        `CALL execution.pr_finalize_pipeline_run($1::uuid, $2)`,
        [req.params.runId, 'CANCELLED'],
      );
      return { ok: true as const };
    });
    if (!result.ok) {
      if (result.status === 404) {
        return res.status(404).json({ success: false, userMessage: 'Pipeline run not found' });
      }
      return res.status(409).json({
        success: false,
        userMessage: `Pipeline run cannot be cancelled from status ${result.runStatus}`,
      });
    }
    return res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Orchestrator runs list ────────────────────────────────────────────────────

router.get('/orchestrator-runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { projectId, status, triggerType, page = '1', pageSize = '50' } = req.query;
    const limit  = Math.min(parseInt(String(pageSize)), 500);
    const offset = (parseInt(String(page)) - 1) * limit;

    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;
      if (projectId)   { conditions.push(`o.project_id = $${idx++}::uuid`); params.push(projectId); }
      if (status)      { conditions.push(`orch.run_status_code   = $${idx++}`); params.push(status); }
      if (triggerType) { conditions.push(`orch.trigger_type_code = $${idx++}`); params.push(triggerType); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [data, count] = await Promise.all([
        client.query(`
          SELECT
            orch.orch_run_id,
            o.orch_display_name       AS orchestrator_name,
            orch.orch_id,
            o.project_id,
            proj.project_display_name AS project_name,
            orch.run_status_code      AS run_status,
            orch.trigger_type_code    AS trigger_type,
            orch.start_dtm,
            orch.end_dtm,
            orch.run_duration_ms      AS duration_ms,
            orch.error_message_text   AS error_message,
            orch.retry_count_num      AS retry_count
          FROM execution.orchestrator_runs orch
          LEFT JOIN catalog.orchestrators o ON o.orch_id = orch.orch_id
          LEFT JOIN etl.projects proj       ON proj.project_id = o.project_id
          ${where}
          ORDER BY orch.start_dtm DESC NULLS LAST, orch.created_dtm DESC
          LIMIT ${limit} OFFSET ${offset}
        `, params),
        client.query(`
          SELECT COUNT(*) AS cnt
          FROM execution.orchestrator_runs orch
          LEFT JOIN catalog.orchestrators o ON o.orch_id = orch.orch_id
          ${where}
        `, params),
      ]);

      return {
        items: data.rows.map((r: any) => ({
          orchRunId:        r.orch_run_id,
          orchestratorName: r.orchestrator_name ?? '',
          orchestratorId:   r.orch_id,
          projectId:        r.project_id,
          projectName:      r.project_name,
          runStatus:        r.run_status    ?? 'UNKNOWN',
          triggerType:      r.trigger_type  ?? 'MANUAL',
          startDtm:         r.start_dtm,
          endDtm:           r.end_dtm,
          durationMs:       r.duration_ms,
          errorMessage:     r.error_message,
          retryCount:       r.retry_count   ?? 0,
          pipelineRuns:     [],
        })),
        total: parseInt(count.rows[0]?.cnt ?? '0'),
      };
    });

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Orchestrator run detail ───────────────────────────────────────────────────

router.get('/orchestrator-runs/:runId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(`
        SELECT
          orch.orch_run_id,
          orch.run_status_code      AS run_status,
          orch.trigger_type_code    AS trigger_type,
          orch.start_dtm,
          orch.end_dtm,
          orch.run_duration_ms      AS duration_ms,
          orch.error_message_text   AS error_message,
          orch.retry_count_num      AS retry_count,
          o.orch_display_name       AS orchestrator_name,
          o.project_id,
          proj.project_display_name AS project_name,
          u.user_full_name          AS submitted_by
        FROM execution.orchestrator_runs orch
        LEFT JOIN catalog.orchestrators o ON o.orch_id = orch.orch_id
        LEFT JOIN etl.projects proj       ON proj.project_id = o.project_id
        LEFT JOIN etl.users u             ON u.user_id       = orch.triggered_by_user_id
        WHERE orch.orch_run_id = $1
      `, [req.params.runId]);
      return r.rows[0] ?? null;
    });
    if (!row) return res.status(404).json({ success: false, userMessage: 'Run not found' });
    return res.json({ success: true, data: {
      pipelineRunId:  row.orch_run_id,
      pipelineName:   row.orchestrator_name ?? 'Orchestrator',
      projectName:    row.project_name,
      versionLabel:   '',
      runStatus:      row.run_status,
      triggerType:    row.trigger_type,
      submittedBy:    row.submitted_by,
      startDtm:       row.start_dtm,
      endDtm:         row.end_dtm,
      durationMs:     row.duration_ms,
      errorMessage:   row.error_message,
      retryCount:     row.retry_count ?? 0,
      slaStatus:      'N_A',
      sparkJobId:     null,
      sparkUiUrl:     null,
      nodes:          [],
    }});
  } catch (err) { return next(err); }
});

// ─── Retry / Cancel orchestrator run ──────────────────────────────────────────

router.post('/orchestrator-runs/:runId/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const existing = await client.query(
        `SELECT orch_id, retry_count_num FROM execution.orchestrator_runs WHERE orch_run_id = $1`,
        [req.params.runId]
      );
      if (!existing.rows[0]) throw new Error('Run not found');
      const r = await client.query(
        `INSERT INTO execution.orchestrator_runs
           (orch_id, run_status_code, trigger_type_code, triggered_by_user_id, retry_count_num)
         VALUES ($1, 'PENDING', 'MANUAL', $2::uuid, $3)
         RETURNING orch_run_id`,
        [existing.rows[0].orch_id, userId, (existing.rows[0].retry_count_num ?? 0) + 1]
      );
      return r.rows[0];
    });
    return res.status(202).json({ success: true, data: { orchRunId: row.orch_run_id } });
  } catch (err) { return next(err); }
});

router.post('/orchestrator-runs/:runId/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const result = await db.transaction(async client => {
      await setSession(client, userId);
      const existing = await client.query(
        `SELECT run_status_code
         FROM execution.fn_get_orchestrator_run_status($1::uuid)`,
        [req.params.runId]
      );
      if (!existing.rowCount) return { ok: false as const, status: 404 as const };

      const runStatus = existing.rows[0].run_status_code as string;
      if (!['PENDING', 'QUEUED', 'RUNNING'].includes(runStatus)) {
        return { ok: false as const, status: 409 as const, runStatus };
      }

      await client.query(
        `CALL execution.pr_finalize_orchestrator_run($1::uuid, $2)`,
        [req.params.runId, 'CANCELLED'],
      );
      return { ok: true as const };
    });
    if (!result.ok) {
      if (result.status === 404) {
        return res.status(404).json({ success: false, userMessage: 'Orchestrator run not found' });
      }
      return res.status(409).json({
        success: false,
        userMessage: `Orchestrator run cannot be cancelled from status ${result.runStatus}`,
      });
    }
    return res.json({ success: true });
  } catch (err) { next(err); }
});

export { router as executionsRouter };
