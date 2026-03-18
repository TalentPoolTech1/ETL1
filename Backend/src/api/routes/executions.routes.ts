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
import { requirePermission } from '../middleware/rbac.middleware';

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

router.get('/kpis', requirePermission('AUDIT_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { projectId, dateFrom, dateTo } = req.query;

    const kpis = await db.transaction(async client => {
      await setSession(client, userId);
      const today = new Date().toISOString().slice(0, 10);
      const from  = (dateFrom as string) ?? today;
      const to    = (dateTo   as string) ?? today;

      const r = await client.query(
        `SELECT * FROM execution.fn_get_execution_kpis($1::date, $2::date, $3::uuid)`,
        [from, to, projectId ? String(projectId) : null],
      );

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

router.get('/pipeline-runs', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
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

      const [data, count] = await Promise.all([
        client.query(
          `SELECT * FROM execution.fn_list_pipeline_runs(
             $1::uuid, $2::uuid, $3, $4, $5::date, $6::date, $7, $8, $9::uuid, $10, $11
           )`,
          [
            pipelineId  ? String(pipelineId)  : null,
            projectId   ? String(projectId)   : null,
            status      ? String(status)      : null,
            triggerType ? String(triggerType) : null,
            dateFrom    ? String(dateFrom)    : null,
            dateTo      ? String(dateTo)      : null,
            search      ? String(search)      : null,
            myJobsOnly === 'true',
            userId,
            limit,
            offset,
          ],
        ),
        client.query(
          `SELECT execution.fn_count_pipeline_runs($1::uuid, $2::uuid, $3, $4, $5::date, $6::date, $7, $8, $9::uuid) AS cnt`,
          [
            pipelineId  ? String(pipelineId)  : null,
            projectId   ? String(projectId)   : null,
            status      ? String(status)      : null,
            triggerType ? String(triggerType) : null,
            dateFrom    ? String(dateFrom)    : null,
            dateTo      ? String(dateTo)      : null,
            search      ? String(search)      : null,
            myJobsOnly === 'true',
            userId,
          ],
        ),
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

router.get('/pipeline-runs/:runId', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT * FROM execution.fn_get_pipeline_run_detail($1::uuid)`,
        [req.params.runId],
      );

      const nodesResult = await client.query(
        `SELECT * FROM execution.fn_get_pipeline_run_nodes_detail($1::uuid)`,
        [req.params.runId],
      );
      
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

router.get('/pipeline-runs/:runId/logs', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const limit  = Math.min(parseInt(String(req.query['limit']  ?? 500)), 2000);
    const offset = parseInt(String(req.query['offset'] ?? 0));

    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT * FROM execution.fn_get_pipeline_run_logs_paginated($1::uuid, NULL, $2, $3)`,
        [req.params.runId, limit, offset],
      );
      return r.rows;
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Pipeline run nodes ────────────────────────────────────────────────────────

router.get('/pipeline-runs/:runId/nodes', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT * FROM execution.fn_get_pipeline_run_nodes_detail($1::uuid)`,
        [req.params.runId],
      );
      return r.rows;
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Retry pipeline run ────────────────────────────────────────────────────────

router.post('/pipeline-runs/:runId/retry', requirePermission('PIPELINE_RUN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `CALL execution.pr_retry_pipeline_run($1::uuid, $2::uuid, null)`,
        [req.params.runId, userId],
      );
      if (!r.rows[0]) throw new Error('Run not found');
      return { pipeline_run_id: r.rows[0].p_new_run_id };
    });
    return res.status(202).json({ success: true, data: { pipelineRunId: row.pipeline_run_id } });
  } catch (err) { return next(err); }
});

// ─── Cancel pipeline run ───────────────────────────────────────────────────────

router.post('/pipeline-runs/:runId/cancel', requirePermission('PIPELINE_RUN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const result = await db.transaction(async client => {
      await setSession(client, userId);
      const existing = await client.query(
        `SELECT run_status_code FROM execution.fn_get_pipeline_run_detail($1::uuid)`,
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

router.get('/orchestrator-runs', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { projectId, orchestratorId, status, triggerType, page = '1', pageSize = '50' } = req.query;
    const limit  = Math.min(parseInt(String(pageSize)), 500);
    const offset = (parseInt(String(page)) - 1) * limit;

    const rows = await db.transaction(async client => {
      await setSession(client, userId);

      const [data, count] = await Promise.all([
        client.query(
          `SELECT * FROM execution.fn_list_orchestrator_runs($1::uuid, $2::uuid, $3, $4, $5, $6)`,
          [
            projectId      ? String(projectId)      : null,
            orchestratorId ? String(orchestratorId) : null,
            status      ? String(status)      : null,
            triggerType ? String(triggerType) : null,
            limit,
            offset,
          ],
        ),
        client.query(
          `SELECT execution.fn_count_orchestrator_runs($1::uuid, $2::uuid, $3, $4) AS cnt`,
          [
            projectId      ? String(projectId)      : null,
            orchestratorId ? String(orchestratorId) : null,
            status      ? String(status)      : null,
            triggerType ? String(triggerType) : null,
          ],
        ),
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

router.get('/orchestrator-runs/:runId', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const detail = await db.transaction(async client => {
      await setSession(client, userId);
      const [detailResult, pipelineResult] = await Promise.all([
        client.query(
          `SELECT
             orch_run_id,
             orch_id,
             orch_display_name,
             project_id,
             project_display_name,
             run_status_code,
             trigger_type_code,
             triggered_by_user_id,
             submitted_by_full_name,
             start_dtm,
             end_dtm,
             run_duration_ms,
             error_message_text,
             retry_count_num,
             env_display_name,
             run_options_json,
             created_dtm
           FROM execution.fn_get_orchestrator_run_detail($1::uuid)`,
          [req.params.runId],
        ),
        client.query(
          `SELECT
             pipeline_run_id,
             pipeline_id,
             pipeline_display_name,
             dag_node_id_text,
             execution_order_num,
             run_status_code,
             start_dtm,
             end_dtm,
             run_duration_ms,
             error_message_text
           FROM execution.fn_get_orchestrator_run_pipeline_map($1::uuid)`,
          [req.params.runId],
        ),
      ]);

      const row = detailResult.rows[0] ?? null;
      if (!row) return null;
      return {
        ...row,
        pipeline_runs: pipelineResult.rows.map((pipelineRow: any) => ({
          pipelineRunId: pipelineRow.pipeline_run_id,
          pipelineId: pipelineRow.pipeline_id,
          pipelineName: pipelineRow.pipeline_display_name,
          dagNodeId: pipelineRow.dag_node_id_text,
          executionOrder: pipelineRow.execution_order_num,
          runStatus: pipelineRow.run_status_code,
          startDtm: pipelineRow.start_dtm,
          endDtm: pipelineRow.end_dtm,
          durationMs: pipelineRow.run_duration_ms,
          errorMessage: pipelineRow.error_message_text,
        })),
      };
    });
    if (!detail) return res.status(404).json({ success: false, userMessage: 'Run not found' });
    return res.json({ success: true, data: {
      orchRunId:         detail.orch_run_id,
      orchestratorId:    detail.orch_id,
      orchestratorName:  detail.orch_display_name ?? 'Orchestrator',
      projectId:         detail.project_id ?? null,
      projectName:       detail.project_display_name ?? null,
      runStatus:         detail.run_status_code ?? 'UNKNOWN',
      triggerType:       detail.trigger_type_code ?? 'MANUAL',
      submittedBy:       detail.submitted_by_full_name ?? null,
      startDtm:          detail.start_dtm,
      endDtm:            detail.end_dtm,
      durationMs:        detail.run_duration_ms,
      errorMessage:      detail.error_message_text,
      retryCount:        detail.retry_count_num ?? 0,
      environmentName:   detail.env_display_name ?? null,
      options:           detail.run_options_json ?? null,
      createdDtm:        detail.created_dtm,
      pipelineRuns:      detail.pipeline_runs,
    }});
  } catch (err) { return next(err); }
});

// ─── Retry / Cancel orchestrator run ──────────────────────────────────────────

router.post('/orchestrator-runs/:runId/retry', requirePermission('PIPELINE_RUN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `CALL execution.pr_retry_orchestrator_run($1::uuid, $2::uuid, null)`,
        [req.params.runId, userId],
      );
      if (!r.rows[0]) throw new Error('Run not found');
      return { orch_run_id: r.rows[0].p_new_run_id };
    });
    return res.status(202).json({ success: true, data: { orchRunId: row.orch_run_id } });
  } catch (err) { return next(err); }
});

router.post('/orchestrator-runs/:runId/cancel', requirePermission('PIPELINE_RUN'), async (req: Request, res: Response, next: NextFunction) => {
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
