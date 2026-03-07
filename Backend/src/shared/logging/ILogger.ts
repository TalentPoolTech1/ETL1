/**
 * ILogger — the single interface every logger in this platform must satisfy.
 *
 * Rules:
 *  - `action`  must be in <service>.<verb> format  (e.g. "connections.create")
 *  - `meta`    must never contain PII or secrets
 *  - `error`   is the original Error object (cause) — logged internally, never sent to the API caller
 *  - `child()` returns a new ILogger with extra fields merged into every log line it emits
 */
export interface ILogger {
  trace(action: string, message: string, meta?: Record<string, unknown>): void;
  debug(action: string, message: string, meta?: Record<string, unknown>): void;
  info (action: string, message: string, meta?: Record<string, unknown>): void;
  warn (action: string, message: string, meta?: Record<string, unknown>): void;
  error(action: string, message: string, error?: Error, meta?: Record<string, unknown>): void;
  fatal(action: string, message: string, error?: Error, meta?: Record<string, unknown>): void;

  /**
   * Returns a scoped child logger that automatically merges `extraMeta` into
   * every log line it emits. Useful for pinning a pipelineId, runId, etc.
   * across a block of code without repeating it in every call.
   */
  child(extraMeta: Record<string, unknown>): ILogger;
}
