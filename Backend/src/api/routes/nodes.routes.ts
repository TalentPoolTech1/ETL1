import { Router, Request, Response, NextFunction } from 'express';
import { userIdMiddleware } from '../middleware/user-id.middleware';

const router = Router();
router.use(userIdMiddleware);

router.get('/:nodeId/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nodeId = req.params['nodeId']!;
    const limitRaw = Number.parseInt(String(req.query['limit'] ?? '100'), 10);
    const limit = Number.isNaN(limitRaw) ? 100 : Math.min(Math.max(limitRaw, 1), 1000);

    // Runtime row-level node preview is not implemented yet. We return an
    // explicit unavailable contract so UI behavior is deterministic.
    return res.json({
      success: true,
      data: {
        nodeId,
        pipelineId: null,
        pipelineName: null,
        previewAvailable: false,
        availabilityReason: 'Row-level preview is not implemented yet for this node.',
        rows: [],
        columns: [],
        totalRows: 0,
        requestedLimit: limit,
      },
    });
  } catch (err) {
    return next(err);
  }
});

export { router as nodesRouter };
