import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db/connection';
import { userIdMiddleware } from '../middleware/user-id.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { connectionsRepository } from '../../db/repositories/connections.repository';
import { metadataIntrospectionService } from '../../metadata/MetadataIntrospectionService';

const router = Router();
router.use(userIdMiddleware);

function getUserId(res: Response): string {
  return String(res.locals['userId'] ?? '');
}

async function setSession(client: any, userId: string) {
  const key = process.env['APP_ENCRYPTION_KEY'];
  if (!key) throw new Error('APP_ENCRYPTION_KEY is required');
  await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
  await client.query(`SET LOCAL app.encryption_key = '${key.replace(/'/g, "''")}'`);
}

function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function isFileConnectorType(typeCode: string): boolean {
  return /^(FILE_|CSV$|JSON$|PARQUET$|AVRO$|ORC$|XML$|XLSX$|EXCEL$)/i.test(typeCode);
}

function inferFileTypeCode(format: string): string {
  const normalized = format.trim().toUpperCase();
  switch (normalized) {
    case 'CSV': return 'FILE_CSV';
    case 'JSON': return 'FILE_JSON';
    case 'PARQUET': return 'FILE_PARQUET';
    case 'AVRO': return 'FILE_AVRO';
    case 'ORC': return 'FILE_ORC';
    default: return `FILE_${normalized || 'CSV'}`;
  }
}

function inferSourceType(cfg: Record<string, unknown>, connectorTypeCode = ''): 'file' | 'jdbc' | 'kafka' {
  const explicit = firstString(cfg['sourceType']).toLowerCase();
  if (explicit === 'file' || explicit === 'jdbc' || explicit === 'kafka') return explicit as 'file' | 'jdbc' | 'kafka';
  if (isFileConnectorType(connectorTypeCode)) return 'file';
  if (firstString(cfg['filePath'], cfg['path'])) return 'file';
  if (firstString(cfg['bootstrapServers'])) return 'kafka';
  return 'jdbc';
}

function inferSinkType(cfg: Record<string, unknown>, connectorTypeCode = ''): 'file' | 'jdbc' {
  const explicit = firstString(cfg['sinkType']).toLowerCase();
  if (explicit === 'file' || explicit === 'jdbc') return explicit as 'file' | 'jdbc';
  if (isFileConnectorType(connectorTypeCode)) return 'file';
  if (firstString(cfg['targetPath'], cfg['outputPath'], cfg['path'])) return 'file';
  return 'jdbc';
}

function normalizePreviewEnvelope(data: { columns?: string[]; rows?: Array<Record<string, unknown>>; unsupported?: boolean }, extra?: { reason?: string }) {
  return {
    previewAvailable: !data.unsupported,
    availabilityReason: data.unsupported ? (extra?.reason ?? 'Preview is not supported for this object type.') : null,
    columns: data.columns ?? [],
    rows: data.rows ?? [],
    totalRows: (data.rows ?? []).length,
  };
}

async function buildNodePreviewData(params: {
  nodeRecord: Record<string, unknown>;
  pipelineId?: string;
  pipelineName?: string;
  userId: string;
  encKey: string;
  limit: number;
}) {
  const { nodeRecord, pipelineId, pipelineName, userId, encKey, limit } = params;
  const cfg = asRecord(nodeRecord['config']);
  const rawType = firstString(nodeRecord['type']).toLowerCase();
  const connId = firstString(cfg['connectionId']);
  const conn = connId
    ? await connectionsRepository.getDecrypted(connId, userId, encKey)
    : null;
  const connectorTypeCode = String(conn?.connector_type_code ?? '');

  if (rawType === 'source') {
    const sourceType = inferSourceType(cfg, connectorTypeCode);

    if (sourceType === 'file') {
      const preview = await metadataIntrospectionService.previewDataset({
        typeCode: connectorTypeCode || inferFileTypeCode(firstString(cfg['fileFormat'], cfg['format'], 'csv')),
        config: {
          ...(conn?.conn_config_json ?? {}),
          preview_path: firstString(cfg['filePath'], cfg['path']),
          file_path: firstString(cfg['filePath'], cfg['path']),
          path: firstString(cfg['filePath'], cfg['path']),
          delimiter: firstString(cfg['delimiter']) || (conn?.conn_config_json?.['delimiter'] as string | undefined),
          pathGlobFilter: firstString(cfg['pathGlobFilter']),
          recursiveFileLookup: firstString(cfg['recursiveFileLookup']) || cfg['recursiveFileLookup'],
        },
        secrets: conn?.conn_secrets_json ?? {},
        schemaName: firstString(cfg['schema']),
        tableName: firstString(cfg['table']),
        limit,
      });
      return {
        nodeId: firstString(nodeRecord['id']),
        pipelineId: pipelineId ?? '',
        pipelineName: pipelineName ?? '',
        ...normalizePreviewEnvelope(preview, { reason: 'Preview is not available for this file format yet.' }),
      };
    }

    if (conn && firstString(cfg['table'])) {
      const preview = await metadataIntrospectionService.previewDataset({
        typeCode: connectorTypeCode,
        config: { ...(conn.conn_config_json ?? {}), connector_id: connId },
        secrets: conn.conn_secrets_json ?? {},
        schemaName: firstString(cfg['schema']),
        tableName: firstString(cfg['table']),
        limit,
      });
      return {
        nodeId: firstString(nodeRecord['id']),
        pipelineId: pipelineId ?? '',
        pipelineName: pipelineName ?? '',
        ...normalizePreviewEnvelope(preview, { reason: 'Preview is not available for this source type yet.' }),
      };
    }
  }

  if (rawType === 'target') {
    const sinkType = inferSinkType(cfg, connectorTypeCode);

    if (sinkType === 'jdbc' && conn && firstString(cfg['table'])) {
      const preview = await metadataIntrospectionService.previewDataset({
        typeCode: connectorTypeCode,
        config: { ...(conn.conn_config_json ?? {}), connector_id: connId },
        secrets: conn.conn_secrets_json ?? {},
        schemaName: firstString(cfg['schema']),
        tableName: firstString(cfg['table']),
        limit,
      });
      return {
        nodeId: firstString(nodeRecord['id']),
        pipelineId: pipelineId ?? '',
        pipelineName: pipelineName ?? '',
        ...normalizePreviewEnvelope(preview, { reason: 'Preview is not available for this target type yet.' }),
      };
    }

    if (sinkType === 'file') {
      const preview = await metadataIntrospectionService.previewDataset({
        typeCode: connectorTypeCode || inferFileTypeCode(firstString(cfg['fileFormat'], 'parquet')),
        config: {
          ...(conn?.conn_config_json ?? {}),
          preview_path: firstString(cfg['targetPath'], cfg['outputPath'], cfg['path']),
          file_path: firstString(cfg['targetPath'], cfg['outputPath'], cfg['path']),
          path: firstString(cfg['targetPath'], cfg['outputPath'], cfg['path']),
        },
        secrets: conn?.conn_secrets_json ?? {},
        schemaName: '',
        tableName: '',
        limit,
      });
      return {
        nodeId: firstString(nodeRecord['id']),
        pipelineId: pipelineId ?? '',
        pipelineName: pipelineName ?? '',
        ...normalizePreviewEnvelope(preview, { reason: 'Preview is not available for this target file format yet.' }),
      };
    }
  }

  return {
    nodeId: firstString(nodeRecord['id']),
    pipelineId: pipelineId ?? '',
    pipelineName: pipelineName ?? '',
    previewAvailable: false,
    availabilityReason: 'Preview is currently available for source and target nodes only.',
    rows: [],
    columns: [],
    totalRows: 0,
    requestedLimit: limit,
  };
}

router.post('/preview', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nodeRecord = asRecord(req.body?.['node']);
    const pipelineId = firstString(req.body?.['pipelineId']);
    const pipelineName = firstString(req.body?.['pipelineName']);
    const limitRaw = Number.parseInt(String(req.body?.['limit'] ?? '100'), 10);
    const limit = Number.isNaN(limitRaw) ? 100 : Math.min(Math.max(limitRaw, 1), 100);

    if (!firstString(nodeRecord['type'])) {
      return res.status(400).json({ success: false, userMessage: 'node is required for node preview' });
    }

    const userId = getUserId(res);
    const encKey = process.env['APP_ENCRYPTION_KEY'];
    if (!encKey) throw new Error('APP_ENCRYPTION_KEY is required');

    const data = await buildNodePreviewData({
      nodeRecord,
      pipelineId,
      pipelineName,
      userId,
      encKey,
      limit,
    });

    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

router.get('/:nodeId/preview', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nodeId = String(req.params['nodeId'] ?? '');
    const pipelineId = String(req.query['pipelineId'] ?? '');
    const limitRaw = Number.parseInt(String(req.query['limit'] ?? '100'), 10);
    const limit = Number.isNaN(limitRaw) ? 100 : Math.min(Math.max(limitRaw, 1), 100);

    if (!isValidUUID(nodeId)) {
      return res.status(400).json({ success: false, userMessage: 'Invalid node ID' });
    }
    if (!isValidUUID(pipelineId)) {
      return res.status(400).json({ success: false, userMessage: 'pipelineId is required for node preview' });
    }

    const userId = getUserId(res);
    const encKey = process.env['APP_ENCRYPTION_KEY'];
    if (!encKey) throw new Error('APP_ENCRYPTION_KEY is required');

    const pipeline = await db.transaction(async client => {
      await setSession(client, userId);
      const result = await client.query(
        `SELECT pipeline_id, pipeline_display_name, ir_payload_json
           FROM catalog.fn_get_pipeline_by_id($1::uuid)`,
        [pipelineId],
      );
      return result.rows[0] ?? null;
    });

    if (!pipeline) {
      return res.status(404).json({ success: false, userMessage: 'Pipeline not found' });
    }

    const payload = asRecord(pipeline.ir_payload_json);
    const irNodes = Array.isArray(payload['nodes']) ? payload['nodes'] : [];
    const node = irNodes.find(candidate => asRecord(candidate)['id'] === nodeId);
    if (!node) {
      return res.status(404).json({ success: false, userMessage: 'Node not found in pipeline' });
    }

    const nodeRecord = asRecord(node);
    const data = await buildNodePreviewData({
      nodeRecord,
      pipelineId,
      pipelineName: String(pipeline.pipeline_display_name ?? ''),
      userId,
      encKey,
      limit,
    });

    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

export { router as nodesRouter };
