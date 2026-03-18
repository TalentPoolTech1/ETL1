import { Request, Response, NextFunction } from 'express';
import { codegenService } from '../../codegen/codegen.service';
import { pipelineRepository } from '../../db/repositories/pipeline.repository';
import { artifactRepository } from '../../db/repositories/artifact.repository';
import { PipelineDefinition } from '../../codegen/core/types/pipeline.types';
import { GenerationOptions, GeneratedArtifact } from '../../codegen/core/interfaces/engine.interfaces';
import { v4 as uuidv4 } from 'uuid';

// ─── Pipeline Controller ──────────────────────────────────────────────────────

export class PipelineController {

  // POST /api/pipelines
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as { pipeline: PipelineDefinition };
      if (!body.pipeline) { res.status(400).json({ error: '"pipeline" is required' }); return; }

      const pipeline = { ...body.pipeline, id: body.pipeline.id || uuidv4() };

      // Validate before persisting
      const validation = codegenService.validate(pipeline);
      if (!validation.valid) {
        res.status(422).json({ error: 'Pipeline validation failed', details: validation.errors });
        return;
      }

      const row = await pipelineRepository.create(pipeline, req.headers['x-user-id'] as string);
      res.status(201).json({ success: true, pipeline: row });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/pipelines
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { technology, search, limit, offset, orderBy, orderDir } = req.query as Record<string, string>;
      const allowedOrderColumns = new Set(['name', 'created_at', 'updated_at']);
      const safeOrderBy = allowedOrderColumns.has(orderBy) ? orderBy : 'updated_at';
      const safeOrderDir = orderDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const result = await pipelineRepository.list({
        technology, search,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        orderBy: safeOrderBy as 'name' | 'created_at' | 'updated_at',
        orderDir: safeOrderDir,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/pipelines/:id
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const row = await pipelineRepository.findById(req.params['id']!);
      if (!row) { res.status(404).json({ error: 'Pipeline not found' }); return; }
      res.json({ success: true, pipeline: row });
    } catch (err) {
      next(err);
    }
  }

  // PUT /api/pipelines/:id
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pipeline, changeSummary } = req.body as { pipeline: PipelineDefinition; changeSummary?: string };
      if (!pipeline) { res.status(400).json({ error: '"pipeline" is required' }); return; }

      const validation = codegenService.validate(pipeline);
      if (!validation.valid) {
        res.status(422).json({ error: 'Validation failed', details: validation.errors });
        return;
      }

      const row = await pipelineRepository.update(
        req.params['id']!, pipeline, changeSummary,
        req.headers['x-user-id'] as string
      );
      if (!row) { res.status(404).json({ error: 'Pipeline not found' }); return; }
      res.json({ success: true, pipeline: row });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/pipelines/:id
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await pipelineRepository.softDelete(req.params['id']!, req.headers['x-user-id'] as string);
      if (!deleted) { res.status(404).json({ error: 'Pipeline not found' }); return; }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/pipelines/:id/generate
  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const row = await pipelineRepository.findById(req.params['id']!);
      if (!row) { res.status(404).json({ error: 'Pipeline not found' }); return; }

      const options = (req.body?.options ?? {}) as GenerationOptions;
      const artifact = await codegenService.generate(row.definition, options);

      // Persist artifact
      const savedArtifact = await artifactRepository.save(
        artifact, options, req.headers['x-user-id'] as string
      );

      // Prune old artifacts (keep latest 10)
      await artifactRepository.deleteOldArtifacts(row.id, 10);

      res.json({ success: true, artifactId: savedArtifact.id, artifact });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('validation failed')) { res.status(422).json({ success: false, error: msg }); return; }
      next(err);
    }
  }

  // GET /api/pipelines/:id/artifacts
  async listArtifacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const artifacts = await artifactRepository.findAllForPipeline(
        req.params['id']!, parseInt(req.query['limit'] as string ?? '10', 10)
      );
      res.json({ success: true, artifacts });
    } catch (err) { next(err); }
  }

  // GET /api/pipelines/:id/artifacts/:artifactId
  async getArtifact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const artifact = await artifactRepository.findById(req.params['artifactId']!);
      if (!artifact || artifact.pipeline_id !== req.params['id']) {
        res.status(404).json({ error: 'Artifact not found' }); return;
      }
      res.json({ success: true, artifact });
    } catch (err) { next(err); }
  }

  // GET /api/pipelines/:id/artifacts/:artifactId/download
  async downloadArtifact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const artifact = await artifactRepository.findById(req.params['artifactId']!);
      if (!artifact || artifact.pipeline_id !== req.params['id']) {
        res.status(404).json({ error: 'Artifact not found' }); return;
      }

      const fileIndex = parseInt(req.query['fileIndex'] as string ?? '0', 10);
      const files = artifact.files as GeneratedArtifact['files'];

      if (fileIndex >= files.length) {
        res.status(404).json({ error: 'File index out of range' }); return;
      }

      const file = files[fileIndex]!;
      const contentType = file.language === 'python' ? 'text/x-python'
        : file.language === 'scala' ? 'text/x-scala'
        : 'text/plain';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      res.send(file.content);
    } catch (err) { next(err); }
  }

  // GET /api/pipelines/:id/history
  async getVersionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const history = await pipelineRepository.getVersionHistory(req.params['id']!);
      res.json({ success: true, versions: history });
    } catch (err) { next(err); }
  }

  // GET /api/pipelines/:id/executions
  async getExecutions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const executions = await artifactRepository.getExecutionHistory(req.params['id']!);
      res.json({ success: true, executions });
    } catch (err) { next(err); }
  }

  // POST /api/pipelines/:id/validate
  async validate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const row = await pipelineRepository.findById(req.params['id']!);
      if (!row) { res.status(404).json({ error: 'Pipeline not found' }); return; }
      const result = codegenService.validate(row.definition);
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }
}

export const pipelineController = new PipelineController();
