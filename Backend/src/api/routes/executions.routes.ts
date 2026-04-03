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
import { LoggerFactory } from '../../shared/logging';
import { executePipelineSpark } from './pipeline.routes';
import { executeOrchestratorRun } from './orchestrators.routes';
import fs from 'fs';

const log = LoggerFactory.get('executions');

const router = Router();
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

type RetryDagStep = {
  stepId: string;
  kind: 'pipeline' | 'orchestrator' | 'parallel_group';
  onSuccess?: string;
  onFailure?: string;
  parallelSteps?: RetryDagStep[];
};

function normalizeRetryStep(raw: any): RetryDagStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const stepId = typeof raw.stepId === 'string' && raw.stepId.trim() ? raw.stepId.trim() : '';
  if (!stepId) return null;
  const kind = raw.kind === 'parallel_group' || raw.kind === 'orchestrator' ? raw.kind : 'pipeline';
  const parallelSteps = kind === 'parallel_group' && Array.isArray(raw.parallelSteps)
    ? raw.parallelSteps.map(normalizeRetryStep).filter(Boolean) as RetryDagStep[]
    : undefined;
  return {
    stepId,
    kind,
    onSuccess: typeof raw.onSuccess === 'string' ? raw.onSuccess.trim() || undefined : undefined,
    onFailure: typeof raw.onFailure === 'string' ? raw.onFailure.trim() || undefined : undefined,
    parallelSteps,
  };
}

function normalizeRetryDag(raw: any): { steps: RetryDagStep[]; entryStepId?: string } {
  if (!raw || typeof raw !== 'object') return { steps: [] };
  const steps = Array.isArray(raw.steps)
    ? raw.steps.map(normalizeRetryStep).filter(Boolean) as RetryDagStep[]
    : [];
  const entryStepId = typeof raw.entryStepId === 'string' && raw.entryStepId.trim() ? raw.entryStepId.trim() : undefined;
  return { steps, entryStepId };
}

function resolveRetryNextStepId(steps: RetryDagStep[], currentIndex: number, step: RetryDagStep): string | null {
  const defaultNext = currentIndex + 1 < steps.length ? steps[currentIndex + 1].stepId : null;
  if (step.onSuccess === '__end__') return null;
  return step.onSuccess || defaultNext;
}

function summarizeTopLevelStepStatus(
  step: RetryDagStep,
  pipelineStatusByStepId: Map<string, string>,
  orchestratorStatusByStepId: Map<string, string>,
): 'SUCCESS' | 'FAILED' | 'PENDING' {
  if (step.kind === 'pipeline') {
    const status = pipelineStatusByStepId.get(step.stepId);
    if (status === 'SUCCESS') return 'SUCCESS';
    if (status) return 'FAILED';
    return 'PENDING';
  }
  if (step.kind === 'orchestrator') {
    const status = orchestratorStatusByStepId.get(step.stepId);
    if (status === 'SUCCESS') return 'SUCCESS';
    if (status) return 'FAILED';
    return 'PENDING';
  }

  const children = step.parallelSteps ?? [];
  if (children.length === 0) return 'SUCCESS';
  let seenAny = false;
  for (const child of children) {
    const childStatus = summarizeTopLevelStepStatus(child, pipelineStatusByStepId, orchestratorStatusByStepId);
    if (childStatus === 'FAILED') return 'FAILED';
    if (childStatus === 'PENDING') return 'PENDING';
    seenAny = true;
  }
  return seenAny ? 'SUCCESS' : 'PENDING';
}

async function computeRetryResumeStepId(originalRunId: string, userId: string): Promise<string | null> {
  return db.transaction(async client => {
    await setSession(client, userId);

    const originalRun = await client.query(
      `SELECT orch_id
       FROM execution.orchestrator_runs
       WHERE orch_run_id = $1::uuid`,
      [originalRunId],
    );
    const orchId = originalRun.rows[0]?.orch_id as string | undefined;
    if (!orchId) return null;

    const [dagResult, pipelineChildrenResult, childOrchestratorResult] = await Promise.all([
      client.query(
        `SELECT dag_definition_json
         FROM catalog.fn_get_orchestrator_by_id($1::uuid)`,
        [orchId],
      ),
      client.query(
        `SELECT dag_node_id_text, run_status_code
         FROM execution.fn_get_orchestrator_run_pipeline_map($1::uuid)`,
        [originalRunId],
      ),
      client.query(
        `SELECT dag_step_id_text, run_status_code
         FROM execution.fn_get_child_orchestrator_runs($1::uuid)`,
        [originalRunId],
      ),
    ]);

    const dag = normalizeRetryDag(dagResult.rows[0]?.dag_definition_json);
    const steps = dag.steps;
    if (steps.length === 0) return null;

    const pipelineStatusByStepId = new Map<string, string>();
    for (const row of pipelineChildrenResult.rows) {
      const stepId = String(row.dag_node_id_text ?? '').trim();
      if (!stepId || pipelineStatusByStepId.has(stepId)) continue;
      pipelineStatusByStepId.set(stepId, String(row.run_status_code ?? ''));
    }

    const orchestratorStatusByStepId = new Map<string, string>();
    for (const row of childOrchestratorResult.rows) {
      const stepId = String(row.dag_step_id_text ?? '').trim();
      if (!stepId || orchestratorStatusByStepId.has(stepId)) continue;
      orchestratorStatusByStepId.set(stepId, String(row.run_status_code ?? ''));
    }

    const stepIndex = new Map(steps.map((step, index) => [step.stepId, index]));
    let currentStepId: string | null =
      dag.entryStepId && stepIndex.has(dag.entryStepId)
        ? dag.entryStepId
        : steps[0].stepId;
    const visited = new Set<string>();

    while (currentStepId) {
      if (visited.has(currentStepId)) return currentStepId;
      visited.add(currentStepId);

      const currentIndex = stepIndex.get(currentStepId);
      if (currentIndex === undefined) return currentStepId;
      const step = steps[currentIndex];
      const status = summarizeTopLevelStepStatus(step, pipelineStatusByStepId, orchestratorStatusByStepId);
      if (status !== 'SUCCESS') return currentStepId;
      currentStepId = resolveRetryNextStepId(steps, currentIndex, step);
    }

    return '__complete__';
  });
}

// ─── Environments ─────────────────────────────────────────────────────────────

router.get('/environments', requirePermission('PIPELINE_VIEW'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT env_id, env_display_name, is_prod_env_flag, created_dtm, updated_dtm
         FROM execution.fn_get_environments()`,
      );
      return r.rows;
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ─── KPIs ──────────────────────────────────────────────────────────────────────

router.get('/kpis', requirePermission('AUDIT_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { projectId, dateFrom, dateTo, objectType, myJobsOnly, scope } = req.query;

    const kpis = await db.transaction(async client => {
      await setSession(client, userId);
      const today = new Date().toISOString().slice(0, 10);
      const from  = (dateFrom as string) ?? today;
      const to    = (dateTo   as string) ?? today;
      const projectUuid = projectId ? String(projectId) : null;
      const scopedToMyJobs = myJobsOnly === 'true';
      const normalizedScope = scope === 'project' ? 'project' : 'global';

      const pipelinePromise = objectType === 'orchestrator'
        ? Promise.resolve({
            totalToday: 0,
            runningNow: 0,
            successRateToday: 0,
            failedToday: 0,
            avgDurationMsToday: null as number | null,
            slaBreachesToday: 0,
            dataVolumeGbToday: 0,
            activePipelines: 0,
          })
        : client.query(
            `SELECT
               COUNT(*)::int AS total_today,
               COUNT(*) FILTER (WHERE pr.run_status_code = 'RUNNING')::int AS running_now,
               COUNT(*) FILTER (WHERE pr.run_status_code = 'SUCCESS')::int AS success_today,
               COUNT(*) FILTER (WHERE pr.run_status_code = 'FAILED')::int AS failed_today,
               AVG(pr.run_duration_ms)::numeric AS avg_duration_ms_today,
               COUNT(*) FILTER (WHERE pr.sla_status_code = 'BREACHED')::int AS sla_breaches_today,
               COALESCE(SUM(pr.bytes_read_num), 0)::numeric / 1000000000.0 AS data_volume_gb_today,
               COUNT(DISTINCT pr.pipeline_id)::int AS active_pipelines
             FROM execution.pipeline_runs pr
             LEFT JOIN catalog.pipelines p ON p.pipeline_id = pr.pipeline_id
             WHERE ($1::date IS NULL OR COALESCE(pr.start_dtm::date, pr.created_dtm::date) >= $1::date)
               AND ($2::date IS NULL OR COALESCE(pr.start_dtm::date, pr.created_dtm::date) <= $2::date)
               AND (
                 ($3::text = 'global' AND p.project_id IS NULL)
                 OR (
                   $3::text = 'project'
                   AND (
                     ($4::uuid IS NOT NULL AND p.project_id = $4::uuid)
                     OR ($4::uuid IS NULL AND p.project_id IS NOT NULL)
                   )
                 )
               )
               AND (NOT $5 OR pr.triggered_by_user_id = $6::uuid)`,
            [from, to, normalizedScope, projectUuid, scopedToMyJobs, userId],
          ).then(r => {
            const row = r.rows[0] ?? {};
            const totalToday = parseInt(row.total_today ?? '0');
            const successCountToday = parseInt(row.success_today ?? '0');
            return {
              totalToday,
              runningNow:         parseInt(row.running_now          ?? '0'),
              successRateToday:   totalToday > 0 ? (successCountToday / totalToday) * 100 : 0,
              failedToday:        parseInt(row.failed_today         ?? '0'),
              avgDurationMsToday: row.avg_duration_ms_today ? parseFloat(row.avg_duration_ms_today) : null,
              slaBreachesToday:   parseInt(row.sla_breaches_today   ?? '0'),
              dataVolumeGbToday:  parseFloat(row.data_volume_gb_today ?? '0'),
              activePipelines:    parseInt(row.active_pipelines ?? '0'),
            };
          });

      const orchestratorPromise = objectType === 'pipeline'
        ? Promise.resolve({
            totalToday: 0,
            runningNow: 0,
            successCountToday: 0,
            failedToday: 0,
            avgDurationMsToday: null as number | null,
            activePipelines: 0,
          })
        : client.query(
            `SELECT
               COUNT(*)::int AS total_today,
               COUNT(*) FILTER (WHERE orch.run_status_code = 'RUNNING')::int AS running_now,
               COUNT(*) FILTER (WHERE orch.run_status_code = 'SUCCESS')::int AS success_today,
               COUNT(*) FILTER (WHERE orch.run_status_code = 'FAILED')::int AS failed_today,
               AVG(orch.run_duration_ms)::numeric AS avg_duration_ms_today,
               COUNT(DISTINCT orch.orch_id)::int AS active_orchestrators
             FROM execution.orchestrator_runs orch
             LEFT JOIN catalog.orchestrators o ON o.orch_id = orch.orch_id
             WHERE (
               ($1::text = 'global' AND o.project_id IS NULL)
               OR (
                 $1::text = 'project'
                 AND (
                   ($2::uuid IS NOT NULL AND o.project_id = $2::uuid)
                   OR ($2::uuid IS NULL AND o.project_id IS NOT NULL)
                 )
               )
             )
               AND ($3::date IS NULL OR COALESCE(orch.start_dtm::date, orch.created_dtm::date) >= $3::date)
               AND ($4::date IS NULL OR COALESCE(orch.start_dtm::date, orch.created_dtm::date) <= $4::date)
               AND (NOT $5 OR orch.triggered_by_user_id = $6::uuid)`,
            [normalizedScope, projectUuid, from, to, scopedToMyJobs, userId],
          ).then(r => {
            const row = r.rows[0] ?? {};
            return {
              totalToday: parseInt(row.total_today ?? '0'),
              runningNow: parseInt(row.running_now ?? '0'),
              successCountToday: parseInt(row.success_today ?? '0'),
              failedToday: parseInt(row.failed_today ?? '0'),
              avgDurationMsToday: row.avg_duration_ms_today ? parseFloat(row.avg_duration_ms_today) : null,
              activePipelines: parseInt(row.active_orchestrators ?? '0'),
            };
          });

      const [pipelineKpis, orchestratorKpis] = await Promise.all([pipelinePromise, orchestratorPromise]);
      const totalToday = pipelineKpis.totalToday + orchestratorKpis.totalToday;
      const successfulToday = Math.round((pipelineKpis.totalToday * pipelineKpis.successRateToday) / 100) + orchestratorKpis.successCountToday;
      const avgDurationMsToday = totalToday > 0
        ? (
            (((pipelineKpis.avgDurationMsToday ?? 0) * pipelineKpis.totalToday) +
             ((orchestratorKpis.avgDurationMsToday ?? 0) * orchestratorKpis.totalToday)) / totalToday
          )
        : null;

      return {
        totalToday,
        runningNow: pipelineKpis.runningNow + orchestratorKpis.runningNow,
        successRateToday: totalToday > 0 ? (successfulToday / totalToday) * 100 : 0,
        failedToday: pipelineKpis.failedToday + orchestratorKpis.failedToday,
        avgDurationMsToday,
        slaBreachesToday: pipelineKpis.slaBreachesToday,
        dataVolumeGbToday: pipelineKpis.dataVolumeGbToday,
        activePipelines: pipelineKpis.activePipelines + orchestratorKpis.activePipelines,
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
      dateFrom, dateTo, myJobsOnly, scope,
      page = '1', pageSize = '50',
    } = req.query;

    const limit  = Math.min(parseInt(String(pageSize)), 500);
    const offset = (parseInt(String(page)) - 1) * limit;
    const normalizedScope = scope === 'project' ? 'project' : 'global';

    const rows = await db.transaction(async client => {
      await setSession(client, userId);

      const [data, count] = await Promise.all([
        client.query(
          `SELECT
             pr.pipeline_run_id,
             p.pipeline_display_name AS pipeline_name,
             pr.pipeline_id,
             p.project_id,
             proj.project_display_name AS project_name,
             COALESCE(pv.release_tag_label, 'v' || pv.version_num_seq::text) AS version_label,
             pr.run_status_code AS run_status,
             pr.trigger_type_code AS trigger_type,
             u.user_full_name AS submitted_by,
             pr.start_dtm,
             pr.end_dtm,
             pr.run_duration_ms AS duration_ms,
             pr.rows_processed_num AS rows_processed,
             pr.bytes_read_num AS bytes_read,
             pr.bytes_written_num AS bytes_written,
             pr.error_message_text AS error_message,
             pr.retry_count_num AS retry_count,
             pr.sla_status_code AS sla_status
           FROM execution.pipeline_runs pr
           LEFT JOIN catalog.pipelines p ON p.pipeline_id = pr.pipeline_id
           LEFT JOIN catalog.pipeline_versions pv ON pv.version_id = pr.version_id
           LEFT JOIN etl.projects proj ON proj.project_id = p.project_id
           LEFT JOIN etl.users u ON u.user_id = pr.triggered_by_user_id
           WHERE ($1::uuid IS NULL OR pr.pipeline_id = $1::uuid)
             AND (
               $1::uuid IS NOT NULL
               OR (
                 ($2::text = 'global' AND p.project_id IS NULL)
                 OR (
                   $2::text = 'project'
                   AND (
                     ($3::uuid IS NOT NULL AND p.project_id = $3::uuid)
                     OR ($3::uuid IS NULL AND p.project_id IS NOT NULL)
                   )
                 )
               )
             )
             AND ($4::text IS NULL OR pr.run_status_code = $4::text)
             AND ($5::text IS NULL OR pr.trigger_type_code = $5::text)
             AND ($6::date IS NULL OR DATE(COALESCE(pr.start_dtm, pr.created_dtm)) >= $6::date)
             AND ($7::date IS NULL OR DATE(COALESCE(pr.start_dtm, pr.created_dtm)) <= $7::date)
             AND ($8::text IS NULL OR (
               COALESCE(p.pipeline_display_name, '') ILIKE '%' || $8::text || '%'
               OR pr.pipeline_run_id::text ILIKE '%' || $8::text || '%'
               OR COALESCE(u.user_full_name, '') ILIKE '%' || $8::text || '%'
             ))
             AND (NOT $9 OR pr.triggered_by_user_id = $10::uuid)
           ORDER BY pr.start_dtm DESC NULLS LAST, pr.created_dtm DESC
           LIMIT $11 OFFSET $12`,
          [
            pipelineId  ? String(pipelineId)  : null,
            normalizedScope,
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
          `SELECT COUNT(*)::bigint AS cnt
           FROM execution.pipeline_runs pr
           LEFT JOIN catalog.pipelines p ON p.pipeline_id = pr.pipeline_id
           LEFT JOIN etl.users u ON u.user_id = pr.triggered_by_user_id
           WHERE ($1::uuid IS NULL OR pr.pipeline_id = $1::uuid)
             AND (
               $1::uuid IS NOT NULL
               OR (
                 ($2::text = 'global' AND p.project_id IS NULL)
                 OR (
                   $2::text = 'project'
                   AND (
                     ($3::uuid IS NOT NULL AND p.project_id = $3::uuid)
                     OR ($3::uuid IS NULL AND p.project_id IS NOT NULL)
                   )
                 )
               )
             )
             AND ($4::text IS NULL OR pr.run_status_code = $4::text)
             AND ($5::text IS NULL OR pr.trigger_type_code = $5::text)
             AND ($6::date IS NULL OR DATE(COALESCE(pr.start_dtm, pr.created_dtm)) >= $6::date)
             AND ($7::date IS NULL OR DATE(COALESCE(pr.start_dtm, pr.created_dtm)) <= $7::date)
             AND ($8::text IS NULL OR (
               COALESCE(p.pipeline_display_name, '') ILIKE '%' || $8::text || '%'
               OR pr.pipeline_run_id::text ILIKE '%' || $8::text || '%'
               OR COALESCE(u.user_full_name, '') ILIKE '%' || $8::text || '%'
             ))
             AND (NOT $9 OR pr.triggered_by_user_id = $10::uuid)`,
          [
            pipelineId  ? String(pipelineId)  : null,
            normalizedScope,
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
    const detail = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT * FROM execution.fn_get_pipeline_run_detail($1::uuid)`,
        [req.params.runId],
      );

      const nodesResult = await client.query(
        `SELECT * FROM execution.fn_get_pipeline_run_nodes_detail($1::uuid)`,
        [req.params.runId],
      );
      const artifactsResult = await client.query(
        `SELECT * FROM execution.fn_get_run_artifacts($1::uuid)`,
        [req.params.runId],
      );

      const outRow = r.rows[0] ?? null;
      if (outRow) {
        outRow.nodes = nodesResult.rows;
        outRow.run_artifacts = artifactsResult.rows;
      }
      return outRow;
    });
    if (!detail) return res.status(404).json({ success: false, userMessage: 'Run not found' });

    const generatedCodeArtifact = [...(detail.run_artifacts ?? [])]
      .reverse()
      .find((artifact: any) => artifact.artifact_type_code === 'GENERATED_CODE');
    let generatedCodeRef: string | null = null;
    const generatedCodePath = typeof generatedCodeArtifact?.storage_uri_text === 'string'
      ? generatedCodeArtifact.storage_uri_text
      : null;
    if (generatedCodePath && fs.existsSync(generatedCodePath)) {
      try {
        generatedCodeRef = fs.readFileSync(generatedCodePath, 'utf8');
      } catch {
        generatedCodeRef = null;
      }
    }

    return res.json({ success: true, data: {
      pipelineRunId:  detail.pipeline_run_id,
      pipelineName:   detail.pipeline_name  ?? '',
      projectName:    detail.project_name,
      versionLabel:   detail.version_label  ?? '',
      runStatus:      detail.run_status,
      triggerType:    detail.trigger_type,
      submittedBy:    detail.submitted_by,
      startDtm:       detail.start_dtm,
      endDtm:         detail.end_dtm,
      durationMs:     detail.duration_ms,
      rowsProcessed:  detail.rows_processed,
      bytesRead:      detail.bytes_read,
      bytesWritten:   detail.bytes_written,
      errorMessage:   detail.error_message,
      retryCount:     detail.retry_count    ?? 0,
      slaStatus:      detail.sla_status     ?? 'N_A',
      generatedCodeRef,
      sparkJobId:     detail.spark_job_id,
      sparkUiUrl:     detail.spark_ui_url,
      nodes:          detail.nodes,
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
      return r.rows.map((row: any) => ({
        logId:      row.log_id,
        logDtm:     row.created_dtm,
        logLevel:   row.log_level_code,
        logSource:  row.log_source_code,
        logMessage: row.log_message_text,
      }));
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
      // Get the pipeline_id from the original run before creating the retry
      const orig = await client.query(
        `SELECT pipeline_id FROM execution.pipeline_runs WHERE pipeline_run_id = $1::uuid`,
        [req.params.runId],
      );
      if (!orig.rows[0]) throw Object.assign(new Error('Run not found'), { status: 404 });
      const pipelineId = orig.rows[0].pipeline_id as string;
      const r = await client.query(
        `CALL execution.pr_retry_pipeline_run($1::uuid, $2::uuid, null)`,
        [req.params.runId, userId],
      );
      if (!r.rows[0]?.p_new_run_id) throw new Error('Retry procedure did not return a new run ID');
      return { pipeline_run_id: r.rows[0].p_new_run_id as string, pipeline_id: pipelineId };
    });
    // Fire the Spark job asynchronously — same pattern as the primary run endpoint
    executePipelineSpark(row.pipeline_run_id, userId, row.pipeline_id).catch((err) => {
      log.error('executions.retry', 'Unhandled error in retried spark execution', err as Error, { runId: row.pipeline_run_id });
    });
    return res.status(202).json({ success: true, data: { pipelineRunId: row.pipeline_run_id } });
  } catch (err: any) {
    if (err.status === 404) return res.status(404).json({ success: false, userMessage: 'Run not found' });
    return next(err);
  }
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

router.post('/pipeline-runs/:runId/mark-ok', requirePermission('PIPELINE_RUN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const result = await db.transaction(async client => {
      await setSession(client, userId);
      const existing = await client.query(
        `SELECT pipeline_run_id, pipeline_id, run_status_code, run_options_json
         FROM execution.pipeline_runs
         WHERE pipeline_run_id = $1::uuid`,
        [req.params.runId],
      );
      const row = existing.rows[0];
      if (!row) return { ok: false as const, status: 404 as const };

      const runStatus = String(row.run_status_code ?? '');
      if (['PENDING', 'QUEUED', 'RUNNING'].includes(runStatus)) {
        return { ok: false as const, status: 409 as const, runStatus };
      }

      const previousOptions = row.run_options_json && typeof row.run_options_json === 'object'
        ? row.run_options_json
        : {};
      await client.query(
        `CALL execution.pr_set_pipeline_run_options($1::uuid, $2::jsonb)`,
        [
          req.params.runId,
          JSON.stringify({
            ...previousOptions,
            manualOverride: {
              decision: 'OK',
              previousStatus: runStatus,
              markedBy: userId,
              markedAt: new Date().toISOString(),
              reason: reason || null,
            },
          }),
        ],
      );
      await client.query(`CALL execution.pr_mark_pipeline_run_ok($1::uuid)`, [req.params.runId]);
      return { ok: true as const, pipelineId: row.pipeline_id as string };
    });

    if (!result.ok) {
      if (result.status === 404) {
        return res.status(404).json({ success: false, userMessage: 'Pipeline run not found' });
      }
      return res.status(409).json({
        success: false,
        userMessage: `Pipeline run cannot be marked OK from status ${result.runStatus}`,
      });
    }
    return res.json({ success: true, data: { pipelineRunId: req.params.runId } });
  } catch (err) { next(err); }
});

// ─── Orchestrator runs list ────────────────────────────────────────────────────

router.get('/orchestrator-runs', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const {
      projectId, orchestratorId, status, triggerType, search,
      dateFrom, dateTo, myJobsOnly, scope,
      page = '1', pageSize = '50'
    } = req.query;
    const limit  = Math.min(parseInt(String(pageSize)), 500);
    const offset = (parseInt(String(page)) - 1) * limit;
    const normalizedScope = scope === 'project' ? 'project' : 'global';

    const rows = await db.transaction(async client => {
      await setSession(client, userId);

      const [data, count] = await Promise.all([
        client.query(
          `SELECT
             orch.orch_run_id,
             o.orch_display_name AS orchestrator_name,
             orch.orch_id,
             o.project_id,
             proj.project_display_name AS project_name,
             orch.run_status_code AS run_status,
             orch.trigger_type_code AS trigger_type,
             u.user_full_name AS submitted_by,
             orch.start_dtm,
             orch.end_dtm,
             orch.run_duration_ms AS duration_ms,
             orch.error_message_text AS error_message,
             orch.retry_count_num AS retry_count
           FROM execution.orchestrator_runs orch
           LEFT JOIN catalog.orchestrators o ON o.orch_id = orch.orch_id
           LEFT JOIN etl.projects proj ON proj.project_id = o.project_id
           LEFT JOIN etl.users u ON u.user_id = orch.triggered_by_user_id
           WHERE (
             ($1::text = 'global' AND o.project_id IS NULL)
             OR (
               $1::text = 'project'
               AND (
                 ($2::uuid IS NOT NULL AND o.project_id = $2::uuid)
                 OR ($2::uuid IS NULL AND o.project_id IS NOT NULL)
               )
             )
           )
             AND ($3::uuid IS NULL OR orch.orch_id = $3::uuid)
             AND ($4::text IS NULL OR orch.run_status_code = $4::text)
             AND ($5::text IS NULL OR orch.trigger_type_code = $5::text)
             AND ($6::date IS NULL OR COALESCE(orch.start_dtm::date, orch.created_dtm::date) >= $6::date)
             AND ($7::date IS NULL OR COALESCE(orch.start_dtm::date, orch.created_dtm::date) <= $7::date)
             AND ($8::text IS NULL OR (
               orch.orch_run_id::text ILIKE '%' || $8::text || '%'
               OR COALESCE(o.orch_display_name, '') ILIKE '%' || $8::text || '%'
               OR COALESCE(u.user_full_name, '') ILIKE '%' || $8::text || '%'
             ))
             AND (NOT $9 OR orch.triggered_by_user_id = $10::uuid)
           ORDER BY orch.start_dtm DESC NULLS LAST, orch.created_dtm DESC
           LIMIT $11 OFFSET $12`,
          [
            normalizedScope,
            projectId      ? String(projectId)      : null,
            orchestratorId ? String(orchestratorId) : null,
            status      ? String(status)      : null,
            triggerType ? String(triggerType) : null,
            dateFrom ? String(dateFrom) : null,
            dateTo ? String(dateTo) : null,
            search ? String(search) : null,
            myJobsOnly === 'true',
            userId,
            limit,
            offset,
          ],
        ),
        client.query(
          `SELECT COUNT(*)::bigint AS cnt
           FROM execution.orchestrator_runs orch
           LEFT JOIN catalog.orchestrators o ON o.orch_id = orch.orch_id
           LEFT JOIN etl.users u ON u.user_id = orch.triggered_by_user_id
           WHERE (
             ($1::text = 'global' AND o.project_id IS NULL)
             OR (
               $1::text = 'project'
               AND (
                 ($2::uuid IS NOT NULL AND o.project_id = $2::uuid)
                 OR ($2::uuid IS NULL AND o.project_id IS NOT NULL)
               )
             )
           )
             AND ($3::uuid IS NULL OR orch.orch_id = $3::uuid)
             AND ($4::text IS NULL OR orch.run_status_code = $4::text)
             AND ($5::text IS NULL OR orch.trigger_type_code = $5::text)
             AND ($6::date IS NULL OR COALESCE(orch.start_dtm::date, orch.created_dtm::date) >= $6::date)
             AND ($7::date IS NULL OR COALESCE(orch.start_dtm::date, orch.created_dtm::date) <= $7::date)
             AND ($8::text IS NULL OR (
               orch.orch_run_id::text ILIKE '%' || $8::text || '%'
               OR COALESCE(o.orch_display_name, '') ILIKE '%' || $8::text || '%'
               OR COALESCE(u.user_full_name, '') ILIKE '%' || $8::text || '%'
             ))
             AND (NOT $9 OR orch.triggered_by_user_id = $10::uuid)`,
          [
            normalizedScope,
            projectId      ? String(projectId)      : null,
            orchestratorId ? String(orchestratorId) : null,
            status      ? String(status)      : null,
            triggerType ? String(triggerType) : null,
            dateFrom ? String(dateFrom) : null,
            dateTo ? String(dateTo) : null,
            search ? String(search) : null,
            myJobsOnly === 'true',
            userId,
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
          submittedBy:      r.submitted_by ?? null,
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
    const resumeFromStepId = await computeRetryResumeStepId(req.params.runId, userId);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const originalRun = await client.query(
        `SELECT orch_id, env_id, run_options_json
         FROM execution.orchestrator_runs
         WHERE orch_run_id = $1::uuid`,
        [req.params.runId],
      );
      if (!originalRun.rows[0]) throw Object.assign(new Error('Run not found'), { status: 404 });
      const r = await client.query(
        `CALL execution.pr_retry_orchestrator_run($1::uuid, $2::uuid, null)`,
        [req.params.runId, userId],
      );
      if (!r.rows[0]) throw Object.assign(new Error('Run not found'), { status: 404 });
      const previousOptions = originalRun.rows[0].run_options_json && typeof originalRun.rows[0].run_options_json === 'object'
        ? originalRun.rows[0].run_options_json
        : {};
      await client.query(
        `CALL execution.pr_set_orchestrator_run_options($1::uuid, $2::jsonb)`,
        [
          r.rows[0].p_new_run_id as string,
          JSON.stringify({
            ...previousOptions,
            requestedBy: userId,
            resumedFromRunId: req.params.runId,
            resumeFromStepId: resumeFromStepId ?? null,
          }),
        ],
      );
      return {
        orch_run_id: r.rows[0].p_new_run_id as string,
        orch_id: originalRun.rows[0].orch_id as string,
        env_id: (originalRun.rows[0].env_id as string | null | undefined) ?? null,
      };
    });
    executeOrchestratorRun(row.orch_run_id, row.orch_id, userId, row.env_id).catch((err) => {
      log.error('executions.retry', 'Unhandled error in retried orchestrator execution', err as Error, {
        orchRunId: row.orch_run_id,
        orchId: row.orch_id,
      });
    });
    return res.status(202).json({ success: true, data: { orchRunId: row.orch_run_id } });
  } catch (err: any) {
    if (err?.status === 404) return res.status(404).json({ success: false, userMessage: 'Run not found' });
    return next(err);
  }
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

router.post('/orchestrator-runs/:runId/mark-ok', requirePermission('PIPELINE_RUN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const result = await db.transaction(async client => {
      await setSession(client, userId);
      const existing = await client.query(
        `SELECT orch_run_id, run_status_code, run_options_json
         FROM execution.fn_get_orchestrator_run_detail($1::uuid)`,
        [req.params.runId],
      );
      const row = existing.rows[0];
      if (!row) return { ok: false as const, status: 404 as const };

      const runStatus = String(row.run_status_code ?? '');
      if (['PENDING', 'QUEUED', 'RUNNING'].includes(runStatus)) {
        return { ok: false as const, status: 409 as const, runStatus };
      }

      const previousOptions = row.run_options_json && typeof row.run_options_json === 'object'
        ? row.run_options_json
        : {};
      await client.query(
        `CALL execution.pr_set_orchestrator_run_options($1::uuid, $2::jsonb)`,
        [
          req.params.runId,
          JSON.stringify({
            ...previousOptions,
            manualOverride: {
              decision: 'OK',
              previousStatus: runStatus,
              markedBy: userId,
              markedAt: new Date().toISOString(),
              reason: reason || null,
            },
          }),
        ],
      );
      await client.query(`CALL execution.pr_mark_orchestrator_run_ok($1::uuid)`, [req.params.runId]);
      return { ok: true as const };
    });

    if (!result.ok) {
      if (result.status === 404) {
        return res.status(404).json({ success: false, userMessage: 'Orchestrator run not found' });
      }
      return res.status(409).json({
        success: false,
        userMessage: `Orchestrator run cannot be marked OK from status ${result.runStatus}`,
      });
    }
    return res.json({ success: true, data: { orchRunId: req.params.runId } });
  } catch (err) { next(err); }
});

export { router as executionsRouter };
