import { Router, Request, Response, NextFunction } from 'express';
import { codegenService } from '../../codegen/codegen.service';
import { PipelineDefinition } from '../../codegen/core/types/pipeline.types';
import { GenerationOptions } from '../../codegen/core/interfaces/engine.interfaces';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();

// POST /api/codegen/generate — Body: { pipeline, options } — Returns: GeneratedArtifact
router.post('/generate', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pipeline, options } = req.body as {
      pipeline: PipelineDefinition;
      options?: GenerationOptions;
    };

    if (!pipeline) {
      return res.status(400).json({ error: 'Request body must include "pipeline"' });
    }

    const artifact = await codegenService.generate(pipeline, options);

    return res.status(200).json({
      success: true,
      artifact,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Validation errors are client errors, not 500
    if (message.includes('validation failed')) {
      return res.status(422).json({ success: false, error: message });
    }
    return next(err);
  }
});

// POST /api/codegen/validate — Validate pipeline definition only (no code generation).
router.post('/validate', requirePermission('PIPELINE_VIEW'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pipeline } = req.body as { pipeline: PipelineDefinition };

    if (!pipeline) {
      return res.status(400).json({ error: 'Request body must include "pipeline"' });
    }

    const result = codegenService.validate(pipeline);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return next(err);
  }
});

// GET /api/codegen/technologies — Returns list of supported technologies.
router.get('/technologies', requirePermission('PIPELINE_VIEW'), (_req: Request, res: Response) => {
  const technologies = codegenService.listTechnologies();
  return res.status(200).json({ technologies });
});

// POST /api/codegen/preview — Generate code and return only the primary script (for UI preview).
router.post('/preview', requirePermission('PIPELINE_VIEW'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pipeline, options } = req.body as {
      pipeline: PipelineDefinition;
      options?: GenerationOptions;
    };

    if (!pipeline) {
      return res.status(400).json({ error: 'Request body must include "pipeline"' });
    }

    const artifact = await codegenService.generate(pipeline, {
      ...options,
      includeComments: true,
      includeLogging: true,
    });

    const primaryFile = artifact.files.find(f => f.isEntryPoint);

    return res.status(200).json({
      success: true,
      preview: primaryFile?.content ?? '',
      language: primaryFile?.language ?? 'python',
      warnings: artifact.metadata.warnings,
    });
  } catch (err) {
    return next(err);
  }
});

export { router as codegenRouter };
