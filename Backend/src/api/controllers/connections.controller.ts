/**
 * ConnectionsController — Express request handler layer.
 *
 * Validates request bodies, delegates to ConnectionsService, and lets
 * errors propagate to the global errorHandler middleware.
 *
 * UserId is read from res.locals.userId, set by userIdMiddleware.
 */

import { Request, Response, NextFunction } from 'express';
import {
    connectionsService,
    CreateConnectorInput,
    UpdateConnectorInput,
} from '../services/connections.service';
import { connErrors } from '../../shared/errors/catalog/conn.errors';

export class ConnectionsController {

    // ─── Helper ───────────────────────────────────────────────────────────────

    private getUserId(res: Response): string {
        return (res.locals['userId'] as string) ?? 'system';
    }

    // ─── CRUD ─────────────────────────────────────────────────────────────────

    /** GET /api/connections  (supports ?techCode=X&limit=50&after=<uuid>) */
    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = this.getUserId(res);
            const techCode = req.query['techCode'] as string | undefined;
            const limit    = Math.min(parseInt(String(req.query['limit'] ?? '50'), 10), 200);
            const afterId  = req.query['after'] as string | undefined;

            let result;
            if (techCode) {
                result = await connectionsService.listConnectorsByTech(userId, techCode, limit, afterId);
            } else {
                result = await connectionsService.listConnectors(userId);
            }
            res.json({ success: true, data: result.items, nextCursor: result.nextCursor });
        } catch (err) {
            next(err);
        }
    }

    /** GET /api/connections/:id */
    async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) throw connErrors.notFound('missing');
            const userId = this.getUserId(res);
            const connector = await connectionsService.getConnector(id, userId);
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.json({ success: true, data: connector });
        } catch (err) {
            next(err);
        }
    }

    /** POST /api/connections */
    async create(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const body = req.body;
            const userId = this.getUserId(res);

            if (!body.connectorDisplayName) throw connErrors.nameRequired();
            if (!body.connectorTypeCode) throw connErrors.typeRequired();

            const input: CreateConnectorInput = {
                connectorDisplayName: body.connectorDisplayName,
                connectorTypeCode: body.connectorTypeCode,
                config: body.config ?? {},
                secrets: body.secrets,
                jdbcDriverClass: body.jdbcDriverClass,
                jdbcDriverMavenCoords: body.jdbcDriverMavenCoords,
                jdbcDriverPaths: body.jdbcDriverPaths,
                testQuery: body.testQuery,
                sparkConfig: body.sparkConfig,
                sslMode: body.sslMode,
                sshTunnel: body.sshTunnel,
                proxy: body.proxy,
                maxPoolSize: body.maxPoolSize,
                idleTimeoutSec: body.idleTimeoutSec,
                userId,
                technologyId: typeof body.technologyId === 'string' ? body.technologyId : undefined,
            };

            const result = await connectionsService.createConnector(input);
            res.status(201).json({ success: true, data: result });
        } catch (err) {
            next(err);
        }
    }

    /** PUT /api/connections/:id */
    async update(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) throw connErrors.notFound('missing');
            const body = req.body;
            const userId = this.getUserId(res);

            const input: UpdateConnectorInput = {
                connectorId: id,
                connectorDisplayName: body.connectorDisplayName,
                config: body.config,
                secrets: body.secrets,
                jdbcDriverClass: body.jdbcDriverClass,
                jdbcDriverMavenCoords: body.jdbcDriverMavenCoords,
                jdbcDriverPaths: body.jdbcDriverPaths,
                testQuery: body.testQuery,
                sparkConfig: body.sparkConfig,
                sslMode: body.sslMode,
                sshTunnel: body.sshTunnel,
                proxy: body.proxy,
                maxPoolSize: body.maxPoolSize,
                idleTimeoutSec: body.idleTimeoutSec,
                userId,
                technologyId: typeof body.technologyId === 'string' ? body.technologyId : undefined,
            };

            await connectionsService.updateConnector(input);
            const connector = await connectionsService.getConnector(id, userId);
            res.json({ success: true, data: connector });
        } catch (err) {
            next(err);
        }
    }

    /** DELETE /api/connections/:id */
    async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) throw connErrors.notFound('missing');
            const userId = this.getUserId(res);
            await connectionsService.deleteConnector(id, userId);
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }

    // ─── Test & Health ────────────────────────────────────────────────────────

    /** POST /api/connections/:id/test */
    async testConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) throw connErrors.notFound('missing');
            const userId = this.getUserId(res);
            const result = await connectionsService.testConnector({ connectorId: id, userId });
            res.json({ success: true, data: result });
        } catch (err) {
            next(err);
        }
    }

    /** POST /api/connections/test */
    async testConnectionConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const body = req.body ?? {};
            const connectorTypeCode = body.connectorTypeCode ?? body.connector_type_code;
            if (!connectorTypeCode) throw connErrors.typeRequired();
            const result = await connectionsService.testUnsavedConnector({
                connectorTypeCode,
                config: body.config ?? {},
                secrets: body.secrets ?? {},
            });
            res.json({ success: true, data: result });
        } catch (err) {
            next(err);
        }
    }

    /** GET /api/connections/:id/health */
    async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) throw connErrors.notFound('missing');
            const health = await connectionsService.getHealth(id);
            res.json({ success: true, data: health });
        } catch (err) {
            next(err);
        }
    }

    /** GET /api/connections/:id/usage */
    async getUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) throw connErrors.notFound('missing');
            const userId = this.getUserId(res);
            const usage = await connectionsService.getUsage(id, userId);
            res.json({ success: true, data: usage });
        } catch (err) {
            next(err);
        }
    }

    /** GET /api/connections/:id/history */
    async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) throw connErrors.notFound('missing');
            const userId = this.getUserId(res);
            const limit = parseInt(String(req.query['limit'] ?? '100'), 10);
            const offset = parseInt(String(req.query['offset'] ?? '0'), 10);
            const history = await connectionsService.getHistory(id, userId, limit, offset);
            res.json({ success: true, data: history });
        } catch (err) {
            next(err);
        }
    }

    /** GET /api/connections/:id/permissions */
    async getPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) throw connErrors.notFound('missing');
            const userId = this.getUserId(res);
            const grants = await connectionsService.getPermissions(id, userId);
            res.json({ success: true, data: grants });
        } catch (err) {
            next(err);
        }
    }

    /** PUT /api/connections/:id/permissions */
    async updatePermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) throw connErrors.notFound('missing');
            const userId = this.getUserId(res);
            const grants = Array.isArray(req.body?.grants) ? req.body.grants : [];
            const updated = await connectionsService.updatePermissions(id, userId, grants);
            res.json({ success: true, data: updated });
        } catch (err) {
            next(err);
        }
    }

    // ─── Metadata browsing ────────────────────────────────────────────────────

    /** GET /api/connections/:id/databases */
    async listDatabases(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) throw connErrors.notFound('missing');
            const userId = this.getUserId(res);
            const databases = await connectionsService.listDatabases({ connectorId: id, userId });
            res.json({ success: true, data: databases });
        } catch (err) {
            next(err);
        }
    }

    /** GET /api/connections/:id/schemas?database=<db> */
    async listSchemas(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) throw connErrors.notFound('missing');
            const userId = this.getUserId(res);
            const database = req.query['database'] as string | undefined;
            const schemas = await connectionsService.listSchemas({ connectorId: id, userId, database });
            res.json({ success: true, data: schemas });
        } catch (err) {
            next(err);
        }
    }

    /** GET /api/connections/:id/tables?database=<db>&schema=<schema> */
    async listTables(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) throw connErrors.notFound('missing');
            const userId = this.getUserId(res);
            const database = req.query['database'] as string | undefined;
            const schema = req.query['schema'] as string | undefined;
            const tables = await connectionsService.listTables({ connectorId: id, userId, database, schema });
            res.json({ success: true, data: tables });
        } catch (err) {
            next(err);
        }
    }

    /** GET /api/connections/:id/tables/:table?database=<db>&schema=<schema> */
    async describeTable(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id, table } = req.params;
            if (!id) throw connErrors.notFound('missing');
            const userId = this.getUserId(res);
            const database = req.query['database'] as string | undefined;
            const schema = req.query['schema'] as string | undefined;
            if (!database || !schema) throw connErrors.hostRequired();
            const detail = await connectionsService.describeTable(id, database, schema, table, userId);
            res.json({ success: true, data: detail });
        } catch (err) {
            next(err);
        }
    }
}
