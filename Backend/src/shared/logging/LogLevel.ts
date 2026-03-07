/**
 * Log level enumeration and numeric threshold helpers.
 * Levels are ordered by verbosity — lower numeric = more verbose.
 */

export enum LogLevel {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  INFO  = 'INFO',
  WARN  = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

/** Numeric weight for each level — used to compare against the configured minimum. */
export const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  [LogLevel.TRACE]: 10,
  [LogLevel.DEBUG]: 20,
  [LogLevel.INFO]:  30,
  [LogLevel.WARN]:  40,
  [LogLevel.ERROR]: 50,
  [LogLevel.FATAL]: 60,
};

/**
 * Resolve a LogLevel from an environment variable string.
 * Falls back to INFO if the value is absent or unrecognised.
 */
export function resolveLogLevel(raw: string | undefined): LogLevel {
  if (!raw) return LogLevel.INFO;
  const upper = raw.toUpperCase() as LogLevel;
  if (Object.values(LogLevel).includes(upper)) return upper;
  return LogLevel.INFO;
}
