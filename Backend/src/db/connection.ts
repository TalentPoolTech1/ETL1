import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { LoggerFactory } from '../shared/logging';

const log = LoggerFactory.get('db');

// ─── DB Config ────────────────────────────────────────────────────────────────

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  ssl?: boolean;
}

// ─── DB Connection ────────────────────────────────────────────────────────────

class Database {
  private pool: Pool | null = null;

  initialize(config: DbConfig): void {
    if (this.pool) return;

    this.pool = new Pool({
      host:             config.host,
      port:             config.port,
      database:         config.database,
      user:             config.user,
      password:         config.password,
      max:              config.max ?? 20,
      idleTimeoutMillis: config.idleTimeoutMs ?? 30000,
      connectionTimeoutMillis: config.connectionTimeoutMs ?? 5000,
      ssl:              config.ssl ? { rejectUnauthorized: false } : false,
    });

    this.pool.on('error', (err) => {
      log.error('db.pool.error', 'Unexpected idle client error in pool', err as Error);
    });
  }

  initializeFromEnv(): void {
    this.initialize({
      host:     process.env['DB_HOST']     ?? 'localhost',
      port:     parseInt(process.env['DB_PORT'] ?? '5432', 10),
      database: process.env['DB_NAME']     ?? 'etl_platform',
      user:     process.env['DB_USER']     ?? 'postgres',
      password: process.env['DB_PASSWORD'] ?? '',
      max:      parseInt(process.env['DB_POOL_MAX'] ?? '20', 10),
      ssl:      process.env['DB_SSL'] === 'true',
    });
  }

  private getPool(): Pool {
    if (!this.pool) {
      this.initializeFromEnv();
    }
    return this.pool!;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    return this.getPool().query<T>(sql, params);
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<T | null> {
    const result = await this.query<T>(sql, params);
    return result.rows[0] ?? null;
  }

  async queryMany<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const result = await this.query<T>(sql, params);
    return result.rows;
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

// Singleton
export const db = new Database();
