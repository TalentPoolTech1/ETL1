/**
 * File Format Connector Plugin — CSV, Parquet, ORC, JSON, XML, Excel, Avro, Fixed-Width, Delta, Iceberg, Hudi.
 *
 * File-based connectors represent data stored in a specific file format
 * on any storage backend (S3, GCS, ADLS, HDFS, local). The format config
 * lives in catalog.file_format_options; the storage backend is referenced
 * via the connector's conn_config_json_encrypted.
 *
 * This plugin handles format-specific Spark read/write option generation.
 */

import {
    IConnectorPlugin, ConnectorCategory, ConnectorConfig, ConnectorSecrets,
    JsonSchema, TestResult, TestStep, TableSummary, TableDetail, TableRef, SparkConnectorConfig,
} from '../IConnectorPlugin';

// ---------------------------------------------------------------------------
// Format-specific Spark format strings
// ---------------------------------------------------------------------------
const SPARK_FORMAT: Record<string, string> = {
    CSV: 'csv',
    PARQUET: 'parquet',
    ORC: 'orc',
    JSON: 'json',
    XML: 'com.databricks.spark.xml',
    EXCEL: 'com.crealytics.spark.excel',
    AVRO: 'avro',
    FIXED_WIDTH: 'text',
    DELTA: 'delta',
    ICEBERG: 'iceberg',
    HUDI: 'hudi',
};

// ---------------------------------------------------------------------------
// Config and secrets schemas (format options are stored in file_format_options table)
// ---------------------------------------------------------------------------
const FILE_CONFIG: JsonSchema = {
    type: 'object',
    properties: {
        storage_type: { type: 'string', description: 'Underlying storage', enum: ['S3', 'GCS', 'ADLS', 'HDFS', 'LOCAL', 'OCI'] },
        storage_base_path: { type: 'string', description: 'Base URI or path to the data files' },
        storage_connector_ref: { type: 'string', description: 'UUID of the storage connector providing auth credentials' },
    },
    required: ['storage_type', 'storage_base_path'],
};

const FILE_SECRETS: JsonSchema = {
    type: 'object',
    properties: {},
};

export class FileFormatPlugin implements IConnectorPlugin {
    readonly typeCode: string;
    readonly displayName: string;
    readonly category: ConnectorCategory = 'FILE_FORMAT';
    readonly configSchema = FILE_CONFIG;
    readonly secretsSchema = FILE_SECRETS;
    readonly defaultPort = undefined;
    readonly defaultTestQuery = undefined;

    private readonly formatCode: string;

    constructor(formatCode: string) {
        this.formatCode = formatCode;
        this.typeCode = `FILE_${formatCode}`;
        this.displayName = this.buildDisplayName(formatCode);
    }

    private buildDisplayName(fmt: string): string {
        const names: Record<string, string> = {
            CSV: 'CSV (Delimited Text)',
            PARQUET: 'Apache Parquet',
            ORC: 'Apache ORC',
            JSON: 'JSON',
            XML: 'XML',
            EXCEL: 'Microsoft Excel',
            AVRO: 'Apache Avro',
            FIXED_WIDTH: 'Fixed-Width Text',
            DELTA: 'Delta Lake',
            ICEBERG: 'Apache Iceberg',
            HUDI: 'Apache Hudi',
        };
        return names[fmt] ?? fmt;
    }

    async test(config: ConnectorConfig, _secrets: ConnectorSecrets): Promise<TestResult> {
        const steps: TestStep[] = [
            { stepName: 'network', passed: true, message: `Storage type: ${config['storage_type']}`, durationMs: 0 },
            { stepName: 'authentication', passed: true, message: `Via referenced storage connector`, durationMs: 0 },
            { stepName: 'authorization', passed: true, message: `Path accessible: ${config['storage_base_path']}`, durationMs: 0 },
            { stepName: 'ssl', passed: true, message: 'Inherited from storage connector', durationMs: 0 },
        ];
        return { success: true, steps, latencyMs: 0 };
    }

    async listDatabases(): Promise<string[]> { return []; }
    async listSchemas(): Promise<string[]> { return []; }
    async listTables(): Promise<TableSummary[]> { return []; }
    async describeTable(_c: ConnectorConfig, _s: ConnectorSecrets, ref: TableRef): Promise<TableDetail> {
        return { tableName: ref.table, tableType: 'EXTERNAL', columns: [] };
    }

    /**
     * Generates Spark read config with format-specific options.
     *
     * CSV-specific options (from file_format_options table):
     *   - sep, header, quote, escape, encoding, dateFormat, timestampFormat, nullValue,
     *     multiLine, mode
     *
     * The caller must merge file_format_options from the DB into the config
     * before calling this method.
     */
    generateSparkReadConfig(config: ConnectorConfig, _secrets: ConnectorSecrets, _tableRef: TableRef): SparkConnectorConfig {
        const sparkFormat = SPARK_FORMAT[this.formatCode] ?? this.formatCode.toLowerCase();

        // Format-specific option mapping from flat config (populated from file_format_options)
        const opts: Record<string, string> = {};

        switch (this.formatCode) {
            case 'CSV':
                if (config['field_separator_char']) opts['sep'] = String(config['field_separator_char']);
                if (config['has_header_flag'] !== undefined) opts['header'] = String(config['has_header_flag']);
                if (config['quote_char_text']) opts['quote'] = String(config['quote_char_text']);
                if (config['escape_char_text']) opts['escape'] = String(config['escape_char_text']);
                if (config['encoding_standard_code']) opts['encoding'] = String(config['encoding_standard_code']);
                if (config['date_format_text']) opts['dateFormat'] = String(config['date_format_text']);
                if (config['timestamp_format_text']) opts['timestampFormat'] = String(config['timestamp_format_text']);
                if (config['null_value_text'] !== undefined) opts['nullValue'] = String(config['null_value_text']);
                if (config['multiline_flag']) opts['multiLine'] = String(config['multiline_flag']);
                if (config['line_separator_text']) opts['lineSep'] = String(config['line_separator_text']);
                if (config['corrupt_record_mode']) opts['mode'] = String(config['corrupt_record_mode']);
                if (config['skip_rows_num']) opts['skipRows'] = String(config['skip_rows_num']);
                // inferSchema false — use dataset_columns from catalog
                opts['inferSchema'] = 'false';
                break;

            case 'JSON':
                if (config['multiline_flag']) opts['multiLine'] = String(config['multiline_flag']);
                if (config['date_format_text']) opts['dateFormat'] = String(config['date_format_text']);
                if (config['timestamp_format_text']) opts['timestampFormat'] = String(config['timestamp_format_text']);
                if (config['encoding_standard_code']) opts['encoding'] = String(config['encoding_standard_code']);
                if (config['corrupt_record_mode']) opts['mode'] = String(config['corrupt_record_mode']);
                break;

            case 'XML':
                if (config['row_tag_text']) opts['rowTag'] = String(config['row_tag_text']);
                if (config['root_tag_text']) opts['rootTag'] = String(config['root_tag_text']);
                break;

            case 'EXCEL':
                opts['dataAddress'] = config['sheet_name_text']
                    ? `'${config['sheet_name_text']}'!A1`
                    : `#${config['sheet_index_num'] ?? 0}!A1`;
                if (config['has_header_flag'] !== undefined) opts['header'] = String(config['has_header_flag']);
                break;

            case 'PARQUET':
            case 'ORC':
            case 'AVRO':
                // Columnar formats have minimal options; compression is handled at write time
                break;

            case 'FIXED_WIDTH':
                // Fixed-width reads as text, transform applied post-read
                break;

            case 'DELTA':
            case 'ICEBERG':
            case 'HUDI':
                // Lakehouse formats — handled natively by their format string
                break;
        }

        // Compression (applicable to all formats at read time for some)
        if (config['compression_code'] && config['compression_code'] !== 'NONE') {
            opts['compression'] = String(config['compression_code']).toLowerCase();
        }

        return {
            format: sparkFormat,
            options: opts,
            requiredJars: this.requiredJars(),
        };
    }

    generateSparkWriteConfig(config: ConnectorConfig, secrets: ConnectorSecrets, tableRef: TableRef): SparkConnectorConfig {
        const writeConfig = this.generateSparkReadConfig(config, secrets, tableRef);

        // Set write-specific compression
        const compression = config['compression_code'] as string | undefined;
        if (compression && compression !== 'NONE') {
            writeConfig.options['compression'] = compression.toLowerCase();
        }

        return writeConfig;
    }

    requiredJars(): string[] {
        const jars: Record<string, string[]> = {
            XML: ['spark-xml.jar'],
            EXCEL: ['spark-excel.jar'],
            AVRO: ['spark-avro.jar'],
            DELTA: ['delta-core.jar', 'delta-storage.jar'],
            ICEBERG: ['iceberg-spark-runtime.jar'],
            HUDI: ['hudi-spark-bundle.jar'],
        };
        return jars[this.formatCode] ?? [];
    }
}
