/**
 * Connections Routes — REST endpoints for connector management.
 *
 * POST   /api/connections                        — Create a connector
 * GET    /api/connections                        — List all connectors
 * GET    /api/connections/types                  — List registered connector types with schemas
 * GET    /api/connections/:id                    — Get connector by ID
 * PUT    /api/connections/:id                    — Update a connector
 * DELETE /api/connections/:id                    — Delete a connector
 * POST   /api/connections/:id/test               — Test connectivity
 * GET    /api/connections/:id/health             — Get health status
 * GET    /api/connections/:id/databases          — List databases (metadata browsing)
 * GET    /api/connections/:id/schemas            — List schemas (?database=)
 * GET    /api/connections/:id/tables             — List tables (?database=&schema=)
 * GET    /api/connections/:id/tables/:table      — Describe table (?database=&schema=)
 * GET    /api/connections/:id/introspect/schemas — List schemas via live introspection
 * GET    /api/connections/:id/introspect/tables  — List tables via live introspection (?schema=)
 * GET    /api/connections/:id/introspect/columns — Column list for a table (?schema=&table=) [F-03/F-04]
 * POST   /api/connections/:id/introspect/import  — Import selected tables into catalog
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ConnectionsController } from '../controllers/connections.controller';
import { ConnectorRegistry } from '../../connectors/ConnectorRegistry';
import { userIdMiddleware } from '../middleware/user-id.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { metadataIntrospectionService } from '../../metadata/MetadataIntrospectionService';
import { connectionsService } from '../services/connections.service';
import { connectionsRepository } from '../../db/repositories/connections.repository';
import { db } from '../../db/connection';

const router = Router();
const ctrl = new ConnectionsController();

router.use(userIdMiddleware);

router.get('/types', requirePermission('CONNECTION_VIEW'), (_req, res) => {
    const types = ConnectorRegistry.getRegisteredTypeCodes().map(code => {
        const plugin = ConnectorRegistry.get(code)!;
        return {
            typeCode: plugin.typeCode,
            displayName: plugin.displayName,
            category: plugin.category,
            configSchema: plugin.configSchema,
            secretsSchema: plugin.secretsSchema,
            defaultPort: plugin.defaultPort,
            defaultTestQuery: plugin.defaultTestQuery,
        };
    });
    res.json({ success: true, data: types });
});

router.post('/',     requirePermission('CONNECTION_CREATE'), (req, res, next) => ctrl.create(req, res, next));
router.get('/',      requirePermission('CONNECTION_VIEW'),   (req, res, next) => ctrl.list(req, res, next));
router.post('/test', requirePermission('CONNECTION_VIEW'),   (req, res, next) => ctrl.testConnectionConfig(req, res, next));
router.get('/:id',   requirePermission('CONNECTION_VIEW'),   (req, res, next) => ctrl.getById(req, res, next));
router.put('/:id',   requirePermission('CONNECTION_EDIT'),   (req, res, next) => ctrl.update(req, res, next));
router.delete('/:id', requirePermission('CONNECTION_DELETE'), (req, res, next) => ctrl.delete(req, res, next));

router.post('/:id/test',  requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.testConnection(req, res, next));
router.get('/:id/health', requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.getHealth(req, res, next));
router.get('/:id/usage', requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.getUsage(req, res, next));
router.get('/:id/history', requirePermission('AUDIT_VIEW'), (req, res, next) => ctrl.getHistory(req, res, next));
router.get('/:id/permissions', requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.getPermissions(req, res, next));
router.put('/:id/permissions', requirePermission('CONNECTION_EDIT'), (req, res, next) => ctrl.updatePermissions(req, res, next));

router.get('/:id/databases', requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.listDatabases(req, res, next));
router.get('/:id/schemas', requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.listSchemas(req, res, next));
router.get('/:id/tables', requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.listTables(req, res, next));
router.get('/:id/tables/:table', requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.describeTable(req, res, next));

function getUserId(res: Response): string {
    return (res.locals['userId'] as string) ?? 'system';
}

async function setSession(client: any, userId: string) {
    const key = process.env['APP_ENCRYPTION_KEY'];
    if (!key) throw new Error('APP_ENCRYPTION_KEY is required');
    await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
    await client.query(`SET LOCAL app.encryption_key = '${key.replace(/'/g, "''")}'`);
}

function introspectErrResponse(err: unknown, res: Response): Response {
    const msg = err instanceof Error ? err.message : String(err);
    const pgCode = (err as Record<string, unknown>)?.['pgCode'] ?? (err as Record<string, unknown>)?.['code'];
    let userMessage: string;
    if (/password authentication failed/i.test(msg) || pgCode === '28P01') {
        userMessage = 'Authentication failed — the stored username or password is incorrect.';
    } else if (/ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH/i.test(msg) || pgCode === 'ECONNREFUSED') {
        userMessage = 'Cannot reach the database server — check the host, port, and network/firewall settings.';
    } else if (/database .* does not exist/i.test(msg) || pgCode === '3D000') {
        userMessage = 'Database not found — verify the database name in the connection properties.';
    } else if (/SSL/i.test(msg)) {
        userMessage = 'SSL/TLS handshake failed — check the SSL mode and certificate settings.';
    } else if (/role .* does not exist/i.test(msg) || pgCode === '28000') {
        userMessage = 'Database user not found.';
    } else {
        userMessage = `Could not connect to the data source: ${msg}`;
    }
    return res.status(503).json({ success: false, userMessage });
}

router.get('/:id/introspect/schemas', requirePermission('CONNECTION_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = getUserId(res);
        const encKey = process.env['APP_ENCRYPTION_KEY'];
        if (!encKey) throw new Error('APP_ENCRYPTION_KEY is required');
        const row = await connectionsRepository.getDecrypted(req.params.id, userId, encKey);
        if (!row) return res.status(404).json({ success: false, userMessage: 'Connection not found' });
        const schemas = await metadataIntrospectionService.listSchemas(
            row.connector_type_code,
            { ...row.conn_config_json, connector_id: req.params.id },
            row.conn_secrets_json ?? {},
        );
        return res.json({ success: true, data: schemas });
    } catch (err) { return introspectErrResponse(err, res); }
});

router.get('/:id/introspect/tables', requirePermission('CONNECTION_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = getUserId(res);
        const schema = String(req.query['schema'] ?? '');
        const encKey = process.env['APP_ENCRYPTION_KEY'];
        if (!encKey) throw new Error('APP_ENCRYPTION_KEY is required');
        const row = await connectionsRepository.getDecrypted(req.params.id, userId, encKey);
        if (!row) return res.status(404).json({ success: false, userMessage: 'Connection not found' });
        const tables = await metadataIntrospectionService.listTables(
            row.connector_type_code,
            { ...row.conn_config_json, connector_id: req.params.id },
            row.conn_secrets_json ?? {},
            schema,
        );
        return res.json({ success: true, data: tables });
    } catch (err) { return introspectErrResponse(err, res); }
});

/**
 * GET /api/connections/:id/introspect/columns?schema=X&table=Y
 *
 * F-03/F-04: Returns column list for a specific table.
 * Strategy (catalog-first, then live fallback):
 *   1. Look up catalog.datasets for connector_id + schema + table.
 *   2. If found in catalog → return catalog.dataset_columns (fast, no live connection).
 *   3. If not in catalog → attempt live introspection via metadataIntrospectionService.
 */
router.get('/:id/introspect/columns', requirePermission('CONNECTION_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId  = getUserId(res);
        const connId  = req.params.id;
        const schema  = String(req.query['schema'] ?? '');
        const table   = String(req.query['table']  ?? '');

        if (!schema || !table) {
            return res.status(400).json({ success: false, userMessage: 'schema and table query parameters are required' });
        }

        const encKey = process.env['APP_ENCRYPTION_KEY'];
        if (!encKey) throw new Error('APP_ENCRYPTION_KEY is required');

        // ── 1. Catalog lookup ──────────────────────────────────────────────
        const catalogCols = await db.transaction(async client => {
            await setSession(client, userId);
            const r = await client.query(
                `WITH latest_dataset AS (
                    SELECT d.dataset_id
                    FROM catalog.datasets d
                    WHERE d.connector_id = $1::uuid
                      AND (d.schema_name_text = $2 OR $2 = '')
                      AND d.table_name_text = $3
                    ORDER BY
                        d.last_introspection_dtm DESC NULLS LAST,
                        d.updated_dtm DESC NULLS LAST,
                        d.created_dtm DESC NULLS LAST
                    LIMIT 1
                 )
                 SELECT
                    c.column_name_text,
                    c.data_type_code,
                    c.override_data_type_code,
                    COALESCE(c.override_data_type_code, c.data_type_code) AS effective_data_type_code,
                    c.parse_format_text,
                    c.is_nullable_flag,
                    c.ordinal_position_num
                 FROM latest_dataset ld
                 JOIN catalog.dataset_columns c ON c.dataset_id = ld.dataset_id
                 ORDER BY c.ordinal_position_num`,
                [connId, schema, table],
            );
            return r.rows;
        }).catch(() => [] as any[]);

        if (catalogCols.length > 0) {
            return res.json({
                success: true,
                source: 'catalog',
                data: catalogCols.map((c: any) => ({
                    columnName:      c.column_name_text,
                    dataType:        c.effective_data_type_code ?? c.data_type_code,
                    importedDataType: c.data_type_code,
                    overrideDataType: c.override_data_type_code,
                    parseFormat:     c.parse_format_text,
                    nullable:        c.is_nullable_flag ?? true,
                    ordinalPosition: c.ordinal_position_num,
                })),
            });
        }

        // ── 2. Live introspection fallback ─────────────────────────────────
        const conn = await connectionsRepository.getDecrypted(connId, userId, encKey);
        if (!conn) return res.status(404).json({ success: false, userMessage: 'Connection not found' });

        const liveCols = await metadataIntrospectionService.listColumns(
            conn.connector_type_code,
            { ...conn.conn_config_json, connector_id: connId },
            conn.conn_secrets_json ?? {},
            schema,
            table,
        );

        return res.json({ success: true, source: 'live', data: liveCols });
    } catch (err) { return introspectErrResponse(err, res); }
});

router.post('/:id/introspect/import', requirePermission('CONNECTION_EDIT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = getUserId(res);
        const encKey = process.env['APP_ENCRYPTION_KEY'];
        if (!encKey) throw new Error('APP_ENCRYPTION_KEY is required');
        const row = await connectionsRepository.getDecrypted(req.params.id, userId, encKey);
        if (!row) return res.status(404).json({ success: false, userMessage: 'Connection not found' });
        const selections: Array<{ db?: string; schema?: string; table: string }> = req.body.selections ?? [];
        const result = await metadataIntrospectionService.importMetadata({
            connectorId: req.params.id,
            typeCode: row.connector_type_code,
            config: { ...row.conn_config_json, connector_id: req.params.id },
            secrets: row.conn_secrets_json ?? {},
            selections: selections.map(s => ({ db: s.db ?? '', schema: s.schema ?? '', table: s.table })),
            userId,
            encryptionKey: encKey,
        });
        return res.json({ success: true, data: result });
    } catch (err) { return introspectErrResponse(err, res); }
});

export default router;
