/**
 * IConnectorPlugin — Uniform connector interface.
 *
 * Every connector type (JDBC, S3, GCS, Snowflake, Databricks, etc.) implements
 * this interface. The ConnectorRegistry discovers and caches plugin instances
 * at startup. The ConnectionService delegates all connector-specific logic to
 * the appropriate plugin, determined by connector_type_code.
 *
 * Principle P-05: All connectors present the same interface regardless of
 * underlying technology.
 */

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

export type ConnectorCategory =
    | 'CLOUD_STORAGE'
    | 'CLOUD_DATABASE'
    | 'CLOUD_DATA_WAREHOUSE'
    | 'ON_PREM_RDBMS'
    | 'FILE_FORMAT'
    | 'OBJECT_STORAGE'
    | 'LAKEHOUSE';

export interface JsonSchema {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
}

export interface JsonSchemaProperty {
    type: 'string' | 'integer' | 'boolean' | 'number';
    description: string;
    enum?: string[];
    default?: unknown;
    secret?: boolean;
    format?: string;
    minimum?: number;
    maximum?: number;
}

/** Structured result from a connection test.  Each step reports pass/fail. */
export interface TestResult {
    success: boolean;
    steps: TestStep[];
    latencyMs: number;
}

export interface TestStep {
    stepName: string;  // 'network', 'authentication', 'authorization', 'ssl'
    passed: boolean;
    message?: string;
    durationMs: number;
}

export interface TableSummary {
    tableName: string;
    schemaName?: string;
    tableType: 'TABLE' | 'VIEW' | 'EXTERNAL' | 'MATERIALIZED_VIEW';
    estimatedRowCount?: number;
}

export interface ColumnDetail {
    columnName: string;
    dataType: string;
    nullable: boolean;
    ordinalPosition: number;
    defaultValue?: string;
    comment?: string;
    constraintType?: 'PK' | 'UK' | 'FK' | 'NONE';
    fkRefTable?: string;
    fkRefColumn?: string;
}

export interface TableDetail {
    tableName: string;
    schemaName?: string;
    databaseName?: string;
    tableType: string;
    columns: ColumnDetail[];
    partitionColumns?: string[];
    comment?: string;
    estimatedRowCount?: number;
}

export interface TableRef {
    database?: string;
    schema?: string;
    table: string;
}

/** Spark configuration block emitted by codegen. */
export interface SparkConnectorConfig {
    format: string;                         // e.g. 'jdbc', 'parquet', 'bigquery', 'net.snowflake.spark.snowflake'
    options: Record<string, string>;        // Spark DataSource options
    hadoopConfig?: Record<string, string>;  // fs.s3a.*, fs.gs.*, fs.azure.* keys
    requiredJars: string[];                 // JAR file paths/names needed on the Spark classpath
}

/** Decrypted config and secrets as plain JSONB objects. */
export interface ConnectorConfig {
    [key: string]: unknown;
}

export interface ConnectorSecrets {
    [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// The Plugin Interface
// ---------------------------------------------------------------------------

export interface IConnectorPlugin {

    /** Unique type code matching catalog.connectors.connector_type_code */
    readonly typeCode: string;

    /** Human-readable name for the UI */
    readonly displayName: string;

    /** Connector category for UI grouping */
    readonly category: ConnectorCategory;

    /** JSON Schema describing non-secret config fields — drives the dynamic UI form */
    readonly configSchema: JsonSchema;

    /** JSON Schema describing secret fields — drives the masked-input portion of the UI form */
    readonly secretsSchema: JsonSchema;

    /** Default JDBC driver class (NULL for non-JDBC connectors) */
    readonly defaultJdbcDriverClass?: string;

    /** Default TCP port for this connector type */
    readonly defaultPort?: number;

    /** Default test query (e.g., SELECT 1, SELECT 1 FROM DUAL) */
    readonly defaultTestQuery?: string;

    /**
     * Test connectivity in 4 steps:
     * 1. Network reachability (TCP connect)
     * 2. Authentication (session/token/JDBC connect)
     * 3. Authorisation (lightweight read query)
     * 4. SSL/TLS verification (cert chain)
     */
    test(config: ConnectorConfig, secrets: ConnectorSecrets): Promise<TestResult>;

    /** List databases/catalogs visible to the configured user. */
    listDatabases(config: ConnectorConfig, secrets: ConnectorSecrets): Promise<string[]>;

    /** List schemas/namespaces within a database. */
    listSchemas(config: ConnectorConfig, secrets: ConnectorSecrets, database: string): Promise<string[]>;

    /** List tables within a schema. */
    listTables(config: ConnectorConfig, secrets: ConnectorSecrets, database: string, schema: string): Promise<TableSummary[]>;

    /** Full column-level schema description of a table. */
    describeTable(config: ConnectorConfig, secrets: ConnectorSecrets, tableRef: TableRef): Promise<TableDetail>;

    /**
     * Generate the Spark read configuration for codegen.
     * Credentials are referenced via spark.conf.get() — never hardcoded.
     */
    generateSparkReadConfig(config: ConnectorConfig, secrets: ConnectorSecrets, tableRef: TableRef): SparkConnectorConfig;

    /**
     * Generate the Spark write configuration for codegen.
     */
    generateSparkWriteConfig(config: ConnectorConfig, secrets: ConnectorSecrets, tableRef: TableRef): SparkConnectorConfig;

    /** List of JAR file names required on the Spark classpath for this connector. */
    requiredJars(): string[];
}
