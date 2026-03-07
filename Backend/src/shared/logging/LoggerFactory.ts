import { ILogger } from './ILogger';
import { WinstonLogger, buildWinstonInstance } from './WinstonLogger';
import { resolveLogLevel, LOG_LEVEL_WEIGHT } from './LogLevel';

/**
 * Valid service names.  Every logger must use one of these names so that
 * log file routing is predictable and auditable.
 */
export type ServiceName =
  | 'users'
  | 'connections'
  | 'metadata'
  | 'pipelines'
  | 'executions'
  | 'orchestrators'
  | 'codegen'
  | 'governance'
  | 'api'
  | 'db';

/**
 * LoggerFactory — the single entry point for obtaining a logger.
 *
 * Usage (at the top of any service file):
 *   import { LoggerFactory } from '@shared/logging';
 *   const log = LoggerFactory.get('connections');
 *
 * Each service name maps to exactly one log file.
 * Calls with the same name return the cached instance.
 */
class LoggerFactoryClass {
  private readonly cache = new Map<ServiceName, ILogger>();
  private readonly minWeight: number;

  constructor() {
    const level     = resolveLogLevel(process.env['LOG_LEVEL']);
    this.minWeight  = LOG_LEVEL_WEIGHT[level];
  }

  get(serviceName: ServiceName): ILogger {
    const cached = this.cache.get(serviceName);
    if (cached) return cached;

    const winstonInstance = buildWinstonInstance(serviceName);
    const logger = new WinstonLogger(serviceName, winstonInstance, this.minWeight);

    this.cache.set(serviceName, logger);
    return logger;
  }
}

export const LoggerFactory = new LoggerFactoryClass();
