import { Router } from 'express';
import { pipelineController as ctrl } from '../controllers/pipeline.controller';

const router = Router();

// ─── Pipeline CRUD ────────────────────────────────────────────────────────────
router.post('/',           (req, res, next) => ctrl.create(req, res, next));
router.get('/',            (req, res, next) => ctrl.list(req, res, next));
router.get('/:id',         (req, res, next) => ctrl.getById(req, res, next));
router.put('/:id',         (req, res, next) => ctrl.update(req, res, next));
router.delete('/:id',      (req, res, next) => ctrl.delete(req, res, next));

// ─── Validation ───────────────────────────────────────────────────────────────
router.post('/:id/validate',   (req, res, next) => ctrl.validate(req, res, next));

// ─── Code Generation ──────────────────────────────────────────────────────────
router.post('/:id/generate',   (req, res, next) => ctrl.generate(req, res, next));

// ─── Artifacts ────────────────────────────────────────────────────────────────
router.get('/:id/artifacts',                         (req, res, next) => ctrl.listArtifacts(req, res, next));
router.get('/:id/artifacts/:artifactId',             (req, res, next) => ctrl.getArtifact(req, res, next));
router.get('/:id/artifacts/:artifactId/download',    (req, res, next) => ctrl.downloadArtifact(req, res, next));

// ─── Version History ──────────────────────────────────────────────────────────
router.get('/:id/history',    (req, res, next) => ctrl.getVersionHistory(req, res, next));

// ─── Executions ───────────────────────────────────────────────────────────────
router.get('/:id/executions', (req, res, next) => ctrl.getExecutions(req, res, next));

export { router as pipelineRouter };
