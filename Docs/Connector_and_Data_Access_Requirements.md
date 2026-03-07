# Connector & Data Access Requirements
## Web-Based No-Code ETL Platform — ETL1

> **Document status:** Draft v2.0  
> **Date:** 2026-03-01  
> **Scope:** All external system connectivity, metadata extraction, file/object/local storage, streaming & messaging, NoSQL, analytical databases, PySpark runtime connectivity (SDK-free), secure data preview via Apache Arrow, write modes, CDC/incremental patterns, lakehouse catalog integrations

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Guiding Principles](#2-guiding-principles)
3. [Connector Architecture Overview](#3-connector-architecture-overview)
4. [Credential Management and Secret Storage](#4-credential-management-and-secret-storage)
5. [Cloud Platform Connectivity](#5-cloud-platform-connectivity)
   - 5.1 Amazon Web Services (AWS)
   - 5.2 Google Cloud Platform (GCP)
   - 5.3 Microsoft Azure
   - 5.4 Snowflake
   - 5.5 Oracle Cloud Infrastructure (OCI)
6. [On-Premises RDBMS Connectivity](#6-on-premises-rdbms-connectivity)
7. [File and Object Storage](#7-file-and-object-storage)
   - 7.1 Cloud Object Storage Systems
   - 7.2 Storage Connection Configuration
   - 7.3 Local File System
   - 7.4 SFTP / FTP / FTPS
   - 7.5 Network File Shares (SMB/CIFS, NFS)
   - 7.6 Supported File Formats
   - 7.7 File Compression Handling
   - 7.8 Multi-File and Glob Pattern Reads
   - 7.9 Partition Discovery and Writing
8. [Analytical and Cloud Data Warehouse Connectivity](#8-analytical-and-cloud-data-warehouse-connectivity)
   - 8.1 Amazon Redshift
   - 8.2 Amazon RDS
   - 8.3 Azure Synapse Analytics
   - 8.4 Google BigQuery
   - 8.5 Google Bigtable
   - 8.6 Amazon Athena
   - 8.7 Apache Hive / HiveServer2
   - 8.8 Databricks (Delta Lakehouse)
   - 8.9 Spark Thrift Server
   - 8.10 Microsoft Fabric / OneLake
9. [Streaming and Messaging Connectors](#9-streaming-and-messaging-connectors)
   - 9.1 Apache Kafka (On-Prem)
   - 9.2 Amazon MSK / Confluent Cloud
   - 9.3 Azure Event Hubs
   - 9.4 Amazon Kinesis
   - 9.5 Google Pub/Sub
   - 9.6 Apache Pulsar
10. [NoSQL and Document Store Connectors](#10-nosql-and-document-store-connectors)
    - 10.1 MongoDB
    - 10.2 Apache Cassandra / DataStax Astra
    - 10.3 Amazon DynamoDB
    - 10.4 Azure Cosmos DB
    - 10.5 Elasticsearch / OpenSearch
    - 10.6 Apache HBase (On-Prem)
    - 10.7 Redis (Reference Data, Read-Only)
11. [Data Lakehouse and Catalog Integrations](#11-data-lakehouse-and-catalog-integrations)
    - 11.1 Apache Hive Metastore
    - 11.2 AWS Glue Data Catalog
    - 11.3 Databricks Unity Catalog
    - 11.4 Apache Iceberg REST Catalog
12. [Metadata Extraction](#12-metadata-extraction)
13. [PySpark Runtime Connectivity — SDK-Free Approach](#13-pyspark-runtime-connectivity--sdk-free-approach)
14. [Write Modes and Data Sink Strategies](#14-write-modes-and-data-sink-strategies)
15. [Incremental Load and CDC Patterns](#15-incremental-load-and-cdc-patterns)
16. [Secure Data Preview via Apache Arrow](#16-secure-data-preview-via-apache-arrow)
17. [Connection Testing and Health Monitoring](#17-connection-testing-and-health-monitoring)
18. [UI / UX Requirements for Connection Management](#18-ui--ux-requirements-for-connection-management)
19. [Non-Functional Requirements](#19-non-functional-requirements)
20. [Connector Extensibility](#20-connector-extensibility)
21. [Open Questions and Decisions Required](#21-open-questions-and-decisions-required)

---

## 1. Purpose and Scope

This document specifies the detailed functional and technical requirements for the **Connector and Data Access** subsystem of the ETL1 No-Code ETL platform.

The platform must allow data engineers to:

- Configure connections to any supported external system through a visual UI, without writing code.
- Extract and browse schema metadata (databases, schemas, tables, columns, data types, partitions) from connected systems.
- Read source data and write output data through visually designed Spark pipelines.
- Preview data in the UI instantly, securely, and with minimal load on source systems.
- Support structured, semi-structured, and binary file formats from any accessible storage location — cloud, on-prem, local, or network-mounted.
- Consume and produce streaming data through messaging systems.
- Read from and write to NoSQL and document stores.
- Integrate with data lakehouse catalogs as first-class metadata sources.
- Have all of the above work transparently at PySpark runtime on any configured Spark cluster, **without bundling or invoking the respective cloud SDKs** from the ETL1 backend.

---

## 2. Guiding Principles

**P-01 — No SDK Lock-In**  
The ETL1 backend and codegen layer must not import or depend on AWS SDK, GCP client libraries, Azure SDK, Snowflake connector, or any other cloud-vendor library. All connectivity is achieved through open protocols: JDBC, ODBC (via JDBC bridge), Hadoop-compatible filesystem APIs, S3A/GCS/WASB/ABFS Hadoop connectors, and open REST APIs where necessary.

**P-02 — Credential Zero-Knowledge at Runtime**  
The ETL1 backend stores only encrypted credential payloads. Decryption happens at pipeline execution time, in the Spark execution context, using keys that the platform never persists in plaintext. The codegen layer generates Spark configuration stanzas that pass credentials via Spark session config, never via source code.

**P-03 — Schema as First-Class Data**  
Metadata (databases, schemas, tables, columns, data types, nullability, partition keys, primary keys where available) is extracted, stored, and versioned in the ETL1 catalog database. Pipelines reference catalog entities, not raw strings. Schema drift is detected and surfaced in the UI.

**P-04 — Preview is Read-Only, Bounded, and Encrypted**  
Data previews fetch at most N rows (configurable, default 500). All preview traffic travels in Apache Arrow IPC format. The payload is encrypted before leaving the preview service. The browser-side key is session-scoped and never sent to the server.

**P-05 — Uniform Connector Model**  
All connectors, regardless of underlying technology, present the same interface to the rest of the platform: connect, test, listDatabases, listSchemas, listTables, describeTable, previewData, generateSparkReadConfig, generateSparkWriteConfig.

**P-06 — Local and Network Files Are First-Class Sources**  
Local filesystem paths, SFTP servers, and network shares must be fully supported data sources with the same metadata browsing, preview, and pipeline integration capabilities as cloud storage. They are not second-class or dev-only connectors.

**P-07 — Streaming Is a Distinct Connector Category**  
Streaming sources and sinks have fundamentally different semantics (unbounded, offset-based, schema-on-arrival) and must be modelled separately from batch connectors, with distinct pipeline node types in the UI.

---

## 3. Connector Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          ETL1 Backend                                │
│                                                                      │
│  ┌───────────────┐   ┌───────────────┐   ┌──────────────────────┐   │
│  │  Connection   │   │   Metadata    │   │   Preview            │   │
│  │  Service      │   │   Service     │   │   Service (Java)     │   │
│  └──────┬────────┘   └──────┬────────┘   └──────┬───────────────┘   │
│         │                  │                    │                   │
│  ┌──────▼──────────────────▼────────────────────▼─────────────────┐ │
│  │                    Connector Registry                           │ │
│  │  BATCH:  Jdbc │ S3 │ Gcs │ AzureBlob │ LocalFs │ Sftp │ Smb   │ │
│  │          BigQuery │ Snowflake │ Redshift │ Synapse │ Athena    │ │
│  │          Hive │ Databricks │ MongoDB │ Cassandra │ Dynamo     │ │
│  │  STREAM: Kafka │ Kinesis │ EventHubs │ PubSub │ Pulsar        │ │
│  │  CATALOG: HiveMetastore │ GlueDataCatalog │ UnityCatalog      │ │
│  └──────────────────────────┬───────────────────────────────────-─┘ │
│                             │                                        │
│  ┌──────────────────────────▼────────────────────────────────────┐   │
│  │              Credential Vault (pgcrypto / AES-256)             │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │              Codegen Layer (Spark config emitter)              │   │
│  │  generateSparkReadConfig()    generateSparkWriteConfig()       │   │
│  │  generateSparkStreamReadConfig()  generateSparkStreamWrite()   │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
              │                               │
  JDBC / REST / SFTP / Arrow            Spark Submit
              │                               │
   ┌──────────▼──────────┐       ┌────────────▼─────────────────────┐
   │  External Systems   │       │     Spark Cluster               │
   │  DB/Storage/Stream  │       │  (Hadoop connectors, JDBC,      │
   │  NoSQL/Files/Queue  │       │   Kafka client, Arrow flight)   │
   └─────────────────────┘       └──────────────────────────────────┘
```

### 3.1 Connector Categories

| Category | Description | Examples |
|----------|-------------|---------|
| `RDBMS_ONPREM` | On-premises relational databases via JDBC | PostgreSQL, MySQL, Oracle, SQL Server, Db2 |
| `RDBMS_CLOUD` | Cloud-managed relational databases | RDS, Cloud SQL, Azure SQL |
| `DATA_WAREHOUSE` | Analytical / OLAP stores | Redshift, Synapse, BigQuery, Snowflake, Athena |
| `OBJECT_STORAGE` | Cloud object/blob storage | S3, GCS, ADLS Gen2, OCI Object Storage |
| `LOCAL_STORAGE` | On-prem or local file access | Local FS, SFTP, FTP, SMB/CIFS, NFS, HDFS |
| `STREAM` | Messaging and streaming systems | Kafka, Kinesis, Event Hubs, Pub/Sub, Pulsar |
| `NOSQL` | Document, wide-column, key-value | MongoDB, Cassandra, DynamoDB, Cosmos DB, Elasticsearch |
| `LAKEHOUSE` | Table format and catalog systems | Delta, Iceberg, Hudi, Hive Metastore, Glue, Unity Catalog |
| `COMPUTE` | Execution engine as data source/sink | Databricks, Spark Thrift Server, Hive/HiveServer2 |

### 3.2 Connector Record (catalog.connectors)

Every configured connection is stored as a single record with the following logical fields:

| Field | Description |
|-------|-------------|
| `connector_type_code` | Enum identifying the connector class (see Sections 5–11) |
| `connector_category_code` | Category from the table above |
| `conn_display_name` | Human-readable name for the UI |
| `conn_config_json_encrypted` | Encrypted JSON blob: all non-secret configuration |
| `conn_secrets_json_encrypted` | Encrypted JSON blob: all secrets |
| `conn_jdbc_driver_class` | Override JDBC driver class name (optional) |
| `conn_test_query` | Override the default connectivity test query (optional) |
| `conn_spark_config_json` | Additional Spark session config key-value pairs injected at codegen time |
| `conn_ssl_mode` | SSL/TLS enforcement mode: DISABLE, REQUIRE, VERIFY_CA, VERIFY_FULL |
| `conn_ssh_tunnel_json_encrypted` | SSH tunnel config (optional) |
| `conn_proxy_json_encrypted` | HTTP/SOCKS proxy config (optional) |
| `conn_tags` | Array of user-defined tags for filtering in the UI |

---

## 4. Credential Management and Secret Storage

### 4.1 Encryption at Rest

All secrets in `conn_secrets_json_encrypted` are encrypted at the PostgreSQL layer using `pgcrypto.pgp_sym_encrypt` with an AES-256 key that is:

- Never stored in the database.
- Injected at backend startup from an environment variable (`ETL1_ENCRYPTION_KEY`) or a secrets manager (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault — via a lightweight REST call at startup, not an SDK import).
- Rotated by re-encrypting all records with the new key in a background job.

### 4.2 Credential Types by Connector

| Credential Type | Connectors That Use It |
|-----------------|----------------------|
| Username + Password | All JDBC, Snowflake, Oracle, MongoDB, Cassandra, SFTP, FTP |
| SSH Private Key (PEM) | SFTP, SSH tunnel for any connector |
| AWS Access Key ID + Secret Access Key | S3, Redshift (non-IAM), Kinesis, DynamoDB |
| AWS IAM Role ARN (assumed at runtime) | S3, Redshift, RDS IAM Auth, Kinesis, DynamoDB, Athena |
| GCP Service Account Key JSON | GCS, BigQuery, Bigtable, Pub/Sub, Dataproc |
| GCP Workload Identity (no key) | GCS, BigQuery, Pub/Sub on GKE |
| Azure Service Principal (Client ID + Client Secret + Tenant ID) | ADLS Gen2, Azure Blob, Synapse, Event Hubs, Cosmos DB |
| Azure Managed Identity (no secret) | ADLS Gen2, Azure Blob, Synapse, Event Hubs, Cosmos DB on AKS |
| Snowflake Key Pair (RSA private key) | Snowflake |
| Snowflake OAuth token | Snowflake |
| Oracle Wallet (zip bundle, base64-encoded) | Oracle Cloud Autonomous DB |
| Kafka SASL credentials (PLAIN / SCRAM-256 / SCRAM-512) | Kafka, MSK, Confluent Cloud, Event Hubs Kafka |
| Kafka mTLS (client cert + key) | Kafka with mutual TLS |
| Databricks Personal Access Token | Databricks |
| SMB Username + Password + Domain | SMB/CIFS network shares |
| MongoDB X.509 certificate | MongoDB with certificate auth |
| Elasticsearch API Key | Elasticsearch / OpenSearch |

### 4.3 Runtime Secret Injection for Spark

At pipeline execution time, the ETL1 execution service:

1. Decrypts the secrets blob using the encryption key (in memory, never logged).
2. Resolves any IAM role assumptions or OAuth token refreshes via lightweight REST calls (no SDK).
3. Writes all Spark configuration keys to a **short-lived Spark configuration map** passed as `--conf` arguments to the `spark-submit` call.
4. The configuration map is discarded from memory immediately after submission.
5. The generated PySpark script never contains any credential value — it reads from `spark.conf.get(key)`.

---

## 5. Cloud Platform Connectivity

### 5.1 Amazon Web Services (AWS)

#### 5.1.1 Authentication Methods

| Method | Description | When to Use |
|--------|-------------|-------------|
| Static Credentials | `aws_access_key_id` + `aws_secret_access_key` | Service accounts, legacy setups |
| IAM Role (via STS AssumeRole) | Role ARN + optional External ID | Cross-account, least-privilege preferred |
| EC2/EKS Instance Profile | No credentials — inherited from compute identity | When ETL1 backend runs on AWS |
| AWS SSO / Identity Center | OAuth2 token exchange via SSO start URL | Enterprise SSO environments |

For IAM Role assumption, the ETL1 backend calls `POST https://sts.amazonaws.com/` with `Action=AssumeRole` using HTTPS/XML — **no AWS SDK**. The resulting temporary credentials (AccessKeyId, SecretAccessKey, SessionToken) are passed to Spark as Hadoop config keys.

#### 5.1.2 AWS Connection Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `aws_region` | string | Yes | e.g. `us-east-1` |
| `auth_method` | enum | Yes | `STATIC_KEYS`, `IAM_ROLE`, `INSTANCE_PROFILE` |
| `aws_access_key_id` | secret | If STATIC_KEYS | IAM user access key |
| `aws_secret_access_key` | secret | If STATIC_KEYS | IAM user secret key |
| `aws_role_arn` | string | If IAM_ROLE | Full ARN of the role to assume |
| `aws_external_id` | string | No | External ID for cross-account trust |
| `aws_session_duration_sec` | integer | No | Default 3600, max 43200 |
| `aws_endpoint_override` | string | No | For LocalStack, VPC endpoints, non-AWS S3-compatible |
| `aws_path_style_access` | boolean | No | Required for LocalStack and some compatible stores |

#### 5.1.3 Hadoop Configuration Keys Emitted for Spark

```
fs.s3a.access.key                    = <access_key_id>
fs.s3a.secret.key                    = <secret_access_key>
fs.s3a.session.token                 = <session_token>         # if assumed role
fs.s3a.aws.credentials.provider      = org.apache.hadoop.fs.s3a.TemporaryAWSCredentialsProvider
fs.s3a.endpoint                      = <endpoint_override>     # if set
fs.s3a.path.style.access             = true                    # if path style
fs.s3a.connection.ssl.enabled        = true
fs.s3a.attempts.maximum              = 3
fs.s3a.connection.timeout            = 30000
fs.s3a.multipart.size                = 67108864                # 64MB — optimal for large files
fs.s3a.fast.upload                   = true
```

---

### 5.2 Google Cloud Platform (GCP)

#### 5.2.1 Authentication Methods

| Method | Description | When to Use |
|--------|-------------|-------------|
| Service Account Key (JSON) | JSON key file, base64-encoded and stored encrypted | Standalone deployments |
| Workload Identity Federation | No key — GCP OIDC token from compute identity | GKE or federated identity |
| Impersonation | One SA impersonates another | Least-privilege delegation patterns |

#### 5.2.2 GCP Connection Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `gcp_project_id` | string | Yes | GCP project ID |
| `auth_method` | enum | Yes | `SERVICE_ACCOUNT_KEY`, `WORKLOAD_IDENTITY` |
| `service_account_key_json` | secret | If SA_KEY | Full JSON key, stored encrypted |
| `service_account_email` | string | If WI | SA email for impersonation |
| `gcp_region` | string | No | Default region for resources |

#### 5.2.3 Hadoop Configuration Keys Emitted for Spark (GCS)

```
fs.gs.project.id                                  = <project_id>
fs.gs.auth.type                                   = SERVICE_ACCOUNT_JSON_KEYFILE
fs.gs.auth.service.account.json.keyfile.content   = <base64_key>
fs.gs.impl                                        = com.google.cloud.hadoop.fs.gcs.GoogleHadoopFileSystem
fs.AbstractFileSystem.gs.impl                     = com.google.cloud.hadoop.fs.gcs.GoogleHadoopFS
```

---

### 5.3 Microsoft Azure

#### 5.3.1 Authentication Methods

| Method | Description | When to Use |
|--------|-------------|-------------|
| Service Principal | Client ID + Client Secret + Tenant ID | Most common for automation |
| Managed Identity (System-assigned) | No credentials — inherited from Azure compute identity | When ETL1 runs on Azure |
| Managed Identity (User-assigned) | Client ID only | Multi-tenant Azure deployments |
| Storage Account Key | Account name + key | Simple/legacy setups |
| SAS Token | Pre-signed URL with expiry | Time-bounded delegated access |

Token acquisition calls `POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token` over HTTPS — **no Azure SDK**.

#### 5.3.2 Azure Connection Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `azure_tenant_id` | string | If SP | AAD tenant ID |
| `azure_client_id` | string | If SP or User MI | Service principal app ID |
| `azure_client_secret` | secret | If SP | Client secret value |
| `azure_storage_account_name` | string | Yes for storage | Storage account name |
| `azure_storage_account_key` | secret | If Key Auth | Storage account key |
| `azure_sas_token` | secret | If SAS | SAS token string |
| `auth_method` | enum | Yes | `SERVICE_PRINCIPAL`, `MANAGED_IDENTITY_SYSTEM`, `MANAGED_IDENTITY_USER`, `STORAGE_KEY`, `SAS_TOKEN` |
| `azure_adls_gen` | enum | For ADLS | `GEN1` or `GEN2` |

#### 5.3.3 Hadoop Configuration Keys Emitted for Spark (ADLS Gen2 / Blob)

```
# Service Principal
fs.azure.account.auth.type.<account>.dfs.core.windows.net                      = OAuth
fs.azure.account.oauth.provider.type.<account>.dfs.core.windows.net            = org.apache.hadoop.fs.azurebfs.oauth2.ClientCredsTokenProvider
fs.azure.account.oauth2.client.id.<account>.dfs.core.windows.net               = <client_id>
fs.azure.account.oauth2.client.secret.<account>.dfs.core.windows.net           = <client_secret>
fs.azure.account.oauth2.client.endpoint.<account>.dfs.core.windows.net         = https://login.microsoftonline.com/<tenant_id>/oauth2/token

# Storage Key (simpler, less preferred)
fs.azure.account.key.<account>.blob.core.windows.net = <account_key>
```

---

### 5.4 Snowflake

#### 5.4.1 Authentication Methods

| Method | Description |
|--------|-------------|
| Username + Password | Basic auth |
| Key Pair (RSA) | Private key (PEM, encrypted or unencrypted) |
| OAuth (External) | OAuth2 access token from an external identity provider |
| Snowflake SSO (SAML) | Browser-based — not supported for automated pipelines |

#### 5.4.2 Snowflake Connection Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `snowflake_account_identifier` | string | Yes | e.g. `myorg-myaccount` |
| `snowflake_warehouse` | string | Yes | Compute warehouse name |
| `snowflake_database` | string | No | Default database |
| `snowflake_schema` | string | No | Default schema |
| `snowflake_role` | string | No | Default role |
| `snowflake_user` | string | Yes | Username |
| `snowflake_password` | secret | If pwd auth | Password |
| `snowflake_private_key_pem` | secret | If key pair | PEM-encoded RSA private key |
| `snowflake_private_key_passphrase` | secret | If encrypted key | Key passphrase |
| `snowflake_oauth_token` | secret | If OAuth | Access token (short-lived) |

#### 5.4.3 PySpark Runtime Connectivity (SDK-Free)

```python
df = spark.read \
  .format("net.snowflake.spark.snowflake") \
  .option("sfURL",       spark.conf.get("etl1.conn.<id>.sfURL")) \
  .option("sfUser",      spark.conf.get("etl1.conn.<id>.sfUser")) \
  .option("sfPassword",  spark.conf.get("etl1.conn.<id>.sfPassword")) \
  .option("sfDatabase",  spark.conf.get("etl1.conn.<id>.sfDatabase")) \
  .option("sfSchema",    spark.conf.get("etl1.conn.<id>.sfSchema")) \
  .option("sfWarehouse", spark.conf.get("etl1.conn.<id>.sfWarehouse")) \
  .option("sfRole",      spark.conf.get("etl1.conn.<id>.sfRole")) \
  .option("dbtable",     "<schema>.<table>") \
  .load()
```

---

### 5.5 Oracle Cloud Infrastructure (OCI)

#### 5.5.1 Authentication Methods

| Method | Description |
|--------|-------------|
| OCI API Key | User OCID + Tenancy OCID + API Private Key (PEM) + Fingerprint |
| Instance Principal | No credentials — identity from OCI compute metadata service |
| Resource Principal | For OCI Functions and Data Flow jobs |
| Oracle Wallet | For Autonomous Database — wallet ZIP bundle |

#### 5.5.2 OCI Connection Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `oci_tenancy_ocid` | string | If API Key | Tenancy OCID |
| `oci_user_ocid` | string | If API Key | User OCID |
| `oci_fingerprint` | string | If API Key | API key fingerprint |
| `oci_private_key_pem` | secret | If API Key | Private key PEM |
| `oci_region` | string | Yes | e.g. `us-ashburn-1` |
| `oci_namespace` | string | For Object Storage | Object Storage namespace |
| `oracle_wallet_zip_b64` | secret | For Autonomous DB | Base64-encoded wallet ZIP |
| `oracle_wallet_password` | secret | For Autonomous DB | Wallet zip password |
| `oracle_tns_alias` | string | For Autonomous DB | TNS alias from tnsnames.ora |

---

## 6. On-Premises RDBMS Connectivity

All on-premises database connectivity is achieved exclusively through **JDBC**. No native drivers are bundled in the ETL1 backend. JDBC drivers are loaded dynamically from a configurable driver library path.

### 6.1 Supported On-Premises RDBMS

| System | JDBC Driver Class | Default Port |
|--------|------------------|-------------|
| PostgreSQL | `org.postgresql.Driver` | 5432 |
| MySQL 5.7 / 8.x | `com.mysql.cj.jdbc.Driver` | 3306 |
| MariaDB | `org.mariadb.jdbc.Driver` | 3306 |
| Microsoft SQL Server | `com.microsoft.sqlserver.jdbc.SQLServerDriver` | 1433 |
| Oracle Database (12c, 19c, 21c) | `oracle.jdbc.OracleDriver` | 1521 |
| IBM Db2 | `com.ibm.db2.jcc.DB2Driver` | 50000 |
| SAP HANA | `com.sap.db.jdbc.Driver` | 39017 |
| Teradata | `com.teradata.jdbc.TeraDriver` | 1025 |
| Greenplum | `org.postgresql.Driver` | 5432 |
| Sybase ASE | `com.sybase.jdbc4.jdbc.SybDriver` | 5000 |
| Custom JDBC | User-supplied driver class | User-supplied port |

### 6.2 Custom JDBC Driver Upload

Users may upload a custom JDBC driver JAR for systems not in the built-in list. Requirements:

- Upload via the UI (max 50 MB per JAR).
- JAR is scanned for known CVEs before being accepted.
- Driver class name and test query are specified by the user.
- The JAR is stored in a per-tenant secure driver store and made available to the Preview Service and Spark cluster `--jars` path.

### 6.3 JDBC Connection Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jdbc_host` | string | Yes | Hostname or IP |
| `jdbc_port` | integer | Yes | TCP port |
| `jdbc_database` | string | Yes | Initial catalog / database name |
| `jdbc_username` | string | Yes | Database username |
| `jdbc_password` | secret | Yes | Database password |
| `jdbc_driver_class` | string | No | Override — defaults per type |
| `jdbc_url_params` | string | No | Additional JDBC URL query params |
| `jdbc_ssl_mode` | enum | No | `DISABLE`, `REQUIRE`, `VERIFY_CA`, `VERIFY_FULL` |
| `jdbc_ssl_ca_cert` | secret | If VERIFY_CA/FULL | PEM CA certificate |
| `jdbc_ssl_client_cert` | secret | If mutual TLS | PEM client certificate |
| `jdbc_ssl_client_key` | secret | If mutual TLS | PEM client private key |
| `jdbc_connection_timeout_sec` | integer | No | Default 30 |
| `jdbc_socket_timeout_sec` | integer | No | Default 120 |
| `jdbc_fetch_size` | integer | No | Default 10000 — rows per fetch batch |
| `ssh_tunnel_enabled` | boolean | No | Route JDBC through SSH tunnel |
| `ssh_host` | string | If tunnel | SSH bastion host |
| `ssh_port` | integer | If tunnel | Default 22 |
| `ssh_username` | string | If tunnel | SSH username |
| `ssh_private_key` | secret | If tunnel | PEM private key |

### 6.4 JDBC URL Construction

| Driver | URL Template |
|--------|-------------|
| PostgreSQL | `jdbc:postgresql://{host}:{port}/{database}{url_params}` |
| MySQL | `jdbc:mysql://{host}:{port}/{database}{url_params}` |
| SQL Server | `jdbc:sqlserver://{host}:{port};databaseName={database}{url_params}` |
| Oracle | `jdbc:oracle:thin:@//{host}:{port}/{service_name}` |
| Db2 | `jdbc:db2://{host}:{port}/{database}{url_params}` |
| SAP HANA | `jdbc:sap://{host}:{port}/?databaseName={database}{url_params}` |
| Teradata | `jdbc:teradata://{host}/DATABASE={database},DBS_PORT={port}{url_params}` |

---

## 7. File and Object Storage

### 7.1 Cloud Object Storage Systems

| System | Protocol / API | URI Scheme in Spark |
|--------|---------------|---------------------|
| Amazon S3 | S3A Hadoop connector | `s3a://` |
| S3-Compatible (MinIO, Ceph, etc.) | S3A with endpoint override | `s3a://` |
| Google Cloud Storage | GCS Hadoop connector | `gs://` |
| Azure Blob Storage | WASB / ABFS | `wasbs://` / `abfss://` |
| Azure Data Lake Storage Gen2 | ABFS | `abfss://` |
| Oracle Object Storage | S3-Compatible API | `s3a://` with OCI endpoint |

### 7.2 Storage Connection Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `storage_type` | enum | Yes | `S3`, `S3_COMPATIBLE`, `GCS`, `AZURE_BLOB`, `ADLS_GEN2`, `OCI_OBJECT`, `HDFS`, `LOCAL_FS`, `SFTP`, `FTP`, `FTPS`, `SMB`, `NFS` |
| `storage_bucket_or_container` | string | For cloud | Bucket name (S3/GCS) or container name (Azure) |
| `storage_base_path` | string | No | Default path prefix |
| `storage_region` | string | If S3/GCS | Region for the bucket |
| `storage_endpoint_url` | string | If S3_COMPATIBLE | Custom endpoint |
| `storage_path_style` | boolean | If S3_COMPATIBLE | Force path-style access |
| `storage_auth_ref` | FK | Yes | References cloud / local connector for credentials |

### 7.3 Local File System

The local file system connector reads from and writes to paths accessible on the machine(s) running the Spark executors — typically NFS-mounted directories, SAN volumes, or local disks.

#### 7.3.1 Use Cases

- Development and testing pipelines where data resides on a local disk or NFS share mounted at the same path on all Spark nodes.
- On-prem environments where data is staged to a shared NFS mount before being processed.
- Reading from mounted enterprise NAS/SAN devices.

#### 7.3.2 Local FS Connection Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `local_base_path` | string | Yes | Absolute base path accessible on all Spark nodes, e.g. `/mnt/etl-data` |
| `local_path_requires_uniform_mount` | boolean | No | Flag to warn if the path may not be consistent across executor nodes |
| `local_encoding` | string | No | Default file encoding for text files — default `UTF-8` |

#### 7.3.3 PySpark Read

```python
df = spark.read \
  .format("parquet") \
  .load(f"file://{spark.conf.get('etl1.conn.<id>.basePath')}/{relative_path}")
```

For text-based formats, the `file://` URI scheme is used with Spark's native filesystem provider.

#### 7.3.4 Metadata Browsing

The platform's metadata service lists the directory tree under `local_base_path` via a recursive directory walk. Each file is identified by extension and size. Schema inference is triggered by reading the first row group / header of a sample file.

---

### 7.4 SFTP / FTP / FTPS

SFTP, FTP, and FTPS are extremely common in enterprise ETL as a file handoff mechanism from operational systems, partner feeds, and legacy mainframe extracts.

#### 7.4.1 Protocol Differences

| Protocol | Transport Security | Authentication | Port |
|----------|--------------------|---------------|------|
| SFTP | SSH (encrypted) | Password or SSH private key | 22 |
| FTP | None (plaintext) | Username + password | 21 |
| FTPS (Explicit) | TLS negotiated on demand | Username + password + optional client cert | 21 |
| FTPS (Implicit) | TLS from first byte | Username + password + optional client cert | 990 |

> **Policy:** FTP (plaintext) must display a security warning in the UI. It is permitted only for sources behind a private network boundary.

#### 7.4.2 SFTP / FTP Connection Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sftp_host` | string | Yes | Hostname or IP |
| `sftp_port` | integer | Yes | Default 22 (SFTP), 21 (FTP/FTPS), 990 (FTPS Implicit) |
| `sftp_username` | string | Yes | Login username |
| `sftp_password` | secret | If password auth | Login password |
| `sftp_private_key` | secret | If key auth (SFTP only) | PEM-format SSH private key |
| `sftp_private_key_passphrase` | secret | If encrypted key | Passphrase for the private key |
| `sftp_base_path` | string | Yes | Base directory on the remote server |
| `sftp_protocol` | enum | Yes | `SFTP`, `FTP`, `FTPS_EXPLICIT`, `FTPS_IMPLICIT` |
| `ftps_trust_all_certs` | boolean | No | Default `false` — only enable for dev environments |
| `ftps_ssl_ca_cert` | secret | No | CA cert for FTPS server certificate verification |
| `sftp_known_hosts_entry` | string | No | Explicit `known_hosts` line to prevent MITM — strongly recommended |
| `sftp_connection_timeout_sec` | integer | No | Default 20 |
| `sftp_socket_timeout_sec` | integer | No | Default 60 |

#### 7.4.3 File Operations via SFTP

| Operation | Behaviour |
|-----------|-----------|
| List files | Lists files matching the configured glob pattern under `sftp_base_path` |
| Download for preview | Downloads the first N bytes of a file to the Preview Service for schema inference and preview rendering |
| Download for pipeline | At pipeline execution time, the generated PySpark script uses `spark-sftp` connector JAR which streams the file directly to Spark without a separate download step |
| Upload (write) | SFTP write is supported for CSV and text formats only — Parquet and binary formats are not recommended for SFTP write due to streaming limitations |
| Archive after read | Optional post-read move of the source file to a configurable archive subdirectory |
| Delete after read | Optional post-read deletion (requires explicit user confirmation in UI) |

#### 7.4.4 PySpark Connectivity (SDK-Free)

SFTP access in Spark uses the `springml/spark-sftp` connector JAR, which wraps JSch internally:

```python
df = spark.read \
  .format("com.springml.spark.sftp") \
  .option("host",     spark.conf.get("etl1.conn.<id>.host")) \
  .option("port",     spark.conf.get("etl1.conn.<id>.port")) \
  .option("username", spark.conf.get("etl1.conn.<id>.username")) \
  .option("password", spark.conf.get("etl1.conn.<id>.password")) \
  .option("fileType", "csv") \
  .option("header",   "true") \
  .option("delimiter",",") \
  .load(spark.conf.get("etl1.conn.<id>.remotePath"))
```

No Python SFTP library (`paramiko`, `pysftp`) is imported. All SFTP protocol handling is in the JAR.

#### 7.4.5 SFTP Metadata Browsing

- The metadata service connects to the SFTP server using JSch.
- Directory listings are fetched recursively up to a configurable depth (default 3 levels).
- File schema is inferred from the first file matching the configured glob pattern.
- Schema is re-inferred on every "Refresh Schema" trigger (SFTP file schemas are volatile — they may change per delivery).

---

### 7.5 Network File Shares (SMB/CIFS and NFS)

#### 7.5.1 SMB / CIFS

SMB shares (Windows File Server, Samba, Azure Files) are accessed by the Preview Service via the `jcifs-ng` Java library. For Spark execution, the share must be mounted at a consistent path on all executor nodes and accessed via the `file://` URI scheme.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `smb_server` | string | Yes | Hostname or IP of the SMB server |
| `smb_share` | string | Yes | Share name, e.g. `etl-data` |
| `smb_domain` | string | No | Windows domain for authentication |
| `smb_username` | string | Yes | Username |
| `smb_password` | secret | Yes | Password |
| `smb_base_path` | string | No | Sub-path within the share |
| `smb_version` | enum | No | `SMB1`, `SMB2`, `SMB3` — default `SMB3` |
| `smb_executor_mount_path` | string | Yes | Path where the share is mounted on Spark executor nodes (used for codegen) |

#### 7.5.2 NFS

NFS mounts are transparent to the platform — they are treated as local file system paths. The connection record simply stores the mounted path, and the `LOCAL_FS` connector handles it. The connection configuration should document the NFS export path for operational reference.

| Field | Type | Description |
|-------|------|-------------|
| `nfs_server` | string | NFS server hostname (informational) |
| `nfs_export_path` | string | Export path on the NFS server (informational) |
| `nfs_local_mount_path` | string | Path where the NFS share is mounted on Spark nodes — used as the effective `local_base_path` |

---

### 7.6 Supported File Formats

| Format | Read | Write | Notes |
|--------|------|-------|-------|
| Parquet | ✅ | ✅ | Recommended default for all pipelines |
| Delta Lake | ✅ | ✅ | Requires `delta-core` JAR |
| Apache Iceberg | ✅ | ✅ | Requires `iceberg-spark-runtime` JAR |
| Apache Hudi | ✅ | ✅ | Requires `hudi-spark-bundle` JAR |
| ORC | ✅ | ✅ | |
| Avro | ✅ | ✅ | Requires `spark-avro` package |
| CSV | ✅ | ✅ | Configurable: delimiter, header, encoding, quote char, escape char, null value, date format, multiline |
| TSV | ✅ | ✅ | Tab-delimited — sugar over CSV with `delimiter=\t` |
| Pipe-Delimited | ✅ | ✅ | Sugar over CSV with `delimiter=\|` |
| Custom-Delimiter Text | ✅ | ✅ | Any single-character delimiter, configurable in node UI |
| Fixed-Width Text | ✅ | ❌ | Column positions defined in catalog metadata; read via custom schema + `substr` transforms in codegen |
| JSON (Lines / JSONL) | ✅ | ✅ | One JSON object per line; configurable `multiLine` mode for pretty-printed JSON files |
| XML | ✅ | ❌ | Read-only via `spark-xml` JAR; `rowTag` configurable |
| Excel (.xlsx, .xls) | ✅ | ❌ | Read-only via `spark-excel` JAR; sheet name configurable; for small files (< 100 MB) only |
| Protobuf | ✅ | ✅ | Via Spark 3.4+ built-in Protobuf support; schema descriptor file required |
| Apache Thrift | ✅ | ❌ | Via custom UDF — read-only |
| Binary (raw bytes) | ✅ | ❌ | `format("binaryFile")` — yields path, modifiedTime, length, content columns |

#### 7.6.1 Format-Specific Configuration

Every file format node in the pipeline UI exposes the relevant configuration options. Key per-format settings:

**CSV / TSV / Custom-Delimiter:**
- `delimiter` — default `,`
- `header` — boolean, default `true`
- `encoding` — default `UTF-8`; also supports `ISO-8859-1`, `UTF-16`, `Windows-1252`
- `quote` — default `"`
- `escape` — default `\`
- `nullValue` — string to interpret as null, default empty string
- `dateFormat` — default `yyyy-MM-dd`
- `timestampFormat` — default `yyyy-MM-dd HH:mm:ss`
- `multiLine` — boolean, default `false`
- `inferSchema` — boolean; when `true`, ETL1 samples the file and populates catalog column types; default `false` (catalog schema is used)
- `ignoreLeadingWhiteSpace` / `ignoreTrailingWhiteSpace` — boolean

**JSON / JSONL:**
- `multiLine` — boolean; `false` = one JSON object per line (JSONL); `true` = pretty-printed JSON spanning multiple lines
- `allowComments` — boolean
- `allowUnquotedFieldNames` — boolean
- `mode` — `PERMISSIVE` (default), `DROPMALFORMED`, `FAILFAST`
- `columnNameOfCorruptRecord` — name of the column to collect corrupt records

**Parquet:**
- `mergeSchema` — boolean; merges schemas across files when reading a partitioned dataset
- `datetimeRebaseMode` — `EXCEPTION` (default), `CORRECTED`, `LEGACY`

**ORC:**
- `mergeSchema` — boolean

---

### 7.7 File Compression Handling

Compression is handled transparently by Spark for most columnar formats. For text-based formats, the following codecs are supported for both read and write:

| Codec | Extension | Read | Write | Notes |
|-------|-----------|------|-------|-------|
| None | (no extension) | ✅ | ✅ | Default |
| gzip | `.gz` | ✅ | ✅ | Non-splittable — avoid for very large single files |
| bzip2 | `.bz2` | ✅ | ✅ | Splittable — preferred for large CSV/JSON |
| Snappy | `.snappy` | ✅ | ✅ | Fast; default for Parquet |
| LZ4 | `.lz4` | ✅ | ✅ | Very fast decompression |
| Zstandard (zstd) | `.zst` | ✅ | ✅ | Best compression ratio; default for ORC |
| Deflate | `.deflate` | ✅ | ✅ | |
| Brotli | `.br` | ✅ | ❌ | Read-only; Parquet only |

#### 7.7.1 Codec Selection for Write

The compression codec is configurable per sink node:

```python
df.write \
  .option("compression", "snappy") \  # or gzip, zstd, bzip2, lz4, none
  .format("parquet") \
  .save(path)
```

The platform recommends: Snappy for Parquet, Zstd for ORC, gzip for CSV/JSON in cold storage, none for CSV/JSON in hot-path streaming sinks.

---

### 7.8 Multi-File and Glob Pattern Reads

All file-based connectors support glob patterns in the source path configuration:

| Pattern | Example | Effect |
|---------|---------|--------|
| `*` | `/data/sales/*.csv` | All CSV files in the `sales/` directory |
| `**` | `/data/sales/**/*.csv` | All CSV files in `sales/` and all subdirectories recursively |
| `?` | `/data/events/202?/*.parquet` | Files in year directories matching `202` + any single character |
| `{a,b}` | `/data/{orders,returns}/*.csv` | Files in either `orders/` or `returns/` |
| Date macro | `/data/events/{YYYY}/{MM}/{DD}/` | Resolved at pipeline execution time from the run date parameter |

The platform's metadata service resolves the glob at schema extraction time using the first matched file for schema inference. At execution time, Spark resolves the glob itself — no pre-expansion by ETL1.

---

### 7.9 Partition Discovery and Writing

- **Read:** Partition discovery follows Hive-style partition layout (`year=2024/month=03/day=01/`). The platform's metadata service stores discovered partition columns and allows filtering at pipeline design time.
- **Write:** Partition columns are configurable in the sink node. The codegen layer emits `.partitionBy(...)` in the generated Spark write call.
- **Partition pruning:** When a pipeline reads from a partitioned dataset, the UI allows specifying partition filter expressions. These are pushed down to the file scan as partition predicates.

---

## 8. Analytical and Cloud Data Warehouse Connectivity

### 8.1 Amazon Redshift

#### 8.1.1 Authentication

| Method | Notes |
|--------|-------|
| Username + Password | Standard |
| IAM Auth (temp credentials) | ETL1 calls `redshift:GetClusterCredentials` via HTTPS — no SDK |

#### 8.1.2 Connection Configuration

| Field | Type | Description |
|-------|------|-------------|
| `redshift_cluster_id` | string | Cluster identifier (for IAM auth) |
| `redshift_host` | string | Cluster endpoint |
| `redshift_port` | integer | Default 5439 |
| `redshift_database` | string | Database name |
| `redshift_username` | string | DB username |
| `redshift_password` | secret | DB password (if password auth) |
| `redshift_iam_role_arn` | string | IAM role ARN for S3 COPY/UNLOAD access |
| `redshift_temp_s3_path` | string | S3 path for staging |
| `auth_method` | enum | `PASSWORD`, `IAM_CLUSTER_CREDS` |

#### 8.1.3 PySpark Connectivity (SDK-Free)

```python
df = spark.read \
  .format("io.github.spark_redshift_utils.redshift") \
  .option("url",          spark.conf.get("etl1.conn.<id>.jdbcUrl")) \
  .option("user",         spark.conf.get("etl1.conn.<id>.user")) \
  .option("password",     spark.conf.get("etl1.conn.<id>.password")) \
  .option("dbtable",      "<schema>.<table>") \
  .option("tempdir",      spark.conf.get("etl1.conn.<id>.tempdir")) \
  .option("aws_iam_role", spark.conf.get("etl1.conn.<id>.iamRoleArn")) \
  .load()
```

---

### 8.2 Amazon RDS (All Engines)

RDS databases are accessed via JDBC using the same connector definitions as their on-premises equivalents (Section 6), with these additional fields:

| Field | Type | Description |
|-------|------|-------------|
| `rds_use_iam_auth` | boolean | Use IAM database authentication token |
| `rds_region` | string | Required if `rds_use_iam_auth = true` |
| `rds_ssl_require` | boolean | Default `true` |
| `rds_ssl_ca_bundle_url` | string | URL of the RDS global CA bundle |

---

### 8.3 Azure Synapse Analytics

#### 8.3.1 Connection Configuration

| Field | Type | Description |
|-------|------|-------------|
| `synapse_workspace_name` | string | Workspace name |
| `synapse_server` | string | Endpoint |
| `synapse_database` | string | SQL pool name |
| `synapse_port` | integer | Default 1433 |
| `synapse_username` | string | SQL user (if SQL auth) |
| `synapse_password` | secret | SQL password (if SQL auth) |
| `synapse_staging_adls_path` | string | ADLS Gen2 staging path |
| `synapse_storage_auth_ref` | FK | References ADLS connector |
| `auth_method` | enum | `SQL_AUTH`, `AAD_SERVICE_PRINCIPAL`, `MANAGED_IDENTITY` |

#### 8.3.2 PySpark Connectivity (SDK-Free)

```python
df = spark.read \
  .format("com.microsoft.azure.synapse.spark") \
  .option("url",      spark.conf.get("etl1.conn.<id>.jdbcUrl")) \
  .option("dbTable",  "<schema>.<table>") \
  .option("tempDir",  spark.conf.get("etl1.conn.<id>.tempDir")) \
  .option("forwardSparkAzureStorageCredentials", "true") \
  .load()
```

---

### 8.4 Google BigQuery

#### 8.4.1 Connection Configuration

| Field | Type | Description |
|-------|------|-------------|
| `bigquery_project_id` | string | GCP project |
| `bigquery_dataset` | string | Default dataset |
| `bigquery_location` | string | Dataset location |
| `bigquery_temp_gcs_bucket` | string | GCS staging bucket |
| `bigquery_use_storage_api` | boolean | Use BigQuery Storage Read API — default `true` |
| `gcp_auth_ref` | FK | References GCP connector |

#### 8.4.2 PySpark Connectivity (SDK-Free)

```python
df = spark.read \
  .format("bigquery") \
  .option("table",         "<project>.<dataset>.<table>") \
  .option("parentProject", spark.conf.get("etl1.conn.<id>.projectId")) \
  .load()
```

---

### 8.5 Google Bigtable

#### 8.5.1 Connection Configuration

| Field | Type | Description |
|-------|------|-------------|
| `bigtable_project_id` | string | GCP project |
| `bigtable_instance_id` | string | Bigtable instance |
| `bigtable_app_profile` | string | Default `default` |
| `bigtable_table_id` | string | Table ID |
| `bigtable_column_family` | string | Column family for writes |
| `gcp_auth_ref` | FK | References GCP connector |

#### 8.5.2 PySpark Connectivity (SDK-Free)

```python
df = spark.read \
  .format("bigtable") \
  .option("spark.bigtable.project.id",  spark.conf.get("etl1.conn.<id>.projectId")) \
  .option("spark.bigtable.instance.id", spark.conf.get("etl1.conn.<id>.instanceId")) \
  .option("catalog",                    "<hbase_catalog_json>") \
  .load()
```

---

### 8.6 Amazon Athena

Amazon Athena is a serverless query engine that runs SQL over S3 data via the Glue Data Catalog. ETL1 supports Athena as a query source (read-only for most use cases).

#### 8.6.1 Authentication

Uses the parent AWS connector credentials (Section 5.1). Athena requires S3 access for both reading source data and writing query results.

#### 8.6.2 Connection Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `athena_region` | string | Yes | AWS region for Athena |
| `athena_workgroup` | string | Yes | Athena workgroup name — controls query cost limits |
| `athena_output_s3_path` | string | Yes | S3 path where Athena writes query results |
| `athena_catalog` | string | No | Default `AwsDataCatalog` |
| `athena_database` | string | No | Default database |
| `aws_auth_ref` | FK | Yes | References AWS connector |

#### 8.6.3 PySpark Connectivity (SDK-Free)

Athena is accessed via the **AWS Athena JDBC driver** — a JDBC connector that submits queries to Athena and streams results back via S3:

```python
df = spark.read \
  .format("jdbc") \
  .option("url",      spark.conf.get("etl1.conn.<id>.athenaJdbcUrl")) \
  .option("dbtable",  "<database>.<table>") \
  .option("driver",   "com.simba.athena.jdbc.Driver") \
  .option("S3OutputLocation", spark.conf.get("etl1.conn.<id>.outputS3Path")) \
  .option("AwsRegion",        spark.conf.get("etl1.conn.<id>.region")) \
  .load()
```

No `boto3` or AWS Python SDK is used. The JDBC driver handles all Athena REST API calls internally.

---

### 8.7 Apache Hive / HiveServer2

On-premises Hive is accessed via the HiveServer2 JDBC interface (`hive2://`). This covers both standalone Hive deployments and Hive on Hadoop distributions (Cloudera CDH, Hortonworks HDP, Amazon EMR).

#### 8.7.1 Connection Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hive_host` | string | Yes | HiveServer2 hostname |
| `hive_port` | integer | Yes | Default 10000 |
| `hive_database` | string | No | Default database |
| `hive_auth_method` | enum | Yes | `NONE`, `LDAP`, `KERBEROS` |
| `hive_username` | string | If LDAP | Username |
| `hive_password` | secret | If LDAP | Password |
| `hive_kerberos_principal` | string | If KERBEROS | Service principal, e.g. `hive/_HOST@REALM.COM` |
| `hive_kerberos_keytab` | secret | If KERBEROS | Base64-encoded keytab file |
| `hive_ssl_enabled` | boolean | No | Default `false` |
| `hive_truststore` | secret | If SSL | Base64-encoded JKS truststore |
| `hive_truststore_password` | secret | If SSL | Truststore password |

#### 8.7.2 PySpark Connectivity (SDK-Free)

```python
df = spark.read \
  .format("jdbc") \
  .option("url",      spark.conf.get("etl1.conn.<id>.hiveJdbcUrl")) \
  .option("dbtable",  "<database>.<table>") \
  .option("driver",   "org.apache.hive.jdbc.HiveDriver") \
  .load()
```

---

### 8.8 Databricks (Delta Lakehouse)

Databricks is supported both as a data source (reading Delta tables managed in a Databricks workspace) and as a Spark execution target (submitting jobs to Databricks clusters).

#### 8.8.1 Connection Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `databricks_host` | string | Yes | Workspace URL, e.g. `https://adb-<id>.azuredatabricks.net` |
| `databricks_http_path` | string | Yes | SQL warehouse or cluster HTTP path |
| `databricks_access_token` | secret | Yes | Personal Access Token or Service Principal OAuth token |
| `databricks_catalog` | string | No | Unity Catalog catalog name (if Unity Catalog enabled) |
| `databricks_schema` | string | No | Default schema |

#### 8.8.2 PySpark Connectivity (SDK-Free)

Databricks is accessed via the **Databricks JDBC driver** — no Databricks Python SDK or `dbutils` is used:

```python
df = spark.read \
  .format("jdbc") \
  .option("url",          spark.conf.get("etl1.conn.<id>.jdbcUrl")) \
  .option("dbtable",      "<catalog>.<schema>.<table>") \
  .option("driver",       "com.databricks.client.jdbc.Driver") \
  .option("PWD",          spark.conf.get("etl1.conn.<id>.accessToken")) \
  .load()
```

#### 8.8.3 Databricks as Execution Target

When a pipeline is configured to run on a Databricks cluster, the ETL1 execution service submits the job via the **Databricks Jobs REST API** (`POST /api/2.1/jobs/runs/submit`) over HTTPS — **no Databricks SDK**. The generated PySpark script is uploaded to DBFS or a configured object storage path before submission.

---

### 8.9 Spark Thrift Server

The Spark Thrift Server exposes a Spark session as a HiveServer2-compatible endpoint. This allows ETL1 pipelines to query cached or in-memory Spark datasets from another Spark cluster.

Connection configuration and JDBC driver class are identical to Apache Hive (Section 8.7). The distinction is only in the `connector_type_code` value.

---

### 8.10 Microsoft Fabric / OneLake

Microsoft Fabric OneLake presents as an ADLS Gen2-compatible endpoint. Files stored in OneLake lakehouses are accessed via the `abfss://` URI scheme using Azure Service Principal credentials (Section 5.3).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fabric_workspace_id` | string | Yes | Fabric workspace GUID |
| `fabric_lakehouse_id` | string | Yes | Lakehouse GUID |
| `fabric_onelake_endpoint` | string | Yes | e.g. `https://onelake.dfs.fabric.microsoft.com` |
| `azure_auth_ref` | FK | Yes | References Azure connector for credentials |

The Fabric SQL endpoint is accessed via JDBC using the `mssql-jdbc` driver against the serverless SQL endpoint URL.

---

## 9. Streaming and Messaging Connectors

Streaming connectors are a **distinct connector category** from batch connectors. They have fundamentally different semantics:

- Data is unbounded (no defined end).
- Position is tracked by offsets, sequence numbers, or timestamps — not row counts.
- Schema may arrive inline with the data (e.g. Kafka Schema Registry) or be defined separately.
- Pipeline nodes that use streaming sources generate Spark Structured Streaming code, not batch `spark.read` code.

The platform supports two streaming pipeline modes:

| Mode | Description |
|------|-------------|
| **Micro-batch** | Spark Structured Streaming with `trigger(processingTime='N seconds')`. Low latency, exactly-once semantics with checkpointing. |
| **Continuous** | Spark Structured Streaming with `trigger(continuous='N seconds')`. Experimental — lowest latency but relaxed consistency guarantees. |

### 9.1 Apache Kafka (On-Premises)

#### 9.1.1 Authentication Methods

| Method | Description |
|--------|-------------|
| No Auth (PLAINTEXT) | For internal networks only |
| SASL/PLAIN | Username + password over TLS |
| SASL/SCRAM-256 | Hashed credentials |
| SASL/SCRAM-512 | Hashed credentials with SHA-512 |
| mTLS (SSL) | Mutual TLS with client certificate |
| Kerberos (GSSAPI) | Enterprise LDAP/AD environments |

#### 9.1.2 Kafka Connection Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kafka_bootstrap_servers` | string | Yes | Comma-separated `host:port` list |
| `kafka_security_protocol` | enum | Yes | `PLAINTEXT`, `SSL`, `SASL_PLAINTEXT`, `SASL_SSL` |
| `kafka_sasl_mechanism` | enum | If SASL | `PLAIN`, `SCRAM-SHA-256`, `SCRAM-SHA-512`, `GSSAPI` |
| `kafka_sasl_username` | string | If PLAIN/SCRAM | Username |
| `kafka_sasl_password` | secret | If PLAIN/SCRAM | Password |
| `kafka_ssl_ca_cert` | secret | If SSL | CA certificate (PEM) for broker certificate verification |
| `kafka_ssl_client_cert` | secret | If mTLS | Client certificate (PEM) |
| `kafka_ssl_client_key` | secret | If mTLS | Client private key (PEM) |
| `kafka_ssl_client_key_passphrase` | secret | If mTLS | Client key passphrase |
| `kafka_schema_registry_url` | string | No | Confluent Schema Registry URL (for Avro/Protobuf topics) |
| `kafka_schema_registry_auth_ref` | FK | No | References connector for Schema Registry credentials |
| `kafka_consumer_group_id_prefix` | string | No | Prefix for auto-generated consumer group IDs |

#### 9.1.3 Topic / Dataset Configuration (Pipeline Node Level)

These are configured per pipeline node, not per connection:

| Field | Description |
|-------|-------------|
| `kafka_topic` | Topic name (may include partition-level expression) |
| `kafka_starting_offsets` | `earliest`, `latest`, or JSON offset map |
| `kafka_ending_offsets` | `latest`, or JSON offset map (batch mode only) |
| `kafka_max_offsets_per_trigger` | Rate limit: max offsets to process per micro-batch |
| `kafka_message_format` | `JSON`, `AVRO`, `PROTOBUF`, `STRING`, `BINARY` |
| `kafka_key_format` | `STRING`, `AVRO`, `BINARY` |
| `kafka_include_headers` | Whether to include Kafka message headers as a column |
| `kafka_fail_on_data_loss` | `true` (default) — fail if offsets are no longer available |

#### 9.1.4 PySpark Read (Structured Streaming)

```python
df = spark.readStream \
  .format("kafka") \
  .option("kafka.bootstrap.servers", spark.conf.get("etl1.conn.<id>.bootstrapServers")) \
  .option("kafka.security.protocol", spark.conf.get("etl1.conn.<id>.securityProtocol")) \
  .option("kafka.sasl.mechanism",    spark.conf.get("etl1.conn.<id>.saslMechanism")) \
  .option("kafka.sasl.jaas.config",  spark.conf.get("etl1.conn.<id>.saslJaasConfig")) \
  .option("subscribe",               "<topic>") \
  .option("startingOffsets",         "earliest") \
  .option("maxOffsetsPerTrigger",    "50000") \
  .load()
```

The `kafka.sasl.jaas.config` value is assembled by the codegen layer from the decrypted username/password and SASL mechanism, and injected via `--conf` at submit time.

#### 9.1.5 PySpark Write (Streaming Sink)

```python
query = df.writeStream \
  .format("kafka") \
  .option("kafka.bootstrap.servers", spark.conf.get("etl1.conn.<id>.bootstrapServers")) \
  .option("kafka.sasl.jaas.config",  spark.conf.get("etl1.conn.<id>.saslJaasConfig")) \
  .option("topic",                   "<output_topic>") \
  .option("checkpointLocation",      "<checkpoint_path>") \
  .start()
```

---

### 9.2 Amazon MSK / Confluent Cloud

Both MSK and Confluent Cloud expose a Kafka-compatible API. They use the same connector configuration as Section 9.1, with the following notes:

| Platform | Auth Mechanism | Notes |
|----------|---------------|-------|
| Amazon MSK (IAM auth) | SASL/OAUTHBEARER + AWS SigV4 | Requires `aws-msk-iam-auth` JAR in `--jars`; AWS credentials injected via Hadoop config |
| Amazon MSK (SCRAM) | SASL/SCRAM-SHA-512 | Standard SCRAM — same as on-prem |
| Confluent Cloud | SASL/PLAIN | API Key as username, API Secret as password over TLS |
| Confluent Cloud | OAuth | `SASL/OAUTHBEARER` with Confluent Identity Pool |

---

### 9.3 Azure Event Hubs

Azure Event Hubs has two protocol modes: **Kafka-compatible** (uses the Kafka connector from Section 9.1) and **native AMQP**.

#### 9.3.1 Event Hubs Kafka Mode (Preferred)

Event Hubs exposes a Kafka endpoint. The connection configuration is the same as Section 9.1 with:

- `kafka_bootstrap_servers` = `<namespace>.servicebus.windows.net:9093`
- `kafka_security_protocol` = `SASL_SSL`
- `kafka_sasl_mechanism` = `PLAIN`
- Username = `$ConnectionString`
- Password = the Event Hubs connection string (stored encrypted)

#### 9.3.2 Event Hubs Native Connection Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventhubs_namespace` | string | Yes | Event Hubs namespace |
| `eventhubs_name` | string | Yes | Event Hub (topic) name |
| `eventhubs_connection_string` | secret | Yes | Shared access connection string |
| `eventhubs_consumer_group` | string | No | Default `$Default` |
| `eventhubs_starting_position` | enum | No | `BEGINNING`, `END`, `SEQUENCE_NUMBER`, `ENQUEUE_TIME` |
| `azure_auth_ref` | FK | No | References Azure connector for AAD-based auth |

#### 9.3.3 PySpark Connectivity (SDK-Free)

Event Hubs with Kafka mode uses the standard Spark Kafka connector (no Azure SDK). For native AMQP mode, the `azure-eventhubs-spark` connector JAR is used:

```python
df = spark.readStream \
  .format("eventhubs") \
  .options(**eventHubsConf) \
  .load()
```

where `eventHubsConf` is assembled from `spark.conf.get(...)` values — no Python SDK import.

---

### 9.4 Amazon Kinesis

#### 9.4.1 Connection Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kinesis_stream_name` | string | Yes | Stream name |
| `kinesis_region` | string | Yes | AWS region |
| `kinesis_starting_position` | enum | Yes | `TRIM_HORIZON`, `LATEST`, `AT_TIMESTAMP`, `AT_SEQUENCE_NUMBER` |
| `kinesis_starting_timestamp` | string | If AT_TIMESTAMP | ISO-8601 timestamp |
| `aws_auth_ref` | FK | Yes | References AWS connector for credentials |

#### 9.4.2 PySpark Connectivity (SDK-Free)

Kinesis is accessed via the **Spark Kinesis connector** (`spark-streaming-kinesis-asl` JAR):

```python
df = spark.readStream \
  .format("kinesis") \
  .option("streamName",        spark.conf.get("etl1.conn.<id>.streamName")) \
  .option("regionName",        spark.conf.get("etl1.conn.<id>.region")) \
  .option("awsAccessKeyId",    spark.conf.get("etl1.conn.<id>.accessKeyId")) \
  .option("awsSecretKey",      spark.conf.get("etl1.conn.<id>.secretKey")) \
  .option("awsSessionToken",   spark.conf.get("etl1.conn.<id>.sessionToken")) \
  .option("startingPosition",  "TRIM_HORIZON") \
  .load()
```

No `boto3` or Kinesis Python library is imported.

---

### 9.5 Google Pub/Sub

#### 9.5.1 Connection Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pubsub_project_id` | string | Yes | GCP project |
| `pubsub_topic` | string | Yes for write | Topic name |
| `pubsub_subscription` | string | Yes for read | Subscription name |
| `pubsub_message_format` | enum | No | `JSON`, `AVRO`, `PROTOBUF`, `BINARY` |
| `gcp_auth_ref` | FK | Yes | References GCP connector |

#### 9.5.2 PySpark Connectivity (SDK-Free)

```python
df = spark.readStream \
  .format("pubsub") \
  .option("pubsub.project",      spark.conf.get("etl1.conn.<id>.projectId")) \
  .option("pubsub.subscription", spark.conf.get("etl1.conn.<id>.subscription")) \
  .option("gcp.credentials.key", spark.conf.get("etl1.conn.<id>.saKeyBase64")) \
  .load()
```

Uses `spark-pubsub` connector JAR — no `google-cloud-pubsub` Python package.

---

### 9.6 Apache Pulsar

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pulsar_service_url` | string | Yes | e.g. `pulsar://localhost:6650` or `pulsar+ssl://` |
| `pulsar_admin_url` | string | Yes | e.g. `http://localhost:8080` |
| `pulsar_auth_plugin` | enum | No | `NONE`, `TOKEN`, `TLS`, `OAUTH2` |
| `pulsar_auth_token` | secret | If TOKEN | JWT token |
| `pulsar_ssl_ca_cert` | secret | If TLS | CA certificate |
| `pulsar_topic` | string | Yes | Topic name, e.g. `persistent://tenant/namespace/topic` |

PySpark connectivity uses the `pulsar-spark` connector JAR. No Python Pulsar client is imported.

---

## 10. NoSQL and Document Store Connectors

NoSQL connectors require special handling in several areas compared to relational connectors:

- **Schema flexibility:** Document stores may have no fixed schema or a schema that varies per document. The platform models this as a schema-on-read arrangement with a user-defined schema mapping in the catalog.
- **No JDBC:** NoSQL stores are accessed via dedicated Spark connector JARs implementing the DataSource V2 API.
- **Preview complexity:** Previewing data from schemaless stores requires sampling a configurable number of documents and inferring a representative schema.

### 10.1 MongoDB

#### 10.1.1 Authentication Methods

| Method | Description |
|--------|-------------|
| Username + Password (SCRAM) | Standard MongoDB authentication |
| X.509 Certificate | Certificate-based auth for secure deployments |
| AWS IAM (Atlas) | For MongoDB Atlas with AWS IAM roles |
| LDAP | Enterprise deployments with LDAP pass-through |

#### 10.1.2 Connection Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mongo_uri` | secret | Yes | Full MongoDB connection URI (`mongodb://...` or `mongodb+srv://...`) — stored encrypted as it may contain credentials |
| `mongo_database` | string | Yes | Database name |
| `mongo_collection` | string | No | Default collection (overridable per dataset) |
| `mongo_auth_source` | string | No | Default `admin` |
| `mongo_read_preference` | enum | No | `PRIMARY`, `PRIMARY_PREFERRED`, `SECONDARY`, `NEAREST` |
| `mongo_ssl_enabled` | boolean | No | Default `false` |
| `mongo_ssl_ca_cert` | secret | If SSL | CA certificate (PEM) |
| `mongo_x509_cert` | secret | If X.509 | Client certificate (PEM) |
| `mongo_x509_key` | secret | If X.509 | Client key (PEM) |

#### 10.1.3 PySpark Connectivity (SDK-Free)

```python
df = spark.read \
  .format("mongodb") \
  .option("spark.mongodb.input.uri",        spark.conf.get("etl1.conn.<id>.mongoUri")) \
  .option("spark.mongodb.input.database",   spark.conf.get("etl1.conn.<id>.database")) \
  .option("spark.mongodb.input.collection", "<collection>") \
  .load()
```

Uses the **MongoDB Spark Connector** JAR (`mongo-spark-connector_<version>.jar`) — no `pymongo` import.

#### 10.1.4 Schema Handling

MongoDB documents are schemaless. The platform handles this as follows:

- On catalog registration, the metadata service samples up to 1000 documents and infers a representative schema using Spark schema inference.
- The inferred schema is stored in `catalog.dataset_columns` as the "working schema."
- At pipeline execution time, the Spark MongoDB connector reads documents and casts them to the working schema. Documents with missing fields produce nulls; extra fields are dropped unless `mergeSchema=true` is set.
- Users can manually override the inferred schema in the catalog UI.

---

### 10.2 Apache Cassandra / DataStax Astra

#### 10.2.1 Connection Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cassandra_contact_points` | string | Yes | Comma-separated hostnames |
| `cassandra_port` | integer | Yes | Default 9042 |
| `cassandra_datacenter` | string | Yes | Local datacenter name |
| `cassandra_keyspace` | string | Yes | Keyspace name |
| `cassandra_username` | string | If auth | Cassandra username |
| `cassandra_password` | secret | If auth | Cassandra password |
| `cassandra_ssl_enabled` | boolean | No | Default `false` |
| `cassandra_ssl_ca_cert` | secret | If SSL | CA certificate |
| `cassandra_ssl_client_cert` | secret | If mTLS | Client certificate |
| `cassandra_ssl_client_key` | secret | If mTLS | Client key |
| `astra_bundle_zip_b64` | secret | If Astra | Secure connect bundle (base64) |
| `astra_token` | secret | If Astra | Astra application token |

#### 10.2.2 PySpark Connectivity (SDK-Free)

```python
df = spark.read \
  .format("org.apache.spark.sql.cassandra") \
  .option("spark.cassandra.connection.host",     spark.conf.get("etl1.conn.<id>.contactPoints")) \
  .option("spark.cassandra.auth.username",       spark.conf.get("etl1.conn.<id>.username")) \
  .option("spark.cassandra.auth.password",       spark.conf.get("etl1.conn.<id>.password")) \
  .option("keyspace",  "<keyspace>") \
  .option("table",     "<table>") \
  .load()
```

Uses **spark-cassandra-connector** JAR — no Python Cassandra driver import.

---

### 10.3 Amazon DynamoDB

#### 10.3.1 Connection Configuration

Uses the parent AWS connector (Section 5.1) for credentials. Per-dataset configuration:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dynamodb_table` | string | Yes | Table name |
| `dynamodb_region` | string | Yes | AWS region |
| `dynamodb_read_throughput` | integer | No | Read capacity units consumed per second — default 1 |
| `aws_auth_ref` | FK | Yes | References AWS connector |

#### 10.3.2 PySpark Connectivity (SDK-Free)

DynamoDB is accessed via the **AWS Glue DynamoDB Spark connector** JAR (available as open source, no SDK dependency in the script):

```python
df = spark.read \
  .format("dynamodb") \
  .option("tableName",   spark.conf.get("etl1.conn.<id>.tableName")) \
  .option("region",      spark.conf.get("etl1.conn.<id>.region")) \
  .option("accessKeyId", spark.conf.get("etl1.conn.<id>.accessKeyId")) \
  .option("secretKey",   spark.conf.get("etl1.conn.<id>.secretKey")) \
  .load()
```

---

### 10.4 Azure Cosmos DB

#### 10.4.1 Connection Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cosmos_endpoint` | string | Yes | Cosmos DB account endpoint URI |
| `cosmos_account_key` | secret | If key auth | Account key |
| `cosmos_database` | string | Yes | Database name |
| `cosmos_container` | string | No | Default container (overridable per dataset) |
| `cosmos_preferred_regions` | string | No | Comma-separated preferred regions for geo-redundant accounts |
| `auth_method` | enum | Yes | `ACCOUNT_KEY`, `AAD_SERVICE_PRINCIPAL` |
| `azure_auth_ref` | FK | If AAD_SP | References Azure connector |

#### 10.4.2 PySpark Connectivity (SDK-Free)

```python
df = spark.read \
  .format("cosmos.oltp") \
  .option("spark.synapse.linkedService", "<linkedService>") \
  .option("spark.cosmos.accountEndpoint",  spark.conf.get("etl1.conn.<id>.endpoint")) \
  .option("spark.cosmos.accountKey",       spark.conf.get("etl1.conn.<id>.accountKey")) \
  .option("spark.cosmos.database",         spark.conf.get("etl1.conn.<id>.database")) \
  .option("spark.cosmos.container",        "<container>") \
  .load()
```

Uses the **Azure Cosmos DB Spark connector** JAR — no Azure SDK Python import.

---

### 10.5 Elasticsearch / OpenSearch

#### 10.5.1 Connection Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `es_hosts` | string | Yes | Comma-separated `host:port` list |
| `es_scheme` | enum | Yes | `http`, `https` |
| `es_username` | string | If basic auth | Username |
| `es_password` | secret | If basic auth | Password |
| `es_api_key` | secret | If API key | Base64-encoded API key |
| `es_ssl_ca_cert` | secret | If HTTPS | CA certificate |
| `es_index` | string | No | Default index (overridable per dataset) |
| `es_net_ssl_cert_allow_self_signed` | boolean | No | Default `false` |
| `es_nodes_wan_only` | boolean | No | Default `false` — set `true` for Elastic Cloud / OpenSearch Service |

#### 10.5.2 PySpark Connectivity (SDK-Free)

```python
df = spark.read \
  .format("org.elasticsearch.spark.sql") \
  .option("es.nodes",          spark.conf.get("etl1.conn.<id>.hosts")) \
  .option("es.net.ssl",        "true") \
  .option("es.net.http.auth.user", spark.conf.get("etl1.conn.<id>.username")) \
  .option("es.net.http.auth.pass", spark.conf.get("etl1.conn.<id>.password")) \
  .option("es.nodes.wan.only", "true") \
  .load("<index>")
```

Uses the **elasticsearch-hadoop** JAR (`elasticsearch-spark-<version>.jar`) — no `elasticsearch-py` import.

---

### 10.6 Apache HBase (On-Premises)

HBase is accessed via the Spark-HBase connector (SHC), which translates Spark operations to HBase Get/Scan calls over the HBase Java client.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hbase_zookeeper_quorum` | string | Yes | Comma-separated ZooKeeper hosts |
| `hbase_zookeeper_port` | integer | Yes | Default 2181 |
| `hbase_znode_parent` | string | No | Default `/hbase` |
| `hbase_table` | string | No | Default table (overridable per dataset) |
| `hbase_auth_method` | enum | Yes | `SIMPLE`, `KERBEROS` |
| `hbase_kerberos_principal` | string | If KERBEROS | |
| `hbase_kerberos_keytab` | secret | If KERBEROS | Base64-encoded keytab |

#### 10.6.1 PySpark Connectivity (SDK-Free)

```python
catalog = '{"table":{"namespace":"default","name":"<table>"},...}'
df = spark.read \
  .options(catalog=catalog) \
  .format("org.apache.spark.sql.execution.datasources.hbase") \
  .load()
```

Uses **SHC** (`shc-core-<version>.jar`) — no Python HBase client library.

---

### 10.7 Redis (Reference Data, Read-Only)

Redis is supported as a **read-only** reference data source for small lookup tables (e.g. country codes, product categories) that need to be broadcast-joined within a pipeline.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `redis_host` | string | Yes | Redis host |
| `redis_port` | integer | Yes | Default 6379 |
| `redis_password` | secret | No | Redis AUTH password |
| `redis_ssl_enabled` | boolean | No | Default `false` |
| `redis_database` | integer | No | Default `0` |
| `redis_key_pattern` | string | No | Key glob pattern for scanning (e.g. `user:*`) |

PySpark connectivity uses the **spark-redis** connector JAR. Write is not supported via this connector — Redis is a reference-data source only.

---

## 11. Data Lakehouse and Catalog Integrations

### 11.1 Apache Hive Metastore

The Hive Metastore is used as a metadata catalog — it maps table names to their physical storage locations (HDFS, S3, GCS) and schemas. ETL1 can read from and register tables in a Hive Metastore.

#### 11.1.1 Connection Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hive_metastore_uri` | string | Yes | Thrift URI, e.g. `thrift://metastore-host:9083` |
| `hive_metastore_warehouse_dir` | string | No | Default warehouse directory path |
| `hive_metastore_auth_method` | enum | Yes | `NONE`, `KERBEROS` |
| `hive_metastore_principal` | string | If KERBEROS | e.g. `hive/_HOST@REALM.COM` |
| `hive_metastore_keytab` | secret | If KERBEROS | Base64-encoded keytab |

#### 11.1.2 Spark Integration

When a pipeline uses a dataset registered in the Hive Metastore, the codegen layer configures the SparkSession to connect to the external Metastore:

```python
spark = SparkSession.builder \
  .config("hive.metastore.uris", spark.conf.get("etl1.conn.<id>.metastoreUri")) \
  .config("spark.sql.warehouse.dir", spark.conf.get("etl1.conn.<id>.warehouseDir")) \
  .enableHiveSupport() \
  .getOrCreate()

df = spark.table("<database>.<table>")
```

---

### 11.2 AWS Glue Data Catalog

The AWS Glue Data Catalog serves as a Hive-compatible metastore for data on S3. ETL1 reads table metadata from the Glue catalog and can optionally register output tables.

#### 11.2.1 Connection Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `glue_region` | string | Yes | AWS region for the Glue catalog |
| `glue_catalog_id` | string | No | Cross-account catalog ID (optional) |
| `aws_auth_ref` | FK | Yes | References AWS connector |

#### 11.2.2 Spark Integration

```python
spark = SparkSession.builder \
  .config("hive.metastore.client.factory.class",
          "com.amazonaws.glue.catalog.metastore.AWSGlueDataCatalogHiveClientFactory") \
  .config("spark.hadoop.hive.metastore.glue.catalogid", spark.conf.get("etl1.conn.<id>.catalogId")) \
  .enableHiveSupport() \
  .getOrCreate()
```

The `aws-glue-datacatalog-spark-client.jar` is added to `--jars`. No Boto3 or Glue Python SDK is used in the script.

#### 11.2.3 Metadata Extraction from Glue

The metadata service calls the Glue REST API directly (`GET https://glue.{region}.amazonaws.com/`) using SigV4-signed HTTPS requests — **no AWS SDK**. Tables, columns, and partition schemas are extracted and stored in the ETL1 catalog.

---

### 11.3 Databricks Unity Catalog

Unity Catalog provides a three-level namespace: catalog → schema → table. ETL1 connects to Unity Catalog via the Databricks JDBC driver (Section 8.8) and can browse the catalog hierarchy.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `unity_catalog_host` | string | Yes | Databricks workspace URL |
| `unity_catalog_http_path` | string | Yes | SQL warehouse HTTP path |
| `unity_catalog_access_token` | secret | Yes | PAT or OAuth token |
| `unity_default_catalog` | string | No | Default catalog name |

Metadata is extracted via SQL queries (`SHOW CATALOGS`, `SHOW SCHEMAS`, `DESCRIBE TABLE EXTENDED`) executed over JDBC.

---

### 11.4 Apache Iceberg REST Catalog

The Iceberg REST Catalog specification provides a vendor-neutral catalog API. This enables ETL1 to connect to any catalog that implements the spec (Polaris, Nessie, Gravitino, etc.).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `iceberg_catalog_uri` | string | Yes | REST catalog endpoint |
| `iceberg_catalog_warehouse` | string | Yes | Default warehouse path |
| `iceberg_auth_method` | enum | Yes | `NONE`, `BEARER_TOKEN`, `OAUTH2` |
| `iceberg_bearer_token` | secret | If BEARER | Bearer token |
| `iceberg_oauth2_client_id` | string | If OAUTH2 | |
| `iceberg_oauth2_client_secret` | secret | If OAUTH2 | |
| `iceberg_oauth2_token_endpoint` | string | If OAUTH2 | |

#### 11.4.1 Spark Integration

```python
spark = SparkSession.builder \
  .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \
  .config("spark.sql.catalog.<name>", "org.apache.iceberg.spark.SparkCatalog") \
  .config("spark.sql.catalog.<name>.type", "rest") \
  .config("spark.sql.catalog.<name>.uri", spark.conf.get("etl1.conn.<id>.catalogUri")) \
  .config("spark.sql.catalog.<name>.token", spark.conf.get("etl1.conn.<id>.bearerToken")) \
  .getOrCreate()
```

---

## 12. Metadata Extraction

### 12.1 What Metadata Is Extracted

| Metadata Level | What Is Extracted |
|----------------|-------------------|
| **Database / Catalog** | Database names visible to the configured user |
| **Schema** | Schema / namespace names within each database |
| **Table / View** | Table name, type (TABLE / VIEW / EXTERNAL / MATERIALIZED VIEW / STREAM / TOPIC), estimated row count, creation time, last modified time |
| **Column** | Column name, ordinal position, data type (source-native and mapped Spark type), nullable, default value, comment |
| **Partition** | Partition column names, partition key order, discovered partition values |
| **Primary Key** | Column(s) forming the primary key |
| **Foreign Key** | Referenced table and column names |
| **Indexes** | Index name, columns, uniqueness |
| **Table Comment / Description** | Source system description |
| **Statistics** | Approximate row count, average row size, data size |
| **File Metadata** (file sources) | File path, size, last modified, detected format, compression codec |
| **Topic Metadata** (streaming) | Topic name, partition count, replication factor, retention period, message format |
| **Document Sample Schema** (NoSQL) | Inferred schema from sampled documents |

### 12.2 Extraction Method by Source Type

| Source Type | Extraction Method |
|-------------|-------------------|
| All JDBC (RDBMS, DW) | `DatabaseMetaData` API + source-specific `information_schema` queries |
| S3 / GCS / Azure Blob | File listing via Hadoop connector; schema inferred from sample file |
| Local FS / NFS | Recursive directory walk; schema from sample file |
| SFTP / FTP | Remote directory listing via JSch; schema from first N bytes of sample file |
| SMB / CIFS | Directory listing via jcifs-ng; schema from sample file |
| Snowflake | `INFORMATION_SCHEMA` queries via JDBC |
| BigQuery | BigQuery REST API `tables.get` — plain HTTPS |
| Bigtable | Bigtable Admin REST API — plain HTTPS |
| Athena | Glue Data Catalog REST API (same as Glue) or JDBC `DatabaseMetaData` |
| Hive / HiveServer2 | JDBC `DatabaseMetaData` + `DESCRIBE FORMATTED` |
| Kafka | Admin Client API (via Kafka AdminClient JAR) — topics, partitions, configs |
| MongoDB | Document sampling + Spark schema inference |
| Cassandra | `system_schema.tables` + `system_schema.columns` CQL queries |
| DynamoDB | `DescribeTable` REST API — plain HTTPS |
| Cosmos DB | Container metadata via Cosmos DB REST API — plain HTTPS |
| Elasticsearch | `GET /<index>/_mapping` REST endpoint — plain HTTPS |
| HBase | `hbase:meta` table scan via SHC |
| Hive Metastore | Thrift API — `get_table`, `get_all_tables` |
| Glue Data Catalog | Glue REST API — plain HTTPS with SigV4 auth |
| Unity Catalog | JDBC + SQL (`DESCRIBE TABLE EXTENDED`) |
| Iceberg REST Catalog | REST API `GET /v1/namespaces/{ns}/tables` |
| Delta / Iceberg / Hudi on storage | Delta log / Iceberg manifest / Hudi timeline parsed by preview service |

### 12.3 Metadata Refresh

| Trigger | Behaviour |
|---------|-----------|
| Manual (UI button) | User clicks "Refresh Schema" — runs extraction for that dataset only |
| Scheduled (cron) | Configurable background job — default: once per day |
| On pipeline save | Triggered if the dataset has never been extracted |
| Schema drift detection | Post-execution comparison between actual schema and catalog schema — drift raises an alert |
| SFTP: on file arrival | Optional webhook or polling trigger for SFTP sources that deliver files on a schedule |

### 12.4 Metadata Storage Schema (logical)

```
catalog.connectors               — one row per configured external connection
catalog.datasets                 — one row per logical table / path / topic
catalog.dataset_columns          — one row per column / field / attribute
catalog.dataset_partitions       — one row per partition key column
catalog.dataset_keys             — primary and foreign keys
catalog.dataset_statistics       — row counts and size estimates, timestamped
catalog.schema_snapshots         — versioned history of schema at each extraction
catalog.connector_health         — health check results, timestamped
catalog.topic_metadata           — streaming topic: partition count, retention, offsets
```

---

## 13. PySpark Runtime Connectivity — SDK-Free Approach

This section is the authoritative specification for how generated PySpark scripts connect to external systems **without importing any cloud-vendor Python SDK** (no `boto3`, no `google-cloud-*`, no `azure-*`, no `snowflake-connector-python`, no `pymongo`, no `elasticsearch-py`, no `paramiko`).

### 13.1 The Core Pattern

All cloud connectivity in generated PySpark code relies on three open mechanisms:

1. **Hadoop-compatible connectors** — JARs implementing the `FileSystem` interface (s3a, gs, abfss, file).
2. **JDBC datasource** — Spark's built-in JDBC reader/writer with an appropriate JDBC driver JAR.
3. **Spark DataSource V2 connectors** — Open-source or vendor JARs (e.g. spark-bigquery-connector, spark-redshift-connector, spark-kafka, mongo-spark-connector) invoked by format name string only — no Python import.

### 13.2 Spark Configuration Injection — Generated Pattern

```python
# AUTO-GENERATED — DO NOT EDIT
# Credentials are injected into SparkConf at job submission time via --conf.
# This script never accesses credentials directly.

from pyspark.sql import SparkSession

spark = SparkSession.builder \
  .appName("etl1_pipeline_<pipeline_id>_run_<run_id>") \
  .getOrCreate()
```

### 13.3 Credential Passing — Spark Submit

```bash
spark-submit \
  --master <cluster_url> \
  --conf spark.hadoop.fs.s3a.access.key=<key> \
  --conf spark.hadoop.fs.s3a.secret.key=<secret> \
  --conf etl1.conn.<id>.jdbcUrl=<url> \
  --conf etl1.conn.<id>.user=<user> \
  --conf etl1.conn.<id>.password=<password> \
  --conf etl1.conn.<id>.mongoUri=<uri> \
  --conf etl1.conn.<id>.bootstrapServers=<servers> \
  --conf etl1.conn.<id>.saslJaasConfig="org.apache.kafka.common.security.plain.PlainLoginModule required username='...' password='...';" \
  --jars hdfs:///etl1/lib/<all-required-jars> \
  hdfs:///etl1/scripts/pipeline_<id>_run_<runid>.py
```

The `--conf` values come from the decrypted secrets blob — they exist in memory only during command construction and are never written to any file or log.

### 13.4 JAR Dependency Management

| Connector Type | Required JARs |
|----------------|--------------|
| S3 / S3-Compatible | `hadoop-aws-<v>.jar`, `aws-java-sdk-bundle-<v>.jar` |
| GCS | `gcs-connector-hadoop3-<v>-shaded.jar` |
| ADLS Gen2 / Azure Blob | `hadoop-azure-<v>.jar`, `azure-storage-<v>.jar` |
| Redshift | `spark-redshift_<v>.jar`, `redshift-jdbc42-<v>.jar` |
| BigQuery | `spark-bigquery-with-dependencies_<v>.jar` |
| Bigtable | `spark-bigtable_<v>.jar` |
| Snowflake | `spark-snowflake_<v>.jar`, `snowflake-jdbc-<v>.jar` |
| Synapse | `spark-mssql-connector_<v>.jar`, `mssql-jdbc-<v>.jar` |
| Athena | `AthenaJDBC42_<v>.jar` |
| Hive / Thrift Server | `hive-jdbc-<v>-standalone.jar` |
| Databricks | `DatabricksJDBC42-<v>.jar` |
| Kafka | Included in Spark (`spark-sql-kafka-0-10`) |
| Kinesis | `spark-streaming-kinesis-asl_<v>.jar` |
| Event Hubs | `azure-eventhubs-spark_<v>.jar` |
| Pub/Sub | `spark-pubsub-<v>.jar` |
| Pulsar | `pulsar-spark-connector_<v>.jar` |
| MongoDB | `mongo-spark-connector_<v>.jar` |
| Cassandra | `spark-cassandra-connector_<v>.jar` |
| DynamoDB | `spark-dynamodb_<v>.jar` |
| Cosmos DB | `azure-cosmos-spark_<v>.jar` |
| Elasticsearch | `elasticsearch-spark-<v>.jar` |
| HBase | `shc-core-<v>.jar` |
| Redis | `spark-redis_<v>.jar` |
| SFTP | `spark-sftp_<v>.jar` |
| PostgreSQL | `postgresql-<v>.jar` |
| MySQL | `mysql-connector-j-<v>.jar` |
| Oracle | `ojdbc11-<v>.jar` |
| SQL Server | `mssql-jdbc-<v>.jar` |
| Db2 | `db2jcc4-<v>.jar` |
| Delta Lake | `delta-core_<v>.jar` |
| Iceberg | `iceberg-spark-runtime-<v>.jar` |
| Hudi | `hudi-spark-bundle_<v>.jar` |
| Avro | Included in Spark |
| Protobuf | Included in Spark 3.4+ |
| MSK IAM Auth | `aws-msk-iam-auth-<v>-all.jar` |
| Glue Catalog | `aws-glue-datacatalog-spark-client-<v>.jar` |

---

## 14. Write Modes and Data Sink Strategies

Every sink node in a pipeline must specify a write mode and optionally a write strategy. These determine how new data interacts with existing data at the destination.

### 14.1 Batch Write Modes

| Mode | Spark Equivalent | Description |
|------|-----------------|-------------|
| `OVERWRITE` | `.mode("overwrite")` | Replaces all existing data at the target. For partitioned datasets, replaces only the partitions present in the current write by default (see `DYNAMIC_PARTITION_OVERWRITE`). |
| `APPEND` | `.mode("append")` | Adds new rows without touching existing data. No deduplication. |
| `ERROR_IF_EXISTS` | `.mode("error")` | Fails the pipeline if any data exists at the target. Safe for first-load scenarios. |
| `IGNORE_IF_EXISTS` | `.mode("ignore")` | No-op if target already has data. Useful for idempotent re-runs. |
| `UPSERT` | Delta/Iceberg `MERGE INTO` | Inserts new rows; updates rows where the merge key matches. Requires Delta, Iceberg, or Hudi. |
| `DELETE_WHERE` | Delta/Iceberg `DELETE` | Deletes rows matching a predicate. Used for GDPR/right-to-forget pipelines. |
| `MERGE_SCD1` | Delta `MERGE` | Slowly Changing Dimension Type 1 — update in place, no history. |
| `MERGE_SCD2` | Delta `MERGE` + insert | Slowly Changing Dimension Type 2 — expire old row, insert new row with effective dates. |

### 14.2 Dynamic Partition Overwrite

When `OVERWRITE` is used with a partitioned dataset, the platform supports two sub-modes:

| Sub-mode | Spark Config | Behaviour |
|----------|-------------|-----------|
| `STATIC` (default Spark) | `spark.sql.sources.partitionOverwriteMode=static` | Overwrites the entire table — all partitions deleted before write |
| `DYNAMIC` | `spark.sql.sources.partitionOverwriteMode=dynamic` | Overwrites only the partitions present in the incoming DataFrame — other partitions are untouched |

The ETL1 sink node exposes this as a toggle: "Overwrite entire table" vs "Overwrite matching partitions only."

### 14.3 UPSERT / MERGE — Generated Code Pattern (Delta Lake)

```python
from delta.tables import DeltaTable

target = DeltaTable.forPath(spark, target_path)

target.alias("tgt").merge(
    source=df.alias("src"),
    condition="tgt.<merge_key> = src.<merge_key>"
).whenMatchedUpdateAll() \
 .whenNotMatchedInsertAll() \
 .execute()
```

The merge key(s) are configured on the sink node in the pipeline UI and stored in the pipeline IR.

### 14.4 SCD Type 2 — Generated Code Pattern (Delta Lake)

```python
target.alias("tgt").merge(
    source=df.alias("src"),
    condition="tgt.<key> = src.<key> AND tgt.scd_is_current = true"
).whenMatchedUpdate(
    condition="tgt.<tracked_col> <> src.<tracked_col>",
    set={"scd_is_current": "false", "scd_end_date": "current_timestamp()"}
).whenNotMatchedInsertAll() \
 .execute()

# Then insert new versions for updated rows
df_updates.write.format("delta").mode("append").save(target_path)
```

The SCD Type 2 configuration in the sink node specifies: natural key columns, tracked columns, and the effective date / is_current flag column names.

### 14.5 Schema Evolution on Write

| Mode | Behaviour |
|------|-----------|
| `STRICT` (default) | Fail if the source schema does not exactly match the target schema |
| `MERGE` | Add new columns from source to the target schema; existing columns not in source are written as null |
| `OVERWRITE_SCHEMA` | Replace the target schema entirely with the source schema |

Schema evolution mode is configured on the sink node and emitted as Spark write options (`mergeSchema=true` for Parquet/Delta, or `overwriteSchema=true` for Delta).

### 14.6 Write Quality Checks (Pre-Commit Validation)

Before committing a write, the pipeline can be configured to assert quality thresholds. If any check fails, the write is rolled back (for transactional formats like Delta) or the output files are deleted.

| Check | Description |
|-------|-------------|
| `ROW_COUNT_MIN` | Fail if output row count < N |
| `ROW_COUNT_MAX` | Fail if output row count > N |
| `ROW_COUNT_VS_SOURCE` | Fail if output row count deviates from source row count by more than X% |
| `NULL_COUNT_MAX` | Fail if any specified column has more than N% nulls |
| `SCHEMA_MATCH` | Fail if output schema does not match the registered catalog schema |
| `NO_DUPLICATES` | Fail if the output contains duplicate rows on the specified key columns |
| `CUSTOM_SQL` | Execute a user-defined SQL assertion against the written data (Delta only — reads from the just-written Delta version) |

Check configuration is part of the sink node definition in the pipeline IR.

### 14.7 Streaming Write Modes

| Mode | Description |
|------|-------------|
| `APPEND` | Appends each micro-batch result to the sink (default for most streaming sinks) |
| `UPDATE` | Updates changed rows only (not supported by all sinks) |
| `COMPLETE` | Replaces the entire sink with the result of each micro-batch (aggregation results only) |

Checkpoint location is always required for streaming pipelines and is automatically set by ETL1 to a path derived from the pipeline ID and run ID.

---

## 15. Incremental Load and CDC Patterns

### 15.1 Watermark-Based Incremental Extraction

For RDBMS sources where full table scans are too expensive, the platform supports watermark-based incremental extraction — reading only rows modified since the last successful run.

#### 15.1.1 Configuration

| Field | Description |
|-------|-------------|
| `incr_watermark_column` | The column used to detect new/changed rows (e.g. `updated_at`, `created_at`, `row_version`) |
| `incr_watermark_type` | `TIMESTAMP` or `SEQUENCE_NUMBER` |
| `incr_lookback_window` | Overlap window to handle late-arriving updates (e.g. `1 HOUR`) |
| `incr_initial_value` | The watermark value for the first run (e.g. `1970-01-01T00:00:00Z`) |
| `incr_column_is_reliable` | Whether the watermark column is guaranteed to reflect all changes (if not, fall back to full scan when drift is detected) |

#### 15.1.2 Watermark State Management

The platform stores the last successful watermark value per dataset per pipeline in `execution.pipeline_run_watermarks`. At each run start:

1. The execution service reads the last watermark from the database.
2. The codegen layer injects the watermark value as a Spark conf key.
3. The generated PySpark script reads it and applies it as a WHERE predicate:

```python
last_wm = spark.conf.get("etl1.pipeline.<id>.lastWatermark")
df = spark.read.format("jdbc") \
  ...
  .option("dbtable", f"(SELECT * FROM {table} WHERE updated_at > TIMESTAMP '{last_wm}') AS t") \
  .load()
```

4. On successful completion, the execution service updates the watermark to the maximum value observed in the run.

---

### 15.2 Log-Based CDC (Change Data Capture)

For systems that support database transaction log reading, ETL1 integrates with **Debezium** as the CDC ingestion engine. Debezium publishes change events (INSERT / UPDATE / DELETE) to a Kafka topic, and ETL1 reads those events via its Kafka connector.

#### 15.2.1 Supported CDC Sources via Debezium

| Source | Debezium Connector | Change Log |
|--------|-------------------|------------|
| PostgreSQL | `debezium-connector-postgres` | Logical replication (WAL) |
| MySQL / MariaDB | `debezium-connector-mysql` | Binary log (binlog) |
| SQL Server | `debezium-connector-sqlserver` | CDC tables |
| Oracle (19c+) | `debezium-connector-oracle` | LogMiner |
| Db2 | `debezium-connector-db2` | ASN Capture |
| MongoDB | `debezium-connector-mongodb` | Oplog / Change Streams |

ETL1 does not manage or deploy Debezium itself — it is an external dependency. ETL1 connects to the Kafka topic that Debezium publishes to, using its standard Kafka connector (Section 9.1).

#### 15.2.2 CDC Event Schema

Debezium emits events in a standard envelope format. The ETL1 pipeline includes a built-in **CDC Flattener transformation node** that:

1. Reads raw Debezium envelope JSON from the Kafka source node.
2. Extracts the `before` and `after` document fields.
3. Emits a flat DataFrame with columns: all data columns + `_cdc_op` (`I`, `U`, `D`) + `_cdc_ts` + `_cdc_lsn`.

This flat DataFrame is then connected to standard transformation and sink nodes in the pipeline graph.

#### 15.2.3 CDC Sink Behaviour

The `UPSERT` and `DELETE_WHERE` write modes (Section 14.1) are the natural downstream sinks for CDC data:

- Rows with `_cdc_op = 'I'` or `_cdc_op = 'U'` → UPSERT to target
- Rows with `_cdc_op = 'D'` → `DELETE_WHERE` or soft-delete column update on target

---

### 15.3 Partition-Based Incremental Load

For data partitioned by date on object storage (S3, GCS, ADLS), incremental loading reads only the partitions added or modified since the last run.

The platform reads the partition list from the catalog (refreshed via metadata extraction) and compares it against the last recorded high-water partition value stored in `execution.pipeline_run_watermarks`. Only new partitions are included in the source scan.

---

### 15.4 Full Load with Deduplication

For systems where watermarks are unreliable (e.g. the source system may backfill data), full table loads are used but the sink node applies deduplication before writing:

```python
df = df.dropDuplicates(["<natural_key_columns>"])
```

This is configured on the sink node as `dedup_on_full_load = true` with the specified key columns.

---

## 16. Secure Data Preview via Apache Arrow

### 16.1 Overview

Data preview allows the user to see a sample of data (up to N rows, default 500) from any configured source or at any node in a pipeline. The preview must be:

- **Lightweight** — does not scan the full table; uses `LIMIT` / Parquet row group sampling / topic offset scan.
- **Fast** — uses Apache Arrow IPC columnar format for transport.
- **Secure** — the payload is encrypted before leaving the ETL1 Preview Service. The browser-side decryption key never reaches the server.

### 16.2 Preview Architecture

```
Browser (React UI)
│
│  1. Generate ephemeral key pair (ECDH P-256) in Web Crypto API
│  2. POST /api/preview/session { publicKey: <base64_pubkey> }
│     ↓
│  3. Server receives public key, generates its own ephemeral key pair
│  4. Computes shared secret: ECDH(server_private, client_public)
│  5. Derives AES-256-GCM key from shared secret (HKDF-SHA256)
│  6. Stores { sessionId → AES key } in memory (TTL 10 min, never persisted)
│     ↓
│  7. Response: { sessionId, serverPublicKey }
│     ↓
│  8. Browser computes same shared secret: ECDH(client_private, server_public)
│  9. Derives same AES-256-GCM key (HKDF-SHA256)
│     ↓
│ 10. POST /api/preview/data { sessionId, connectorId, query, limit }
│     ↓
│ 11. Preview Service fetches data via JDBC / file / API / SFTP
│ 12. Converts result to Apache Arrow IPC stream (in-memory)
│ 13. Encrypts Arrow bytes: AES-256-GCM(key, arrow_ipc_bytes) → { iv, ciphertext, tag }
│ 14. Response: { iv: <base64>, ciphertext: <base64>, tag: <base64> }
│     ↓
│ 15. Browser decrypts with its derived AES key using Web Crypto API
│ 16. Deserialises Arrow IPC bytes using apache-arrow npm package
│ 17. Renders tabular data in the UI
```

### 16.3 Arrow IPC Format

The preview service uses the **Arrow IPC Stream format**. Each record batch is self-describing. The browser begins rendering the first batch before the full response arrives (chunked transfer encoding).

### 16.4 Type Mapping — Source to Arrow

| Source Type | Arrow Type |
|-------------|-----------|
| `INTEGER`, `INT4`, `INT` | `Int32` |
| `BIGINT`, `INT8` | `Int64` |
| `SMALLINT`, `INT2` | `Int16` |
| `TINYINT` | `Int8` |
| `FLOAT`, `REAL` | `Float32` |
| `DOUBLE`, `FLOAT8` | `Float64` |
| `NUMERIC(p,s)`, `DECIMAL(p,s)` | `Decimal128(p,s)` |
| `VARCHAR(n)`, `TEXT`, `CHAR` | `Utf8` |
| `BOOLEAN`, `BOOL` | `Bool` |
| `DATE` | `Date32` |
| `TIME` | `Time64[microsecond]` |
| `TIMESTAMP` | `Timestamp[microsecond, UTC]` |
| `TIMESTAMPTZ` | `Timestamp[microsecond, UTC]` (with tz annotation) |
| `BYTEA`, `BINARY`, `VARBINARY` | `Binary` |
| `JSON`, `JSONB` | `Utf8` (serialised as JSON string) |
| `UUID` | `Utf8` |
| `ARRAY` | `List<element_type>` |
| `STRUCT`, `ROW` | `Struct` |
| MongoDB BSON ObjectId | `Utf8` |
| MongoDB BSON Document (nested) | `Utf8` (serialised as JSON string) |
| Kafka message key/value (raw bytes) | `Binary` |
| Kafka message key/value (JSON) | `Utf8` |
| Unknown / unsupported | `Utf8` (cast to string representation) |

### 16.5 Key Exchange and Encryption Specification

- **Key exchange:** ECDH P-256, ephemeral key pairs per session, shared secret never transmitted.
- **Key derivation:** HKDF-SHA256, salt = `ETL1-PREVIEW-SESSION`, info = session ID bytes, output = 256-bit AES key.
- **Encryption:** AES-256-GCM, 96-bit random IV per response, 128-bit authentication tag, AAD = session ID + request timestamp.

### 16.6 Preview Row Limit and Sampling by Source

| Source Type | Limiting Strategy |
|-------------|------------------|
| JDBC (SQL databases) | `SELECT ... LIMIT <n>` (dialect-specific) |
| Parquet on object storage | Read first row group only, trim to N |
| Delta / Iceberg / Hudi | Latest snapshot first data file, trim to N |
| CSV / TSV / Text on storage | First N lines after header |
| CSV / text on SFTP | Download first N KB; parse up to N rows |
| BigQuery | `SELECT ... LIMIT <n>` via Jobs REST API |
| Bigtable | `ReadRows` with `rows_limit = N` |
| Snowflake | `SELECT ... LIMIT <n>` via JDBC |
| Kafka | Read last N messages from latest offset of partition 0 |
| MongoDB | `.find().limit(N)` via Mongo driver |
| Cassandra | `SELECT ... LIMIT N` via CQL |
| DynamoDB | `Scan` with `Limit = N` via REST |
| Elasticsearch | `GET /<index>/_search?size=N` via REST |

Row limit N: default 500, max 5000, configurable per workspace.

### 16.7 PII and Sensitive Data Masking in Preview

| Masking Rule | Effect |
|-------------|--------|
| `MASK` | Replaces characters with `*` (last 4 digits shown for numeric strings) |
| `HASH` | SHA-256 of the value — consistent for a given run, not reversible |
| `NULLIFY` | Replaces value with Arrow null |
| `TRUNCATE(n)` | Shows only first n characters |
| `REDACT` | Replaces with literal string `[REDACTED]` |

Masking rules are configured at the dataset column level in the catalog and applied automatically to all preview requests.

### 16.8 Preview Service — Technology Stack

- **Language:** Java — runs as a sidecar to the Node.js backend
- **Arrow library:** Apache Arrow Java (`org.apache.arrow:arrow-vector`, `arrow-memory-netty`)
- **JDBC access:** Same JDBC driver JARs as Section 6
- **SFTP access:** JSch library
- **SMB access:** jcifs-ng library
- **File format parsing:** Apache Parquet Java, Avro Java, Jackson (JSON/CSV)
- **NoSQL access:** MongoDB Java driver, Cassandra Java driver (lightweight read-only) — isolated within Preview Service, not in codegen layer
- **BigQuery / Elasticsearch / DynamoDB preview:** Plain HTTPS REST calls — no SDK
- **Kafka preview:** Kafka Consumer Java client (lightweight, poll one batch only)
- **HTTP transport:** Chunked transfer encoding — Arrow record batches streamed as encrypted

---

## 17. Connection Testing and Health Monitoring

### 17.1 Connection Test — Steps Performed

| Step | Check |
|------|-------|
| 1 | **Network reachability** — TCP connect to host:port within timeout (default 10s) |
| 2 | **Authentication** — establish a session / acquire token / open connection |
| 3 | **Authorisation** — lightweight query to confirm at least read access |
| 4 | **SSL/TLS** — verify certificate chain if SSL mode requires it |

Each step result is displayed inline in the form.

### 17.2 Test Queries by Connector Type

| Connector | Test Query / Action |
|-----------|-----------|
| PostgreSQL, Redshift, Greenplum, Athena | `SELECT 1` |
| MySQL, MariaDB | `SELECT 1` |
| SQL Server, Synapse | `SELECT 1` |
| Oracle | `SELECT 1 FROM DUAL` |
| Db2 | `SELECT 1 FROM SYSIBM.SYSDUMMY1` |
| Teradata | `SELECT 1` |
| SAP HANA | `SELECT 1 FROM DUMMY` |
| Snowflake | `SELECT CURRENT_VERSION()` |
| BigQuery | Dry-run `SELECT 1` via Jobs REST API (0 bytes billed) |
| S3 / GCS / Azure Blob | `LIST <root_prefix>` (max 1 result) |
| Local FS | `stat <base_path>` — confirm directory exists and is readable |
| SFTP | `ls <base_path>` — list directory via SFTP session |
| FTP / FTPS | `LIST <base_path>` via FTP data channel |
| SMB | List share root — jcifs-ng `SmbFile.listFiles()` |
| Bigtable | List tables in instance — Admin REST API |
| Kafka | Fetch metadata for all topics — AdminClient `listTopics()` |
| Event Hubs | List Event Hubs in namespace — Event Hubs Management REST API |
| Kinesis | `ListStreams` — Kinesis REST API with SigV4 |
| Pub/Sub | `List subscriptions` — Pub/Sub REST API |
| MongoDB | `db.runCommand({ ping: 1 })` |
| Cassandra | `SELECT now() FROM system.local` |
| DynamoDB | `ListTables` — DynamoDB REST API |
| Cosmos DB | `GET /dbs` — Cosmos DB REST API |
| Elasticsearch | `GET /_cat/health` — REST endpoint |
| HBase | List tables — HBase Admin via SHC |
| Hive Metastore | `get_all_databases()` — Thrift call |
| Glue Catalog | `GetDatabases` — Glue REST API |
| Databricks | `SELECT 1` via JDBC |
| Unity Catalog | `SHOW CATALOGS` via JDBC |

### 17.3 Ongoing Health Monitoring

- Active connectors are tested on a configurable schedule (default: every 15 minutes for connectors used in scheduled pipelines).
- Health status stored in `catalog.connector_health` with timestamp, result, latency, and error code.
- Three consecutive failures → connector marked `DEGRADED`; all pipelines using it flagged in UI.
- Failures logged to `logs/connections.log` at `ERROR` level.

---

## 18. UI / UX Requirements for Connection Management

### 18.1 Connector Type Selection

- Connectors are grouped by category in the creation wizard:
  - **Databases** — RDBMS on-prem and cloud
  - **Data Warehouses** — Redshift, BigQuery, Snowflake, Synapse, Athena, etc.
  - **File Storage** — S3, GCS, ADLS, SFTP, FTP, Local FS, SMB, NFS, HDFS
  - **Streaming** — Kafka, Kinesis, Event Hubs, Pub/Sub, Pulsar
  - **NoSQL** — MongoDB, Cassandra, DynamoDB, Cosmos DB, Elasticsearch, HBase
  - **Catalogs** — Hive Metastore, Glue, Unity Catalog, Iceberg REST
- Each connector type displays a brief description, protocol badge, and "Requires network access" / "Local only" indicator.

### 18.2 Connection Configuration Form

- Dynamically rendered based on `connector_type_code`.
- Secret fields show `••••••••` placeholder for existing values — a "Replace" action clears and allows re-entry.
- Inline field validation:
  - Port: numeric, 1–65535
  - Bootstrap servers: `host:port` list format
  - Cron expression: validated and rendered as human-readable schedule
  - ARN format: regex-validated
  - JSON fields: parsed and schema-validated client-side
  - SFTP `known_hosts` entry: validated for correct format
  - Glob patterns: real-time preview of matched path pattern
- A "Test Connection" button runs the test inline and shows per-step results with latency.
- For SFTP: a "Browse Remote Files" panel opens post-test to select the base path.
- For Kafka: a "List Topics" panel opens post-test showing discovered topics and partition counts.

### 18.3 Metadata Browser

- Tree view: Database/Catalog → Schema → Table/Topic → Columns.
- Column type badges use Spark type names for consistency across all source types.
- "Preview" button available on each table/file/topic node — opens the secure preview panel.
- "Add to Catalog" button — one click to register the table as an ETL1 dataset.
- Streaming topics show: partition count, earliest/latest offset, retention period, message format.
- File sources show: detected format, compression, file count, total size, last modified.

### 18.4 Connection List View

- All connections: name, category icon, type label, last test result (✅ / ⚠️ / ❌), last tested timestamp, usage count.
- Filter by category, type, status, tag.
- Bulk actions: test selected, tag selected, delete selected (with dependency check).

---

## 19. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Connection test latency (p95) | < 5 seconds |
| Metadata extraction — single table describe | < 2 seconds |
| Metadata extraction — full schema scan (1000 tables) | < 60 seconds |
| SFTP directory listing (1000 files) | < 10 seconds |
| Preview data — first byte latency (p95) | < 3 seconds for JDBC sources with N=500 |
| Preview data — total payload size | < 5 MB for N=500 rows (Arrow IPC columnar) |
| Preview encryption overhead | < 50 ms (AES-256-GCM hardware-accelerated) |
| JDBC connection pool — max connections per connector | Configurable, default 5 |
| JDBC connection pool — idle timeout | 10 minutes |
| SFTP connection pool | Max 3 concurrent sessions per connector |
| Kafka consumer pool | 1 consumer per connector; re-used across preview requests |
| Concurrent preview sessions | 100 per backend instance |
| Preview session TTL | 10 minutes (extended on activity) |
| Credentials at rest | AES-256 via pgcrypto |
| Credentials in transit | TLS 1.2 minimum, TLS 1.3 preferred |
| Preview data in transit | AES-256-GCM (end-to-end, in addition to TLS) |
| FTP plaintext warning | UI must display a security warning before saving any FTP (non-FTPS) connection |
| Audit logging | All credential access, metadata extraction, preview data access logged with userId, timestamp, correlationId |
| JDBC driver CVE scanning | All bundled and user-uploaded JARs scanned before use |
| Custom driver JAR max size | 50 MB |

---

## 20. Connector Extensibility

The platform supports adding new connector types without modifying core platform code. A connector plugin implements:

```typescript
interface IConnectorPlugin {
  readonly typeCode:        string;
  readonly displayName:     string;
  readonly category:        ConnectorCategory;
  readonly configSchema:    JsonSchema;   // drives the UI form dynamically
  readonly secretsSchema:   JsonSchema;

  test(config: ConnectorConfig, secrets: ConnectorSecrets): Promise<TestResult>;
  listDatabases(config, secrets): Promise<string[]>;
  listSchemas(config, secrets, database: string): Promise<string[]>;
  listTables(config, secrets, database: string, schema: string): Promise<TableSummary[]>;
  describeTable(config, secrets, tableRef: TableRef): Promise<TableDetail>;
  previewData(config, secrets, tableRef: TableRef, limit: number): Promise<ArrowIpcBuffer>;
  generateSparkReadConfig(config, secrets, tableRef: TableRef): SparkConnectorConfig;
  generateSparkWriteConfig(config, secrets, tableRef: TableRef): SparkConnectorConfig;
  generateSparkStreamReadConfig?(config, secrets, topicRef: TopicRef): SparkStreamConfig;
  generateSparkStreamWriteConfig?(config, secrets, topicRef: TopicRef): SparkStreamConfig;
  requiredJars(): string[];
  isStreamingCapable(): boolean;
  isBatchCapable(): boolean;
  supportsWrite(): boolean;
}
```

New plugins are registered in the `ConnectorRegistry` at startup. The UI form is rendered from `configSchema` — no frontend code change required for a new connector type.

---

## 21. Open Questions and Decisions Required

| # | Question | Impact |
|---|----------|--------|
| 1 | Should the Preview Service be a sidecar Java process or embedded in Node.js via WASM-compiled Arrow? | Architecture — Java sidecar is more capable but adds operational complexity |
| 2 | For IAM-based auth (AWS, Azure MI, GCP WI), should ETL1 support zero-credential connectors that inherit cluster identity? | Simplifies Ops but ties ETL1 deployment to the same cloud |
| 3 | Should SSH tunnel support be provided for cloud data warehouses (Redshift, Synapse) or only on-prem JDBC? | Scope and testing |
| 4 | What is the JAR version policy for bundled connectors — single version per major Spark version or a matrix? | JAR storage and compatibility matrix complexity |
| 5 | Should preview masking rules be enforceable by admins at the platform level, or only advisory? | Compliance posture |
| 6 | Should column-level lineage extraction from view definitions be in scope? | Significant additional metadata depth |
| 7 | Bigtable preview — auto-discover column qualifiers by sampling a row, or require manual schema definition? | UX vs. scan cost |
| 8 | For FTP (plaintext), should the platform require an admin-level override to even create an FTP connector, rather than just a warning? | Security posture |
| 9 | Should the platform manage Debezium deployment and configuration, or treat it as an external dependency that Ops manages independently? | Significant scope increase if owned by ETL1 |
| 10 | Should SCD Type 2 be a built-in sink strategy or a composable transformation in the pipeline graph? | UX simplicity vs. flexibility |
| 11 | For SFTP file delivery patterns, should the platform support a "landing zone watcher" (file-arrival trigger) as a pipeline trigger mechanism? | Requires a separate file watcher service |
| 12 | Should Redis write support be added (as a cache-warming sink) or remain read-only reference data? | Scope decision |
| 13 | Should Microsoft Fabric / OneLake be a first-class connector category or covered entirely by the existing ADLS Gen2 + SQL connector combination? | UI clarity vs. maintenance |
