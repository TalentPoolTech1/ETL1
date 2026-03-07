import { ErrorClass, ERROR_CLASS_HTTP_STATUS } from './ErrorClass';

/** Shape of the JSON body sent to the API caller on any error response. */
export interface ApiErrorResponse {
  success:        false;
  errorCode:      string;
  errorClass:     ErrorClass;
  message:        string;
  correlationId:  string;
  fieldErrors?:   FieldError[];
}

export interface FieldError {
  field:   string;
  message: string;
}

export interface AppErrorOptions {
  /** Stable catalog code, e.g. "CONN-003". */
  code: string;

  /** Classification drives HTTP status and log level. */
  errorClass: ErrorClass;

  /** What the API consumer sees. Plain English. No internals. */
  userMessage: string;

  /** What goes into the log file. Full technical detail. */
  internalMessage: string;

  /**
   * Dot-notation action name matching the logging convention: <service>.<verb>.
   * Optional — the global error handler can fill this from the route if omitted.
   */
  action?: string;

  /** Structured context for the log. No PII, no secrets. */
  meta?: Record<string, unknown>;

  /** The original raw error that caused this (DB error, fetch error, etc.). */
  cause?: Error;

  /** Per-field validation messages (VALIDATION class only). */
  fieldErrors?: FieldError[];
}

/**
 * AppError — the canonical error type for the entire ETL1 platform.
 *
 * All service code throws AppError instances.
 * Raw exceptions from ORMs / drivers / libraries are caught at the
 * domain service boundary and wrapped into an AppError before propagating.
 *
 * The global error handler middleware (errorHandler.middleware.ts) is the
 * only place that reads an AppError and writes an HTTP response.
 */
export class AppError extends Error {
  readonly code:            string;
  readonly errorClass:      ErrorClass;
  readonly httpStatus:      number;
  readonly userMessage:     string;
  readonly internalMessage: string;
  readonly action:          string;
  readonly meta:            Record<string, unknown>;
  readonly cause?:          Error;
  readonly fieldErrors:     FieldError[];

  /**
   * true for EXTERNAL_DEPENDENCY and INTERNAL — these should trigger an alert
   * in the observability layer.
   */
  readonly alertable: boolean;

  constructor(opts: AppErrorOptions) {
    super(opts.internalMessage);
    this.name            = 'AppError';
    this.code            = opts.code;
    this.errorClass      = opts.errorClass;
    this.httpStatus      = ERROR_CLASS_HTTP_STATUS[opts.errorClass];
    this.userMessage     = opts.userMessage;
    this.internalMessage = opts.internalMessage;
    this.action          = opts.action ?? 'unknown.unknown';
    this.meta            = opts.meta ?? {};
    this.cause           = opts.cause;
    this.fieldErrors     = opts.fieldErrors ?? [];
    this.alertable       = (
      opts.errorClass === ErrorClass.EXTERNAL_DEPENDENCY ||
      opts.errorClass === ErrorClass.INTERNAL
    );

    // Preserve the original stack if available
    if (opts.cause?.stack) {
      this.stack = `${this.stack}\nCaused by: ${opts.cause.stack}`;
    }
  }

  /**
   * Serialises to the API response body.
   * `correlationId` is injected by the error handler (from CorrelationContext).
   */
  toApiResponse(correlationId: string): ApiErrorResponse {
    const base: ApiErrorResponse = {
      success:       false,
      errorCode:     this.code,
      errorClass:    this.errorClass,
      message:       this.userMessage.replace('{correlationId}', correlationId),
      correlationId,
    };

    if (this.fieldErrors.length > 0) {
      base.fieldErrors = this.fieldErrors;
    }

    return base;
  }
}
