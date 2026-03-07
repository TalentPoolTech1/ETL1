/**
 * ErrorClass — the seven categories every error in this platform belongs to.
 *
 * The class determines:
 *   - Which HTTP status code is sent to the caller
 *   - Which log level is used (WARN for caller errors, ERROR for system errors)
 *   - Whether an alert should fire
 */
export enum ErrorClass {
  /** Client sent invalid input. HTTP 400. Logged at WARN. */
  VALIDATION          = 'VALIDATION',

  /** Requested resource does not exist. HTTP 404. Logged at WARN. */
  NOT_FOUND           = 'NOT_FOUND',

  /** Action violates a business or data-integrity rule. HTTP 409. Logged at WARN. */
  CONFLICT            = 'CONFLICT',

  /** Identity not established (missing / expired / invalid token). HTTP 401. Logged at WARN. */
  AUTHENTICATION      = 'AUTHENTICATION',

  /** Identity established but role does not permit the operation. HTTP 403. Logged at WARN. */
  AUTHORIZATION       = 'AUTHORIZATION',

  /** A downstream system (DB, Spark, object storage) failed. HTTP 503. Logged at ERROR. Alertable. */
  EXTERNAL_DEPENDENCY = 'EXTERNAL_DEPENDENCY',

  /** Unexpected programmer error / unhandled exception. HTTP 500. Logged at ERROR. Alertable. */
  INTERNAL            = 'INTERNAL',
}

/** HTTP status code for each error class. */
export const ERROR_CLASS_HTTP_STATUS: Record<ErrorClass, number> = {
  [ErrorClass.VALIDATION]:          400,
  [ErrorClass.NOT_FOUND]:           404,
  [ErrorClass.CONFLICT]:            409,
  [ErrorClass.AUTHENTICATION]:      401,
  [ErrorClass.AUTHORIZATION]:       403,
  [ErrorClass.EXTERNAL_DEPENDENCY]: 503,
  [ErrorClass.INTERNAL]:            500,
};
