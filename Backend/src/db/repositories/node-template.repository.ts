import { db } from '../connection';

export interface NodeTemplateRow {
  id: string;
  name: string;
  category: string | null;
  sub_type: string | null;
  technology: string | null;
  description: string | null;
  config_template: Record<string, unknown>;
  tags: Record<string, string> | null;
  is_public: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNodeTemplateInput {
  name: string;
  category?: string;
  subType?: string;
  technology?: string;
  description?: string;
  configTemplate: Record<string, unknown>;
  tags?: Record<string, string>;
  isPublic?: boolean;
  createdBy?: string;
}

export class NodeTemplateRepository {

  async create(input: CreateNodeTemplateInput): Promise<NodeTemplateRow> {
    const row = await db.queryOne<NodeTemplateRow>(
      `INSERT INTO node_templates
         (name, category, sub_type, technology, description, config_template, tags, is_public, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.name, input.category ?? null, input.subType ?? null,
        input.technology ?? null, input.description ?? null,
        JSON.stringify(input.configTemplate),
        input.tags ? JSON.stringify(input.tags) : null,
        input.isPublic ?? true, input.createdBy ?? null,
      ]
    );
    return row!;
  }

  async findById(id: string): Promise<NodeTemplateRow | null> {
    return db.queryOne<NodeTemplateRow>(`SELECT * FROM node_templates WHERE id = $1`, [id]);
  }

  async findBySubType(subType: string, technology?: string): Promise<NodeTemplateRow[]> {
    if (technology) {
      return db.queryMany<NodeTemplateRow>(
        `SELECT * FROM node_templates WHERE sub_type = $1 AND (technology = $2 OR technology IS NULL) ORDER BY name`,
        [subType, technology]
      );
    }
    return db.queryMany<NodeTemplateRow>(
      `SELECT * FROM node_templates WHERE sub_type = $1 ORDER BY name`,
      [subType]
    );
  }

  async list(filter: { category?: string; technology?: string; search?: string } = {}): Promise<NodeTemplateRow[]> {
    const conditions: string[] = ['is_public = true'];
    const params: unknown[] = [];
    let i = 1;

    if (filter.category) { conditions.push(`category = $${i++}`); params.push(filter.category); }
    if (filter.technology) { conditions.push(`(technology = $${i} OR technology IS NULL)`); params.push(filter.technology); i++; }
    if (filter.search) { conditions.push(`(name ILIKE $${i} OR description ILIKE $${i})`); params.push(`%${filter.search}%`); i++; }

    return db.queryMany<NodeTemplateRow>(
      `SELECT * FROM node_templates WHERE ${conditions.join(' AND ')} ORDER BY category, sub_type, name`,
      params
    );
  }

  async update(id: string, updates: Partial<Omit<CreateNodeTemplateInput, 'createdBy'>>): Promise<NodeTemplateRow | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [id];
    let i = 2;

    if (updates.name !== undefined)           { sets.push(`name = $${i++}`);             params.push(updates.name); }
    if (updates.description !== undefined)    { sets.push(`description = $${i++}`);      params.push(updates.description); }
    if (updates.configTemplate !== undefined) { sets.push(`config_template = $${i++}`);  params.push(JSON.stringify(updates.configTemplate)); }
    if (updates.tags !== undefined)           { sets.push(`tags = $${i++}`);             params.push(JSON.stringify(updates.tags)); }

    return db.queryOne<NodeTemplateRow>(
      `UPDATE node_templates SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
  }

  async delete(id: string): Promise<boolean> {
    const r = await db.query(`DELETE FROM node_templates WHERE id = $1`, [id]);
    return (r.rowCount ?? 0) > 0;
  }

  // Seed built-in templates
  async seedBuiltInTemplates(): Promise<void> {
    const templates: CreateNodeTemplateInput[] = [
      {
        name: 'PostgreSQL Source',
        category: 'source', subType: 'jdbc', technology: 'pyspark',
        description: 'Read from PostgreSQL with parallel partitioning',
        configTemplate: {
          url: 'jdbc:postgresql://HOST:5432/DATABASE',
          driver: 'org.postgresql.Driver',
          table: 'schema.table_name',
          passwordSecret: 'DB_CREDS',
          numPartitions: 10,
          partitionColumn: 'id',
          lowerBound: 1,
          upperBound: 10000000,
          fetchSize: 50000,
        },
      },
      {
        name: 'S3 Parquet Source',
        category: 'source', subType: 'file',
        description: 'Read partitioned Parquet from S3',
        configTemplate: {
          path: 's3a://BUCKET/PREFIX/',
          format: 'parquet',
          mergeSchema: false,
          recursiveFileLookup: true,
        },
      },
      {
        name: 'Delta Lake Source',
        category: 'source', subType: 'delta',
        description: 'Read Delta table (optionally time-travel)',
        configTemplate: {
          path: 's3a://BUCKET/delta/TABLE_NAME',
        },
      },
      {
        name: 'Delta Lake Sink (Overwrite)',
        category: 'sink', subType: 'delta',
        description: 'Write to Delta with optimizeWrite and autoCompact',
        configTemplate: {
          path: 's3a://BUCKET/delta/OUTPUT_TABLE',
          mode: 'overwrite',
          partitionBy: [],
          optimizeWrite: true,
          autoCompact: true,
        },
      },
      {
        name: 'Delta Lake Sink (Merge)',
        category: 'sink', subType: 'delta',
        description: 'Upsert into Delta table using MERGE',
        configTemplate: {
          tableName: 'catalog.schema.table',
          mode: 'merge',
          mergeKey: ['id'],
        },
      },
    ];

    for (const tmpl of templates) {
      const existing = await db.queryOne(
        `SELECT id FROM node_templates WHERE name = $1 AND category = $2`,
        [tmpl.name, tmpl.category ?? null]
      );
      if (!existing) {
        await this.create(tmpl);
      }
    }
  }
}

export const nodeTemplateRepository = new NodeTemplateRepository();
