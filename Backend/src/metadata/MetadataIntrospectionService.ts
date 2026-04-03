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

async function inferCsvSchema(filePath: string, delimiter = ',', hasHeader = true): Promise<ColumnEntry[]> {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
        let firstLine: string | null = null;
        let sampleLines: string[] = [];
        let lineCount = 0;

        rl.on('line', (line) => {
            if (!firstLine) {
                firstLine = line;
                if (!hasHeader) {
                    sampleLines.push(line);
                    lineCount++;
                }
                return;
            }
            if (lineCount < 10) sampleLines.push(line);
            lineCount++;
            if (lineCount >= 10) rl.close();
        });
        rl.on('close', () => {
            if (!firstLine) return resolve([]);
            const firstValues = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
            const headers = hasHeader
                ? firstValues
                : firstValues.map((_, idx) => `column_${idx + 1}`);
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

function coerceBool(val: unknown, fallback = false): boolean {
    if (val === null || val === undefined || val === '') return fallback;
    if (typeof val === 'boolean') return val;
    const normalized = String(val).trim().toLowerCase();
    return ['1', 'true', 'yes', 'y'].includes(normalized);
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
    hasHeader = true,
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
                const firstValues = trimmed.split(delimiter).map(h => h.replace(/^"|"$/g, '').trim());
                headers = hasHeader
                    ? firstValues
                    : firstValues.map((_, idx) => `column_${idx + 1}`);
                if (!hasHeader) {
                    const firstRow: Record<string, unknown> = {};
                    headers.forEach((h, i) => { firstRow[h] = firstValues[i] ?? null; });
                    rows.push(firstRow);
                }
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

function hasGlobPattern(input: string): boolean {
    return /[*?[\\]{}]/.test(input);
}

function escapeRegex(input: string): string {
    return input.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegex(pattern: string): RegExp {
    const normalized = pattern.replace(/\\/g, '/');
    let regex = '^';
    for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];
        if (ch === '*') {
            const next = normalized[i + 1];
            if (next === '*') {
                regex += '.*';
                i++;
            } else {
                regex += '[^/]*';
            }
            continue;
        }
        if (ch === '?') {
            regex += '.';
            continue;
        }
        regex += escapeRegex(ch);
    }
    regex += '$';
    return new RegExp(regex, 'i');
}

const PREVIEW_FILE_PATTERN_TOKEN_MAP: Array<{ token: string; glob: string }> = [
    { token: '{YYYYMMDDHH24MISS}', glob: '??????????????' },
    { token: '{YYYYMMDD_HH24MISS}', glob: '????????_??????' },
    { token: '{YYYY-MM-DD_HH24MISS}', glob: '????-??-??_??????' },
    { token: '{YYYY-MM-DD}', glob: '????-??-??' },
    { token: '{YYYY_MM_DD}', glob: '????_??_??' },
    { token: '{DD-MON-YYYY}', glob: '??-???-????' },
    { token: '{DD-MON-YY}', glob: '??-???-??' },
    { token: '{YYYYMMDD}', glob: '????????' },
    { token: '{YYYYMM}', glob: '??????' },
    { token: '{YYYY}', glob: '????' },
];

const PREVIEW_FILE_PATTERN_SEGMENT_MAP: Array<{ pattern: RegExp; glob: string }> = [
    { pattern: /HH24|HH12|HH/g, glob: '??' },
    { pattern: /YYYY/g, glob: '????' },
    { pattern: /YYY/g, glob: '???' },
    { pattern: /YY/g, glob: '??' },
    { pattern: /MONTH/g, glob: '*' },
    { pattern: /MON/g, glob: '???' },
    { pattern: /MM/g, glob: '??' },
    { pattern: /DDD/g, glob: '???' },
    { pattern: /DD/g, glob: '??' },
    { pattern: /MI/g, glob: '??' },
    { pattern: /SS/g, glob: '??' },
    { pattern: /FF9/g, glob: '?????????' },
    { pattern: /FF6/g, glob: '??????' },
    { pattern: /FF3/g, glob: '???' },
    { pattern: /FF2/g, glob: '??' },
    { pattern: /FF1/g, glob: '?' },
    { pattern: /Q/g, glob: '?' },
];

function normalizePreviewPathPattern(pathValue: string): string {
    return pathValue.replace(/\{([^{}]+)\}/g, (_fullMatch, tokenBody: string) => {
        const trimmed = tokenBody.trim().toUpperCase();
        if (!trimmed) return '*';

        const exact = PREVIEW_FILE_PATTERN_TOKEN_MAP.find(entry => entry.token.slice(1, -1).toUpperCase() === trimmed);
        if (exact) return exact.glob;

        let normalized = trimmed;
        for (const entry of PREVIEW_FILE_PATTERN_SEGMENT_MAP) {
            normalized = normalized.replace(entry.pattern, entry.glob);
        }

        if (/[A-Z]/.test(normalized)) {
            normalized = normalized.replace(/[A-Z0-9]+/g, '*');
        }

        return normalized || '*';
    });
}

function wildcardRoot(pattern: string): string {
    const normalized = pattern.replace(/\\/g, '/');
    const wildcardIndex = normalized.search(/[*?[\\]{}]/);
    if (wildcardIndex === -1) return normalized;
    const slashIndex = normalized.lastIndexOf('/', wildcardIndex);
    if (slashIndex <= 0) return normalized.startsWith('/') ? '/' : '.';
    return normalized.slice(0, slashIndex);
}

function collectFiles(dirPath: string, recursive: boolean): string[] {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return [];
    const out: string[] = [];
    const stack = [dirPath];

    while (stack.length > 0) {
        const current = stack.pop()!;
        let entries: fs.Dirent[] = [];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            const nextPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (recursive) stack.push(nextPath);
                continue;
            }
            if (entry.isFile()) out.push(nextPath);
        }
    }

    return out.sort((a, b) => a.localeCompare(b));
}

function resolvePreviewFilePath(params: {
    basePath: string;
    schemaName?: string;
    tableName?: string;
    recursive?: boolean;
    pathGlobFilter?: string;
}): string {
    const basePath = normalizePreviewPathPattern(params.basePath.trim());
    const recursive = params.recursive ?? false;
    const pathGlobFilter = params.pathGlobFilter?.trim() ?? '';
    const schemaName = params.schemaName?.trim() ?? '';
    const tableName = params.tableName?.trim() ?? '';

    const pickFirstMatch = (candidates: string[], filterPattern?: string): string | null => {
        const matcher = filterPattern ? globToRegex(filterPattern) : null;
        for (const candidate of candidates) {
            const normalizedCandidate = candidate.replace(/\\/g, '/');
            if (!matcher || matcher.test(path.basename(normalizedCandidate)) || matcher.test(normalizedCandidate)) {
                return candidate;
            }
        }
        return null;
    };

    if (basePath) {
        if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) return basePath;

        if (hasGlobPattern(basePath)) {
            const root = wildcardRoot(basePath);
            const matcher = globToRegex(basePath);
            const candidates = collectFiles(root, true).filter(file => matcher.test(file.replace(/\\/g, '/')));
            const matched = pickFirstMatch(candidates, pathGlobFilter || undefined);
            if (matched) return matched;
        }

        if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
            if (schemaName && tableName) {
                const explicit = path.join(basePath, schemaName, tableName);
                if (fs.existsSync(explicit) && fs.statSync(explicit).isFile()) return explicit;
            }
            if (tableName) {
                const direct = path.join(basePath, tableName);
                if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
            }
            const matched = pickFirstMatch(collectFiles(basePath, recursive), pathGlobFilter || undefined);
            if (matched) return matched;
        }
    }

    if (schemaName && tableName) {
        const joined = path.join(schemaName, tableName);
        if (fs.existsSync(joined) && fs.statSync(joined).isFile()) return joined;
    }

    if (tableName && fs.existsSync(tableName) && fs.statSync(tableName).isFile()) return tableName;

    throw new Error(
        basePath
            ? `No matching file found for path/pattern: ${basePath}`
            : `File not found for selected object ${schemaName ? `${schemaName}/` : ''}${tableName}`,
    );
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
                    const hasHeader = coerceBool(config['has_header_flag'] ?? config['header'], true);
                    if (tc === 'FILE_CSV' || tc === 'CSV') {
                        columns = await inferCsvSchema(filePath, delim, hasHeader);
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
            const basePath = coerceStr(
                config['preview_path']
                ?? config['file_path']
                ?? config['storage_base_path']
                ?? config['path']
                ?? '',
            );
            const filePath = resolvePreviewFilePath({
                basePath,
                schemaName,
                tableName,
                recursive: coerceBool(config['recursiveFileLookup'] ?? config['recursive_file_lookup']),
                pathGlobFilter: coerceStr(config['pathGlobFilter'] ?? config['path_glob_filter']),
            });

            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            // CSV / TSV / delimiter-separated
            if (/^(file_csv|csv|file_tsv|tsv)$/i.test(tc)) {
                const delimiter = coerceStr(config['field_separator_char'] ?? config['delimiter'] ?? ',', ',');
                const hasHeader = coerceBool(config['has_header_flag'] ?? config['header'], true);
                return previewCsv(filePath, delimiter, safeLimit, hasHeader);
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

    /**
     * listColumns — Return column metadata for a specific table.
     * Used by the /introspect/columns endpoint (F-03/F-04 column pickers).
     * Delegates to pgDescribeTable for PostgreSQL/Redshift;
     * MySQL and SQL Server use information_schema similarly.
     * For file types, returns inferred columns from CSV header.
     */
    async listColumns(
        typeCode: string,
        config: ConnectorConfig,
        secrets: ConnectorSecrets,
        schema: string,
        table: string,
    ): Promise<ColumnEntry[]> {
        const tc = typeCode.toUpperCase();

        if (tc === 'POSTGRESQL' || tc === 'JDBC_POSTGRESQL' || tc === 'REDSHIFT') {
            return pgDescribeTable(config, secrets, schema, table);
        }

        if (['MYSQL', 'JDBC_MYSQL', 'MARIADB', 'JDBC_MARIADB'].includes(tc)) {
            const conn = await mysqlConnect({
                host:     coerceStr(config['host'] ?? config['jdbc_host'], 'localhost'),
                port:     Number(config['port'] ?? config['jdbc_port'] ?? 3306),
                database: coerceStr(config['database'] ?? config['jdbc_database']),
                user:     coerceStr(secrets['username'] ?? secrets['jdbc_username']),
                password: coerceStr(secrets['password'] ?? secrets['jdbc_password']),
                connectTimeout: 8000,
            });
            try {
                const [rows] = await conn.query(
                    `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ORDINAL_POSITION
                     FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                     ORDER BY ORDINAL_POSITION`,
                    [schema || coerceStr(config['database'] ?? config['jdbc_database']), table],
                ) as [Array<Record<string,unknown>>, any];
                return (rows as Array<Record<string,unknown>>).map((r, i) => ({
                    columnName:     String(r['COLUMN_NAME'] ?? ''),
                    dataType:       String(r['DATA_TYPE'] ?? 'STRING').toUpperCase(),
                    nullable:       String(r['IS_NULLABLE'] ?? 'YES') === 'YES',
                    ordinalPosition: Number(r['ORDINAL_POSITION'] ?? i + 1),
                }));
            } finally { await conn.end().catch(() => {}); }
        }

        if (['SQLSERVER', 'JDBC_SQLSERVER', 'AZURE_SQL'].includes(tc)) {
            const pool = await mssql.connect({
                server:   coerceStr(config['host'] ?? config['jdbc_host'], 'localhost'),
                port:     Number(config['port'] ?? config['jdbc_port'] ?? 1433),
                database: coerceStr(config['database'] ?? config['jdbc_database']),
                user:     coerceStr(secrets['username'] ?? secrets['jdbc_username']),
                password: coerceStr(secrets['password'] ?? secrets['jdbc_password']),
                options: { encrypt: true, trustServerCertificate: true, connectTimeout: 8000 },
            });
            try {
                const result = await pool.request().input('schema', mssql.NVarChar, schema).input('table', mssql.NVarChar, table).query(
                    `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ORDINAL_POSITION
                     FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
                     ORDER BY ORDINAL_POSITION`,
                );
                return result.recordset.map((r: any) => ({
                    columnName:      String(r.COLUMN_NAME ?? ''),
                    dataType:        String(r.DATA_TYPE ?? 'VARCHAR').toUpperCase(),
                    nullable:        String(r.IS_NULLABLE ?? 'YES') === 'YES',
                    ordinalPosition: Number(r.ORDINAL_POSITION ?? 0),
                }));
            } finally { await pool.close().catch(() => {}); }
        }

        if (['ORACLE', 'JDBC_ORACLE'].includes(tc)) {
            const host     = coerceStr(config['host'] ?? config['jdbc_host'], 'localhost');
            const port     = Number(config['port'] ?? config['jdbc_port'] ?? 1521);
            const database = coerceStr(config['database'] ?? config['jdbc_database'] ?? config['service_name'] ?? 'ORCL');
            const conn = await oracledb.getConnection({
                user:          coerceStr(secrets['username'] ?? secrets['jdbc_username']),
                password:      coerceStr(secrets['password'] ?? secrets['jdbc_password']),
                connectString: `${host}:${port}/${database}`,
                connectTimeout: 8,
            });
            try {
                const ownerUpper = schema.toUpperCase().replace(/'/g, "''");
                const tableUpper = table.toUpperCase().replace(/'/g, "''");
                const result = await conn.execute(
                    `SELECT COLUMN_NAME, DATA_TYPE, NULLABLE, COLUMN_ID
                     FROM ALL_TAB_COLUMNS
                     WHERE OWNER = '${ownerUpper}' AND TABLE_NAME = '${tableUpper}'
                     ORDER BY COLUMN_ID`,
                    {}, { outFormat: oracledb.OUT_FORMAT_OBJECT },
                );
                return ((result.rows ?? []) as any[]).map((r: any) => ({
                    columnName:      String(r.COLUMN_NAME ?? ''),
                    dataType:        String(r.DATA_TYPE ?? 'VARCHAR2').toUpperCase(),
                    nullable:        String(r.NULLABLE ?? 'Y') === 'Y',
                    ordinalPosition: Number(r.COLUMN_ID ?? 0),
                }));
            } finally { await conn.close().catch(() => {}); }
        }

        if (this.isFileType(tc)) {
            const basePath = coerceStr(config['storage_base_path'] ?? config['file_path'] ?? config['path'] ?? '');
            const filePath = fs.existsSync(basePath) && !fs.statSync(basePath).isDirectory() ? basePath : '';
            if (filePath && /csv/i.test(tc)) {
                const delim = coerceStr(config['field_separator_char'] ?? config['delimiter'] ?? ',', ',');
                const hasHeader = coerceBool(config['has_header_flag'] ?? config['header'], true);
                return inferCsvSchema(filePath, delim, hasHeader);
            }
        }

        return []; // Unsupported connector type — no column info available
    }
}

export const metadataIntrospectionService = new MetadataIntrospectionService();
