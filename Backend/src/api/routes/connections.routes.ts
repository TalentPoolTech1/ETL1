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

import { Router } from 'express';
import { ConnectionsController } from '../controllers/connections.controller';
import { ConnectorRegistry } from '../../connectors/ConnectorRegistry';
import { userIdMiddleware } from '../middleware/user-id.middleware';

const router = Router();
const ctrl = new ConnectionsController();

// Apply userId extraction to all connections routes
router.use(userIdMiddleware);

// ---------------------------------------------------------------------------
// Static routes must come before /:id to avoid shadowing
// ---------------------------------------------------------------------------

/** Returns all registered connector types with their schemas for the dynamic UI form */
router.get('/types', (_req, res) => {
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
router.post('/',    (req, res, next) => ctrl.create(req, res, next));
router.get('/',     (req, res, next) => ctrl.list(req, res, next));
router.get('/:id',  (req, res, next) => ctrl.getById(req, res, next));
router.put('/:id',  (req, res, next) => ctrl.update(req, res, next));
router.delete('/:id', (req, res, next) => ctrl.delete(req, res, next));

// ---------------------------------------------------------------------------
// Test & Health
// ---------------------------------------------------------------------------
router.post('/:id/test',   (req, res, next) => ctrl.testConnection(req, res, next));
router.get('/:id/health',  (req, res, next) => ctrl.getHealth(req, res, next));

// ---------------------------------------------------------------------------
// Metadata browsing (lazy-load hierarchy for Metadata Service)
// ---------------------------------------------------------------------------
router.get('/:id/databases',           (req, res, next) => ctrl.listDatabases(req, res, next));
router.get('/:id/schemas',             (req, res, next) => ctrl.listSchemas(req, res, next));
router.get('/:id/tables',              (req, res, next) => ctrl.listTables(req, res, next));
router.get('/:id/tables/:table',       (req, res, next) => ctrl.describeTable(req, res, next));

export default router;
