/**
 * ConnectionsService — Business logic for connector CRUD, test, health,
 * and metadata browsing (listDatabases, listSchemas, listTables, describeTable).
 *
 * Uses LoggerFactory.get('connections') for all logging.
 * Wraps all raw exceptions into AppError via connErrors catalog.
 * Delegates connector-specific logic to IConnectorPlugin via ConnectorRegistry.
 * Delegates all DB operations to ConnectionsRepository.
 */

import { LoggerFactory } from '../../shared/logging';
import { connErrors } from '../../shared/errors/catalog/conn.errors';
import { ConnectorRegistry } from '../../connectors/ConnectorRegistry';
import {
    IConnectorPlugin, ConnectorConfig, ConnectorSecrets,
    TestResult, TableSummary, TableDetail,
} from '../../connectors/IConnectorPlugin';
import { AppError } from '../../shared/errors/AppError';
import { connectionsRepository, ConnectorRow } from '../../db/repositories/connections.repository';

const log = LoggerFactory.get('connections');

// ─── Env helper ──────────────────────────────────────────────────────────────

function getEncryptionKey(): string {
    const key = process.env['APP_ENCRYPTION_KEY'];
    if (!key) {
        throw connErrors.unexpected(new Error('APP_ENCRYPTION_KEY environment variable is not set'));
    }
    return key;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateConnectorInput {
    connectorDisplayName: string;
    connectorTypeCode: string;
    config: ConnectorConfig;
    secrets?: ConnectorSecrets;
    jdbcDriverClass?: string;
    testQuery?: string;
    sparkConfig?: Record<string, string>;
    sslMode?: string;
    sshTunnel?: ConnectorConfig;
    proxy?: ConnectorConfig;
    maxPoolSize?: number;
    idleTimeoutSec?: number;
    userId: string;
}

export interface UpdateConnectorInput {
    connectorId: string;
    connectorDisplayName?: string;
    config?: ConnectorConfig;
    secrets?: ConnectorSecrets;
    jdbcDriverClass?: string;
    testQuery?: string;
    sparkConfig?: Record<string, string>;
    sslMode?: string;
    sshTunnel?: ConnectorConfig;
    proxy?: ConnectorConfig;
    maxPoolSize?: number;
    idleTimeoutSec?: number;
    userId: string;
}

export interface ConnectorSummary {
    connectorId: string;
    connectorDisplayName: string;
    connectorTypeCode: string;
    connSslMode: string;
    connMaxPoolSizeNum: number;
    healthStatusCode: string;
    createdByFullName: string | null;
    updatedDtm: string;
}

export interface TestConnectorInput {
    connectorId: string;
    userId: string;
}

export interface HealthResult {
    healthStatusCode: string;
    checkLatencyMs: number | null;
    checkErrorText: string | null;
    consecutiveFailNum: number;
    lastCheckDtm: string | null;
    nextCheckDtm: string | null;
}

export interface MetadataBrowseInput {
    connectorId: string;
    userId: string;
    database?: string;
    schema?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ConnectionsService {

    // ─── List ─────────────────────────────────────────────────────────────────

    async listConnectors(userId: string): Promise<ConnectorSummary[]> {
        log.info('connections.list', 'Listing all connectors');
        try {
            const rows = await connectionsRepository.listAll(userId, getEncryptionKey());
            return rows.map(r => this.toSummary(r));
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw connErrors.unexpected(err as Error);
        }
    }

    async getConnector(connectorId: string, userId: string): Promise<ConnectorSummary> {
        log.debug('connections.get', 'Getting connector', { connectorId });
        try {
            const row = await connectionsRepository.getById(connectorId, userId, getEncryptionKey());
            if (!row) throw connErrors.notFound(connectorId);
            return this.toSummary(row);
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw connErrors.unexpected(err as Error);
        }
    }

    // ─── Create ───────────────────────────────────────────────────────────────

    async createConnector(input: CreateConnectorInput): Promise<{ connectorId: string }> {
        log.info('connections.create', `Creating connector: ${input.connectorDisplayName}`, {
            typeCode: input.connectorTypeCode,
            displayName: input.connectorDisplayName,
        });

        this.validateConnectorType(input.connectorTypeCode);

        if (!input.connectorDisplayName?.trim()) {
            throw connErrors.nameRequired();
        }

        const plugin = ConnectorRegistry.get(input.connectorTypeCode)!;
        this.validateConfig(plugin, input.config, input.secrets);

        if (input.sslMode) this.validateSslMode(input.sslMode);

        if (input.maxPoolSize !== undefined && (input.maxPoolSize < 1 || input.maxPoolSize > 100)) {
            throw connErrors.portInvalid(input.maxPoolSize);
        }

        try {
            const connectorId = await connectionsRepository.create({
                connectorDisplayName: input.connectorDisplayName,
                connectorTypeCode: input.connectorTypeCode,
                configJson: input.config,
                secretsJson: input.secrets ?? null,
                jdbcDriverClass: input.jdbcDriverClass ?? null,
                testQuery: input.testQuery ?? null,
                sparkConfigJson: input.sparkConfig ?? null,
                sslMode: input.sslMode ?? 'REQUIRE',
                sshTunnelJson: (input.sshTunnel ?? null) as Record<string, unknown> | null,
                proxyJson: (input.proxy ?? null) as Record<string, unknown> | null,
                maxPoolSize: input.maxPoolSize,
                idleTimeoutSec: input.idleTimeoutSec,
                userId: input.userId,
                encryptionKey: getEncryptionKey(),
            });

            log.info('connections.create.success', `Connector created: ${input.connectorDisplayName}`, {
                connectorId,
                typeCode: input.connectorTypeCode,
            });

            return { connectorId };
        } catch (err) {
            if (err instanceof AppError) throw err;
            const error = err as Error;
            if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
                throw connErrors.duplicateName(input.connectorDisplayName);
            }
            throw connErrors.unexpected(error);
        }
    }

    // ─── Update ───────────────────────────────────────────────────────────────

    async updateConnector(input: UpdateConnectorInput): Promise<void> {
        log.info('connections.update', `Updating connector: ${input.connectorId}`, {
            connectorId: input.connectorId,
        });

        if (input.sslMode) this.validateSslMode(input.sslMode);
        if (input.maxPoolSize !== undefined && (input.maxPoolSize < 1 || input.maxPoolSize > 100)) {
            throw connErrors.portInvalid(input.maxPoolSize);
        }

        try {
            const existing = await connectionsRepository.getById(input.connectorId, input.userId, getEncryptionKey());
            if (!existing) throw connErrors.notFound(input.connectorId);

            if (input.config) {
                const plugin = ConnectorRegistry.get(existing.connector_type_code)!;
                this.validateConfig(plugin, input.config, input.secrets);
            }

            await connectionsRepository.update({
                connectorId: input.connectorId,
                connectorDisplayName: input.connectorDisplayName,
                configJson: input.config,
                secretsJson: input.secrets,
                jdbcDriverClass: input.jdbcDriverClass,
                testQuery: input.testQuery,
                sparkConfigJson: input.sparkConfig,
                sslMode: input.sslMode,
                sshTunnelJson: input.sshTunnel as Record<string, unknown> | undefined,
                proxyJson: input.proxy as Record<string, unknown> | undefined,
                maxPoolSize: input.maxPoolSize,
                idleTimeoutSec: input.idleTimeoutSec,
                userId: input.userId,
                encryptionKey: getEncryptionKey(),
            });

            log.info('connections.update.success', `Connector updated: ${input.connectorId}`, {
                connectorId: input.connectorId,
            });
        } catch (err) {
            if (err instanceof AppError) throw err;
            const error = err as Error;
            if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
                throw connErrors.duplicateName(input.connectorDisplayName ?? '');
            }
            throw connErrors.unexpected(error);
        }
    }

    // ─── Delete ───────────────────────────────────────────────────────────────

    async deleteConnector(connectorId: string, userId: string): Promise<void> {
        log.info('connections.delete', `Deleting connector: ${connectorId}`, { connectorId });

        try {
            const existing = await connectionsRepository.getById(connectorId, userId, getEncryptionKey());
            if (!existing) throw connErrors.notFound(connectorId);

            const datasetCount = await connectionsRepository.countDependentDatasets(connectorId);
            if (datasetCount > 0) {
                throw connErrors.hasDependentDatasets(connectorId, datasetCount);
            }

            await connectionsRepository.delete(connectorId, userId, getEncryptionKey());
            log.info('connections.delete.success', `Connector deleted: ${connectorId}`, { connectorId });
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw connErrors.unexpected(err as Error);
        }
    }

    // ─── Test ─────────────────────────────────────────────────────────────────

    async testConnector(input: TestConnectorInput): Promise<TestResult> {
        log.info('connections.test', `Testing connector: ${input.connectorId}`, {
            connectorId: input.connectorId,
        });

        const startMs = Date.now();

        try {
            const row = await connectionsRepository.getDecrypted(input.connectorId, input.userId, getEncryptionKey());
            if (!row) throw connErrors.notFound(input.connectorId);

            const plugin = ConnectorRegistry.get(row.connector_type_code);
            if (!plugin) throw connErrors.unsupportedConnectorType(row.connector_type_code);

            const config: ConnectorConfig = { ...row.conn_config_json, connector_id: input.connectorId };
            const secrets: ConnectorSecrets = row.conn_secrets_json ?? {};

            const testResult = await plugin.test(config, secrets);
            testResult.latencyMs = Date.now() - startMs;

            const errorText = testResult.success
                ? null
                : testResult.steps.find(s => !s.passed)?.message ?? 'Test failed';

            connectionsRepository.recordTestResult(
                input.connectorId, testResult.success, testResult.latencyMs,
                testResult.steps, errorText, input.userId, getEncryptionKey(),
            ).catch(err => {
                log.warn('connections.test.record', 'Failed to record test result', {
                    connectorId: input.connectorId, err: String(err),
                });
            });

            log.info('connections.test.complete',
                `Connection test ${testResult.success ? 'PASSED' : 'FAILED'} in ${testResult.latencyMs}ms`,
                { connectorId: input.connectorId, passed: testResult.success, latencyMs: testResult.latencyMs },
            );

            return testResult;
        } catch (err) {
            if (err instanceof AppError) throw err;
            const error = err as Error;
            if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
                throw connErrors.hostUnreachable(input.connectorId, error);
            }
            if (error.message?.includes('authentication') || error.message?.includes('password')) {
                throw connErrors.authFailed(input.connectorId, error);
            }
            if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
                throw connErrors.testTimeout(input.connectorId, 30, error);
            }
            if (error.message?.includes('SSL') || error.message?.includes('certificate')) {
                throw connErrors.sslCertVerifyFailed(input.connectorId, error);
            }
            throw connErrors.unexpected(error);
        }
    }

    // ─── Health ───────────────────────────────────────────────────────────────

    async getHealth(connectorId: string): Promise<HealthResult | null> {
        log.debug('connections.health.get', `Getting health for: ${connectorId}`, { connectorId });
        try {
            const row = await connectionsRepository.getHealth(connectorId);
            if (!row) return null;
            return {
                healthStatusCode: row.health_status_code,
                checkLatencyMs: row.check_latency_ms,
                checkErrorText: row.check_error_text,
                consecutiveFailNum: row.consecutive_fail_num,
                lastCheckDtm: row.last_check_dtm,
                nextCheckDtm: row.next_check_dtm,
            };
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw connErrors.unexpected(err as Error);
        }
    }

    // ─── Metadata browsing ────────────────────────────────────────────────────

    async listDatabases(input: MetadataBrowseInput): Promise<string[]> {
        log.info('connections.metadata.listDatabases', 'Listing databases', { connectorId: input.connectorId });
        try {
            const { plugin, config, secrets } = await this.resolvePluginAndCredentials(input.connectorId, input.userId);
            return plugin.listDatabases(config, secrets);
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw connErrors.unexpected(err as Error);
        }
    }

    async listSchemas(input: MetadataBrowseInput): Promise<string[]> {
        if (!input.database) throw connErrors.hostRequired();
        log.info('connections.metadata.listSchemas', 'Listing schemas', {
            connectorId: input.connectorId, database: input.database,
        });
        try {
            const { plugin, config, secrets } = await this.resolvePluginAndCredentials(input.connectorId, input.userId);
            return plugin.listSchemas(config, secrets, input.database);
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw connErrors.unexpected(err as Error);
        }
    }

    async listTables(input: MetadataBrowseInput): Promise<TableSummary[]> {
        if (!input.database) throw connErrors.hostRequired();
        if (!input.schema) throw connErrors.hostRequired();
        log.info('connections.metadata.listTables', 'Listing tables', {
            connectorId: input.connectorId, database: input.database, schema: input.schema,
        });
        try {
            const { plugin, config, secrets } = await this.resolvePluginAndCredentials(input.connectorId, input.userId);
            return plugin.listTables(config, secrets, input.database, input.schema);
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw connErrors.unexpected(err as Error);
        }
    }

    async describeTable(
        connectorId: string, database: string, schema: string, table: string, userId: string,
    ): Promise<TableDetail> {
        log.info('connections.metadata.describeTable', 'Describing table', { connectorId, database, schema, table });
        try {
            const { plugin, config, secrets } = await this.resolvePluginAndCredentials(connectorId, userId);
            return plugin.describeTable(config, secrets, { database, schema, table });
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw connErrors.unexpected(err as Error);
        }
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    private async resolvePluginAndCredentials(connectorId: string, userId: string): Promise<{
        plugin: IConnectorPlugin;
        config: ConnectorConfig;
        secrets: ConnectorSecrets;
    }> {
        const row = await connectionsRepository.getDecrypted(connectorId, userId, getEncryptionKey());
        if (!row) throw connErrors.notFound(connectorId);
        const plugin = ConnectorRegistry.get(row.connector_type_code);
        if (!plugin) throw connErrors.unsupportedConnectorType(row.connector_type_code);
        return {
            plugin,
            config: { ...row.conn_config_json, connector_id: connectorId },
            secrets: row.conn_secrets_json ?? {},
        };
    }

    private validateConnectorType(typeCode: string): void {
        if (!ConnectorRegistry.get(typeCode)) throw connErrors.unsupportedConnectorType(typeCode);
    }

    private validateSslMode(mode: string): void {
        const valid = ['DISABLE', 'REQUIRE', 'VERIFY_CA', 'VERIFY_FULL'];
        if (!valid.includes(mode)) throw connErrors.connectionStringInvalid();
    }

    private validateConfig(plugin: IConnectorPlugin, config: ConnectorConfig, secrets?: ConnectorSecrets): void {
        for (const field of plugin.configSchema.required ?? []) {
            if (config[field] === undefined || config[field] === null || config[field] === '') {
                throw connErrors.hostRequired();
            }
        }
        for (const field of plugin.secretsSchema.required ?? []) {
            if (!secrets || secrets[field] === undefined || secrets[field] === null || secrets[field] === '') {
                throw connErrors.authFailed('new', new Error(`Missing required secret: ${field}`));
            }
        }
        if (config['jdbc_port'] !== undefined) {
            const port = Number(config['jdbc_port']);
            if (isNaN(port) || port < 1 || port > 65535) throw connErrors.portInvalid(config['jdbc_port']);
        }
    }

    private toSummary(row: ConnectorRow): ConnectorSummary {
        return {
            connectorId: row.connector_id,
            connectorDisplayName: row.connector_display_name,
            connectorTypeCode: row.connector_type_code,
            connSslMode: row.conn_ssl_mode,
            connMaxPoolSizeNum: row.conn_max_pool_size_num,
            healthStatusCode: 'UNKNOWN',
            createdByFullName: row.created_by_name,
            updatedDtm: row.updated_dtm,
        };
    }
}

export const connectionsService = new ConnectionsService();
