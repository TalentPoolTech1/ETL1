/**
 * ConnectorRegistry — Singleton registry for all connector plugins.
 *
 * At startup, all plugin modules are imported and registered. The
 * ConnectionService resolves the correct plugin for a given
 * connector_type_code using ConnectorRegistry.get().
 */

import { LoggerFactory } from '../shared/logging';
import { IConnectorPlugin } from './IConnectorPlugin';

// Import all plugin modules
import { JdbcPostgreSQLPlugin } from './plugins/JdbcConnectorPlugin';
import { JdbcMySQLPlugin } from './plugins/JdbcConnectorPlugin';
import { JdbcMariaDBPlugin } from './plugins/JdbcConnectorPlugin';
import { JdbcSqlServerPlugin } from './plugins/JdbcConnectorPlugin';
import { JdbcOraclePlugin } from './plugins/JdbcConnectorPlugin';
import { JdbcDb2Plugin } from './plugins/JdbcConnectorPlugin';
import { JdbcSapHanaPlugin } from './plugins/JdbcConnectorPlugin';
import { JdbcTeradataPlugin } from './plugins/JdbcConnectorPlugin';
import { JdbcGreenplumPlugin } from './plugins/JdbcConnectorPlugin';
import { JdbcSybasePlugin } from './plugins/JdbcConnectorPlugin';
import { AwsS3Plugin, AwsRedshiftPlugin, AwsRdsPlugin } from './plugins/AwsConnectorPlugin';
import { GcpGcsPlugin, GcpBigQueryPlugin, GcpBigtablePlugin } from './plugins/GcpConnectorPlugin';
import { AzureBlobPlugin, AzureAdlsGen2Plugin, AzureSynapsePlugin } from './plugins/AzureConnectorPlugin';
import { SnowflakePlugin } from './plugins/SnowflakeConnectorPlugin';
import { DatabricksPlugin } from './plugins/DatabricksConnectorPlugin';
import { OciObjectPlugin, OciAutonomousDbPlugin } from './plugins/OciConnectorPlugin';
import { FileFormatPlugin } from './plugins/FileFormatConnectorPlugin';

const log = LoggerFactory.get('connections');

class ConnectorRegistryClass {
    private readonly plugins = new Map<string, IConnectorPlugin>();

    constructor() {
        this.registerAll();
    }

    /**
     * Resolves the plugin for a given connector type code.
     * Returns undefined if the type code is not registered.
     */
    get(typeCode: string): IConnectorPlugin | undefined {
        return this.plugins.get(typeCode);
    }

    /** Returns all registered type codes. */
    getRegisteredTypeCodes(): string[] {
        return Array.from(this.plugins.keys());
    }

    /** Returns all registered plugins grouped by category. */
    getPluginsByCategory(): Map<string, IConnectorPlugin[]> {
        const grouped = new Map<string, IConnectorPlugin[]>();
        for (const plugin of this.plugins.values()) {
            const existing = grouped.get(plugin.category) ?? [];
            existing.push(plugin);
            grouped.set(plugin.category, existing);
        }
        return grouped;
    }

    private register(plugin: IConnectorPlugin): void {
        if (this.plugins.has(plugin.typeCode)) {
            log.warn('connections.registry.duplicate', `Duplicate connector plugin registration for typeCode="${plugin.typeCode}" — skipping`, { typeCode: plugin.typeCode });
            return;
        }
        this.plugins.set(plugin.typeCode, plugin);
    }

    private registerAll(): void {
        // JDBC on-prem databases
        [
            new JdbcPostgreSQLPlugin(),
            new JdbcMySQLPlugin(),
            new JdbcMariaDBPlugin(),
            new JdbcSqlServerPlugin(),
            new JdbcOraclePlugin(),
            new JdbcDb2Plugin(),
            new JdbcSapHanaPlugin(),
            new JdbcTeradataPlugin(),
            new JdbcGreenplumPlugin(),
            new JdbcSybasePlugin(),
        ].forEach(p => this.register(p));

        // AWS connectors
        [new AwsS3Plugin(), new AwsRedshiftPlugin(), new AwsRdsPlugin()]
            .forEach(p => this.register(p));

        // GCP connectors
        [new GcpGcsPlugin(), new GcpBigQueryPlugin(), new GcpBigtablePlugin()]
            .forEach(p => this.register(p));

        // Azure connectors
        [new AzureBlobPlugin(), new AzureAdlsGen2Plugin(), new AzureSynapsePlugin()]
            .forEach(p => this.register(p));

        // Snowflake
        this.register(new SnowflakePlugin());

        // Databricks
        this.register(new DatabricksPlugin());

        // OCI connectors
        [new OciObjectPlugin(), new OciAutonomousDbPlugin()]
            .forEach(p => this.register(p));

        // File format connectors (each format gets its own type code)
        const fileFormats = ['CSV', 'PARQUET', 'ORC', 'JSON', 'XML', 'EXCEL', 'AVRO', 'FIXED_WIDTH', 'DELTA', 'ICEBERG', 'HUDI'];
        fileFormats.forEach(fmt => this.register(new FileFormatPlugin(fmt)));

        log.info('connections.registry.init', `ConnectorRegistry initialised with ${this.plugins.size} plugins`, { pluginCount: this.plugins.size });
    }
}

export const ConnectorRegistry = new ConnectorRegistryClass();
