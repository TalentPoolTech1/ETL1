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
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ConnectionsController } from '../controllers/connections.controller';
import { ConnectorRegistry } from '../../connectors/ConnectorRegistry';
import { userIdMiddleware } from '../middleware/user-id.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { metadataIntrospectionService } from '../../metadata/MetadataIntrospectionService';
import { connectionsService } from '../services/connections.service';
import { connectionsRepository } from '../../db/repositories/connections.repository';

const router = Router();
const ctrl = new ConnectionsController();

// Apply userId extraction to all connections routes
router.use(userIdMiddleware);

// ---------------------------------------------------------------------------
// Static routes must come before /:id to avoid shadowing
// ---------------------------------------------------------------------------

/** Returns all registered connector types with their schemas for the dynamic UI form */
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

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------
router.post('/',     requirePermission('CONNECTION_CREATE'), (req, res, next) => ctrl.create(req, res, next));
router.get('/',      requirePermission('CONNECTION_VIEW'),   (req, res, next) => ctrl.list(req, res, next));
router.post('/test', requirePermission('CONNECTION_VIEW'),   (req, res, next) => ctrl.testConnectionConfig(req, res, next));
router.get('/:id',   requirePermission('CONNECTION_VIEW'),   (req, res, next) => ctrl.getById(req, res, next));
router.put('/:id',   requirePermission('CONNECTION_EDIT'),   (req, res, next) => ctrl.update(req, res, next));
router.delete('/:id', requirePermission('CONNECTION_DELETE'), (req, res, next) => ctrl.delete(req, res, next));

// ---------------------------------------------------------------------------
// Test & Health
// ---------------------------------------------------------------------------
router.post('/:id/test',  requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.testConnection(req, res, next));
router.get('/:id/health', requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.getHealth(req, res, next));
router.get('/:id/usage', requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.getUsage(req, res, next));
router.get('/:id/history', requirePermission('AUDIT_VIEW'), (req, res, next) => ctrl.getHistory(req, res, next));
router.get('/:id/permissions', requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.getPermissions(req, res, next));
router.put('/:id/permissions', requirePermission('CONNECTION_EDIT'), (req, res, next) => ctrl.updatePermissions(req, res, next));

// ---------------------------------------------------------------------------
// Metadata browsing (lazy-load hierarchy for Metadata Service)
// ---------------------------------------------------------------------------
router.get('/:id/databases', requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.listDatabases(req, res, next));
router.get('/:id/schemas', requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.listSchemas(req, res, next));
router.get('/:id/tables', requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.listTables(req, res, next));
router.get('/:id/tables/:table', requirePermission('CONNECTION_VIEW'), (req, res, next) => ctrl.describeTable(req, res, next));

// ---------------------------------------------------------------------------
// Metadata import — introspect source and register datasets in catalog
// ---------------------------------------------------------------------------

function getUserId(res: Response): string {
    return (res.locals['userId'] as string) ?? 'system';
}

/** Maps raw driver/network errors from introspect calls into user-readable 503 responses. */
function introspectErrResponse(err: unknown, res: Response): Response {
    const msg = err instanceof Error ? err.message : String(err);
    const pgCode = (err as Record<string, unknown>)?.['pgCode'] ?? (err as Record<string, unknown>)?.['code'];

    let userMessage: string;
    if (/password authentication failed/i.test(msg) || pgCode === '28P01') {
        userMessage = 'Authentication failed — the stored username or password is incorrect. Edit the connection credentials and try again.';
    } else if (/ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH/i.test(msg) || pgCode === 'ECONNREFUSED') {
        userMessage = 'Cannot reach the database server — check the host, port, and network/firewall settings.';
    } else if (/database .* does not exist/i.test(msg) || pgCode === '3D000') {
        userMessage = 'Database not found — verify the database name in the connection properties.';
    } else if (/SSL/i.test(msg)) {
        userMessage = 'SSL/TLS handshake failed — check the SSL mode and certificate settings.';
    } else if (/role .* does not exist/i.test(msg) || pgCode === '28000') {
        userMessage = 'Database user not found — the username stored in this connection does not exist on the server.';
    } else {
        userMessage = `Could not connect to the data source: ${msg}`;
    }

    return res.status(503).json({ success: false, userMessage });
}

/** GET /api/connections/:id/introspect/schemas — list available schemas/paths */
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

/** GET /api/connections/:id/introspect/tables?schema= — list tables in a schema */
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

/** POST /api/connections/:id/introspect/import — import selected tables into catalog */
router.post('/:id/introspect/import', requirePermission('CONNECTION_EDIT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = getUserId(res);
        const encKey = process.env['APP_ENCRYPTION_KEY'];
        if (!encKey) throw new Error('APP_ENCRYPTION_KEY is required');
        const row = await connectionsRepository.getDecrypted(req.params.id, userId, encKey);
        if (!row) return res.status(404).json({ success: false, userMessage: 'Connection not found' });

        // Body: { selections: [{db?, schema, table}] }  OR  { all: true } for file connections
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
