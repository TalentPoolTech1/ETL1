import { Request, Response, NextFunction } from 'express';
import { executionRepository } from '../../db/repositories/execution.repository';

export class ExecutionController {
  /**
   * GET /api/executions/history/:pipelineId
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pipelineId } = req.params;
      const limit = parseInt(req.query['limit'] as string || '50', 10);
      
      const history = await executionRepository.getHistory(pipelineId, limit);
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/executions/:runId/logs
   */
  async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { runId } = req.params;
      const { level } = req.query as { level?: string };
      
      const logs = await executionRepository.getLogs(runId, level);
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }
}

export const executionController = new ExecutionController();
