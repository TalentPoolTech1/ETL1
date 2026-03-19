/**
 * MetadataIntrospectionService
 *
 * Connects to source systems (files, databases) and:
 *   1. Discovers available schemas / tables
 *   2. Introspects column-level structure
 *   3. Registers datasets + columns in the catalog via pr_register_dataset / pr_sync_dataset_columns
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { Client as PgClient } from 'pg';
import { createConnection as mysqlConnect } from 'mysql2/promise';
import * as mssql from 'mssql';
import oracledb from 'oracledb';
import * as parquet from 'parquetjs-lite';
import avro from 'avro-js';
import { db } from '../db/connection';
import { LoggerFactory } from '../shared/logging';
import type { ConnectorConfig, ConnectorSecrets } from '../connectors/IConnectorPlugin';

const log = LoggerFactory.get('metadata');

const FILE_TYPE_CODES = new Set(['FILE_CSV', 'CSV', 'FILE_JSON', 'JSON', 'FILE_XML', 'XML',
    'FILE_PARQUET', 'PARQUET', 'FILE_AVRO', 'AVRO', 'FILE_ORC', 'ORC']);

const DB_TYPE_CODES = new Set(['POSTGRESQL', 'JDBC_POSTGRESQL', 'MYSQL', 'JDBC_MYSQL', 'SQLSERVER', 'JDBC_SQLSERVER',
    'ORACLE', 'JDBC_ORACLE', 'REDSHIFT', 'BIGQUERY', 'DATABRICKS', 'SNOWFLAKE', 'MARIADB', 'DB2', 'HIVE', 'DELTA_LAKE', 'ICEBERG']);

// ─── Type helpers ────────────────────────────────────────────────────────────

export interface SchemaEntry { schemaName: string; tableCount?: number }
export interface TableEntry { tableName: string; tableType: string; estimatedRowCount?: number }
export interface ColumnEntry { columnName: string; dataType: string; nullable: boolean; ordinalPosition: number }
export interface ImportResult { imported: number; skipped: number; errors: string[] }

// ─── CSV header introspection ─────────────────────────────────────────────────

async function inferCsvSchema(filePath: string, delimiter = ','): Promise<ColumnEntry[]> {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
        let headerLine: string | null = null;
        let sampleLines: string[] = [];
        let lineCount = 0;

        rl.on('line', (line) => {
            if (!headerLine) { headerLine = line; return; }
            if (lineCount < 10) sampleLines.push(line);
            lineCount++;
            if (lineCount >= 10) rl.close();
        });
        rl.on('close', () => {
            if (!headerLine) return resolve([]);
            const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
            // Infer type by sampling up to 10 rows
            const samples: string[][] = sampleLines.map(l =>
                l.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''))
            );
            const columns: ColumnEntry[] = headers.map((colName, i) => {
                const values = samples.map(r => r[i] ?? '').filter(v => v !== '' && v !== 'null' && v !== 'NULL');
                const dataType = inferDataType(values);
                return { columnName: colName, dataType, nullable: true, ordinalPosition: i + 1 };
            });
            resolve(columns);
        });
        rl.on('error', reject);
        stream.on('error', reject);
    });
}

function inferDataType(values: string[]): string {
    if (values.length === 0) return 'STRING';
    const isInt = values.every(v => /^-?\d+$/.test(v));
    if (isInt) return 'BIGINT';
    const isFloat = values.every(v => /^-?\d+(\.\d+)?$/.test(v));
    if (isFloat) return 'DOUBLE';
    const isBool = values.every(v => /^(true|false|yes|no|0|1)$/i.test(v));
    if (isBool) return 'BOOLEAN';
    const isDate = values.every(v => /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?/.test(v));
    if (isDate) return values.some(v => /T\d{2}:\d{2}/.test(v)) ? 'TIMESTAMP' : 'DATE';
    return 'STRING';
}

// ─── PostgreSQL introspection ─────────────────────────────────────────────────

async function pgListSchemas(config: ConnectorConfig, secrets: ConnectorSecrets): Promise<SchemaEntry[]> {
    const client = buildPgClient(config, secrets);
    try {
        await client.connect();
        const res = await client.query(`
            SELECT schema_name,
                   (SELECT count(*) FROM information_schema.tables t
                    WHERE t.table_schema = s.schema_name AND t.table_type IN ('BASE TABLE','VIEW'))::int AS table_count
            FROM information_schema.schemata s
            WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
              AND schema_name NOT LIKE 'pg_%'
            ORDER BY schema_name`);
        return res.rows.map(r => ({ schemaName: r.schema_name, tableCount: r.table_count }));
    } finally {
        await client.end().catch(() => {});
    }
}

async function pgListTables(config: ConnectorConfig, secrets: ConnectorSecrets, schema: string): Promise<TableEntry[]> {
    const client = buildPgClient(config, secrets);
    try {
        await client.connect();
        const res = await client.query(`
            SELECT table_name, table_type,
                   pg_stat_get_live_tuples(c.oid)::bigint AS estimated_row_count
            FROM information_schema.tables t
            LEFT JOIN pg_class c ON c.relname = t.table_name
            LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
            WHERE t.table_schema = $1
              AND t.table_type IN ('BASE TABLE', 'VIEW')
            ORDER BY t.table_name`, [schema]);
        return res.rows.map(r => ({
            tableName: r.table_name,
            tableType: r.table_type === 'VIEW' ? 'VIEW' : 'TABLE',
            estimatedRowCount: r.estimated_row_count ?? undefined,
        }));
    } finally {
        await client.end().catch(() => {});
    }
}

async function pgDescribeTable(config: ConnectorConfig, secrets: ConnectorSecrets, schema: string, table: string): Promise<ColumnEntry[]> {
    const client = buildPgClient(config, secrets);
    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, data_type, is_nullable, ordinal_position
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position`, [schema, table]);
        return res.rows.map(r => ({
            columnName: r.column_name,
            dataType: pgTypeToCode(r.data_type),
            nullable: r.is_nullable === 'YES',
            ordinalPosition: r.ordinal_position,
        }));
    } finally {
        await client.end().catch(() => {});
    }
}

function pgTypeToCode(pgType: string): string {
    const t = pgType.toLowerCase();
    if (t.includes('int')) return 'BIGINT';
    if (t.includes('numeric') || t.includes('decimal') || t.includes('real') || t.includes('double') || t.includes('float')) return 'DOUBLE';
    if (t.includes('bool')) return 'BOOLEAN';
    if (t.includes('timestamp')) return 'TIMESTAMP';
    if (t === 'date') return 'DATE';
    if (t.includes('time')) return 'STRING';
    if (t.includes('json')) return 'STRING';
    if (t.includes('uuid')) return 'STRING';
    if (t.includes('bytea')) return 'BINARY';
    return 'STRING';
}

function coerceStr(val: unknown, fallback = ''): string {
    if (val === null || val === undefined) return fallback;
    return String(val) || fallback;
}

function buildPgClient(config: ConnectorConfig, secrets: ConnectorSecrets): PgClient {
    const host     = coerceStr(config['host'] ?? config['hostname'] ?? config['jdbc_host'], 'localhost');
    const port     = Number(config['port'] ?? config['jdbc_port'] ?? 5432);
    const database = coerceStr(config['database'] ?? config['db'] ?? config['jdbc_database'], 'postgres');
    const user     = coerceStr(secrets['username'] ?? secrets['user'] ?? secrets['jdbc_user'] ?? secrets['jdbc_username']);
    const password = coerceStr(secrets['password'] ?? secrets['jdbc_password'] ?? secrets['jdbc_password']);
    const sslMode  = coerceStr(config['ssl_mode'] ?? config['sslMode'] ?? config['jdbc_ssl_mode']);
    return new PgClient({
        host, port, database, user, password,
        ssl: ['REQUIRE', 'VERIFY_CA', 'VERIFY_FULL'].includes(sslMode) ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 8000,
    });
}

// ─── File preview helpers ─────────────────────────────────────────────────────

function previewCsv(
    filePath: string,
    delimiter: string,
    limit: number,
): Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }> {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
        let headers: string[] = [];
        const rows: Array<Record<string, unknown>> = [];
        rl.on('line', (line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            if (headers.length === 0) {
                headers = trimmed.split(delimiter).map(h => h.replace(/^"|"$/g, '').trim());
                return;
            }
            if (rows.length >= limit) { rl.close(); return; }
            const vals = trimmed.split(delimiter).map(v => v.replace(/^"|"$/g, '').trim());
            const row: Record<string, unknown> = {};
            headers.forEach((h, i) => { row[h] = vals[i] ?? null; });
            rows.push(row);
        });
        rl.on('close', () => resolve({ columns: headers, rows }));
        rl.on('error', reject);
        stream.on('error', reject);
    });
}

function previewJson(
    filePath: string,
    limit: number,
): Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }> {
    return new Promise((resolve, reject) => {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8').trim();
            let parsed: unknown;
            try {
                parsed = JSON.parse(raw);
            } catch {
                // Try newline-delimited JSON (NDJSON)
                const lines = raw.split('\n').filter(l => l.trim());
                parsed = lines.map(l => JSON.parse(l));
            }
            const arr: Record<string, unknown>[] = Array.isArray(parsed)
                ? (parsed as Record<string, unknown>[]).slice(0, limit)
                : [parsed as Record<string, unknown>];
            const columns = arr.length > 0 ? Object.keys(arr[0]) : [];
            const rows = arr.map(r => {
                const out: Record<string, unknown> = {};
                columns.forEach(c => {
                    const v = r[c];
                    out[c] = v === null || v === undefined ? null
                        : typeof v === 'object' ? JSON.stringify(v)
                        : String(v);
                });
                return out;
            });
            resolve({ columns, rows });
        } catch (err) { reject(err); }
    });
}

function previewExcel(
    filePath: string,
    limit: number,
): { columns: string[]; rows: Array<Record<string, unknown>> } {
    // xlsx is an optional dependency — fail gracefully if not installed
    let xlsx: any;
    try { xlsx = require('xlsx'); } catch {
        return { columns: [], rows: [] };
    }
    const wb = xlsx.readFile(filePath, { sheetRows: limit + 1 });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data: unknown[][] = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    if (data.length === 0) return { columns: [], rows: [] };
    const headers = (data[0] as unknown[]).map(h => String(h ?? ''));
    const rows = (data.slice(1, limit + 1) as unknown[][]).map(r => {
        const out: Record<string, unknown> = {};
        headers.forEach((h, i) => { out[h] = r[i] === null || r[i] === undefined ? null : String(r[i]); });
        return out;
    });
    return { columns: headers, rows };
}

async function previewParquet(
    filePath: string,
    limit: number,
): Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }> {
    const reader = await parquet.ParquetReader.openFile(filePath);
    const cursor = reader.getCursor();
    const rows: Array<Record<string, unknown>> = [];
    const schema = reader.getSchema();
    const columns = Object.keys(schema.fields);
    let record: Record<string, unknown> | null;
    while (rows.length < limit && (record = await cursor.next()) !== null) {
        const out: Record<string, unknown> = {};
        for (const col of columns) {
            const v = (record as Record<string, unknown>)[col];
            out[col] = v === null || v === undefined ? null : v instanceof Buffer ? '[binary]' : String(v);
        }
        rows.push(out);
    }
    await reader.close();
    return { columns, rows };
}

function previewAvro(
    filePath: string,
    limit: number,
): Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }> {
    return new Promise((resolve, reject) => {
        const rows: Array<Record<string, unknown>> = [];
        let columns: string[] = [];
        const decoder = avro.createFileDecoder(filePath);
        decoder.on('metadata', (type: avro.Type) => {
            // Extract field names from the Avro schema
            const schema = type.toJSON() as { fields?: Array<{ name: string }> };
            if (schema.fields) columns = schema.fields.map(f => f.name);
        });
        decoder.on('data', (record: Record<string, unknown>) => {
            if (rows.length >= limit) { decoder.destroy(); return; }
            if (columns.length === 0) columns = Object.keys(record);
            const out: Record<string, unknown> = {};
            for (const col of columns) {
                const v = record[col];
                out[col] = v === null || v === undefined ? null : v instanceof Buffer ? '[binary]' : String(v);
            }
            rows.push(out);
        });
        decoder.on('end', () => resolve({ columns, rows }));
        decoder.on('error', reject);
    });
}

// ─── Public service ───────────────────────────────────────────────────────────

export class MetadataIntrospectionService {

    isFileType(typeCode: string): boolean {
        return FILE_TYPE_CODES.has(typeCode.toUpperCase());
    }

    isDbType(typeCode: string): boolean {
        return DB_TYPE_CODES.has(typeCode.toUpperCase());
    }

    /** List schemas / paths available from this connection */
    async listSchemas(typeCode: string, config: ConnectorConfig, secrets: ConnectorSecrets): Promise<SchemaEntry[]> {
        const tc = typeCode.toUpperCase();
        if (this.isFileType(tc)) {
            // For files, "schema" = parent directory
            const basePath = String(config['storage_base_path'] ?? config['file_path'] ?? config['path'] ?? '');
            const dir = fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()
                ? basePath : path.dirname(basePath);
            return [{ schemaName: dir, tableCount: 1 }];
        }
        if (tc === 'POSTGRESQL' || tc === 'JDBC_POSTGRESQL' || tc === 'REDSHIFT') {
            return pgListSchemas(config, secrets);
        }
        return [];
    }

    /** List tables within a schema */
    async listTables(typeCode: string, config: ConnectorConfig, secrets: ConnectorSecrets, schema: string): Promise<TableEntry[]> {
        const tc = typeCode.toUpperCase();
        if (this.isFileType(tc)) {
            const basePath = String(config['storage_base_path'] ?? config['file_path'] ?? config['path'] ?? '');
            const fileName = path.basename(basePath);
            return [{ tableName: fileName, tableType: 'EXTERNAL' }];
        }
        if (tc === 'POSTGRESQL' || tc === 'JDBC_POSTGRESQL' || tc === 'REDSHIFT') {
            return pgListTables(config, secrets, schema);
        }
        return [];
    }

    /** Import selected tables into catalog.datasets + catalog.dataset_columns */
    async importMetadata(params: {
        connectorId: string;
        typeCode: string;
        config: ConnectorConfig;
        secrets: ConnectorSecrets;
        selections: Array<{ db: string; schema: string; table: string }>;
        userId: string;
        encryptionKey: string;
    }): Promise<ImportResult> {
        const { connectorId, typeCode, config, secrets, selections, userId, encryptionKey } = params;
        const tc = typeCode.toUpperCase();
        const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

        log.info('metadata.import', `Importing ${selections.length} datasets from connector ${connectorId}`);

        for (const sel of selections) {
            try {
                let columns: ColumnEntry[] = [];

                if (this.isFileType(tc)) {
                    const filePath = String(config['storage_base_path'] ?? config['file_path'] ?? config['path'] ?? '');
                    const delim = String(config['delimiter'] ?? config['field_separator_char'] ?? ',');
                    if (tc === 'FILE_CSV' || tc === 'CSV') {
                        columns = await inferCsvSchema(filePath, delim);
                    }
                    // For Parquet/Avro/ORC — schema inference needs Spark; register without columns for now
                } else if (tc === 'POSTGRESQL' || tc === 'JDBC_POSTGRESQL' || tc === 'REDSHIFT') {
                    columns = await pgDescribeTable(config, secrets, sel.schema, sel.table);
                }

                // Register dataset via DB procedure
                await db.transaction(async (client) => {
                    await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
                    await client.query(`SET LOCAL app.encryption_key = '${encryptionKey.replace(/'/g, "''")}'`);

                    // Register or update dataset
                    const reg = await client.query(
                        `CALL catalog.pr_register_dataset($1::uuid, $2, $3, $4, null, $5)`,
                        [connectorId, sel.db || null, sel.schema || null, sel.table, 'TABLE'],
                    );
                    const datasetId = reg.rows[0]?.p_dataset_id;

                    if (datasetId && columns.length > 0) {
                        const colJson = JSON.stringify(columns.map(c => ({
                            column_name_text: c.columnName,
                            data_type_code: c.dataType,
                            is_nullable_flag: c.nullable,
                            ordinal_position_num: c.ordinalPosition,
                        })));
                        await client.query(
                            `CALL catalog.pr_sync_dataset_columns($1::uuid, $2::jsonb)`,
                            [datasetId, colJson],
                        );
                    }
                });

                result.imported++;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                log.warn('metadata.import.error', `Failed to import ${sel.schema}.${sel.table}: ${msg}`);
                result.errors.push(`${sel.schema}.${sel.table}: ${msg}`);
                result.skipped++;
            }
        }

        log.info('metadata.import.done', `Import complete: ${result.imported} imported, ${result.skipped} skipped`);
        return result;
    }

    /**
     * Fetch top N data rows from the source system for a registered dataset.
     *
     * Security contract:
     *   - Hard cap: max 50 rows regardless of caller input. Prevents accidental large payloads.
     *   - Data is never stored in any cache or persistent layer — callers must not persist it.
     *   - All values are serialised to string/null before returning (no binary blobs in JSON).
     *
     * Supported source types:
     *   Files  : CSV, JSON (newline-delimited or array), Excel (.xlsx/.xls via xlsx package)
     *   Databases: PostgreSQL, MySQL/MariaDB (via mysql2), Redshift
     *   Unsupported types return { columns: [], rows: [], unsupported: true }
     */
    async previewDataset(params: {
        typeCode: string;
        config: ConnectorConfig;
        secrets: ConnectorSecrets;
        schemaName: string;
        tableName: string;
        limit: number;
    }): Promise<{ columns: string[]; rows: Array<Record<string, unknown>>; unsupported?: boolean }> {
        const { typeCode, config, secrets, schemaName, tableName } = params;
        // Hard cap — never return more than 50 rows to the browser
        const safeLimit = Math.min(Math.max(1, params.limit), 50);
        const tc = typeCode.toUpperCase();

        // ── File sources ──────────────────────────────────────────────────────
        if (this.isFileType(tc)) {
            const basePath = coerceStr(config['storage_base_path'] ?? config['file_path'] ?? config['path'] ?? '');
            // Resolve the actual file path
            const filePath = fs.existsSync(basePath) && !fs.statSync(basePath).isDirectory()
                ? basePath
                : path.join(schemaName, tableName);

            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            // CSV / TSV / delimiter-separated
            if (/^(file_csv|csv|file_tsv|tsv)$/i.test(tc)) {
                const delimiter = coerceStr(config['field_separator_char'] ?? config['delimiter'] ?? ',', ',');
                return previewCsv(filePath, delimiter, safeLimit);
            }

            // Newline-delimited JSON or JSON array
            if (/^(file_json|json)$/i.test(tc)) {
                return previewJson(filePath, safeLimit);
            }

            // Excel
            if (/^(file_excel|excel|xlsx|xls)$/i.test(tc)) {
                return previewExcel(filePath, safeLimit);
            }

            // Parquet
            if (/^(file_parquet|parquet)$/i.test(tc)) {
                return previewParquet(filePath, safeLimit);
            }

            // Avro
            if (/^(file_avro|avro)$/i.test(tc)) {
                return previewAvro(filePath, safeLimit);
            }

            // ORC — requires Hadoop/JVM, not readable in pure Node.js
            if (/^(file_orc|orc)$/i.test(tc)) {
                return { columns: [], rows: [], unsupported: true };
            }

            // Unknown file type
            return { columns: [], rows: [], unsupported: true };
        }

        // ── PostgreSQL / Redshift ─────────────────────────────────────────────
        if (['POSTGRESQL', 'JDBC_POSTGRESQL', 'REDSHIFT'].includes(tc)) {
            const client = buildPgClient(config, secrets);
            try {
                await client.connect();
                const schema = schemaName.replace(/"/g, '""');
                const table  = tableName.replace(/"/g, '""');
                const res = await client.query(
                    `SELECT * FROM "${schema}"."${table}" LIMIT $1`,
                    [safeLimit],
                );
                const columns = res.fields.map(f => f.name);
                // Serialise all values — prevents binary/date objects leaking as non-JSON
                const rows = res.rows.map(r => {
                    const out: Record<string, unknown> = {};
                    for (const col of columns) {
                        const v = r[col];
                        out[col] = v === null || v === undefined ? null : v instanceof Buffer ? '[binary]' : String(v);
                    }
                    return out;
                });
                return { columns, rows };
            } finally {
                await client.end().catch(() => {});
            }
        }

        // ── MySQL / MariaDB ───────────────────────────────────────────────────
        if (['MYSQL', 'JDBC_MYSQL', 'MARIADB', 'JDBC_MARIADB'].includes(tc)) {
            const conn = await mysqlConnect({
                host:     coerceStr(config['host'] ?? config['jdbc_host'], 'localhost'),
                port:     Number(config['port'] ?? config['jdbc_port'] ?? 3306),
                database: coerceStr(config['database'] ?? config['jdbc_database']),
                user:     coerceStr(secrets['username'] ?? secrets['jdbc_username']),
                password: coerceStr(secrets['password'] ?? secrets['jdbc_password']),
                ssl:      ['REQUIRE', 'VERIFY_CA', 'VERIFY_FULL'].includes(
                              coerceStr(config['ssl_mode'] ?? config['jdbc_ssl_mode']).toUpperCase()
                          ) ? { rejectUnauthorized: false } : undefined,
                connectTimeout: 8000,
            });
            try {
                const schema = schemaName.replace(/`/g, '``');
                const table  = tableName.replace(/`/g, '``');
                const [rowsRaw, fields] = await conn.query(
                    `SELECT * FROM \`${schema}\`.\`${table}\` LIMIT ?`,
                    [safeLimit],
                ) as [Record<string, unknown>[], any[]];
                const columns = fields.map((f: any) => f.name as string);
                const rows = (rowsRaw as Record<string, unknown>[]).map(r => {
                    const out: Record<string, unknown> = {};
                    for (const col of columns) {
                        const v = r[col];
                        out[col] = v === null || v === undefined ? null : v instanceof Buffer ? '[binary]' : String(v);
                    }
                    return out;
                });
                return { columns, rows };
            } finally {
                await conn.end().catch(() => {});
            }
        }

        // ── SQL Server / Azure SQL ────────────────────────────────────────────
        if (['SQLSERVER', 'JDBC_SQLSERVER', 'AZURE_SQL'].includes(tc)) {
            const pool = await mssql.connect({
                server:   coerceStr(config['host'] ?? config['jdbc_host'], 'localhost'),
                port:     Number(config['port'] ?? config['jdbc_port'] ?? 1433),
                database: coerceStr(config['database'] ?? config['jdbc_database']),
                user:     coerceStr(secrets['username'] ?? secrets['jdbc_username']),
                password: coerceStr(secrets['password'] ?? secrets['jdbc_password']),
                options: {
                    encrypt:                true,
                    trustServerCertificate: true,
                    connectTimeout:         8000,
                },
            });
            try {
                // Square-bracket quoting for SQL Server identifiers
                const schema = schemaName.replace(/]/g, ']]');
                const table  = tableName.replace(/]/g, ']]');
                const result = await pool.request().query(
                    `SELECT TOP ${safeLimit} * FROM [${schema}].[${table}]`,
                );
                const columns = result.recordset.columns
                    ? Object.keys(result.recordset.columns)
                    : result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [];
                const rows = result.recordset.map((r: Record<string, unknown>) => {
                    const out: Record<string, unknown> = {};
                    for (const col of columns) {
                        const v = r[col];
                        out[col] = v === null || v === undefined ? null : v instanceof Buffer ? '[binary]' : String(v);
                    }
                    return out;
                });
                return { columns, rows };
            } finally {
                await pool.close().catch(() => {});
            }
        }

        // ── Oracle ────────────────────────────────────────────────────────────
        if (['ORACLE', 'JDBC_ORACLE'].includes(tc)) {
            // oracledb thin mode — no Oracle Instant Client required
            oracledb.initOracleClient && void 0; // thin mode is default in v6+
            const host     = coerceStr(config['host'] ?? config['jdbc_host'], 'localhost');
            const port     = Number(config['port'] ?? config['jdbc_port'] ?? 1521);
            const database = coerceStr(config['database'] ?? config['jdbc_database'] ?? config['service_name'] ?? 'ORCL');
            const conn = await oracledb.getConnection({
                user:             coerceStr(secrets['username'] ?? secrets['jdbc_username']),
                password:         coerceStr(secrets['password'] ?? secrets['jdbc_password']),
                connectString:    `${host}:${port}/${database}`,
                connectTimeout:   8,
            });
            try {
                // Oracle uses FETCH FIRST n ROWS ONLY (12c+) or ROWNUM for older versions
                const schema = schemaName.replace(/"/g, '""').toUpperCase();
                const table  = tableName.replace(/"/g, '""').toUpperCase();
                const result = await conn.execute(
                    `SELECT * FROM "${schema}"."${table}" FETCH FIRST :lim ROWS ONLY`,
                    { lim: safeLimit },
                    { outFormat: oracledb.OUT_FORMAT_OBJECT, fetchArraySize: safeLimit },
                );
                const columns = (result.metaData ?? []).map((m: any) => m.name as string);
                const rows = ((result.rows ?? []) as Record<string, unknown>[]).map(r => {
                    const out: Record<string, unknown> = {};
                    for (const col of columns) {
                        const v = r[col];
                        out[col] = v === null || v === undefined ? null : v instanceof Buffer ? '[binary]' : String(v);
                    }
                    return out;
                });
                return { columns, rows };
            } finally {
                await conn.close().catch(() => {});
            }
        }

        // ── All other types (Hive, Databricks, BigQuery, etc.) ───────────────
        // No driver installed — caller shows "unsupported" message
        return { columns: [], rows: [], unsupported: true };
    }
}

export const metadataIntrospectionService = new MetadataIntrospectionService();

