import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { ILogger } from './ILogger';
import { LogLevel, LOG_LEVEL_WEIGHT, resolveLogLevel } from './LogLevel';
import { CorrelationContext } from './CorrelationContext';

/**
 * Safely serialises an Error into a plain object for structured logging.
 * Strips circular references; never leaks PII-adjacent fields.
 */
function serializeError(err: Error): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name:    err.name,
    message: err.message,
    stack:   err.stack,
  };

  // Include driver-level Postgres error codes when present (pg driver attaches these)
  const pg = err as unknown as Record<string, unknown>;
  if (pg['code'])    base['pgCode']    = pg['code'];
  if (pg['detail'])  base['pgDetail']  = pg['detail'];
  if (pg['table'])   base['pgTable']   = pg['table'];
  if (pg['schema'])  base['pgSchema']  = pg['schema'];
  if (pg['constraint']) base['pgConstraint'] = pg['constraint'];

  return base;
}

/** Fields that must never appear in logged meta (contains secrets / PII). */
const REDACT_KEYS = new Set([
  'password', 'passwd', 'secret', 'token', 'accessToken', 'refreshToken',
  'apiKey', 'api_key', 'privateKey', 'private_key', 'authorization',
  'encryptionKey', 'encryption_key', 'connectionString', 'connection_string',
]);

function redactMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
}

/**
 * Winston-backed implementation of ILogger.
 *
 * Each instance is bound to a single service name and writes exclusively
 * to that service's log file.  Correlation context (correlationId,
 * requestId, userId) is injected automatically from AsyncLocalStorage.
 */
export class WinstonLogger implements ILogger {
  private readonly winston: winston.Logger;
  private readonly minWeight: number;
  private readonly extraMeta: Record<string, unknown>;

  constructor(
    private readonly serviceName: string,
    winstonInstance: winston.Logger,
    minWeight: number,
    extraMeta: Record<string, unknown> = {},
  ) {
    this.winston   = winstonInstance;
    this.minWeight = minWeight;
    this.extraMeta = extraMeta;
  }

  // ─── ILogger implementation ────────────────────────────────────────────────

  trace(action: string, message: string, meta?: Record<string, unknown>): void {
    this.emit(LogLevel.TRACE, action, message, undefined, meta);
  }

  debug(action: string, message: string, meta?: Record<string, unknown>): void {
    this.emit(LogLevel.DEBUG, action, message, undefined, meta);
  }

  info(action: string, message: string, meta?: Record<string, unknown>): void {
    this.emit(LogLevel.INFO, action, message, undefined, meta);
  }

  warn(action: string, message: string, meta?: Record<string, unknown>): void {
    this.emit(LogLevel.WARN, action, message, undefined, meta);
  }

  error(action: string, message: string, error?: Error, meta?: Record<string, unknown>): void {
    this.emit(LogLevel.ERROR, action, message, error, meta);
  }

  fatal(action: string, message: string, error?: Error, meta?: Record<string, unknown>): void {
    this.emit(LogLevel.FATAL, action, message, error, meta);
  }

  child(extraMeta: Record<string, unknown>): ILogger {
    return new WinstonLogger(
      this.serviceName,
      this.winston,
      this.minWeight,
      { ...this.extraMeta, ...extraMeta },
    );
  }

  // ─── Internal emit ─────────────────────────────────────────────────────────

  private emit(
    level:   LogLevel,
    action:  string,
    message: string,
    error?:  Error,
    meta?:   Record<string, unknown>,
  ): void {
    if (LOG_LEVEL_WEIGHT[level] < this.minWeight) return;

    const ctx = CorrelationContext.get();

    const entry: Record<string, unknown> = {
      ts:            new Date().toISOString(),
      level,
      service:       this.serviceName,
      correlationId: ctx.correlationId,
      requestId:     ctx.requestId,
      ...(ctx.userId ? { userId: ctx.userId } : {}),
      action,
      message,
      ...(Object.keys(this.extraMeta).length > 0 ? { scope: this.extraMeta } : {}),
      ...(meta && Object.keys(meta).length > 0 ? { meta: redactMeta(meta) } : {}),
      ...(error ? { error: serializeError(error) } : {}),
    };

    // Winston level must be lowercase
    this.winston.log(level.toLowerCase(), entry);
  }
}

// ─── Winston instance factory (one per service) ────────────────────────────

const LOG_DIR          = process.env['LOG_DIR']             ?? 'logs';
const LOG_MAX_SIZE     = process.env['LOG_MAX_SIZE']         ?? '100m';
const LOG_RETENTION    = process.env['LOG_RETENTION_DAYS']   ?? '30';
const LOG_CONSOLE      = process.env['LOG_CONSOLE']          === 'true';

/**
 * Builds a Winston logger instance writing to `<LOG_DIR>/<serviceName>.log`
 * with daily rotation and optional console output.
 */
export function buildWinstonInstance(serviceName: string): winston.Logger {
  const logFile = path.join(LOG_DIR, `${serviceName}.log`);

  const fileTransport = new DailyRotateFile({
    filename:     path.join(LOG_DIR, `${serviceName}.%DATE%.log`),
    datePattern:  'YYYY-MM-DD',
    zippedArchive: true,
    maxSize:      LOG_MAX_SIZE,
    maxFiles:     `${LOG_RETENTION}d`,
    // Rotation creates a symlink to the latest file at the plain name
    symlinkName:  `${serviceName}.log`,
    createSymlink: true,
  });

  const transports: winston.transport[] = [fileTransport];

  if (LOG_CONSOLE) {
    transports.push(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf((info) => {
          const entry = info as Record<string, unknown>;
          const ts      = entry['ts']      ?? '';
          const level   = (entry['level'] as string ?? '').toUpperCase().padEnd(5);
          const service = entry['service'] ?? '';
          const action  = entry['action']  ?? '';
          const message = entry['message'] ?? '';
          return `${ts} [${level}] [${service}] ${action} — ${message}`;
        }),
      ),
    }));
  }

  return winston.createLogger({
    // Winston itself uses 'silly' as lowest; we handle gating in WinstonLogger
    level: 'silly',
    format: winston.format.combine(
      winston.format.errors({ stack: true }),
      winston.format.printf((info) => JSON.stringify(info)),
    ),
    transports,
  });
}
