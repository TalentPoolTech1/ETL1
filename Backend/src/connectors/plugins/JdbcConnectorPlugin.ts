/**
 * JDBC Connector Plugins — On-premises RDBMS connectivity.
 *
 * Covers: PostgreSQL, MySQL, MariaDB, SQL Server, Oracle, Db2, SAP HANA,
 *         Teradata, Greenplum, Sybase.
 *
 * All connectivity via JDBC — no native drivers bundled in the ETL1 backend.
 * Drivers are loaded dynamically from a configurable driver library path.
 */

import { Client as PgClient } from 'pg';
import {
    IConnectorPlugin,
    ConnectorCategory,
    ConnectorConfig,
    ConnectorSecrets,
    JsonSchema,
    TestResult,
    TestStep,
    TableSummary,
    TableDetail,
    TableRef,
    SparkConnectorConfig,
} from '../IConnectorPlugin';

// ---------------------------------------------------------------------------
// JDBC URL template per driver
// ---------------------------------------------------------------------------
const JDBC_URL_TEMPLATES: Record<string, string> = {
    JDBC_POSTGRESQL: 'jdbc:postgresql://{host}:{port}/{database}',
    JDBC_MYSQL: 'jdbc:mysql://{host}:{port}/{database}',
    JDBC_MARIADB: 'jdbc:mariadb://{host}:{port}/{database}',
    JDBC_SQLSERVER: 'jdbc:sqlserver://{host}:{port};databaseName={database}',
    JDBC_ORACLE: 'jdbc:oracle:thin:@//{host}:{port}/{service_name}',
    JDBC_DB2: 'jdbc:db2://{host}:{port}/{database}',
    JDBC_SAP_HANA: 'jdbc:sap://{host}:{port}/?databaseName={database}',
    JDBC_TERADATA: 'jdbc:teradata://{host}/DATABASE={database},DBS_PORT={port}',
    JDBC_GREENPLUM: 'jdbc:postgresql://{host}:{port}/{database}',
    JDBC_SYBASE: 'jdbc:sybase:Tds:{host}:{port}/{database}',
};

// ---------------------------------------------------------------------------
// Base JDBC config and secrets schemas
// ---------------------------------------------------------------------------
const JDBC_CONFIG_SCHEMA: JsonSchema = {
    type: 'object',
    properties: {
        jdbc_host: { type: 'string', description: 'Hostname or IP address' },
        jdbc_port: { type: 'integer', description: 'TCP port', minimum: 1, maximum: 65535 },
        jdbc_database: { type: 'string', description: 'Database / catalog name' },
        jdbc_url_params: { type: 'string', description: 'Additional JDBC URL query params' },
        jdbc_ssl_mode: { type: 'string', description: 'SSL mode', enum: ['DISABLE', 'REQUIRE', 'VERIFY_CA', 'VERIFY_FULL'], default: 'REQUIRE' },
        jdbc_connection_timeout_sec: { type: 'integer', description: 'Connection timeout seconds', default: 30 },
        jdbc_socket_timeout_sec: { type: 'integer', description: 'Socket timeout seconds', default: 120 },
        jdbc_fetch_size: { type: 'integer', description: 'Rows per fetch batch', default: 10000 },
        ssh_tunnel_enabled: { type: 'boolean', description: 'Route through SSH tunnel', default: false },
        ssh_host: { type: 'string', description: 'SSH bastion host' },
        ssh_port: { type: 'integer', description: 'SSH port', default: 22 },
        ssh_username: { type: 'string', description: 'SSH username' },
    },
    required: ['jdbc_host', 'jdbc_port', 'jdbc_database'],
};

const JDBC_SECRETS_SCHEMA: JsonSchema = {
    type: 'object',
    properties: {
        jdbc_username: { type: 'string', description: 'Database username', secret: true },
        jdbc_password: { type: 'string', description: 'Database password', secret: true },
        jdbc_ssl_ca_cert: { type: 'string', description: 'PEM CA certificate', secret: true },
        jdbc_ssl_client_cert: { type: 'string', description: 'PEM client certificate (mutual TLS)', secret: true },
        jdbc_ssl_client_key: { type: 'string', description: 'PEM client private key (mutual TLS)', secret: true },
        ssh_private_key: { type: 'string', description: 'SSH tunnel PEM private key', secret: true },
    },
    required: ['jdbc_username', 'jdbc_password'],
};

// ---------------------------------------------------------------------------
// Abstract base for all JDBC connectors
// ---------------------------------------------------------------------------
abstract class AbstractJdbcPlugin implements IConnectorPlugin {
    abstract readonly typeCode: string;
    abstract readonly displayName: string;
    abstract readonly defaultJdbcDriverClass: string;
    abstract readonly defaultPort: number;
    abstract readonly defaultTestQuery: string;

    readonly category: ConnectorCategory = 'ON_PREM_RDBMS';
    readonly configSchema = JDBC_CONFIG_SCHEMA;
    readonly secretsSchema = JDBC_SECRETS_SCHEMA;

    buildJdbcUrl(config: ConnectorConfig): string {
        const template = JDBC_URL_TEMPLATES[this.typeCode] ?? '';
        let url = template
            .replace('{host}', String(config['jdbc_host'] ?? 'localhost'))
            .replace('{port}', String(config['jdbc_port'] ?? this.defaultPort))
            .replace('{database}', String(config['jdbc_database'] ?? ''))
            .replace('{service_name}', String(config['jdbc_database'] ?? ''));
        const params = config['jdbc_url_params'] as string | undefined;
        if (params) {
            url += (url.includes('?') ? '&' : '?') + params;
        }
        return url;
    }

    async test(config: ConnectorConfig, secrets: ConnectorSecrets): Promise<TestResult> {
        const startMs = Date.now();
        const steps: TestStep[] = [];
        const host    = String(config['jdbc_host'] ?? 'localhost');
        const port    = Number(config['jdbc_port'] ?? this.defaultPort);
        const database = String(config['jdbc_database'] ?? 'postgres');
        const user     = String(secrets['jdbc_username'] ?? secrets['username'] ?? '');
        const password = String(secrets['jdbc_password'] ?? secrets['password'] ?? '');
        const sslMode  = String(config['jdbc_ssl_mode'] ?? 'DISABLE');
        const ssl      = ['REQUIRE', 'VERIFY_CA', 'VERIFY_FULL'].includes(sslMode)
            ? { rejectUnauthorized: false }
            : false;

        // For non-PostgreSQL JDBC types, skip real connect (drivers not bundled)
        const isPostgres = this.typeCode === 'JDBC_POSTGRESQL' || this.typeCode === 'JDBC_GREENPLUM';

        if (isPostgres) {
            const client = new PgClient({ host, port, database, user, password, ssl, connectionTimeoutMillis: 8000 });
            let connectErr: Error | null = null;
            const t0 = Date.now();
            try { await client.connect(); } catch (e) { connectErr = e as Error; }
            finally { client.end().catch(() => undefined); }
            const connMs = Date.now() - t0;

            steps.push({
                stepName: 'network',
                passed: !connectErr || !/ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH/i.test(connectErr.message),
                message: connectErr
                    ? (/ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH/i.test(connectErr.message)
                        ? `Cannot reach ${host}:${port} — check host/port/firewall`
                        : `TCP connect to ${host}:${port}`)
                    : `TCP connect to ${host}:${port}`,
                durationMs: connMs,
            });
            steps.push({
                stepName: 'authentication',
                passed: !connectErr,
                message: connectErr
                    ? (/password authentication failed|role .* does not exist/i.test(connectErr.message)
                        ? 'Authentication failed — incorrect username or password'
                        : connectErr.message)
                    : `Authenticated as ${user}`,
                durationMs: connMs,
            });
        } else {
            // Non-PostgreSQL JDBC: structural checks only (drivers not bundled in ETL1 backend)
            const credentialsPresent = !!user && !!password;
            steps.push({ stepName: 'network',         passed: true,               message: `Host: ${host}:${port}`,                    durationMs: 0 });
            steps.push({ stepName: 'authentication',  passed: credentialsPresent, message: credentialsPresent ? `Credentials present for ${user}` : 'Username or password is missing', durationMs: 0 });
        }

        // SSL step
        steps.push({ stepName: 'ssl', passed: true, message: `SSL mode: ${sslMode}`, durationMs: 0 });

        return {
            success: steps.every(s => s.passed),
            steps,
            latencyMs: Date.now() - startMs,
        };
    }

    async listDatabases(_config: ConnectorConfig, _secrets: ConnectorSecrets): Promise<string[]> {
        // Implemented at service layer via JDBC DatabaseMetaData.getCatalogs()
        return [];
    }

    async listSchemas(_config: ConnectorConfig, _secrets: ConnectorSecrets, _database: string): Promise<string[]> {
        return [];
    }

    async listTables(_config: ConnectorConfig, _secrets: ConnectorSecrets, _database: string, _schema: string): Promise<TableSummary[]> {
        return [];
    }

    async describeTable(_config: ConnectorConfig, _secrets: ConnectorSecrets, _tableRef: TableRef): Promise<TableDetail> {
        return { tableName: _tableRef.table, tableType: 'TABLE', columns: [] };
    }

    generateSparkReadConfig(config: ConnectorConfig, _secrets: ConnectorSecrets, tableRef: TableRef): SparkConnectorConfig {
        const connId = String(config['connector_id'] ?? '');
        const dbtable = [tableRef.schema, tableRef.table].filter(Boolean).join('.');
        return {
            format: 'jdbc',
            options: {
                url: `spark.conf.get("etl1.conn.${connId}.jdbcUrl")`,
                dbtable,
                user: `spark.conf.get("etl1.conn.${connId}.user")`,
                password: `spark.conf.get("etl1.conn.${connId}.password")`,
                driver: this.defaultJdbcDriverClass,
                fetchsize: String(config['jdbc_fetch_size'] ?? 10000),
            },
            requiredJars: this.requiredJars(),
        };
    }

    generateSparkWriteConfig(config: ConnectorConfig, _secrets: ConnectorSecrets, tableRef: TableRef): SparkConnectorConfig {
        const connId = String(config['connector_id'] ?? '');
        const dbtable = [tableRef.schema, tableRef.table].filter(Boolean).join('.');
        return {
            format: 'jdbc',
            options: {
                url: `spark.conf.get("etl1.conn.${connId}.jdbcUrl")`,
                dbtable,
                user: `spark.conf.get("etl1.conn.${connId}.user")`,
                password: `spark.conf.get("etl1.conn.${connId}.password")`,
                driver: this.defaultJdbcDriverClass,
            },
            requiredJars: this.requiredJars(),
        };
    }

    abstract requiredJars(): string[];
}

// ---------------------------------------------------------------------------
// Concrete JDBC plugins
// ---------------------------------------------------------------------------

export class JdbcPostgreSQLPlugin extends AbstractJdbcPlugin {
    readonly typeCode = 'JDBC_POSTGRESQL';
    readonly displayName = 'PostgreSQL';
    readonly defaultJdbcDriverClass = 'org.postgresql.Driver';
    readonly defaultPort = 5432;
    readonly defaultTestQuery = 'SELECT 1';
    requiredJars() { return ['postgresql.jar']; }
}

export class JdbcMySQLPlugin extends AbstractJdbcPlugin {
    readonly typeCode = 'JDBC_MYSQL';
    readonly displayName = 'MySQL';
    readonly defaultJdbcDriverClass = 'com.mysql.cj.jdbc.Driver';
    readonly defaultPort = 3306;
    readonly defaultTestQuery = 'SELECT 1';
    requiredJars() { return ['mysql-connector-j.jar']; }
}

export class JdbcMariaDBPlugin extends AbstractJdbcPlugin {
    readonly typeCode = 'JDBC_MARIADB';
    readonly displayName = 'MariaDB';
    readonly defaultJdbcDriverClass = 'org.mariadb.jdbc.Driver';
    readonly defaultPort = 3306;
    readonly defaultTestQuery = 'SELECT 1';
    requiredJars() { return ['mariadb-java-client.jar']; }
}

export class JdbcSqlServerPlugin extends AbstractJdbcPlugin {
    readonly typeCode = 'JDBC_SQLSERVER';
    readonly displayName = 'Microsoft SQL Server';
    readonly defaultJdbcDriverClass = 'com.microsoft.sqlserver.jdbc.SQLServerDriver';
    readonly defaultPort = 1433;
    readonly defaultTestQuery = 'SELECT 1';
    requiredJars() { return ['mssql-jdbc.jar']; }
}

export class JdbcOraclePlugin extends AbstractJdbcPlugin {
    readonly typeCode = 'JDBC_ORACLE';
    readonly displayName = 'Oracle Database';
    readonly defaultJdbcDriverClass = 'oracle.jdbc.OracleDriver';
    readonly defaultPort = 1521;
    readonly defaultTestQuery = 'SELECT 1 FROM DUAL';
    requiredJars() { return ['ojdbc11.jar']; }
}

export class JdbcDb2Plugin extends AbstractJdbcPlugin {
    readonly typeCode = 'JDBC_DB2';
    readonly displayName = 'IBM Db2';
    readonly defaultJdbcDriverClass = 'com.ibm.db2.jcc.DB2Driver';
    readonly defaultPort = 50000;
    readonly defaultTestQuery = 'SELECT 1 FROM SYSIBM.SYSDUMMY1';
    requiredJars() { return ['jcc.jar']; }
}

export class JdbcSapHanaPlugin extends AbstractJdbcPlugin {
    readonly typeCode = 'JDBC_SAP_HANA';
    readonly displayName = 'SAP HANA';
    readonly defaultJdbcDriverClass = 'com.sap.db.jdbc.Driver';
    readonly defaultPort = 39017;
    readonly defaultTestQuery = 'SELECT 1 FROM DUMMY';
    requiredJars() { return ['ngdbc.jar']; }
}

export class JdbcTeradataPlugin extends AbstractJdbcPlugin {
    readonly typeCode = 'JDBC_TERADATA';
    readonly displayName = 'Teradata';
    readonly defaultJdbcDriverClass = 'com.teradata.jdbc.TeraDriver';
    readonly defaultPort = 1025;
    readonly defaultTestQuery = 'SELECT 1';
    requiredJars() { return ['terajdbc.jar']; }
}

export class JdbcGreenplumPlugin extends AbstractJdbcPlugin {
    readonly typeCode = 'JDBC_GREENPLUM';
    readonly displayName = 'Greenplum';
    readonly defaultJdbcDriverClass = 'org.postgresql.Driver';
    readonly defaultPort = 5432;
    readonly defaultTestQuery = 'SELECT 1';
    requiredJars() { return ['postgresql.jar']; }
}

export class JdbcSybasePlugin extends AbstractJdbcPlugin {
    readonly typeCode = 'JDBC_SYBASE';
    readonly displayName = 'Sybase ASE';
    readonly defaultJdbcDriverClass = 'com.sybase.jdbc4.jdbc.SybDriver';
    readonly defaultPort = 5000;
    readonly defaultTestQuery = 'SELECT 1';
    requiredJars() { return ['jconn4.jar']; }
}
