# SKILL.md — Connections Service
**Service Domain:** `connections`  
**Last Updated:** 2026-03-17  
**Logger Name:** `LoggerFactory.get('connections')`  
**Error Domain:** `CONN-*` → `Backend/src/shared/errors/catalog/conn.errors.ts`

> **Read before making any change to this service.**  
> Every change, user decision, or architectural rule must be appended to the  
> **"Living Decisions"** section at the bottom of this file.

---

## Purpose

Manages the full lifecycle of data-source connectors. A connector represents a
configured, tested, and health-monitored link to an external data system
(JDBC, cloud storage, Kafka, Snowflake, Databricks, OCI, etc.).

It is the **single gateway** for all metadata browsing (listDatabases → listSchemas
→ listTables → describeTable). No other service calls external data sources directly.

---

## File Map

| File | Role |
|---|---|
| `Backend/src/api/routes/connections.routes.ts` | Express routes — all `/api/connections/*` endpoints |
| `Backend/src/api/controllers/connections.controller.ts` | Request validation, extracts userId, delegates to service |
| `Backend/src/api/services/connections.service.ts` | **Business logic** — validation, plugin dispatch, error wrapping |
| `Backend/src/db/repositories/connections.repository.ts` | All SQL against `catalog.connectors`, `catalog.connector_health` |
| `Backend/src/connectors/IConnectorPlugin.ts` | Plugin interface: `test()`, `listDatabases()`, `listSchemas()`, `listTables()`, `describeTable()` |
| `Backend/src/connectors/ConnectorRegistry.ts` | Singleton registry: `get(typeCode)`, `getRegisteredTypeCodes()` |
| `Backend/src/connectors/plugins/` | One plugin per connector type (see Plugin Inventory below) |
| `Backend/src/shared/errors/catalog/conn.errors.ts` | All `CONN-*` error factories |

---

## API Surface

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/connections` | Create connector |
| `GET` | `/api/connections` | List all connectors |
| `GET` | `/api/connections/types` | Registered types + schemas (for dynamic form UI) |
| `GET` | `/api/connections/:id` | Get by ID |
| `PUT` | `/api/connections/:id` | Update connector |
| `DELETE` | `/api/connections/:id` | Delete (blocked if dependent datasets exist) |
| `POST` | `/api/connections/:id/test` | Live connectivity test |
| `GET` | `/api/connections/:id/health` | Latest health record |
| `GET` | `/api/connections/:id/databases` | Metadata: list databases |
| `GET` | `/api/connections/:id/schemas` | Metadata: list schemas (`?database=`) |
| `GET` | `/api/connections/:id/tables` | Metadata: list tables (`?database=&schema=`) |
| `GET` | `/api/connections/:id/tables/:table` | Metadata: describe table (`?database=&schema=`) |

---

## Database Tables (catalog schema)

| Table | Purpose |
|---|---|
| `catalog.connectors` | Master connector config (encrypted `conn_config_json_encrypted`, `conn_secrets_json_encrypted`) |
| `catalog.connector_health` | Latest health ping result per connector |
| `catalog.datasets` | Downstream datasets — FK `connector_id` from here to `connectors` |

**Critical:** `conn_config_json_encrypted` and `conn_secrets_json_encrypted` are stored
via `pgp_sym_encrypt(...)`. They MUST be decrypted on read with `pgp_sym_decrypt(...)`.
The encryption key comes from `process.env.APP_ENCRYPTION_KEY` → DB session var `app.encryption_key`.

---

## Plugin Inventory

| TypeCode | Plugin File | Notes |
|---|---|---|
| `JDBC_*` | `JdbcConnectorPlugin.ts` | Generic JDBC; requires `jdbcDriverClass` |
| `AWS_S3` / `AWS_GLUE` / `AWS_REDSHIFT` | `AwsConnectorPlugin.ts` | |
| `AZURE_BLOB` / `AZURE_SYNAPSE` / `AZURE_ADLS` | `AzureConnectorPlugin.ts` | |
| `GCP_GCS` / `GCP_BIGQUERY` | `GcpConnectorPlugin.ts` | |
| `OCI_OBJECT_STORAGE` / `OCI_ADW` | `OciConnectorPlugin.ts` | |
| `DATABRICKS` | `DatabricksConnectorPlugin.ts` | |
| `SNOWFLAKE` | `SnowflakeConnectorPlugin.ts` | |
| `FILE_*` | `FileFormatConnectorPlugin.ts` | CSV, Parquet, JSON, Avro, Delta, ORC |

**To add a new connector type:**
1. Create `Backend/src/connectors/plugins/XxxConnectorPlugin.ts` implementing `IConnectorPlugin`
2. Register in `ConnectorRegistry.ts`
3. Add error codes if needed in `conn.errors.ts`
4. Document here under Plugin Inventory

---

## Business Rules

1. **Delete is blocked** if `catalog.datasets` references the connector (`countDependentDatasets > 0`).
2. **SSL mode** must be one of: `DISABLE`, `REQUIRE`, `VERIFY_CA`, `VERIFY_FULL`. Default: `REQUIRE`.
3. **maxPoolSize** must be 1–100 if provided.
4. **Port** (`jdbc_port`) must be 1–65535 if provided.
5. **Connector display name** must be unique (DB enforces; service maps to `CONN-004`).
6. **Test result** is persisted asynchronously (fire-and-forget). A test endpoint failure
   must never block the API response.
7. **Health is polled externally** — the API only reads from `catalog.connector_health`.
   No background polling logic lives in this service (future: health-check worker microservice).

---

## Error Codes (conn.errors.ts)

| Code | Factory | When |
|---|---|---|
| `CONN-001` | `notFound(id)` | Connector UUID not in DB |
| `CONN-002` | `nameRequired()` | `connectorDisplayName` blank |
| `CONN-003` | `typeRequired()` | `connectorTypeCode` missing |
| `CONN-004` | `duplicateName(name)` | Unique constraint violation |
| `CONN-005` | `unsupportedConnectorType(code)` | No plugin registered for typeCode |
| `CONN-006` | `hostRequired()` | Host/database/schema param missing for metadata calls |
| `CONN-007` | `portInvalid(val)` | Port out of 1–65535 range |
| `CONN-008` | `authFailed(id, cause)` | Auth/password error from plugin |
| `CONN-009` | `hostUnreachable(id, cause)` | ECONNREFUSED / ENOTFOUND |
| `CONN-010` | `testTimeout(id, sec, cause)` | Timeout / ETIMEDOUT |
| `CONN-011` | `sslCertVerifyFailed(id, cause)` | SSL/certificate error |
| `CONN-012` | `connectionStringInvalid()` | Invalid SSL mode value |
| `CONN-013` | `hasDependentDatasets(id, count)` | Delete blocked |
| `CONN-099` | `unexpected(err)` | Unclassified internal error |

---

## Session Variables (required before every DB call)

```typescript
await client.query(`SET LOCAL app.user_id = '${userId}'`);
await client.query(`SET LOCAL app.encryption_key = '${encKey}'`);
```

Both must be set in every transaction. The `connections.repository.ts` does this via the
`getEncryptionKey()` helper and `userId` parameter threading.

---

## How to Add a New Endpoint

1. Add route in `connections.routes.ts`
2. Add handler method in `connections.controller.ts` — extract params, call service
3. Add method in `connections.service.ts` — validate, call repository, map errors
4. Add DB call in `connections.repository.ts` if new SQL needed
5. Add `CONN-*` error code in `conn.errors.ts` if a new failure condition
6. **Update this SKILL.md** — add to API Surface and Business Rules

---

## Known Issues & Tech Debt

| Issue | Severity | Notes |
|---|---|---|
| `healthStatusCode` in `toSummary()` is hardcoded to `'UNKNOWN'` — never reads from DB | HIGH | Fix: join to `catalog.connector_health` in `listAll()` repository call |
| No background health polling worker | MEDIUM | Planned: separate health-check microservice |
| `listSchemas` / `listTables` throw `hostRequired()` for missing `database` param — misleading error code | LOW | Should be a dedicated `CONN-014 paramMissing()` error |

---

## Living Decisions

> Append every user decision, architectural ruling, or critical instruction here.
> Format: `YYYY-MM-DD — [Decision/Instruction/Change]`

- `2026-03-17` — SKILL.md created. Service is fully implemented (CRUD, test, health, metadata browsing).
  Plugin architecture in place. Health read path has a known stub (hardcoded UNKNOWN) to be fixed.
- `2026-03-17` — **User Instruction:** All file writes to this project go directly to the local filesystem
  via `Filesystem:write_file` / `Filesystem:edit_file`. Never use `bash_tool` or `create_file` for project
  files. Never write to Claude's container.
- `2026-03-17` — **Architectural Rule:** Connections service is the ONLY service that calls external
  data sources. Metadata browsing (listDatabases/listSchemas/listTables/describeTable) for any pipeline
  or dataset feature must route through the connections service, never bypass it.
