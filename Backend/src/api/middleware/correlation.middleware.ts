import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CorrelationContext } from '@shared/logging';

/**
 * Correlation middleware — must be registered FIRST in the Express stack.
 *
 * Reads or generates a correlationId from the incoming request header
 * `X-Correlation-Id`, generates a fresh requestId, and runs the rest of
 * the request inside an AsyncLocalStorage context so that every logger
 * in the async chain can read them without any function-argument plumbing.
 *
 * The correlationId is echoed back in the response header so callers can
 * propagate it through their own systems.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId =
    (req.headers['x-correlation-id'] as string | undefined) ?? uuidv4();
  const requestId = uuidv4();

  // Stamp both IDs onto the response so the caller can log / display them
  res.setHeader('X-Correlation-Id', correlationId);
  res.setHeader('X-Request-Id',     requestId);

  // Also make them available on the request object for downstream middleware
  req.headers['x-correlation-id'] = correlationId;
  req.headers['x-request-id']     = requestId;

  // Extract userId from JWT payload if auth middleware has already run.
  // Auth middleware is expected to set req.user = { userId: string }.
  const userId = (req as Request & { user?: { userId?: string } }).user?.userId;

  CorrelationContext.run({ correlationId, requestId, userId }, next);
}
