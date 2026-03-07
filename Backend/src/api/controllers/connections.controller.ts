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

    /** GET /api/connections */
    async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = this.getUserId(res);
            const connectors = await connectionsService.listConnectors(userId);
            res.json({ success: true, data: connectors });
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
                testQuery: body.testQuery,
                sparkConfig: body.sparkConfig,
                sslMode: body.sslMode,
                sshTunnel: body.sshTunnel,
                proxy: body.proxy,
                maxPoolSize: body.maxPoolSize,
                idleTimeoutSec: body.idleTimeoutSec,
                userId,
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
                testQuery: body.testQuery,
                sparkConfig: body.sparkConfig,
                sslMode: body.sslMode,
                sshTunnel: body.sshTunnel,
                proxy: body.proxy,
                maxPoolSize: body.maxPoolSize,
                idleTimeoutSec: body.idleTimeoutSec,
                userId,
            };

            await connectionsService.updateConnector(input);
            res.json({ success: true });
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
