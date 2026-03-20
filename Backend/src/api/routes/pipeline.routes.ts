import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db/connection';
import { userIdMiddleware } from '../middleware/user-id.middleware';
import { LoggerFactory } from '../../shared/logging';
import { codegenService } from '../../codegen/codegen.service';
import type { GenerationOptions, PipelineDefinition } from '../../codegen/codegen.service';
import { artifactRepository } from '../../db/repositories/artifact.repository';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();
router.use(userIdMiddleware);
const log = LoggerFactory.get('pipelines');

// ─── Execution simulator (no real Spark cluster) ──────────────────────────────
async function simulateExecution(runId: string, userId: string, nodes: any[]): Promise<void> {
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
  const exec = async (sql: string, params: any[]) =>
    db.transaction(async client => { await setSession(client, userId); return client.query(sql, params); });
  try {
    await delay(600);
    await exec(`CALL execution.pr_start_pipeline_run($1::uuid, $2)`, [runId, 'sim-spark-' + runId.slice(0, 8)]);
    await exec(`CALL execution.pr_append_run_log($1::uuid, $2, 'INFO', $3)`, [runId, null, 'Pipeline run started']);
    await delay(700);
    await exec(`CALL execution.pr_append_run_log($1::uuid, $2, 'INFO', $3)`, [runId, null, 'Generating Spark execution plan…']);
    await delay(900);
    await exec(`CALL execution.pr_append_run_log($1::uuid, $2, 'INFO', $3)`, [runId, null, 'Submitting to cluster…']);
    const nodeList: any[] = Array.isArray(nodes) ? nodes : [];
    for (const node of nodeList) {
      await delay(300 + Math.floor(Math.random() * 500));
      const label = node?.data?.label ?? node?.type ?? 'node';
      await exec(`CALL execution.pr_append_run_log($1::uuid, $2, 'INFO', $3)`, [runId, null, `Step: ${label}`]);
    }
    await delay(700);
    await exec(`CALL execution.pr_append_run_log($1::uuid, $2, 'INFO', $3)`, [runId, null, 'All steps completed successfully.']);
    await exec(`CALL execution.pr_finalize_pipeline_run($1::uuid, $2)`, [runId, 'SUCCESS']);
    log.info('pipeline.run', 'Simulated run SUCCESS', { runId });
  } catch (err) {
    log.warn('pipeline.run', 'Simulation error', { runId, error: (err as Error).message });
    try { await exec(`CALL execution.pr_finalize_pipeline_run($1::uuid, $2)`, [runId, 'FAILED']); } catch { /* already terminal */ }
  }
}


function getUserId(res: Response): string {
  return (res.locals['userId'] as string) ?? 'system';
}
async function setSession(client: any, userId: string) {
  const key = process.env['APP_ENCRYPTION_KEY'];
  if (!key) throw new Error('APP_ENCRYPTION_KEY is required');
  await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
  await client.query(`SET LOCAL app.encryption_key = '${key.replace(/'/g, "''")}'`);
}

type PermissionGrantPayload = {
  id: string;
  userId: string;
  roleId: string;
  principal: string;
  principalType: 'user';
  role: string;
  inherited: true;
  expiry: null;
  grantedDtm: string | null;
};

function normalizePermissionGrants(rawGrants: unknown): Array<{ userId: string; roleId: string }> {
  if (!Array.isArray(rawGrants)) return [];
  const normalized = new Map<string, { userId: string; roleId: string }>();
  for (const grant of rawGrants) {
    const userId = typeof (grant as { userId?: unknown }).userId === 'string'
      ? (grant as { userId: string }).userId.trim()
      : '';
    const roleId = typeof (grant as { roleId?: unknown }).roleId === 'string'
      ? (grant as { roleId: string }).roleId.trim()
      : '';
    if (!userId || !roleId) continue;
    normalized.set(`${userId}:${roleId}`, { userId, roleId });
  }
  return Array.from(normalized.values());
}

function mapPermissionGrantRows(rows: any[]): PermissionGrantPayload[] {
  return rows.map((row: any) => ({
    id: `${row.user_id}:${row.role_id}`,
    userId: String(row.user_id),
    roleId: String(row.role_id),
    principal: String(row.user_full_name ?? row.email_address ?? row.user_id),
    principalType: 'user',
    role: String(row.role_display_name ?? 'Viewer'),
    inherited: true,
    expiry: null,
    grantedDtm: row.granted_dtm ?? null,
  }));
}

type CodegenTechnology = 'pyspark' | 'scala-spark' | 'sql';

function normalizeTechnology(raw: unknown): CodegenTechnology {
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (normalized === 'scala-spark' || normalized === 'scala') return 'scala-spark';
  if (normalized === 'sql' || normalized === 'spark-sql' || normalized === 'sparksql') return 'sql';
  return 'pyspark';
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// ─── Extract connection IDs from IR payload ───────────────────────────────────

function extractConnectionIds(irPayload: unknown): string[] {
  const nodes = ensureArray<Record<string, unknown>>(
    (irPayload as { nodes?: unknown[] } | null)?.nodes,
  );
  const ids = new Set<string>();
  for (const node of nodes) {
    const cfg = (node['config'] ?? {}) as Record<string, unknown>;
    if (cfg['connectionId'] && typeof cfg['connectionId'] === 'string') {
      ids.add(cfg['connectionId']);
    }
  }
  return [...ids];
}

// ─── Connection URL resolution helpers ───────────────────────────────────────

interface ConnInfo {
  url: string;
  driverClass: string;
  displayName: string;
  typeCode: string;       // e.g. JDBC_POSTGRESQL, FILE_CSV, AWS_S3, etc.
  configJson: Record<string, unknown>;
}

const JDBC_URL_TEMPLATES: Record<string, string> = {
  JDBC_POSTGRESQL:  'jdbc:postgresql://{host}:{port}/{database}',
  JDBC_MYSQL:       'jdbc:mysql://{host}:{port}/{database}',
  JDBC_SQLSERVER:   'jdbc:sqlserver://{host}:{port};databaseName={database}',
  JDBC_ORACLE:      'jdbc:oracle:thin:@//{host}:{port}/{service_name}',
  JDBC_REDSHIFT:    'jdbc:redshift://{host}:{port}/{database}',
  JDBC_SNOWFLAKE:   'jdbc:snowflake://{host}/?db={database}',
  JDBC_DB2:         'jdbc:db2://{host}:{port}/{database}',
  JDBC_HIVE2:       'jdbc:hive2://{host}:{port}/{database}',
};

const JDBC_DRIVER_MAP: Record<string, string> = {
  JDBC_POSTGRESQL:  'org.postgresql.Driver',
  JDBC_MYSQL:       'com.mysql.cj.jdbc.Driver',
  JDBC_SQLSERVER:   'com.microsoft.sqlserver.jdbc.SQLServerDriver',
  JDBC_ORACLE:      'oracle.jdbc.OracleDriver',
  JDBC_REDSHIFT:    'com.amazon.redshift.jdbc42.Driver',
  JDBC_SNOWFLAKE:   'net.snowflake.client.jdbc.SnowflakeDriver',
  JDBC_DB2:         'com.ibm.db2.jcc.DB2Driver',
  JDBC_HIVE2:       'org.apache.hive.jdbc.HiveDriver',
};

/** Map FILE_* connector type codes to file format strings */
function fileFormatFromTypeCode(typeCode: string): string | null {
  if (typeCode.includes('CSV'))     return 'csv';
  if (typeCode.includes('PARQUET')) return 'parquet';
  if (typeCode.includes('JSON'))    return 'json';
  if (typeCode.includes('ORC'))     return 'orc';
  if (typeCode.includes('AVRO'))    return 'avro';
  if (typeCode.includes('DELTA'))   return 'delta';
  if (typeCode.includes('TEXT'))    return 'text';
  return null;
}

/** Returns true for connector types that are file/object-store based (not JDBC databases) */
function isFileConnector(typeCode: string): boolean {
  return typeCode.startsWith('FILE_') || typeCode.startsWith('AWS_S3') ||
    typeCode.startsWith('GCS_') || typeCode.startsWith('ADLS_') ||
    typeCode.startsWith('HDFS_') || typeCode.startsWith('SFTP_');
}

function buildJdbcUrlFromConfig(typeCode: string, cfg: Record<string, unknown>): string {
  const template = JDBC_URL_TEMPLATES[typeCode.toUpperCase()];
  if (!template) return '';
  return template
    .replace('{host}',         String(cfg['jdbc_host']     ?? 'localhost'))
    .replace('{port}',         String(cfg['jdbc_port']     ?? 5432))
    .replace('{database}',     String(cfg['jdbc_database'] ?? ''))
    .replace('{service_name}', String(cfg['jdbc_database'] ?? ''));
}

async function resolveConnections(
  client: any,
  connectionIds: string[],
): Promise<Map<string, ConnInfo>> {
  const map = new Map<string, ConnInfo>();
  if (!connectionIds.length) return map;
  try {
    const r = await client.query(
      `SELECT
         connector_id::text,
         connector_display_name,
         connector_type_code,
         conn_jdbc_driver_class,
         pgp_sym_decrypt(conn_config_json_encrypted::bytea,
           current_setting('app.encryption_key'))::jsonb AS cfg
       FROM catalog.connectors
       WHERE connector_id = ANY($1::uuid[])`,
      [connectionIds],
    );
    for (const row of r.rows) {
      const cfg = (row.cfg ?? {}) as Record<string, unknown>;
      const typeCode = String(row.connector_type_code ?? '').toUpperCase();
      const url = buildJdbcUrlFromConfig(typeCode, cfg);
      const driverClass = row.conn_jdbc_driver_class as string
        ?? JDBC_DRIVER_MAP[typeCode]
        ?? 'UNKNOWN_DRIVER';
      map.set(row.connector_id as string, {
        url,
        driverClass,
        displayName: row.connector_display_name as string ?? row.connector_id,
        typeCode,
        configJson: cfg,
      });
    }
  } catch {
    // Non-fatal — callers fall back to placeholder URL
  }
  return map;
}

function toPipelineDefinition(
  source: {
    pipeline_id: string;
    pipeline_display_name: string;
    pipeline_desc_text: string | null;
    version_num_seq: number | null;
    ir_payload_json: unknown;
  },
  technology: CodegenTechnology,
  connectionMap: Map<string, ConnInfo> = new Map(),
): PipelineDefinition {
  const payload = (source.ir_payload_json ?? {}) as { nodes?: unknown[]; edges?: unknown[] };
  const irNodes = ensureArray<Record<string, unknown>>(payload.nodes);
  const irEdges = ensureArray<Record<string, unknown>>(payload.edges);

  const inputsByTarget = new Map<string, string[]>();
  for (const edge of irEdges) {
    const sourceId = typeof edge['source'] === 'string' ? edge['source'] : '';
    const targetId = typeof edge['target'] === 'string' ? edge['target'] : '';
    if (!sourceId || !targetId) continue;
    const existing = inputsByTarget.get(targetId) ?? [];
    existing.push(sourceId);
    inputsByTarget.set(targetId, existing);
  }

  const mappedNodes = irNodes.map((node): PipelineDefinition['nodes'][number] => {
    const nodeId = typeof node['id'] === 'string' ? node['id'] : '';
    const rawType = typeof node['type'] === 'string' ? node['type'] : 'custom_sql';
    const cfg = (node['config'] ?? {}) as Record<string, unknown>;
    const inputs = inputsByTarget.get(nodeId) ?? [];
    const nodeName = typeof node['name'] === 'string'
      ? node['name']
      : typeof (node['data'] as Record<string, unknown> | undefined)?.['label'] === 'string'
      ? String((node['data'] as Record<string, unknown>)['label'])
      : nodeId;

    if (rawType === 'source') {
      // Resolve connection info first so we can auto-detect type from connector
      const connId = typeof cfg['connectionId'] === 'string' ? cfg['connectionId'] : '';
      const connInfo = connId ? connectionMap.get(connId) : undefined;

      const srcType = (typeof cfg['sourceType'] === 'string'
        ? cfg['sourceType']
        : connInfo && isFileConnector(connInfo.typeCode)  ? 'file'
        : cfg['filePath']                                  ? 'file'
        : cfg['bootstrapServers']                          ? 'kafka'
        : 'jdbc') as any;
      const resolvedCfg: Record<string, unknown> = { ...cfg };

      if (srcType === 'file') {
        // Remove JDBC-specific fields that would confuse the file source generator
        // (schema/table/readMode are JDBC concepts; schema string ≠ Spark StructType schema object)
        delete resolvedCfg['schema'];
        delete resolvedCfg['table'];
        delete resolvedCfg['tableName'];
        delete resolvedCfg['readMode'];
        delete resolvedCfg['url'];
        delete resolvedCfg['driver'];

        // File source: derive path from filePath field, or from connInfo config, or use node name as hint
        if (!resolvedCfg['path']) {
          resolvedCfg['path'] = resolvedCfg['filePath']
            ?? connInfo?.configJson?.['file_path']
            ?? connInfo?.configJson?.['directory']
            ?? connInfo?.configJson?.['base_path']
            // Last resort: if node name looks like a file path, use it
            ?? (nodeName.includes('/') || nodeName.includes('\\') ? nodeName : '<not_configured>');
        }
        // Derive format from fileFormat field, or from connector type code
        if (!resolvedCfg['format']) {
          resolvedCfg['format'] = resolvedCfg['fileFormat']
            ?? (connInfo ? fileFormatFromTypeCode(connInfo.typeCode) : null)
            ?? 'parquet';
        }
        // Coerce string booleans from NodeConfigPanel
        if (resolvedCfg['header'] !== undefined) resolvedCfg['header'] = resolvedCfg['header'] !== 'false';
        if (resolvedCfg['inferSchema'] !== undefined) resolvedCfg['inferSchema'] = resolvedCfg['inferSchema'] !== 'false';
        if (resolvedCfg['recursiveFileLookup'] !== undefined) resolvedCfg['recursiveFileLookup'] = resolvedCfg['recursiveFileLookup'] === 'true';
      } else if (srcType === 'kafka') {
        // Kafka: no extra derivation needed — bootstrapServers/topic come directly from config
      } else {
        // JDBC (default): resolve URL from connection map, then derive table
        // connId and connInfo already resolved above
        if (!resolvedCfg['url']) {
          if (connInfo?.url) {
            resolvedCfg['url'] = connInfo.url;
          } else if (connId) {
            // Use env var pattern so generated code is runnable once env is set
            resolvedCfg['url'] = `\${JDBC_URL}`;  // runtime placeholder
          } else {
            resolvedCfg['url'] = 'jdbc:<not_configured>';
          }
        }
        if (!resolvedCfg['driver'] && connInfo?.driverClass) {
          resolvedCfg['driver'] = connInfo.driverClass;
        }
        if (!resolvedCfg['table']) {
          const schema = resolvedCfg['schema'] ?? resolvedCfg['schemaName'];
          const tbl    = resolvedCfg['tableName'] ?? resolvedCfg['table'];
          resolvedCfg['table'] = schema && tbl ? `${schema}.${tbl}` : tbl ? String(tbl) : '<not_configured>';
        }
      }
      return { id: nodeId, name: nodeName, type: 'source', sourceType: srcType, config: resolvedCfg as any, inputs: [] };
    }

    if (rawType === 'target') {
      // Detect sink type: explicit > file heuristic > delta heuristic > iceberg heuristic > jdbc default
      const sinkType = (typeof cfg['sinkType'] === 'string'
        ? cfg['sinkType']
        : cfg['targetPath'] || cfg['outputPath']                       ? 'file'
        : cfg['deltaPath']  || cfg['deltaTable']                       ? 'delta'
        : cfg['catalogTable']                                           ? 'iceberg'
        : 'jdbc') as any;

      const resolvedCfg: Record<string, unknown> = { ...cfg };

      // Normalise write mode: canvas stores APPEND/OVERWRITE/SCD1/etc — codegen expects lowercase
      if (!resolvedCfg['mode']) {
        const wm = String(resolvedCfg['writeMode'] ?? 'APPEND').toUpperCase();
        switch (wm) {
          case 'OVERWRITE': resolvedCfg['mode'] = 'overwrite'; break;
          case 'MERGE':     resolvedCfg['mode'] = 'overwrite'; break; // Delta MERGE handled by generator
          default:          resolvedCfg['mode'] = 'append';
        }
      }

      if (sinkType === 'file') {
        if (!resolvedCfg['path'])   resolvedCfg['path']   = resolvedCfg['targetPath'] ?? resolvedCfg['outputPath'] ?? '<not_configured>';
        if (!resolvedCfg['format']) resolvedCfg['format'] = resolvedCfg['fileFormat'] ?? 'parquet';
      } else if (sinkType === 'delta') {
        if (!resolvedCfg['path'] && !resolvedCfg['tableName']) {
          resolvedCfg['path']      = resolvedCfg['deltaPath'] ?? resolvedCfg['targetPath'];
          resolvedCfg['tableName'] = resolvedCfg['deltaTable'];
        }
      } else if (sinkType === 'iceberg') {
        if (!resolvedCfg['tableName']) resolvedCfg['tableName'] = resolvedCfg['catalogTable'] ?? '<not_configured>';
      } else {
        // JDBC sink — resolve URL from connection map
        const connId = String(resolvedCfg['connectionId'] ?? '');
        const connInfo = connId ? connectionMap.get(connId) : undefined;
        if (!resolvedCfg['url']) {
          if (connInfo?.url) {
            resolvedCfg['url'] = connInfo.url;
          } else if (connId) {
            resolvedCfg['url'] = `\${JDBC_URL}`;
          } else {
            resolvedCfg['url'] = 'jdbc:<not_configured>';
          }
        }
        if (!resolvedCfg['driver']) {
          resolvedCfg['driver'] = connInfo?.driverClass ?? 'UNKNOWN_DRIVER';
        }
        if (!resolvedCfg['table']) {
          const schema = resolvedCfg['schema'] ?? resolvedCfg['schemaName'];
          const tbl    = resolvedCfg['tableName'] ?? resolvedCfg['table'];
          resolvedCfg['table'] = schema && tbl ? `${schema}.${tbl}` : tbl ? String(tbl) : '<not_configured>';
        }
      }
      return { id: nodeId, name: nodeName, type: 'sink', sinkType, config: resolvedCfg as any, inputs };
    }

    if (rawType === 'join') {
      return {
        id: nodeId,
        name: nodeName,
        type: 'transformation',
        transformationType: 'join',
        config: {
          rightInput: (typeof cfg['rightInput'] === 'string' ? cfg['rightInput'] : inputs[1] ?? ''),
          type: (typeof cfg['joinType'] === 'string' ? cfg['joinType'] : 'inner'),
          conditions: ensureArray(cfg['joinConditions']),
        } as any,
        inputs,
      };
    }

    if (rawType === 'aggregate' || rawType === 'aggregation') {
      return {
        id: nodeId,
        name: nodeName,
        type: 'transformation',
        transformationType: 'aggregate',
        config: {
          groupBy: ensureArray(cfg['groupBy']),
          aggregations: ensureArray(cfg['aggregations']),
        } as any,
        inputs,
      };
    }

    if (rawType === 'filter') {
      return {
        id: nodeId,
        name: nodeName,
        type: 'transformation',
        transformationType: 'filter',
        config: { condition: typeof cfg['expression'] === 'string' ? cfg['expression'] : 'true' } as any,
        inputs,
      };
    }

    if (rawType === 'union') {
      return {
        id: nodeId,
        name: nodeName,
        type: 'transformation',
        transformationType: 'union',
        config: {
          byName: cfg['byName'] === true,
          allowMissingColumns: cfg['allowMissingColumns'] === true,
        } as any,
        inputs,
      };
    }

    const hasSequence = Array.isArray(cfg['transformSequences']) && cfg['transformSequences'].length > 0;
    if (rawType === 'transform' && hasSequence) {
      return {
        id: nodeId,
        name: nodeName,
        type: 'transformation',
        transformationType: 'multi_transform_sequence',
        config: {
          transformSequences: cfg['transformSequences'],
          executionStrategy: cfg['executionStrategy'],
          cacheResults: cfg['cacheResults'] === true,
        } as any,
        inputs,
      };
    }

    return {
      id: nodeId,
      name: nodeName,
      type: 'transformation',
      transformationType: 'custom_sql',
      config: { sql: typeof cfg['sql'] === 'string' ? cfg['sql'] : `-- ${nodeName}` } as any,
      inputs,
    };
  });

  return {
    id: source.pipeline_id,
    name: source.pipeline_display_name,
    version: String(source.version_num_seq ?? 1),
    description: source.pipeline_desc_text ?? undefined,
    environment: {
      technology,
      sparkVersion: '3.5',
    } as any,
    sparkConfig: {
      appName: source.pipeline_display_name,
    },
    nodes: mappedNodes,
  };
}

async function resolveEnvironmentId(client: any, environment?: string): Promise<string | null> {
  const envName = environment?.trim();
  if (!envName) return null;
  const r = await client.query(
    `SELECT execution.fn_get_environment_id_by_name($1) AS env_id`,
    [envName],
  );
  return (r.rows[0]?.env_id as string | undefined) ?? null;
}

// ─── Global pipelines (project_id IS NULL) — must come before /:id ──────────

router.get('/global', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const limit  = Math.min(parseInt(String(req.query['limit'] ?? '50'), 10), 200);
    const afterId = req.query['after'] as string | undefined;
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           pipeline_id,
           project_id,
           folder_id,
           pipeline_display_name,
           pipeline_desc_text,
           active_version_id,
           created_dtm,
           updated_dtm
         FROM catalog.fn_list_pipelines(null::uuid, null, $1, 0, 'pipeline_display_name', 'ASC')
         WHERE project_id IS NULL AND folder_id IS NULL
           AND ($2::uuid IS NULL OR pipeline_id > $2::uuid)`,
        [limit + 1, afterId ?? null],
      );
      return r.rows;
    });
    const hasMore = rows.length > limit;
    const page    = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor: string | null = hasMore ? page[page.length - 1].pipeline_id : null;
    res.json({ success: true, data: page, nextCursor });
  } catch (err) { next(err); }
});

// ─── Pipeline CRUD ────────────────────────────────────────────────────────────
// Create pipeline — folderId and projectId optional; both NULL = global
router.post('/', requirePermission('PIPELINE_CREATE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { projectId, pipelineDisplayName, pipelineDescText, folderId } = req.body ?? {};
    if (!pipelineDisplayName?.trim()) {
      return res.status(400).json({ success: false, userMessage: 'pipelineDisplayName is required' });
    }

    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `CALL catalog.pr_create_pipeline($1::uuid, $2::uuid, $3, $4, $5::uuid, null)`,
        [projectId ?? null, folderId ?? null, pipelineDisplayName.trim(), pipelineDescText ?? null, userId]
      );
      const newId = r.rows[0].p_pipeline_id;
      const getR = await client.query(
        `SELECT
           pipeline_id,
           project_id,
           folder_id,
           pipeline_display_name,
           pipeline_desc_text,
           active_version_id,
           created_dtm,
           updated_dtm
         FROM catalog.fn_get_pipeline_by_id($1::uuid)`,
        [newId],
      );
      return getR.rows[0];
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) { log.warn('pipeline.create', 'Pipeline creation failed', { error: (err as Error).message }); return next(err); }
});
router.get('/', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const limit = Math.min(Math.max(parseInt(String(req.query['limit'] ?? '200'), 10) || 200, 1), 5000);
    const offset = Math.max(parseInt(String(req.query['offset'] ?? '0'), 10) || 0, 0);
    const search = typeof req.query['search'] === 'string' ? req.query['search'] : null;
    const projectId = typeof req.query['projectId'] === 'string' ? req.query['projectId'] : null;
    const allowedOrderBy = new Set(['pipeline_display_name', 'created_dtm', 'updated_dtm']);
    const requestedOrderBy = typeof req.query['orderBy'] === 'string' ? req.query['orderBy'] : 'updated_dtm';
    const orderBy = allowedOrderBy.has(requestedOrderBy) ? requestedOrderBy : 'updated_dtm';
    const orderDir = String(req.query['orderDir'] ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           pipeline_id,
           project_id,
           folder_id,
           pipeline_display_name,
           pipeline_desc_text,
           active_version_id,
           created_dtm,
           updated_dtm
         FROM catalog.fn_list_pipelines($1::uuid, $2, $3, $4, $5, $6)`,
        [projectId, search, limit, offset, orderBy, orderDir],
      );
      return r.rows;
    });

    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           pipeline_id,
           project_id,
           folder_id,
           pipeline_display_name,
           pipeline_desc_text,
           active_version_id,
           created_dtm,
           updated_dtm,
           ir_payload_json,
           ui_layout_json
         FROM catalog.fn_get_pipeline_by_id($1::uuid)`,
        [req.params['id']],
      );
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

router.put('/:id', requirePermission('PIPELINE_EDIT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const body   = req.body ?? {};
    const id     = req.params['id']!;
    const hasVersionPayload =
      body.nodes !== undefined || body.edges !== undefined || body.uiLayout !== undefined;
    const hasMetadataPayload =
      body.pipelineDisplayName !== undefined || body.pipelineDescText !== undefined;

    if (!hasVersionPayload && !hasMetadataPayload) {
      return res.status(400).json({
        success: false,
        userMessage: 'No supported fields provided. Send metadata fields and/or version payload (nodes/edges/uiLayout).',
      });
    }

    await db.transaction(async client => {
      await setSession(client, userId);
      if (hasMetadataPayload) {
        await client.query(
          `CALL catalog.pr_update_pipeline_metadata($1::uuid, $2, $3, $4::uuid)`,
          [id, body.pipelineDisplayName ?? null, body.pipelineDescText ?? null, userId],
        );
      }

      if (hasVersionPayload) {
        const commitMsg = body.changeSummary ?? 'Auto-save';
        const payload = JSON.stringify({ nodes: body.nodes ?? [], edges: body.edges ?? [] });
        const layout = body.uiLayout ? JSON.stringify(body.uiLayout) : null;

        const vResult = await client.query(
          `CALL catalog.pr_commit_pipeline_version($1, $2, $3::jsonb, $4::jsonb, $5::uuid, null)`,
          [id, commitMsg, payload, layout, userId],
        );
        const versionId = vResult.rows[0].p_version_id;

        const datasetMap = (body.nodes ?? [])
          .filter((n: any) => (n.type === 'source' || n.type === 'target') && n.config?.datasetId)
          .map((n: any) => ({
            dataset_id: n.config.datasetId,
            access_mode_code: n.type === 'source' ? 'READ' : 'WRITE',
            node_id_text: n.id
          }));

        await client.query(
          `CALL catalog.pr_sync_pipeline_dataset_map($1::uuid, $2::uuid, $3::jsonb)`,
          [id, versionId, JSON.stringify(datasetMap)]
        );
      }
    });
    log.info('pipeline.save', hasVersionPayload ? 'Pipeline version committed' : 'Pipeline metadata updated', { pipelineId: id, userId });
    return res.json({ success: true, data: { metadataUpdated: hasMetadataPayload, versionCommitted: hasVersionPayload } });
  } catch (err: any) {
    if (err?.code === 'P0002') return res.status(404).json({ success: false, userMessage: 'Pipeline not found' });
    log.warn('pipeline.save', 'Pipeline save failed', { pipelineId: req.params['id'], error: (err as Error).message });
    return next(err);
  }
});

router.delete('/:id', requirePermission('PIPELINE_DELETE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    await db.transaction(async client => {
      await setSession(client, userId);
      const check = await client.query(`SELECT 1 FROM catalog.fn_get_pipeline_runtime_info($1::uuid)`, [req.params['id']]);
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

router.post('/:id/validate', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const source = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           pipeline_id,
           pipeline_display_name,
           pipeline_desc_text,
           version_id,
           version_num_seq,
           release_tag_label,
           ir_payload_json,
           ui_layout_json
         FROM catalog.fn_get_pipeline_codegen_source($1::uuid)`,
        [req.params['id']],
      );
      return r.rows[0] ?? null;
    });
    if (!source) return res.status(404).json({ success: false, userMessage: 'Pipeline not found' });
    if (!source.version_id || !source.ir_payload_json) {
      return res.status(409).json({ success: false, userMessage: 'Pipeline has no active version to validate' });
    }

    const technology = normalizeTechnology((req.body ?? {}).technology ?? (req.body ?? {}).options?.technology);
    const connectionIds = extractConnectionIds(source.ir_payload_json);
    const connectionMap = connectionIds.length > 0
      ? await db.transaction(async client => { await setSession(client, userId); return resolveConnections(client, connectionIds); })
      : new Map<string, ConnInfo>();
    const definition = toPipelineDefinition(source, technology, connectionMap);
    const validation = codegenService.validate(definition);

    await db.transaction(async client => {
      await setSession(client, userId);
      await client.query(
        `CALL catalog.pr_log_pipeline_validation($1::uuid, $2, $3::jsonb, $4::uuid)`,
        [req.params['id'], validation.valid, JSON.stringify(validation.errors ?? []), userId],
      );
    });

    return res.json({ success: true, valid: validation.valid, errors: validation.errors, warnings: validation.warnings });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/generate', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const source = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           pipeline_id,
           pipeline_display_name,
           pipeline_desc_text,
           version_id,
           version_num_seq,
           release_tag_label,
           ir_payload_json,
           ui_layout_json
         FROM catalog.fn_get_pipeline_codegen_source($1::uuid)`,
        [req.params['id']],
      );
      return r.rows[0] ?? null;
    });

    if (!source) return res.status(404).json({ success: false, userMessage: 'Pipeline not found' });
    if (!source.version_id || !source.ir_payload_json) {
      return res.status(409).json({ success: false, userMessage: 'Pipeline has no active version to generate from' });
    }

    const options = ((req.body ?? {}).options ?? {}) as GenerationOptions;
    const requestedTech = normalizeTechnology(options.technology ?? (req.body ?? {}).technology);
    // SQL engine not yet implemented — fall back to PySpark
    const technology: CodegenTechnology = requestedTech === 'sql' ? 'pyspark' : requestedTech;
    const connectionIds = extractConnectionIds(source.ir_payload_json);
    const connectionMap = connectionIds.length > 0
      ? await db.transaction(async client => { await setSession(client, userId); return resolveConnections(client, connectionIds); })
      : new Map<string, ConnInfo>();
    const definition = toPipelineDefinition(source, technology, connectionMap);
    const validation = codegenService.validate(definition);
    if (!validation.valid) {
      return res.status(422).json({ success: false, userMessage: 'Pipeline validation failed', errors: validation.errors, warnings: validation.warnings });
    }

    const artifact = await codegenService.generate(definition, options);
    const savedArtifact = await artifactRepository.save(artifact, options, userId);
    await artifactRepository.deleteOldArtifacts(req.params['id']!, 10);

    return res.json({ success: true, artifactId: savedArtifact.id, artifact });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/artifacts', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query['limit'] ?? '10'), 10) || 10, 1), 100);
    const artifacts = await artifactRepository.findAllForPipeline(req.params['id']!, limit);
    return res.json({ success: true, artifacts });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/artifacts/:artifactId', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const artifact = await artifactRepository.findById(req.params['artifactId']!);
    if (!artifact || artifact.pipeline_id !== req.params['id']) {
      return res.status(404).json({ success: false, userMessage: 'Artifact not found' });
    }
    return res.json({ success: true, artifact });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/artifacts/:artifactId/download', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const artifact = await artifactRepository.findById(req.params['artifactId']!);
    if (!artifact || artifact.pipeline_id !== req.params['id']) {
      return res.status(404).json({ success: false, userMessage: 'Artifact not found' });
    }

    const fileIndex = parseInt(String(req.query['fileIndex'] ?? '0'), 10);
    const files = artifact.files ?? [];
    if (!Array.isArray(files) || fileIndex < 0 || fileIndex >= files.length) {
      return res.status(404).json({ success: false, userMessage: 'Artifact file not found' });
    }

    const file = files[fileIndex] as { fileName?: string; language?: string; content?: string };
    const contentType = file.language === 'python'
      ? 'text/x-python'
      : file.language === 'scala'
      ? 'text/x-scala'
      : 'text/plain';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName ?? 'artifact.txt'}"`);
    return res.send(file.content ?? '');
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/history', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT version_id, version_num_seq, release_tag_label, created_dtm
         FROM catalog.fn_get_pipeline_versions($1::uuid)`,
        [req.params['id']],
      );
      return r.rows;
    });
    return res.json({
      success: true,
      versions: rows.map((row: any) => ({
        versionId: row.version_id,
        versionNum: row.version_num_seq,
        releaseTag: row.release_tag_label,
        createdDtm: row.created_dtm,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/executions', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const limit = Math.min(Math.max(parseInt(String(req.query['limit'] ?? '20'), 10) || 20, 1), 200);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           pipeline_run_id,
           run_status_code,
           trigger_type_code,
           start_dtm,
           end_dtm,
           created_dtm
         FROM execution.fn_get_pipeline_run_history($1::uuid, $2)`,
        [req.params['id'], limit],
      );
      return r.rows;
    });
    return res.json({ success: true, executions: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/run', requirePermission('PIPELINE_RUN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { environment, technology } = (req.body ?? {}) as { environment?: string; technology?: string };
    const row = await db.transaction(async client => {
      await setSession(client, userId);
      const pRow = await client.query(
        `SELECT pipeline_id, active_version_id
         FROM catalog.fn_get_pipeline_runtime_info($1::uuid)`,
        [req.params['id']],
      );
      if (!pRow.rows[0]) throw Object.assign(new Error('Pipeline not found'), { status: 404 });
      if (!pRow.rows[0].active_version_id) {
        throw Object.assign(new Error('Pipeline has no active version'), { status: 409 });
      }
      const envId = await resolveEnvironmentId(client, environment);
      const r = await client.query(
        `CALL execution.pr_initialize_pipeline_run($1::uuid, $2::uuid, $3::uuid, $4::uuid, null, $5)`,
        [pRow.rows[0].pipeline_id, pRow.rows[0].active_version_id, envId, userId, 'MANUAL'],
      );
      const pipelineRunId = r.rows[0].p_pipeline_run_id as string;

      await client.query(
        `CALL execution.pr_set_pipeline_run_options($1::uuid, $2::jsonb)`,
        [
          pipelineRunId,
          JSON.stringify({
            environment: environment?.trim() || null,
            technology: technology?.trim() || null,
            requestedBy: userId,
          }),
        ],
      );

      return { pipeline_run_id: pipelineRunId, environmentApplied: Boolean(envId) };
    });
    log.info('pipeline.run', 'Pipeline run triggered', {
      pipelineId: req.params['id'],
      runId: row.pipeline_run_id,
      userId,
      environment: environment ?? null,
      technology: technology ?? null,
      environmentApplied: row.environmentApplied,
    });
    // Fire-and-forget simulation (no real Spark cluster)
    const pipelineNodes = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT ir_payload_json FROM catalog.fn_get_pipeline_by_id($1::uuid)`,
        [req.params['id']],
      );
      return (r.rows[0]?.ir_payload_json as any)?.nodes ?? [];
    }).catch(() => []);
    simulateExecution(row.pipeline_run_id, userId, pipelineNodes).catch(() => {});
    return res.status(202).json({
      success: true,
      data: {
        pipelineRunId: row.pipeline_run_id,
        environment: environment ?? null,
        technology: technology ?? null,
        environmentApplied: row.environmentApplied,
      },
    });
  } catch (err: any) {
    if (err.status === 404) return res.status(404).json({ success: false, userMessage: 'Pipeline not found' });
    if (err.status === 409) return res.status(409).json({ success: false, userMessage: 'Pipeline has no active version to run' });
    log.warn('pipeline.run', 'Run trigger failed', { pipelineId: req.params['id'], error: (err as Error).message });
    return next(err);
  }
});

router.get('/:id/lineage', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const [pipelineRow, edgeRows] = await db.transaction(async client => {
      await setSession(client, userId);
      const [p, e] = await Promise.all([
        client.query(
          `SELECT pipeline_id, pipeline_display_name
           FROM catalog.fn_get_pipeline_by_id($1::uuid)`,
          [req.params['id']],
        ),
        client.query(
          `SELECT
             from_pipeline_id,
             from_pipeline_display_name,
             to_pipeline_id,
             to_pipeline_display_name
           FROM catalog.fn_get_pipeline_lineage_edges($1::uuid)`,
          [req.params['id']],
        ),
      ]);
      return [p.rows[0] ?? null, e.rows] as const;
    });

    if (!pipelineRow) {
      return res.status(404).json({ success: false, userMessage: 'Pipeline not found' });
    }

    const nodesMap = new Map<string, { id: string; label: string; kind: 'pipeline'; isCurrent: boolean }>();
    nodesMap.set(String(pipelineRow.pipeline_id), {
      id: String(pipelineRow.pipeline_id),
      label: String(pipelineRow.pipeline_display_name ?? 'This Pipeline'),
      kind: 'pipeline',
      isCurrent: true,
    });

    const edges = edgeRows.map((row: any) => {
      const fromId = String(row.from_pipeline_id);
      const toId = String(row.to_pipeline_id);
      if (!nodesMap.has(fromId)) {
        nodesMap.set(fromId, {
          id: fromId,
          label: String(row.from_pipeline_display_name ?? fromId),
          kind: 'pipeline',
          isCurrent: fromId === req.params['id'],
        });
      }
      if (!nodesMap.has(toId)) {
        nodesMap.set(toId, {
          id: toId,
          label: String(row.to_pipeline_display_name ?? toId),
          kind: 'pipeline',
          isCurrent: toId === req.params['id'],
        });
      }
      return { source: fromId, target: toId };
    });

    return res.json({ success: true, data: { nodes: Array.from(nodesMap.values()), edges } });
  } catch (err) { return next(err); }
});

router.get('/:id/parameters', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
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

router.put('/:id/parameters', requirePermission('PIPELINE_EDIT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const { parameters } = req.body;
    if (!Array.isArray(parameters)) throw new Error('Parameters must be an array');
    
    await db.transaction(async client => {
      await setSession(client, userId);
      // Delete existing parameters first to align with full replacement strategy
      await client.query(`CALL catalog.pr_clear_pipeline_parameters($1::uuid)`, [req.params.id]);
      
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

// ─── Pipeline Alerts (Notification Rules) ─────────────────────────────────────

router.get('/:id/alerts', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT
           notification_rule_id,
           event_type_code,
           channel_type_code,
           channel_target_text,
           is_rule_active_flag,
           created_dtm
         FROM gov.fn_get_notification_rules_for_entity('PIPELINE', $1::uuid)`,
        [req.params['id']],
      );
      return r.rows;
    });

    const mapped = rows.map((row: any) => ({
      id: String(row.notification_rule_id),
      eventTypeCode: String(row.event_type_code),
      channelTypeCode: String(row.channel_type_code),
      channelTargetText: String(row.channel_target_text),
      enabled: row.is_rule_active_flag === true,
      createdDtm: row.created_dtm ?? null,
    }));

    return res.json({ success: true, data: mapped });
  } catch (err) { return next(err); }
});

router.put('/:id/alerts', requirePermission('PIPELINE_EDIT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const body = (req.body ?? {}) as { rules?: unknown[] };
    const rules = Array.isArray(body.rules) ? body.rules : [];

    await db.transaction(async client => {
      await setSession(client, userId);

      const current = await client.query(
        `SELECT notification_rule_id
         FROM gov.fn_get_notification_rules_for_entity('PIPELINE', $1::uuid)`,
        [req.params['id']],
      );
      const currentIds = new Set<string>(current.rows.map((r: any) => String(r.notification_rule_id)));
      const desiredIds = new Set<string>();

      for (const raw of rules) {
        const r = raw as any;
        const id = typeof r.id === 'string' ? r.id.trim() : '';
        const eventTypeCode = typeof r.eventTypeCode === 'string' ? r.eventTypeCode.trim().toUpperCase() : '';
        const channelTypeCode = typeof r.channelTypeCode === 'string' ? r.channelTypeCode.trim().toUpperCase() : '';
        const channelTargetText = typeof r.channelTargetText === 'string' ? r.channelTargetText.trim() : '';
        const enabled = r.enabled === true;

        if (!eventTypeCode || !channelTypeCode || !channelTargetText) continue;

        if (id && currentIds.has(id)) {
          desiredIds.add(id);
          await client.query(
            `CALL gov.pr_set_notification_rule_active($1::uuid, $2)`,
            [id, enabled],
          );
          continue;
        }

        const created = await client.query(
          `CALL gov.pr_create_notification_rule('PIPELINE', $1::uuid, $2, $3, $4, $5::uuid, null)`,
          [req.params['id'], eventTypeCode, channelTypeCode, channelTargetText, userId],
        );
        const newId = created.rows[0]?.p_notification_rule_id;
        if (newId) desiredIds.add(String(newId));
      }

      for (const id of currentIds) {
        if (!desiredIds.has(id)) {
          await client.query(`CALL gov.pr_delete_notification_rule($1::uuid)`, [id]);
        }
      }
    });

    log.info('pipelines.alertsSave', 'Pipeline alert rules saved', { pipelineId: req.params['id'], userId });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

router.get('/:id/permissions', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const result = await db.transaction(async client => {
      await setSession(client, userId);
      const contextResult = await client.query(
        `SELECT pipeline_id, project_id
         FROM catalog.fn_get_pipeline_permission_context($1::uuid)`,
        [req.params['id']],
      );
      const context = contextResult.rows[0] ?? null;
      if (!context) throw Object.assign(new Error('Pipeline not found'), { status: 404 });
      if (!context.project_id) {
        return { projectScoped: false, grants: [] as PermissionGrantPayload[] };
      }
      const grantsResult = await client.query(
        `SELECT project_id, user_id, role_id, user_full_name, email_address, role_display_name, granted_dtm
         FROM catalog.fn_get_pipeline_permission_grants($1::uuid)`,
        [req.params['id']],
      );
      return { projectScoped: true, grants: mapPermissionGrantRows(grantsResult.rows) };
    });
    return res.json({
      success: true,
      data: {
        grants: result.grants,
        inheritFromProject: result.projectScoped,
        projectScoped: result.projectScoped,
      },
    });
  } catch (err: any) {
    if (err?.status === 404) return res.status(404).json({ success: false, userMessage: 'Pipeline not found' });
    return next(err);
  }
});

router.put('/:id/permissions', requirePermission('PIPELINE_EDIT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const desiredGrants = normalizePermissionGrants((req.body ?? {}).grants);
    const desiredMap = new Map(desiredGrants.map(g => [`${g.userId}:${g.roleId}`, g]));
    const result = await db.transaction(async client => {
      await setSession(client, userId);
      const contextResult = await client.query(
        `SELECT pipeline_id, project_id
         FROM catalog.fn_get_pipeline_permission_context($1::uuid)`,
        [req.params['id']],
      );
      const context = contextResult.rows[0] ?? null;
      if (!context) throw Object.assign(new Error('Pipeline not found'), { status: 404 });
      if (!context.project_id) {
        if (desiredGrants.length > 0) {
          throw Object.assign(new Error('Global pipelines do not support project-member permission changes'), { status: 409 });
        }
        return { projectScoped: false, grants: [] as PermissionGrantPayload[] };
      }

      const currentResult = await client.query(
        `SELECT project_id, user_id, role_id, user_full_name, email_address, role_display_name, granted_dtm
         FROM catalog.fn_get_pipeline_permission_grants($1::uuid)`,
        [req.params['id']],
      );
      const currentRows = currentResult.rows;
      const currentMap = new Map(currentRows.map((row: any) => [`${row.user_id}:${row.role_id}`, row]));

      for (const desired of desiredGrants) {
        if (!currentMap.has(`${desired.userId}:${desired.roleId}`)) {
          await client.query(
            `CALL catalog.pr_grant_pipeline_permission($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
            [req.params['id'], desired.userId, desired.roleId, userId],
          );
        }
      }

      for (const row of currentRows) {
        const key = `${row.user_id}:${row.role_id}`;
        if (!desiredMap.has(key)) {
          await client.query(
            `CALL catalog.pr_revoke_pipeline_permission($1::uuid, $2::uuid, $3::uuid)`,
            [req.params['id'], row.user_id, row.role_id],
          );
        }
      }

      const finalResult = await client.query(
        `SELECT project_id, user_id, role_id, user_full_name, email_address, role_display_name, granted_dtm
         FROM catalog.fn_get_pipeline_permission_grants($1::uuid)`,
        [req.params['id']],
      );
      return { projectScoped: true, grants: mapPermissionGrantRows(finalResult.rows) };
    });

    return res.json({
      success: true,
      data: {
        grants: result.grants,
        inheritFromProject: result.projectScoped,
        projectScoped: result.projectScoped,
      },
    });
  } catch (err: any) {
    if (err?.status === 404) return res.status(404).json({ success: false, userMessage: 'Pipeline not found' });
    if (err?.status === 409) return res.status(409).json({ success: false, userMessage: err.message });
    if (err?.code === 'P0002') return res.status(404).json({ success: false, userMessage: 'Pipeline not found or inaccessible' });
    return next(err);
  }
});

router.get('/:id/audit-logs', requirePermission('AUDIT_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(res);
    const limit  = parseInt(String(req.query['limit'] ?? 50));
    const offset = parseInt(String(req.query['offset'] ?? 0));
    const rows = await db.transaction(async client => {
      await setSession(client, userId);
      const r = await client.query(
        `SELECT id, action_dtm, user_id, action_code
         FROM catalog.fn_get_pipeline_audit_logs($1::uuid, $2, $3)`,
        [req.params['id'], limit, offset]);
      return r.rows.map((row:any) => ({
        id:String(row.id), timestamp:row.action_dtm, user:row.user_id??'system',
        action:row.action_code==='U'?'PIPELINE_SAVED':row.action_code==='I'?'PIPELINE_CREATED':'PIPELINE_DELETED',
        summary:`Pipeline ${row.action_code==='U'?'updated':row.action_code==='I'?'created':'deleted'}`,
      }));
    });
    res.json({success:true,data:rows});
  } catch (err) { return next(err); }
});

export { router as pipelineRouter };
