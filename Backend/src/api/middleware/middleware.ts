import { Request, Response, NextFunction } from 'express';

/**
 * pipelineBodyGuard — rejects requests whose Content-Length exceeds 5 MB
 * before Express parses the body.  Kept here as a route-specific guard
 * applied only to the codegen and pipeline routes.
 *
 * All other middleware (correlation, request logging, error handling) has
 * been moved to dedicated files:
 *   - correlation.middleware.ts
 *   - request-logger.middleware.ts
 *   - @shared/errors/errorHandler.middleware.ts
 */
export function pipelineBodyGuard(req: Request, res: Response, next: NextFunction): void {
  const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
  const maxBytes = 5 * 1024 * 1024; // 5 MB
  if (contentLength > maxBytes) {
    res.status(413).json({
      success:    false,
      errorCode:  'SYS-413',
      errorClass: 'VALIDATION',
      message:    'Request body too large. Maximum allowed size is 5 MB.',
    });
    return;
  }
  next();
}
