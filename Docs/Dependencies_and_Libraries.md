# ETL1 Platform — Dependencies & Libraries

> **Last Updated:** 2026-03-01
> **Node.js Minimum:** ≥ 18.0.0
> **Package Manager:** npm
> **Install Command:** `cd Backend && npm install`

---

## Backend Runtime Dependencies

These packages are required for the application to run in production.

| Package | Version | Purpose | License |
|---|---|---|---|
| `express` | ^4.18.2 | HTTP server and REST API routing framework | MIT |
| `pg` | ^8.11.3 | PostgreSQL client — connects to the ETL metadata database | MIT |
| `uuid` | ^9.0.1 | RFC-4122 UUID generation for all entity primary keys | MIT |
| `winston` | ^3.11.0 | Structured JSON logging with log levels and redaction | MIT |
| `winston-daily-rotate-file` | ^4.7.1 | Automatic daily log rotation with size limits and retention | MIT |

---

## Backend Development Dependencies

These packages are required only during development and build.

| Package | Version | Purpose | License |
|---|---|---|---|
| `typescript` | ^5.3.0 | TypeScript compiler — compiles `.ts` to `.js` | Apache-2.0 |
| `ts-node` | ^10.9.2 | Execute TypeScript directly without pre-compilation (scripts, migrations) | MIT |
| `ts-node-dev` | ^2.0.0 | Development server with hot-reload on file changes | MIT |
| `@types/express` | ^4.17.21 | TypeScript type definitions for Express | MIT |
| `@types/node` | ^20.10.0 | TypeScript type definitions for Node.js built-in APIs | MIT |
| `@types/pg` | ^8.10.9 | TypeScript type definitions for the `pg` PostgreSQL client | MIT |
| `@types/uuid` | ^9.0.7 | TypeScript type definitions for `uuid` | MIT |

---

## Database Dependencies

The PostgreSQL database requires the following extensions (installed at schema creation time):

| Extension | Purpose |
|---|---|
| `pgcrypto` | AES-256 symmetric encryption for connector secrets, config, SSH tunnels, and proxy credentials |
| `ltree` | Hierarchical path storage for folder trees |
| `pg_trgm` | Trigram-based fuzzy text search |

---

## Spark Runtime Dependencies (JARs)

These JARs must be available on the Spark classpath at pipeline execution time. They are **not** bundled in the Backend — they are referenced by the connector plugins and must be provisioned in the Spark environment.

### JDBC Drivers

| JAR | Connector(s) |
|---|---|
| `postgresql.jar` | PostgreSQL, Greenplum |
| `mysql-connector-j.jar` | MySQL |
| `mariadb-java-client.jar` | MariaDB |
| `mssql-jdbc.jar` | SQL Server |
| `ojdbc11.jar` | Oracle Database, OCI Autonomous DB |
| `jcc.jar` | IBM Db2 |
| `ngdbc.jar` | SAP HANA |
| `terajdbc.jar` | Teradata |
| `jconn4.jar` | Sybase ASE |
| `redshift-jdbc42.jar` | Amazon Redshift |
| `snowflake-jdbc.jar` | Snowflake |
| `databricks-jdbc.jar` | Databricks |

### Cloud Storage Connectors

| JAR | Connector(s) |
|---|---|
| `hadoop-aws.jar` + `aws-java-sdk-bundle.jar` | Amazon S3 |
| `gcs-connector-hadoop3-shaded.jar` | Google Cloud Storage |
| `hadoop-azure.jar` + `azure-storage.jar` | Azure Blob Storage, ADLS Gen2 |
| `oci-hdfs-connector.jar` | OCI Object Storage |

### Data Warehouse / Lakehouse Connectors

| JAR | Connector(s) |
|---|---|
| `spark-redshift.jar` | Amazon Redshift (Spark connector) |
| `spark-bigquery-with-dependencies.jar` | Google BigQuery |
| `spark-snowflake.jar` | Snowflake (Spark connector) |
| `spark-mssql-connector.jar` | Azure Synapse |
| `spark-bigtable.jar` | Google Bigtable |
| `delta-core.jar` + `delta-storage.jar` | Delta Lake, Databricks |
| `iceberg-spark-runtime.jar` | Apache Iceberg |
| `hudi-spark-bundle.jar` | Apache Hudi |

### File Format Connectors

| JAR | Format(s) |
|---|---|
| `spark-xml.jar` | XML |
| `spark-excel.jar` | Microsoft Excel (.xlsx) |
| `spark-avro.jar` | Apache Avro |

> [!NOTE]
> CSV, JSON, Parquet, ORC, and Fixed-Width formats are natively supported by Apache Spark and require no additional JARs.

---

## npm Commands Reference

```bash
# Install all dependencies
cd Backend && npm install

# Build (compile TypeScript → JavaScript)
npm run build

# Start production server
npm run start

# Start development server (hot reload)
npm run dev

# Run database migrations
npm run migrate

# Run integration tests
npm run test:integration

# Clean build output
npm run clean
```

---

## Adding New Dependencies

When adding a new library:

1. Install via npm: `npm install <package-name>` (or `npm install -D <package-name>` for dev-only)
2. Update this document with the package name, version, purpose, and license
3. Commit both `package.json` and `package-lock.json`
