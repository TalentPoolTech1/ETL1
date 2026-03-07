/**
 * ConnectionsRepository — Data access layer for catalog.connectors.
 *
 * All encryption/decryption is performed at the DB layer via pgcrypto:
 *   pgp_sym_encrypt(value, app.encryption_key)
 *   pgp_sym_decrypt(value::bytea, app.encryption_key)
 *
 * Every DB call sets LOCAL session variables before executing:
 *   SET LOCAL app.user_id = '<uuid>';
 *   SET LOCAL app.encryption_key = '<secret>';
 */

import { PoolClient, QueryResult } from 'pg';
import { db } from '../connection';
import { LoggerFactory } from '../../shared/logging';
import { connErrors } from '../../shared/errors/catalog/conn.errors';
import { AppError } from '../../shared/errors/AppError';

const log = LoggerFactory.get('connections');

// ─── Row shapes returned from DB queries ─────────────────────────────────────

export interface ConnectorRow {
    connector_id: string;
    connector_display_name: string;
    connector_type_code: string;
    conn_ssl_mode: string;
    conn_max_pool_size_num: number;
    conn_idle_timeout_sec: number;
    conn_jdbc_driver_class: string | null;
    conn_test_query: string | null;
    conn_spark_config_json: Record<string, string> | null;
    created_dtm: string;
    updated_dtm: string;
    created_by_user_id: string | null;
    updated_by_user_id: string | null;
    created_by_name: string | null;
}

export interface ConnectorDecryptedRow extends ConnectorRow {
    conn_config_json: Record<string, unknown>;
    conn_secrets_json: Record<string, unknown> | null;
    conn_ssh_tunnel_json: Record<string, unknown> | null;
    conn_proxy_json: Record<string, unknown> | null;
}

export interface ConnectorHealthRow {
    health_status_code: string;
    check_latency_ms: number | null;
    check_error_text: string | null;
    consecutive_fail_num: number;
    last_check_dtm: string | null;
    next_check_dtm: string | null;
}

export interface CreateConnectorParams {
    connectorDisplayName: string;
    connectorTypeCode: string;
    configJson: Record<string, unknown>;
    secretsJson?: Record<string, unknown> | null;
    jdbcDriverClass?: string | null;
    testQuery?: string | null;
    sparkConfigJson?: Record<string, string> | null;
    sslMode?: string;
    sshTunnelJson?: Record<string, unknown> | null;
    proxyJson?: Record<string, unknown> | null;
    maxPoolSize?: number;
    idleTimeoutSec?: number;
    userId: string;
    encryptionKey: string;
}

export interface UpdateConnectorParams {
    connectorId: string;
    connectorDisplayName?: string;
    configJson?: Record<string, unknown>;
    secretsJson?: Record<string, unknown> | null;
    jdbcDriverClass?: string | null;
    testQuery?: string | null;
    sparkConfigJson?: Record<string, string> | null;
    sslMode?: string;
    sshTunnelJson?: Record<string, unknown> | null;
    proxyJson?: Record<string, unknown> | null;
    maxPoolSize?: number;
    idleTimeoutSec?: number;
    userId: string;
    encryptionKey: string;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class ConnectionsRepository {

    /** Set mandatory session variables before any DB operation. */
    private async setSession(client: PoolClient, userId: string, encryptionKey: string): Promise<void> {
        await client.query(`SET LOCAL app.user_id = $1`, [userId]);
        await client.query(`SET LOCAL app.encryption_key = $1`, [encryptionKey]);
    }

    /**
     * List all connectors (non-sensitive summary — no encrypted fields decrypted).
     */
    async listAll(userId: string, encryptionKey: string): Promise<ConnectorRow[]> {
        log.debug('connections.repo.list', 'Querying catalog.connectors');
        return db.transaction(async (client) => {
            await this.setSession(client, userId, encryptionKey);
            const result: QueryResult<ConnectorRow> = await client.query(`
                SELECT
                    c.connector_id,
                    c.connector_display_name,
                    c.connector_type_code,
                    c.conn_ssl_mode,
                    c.conn_max_pool_size_num,
                    c.conn_idle_timeout_sec,
                    c.conn_jdbc_driver_class,
                    c.conn_test_query,
                    c.conn_spark_config_json,
                    c.created_dtm,
                    c.updated_dtm,
                    c.created_by_user_id,
                    c.updated_by_user_id,
                    u.user_full_name AS created_by_name
                FROM catalog.connectors c
                LEFT JOIN etl.users u ON u.user_id = c.created_by_user_id
                ORDER BY c.connector_display_name
            `);
            return result.rows;
        });
    }

    /**
     * Get a single connector by ID (summary only — no decryption).
     */
    async getById(connectorId: string, userId: string, encryptionKey: string): Promise<ConnectorRow | null> {
        log.debug('connections.repo.getById', 'Fetching connector', { connectorId });
        return db.transaction(async (client) => {
            await this.setSession(client, userId, encryptionKey);
            const result: QueryResult<ConnectorRow> = await client.query(`
                SELECT
                    c.connector_id,
                    c.connector_display_name,
                    c.connector_type_code,
                    c.conn_ssl_mode,
                    c.conn_max_pool_size_num,
                    c.conn_idle_timeout_sec,
                    c.conn_jdbc_driver_class,
                    c.conn_test_query,
                    c.conn_spark_config_json,
                    c.created_dtm,
                    c.updated_dtm,
                    c.created_by_user_id,
                    c.updated_by_user_id,
                    u.user_full_name AS created_by_name
                FROM catalog.connectors c
                LEFT JOIN etl.users u ON u.user_id = c.created_by_user_id
                WHERE c.connector_id = $1
            `, [connectorId]);
            return result.rows[0] ?? null;
        });
    }

    /**
     * Get a connector with decrypted config and secrets for test/execution use.
     * AUDIT: Every call to this method is logged at INFO level.
     */
    async getDecrypted(connectorId: string, userId: string, encryptionKey: string): Promise<ConnectorDecryptedRow | null> {
        log.info('connections.repo.getDecrypted',
            'AUDIT: Decrypting connector credentials',
            { connectorId, requestedByUserId: userId },
        );
        return db.transaction(async (client) => {
            await this.setSession(client, userId, encryptionKey);
            const result: QueryResult<ConnectorDecryptedRow> = await client.query(`
                SELECT
                    c.connector_id,
                    c.connector_display_name,
                    c.connector_type_code,
                    c.conn_ssl_mode,
                    c.conn_max_pool_size_num,
                    c.conn_idle_timeout_sec,
                    c.conn_jdbc_driver_class,
                    c.conn_test_query,
                    c.conn_spark_config_json,
                    c.created_dtm,
                    c.updated_dtm,
                    c.created_by_user_id,
                    c.updated_by_user_id,
                    NULL AS created_by_name,
                    pgp_sym_decrypt(
                        c.conn_config_json_encrypted::bytea,
                        current_setting('app.encryption_key')
                    )::jsonb AS conn_config_json,
                    CASE WHEN c.conn_secrets_json_encrypted IS NOT NULL THEN
                        pgp_sym_decrypt(
                            c.conn_secrets_json_encrypted::bytea,
                            current_setting('app.encryption_key')
                        )::jsonb
                    ELSE NULL END AS conn_secrets_json,
                    CASE WHEN c.conn_ssh_tunnel_json_encrypted IS NOT NULL THEN
                        pgp_sym_decrypt(
                            c.conn_ssh_tunnel_json_encrypted::bytea,
                            current_setting('app.encryption_key')
                        )::jsonb
                    ELSE NULL END AS conn_ssh_tunnel_json,
                    CASE WHEN c.conn_proxy_json_encrypted IS NOT NULL THEN
                        pgp_sym_decrypt(
                            c.conn_proxy_json_encrypted::bytea,
                            current_setting('app.encryption_key')
                        )::jsonb
                    ELSE NULL END AS conn_proxy_json
                FROM catalog.connectors c
                WHERE c.connector_id = $1
            `, [connectorId]);
            return result.rows[0] ?? null;
        });
    }

    /**
     * Create a new connector. All JSON fields encrypted by pgcrypto at DB layer.
     */
    async create(params: CreateConnectorParams): Promise<string> {
        log.info('connections.repo.create', 'Inserting connector', {
            displayName: params.connectorDisplayName,
            typeCode: params.connectorTypeCode,
        });
        return db.transaction(async (client) => {
            await this.setSession(client, params.userId, params.encryptionKey);
            const result: QueryResult<{ connector_id: string }> = await client.query(`
                INSERT INTO catalog.connectors (
                    connector_display_name,
                    connector_type_code,
                    conn_config_json_encrypted,
                    conn_secrets_json_encrypted,
                    conn_jdbc_driver_class,
                    conn_test_query,
                    conn_spark_config_json,
                    conn_ssl_mode,
                    conn_ssh_tunnel_json_encrypted,
                    conn_proxy_json_encrypted,
                    conn_max_pool_size_num,
                    conn_idle_timeout_sec,
                    created_by_user_id,
                    updated_by_user_id
                ) VALUES (
                    $1,
                    $2,
                    pgp_sym_encrypt($3::text, current_setting('app.encryption_key')),
                    CASE WHEN $4::text IS NOT NULL THEN
                        pgp_sym_encrypt($4::text, current_setting('app.encryption_key'))
                    ELSE NULL END,
                    $5,
                    $6,
                    $7::jsonb,
                    $8,
                    CASE WHEN $9::text IS NOT NULL THEN
                        pgp_sym_encrypt($9::text, current_setting('app.encryption_key'))
                    ELSE NULL END,
                    CASE WHEN $10::text IS NOT NULL THEN
                        pgp_sym_encrypt($10::text, current_setting('app.encryption_key'))
                    ELSE NULL END,
                    $11,
                    $12,
                    $13::uuid,
                    $13::uuid
                )
                RETURNING connector_id
            `, [
                params.connectorDisplayName,
                params.connectorTypeCode,
                JSON.stringify(params.configJson),
                params.secretsJson ? JSON.stringify(params.secretsJson) : null,
                params.jdbcDriverClass ?? null,
                params.testQuery ?? null,
                params.sparkConfigJson ? JSON.stringify(params.sparkConfigJson) : null,
                params.sslMode ?? 'REQUIRE',
                params.sshTunnelJson ? JSON.stringify(params.sshTunnelJson) : null,
                params.proxyJson ? JSON.stringify(params.proxyJson) : null,
                params.maxPoolSize ?? 5,
                params.idleTimeoutSec ?? 600,
                params.userId,
            ]);
            return result.rows[0]!.connector_id;
        });
    }

    /**
     * Update an existing connector. Only non-null fields are updated.
     */
    async update(params: UpdateConnectorParams): Promise<void> {
        log.info('connections.repo.update', 'Updating connector', { connectorId: params.connectorId });
        await db.transaction(async (client) => {
            await this.setSession(client, params.userId, params.encryptionKey);

            const setClauses: string[] = ['updated_dtm = CURRENT_TIMESTAMP', 'updated_by_user_id = $1::uuid'];
            const values: unknown[] = [params.userId];
            let idx = 2;

            const addField = (clause: string, value: unknown) => {
                setClauses.push(`${clause} = $${idx++}`);
                values.push(value);
            };
            const addEncrypted = (col: string, value: unknown) => {
                setClauses.push(
                    `${col} = CASE WHEN $${idx}::text IS NOT NULL THEN ` +
                    `pgp_sym_encrypt($${idx}::text, current_setting('app.encryption_key')) ` +
                    `ELSE ${col} END`
                );
                values.push(value !== undefined ? JSON.stringify(value) : null);
                idx++;
            };

            if (params.connectorDisplayName !== undefined) addField('connector_display_name', params.connectorDisplayName);
            if (params.configJson !== undefined) addEncrypted('conn_config_json_encrypted', params.configJson);
            if (params.secretsJson !== undefined) addEncrypted('conn_secrets_json_encrypted', params.secretsJson);
            if (params.jdbcDriverClass !== undefined) addField('conn_jdbc_driver_class', params.jdbcDriverClass);
            if (params.testQuery !== undefined) addField('conn_test_query', params.testQuery);
            if (params.sparkConfigJson !== undefined) addField('conn_spark_config_json', JSON.stringify(params.sparkConfigJson));
            if (params.sslMode !== undefined) addField('conn_ssl_mode', params.sslMode);
            if (params.sshTunnelJson !== undefined) addEncrypted('conn_ssh_tunnel_json_encrypted', params.sshTunnelJson);
            if (params.proxyJson !== undefined) addEncrypted('conn_proxy_json_encrypted', params.proxyJson);
            if (params.maxPoolSize !== undefined) addField('conn_max_pool_size_num', params.maxPoolSize);
            if (params.idleTimeoutSec !== undefined) addField('conn_idle_timeout_sec', params.idleTimeoutSec);

            values.push(params.connectorId);
            const whereIdx = idx;

            await client.query(
                `UPDATE catalog.connectors SET ${setClauses.join(', ')} WHERE connector_id = $${whereIdx}`,
                values,
            );
        });
    }

    /**
     * Check whether any datasets reference this connector.
     */
    async countDependentDatasets(connectorId: string): Promise<number> {
        const result = await db.queryOne<{ cnt: string }>(
            `SELECT COUNT(*)::text AS cnt FROM catalog.datasets WHERE connector_id = $1`,
            [connectorId],
        );
        return parseInt(result?.cnt ?? '0', 10);
    }

    /**
     * Physical delete of a connector (Law 4 — no soft delete).
     */
    async delete(connectorId: string, userId: string, encryptionKey: string): Promise<void> {
        log.info('connections.repo.delete', 'Deleting connector', { connectorId });
        await db.transaction(async (client) => {
            await this.setSession(client, userId, encryptionKey);
            await client.query(
                `DELETE FROM catalog.connectors WHERE connector_id = $1`,
                [connectorId],
            );
        });
    }

    /**
     * Get the health status for a connector from catalog.connector_health (if it exists).
     * Returns null if no health record exists yet.
     */
    async getHealth(connectorId: string): Promise<ConnectorHealthRow | null> {
        // connector_health is written by the periodic health-check scheduler.
        // Table may not exist in all deployments — catch gracefully.
        try {
            return await db.queryOne<ConnectorHealthRow>(`
                SELECT
                    health_status_code,
                    check_latency_ms,
                    check_error_text,
                    consecutive_fail_num,
                    last_check_dtm,
                    next_check_dtm
                FROM catalog.connector_health
                WHERE connector_id = $1
            `, [connectorId]);
        } catch (err) {
            // Table may not exist yet — return null gracefully
            log.debug('connections.repo.health', 'connector_health table query failed (table may not exist yet)', {
                connectorId,
            });
            return null;
        }
    }

    /**
     * Upsert connection test result into catalog.connection_test_results.
     * Records each test for audit and health tracking.
     */
    async recordTestResult(
        connectorId: string,
        passed: boolean,
        latencyMs: number,
        stepsJson: unknown,
        errorText: string | null,
        userId: string,
        encryptionKey: string,
    ): Promise<void> {
        try {
            await db.transaction(async (client) => {
                await this.setSession(client, userId, encryptionKey);
                await client.query(`
                    INSERT INTO catalog.connection_test_results
                        (connector_id, test_passed_flag, test_latency_ms, test_steps_json, test_error_text, tested_by_user_id)
                    VALUES ($1, $2, $3, $4::jsonb, $5, $6::uuid)
                `, [connectorId, passed, latencyMs, JSON.stringify(stepsJson), errorText, userId]);
            });
        } catch {
            // Table may not exist yet — log and continue
            log.debug('connections.repo.recordTest', 'connection_test_results insert skipped (table may not exist)', { connectorId });
        }
    }
}

export const connectionsRepository = new ConnectionsRepository();
