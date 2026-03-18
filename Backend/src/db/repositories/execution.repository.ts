import { db } from '../connection';
import { CorrelationContext } from '@shared/logging';
import { PipelineRun, NodeRun } from '@shared/types/api.types';

export class ExecutionRepository {
  /**
   * Initializes a new pipeline run in PENDING state.
   */
  async initializeRun(params: {
    pipelineId: string;
    versionId: string;
    envId?: string;
    triggerType?: string;
  }): Promise<string> {
    const ctx = CorrelationContext.get();
    const userId = ctx.userId || '00000000-0000-0000-0000-000000000000';

    const result = await db.query<{ p_pipeline_run_id: string }>(
      'CALL execution.pr_initialize_pipeline_run($1, $2, $3, $4, NULL, $5)',
      [
        params.pipelineId,
        params.versionId,
        params.envId || null,
        userId,
        params.triggerType || 'MANUAL'
      ]
    );

    return result.rows[0].p_pipeline_run_id;
  }

  /**
   * Moves a run to RUNNING state.
   */
  async startRun(runId: string, externalJobId?: string): Promise<void> {
    await db.query(
      'CALL execution.pr_start_pipeline_run($1, $2)',
      [runId, externalJobId || null]
    );
  }

  /**
   * Sets terminal status for a run.
   */
  async finalizeRun(runId: string, status: string): Promise<void> {
    await db.query(
      'CALL execution.pr_finalize_pipeline_run($1, $2)',
      [runId, status]
    );
  }

  /**
   * Records or updates node execution status.
   */
  async updateNodeStatus(params: {
    runId: string;
    nodeId: string;
    status: string;
    displayName?: string;
    metrics?: any;
  }): Promise<void> {
    await db.query(
      'CALL execution.pr_update_node_status($1, $2, $3, $4, $5)',
      [
        params.runId,
        params.nodeId,
        params.status,
        params.displayName || null,
        params.metrics ? JSON.stringify(params.metrics) : null
      ]
    );
  }

  /**
   * Appends a log line to a run.
   */
  async appendLog(params: {
    runId: string;
    level: string;
    source: string;
    message: string;
  }): Promise<void> {
    await db.query(
      'CALL execution.pr_append_run_log($1, $2, $3, $4)',
      [params.runId, params.level, params.source, params.message]
    );
  }

  /**
   * Gets run history for a pipeline.
   */
  async getHistory(pipelineId: string, limit: number = 50): Promise<PipelineRun[]> {
    const result = await db.query<any>(
      'SELECT * FROM execution.fn_get_pipeline_run_history($1, $2)',
      [pipelineId, limit]
    );

    return result.rows.map(row => ({
      runId: row.pipeline_run_id,
      pipelineId,
      versionId: row.version_id, // Note: version_id is not in fn_get_pipeline_run_history currently, need to check
      status: row.run_status_code,
      triggerType: row.trigger_type_code,
      startedAt: row.start_dtm,
      endedAt: row.end_dtm,
      createdAt: row.created_dtm
    }));
  }
  /**
   * Returns ordered log lines for a pipeline run.
   */
  async getLogs(runId: string, level?: string): Promise<any[]> {
    const result = await db.query<any>(
      'SELECT * FROM execution.fn_get_pipeline_run_logs($1, $2)',
      [runId, level || null]
    );
    return result.rows;
  }
}

export const executionRepository = new ExecutionRepository();
