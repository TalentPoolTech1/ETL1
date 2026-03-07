import { AppError } from '../AppError';
import { ErrorClass } from '../ErrorClass';

/** CONN — Connections (Connectors) error factories */
export const connErrors = {

  nameRequired(): AppError {
    return new AppError({
      code: 'CONN-001',
      errorClass: ErrorClass.VALIDATION,
      userMessage: 'Connection name is required.',
      internalMessage: 'Missing conn_display_name in request body',
      action: 'connections.validate',
      fieldErrors: [{ field: 'conn_display_name', message: 'Connection name is required.' }],
    });
  },

  typeRequired(): AppError {
    return new AppError({
      code: 'CONN-002',
      errorClass: ErrorClass.VALIDATION,
      userMessage: 'Connection type is required. Supported types: JDBC, S3, GCS, ADLS, Kafka, Hive, Iceberg, Delta.',
      internalMessage: 'Missing connector_type_code in request body',
      action: 'connections.validate',
      fieldErrors: [{ field: 'connector_type_code', message: 'Connection type is required.' }],
    });
  },

  duplicateName(name: string): AppError {
    return new AppError({
      code: 'CONN-003',
      errorClass: ErrorClass.CONFLICT,
      userMessage: `A connection named '${name}' already exists. Please choose a different name.`,
      internalMessage: `Unique constraint violation on catalog.connectors.conn_display_name for name="${name}"`,
      action: 'connections.create',
      meta: { connDisplayName: name },
    });
  },

  notFound(connId: string): AppError {
    return new AppError({
      code: 'CONN-004',
      errorClass: ErrorClass.NOT_FOUND,
      userMessage: 'Connection not found. It may have been deleted.',
      internalMessage: `catalog.connectors lookup miss for connId="${connId}"`,
      action: 'connections.find',
      meta: { connId },
    });
  },

  hostUnreachable(connId: string, cause: Error): AppError {
    return new AppError({
      code: 'CONN-005',
      errorClass: ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage: 'Could not reach the data source. Please verify the host, port, and network settings, then try again. (Ref: {correlationId})',
      internalMessage: `TCP connect failed for connId="${connId}" — socket timeout or connection refused`,
      action: 'connections.test',
      meta: { connId },
      cause,
    });
  },

  authFailed(connId: string, cause: Error): AppError {
    return new AppError({
      code: 'CONN-006',
      errorClass: ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage: 'Authentication to the data source failed. Please check the credentials stored in this connection. (Ref: {correlationId})',
      internalMessage: `Driver-level authentication rejection for connId="${connId}"`,
      action: 'connections.test',
      meta: { connId },
      cause,
    });
  },

  testTimeout(connId: string, timeoutSec: number, cause: Error): AppError {
    return new AppError({
      code: 'CONN-007',
      errorClass: ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage: `The data source connection test timed out after ${timeoutSec}s. Check that the host is reachable from this environment. (Ref: {correlationId})`,
      internalMessage: `Connection test timed out after ${timeoutSec}s for connId="${connId}"`,
      action: 'connections.test',
      meta: { connId, timeoutSec },
      cause,
    });
  },

  hostRequired(): AppError {
    return new AppError({
      code: 'CONN-008',
      errorClass: ErrorClass.VALIDATION,
      userMessage: 'Host is required for this connection type.',
      internalMessage: 'Missing host field in connection config',
      action: 'connections.validate',
      fieldErrors: [{ field: 'host', message: 'Host is required for this connection type.' }],
    });
  },

  portInvalid(port: unknown): AppError {
    return new AppError({
      code: 'CONN-009',
      errorClass: ErrorClass.VALIDATION,
      userMessage: 'Port must be a number between 1 and 65535.',
      internalMessage: `Invalid port value "${port}" in connection config`,
      action: 'connections.validate',
      meta: { port },
      fieldErrors: [{ field: 'port', message: 'Port must be a number between 1 and 65535.' }],
    });
  },

  forbidden(connId: string): AppError {
    return new AppError({
      code: 'CONN-010',
      errorClass: ErrorClass.AUTHORIZATION,
      userMessage: 'You do not have permission to view or edit this connection.',
      internalMessage: `Resource-level role check failed for connId="${connId}"`,
      action: 'connections.authorize',
      meta: { connId },
    });
  },

  hasDependentDatasets(connId: string, count: number): AppError {
    return new AppError({
      code: 'CONN-011',
      errorClass: ErrorClass.CONFLICT,
      userMessage: `This connection cannot be deleted because it is used by ${count} dataset(s). Remove those datasets first.`,
      internalMessage: `Delete blocked — catalog.datasets FK references connId="${connId}" (${count} rows)`,
      action: 'connections.delete',
      meta: { connId, datasetCount: count },
    });
  },

  connectionStringInvalid(): AppError {
    return new AppError({
      code: 'CONN-012',
      errorClass: ErrorClass.VALIDATION,
      userMessage: 'Connection string format is not valid for the selected connector type.',
      internalMessage: 'Malformed JDBC URL or connection string failed format validation',
      action: 'connections.validate',
      fieldErrors: [{ field: 'connectionString', message: 'Connection string format is not valid for the selected connector type.' }],
    });
  },

  unexpected(cause: Error): AppError {
    return new AppError({
      code: 'CONN-013',
      errorClass: ErrorClass.INTERNAL,
      userMessage: 'An unexpected error occurred while saving the connection. (Ref: {correlationId})',
      internalMessage: 'Unhandled error in connections service',
      action: 'connections.unknown',
      cause,
    });
  },

  sslCertVerifyFailed(connId: string, cause: Error): AppError {
    return new AppError({
      code: 'CONN-014',
      errorClass: ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage: 'SSL certificate verification failed. Ensure the CA certificate is correct and the server certificate is valid. (Ref: {correlationId})',
      internalMessage: `SSL/TLS handshake failure for connId="${connId}" — cert chain invalid or expired`,
      action: 'connections.test',
      meta: { connId },
      cause,
    });
  },

  sshTunnelFailed(connId: string, cause: Error): AppError {
    return new AppError({
      code: 'CONN-015',
      errorClass: ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage: 'Could not establish the SSH tunnel. Verify the bastion host address, SSH key, and SSH port. (Ref: {correlationId})',
      internalMessage: `SSH tunnel establishment failed for connId="${connId}"`,
      action: 'connections.test',
      meta: { connId },
      cause,
    });
  },

  invalidAuthMethod(connId: string, authMethod: string, connectorType: string): AppError {
    return new AppError({
      code: 'CONN-016',
      errorClass: ErrorClass.VALIDATION,
      userMessage: `Auth method '${authMethod}' is not supported for '${connectorType}' connections.`,
      internalMessage: `Invalid auth_method="${authMethod}" for connector_type_code="${connectorType}" connId="${connId}"`,
      action: 'connections.validate',
      meta: { connId, authMethod, connectorType },
    });
  },

  secretsDecryptionFailed(connId: string, cause: Error): AppError {
    return new AppError({
      code: 'CONN-017',
      errorClass: ErrorClass.INTERNAL,
      userMessage: 'Failed to decrypt connection credentials. The encryption key may have been rotated. Contact your administrator. (Ref: {correlationId})',
      internalMessage: `pgp_sym_decrypt failed for connId="${connId}" — possible key mismatch or corrupt ciphertext`,
      action: 'connections.decrypt',
      meta: { connId },
      cause,
    });
  },

  iamRoleAssumptionFailed(connId: string, roleArn: string, cause: Error): AppError {
    return new AppError({
      code: 'CONN-018',
      errorClass: ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage: 'AWS IAM role assumption failed. Verify the Role ARN, External ID, and trust policy. (Ref: {correlationId})',
      internalMessage: `STS AssumeRole failed for roleArn="${roleArn}" connId="${connId}"`,
      action: 'connections.test',
      meta: { connId, roleArn },
      cause,
    });
  },

  oauthTokenExchangeFailed(connId: string, cause: Error): AppError {
    return new AppError({
      code: 'CONN-019',
      errorClass: ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage: 'OAuth token exchange failed. Verify the client ID, client secret, and token endpoint. (Ref: {correlationId})',
      internalMessage: `OAuth2 token exchange failure for connId="${connId}"`,
      action: 'connections.test',
      meta: { connId },
      cause,
    });
  },

  saKeyJsonInvalid(connId: string, cause: Error): AppError {
    return new AppError({
      code: 'CONN-020',
      errorClass: ErrorClass.VALIDATION,
      userMessage: 'The Service Account key JSON is malformed or missing required fields. Please download a fresh key from the GCP console.',
      internalMessage: `SA key JSON parse failure for connId="${connId}"`,
      action: 'connections.validate',
      meta: { connId },
      cause,
    });
  },

  fileFormatOptionsInvalid(field: string, message: string): AppError {
    return new AppError({
      code: 'CONN-021',
      errorClass: ErrorClass.VALIDATION,
      userMessage: `File format option '${field}' is invalid: ${message}`,
      internalMessage: `File format validation failed: field="${field}" error="${message}"`,
      action: 'connections.validate',
      fieldErrors: [{ field, message }],
    });
  },

  unsupportedConnectorType(typeCode: string): AppError {
    return new AppError({
      code: 'CONN-022',
      errorClass: ErrorClass.VALIDATION,
      userMessage: `Connector type '${typeCode}' is not supported. Use GET /api/connections/types for the full list.`,
      internalMessage: `ConnectorRegistry.get("${typeCode}") returned undefined — unregistered plugin`,
      action: 'connections.validate',
      meta: { typeCode },
    });
  },

  healthCheckDegraded(connId: string, consecutiveFailures: number): AppError {
    return new AppError({
      code: 'CONN-023',
      errorClass: ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage: `Connection is degraded — ${consecutiveFailures} consecutive health checks have failed.`,
      internalMessage: `Health DEGRADED for connId="${connId}" after ${consecutiveFailures} consecutive failures`,
      action: 'connections.health',
      meta: { connId, consecutiveFailures },
    });
  },

  databricksWorkspaceUnreachable(connId: string, workspaceUrl: string, cause: Error): AppError {
    return new AppError({
      code: 'CONN-024',
      errorClass: ErrorClass.EXTERNAL_DEPENDENCY,
      userMessage: 'Could not reach the Databricks workspace. Verify the workspace URL and your network access. (Ref: {correlationId})',
      internalMessage: `Databricks workspace unreachable: url="${workspaceUrl}" connId="${connId}"`,
      action: 'connections.test',
      meta: { connId, workspaceUrl },
      cause,
    });
  },

  oracleWalletParseFailed(connId: string, cause: Error): AppError {
    return new AppError({
      code: 'CONN-025',
      errorClass: ErrorClass.VALIDATION,
      userMessage: 'The Oracle Wallet could not be parsed. Ensure it is a valid wallet ZIP file and the wallet password is correct.',
      internalMessage: `Oracle Wallet parse failure for connId="${connId}" — invalid ZIP or wrong password`,
      action: 'connections.validate',
      meta: { connId },
      cause,
    });
  },
};
