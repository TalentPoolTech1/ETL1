import { AppError } from '../AppError';
import { ErrorClass } from '../ErrorClass';

/** SYS — System / Infrastructure error factories */
export const sysErrors = {

  databaseUnavailable(cause: Error): AppError {
    return new AppError({
      code:            'SYS-001',
      errorClass:      ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage:     'The database is temporarily unavailable. Please try again in a moment. (Ref: {correlationId})',
      internalMessage: 'PostgreSQL connection pool exhausted or connection refused',
      action:          'db.connect',
      cause,
    });
  },

  externalServiceUnavailable(serviceName: string, cause: Error): AppError {
    return new AppError({
      code:            'SYS-002',
      errorClass:      ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage:     'A required external service is temporarily unavailable. Please try again. (Ref: {correlationId})',
      internalMessage: `External dependency "${serviceName}" is unavailable`,
      action:          'sys.externalCall',
      meta:            { dependencyName: serviceName },
      cause,
    });
  },

  unexpected(cause: Error): AppError {
    return new AppError({
      code:            'SYS-003',
      errorClass:      ErrorClass.INTERNAL,
      userMessage:     'An unexpected error occurred. Please try again. If this persists, contact support with reference {correlationId}.',
      internalMessage: 'Unhandled exception reached the global error handler',
      action:          'sys.unknown',
      cause,
    });
  },

  configurationError(detail: string): AppError {
    return new AppError({
      code:            'SYS-004',
      errorClass:      ErrorClass.INTERNAL,
      userMessage:     'Request processing failed due to an internal configuration error. (Ref: {correlationId})',
      internalMessage: `Runtime configuration error: ${detail}`,
      action:          'sys.config',
    });
  },

  routeNotFound(method: string, path: string): AppError {
    return new AppError({
      code:            'SYS-404',
      errorClass:      ErrorClass.NOT_FOUND,
      userMessage:     `Route not found: ${method} ${path}`,
      internalMessage: `No route matched ${method} ${path}`,
      action:          'api.notFound',
      meta:            { method, path },
    });
  },
};
