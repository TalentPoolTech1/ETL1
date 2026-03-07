import { db } from '../connection';
import { GeneratedArtifact, GenerationOptions } from '../../codegen/core/interfaces/engine.interfaces';

// ─── Row Types ────────────────────────────────────────────────────────────────

export interface ArtifactRow {
  id: string;
  pipeline_id: string;
  pipeline_version: string;
  technology: string;
  spark_version: string | null;
  generation_options: GenerationOptions | null;
  metadata: GeneratedArtifact['metadata'];
  files: GeneratedArtifact['files'];
  warning_count: number;
  error_count: number;
  generated_by: string | null;
  generated_at: Date;
}

export interface ExecutionRow {
  id: string;
  pipeline_id: string;
  artifact_id: string | null;
  execution_id: string | null;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  environment: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  duration_seconds: number | null;
  row_counts: Record<string, number> | null;
  error_message: string | null;
  triggered_by: string | null;
  created_at: Date;
}

// ─── Artifact Repository ──────────────────────────────────────────────────────

export class ArtifactRepository {

  async save(
    artifact: GeneratedArtifact,
    options?: GenerationOptions,
    generatedBy?: string
  ): Promise<ArtifactRow> {
    const warningCount = artifact.metadata.warnings.filter(w => w.severity === 'warn').length;
    const errorCount = artifact.metadata.warnings.filter(w => w.severity === 'error').length;

    const row = await db.queryOne<ArtifactRow>(
      `INSERT INTO generated_artifacts
         (pipeline_id, pipeline_version, technology, spark_version, generation_options,
          metadata, files, warning_count, error_count, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        artifact.pipelineId,
        artifact.files[0]?.fileName ?? artifact.pipelineName,
        artifact.technology,
        artifact.sparkVersion,
        options ? JSON.stringify(options) : null,
        JSON.stringify(artifact.metadata),
        JSON.stringify(artifact.files),
        warningCount,
        errorCount,
        generatedBy ?? null,
      ]
    );

    return row!;
  }

  async findById(id: string): Promise<ArtifactRow | null> {
    return db.queryOne<ArtifactRow>(
      `SELECT * FROM generated_artifacts WHERE id = $1`,
      [id]
    );
  }

  async findLatestForPipeline(pipelineId: string): Promise<ArtifactRow | null> {
    return db.queryOne<ArtifactRow>(
      `SELECT * FROM generated_artifacts
       WHERE pipeline_id = $1
       ORDER BY generated_at DESC
       LIMIT 1`,
      [pipelineId]
    );
  }

  async findAllForPipeline(pipelineId: string, limit = 10): Promise<ArtifactRow[]> {
    return db.queryMany<ArtifactRow>(
      `SELECT id, pipeline_id, pipeline_version, technology, spark_version,
              warning_count, error_count, generated_by, generated_at
       FROM generated_artifacts
       WHERE pipeline_id = $1
       ORDER BY generated_at DESC
       LIMIT $2`,
      [pipelineId, limit]
    );
  }

  async deleteOldArtifacts(pipelineId: string, keepLatest = 5): Promise<number> {
    const result = await db.query(
      `DELETE FROM generated_artifacts
       WHERE pipeline_id = $1
         AND id NOT IN (
           SELECT id FROM generated_artifacts
           WHERE pipeline_id = $1
           ORDER BY generated_at DESC
           LIMIT $2
         )`,
      [pipelineId, keepLatest]
    );
    return result.rowCount ?? 0;
  }

  // ─── Execution tracking ────────────────────────────────────────────────────

  async createExecution(
    pipelineId: string,
    artifactId?: string,
    triggeredBy?: string,
    environment?: string
  ): Promise<ExecutionRow> {
    const row = await db.queryOne<ExecutionRow>(
      `INSERT INTO pipeline_executions
         (pipeline_id, artifact_id, status, environment, triggered_by)
       VALUES ($1, $2, 'PENDING', $3, $4)
       RETURNING *`,
      [pipelineId, artifactId ?? null, environment ?? null, triggeredBy ?? null]
    );
    return row!;
  }

  async updateExecution(
    id: string,
    updates: Partial<Pick<ExecutionRow, 'status' | 'execution_id' | 'started_at' | 'completed_at' | 'duration_seconds' | 'row_counts' | 'error_message'>>
  ): Promise<ExecutionRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [id];
    let i = 2;

    if (updates.status !== undefined) { sets.push(`status = $${i++}`); params.push(updates.status); }
    if (updates.execution_id !== undefined) { sets.push(`execution_id = $${i++}`); params.push(updates.execution_id); }
    if (updates.started_at !== undefined) { sets.push(`started_at = $${i++}`); params.push(updates.started_at); }
    if (updates.completed_at !== undefined) { sets.push(`completed_at = $${i++}`); params.push(updates.completed_at); }
    if (updates.duration_seconds !== undefined) { sets.push(`duration_seconds = $${i++}`); params.push(updates.duration_seconds); }
    if (updates.row_counts !== undefined) { sets.push(`row_counts = $${i++}`); params.push(JSON.stringify(updates.row_counts)); }
    if (updates.error_message !== undefined) { sets.push(`error_message = $${i++}`); params.push(updates.error_message); }

    if (sets.length === 0) return null;

    return db.queryOne<ExecutionRow>(
      `UPDATE pipeline_executions SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
  }

  async getExecutionHistory(
    pipelineId: string,
    limit = 20
  ): Promise<ExecutionRow[]> {
    return db.queryMany<ExecutionRow>(
      `SELECT * FROM pipeline_executions
       WHERE pipeline_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [pipelineId, limit]
    );
  }
}

export const artifactRepository = new ArtifactRepository();
