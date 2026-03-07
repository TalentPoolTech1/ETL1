import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from './AppError';
import { AppErrors } from './AppErrors';
import { ErrorClass } from './ErrorClass';
import { LoggerFactory, CorrelationContext } from '@shared/logging';

/**
 * Global error handler middleware.
 *
 * This is the ONLY place in the application that:
 *   1. Catches errors thrown by any route / service
 *   2. Wraps raw (non-AppError) exceptions into SYS-003
 *   3. Logs the error at the correct level to the correct service log file
 *   4. Sends the sanitised API error response to the caller
 *
 * Service catch blocks must throw only — they must NOT log and must NOT call res.json().
 *
 * Registration: app.use(globalErrorHandler) — must be the LAST middleware registered.
 */
export const globalErrorHandler: ErrorRequestHandler = (
  err:  unknown,
  req:  Request,
  res:  Response,
  _next: NextFunction,
): void => {
  // Normalise to AppError — anything that is not already an AppError becomes SYS-003
  let appError: AppError;
  if (err instanceof AppError) {
    appError = err;
  } else {
    const rawError = err instanceof Error ? err : new Error(String(err));
    appError = AppErrors.sys.unexpected(rawError);
  }

  // Determine which service log file to write to based on the route prefix
  const routePrefix = req.path.split('/')[2] ?? 'api'; // e.g. /api/connections/… → "connections"
  const serviceMap: Record<string, Parameters<typeof LoggerFactory.get>[0]> = {
    connections:    'connections',
    pipelines:      'pipelines',
    executions:     'executions',
    orchestrators:  'orchestrators',
    'node-templates': 'metadata',
    codegen:        'codegen',
    users:          'users',
    governance:     'governance',
  };
  const serviceName = serviceMap[routePrefix] ?? 'api';
  const log = LoggerFactory.get(serviceName);

  const action = appError.action !== 'unknown.unknown'
    ? appError.action
    : `${serviceName}.${req.method.toLowerCase()}`;

  // Log at the appropriate level
  if (
    appError.errorClass === ErrorClass.EXTERNAL_DEPENDENCY ||
    appError.errorClass === ErrorClass.INTERNAL
  ) {
    log.error(action, appError.internalMessage, appError.cause, {
      errorCode: appError.code,
      ...appError.meta,
    });
  } else {
    log.warn(action, appError.internalMessage, {
      errorCode: appError.code,
      ...appError.meta,
    });
  }

  const { correlationId } = CorrelationContext.get();

  res.status(appError.httpStatus).json(appError.toApiResponse(correlationId));
};

/**
 * 404 handler — registered before globalErrorHandler but after all routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const log = LoggerFactory.get('api');
  log.warn('api.notFound', `Route not found: ${req.method} ${req.path}`);

  const { correlationId } = CorrelationContext.get();
  const appError = AppErrors.sys.routeNotFound(req.method, req.path);

  res.status(appError.httpStatus).json(appError.toApiResponse(correlationId));
}
