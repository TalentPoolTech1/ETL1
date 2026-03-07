import { Request, Response, NextFunction } from 'express';
import { LoggerFactory } from '@shared/logging';

const log = LoggerFactory.get('api');

/**
 * HTTP request / response logger.
 *
 * Logs every inbound request at TRACE level and the corresponding outgoing
 * response at INFO / WARN / ERROR level depending on the HTTP status code.
 * Timing (durationMs) is included on every response log line.
 *
 * Must be registered AFTER correlationMiddleware so that correlationId and
 * requestId are already in the AsyncLocalStorage context.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startMs = Date.now();
  const { method, url } = req;

  log.trace('api.request', `${method} ${url}`, {
    method,
    url,
    contentLength: req.headers['content-length'] ?? 0,
    userAgent:     req.headers['user-agent'] ?? '',
  });

  res.on('finish', () => {
    const durationMs = Date.now() - startMs;
    const status     = res.statusCode;
    const meta       = { method, url, status, durationMs };

    if (status >= 500) {
      log.error('api.response', `${method} ${url} → ${status}`, undefined, meta);
    } else if (status >= 400) {
      log.warn('api.response', `${method} ${url} → ${status}`, meta);
    } else {
      log.info('api.response', `${method} ${url} → ${status}`, meta);
    }
  });

  next();
}
