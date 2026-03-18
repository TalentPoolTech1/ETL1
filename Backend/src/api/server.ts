import 'dotenv/config';
import express from 'express';
import { codegenRouter }      from './routes/codegen.routes';
import { pipelineRouter }     from './routes/pipeline.routes';
import { nodeTemplateRouter } from './routes/node-template.routes';
import connectionsRouter       from './routes/connections.routes';
import { projectsRouter }     from './routes/projects.routes';
import { orchestratorsRouter } from './routes/orchestrators.routes';
import { executionsRouter }   from './routes/executions.routes';
import { authRouter }         from './routes/auth.routes';
import { governanceRouter }   from './routes/governance.routes';
import { foldersRouter }      from './routes/folders.routes';
import { nodesRouter }        from './routes/nodes.routes';
import { authGuard }          from './middleware/auth.middleware';
import { pipelineBodyGuard }  from './middleware/middleware';
import { correlationMiddleware }    from './middleware/correlation.middleware';
import { requestLoggerMiddleware }  from './middleware/request-logger.middleware';
import { globalErrorHandler, notFoundHandler } from '@shared/errors';
import { LoggerFactory } from '@shared/logging';
import { db }                 from '../db/connection';
import { runMigrations }      from '../db/migration-runner';
import { codegenService }     from '../codegen/codegen.service';
import { nodeTemplateRepository } from '../db/repositories/node-template.repository';

const log = LoggerFactory.get('api');

// ─── Express App ───────────────────────────────────────────────────────────────

export function createApp(): express.Application {
  const app = express();

  // ─── Core Middleware ────────────────────────────────────────────────────────
  // correlationMiddleware MUST be first — it seeds AsyncLocalStorage for all loggers
  app.use(correlationMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // CORS
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env['CORS_ORIGIN'] ?? '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-User-Id,X-Mock-User-ID,X-Request-Id,X-Correlation-Id');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  // ─── Health Check ────────────────────────────────────────────────────────────
  app.get('/health', async (_req, res) => {
    const dbHealthy = await db.healthCheck();
    const status = dbHealthy ? 200 : 503;
    res.status(status).json({
      status:       dbHealthy ? 'healthy' : 'degraded',
      db:           dbHealthy,
      technologies: codegenService.listTechnologies(),
      timestamp:    new Date().toISOString(),
    });
  });

  // ─── Auth Routes (unprotected) ───────────────────────────────────────────────
  app.use('/api/auth', authRouter);

  // ─── Auth Guard — protects all /api/* routes below ────────────────────────
  app.use('/api', authGuard);

  // ─── API Routes ──────────────────────────────────────────────────────────────
  app.use('/api/connections',    connectionsRouter);
  app.use('/api/codegen',        pipelineBodyGuard, codegenRouter);
  app.use('/api/pipelines',      pipelineRouter);
  app.use('/api/node-templates', nodeTemplateRouter);
  app.use('/api/projects',       projectsRouter);
  app.use('/api/orchestrators',  orchestratorsRouter);
  app.use('/api/executions',     executionsRouter);
  app.use('/api/governance',     governanceRouter);
  app.use('/api/folders',        foldersRouter);
  app.use('/api/nodes',          nodesRouter);

  // ─── API Info ────────────────────────────────────────────────────────────────
  app.get('/api', (_req, res) => {
    res.json({
      name:         'ETL Code Generation Engine API',
      version:      '1.0.0',
      technologies: codegenService.listTechnologies(),
    });
  });

  // ─── Error Handlers — must be last ───────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}

// ─── Server Startup ───────────────────────────────────────────────────────────

async function startServer(): Promise<void> {
  const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

  log.info('api.startup', 'Initialising code generation engine');
  codegenService.initialize();
  log.info('api.startup', 'Engine initialised', {
    technologies: codegenService.listTechnologies(),
  });

  log.info('api.startup', 'Connecting to database');
  db.initializeFromEnv();
  await runMigrations();

  await nodeTemplateRepository.seedBuiltInTemplates();
  log.info('api.startup', 'Node templates seeded');

  const app = createApp();
  app.listen(PORT, () => {
    log.info('api.startup', `ETL Code Generation Engine listening`, { port: PORT });
  });
}

if (require.main === module) {
  startServer().catch(err => {
    // Use console.error here only because LoggerFactory may not yet be initialised
    // at the point of a fatal startup crash.
    console.error('[FATAL] Startup failed:', err);
    process.exit(1);
  });
}
