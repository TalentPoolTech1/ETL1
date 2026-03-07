import { PoolClient } from 'pg';
import { db } from '../connection';
import { PipelineDefinition } from '../../codegen/core/types/pipeline.types';

// ─── DB Row Types ──────────────────────────────────────────────────────────────

export interface PipelineRow {
  id: string;
  name: string;
  version: string;
  description: string | null;
  technology: string;
  spark_version: string | null;
  definition: PipelineDefinition;
  tags: Record<string, string> | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PipelineVersionRow {
  id: string;
  pipeline_id: string;
  version: string;
  definition: PipelineDefinition;
  change_summary: string | null;
  created_by: string | null;
  created_at: Date;
}

export interface ListPipelinesFilter {
  technology?: string;
  isActive?: boolean;
  search?: string;
  tags?: Record<string, string>;
  limit?: number;
  offset?: number;
  orderBy?: 'name' | 'created_at' | 'updated_at';
  orderDir?: 'ASC' | 'DESC';
}

// ─── Pipeline Repository ──────────────────────────────────────────────────────

export class PipelineRepository {

  async create(
    pipeline: PipelineDefinition,
    createdBy?: string
  ): Promise<PipelineRow> {
    return db.transaction(async (client) => {
      // Insert pipeline
      const row = await client.query<PipelineRow>(
        `INSERT INTO pipelines
           (id, name, version, description, technology, spark_version, definition, tags, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         RETURNING *`,
        [
          pipeline.id,
          pipeline.name,
          pipeline.version,
          pipeline.description ?? null,
          pipeline.environment.technology,
          pipeline.environment.sparkVersion ?? null,
          JSON.stringify(pipeline),
          pipeline.tags ? JSON.stringify(pipeline.tags) : null,
          createdBy ?? null,
        ]
      );

      // Create initial version snapshot
      await this.createVersionSnapshot(client, pipeline.id, pipeline, '1.0.0 - Initial creation', createdBy);

      return row.rows[0];
    });
  }

  async findById(id: string): Promise<PipelineRow | null> {
    return db.queryOne<PipelineRow>(
      `SELECT * FROM pipelines WHERE id = $1 AND is_active = true`,
      [id]
    );
  }

  async findByName(name: string): Promise<PipelineRow[]> {
    return db.queryMany<PipelineRow>(
      `SELECT * FROM pipelines WHERE name ILIKE $1 AND is_active = true ORDER BY updated_at DESC`,
      [`%${name}%`]
    );
  }

  async list(filter: ListPipelinesFilter = {}): Promise<{ rows: PipelineRow[]; total: number }> {
    const conditions: string[] = ['p.is_active = true'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter.technology) {
      conditions.push(`p.technology = $${paramIdx++}`);
      params.push(filter.technology);
    }
    if (filter.isActive !== undefined) {
      conditions.push(`p.is_active = $${paramIdx++}`);
      params.push(filter.isActive);
    }
    if (filter.search) {
      conditions.push(`(p.name ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx})`);
      params.push(`%${filter.search}%`);
      paramIdx++;
    }
    if (filter.tags) {
      conditions.push(`p.tags @> $${paramIdx++}`);
      params.push(JSON.stringify(filter.tags));
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderCol = filter.orderBy ?? 'updated_at';
    const orderDir = filter.orderDir ?? 'DESC';
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const [dataResult, countResult] = await Promise.all([
      db.queryMany<PipelineRow>(
        `SELECT * FROM pipelines p ${whereClause}
         ORDER BY ${orderCol} ${orderDir}
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      ),
      db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM pipelines p ${whereClause}`,
        params
      ),
    ]);

    return { rows: dataResult, total: parseInt(countResult?.count ?? '0', 10) };
  }

  async update(
    id: string,
    pipeline: PipelineDefinition,
    changeSummary?: string,
    updatedBy?: string
  ): Promise<PipelineRow | null> {
    return db.transaction(async (client) => {
      const row = await client.query<PipelineRow>(
        `UPDATE pipelines SET
           name = $2, version = $3, description = $4,
           technology = $5, spark_version = $6,
           definition = $7, tags = $8,
           updated_by = $9, updated_at = NOW()
         WHERE id = $1 AND is_active = true
         RETURNING *`,
        [
          id,
          pipeline.name,
          pipeline.version,
          pipeline.description ?? null,
          pipeline.environment.technology,
          pipeline.environment.sparkVersion ?? null,
          JSON.stringify(pipeline),
          pipeline.tags ? JSON.stringify(pipeline.tags) : null,
          updatedBy ?? null,
        ]
      );

      if (row.rows[0]) {
        await this.createVersionSnapshot(client, id, pipeline, changeSummary ?? 'Updated', updatedBy);
      }

      return row.rows[0] ?? null;
    });
  }

  async softDelete(id: string, deletedBy?: string): Promise<boolean> {
    const result = await db.query(
      `UPDATE pipelines SET is_active = false, updated_by = $2, updated_at = NOW() WHERE id = $1`,
      [id, deletedBy ?? null]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getVersionHistory(pipelineId: string): Promise<PipelineVersionRow[]> {
    return db.queryMany<PipelineVersionRow>(
      `SELECT * FROM pipeline_versions WHERE pipeline_id = $1 ORDER BY created_at DESC`,
      [pipelineId]
    );
  }

  async getVersion(pipelineId: string, version: string): Promise<PipelineVersionRow | null> {
    return db.queryOne<PipelineVersionRow>(
      `SELECT * FROM pipeline_versions WHERE pipeline_id = $1 AND version = $2`,
      [pipelineId, version]
    );
  }

  private async createVersionSnapshot(
    client: PoolClient,
    pipelineId: string,
    pipeline: PipelineDefinition,
    changeSummary?: string,
    createdBy?: string
  ): Promise<void> {
    await client.query(
      `INSERT INTO pipeline_versions (pipeline_id, version, definition, change_summary, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [pipelineId, pipeline.version, JSON.stringify(pipeline), changeSummary ?? null, createdBy ?? null]
    );
  }

  async countByTechnology(): Promise<Array<{ technology: string; count: number }>> {
    const rows = await db.queryMany<{ technology: string; count: string }>(
      `SELECT technology, COUNT(*) as count FROM pipelines WHERE is_active = true GROUP BY technology ORDER BY count DESC`
    );
    return rows.map(r => ({ technology: r.technology, count: parseInt(r.count, 10) }));
  }
}

export const pipelineRepository = new PipelineRepository();
