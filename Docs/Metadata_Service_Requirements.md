# Metadata Service — Enterprise ETL Platform
## Detailed Requirements Document v1.0

---

## Table of Contents

1. [Overview & Scope](#1-overview--scope)
2. [Metadata Hierarchy & Navigation](#2-metadata-hierarchy--navigation)
3. [Supported Technologies & Connectors](#3-supported-technologies--connectors)
4. [Metadata Ingestion & Synchronization](#4-metadata-ingestion--synchronization)
5. [Lazy Loading Architecture](#5-lazy-loading-architecture)
6. [Schema & Table Import Wizard](#6-schema--table-import-wizard)
7. [Data Preview Engine](#7-data-preview-engine)
8. [File Format Parsing & Import](#8-file-format-parsing--import)
9. [Hierarchy Tree UI](#9-hierarchy-tree-ui)
10. [CRUD Operations on Metadata](#10-crud-operations-on-metadata)
11. [Column-Level Metadata](#11-column-level-metadata)
12. [Metadata Enrichment & Annotations](#12-metadata-enrichment--annotations)
13. [Metadata Search & Discovery](#13-metadata-search--discovery)
14. [Data Profiling](#14-data-profiling)
15. [Schema Evolution & Change Detection](#15-schema-evolution--change-detection)
16. [Data Lineage Integration](#16-data-lineage-integration)
17. [Access Control & Visibility](#17-access-control--visibility)
18. [Data Model](#18-data-model)
19. [API Contracts](#19-api-contracts)
20. [Non-Functional Requirements](#20-non-functional-requirements)
21. [Acceptance Criteria Summary](#21-acceptance-criteria-summary)

---

## 1. Overview & Scope

### 1.1 Purpose
The Metadata Service is the central catalog and intelligence layer of the ETL platform. It discovers, imports, stores, enriches, and serves structural and statistical metadata for every connected data source — databases, data lakes, object stores, streaming systems, and file-based sources — enabling developers to browse, preview, import, and build pipelines with full schema awareness, without ever pulling unnecessary data volumes.

### 1.2 Core Design Principles
- **Lazy by default**: Nothing is loaded until the user or system explicitly requests it. No eager pre-loading of large catalogs.
- **Push-down preview**: Data preview queries are pushed down to the source system. Only N rows travel over the wire.
- **Cost-aware sampling**: Every preview strategy is designed to minimize compute and I/O at the source.
- **Source-agnostic hierarchy**: Every technology, regardless of its native structure, is normalized into the platform hierarchy.
- **Immutable catalog history**: Schema changes are versioned; prior snapshots are never deleted.
- **Developer-first**: Column statistics, data profiles, sample data, and schema diffs are first-class developer tools.
- **Enterprise-grade governance**: Tagging, classification, lineage, PII detection, and audit trails built in.

### 1.3 Actors
| Actor | Usage |
|---|---|
| ETL Developer | Browse schemas, select tables, preview data, build pipelines |
| Data Architect | Define canonical schemas, enforce naming standards, manage classifications |
| Data Steward | Annotate metadata, apply PII tags, manage business glossary mappings |
| Operations | Monitor sync jobs, review schema drift, manage connection health |
| Admin | RBAC, retention policies, sync schedules, bulk operations |

---

## 2. Metadata Hierarchy & Navigation

### 2.1 Universal Hierarchy Model

Every connected technology is normalized into the following 7-level hierarchy regardless of native terminology:

```
Technology Group
  └── Technology
        └── Connection
              └── Database / Catalog / Bucket / Namespace
                    └── Schema / Directory / Topic / Index
                          └── Table / File / Stream / Collection / Index
                                └── Column / Field / Attribute / Key
```

### 2.2 Technology-Specific Hierarchy Mapping

| Technology | L1: Group | L2: Technology | L3: Connection | L4: Database | L5: Schema | L6: Table | L7: Column |
|---|---|---|---|---|---|---|---|
| PostgreSQL | Relational DB | PostgreSQL | Connection Name | Database | Schema | Table / View | Column |
| MySQL | Relational DB | MySQL | Connection Name | Database | (virtual) | Table / View | Column |
| Oracle | Relational DB | Oracle | Connection Name | Database | Schema | Table / View | Column |
| SQL Server | Relational DB | SQL Server | Connection Name | Database | Schema | Table / View | Column |
| Snowflake | Cloud DW | Snowflake | Connection Name | Database | Schema | Table / View / Stage | Column |
| BigQuery | Cloud DW | BigQuery | Connection Name | Project | Dataset | Table / View | Field |
| Redshift | Cloud DW | Redshift | Connection Name | Database | Schema | Table / View | Column |
| Databricks | Lakehouse | Databricks | Connection Name | Catalog | Schema | Table / View | Column |
| Delta Lake | Lakehouse | Delta Lake | Connection Name | Catalog | Database | Table | Column |
| Hive | Hadoop | Hive | Connection Name | (virtual) | Database | Table | Column |
| S3 | Object Store | Amazon S3 | Connection Name | Bucket | Prefix/Path | File/Folder | - |
| Azure Blob | Object Store | Azure Blob | Connection Name | Container | Virtual Dir | File | - |
| GCS | Object Store | Google Cloud Storage | Connection Name | Bucket | Prefix | File | - |
| HDFS | File System | HDFS | Connection Name | Root | Directory | File | - |
| Kafka | Streaming | Apache Kafka | Connection Name | Cluster | Topic Group | Topic | Field (Schema Registry) |
| Kinesis | Streaming | AWS Kinesis | Connection Name | Region | (virtual) | Stream | Field |
| Pub/Sub | Streaming | Google Pub/Sub | Connection Name | Project | (virtual) | Topic | Field |
| Elasticsearch | Search | Elasticsearch | Connection Name | Cluster | (virtual) | Index | Field |
| MongoDB | NoSQL | MongoDB | Connection Name | Cluster | Database | Collection | Field |
| Cassandra | NoSQL | Cassandra | Connection Name | Cluster | Keyspace | Table | Column |
| DynamoDB | NoSQL | DynamoDB | Connection Name | Region | (virtual) | Table | Attribute |
| Redis | Cache | Redis | Connection Name | Instance | DB Number | Key Pattern | - |
| REST API | API | REST | Connection Name | Base URL | Resource Group | Endpoint | Response Field |
| GraphQL | API | GraphQL | Connection Name | Endpoint | (virtual) | Type | Field |
| SFTP | File Transfer | SFTP | Connection Name | Host | Directory | File | - |
| Local FS | File System | Local | Connection Name | Root | Directory | File | - |
| FTP | File Transfer | FTP | Connection Name | Host | Directory | File | - |

### 2.3 Hierarchy Display Rules
- Levels that don't exist for a technology are transparently skipped in the UI (not shown as empty nodes)
- Technology groups are predefined and cannot be user-deleted; only expanded
- Virtual levels (marked above) are synthesized by the platform when the source has no native equivalent
- Each level shows: icon (technology-specific), name, item count badge (lazy-loaded), status indicator
- Collapsed by default; expand on click (lazy loads children)

---

## 3. Supported Technologies & Connectors

### 3.1 Relational Databases
| Technology | Metadata Supported |
|---|---|
| PostgreSQL 10+ | Databases, Schemas, Tables, Views, Columns, Constraints, Indexes, Sequences, Partitions, Materialized Views, Functions, Stored Procedures |
| MySQL 5.7+ / MariaDB | Databases, Tables, Views, Columns, Indexes, Triggers, Stored Procedures |
| Oracle 12c+ | Databases, Schemas, Tables, Views, Columns, Indexes, Partitions, Sequences, Synonyms, Packages, Procedures |
| SQL Server 2016+ | Databases, Schemas, Tables, Views, Columns, Indexes, Stored Procedures, Functions, Synonyms |
| DB2 | Schemas, Tables, Views, Columns |
| Teradata | Databases, Tables, Views, Columns, Macros |
| Sybase / SAP ASE | Databases, Tables, Views, Columns |
| CockroachDB | Databases, Schemas, Tables, Columns |
| TiDB | Databases, Tables, Columns |
| YugabyteDB | Databases, Schemas, Tables, Columns |

### 3.2 Cloud Data Warehouses
| Technology | Metadata Supported |
|---|---|
| Snowflake | Databases, Schemas, Tables, Views, Stages, Pipes, Tasks, Streams, Columns, Clustering Keys |
| Google BigQuery | Projects, Datasets, Tables, Views, External Tables, Partitioned Tables, Columns, Clustering Fields |
| Amazon Redshift | Databases, Schemas, Tables, Views, Columns, Sort Keys, Dist Keys, Late-Binding Views |
| Azure Synapse | Databases, Schemas, Tables, Views, External Tables, Columns |
| Databricks SQL | Catalogs, Schemas, Tables, Views, Delta Tables, Columns |

### 3.3 Lakehouses & Hadoop
| Technology | Metadata Supported |
|---|---|
| Delta Lake | Catalogs, Databases, Tables, Columns, Table History, Partitions |
| Apache Iceberg | Catalogs, Namespaces, Tables, Columns, Snapshots, Partitions |
| Apache Hudi | Databases, Tables, Columns, Timeline |
| Apache Hive | Databases, Tables, Views, Columns, Partitions, Bucketing Info |
| Apache HBase | Namespaces, Tables, Column Families |
| Presto / Trino | Catalogs, Schemas, Tables, Columns |
| Apache Drill | Storage Plugins, Workspaces, Files |

### 3.4 Object Stores & File Systems
| Technology | Metadata Supported |
|---|---|
| Amazon S3 | Buckets, Prefixes, Files (name, size, last modified, content type, storage class, tags) |
| Azure Blob Storage | Containers, Virtual Directories, Blobs (name, size, tier, metadata) |
| Google Cloud Storage | Buckets, Prefixes, Objects (name, size, content type, metadata) |
| HDFS | Directories, Files (name, size, replication, block size, permissions, owner) |
| ADLS Gen2 | Filesystems, Directories, Files |
| MinIO | Buckets, Prefixes, Files |
| SFTP / FTP | Directories, Files (name, size, modified date, permissions) |
| Local Filesystem | Directories, Files |

### 3.5 NoSQL & Search
| Technology | Metadata Supported |
|---|---|
| MongoDB | Databases, Collections (with sample-based inferred schema), Indexes |
| Cassandra | Keyspaces, Tables, Columns, Indexes, Materialized Views |
| DynamoDB | Tables, Global Secondary Indexes, Local Secondary Indexes, Attributes (sample-inferred) |
| Elasticsearch / OpenSearch | Indices, Index Mappings (fields, types), Aliases, Templates |
| Redis | Databases, Key Patterns (sampled), TTL info |
| Couchbase | Buckets, Scopes, Collections, Indexes |
| Neo4j | Databases, Node Labels, Relationship Types, Properties |
| HBase | Namespaces, Tables, Column Families, Qualifiers (sampled) |
| Apache Solr | Collections, Schema Fields |
| ClickHouse | Databases, Tables, Columns, Engines, Partitions |

### 3.6 Streaming Platforms
| Technology | Metadata Supported |
|---|---|
| Apache Kafka | Clusters, Topics, Partitions, Consumer Groups, Schema (from Schema Registry if connected) |
| AWS Kinesis | Regions, Streams, Shards, Schema (sample-inferred) |
| Google Pub/Sub | Projects, Topics, Subscriptions, Schema (if defined) |
| Azure Event Hubs | Namespaces, Event Hubs, Consumer Groups |
| Apache Pulsar | Tenants, Namespaces, Topics, Schema |
| Amazon MSK | Clusters, Topics (same as Kafka) |
| Confluent Cloud | Environments, Clusters, Topics, Schema Registry Schemas |
| RabbitMQ | Virtual Hosts, Exchanges, Queues |

### 3.7 APIs & Integration
| Technology | Metadata Supported |
|---|---|
| REST API | Base URL, Resources, Endpoints, HTTP Methods, Request/Response Schema (OpenAPI spec import) |
| GraphQL | Endpoint, Schema Types, Queries, Mutations, Subscriptions |
| SOAP / WSDL | Service Endpoint, Operations, Message Types |
| OData | Service Root, Entity Sets, Entity Types, Properties |
| Salesforce | Objects (standard + custom), Fields, Relationships |
| SAP | RFCs, BAPIs, IDocs, Tables |
| HubSpot / Marketo | Objects, Properties |
| Workday | Resources, Fields |

---

## 4. Metadata Ingestion & Synchronization

### 4.1 Ingestion Modes

#### 4.1.1 On-Demand (User-Initiated)
- User clicks "Sync Metadata" on any node in the hierarchy tree
- Syncs only that node and its direct children (not entire subtree unless explicitly requested)
- Progress indicator shown inline; tree node has loading spinner
- Results appear incrementally (streaming, not batch)

#### 4.1.2 Scheduled Sync
- Per-connection configurable sync schedule: Hourly / Daily / Weekly / Custom Cron
- Sync scope: Full / Incremental (only changed objects since last sync)
- Sync runs as background job; does not block UI
- Sync history visible in Connection Settings → Sync History
- Alert on sync failure

#### 4.1.3 Event-Driven Sync (Where Supported)
- Snowflake: Snowflake Data Sharing change events
- Kafka: Schema Registry webhook on schema change
- BigQuery: Pub/Sub notifications on dataset changes
- Delta Lake: Transaction log monitoring for schema changes
- PostgreSQL: LISTEN/NOTIFY or logical replication slot for DDL changes (optional)

#### 4.1.4 Import-Time Sync
- When user opens the Import Wizard for a connection, metadata is fetched live
- Not stored until user confirms selection and clicks "Import"
- Fetch is scoped to selected schema/path only

### 4.2 Incremental Sync Strategy
- Each metadata object has `last_synced_at` and `source_checksum` (hash of DDL/schema JSON)
- On sync: fetch object list from source, compare checksums
- Only changed/new objects are re-fetched in detail
- Deleted objects marked `is_deleted = true` with `deleted_at` timestamp (never hard-deleted)
- Schema evolution events generated for any detected change

### 4.3 Sync Job Management
- Sync job queue with priority: ON_DEMAND > EVENT > SCHEDULED
- Concurrent sync jobs per connection: configurable (default: 2)
- Global max concurrent sync jobs: configurable (default: 10)
- Sync job detail: start time, end time, objects discovered, objects changed, objects deleted, errors
- Sync log per job: line-by-line progress
- Manual cancel of in-progress sync

### 4.4 Connection Health & Reachability
- Pre-sync connectivity test: TCP ping → auth test → metadata fetch test
- Health status per connection: HEALTHY / DEGRADED / UNREACHABLE / AUTH_FAILED / RATE_LIMITED
- Last successful sync timestamp
- Consecutive failure count (alert after N failures)
- Health indicator icon in hierarchy tree at Connection node

---

## 5. Lazy Loading Architecture

### 5.1 Loading Strategy Per Hierarchy Level

| Level | Load Trigger | Load Scope | Cached? |
|---|---|---|---|
| Technology Groups | App init | All groups (static config) | Yes (static) |
| Technologies | App init | All technologies (static config) | Yes (static) |
| Connections | On group/tech expand | All connections for that technology | Yes (TTL: 5 min) |
| Databases / Catalogs | On connection expand | All databases for that connection | Yes (TTL: 5 min) |
| Schemas | On database expand | All schemas in that database | Yes (TTL: 5 min) |
| Tables | On schema expand | Tables in that schema (paginated, 100/page) | Yes (TTL: 2 min) |
| Columns | On table expand OR hover | Columns for that table only | Yes (TTL: 10 min) |
| Statistics | Explicit user action | Triggered by "Load Profile" click | Yes (TTL: 1 hr) |
| Data Preview | Explicit user action | Only N rows | Not cached (fresh each time) |

### 5.2 Pagination in the Tree
- Tables at Schema level: loaded in pages of 100 (default); "Load More" button at bottom
- Search within a schema: server-side filter, returns matching tables only
- Total count badge shown immediately (from cached count, refreshed on sync)
- Virtual scroll: only DOM nodes for visible tree items are rendered (windowed rendering)
- Tree nodes are virtualized using react-virtual or equivalent library

### 5.3 Caching Layer
- **L1: In-memory (client)**: React Query / SWR cache; TTL per level as above
- **L2: Platform metadata DB (PostgreSQL)**: Persisted metadata catalog; source of truth
- **L3: Source system**: Only hit during explicit sync or data preview
- Cache invalidation: on sync completion, affected tree nodes are invalidated
- Stale-while-revalidate: show stale data immediately, fetch fresh in background, update silently

### 5.4 Loading State UI Rules
- **Skeleton loaders** replace content during initial load (not spinners in middle of content area)
- **Inline spinner** on tree node expand while children load
- **Count badge** shows `...` during load, real count after
- **Progressive disclosure**: first 20 columns visible immediately, rest on scroll
- **Abort on collapse**: if user collapses a node before its children finish loading, in-flight request is cancelled
- **Error state inline**: if a level fails to load, show error icon + retry link inline in tree

### 5.5 Prefetch Hints
- When user hovers over a collapsed tree node for > 500ms, prefetch its children in background
- When user opens Import Wizard, prefetch schema list for the selected connection
- When user selects a table in pipeline canvas, prefetch its column list in background

---

## 6. Schema & Table Import Wizard

### 6.1 Wizard Overview
Multi-step modal/drawer for importing metadata from a connection into the ETL platform catalog.

**Steps:**
1. Select Connection
2. Select Database / Catalog (if applicable)
3. Select Schemas
4. Select Tables / Files / Topics
5. Configure Import Options
6. Review & Confirm
7. Import Progress

### 6.2 Step 1: Select Connection
- Searchable list of available connections grouped by technology
- Shows connection health indicator, last sync time, total object count
- "Test Connection" button before proceeding
- Option to create new connection (redirects to connection setup)

### 6.3 Step 2: Select Database / Catalog
- List of available databases/catalogs for the connection (lazy-loaded from source live)
- Search field
- Single select (most connectors) or multi-select (Snowflake, BigQuery support multiple DBs)
- Shows: database name, owner (if available), size (if available), table count (if available)

### 6.4 Step 3: Select Schemas
- All schemas user has access to, fetched live from source
- Shows: schema name, owner, table count, last modified (where available)
- Multi-select with "Select All" / "Select None" / "Invert"
- Filter by: schema name (search), owner, last modified date
- Schemas already imported shown with "Already Imported" badge (re-import allowed)
- Schema-level permissions: schemas user lacks SELECT permission on are grayed out with tooltip
- "Preview Schema" button: quick-view of table list without selecting

### 6.5 Step 4: Select Tables / Files / Topics

#### 6.5.1 Table Selection (Relational / DW)
- Two-panel layout: selected schemas on left, table list on right
- Table list columns: Name | Type (TABLE/VIEW/MATERIALIZED VIEW/EXTERNAL) | Row Count (approx) | Size | Last Modified | Already Imported
- Multi-select with checkboxes
- "Select All in Schema" / "Deselect All in Schema"
- Filter: name search, type, already imported toggle, min/max row count
- Sort: name, row count, size, last modified
- Quick preview icon per row → shows first 5 columns with types inline (tooltip)
- "Preview Table" button: opens data preview panel (see Section 7) before committing
- Pattern-based select: "Select all tables matching pattern" (regex or glob)
- Dependency-aware select: "Select related tables" (follows FK references)
- Estimated import size indicator: total column count for selected tables

#### 6.5.2 File Selection (Object Store / File System)
- Directory browser with breadcrumbs
- File list: Name | Format (auto-detected) | Size | Last Modified | Detected Schema
- Format detection: extension + content sniff (first 512 bytes) for CSV/JSON/Parquet/ORC/Avro/XML
- Multi-select files or entire directory
- "Detect Schema" button: parses file header / schema block to show columns before importing
- Partition detection: auto-detects Hive-style partitioned directories (year=2024/month=01/...)

#### 6.5.3 Topic Selection (Kafka / Streaming)
- Topic list with: name, partition count, message count, retention, schema (if Schema Registry connected)
- "Sample Messages" button: fetches last 5 messages and displays them
- Schema inference: if no Schema Registry, infer schema from sampled messages

### 6.6 Step 5: Configure Import Options
| Option | Type | Default | Description |
|---|---|---|---|
| Sync Schedule | Select | None (manual) | Ongoing sync schedule for imported objects |
| Auto-detect schema changes | Toggle | ON | Alert and update when source schema changes |
| Import column statistics | Toggle | OFF | Run profile on import (expensive; off by default) |
| Import row count | Toggle | ON | Fetch approximate row count from source |
| Apply business tags | Tag picker | — | Apply tags to all imported objects |
| Apply classification | Multi-select | — | PII / SENSITIVE / PUBLIC / INTERNAL |
| Override existing metadata | Toggle | OFF | If already imported, overwrite with fresh data |
| Import dependent objects | Toggle | OFF | Also import FK-referenced tables |
| Comment/Description | Text | — | Bulk description for all imported objects |

### 6.7 Step 6: Review & Confirm
- Summary: N schemas, N tables, N columns total to be imported
- Breakdown table: Schema | Table Count | Column Count | Estimated Sync Time
- Conflict list: tables already imported that will be overwritten (if override=ON)
- "Back" to modify selections
- "Start Import" button

### 6.8 Step 7: Import Progress
- Real-time progress bar: overall + per-schema
- Live log stream: schema-by-schema, table-by-table status
- Errors shown inline with "Skip & Continue" or "Retry" per item
- On completion: summary (imported / skipped / failed) with "View in Catalog" button
- Import is cancellable mid-flight (cancels at next table boundary, already-imported tables kept)

---

## 7. Data Preview Engine

### 7.1 Principles
- **Server-side query execution**: preview query runs at source; only result rows sent to platform
- **Row limit enforced at query level** (SQL `LIMIT`, Spark `take(N)`, file `head(N)`)
- **No full table scan**: sampling strategies avoid full table reads where possible
- **Cost warnings**: for large tables/files, show estimated bytes scanned before executing
- **Credential passthrough**: uses connection credentials, not user's personal credentials
- **Audit logged**: every preview action is logged

### 7.2 Sampling Strategies

| Strategy | Description | SQL Implementation | Supported For |
|---|---|---|---|
| **Top N** | First N rows in natural/storage order | `SELECT * FROM t LIMIT N` | All RDBMS, DW, Files |
| **Bottom N** | Last N rows | `SELECT * FROM t ORDER BY rowid DESC LIMIT N` | RDBMS |
| **Random N** | Statistically random sample | `SELECT * FROM t TABLESAMPLE SYSTEM(x%)` or `ORDER BY RANDOM() LIMIT N` | PostgreSQL, Snowflake, BigQuery, SQL Server |
| **Every Kth Row** | Alternating / stride sample | `SELECT * FROM (SELECT *, ROW_NUMBER() OVER() AS rn FROM t) WHERE MOD(rn, K) = 0 LIMIT N` | All RDBMS |
| **Head + Tail N** | First N and last N rows combined | Two queries unioned | RDBMS |
| **Time-Range Sample** | N rows within a time window | `WHERE ts_col BETWEEN :start AND :end LIMIT N` | Any table with timestamp column |
| **Column-Value Filter Sample** | N rows matching a condition | `WHERE col = :val LIMIT N` | All |
| **Distinct Sample** | N distinct values for a column | `SELECT DISTINCT col FROM t LIMIT N` | All |
| **Stratified Sample** | N rows per distinct value of a grouping column | Window function based | RDBMS / DW |
| **Latest Partition** | N rows from most recent partition | Auto-detects partition column and max value | Partitioned tables (Hive, BigQuery, Snowflake) |
| **Specific Partition** | N rows from user-selected partition | User picks partition value | Partitioned tables |
| **Reservoir Sample** | Probabilistically uniform without full scan | `TABLESAMPLE BERNOULLI(x)` | PostgreSQL, Snowflake, BigQuery |
| **File Head** | First N records of a file | Read first N lines / first N bytes | CSV, TSV, JSON Lines, Parquet page |
| **File Random** | Random seek into file | Byte offset random for text files; row group sampling for Parquet | CSV (approx), Parquet, ORC |
| **Kafka Latest N** | Last N messages from topic | `seek to end - N` | Kafka, Kinesis |
| **Kafka Offset Range** | Messages from offset A to offset B | Explicit offset range | Kafka |
| **Time-Window Stream** | Messages within time window | Timestamp-based consumer | Kafka, Kinesis, Pub/Sub |

### 7.3 Preview Configuration UI
Per preview session, user can configure:
- **Strategy selector**: dropdown of applicable strategies for the source type
- **N (row count)**: slider + number input; default 25; max configurable per tech (default max: 1000)
- **Columns to show**: column multi-picker (default: all; allows selecting subset)
- **Filter clause**: optional WHERE condition (SQL for RDBMS; JSON filter for MongoDB; etc.)
- **Partition selector**: shown only for partitioned sources; dropdown of available partitions
- **Stride K**: shown for "Every Kth Row" strategy
- **Time range**: shown for time-range strategies; date-range picker with timezone
- **Estimated cost indicator**: for DW connectors (BigQuery, Snowflake, Redshift), estimate bytes scanned before execution

### 7.4 Preview Result Grid
- Renders in a panel within the hierarchy tree (inline) or in a full-screen modal
- Column headers: name + inferred type icon + nullable indicator + PK/FK badge
- Data cells:
  - NULL values displayed as `NULL` in gray italics
  - Empty string vs NULL clearly distinguished
  - Long strings truncated with "..." + expand on click
  - Binary/Blob: shown as `[BINARY N bytes]` with download icon
  - JSON/XML/Array cells: collapsed with expand toggle (pretty-printed in overlay)
  - Date/Timestamp: shown in source format + local timezone tooltip
  - Numbers: right-aligned with thousand separators
- Column resizing (drag handles)
- Column sorting (click header — client-side sort within the preview result set only)
- Column pinning (right-click → Pin Left / Pin Right)
- Row count label: "Showing 25 of ~4.2M rows"
- Copy cell / copy row / copy all as CSV/JSON
- Export preview as CSV / JSON / Excel
- Refresh button (re-executes same preview query)
- "Open in Full Preview" → full-screen modal with larger grid

### 7.5 Column Statistics Panel (Preview Companion)
Shown alongside data preview (toggle panel):
| Statistic | Types |
|---|---|
| Null count & % | All |
| Distinct count (approx) | All |
| Min value | Numeric, Date, String |
| Max value | Numeric, Date, String |
| Mean | Numeric |
| Median (approx) | Numeric |
| Std deviation | Numeric |
| Top 10 most frequent values | All |
| Value length distribution | String |
| Data type confidence | All (for inferred types) |

- Stats computed from same N-row preview sample (no additional source query)
- "Run Full Profile" button → triggers full data profiling job (see Section 14)

### 7.6 Preview for Non-Tabular Sources

#### 7.6.1 Object Store / File System
- File content preview (first N records after parsing)
- Raw bytes preview option (hex dump for binary files)
- Auto-detected format shown in header
- Encoding detection: UTF-8 / UTF-16 / Latin-1 with indicator

#### 7.6.2 Kafka / Streaming
- Last N messages displayed in timeline view
- Message: offset, partition, timestamp, key, value
- Value rendered based on format: JSON (pretty-printed), Avro (decoded), binary (hex)
- Schema overlay: if Schema Registry connected, show decoded field names

#### 7.6.3 REST API
- Sample response from selected endpoint (GET only; no mutating calls)
- Raw JSON response + parsed field tree
- Inferred schema overlay on the right

#### 7.6.4 MongoDB / Document Stores
- Sample documents in JSON tree view
- Schema inference overlay: aggregated field list with type distribution across sampled documents

---

## 8. File Format Parsing & Import

### 8.1 Supported File Formats

| Format | Extension(s) | Schema Inference | Data Preview | Parse Options |
|---|---|---|---|---|
| CSV | `.csv` | Header row analysis | ✓ | Delimiter, Quote char, Escape char, Encoding, Has header, Skip rows, Null string |
| TSV | `.tsv`, `.tab` | Header row analysis | ✓ | Same as CSV with tab delimiter |
| Delimited (generic) | `.txt`, `.dat`, `.pipe` | Header row analysis | ✓ | Custom delimiter, all CSV options |
| JSON (array) | `.json` | Structural inference | ✓ | Root path expression, array path |
| JSON Lines (NDJSON) | `.jsonl`, `.ndjson` | Sample-based inference | ✓ | Schema merge policy (union/intersect/strict) |
| Parquet | `.parquet`, `.pq` | Native schema (exact) | ✓ | Row group selector, column projection |
| ORC | `.orc` | Native schema (exact) | ✓ | Stripe selector |
| Avro | `.avro` | Native schema (exact) | ✓ | Schema extraction from header |
| XML | `.xml` | XSD-based or sample-inferred | ✓ | Root element, row element, namespace handling, XPath for nested arrays |
| Excel | `.xlsx`, `.xls` | Header row analysis | ✓ | Sheet selector, header row number, data start row |
| Fixed-Width | `.txt`, `.fwf` | User-defined column positions | ✓ | Column position map (name, start, end, type) |
| Compressed | `.gz`, `.bz2`, `.zst`, `.lz4`, `.snappy` | Inferred from inner format | ✓ | Auto-decompress; format of inner file |
| Delta Table | `_delta_log` directory | Native schema | ✓ | Version selector |
| Iceberg Table | `metadata.json` | Native schema | ✓ | Snapshot selector |
| Parquet in S3 / HDFS partitioned | Hive-style directory | Merged schema across partitions | ✓ | Partition column discovery |

### 8.2 Schema Inference Engine

#### 8.2.1 CSV / Delimited Inference
- Read configurable sample size (default: first 1000 rows)
- Auto-detect: delimiter, quote character, escape character, encoding
- Type inference per column: NULL / Boolean / Integer / Long / Float / Double / Decimal / Date / Timestamp / String
- Nullability inference: % null threshold configurable
- Conflict resolution: if type varies across sampled rows, promote to wider type or STRING
- Confidence score per inferred type: HIGH / MEDIUM / LOW
- User override: column type editable in schema review step

#### 8.2.2 JSON Inference
- Structural walk of sampled documents
- Nested objects → struct fields
- Arrays → ARRAY<T> with element type inference
- Mixed-type fields → UNION type or STRING (configurable)
- Null handling: nullable if absent in any sampled document
- Deeply nested JSON flattened (optional) with dot-notation column names

#### 8.2.3 XML Inference
- XSD import (if available): exact schema
- Sample-based: parse first N elements at configured row element XPath
- Attributes mapped to columns with `@` prefix
- Nested elements: struct or flattened
- Repeating elements: ARRAY type
- Mixed content (text + elements): TEXT + children as separate columns

#### 8.2.4 Schema Conflict Resolution (Partitioned Files)
- When multiple files/partitions have different schemas:
  - UNION: include all columns; absent columns are NULL
  - INTERSECT: only columns present in all partitions
  - STRICT: reject if schemas differ
  - LATEST: use schema from most recent file
- User selects policy in import wizard

### 8.3 File Import Configuration Panel
Per file format, a dedicated configuration panel is shown in the Import Wizard:

**CSV/TSV Panel:**
- Delimiter: preset (comma/tab/pipe/semicolon) + custom character input
- Quote character: `"` / `'` / custom
- Escape character: `\` / custom
- Encoding: UTF-8 / UTF-16 / UTF-16BE / Latin-1 / auto-detect
- Header row: Yes/No + row number if yes
- Skip top N rows: number input
- Skip bottom N rows: number input
- Null/empty string representation: configurable strings
- Date format: configurable (ISO 8601 / custom strftime)
- Timestamp format: configurable + timezone
- Decimal separator: `.` / `,`
- Thousand separator: `,` / `.` / none
- Comment character: `#` / custom (rows starting with this character are skipped)
- Multi-line: toggle for values containing newlines

**JSON Panel:**
- Root element path (JSONPath): default `$` (root is array) or `$.data` etc.
- Schema inference sample size: number input
- Flatten nested: toggle + max depth
- Array handling: ARRAY type / flatten with index suffix / first element only

**XML Panel:**
- Row element XPath
- Column elements: auto-detect or explicit XPath map
- Namespace handling: ignore / map / include as prefix
- XSD upload option

**Parquet / ORC / Avro Panel:**
- Schema preview (read-only, from file header)
- Column projection: select subset of columns
- Row group/stripe range: for partial reads
- Partition filter: for partitioned datasets

**Excel Panel:**
- Sheet selector (dropdown of all sheets in file)
- Header row number
- Data start row
- Data end row (optional)
- Column range (optional: A:Z)
- Named range import option

**Fixed-Width Panel:**
- Column definition builder: add rows with (column name, start position, end position, type)
- "Auto-detect" from first row if widths are visually obvious
- Preview rendering with position markers

### 8.4 Schema Review & Editing (Pre-Import)
After inference, user sees a schema editor table:
| Column | Inferred Name | Inferred Type | Nullable | PK | Default | Description | Rename | Type Override | Include |
|---|---|---|---|---|---|---|---|---|---|
- All fields editable before committing import
- Drag-and-drop column reorder
- Add custom columns (computed at import time with expression)
- Remove columns from import
- Rename all: batch rename with prefix/suffix/replace pattern

---

## 9. Hierarchy Tree UI

### 9.1 Tree Component Specifications

#### 9.1.1 Visual Design
- Left panel, resizable (drag handle), collapsible to icon-only sidebar
- Tree icon + label per node; icon is technology-specific SVG
- Indent per level: 16px
- Node height: 32px (comfortable) / 24px (compact mode)
- Expand/collapse chevron (›/∨) on left of icon
- Hover: background highlight + reveal action buttons on right
- Selected node: persistent highlight with stronger background

#### 9.1.2 Node Types and Their Displayed Properties
| Level | Node Label | Secondary Info |
|---|---|---|
| Technology Group | Group Name | Connection count |
| Technology | Technology Name | Connection count |
| Connection | Connection Name | Health dot + last sync time |
| Database | Database Name | Schema count (lazy) |
| Schema | Schema Name | Table count (lazy) |
| Table/View | Table Name | Row count (lazy, approx) |
| Column | Column Name | Type + nullable + PK/FK badge |

#### 9.1.3 Node Status Indicators
- **Sync in progress**: animated rotating arrows icon
- **Sync error**: red exclamation triangle
- **Stale** (last sync > configured threshold): amber clock icon
- **Never synced**: gray cloud-slash icon
- **Deleted at source**: strikethrough label + gray text
- **New since last view**: blue dot badge
- **Schema changed**: orange delta (Δ) badge

### 9.2 Tree Toolbar
Fixed toolbar above tree:
- **Search box**: live filter across all loaded tree nodes (name contains); shortcut Ctrl+Shift+F
- **Add Connection** button: opens connection setup wizard
- **Sync All** button: triggers sync for all connections (with confirmation)
- **Filter by technology**: technology type checkboxes dropdown
- **Sort**: alphabetical / by last sync / by connection count
- **Collapse All** button
- **Refresh** button: reloads current view from cache; force-sync icon for full refresh

### 9.3 Tree Node Context Menu (Right-Click)
Available options depend on hierarchy level:

**Technology Group:**
- Add Connection to this Group
- Rename Group
- Collapse All in Group

**Technology:**
- Add Connection
- Collapse All

**Connection:**
- Sync Metadata Now
- Open Import Wizard
- Edit Connection
- Test Connection
- View Sync History
- View Connection Settings
- Rename Connection
- Delete Connection
- Duplicate Connection

**Database:**
- Sync This Database
- Open Import Wizard (scoped to this DB)
- Rename (platform alias — does not rename in source)
- Remove from Catalog
- View Tables
- Copy Name

**Schema:**
- Sync This Schema
- Open Import Wizard (scoped to this schema)
- Preview Schema (list tables)
- Rename (platform alias)
- Remove from Catalog
- Add Description
- Apply Tags
- Copy Name

**Table/View:**
- Preview Data
- View Columns
- View Profile
- Open in Pipeline (pre-populates source node)
- Sync This Table
- Rename (platform alias)
- Edit Metadata
- Apply Tags / Classifications
- Add to Favorites
- Copy Full Table Name
- Copy as SQL (SELECT * FROM schema.table LIMIT 100)
- View Lineage
- Remove from Catalog
- Delete Table (source delete — admin only; destructive; requires confirmation)

**Column:**
- Copy Column Name
- Copy as SQL Expression
- Edit Column Metadata (description, tags, classification, alias)
- View Column Profile
- Add to Glossary
- Mark as PII / Sensitive
- Rename (platform alias)

### 9.4 Drag & Drop from Tree
- Drag a table node onto the pipeline canvas → creates a Source node pre-configured with that table
- Drag a schema node → prompts "Create source nodes for all selected tables from this schema?"
- Drag a column → onto an existing node's column mapping area
- Drag a file node → creates a File Source node

### 9.5 Tree Search & Filter
- **Instant search**: filters currently loaded tree nodes client-side as user types
- **Server search**: if pattern not found in loaded nodes, button "Search all metadata" triggers server-side search across entire catalog
- **Type filter**: show only: Tables / Views / Columns / Files / Topics (checkboxes)
- **Tag filter**: filter by applied tags
- **Classification filter**: PII / SENSITIVE / etc.
- **My Favorites**: toggle to show only favorited items
- **Recently Used**: recently accessed tables/columns listed in a pinned section
- **Highlight matches**: matching text highlighted in yellow in tree labels

---

## 10. CRUD Operations on Metadata

### 10.1 Edit Operations (Platform Alias — Non-Destructive)

All "rename/edit" operations on metadata within the ETL platform create a **platform alias** — they modify how the object is displayed and referenced within the tool without affecting the source system. Source name is always preserved and visible.

| Level | Editable Attributes |
|---|---|
| Connection | Name (platform alias), Description, Tags, Color Label, Owner, Team |
| Database | Display Name (alias), Description, Tags |
| Schema | Display Name (alias), Description, Tags, Owner, Classification |
| Table | Display Name (alias), Description, Tags, Owner, Classification, Business Name, Steward, SLA |
| Column | Display Name (alias), Description, Tags, Business Name, Classification (PII/Sensitive/Public), Masking Rule, Format Hint, Glossary Term |

### 10.2 Edit UI: Inline Editing
- Double-click on node label in tree → inline text edit for name/alias
- Escape to cancel; Enter to save
- Inline tag editor: click "+" beside tags section
- Inline classification picker

### 10.3 Edit UI: Metadata Panel (Side Drawer)
- Opens from "Edit Metadata" context menu or by clicking metadata icon
- Full form with all editable attributes
- Markdown description editor with preview
- Tag picker with autocomplete
- Classification multi-select with color-coded badges
- Owner picker (user/team selector)
- Related glossary terms picker
- Save / Cancel buttons
- Change history for metadata (who changed what, when)

### 10.4 Delete Operations

#### 10.4.1 Remove from Catalog (Soft Delete)
- Removes the object from the ETL platform catalog
- Does NOT affect the source system
- Object still searchable with "Include archived" filter
- Can be re-imported
- Requires confirmation dialog with object name typed

#### 10.4.2 Delete at Source (Hard Delete — Restricted)
- Only available for: file-based connections (S3, HDFS, SFTP), and connections where user has WRITE permission
- Requires: Admin role + explicit "DELETE AT SOURCE" permission
- Multi-step confirmation: type connection name + object name + reason
- Audit logged with user, timestamp, IP, reason
- Not available for: RDBMS tables, Kafka topics, DW tables (too risky)

#### 10.4.3 Bulk Delete
- Select multiple objects in tree or in table grid view
- "Remove selected from catalog" bulk action
- Shows impact summary before confirming: N objects to remove, N pipelines referencing these objects

### 10.5 Rename Conflicts & Notifications
- If a pipeline references a table and that table's alias is renamed, pipeline editor shows a "Metadata Updated" badge
- Dependency check before delete: "3 pipelines reference this table. Delete anyway?"
- Option to: block delete / auto-update pipeline references / notify owners

---

## 11. Column-Level Metadata

### 11.1 Column Attributes Catalog
| Attribute | Source | Editable |
|---|---|---|
| Physical Name | Source system | No |
| Platform Alias / Display Name | Platform | Yes |
| Data Type (native) | Source system | No |
| Data Type (normalized) | Platform | Yes (override) |
| Ordinal Position | Source system | No |
| Nullable | Source system | Yes (override) |
| Default Value | Source system | No |
| Is Primary Key | Source system | Yes (override for files) |
| Is Foreign Key | Source system | Yes (override for files) |
| FK References (table + column) | Source system / platform | Yes |
| Is Indexed | Source system | No |
| Is Partition Column | Source system | Yes (override for files) |
| Is Clustering Key | Source system | No |
| Is Sort Key | Source system | No |
| Description | Platform | Yes |
| Business Name | Platform | Yes |
| Glossary Term Link | Platform | Yes |
| Classification | Platform | Yes |
| PII Type | Platform | Yes (Name / Email / Phone / SSN / DOB / Financial / Custom) |
| Masking Rule | Platform | Yes |
| Tags | Platform | Yes |
| Format Hint | Platform | Yes (e.g., phone: +1-XXX-XXX-XXXX; date: YYYY-MM-DD) |
| Sample Values | Platform (from preview/profile) | No |
| Null % | Platform (from profile) | No |
| Distinct Count | Platform (from profile) | No |
| Min / Max | Platform (from profile) | No |
| Last Profiled At | Platform | No |

### 11.2 Column Type System (Normalized)
All source-specific types are mapped to a normalized type:
- STRING, INTEGER, LONG, FLOAT, DOUBLE, DECIMAL(p,s), BOOLEAN, DATE, TIMESTAMP, TIMESTAMP_TZ, TIME, BINARY, JSON, ARRAY\<T\>, MAP\<K,V\>, STRUCT\<fields\>, UUID, ENUM\<values\>

Type mapping table maintained per technology (e.g., Oracle VARCHAR2 → STRING, NUMBER(10,2) → DECIMAL(10,2)).

### 11.3 Column Panel UI
When a table is expanded, columns are shown with:
- Icon: type icon (ABC for string, 123 for number, calendar for date, etc.)
- Name (physical) + alias if set
- Type badge
- PK / FK / Partition / Nullable badges
- Tags (inline chips)
- PII indicator (red lock icon if classified as PII)
- Quick profile stats on hover (null %, distinct count, top values)
- Expand → shows full column metadata panel

---

## 12. Metadata Enrichment & Annotations

### 12.1 Business Glossary Integration
- Platform-managed glossary of business terms
- Each term: name, definition, domain, synonyms, owner, related terms
- Any column/table can be linked to one or more glossary terms
- Reverse lookup: from glossary term → all linked columns/tables
- Glossary term picker in metadata edit panel with search
- Glossary management UI: create / edit / delete terms, manage hierarchy

### 12.2 Tags System
- Free-form tags: user-defined, auto-suggested from existing tags
- System tags: auto-applied by platform (e.g., `synced-today`, `has-errors`, `pii-detected`)
- Tag colors: user-assignable
- Tag namespaces: `domain:finance`, `team:data-eng`, `quality:high`
- Bulk tag apply from tree (schema-level → applies to all tables)
- Tag-based filtering everywhere

### 12.3 Data Classification
Built-in classification taxonomy:
- **Sensitivity**: PUBLIC / INTERNAL / CONFIDENTIAL / RESTRICTED / TOP_SECRET
- **PII**: PII / NON_PII
- **PII Type**: NAME / EMAIL / PHONE / SSN / DOB / FINANCIAL / MEDICAL / LOCATION / CUSTOM
- **Regulatory**: GDPR / HIPAA / PCI_DSS / SOX / CCPA / Custom
- Auto-classification (rule-based): column name patterns + sample value patterns
  - e.g., column named `email` + values matching email regex → auto-tag PII:EMAIL
  - Configurable rule library
  - Auto-classification runs on import and on profile; results shown for user confirmation

### 12.4 Favorite & Pinned Objects
- Any table/schema/connection can be starred as favorite
- Favorites section at top of tree (pinned, always visible)
- Favorite synced across sessions (stored in DB per user)
- Shared favorites: team-level favorites (any team member can see)

### 12.5 Recently Accessed
- Last 20 tables/schemas accessed (opened in preview, dragged to canvas, opened in pipeline)
- Shown in "Recent" section at top of tree
- Cleared on session end (configurable: persist across sessions)

---

## 13. Metadata Search & Discovery

### 13.1 Global Metadata Search
- Search bar in tree header: searches across all catalog objects
- Scope: table names, column names, descriptions, tags, business names, glossary terms
- Fuzzy matching: typo-tolerant
- Faceted results: grouped by Technology / Connection / Schema / Type
- Each result shows: breadcrumb path, type icon, description snippet, tags

### 13.2 Advanced Search
- Filter by: technology, connection, schema, object type, tag, classification, PII, owner, last modified, last profiled
- Sort by: relevance / name / last modified / most used
- Save search as preset
- Export search results as CSV

### 13.3 Catalog Browser (Alternative to Tree)
- Grid/table view of all catalog objects (as alternative to tree navigation)
- Columns: Name | Type | Connection | Schema | Tags | Classification | Row Count | Last Synced | Owner
- Same filters as search
- Useful for bulk operations and discovery across connections

### 13.4 Recommendations (Future / Phase 2)
- "Similar tables to this one" (based on schema similarity)
- "Frequently used together" (tables co-appearing in pipelines)
- "You may also need" (FK-related tables)

---

## 14. Data Profiling

### 14.1 Profile Scope Options
- **Table Profile**: runs on entire table (full scan) or a configurable row sample
- **Column Profile**: individual column statistics
- **Schema Profile**: aggregate stats across all tables in schema
- Profiling is always triggered explicitly — never automatic (cost protection)

### 14.2 Profile Statistics Computed
| Statistic | Types |
|---|---|
| Row count | Table |
| Size on disk | Table (where source exposes it) |
| Column count | Table |
| Null count & % per column | All |
| Distinct count (HyperLogLog approx) | All |
| Duplicate row count | Table |
| Min / Max | Numeric, Date, String |
| Mean / Median / Mode | Numeric |
| Std Dev / Variance | Numeric |
| Percentiles (P5, P25, P50, P75, P95, P99) | Numeric |
| Top 10 most frequent values | All |
| Bottom 10 least frequent values | All |
| Value length: min/max/avg | String |
| Pattern analysis | String (email, phone, date, UUID patterns detected) |
| Histogram | Numeric (10 equal-width buckets) |
| Value frequency distribution | Categorical (where distinct < 100) |
| Date range (min/max date) | Date/Timestamp |
| Timezone distribution | Timestamp |
| Empty string count | String |
| Negative value count | Numeric |
| Zero value count | Numeric |

### 14.3 Profile Scheduling
- One-time profile (immediate)
- Scheduled profile: daily / weekly / on-sync
- Incremental profile: profile only new rows since last profile (requires watermark column)

### 14.4 Profile Results UI
- Shown in Column Profile tab within table detail
- Sparkline charts for numeric distributions
- Histogram bar chart
- Top values table
- "Compare with previous profile" diff view: highlighted increases/decreases
- Data quality score derived from profile (null %, duplicate %, pattern conformance)

### 14.5 Profile Storage
- Stored in `metadata_profiles` table with timestamp
- Profile history: N snapshots kept (default: 10)
- Profile trend charts: null % over time, distinct count over time

---

## 15. Schema Evolution & Change Detection

### 15.1 Change Types Detected
| Change Type | Description |
|---|---|
| COLUMN_ADDED | New column appeared in source |
| COLUMN_REMOVED | Column no longer exists in source |
| COLUMN_TYPE_CHANGED | Data type changed (e.g., INT → BIGINT) |
| COLUMN_NULLABILITY_CHANGED | Nullable status changed |
| COLUMN_RENAMED | Column name changed (detected via position/type heuristics) |
| TABLE_ADDED | New table appeared in schema |
| TABLE_REMOVED | Table no longer exists |
| TABLE_RENAMED | Table renamed (heuristic detection) |
| INDEX_ADDED / REMOVED | Index changes |
| PARTITION_CHANGED | Partition scheme changed |
| ROW_COUNT_DELTA | Row count changed by > configured threshold % |

### 15.2 Change Impact Assessment
For each detected change:
- Identify all pipelines referencing the changed object
- Identify all orchestrators containing those pipelines
- Severity rating: BREAKING / WARNING / INFO
  - BREAKING: column removed / type narrowed / table removed
  - WARNING: column added (may need pipeline update) / type widened
  - INFO: index changes / row count delta

### 15.3 Change Notification & Workflow
- In-app notification to: pipeline owners + metadata stewards
- Email alert (configurable)
- "Schema Change" badge on affected table nodes in tree
- Schema change panel: side-by-side diff of before/after schema
- User actions: Acknowledge / Update Pipeline / Block Pipeline / Ignore
- Pipeline auto-validation triggered on schema change (validates compatibility)

### 15.4 Schema History
- Every version of a table's schema stored in `schema_versions` table
- Version list in table detail panel
- Diff view between any two versions
- "Restore to version": set pipeline to use historical schema snapshot

---

## 16. Data Lineage Integration

### 16.1 Column-Level Lineage
- Track which source column feeds which target column through transformations
- Lineage captured at pipeline execution time
- Reverse lineage: given a target column, trace back to all source columns

### 16.2 Table-Level Lineage
- Directed graph: source tables → transformation nodes → target tables
- Shown in table detail panel → Lineage tab
- External system icons for sources/targets outside the platform

### 16.3 Cross-Connection Lineage
- Lineage spans across connections (e.g., Postgres → Spark transform → S3 file → Snowflake table)
- Full end-to-end chain visible from any node

### 16.4 Lineage in Tree
- Table nodes in tree show lineage indicators: "upstream" / "downstream" badge
- Right-click → "View Lineage" opens lineage graph modal

---

## 17. Access Control & Visibility

### 17.1 Connection-Level RBAC
| Role | Can View Connection | Can Sync | Can Import | Can Preview Data | Can Edit Metadata | Can Delete |
|---|---|---|---|---|---|---|
| Viewer | Assigned connections only | No | No | No | No | No |
| Developer | Assigned connections | Read-only sync | Yes | Yes (N rows) | Own metadata | No |
| Data Steward | All | No | Yes | Yes | Full metadata | No |
| Operator | All | Yes | Yes | Yes | Yes | No |
| Admin | All | Yes | Yes | Yes | Yes | Yes (catalog only) |

### 17.2 Schema-Level Visibility Filtering
- Connection can be configured with "visible schemas" list (admin-set)
- User can only see schemas in this list (or all if unconfigured)
- Schemas outside the list are not shown even if the DB user can access them

### 17.3 Column-Level Masking
- Columns classified as PII can have masking rules
- Masking rules applied at preview time (data never leaves platform unmasked for non-admin roles):
  - FULL_MASK: replace with `****`
  - PARTIAL_MASK: show first/last N chars (configurable)
  - HASH: SHA-256 hash of value
  - TOKENIZE: platform-managed token map
  - NULL: show as NULL
  - CUSTOM: user-defined regex replacement
- Masking bypassed for: Admin + Data Steward roles (configurable)

### 17.4 Audit Logging
All metadata operations logged:
- View (schema / table / column / preview)
- Import
- Edit / rename
- Delete / remove
- Profile run
- Sync trigger
- Search

---

## 18. Data Model

```sql
-- Connection metadata
CREATE TABLE connections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(255) NOT NULL,
    display_name            VARCHAR(255),
    technology_group        VARCHAR(100) NOT NULL,
    technology              VARCHAR(100) NOT NULL,
    config                  JSONB NOT NULL,           -- Encrypted credentials + settings
    health_status           VARCHAR(50) DEFAULT 'UNKNOWN',
    last_sync_at            TIMESTAMPTZ,
    last_successful_sync_at TIMESTAMPTZ,
    sync_schedule           VARCHAR(100),
    owner_id                UUID REFERENCES users(id),
    team_id                 UUID,
    tags                    TEXT[] DEFAULT '{}',
    color_label             VARCHAR(20),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_by              UUID NOT NULL REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Catalog databases
CREATE TABLE catalog_databases (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id           UUID NOT NULL REFERENCES connections(id),
    physical_name           VARCHAR(500) NOT NULL,
    display_name            VARCHAR(500),
    description             TEXT,
    tags                    TEXT[] DEFAULT '{}',
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at              TIMESTAMPTZ,
    last_synced_at          TIMESTAMPTZ,
    schema_count            INTEGER,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(connection_id, physical_name)
);

-- Catalog schemas
CREATE TABLE catalog_schemas (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id             UUID NOT NULL REFERENCES catalog_databases(id),
    physical_name           VARCHAR(500) NOT NULL,
    display_name            VARCHAR(500),
    description             TEXT,
    owner                   VARCHAR(255),
    tags                    TEXT[] DEFAULT '{}',
    classification          VARCHAR(50),
    table_count             INTEGER,
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at              TIMESTAMPTZ,
    last_synced_at          TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(database_id, physical_name)
);

-- Catalog tables
CREATE TABLE catalog_tables (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_id               UUID NOT NULL REFERENCES catalog_schemas(id),
    physical_name           VARCHAR(500) NOT NULL,
    display_name            VARCHAR(500),
    object_type             VARCHAR(50) NOT NULL,     -- TABLE/VIEW/MATERIALIZED_VIEW/EXTERNAL/FILE/TOPIC/COLLECTION
    description             TEXT,
    business_name           VARCHAR(500),
    owner_id                UUID REFERENCES users(id),
    steward_id              UUID REFERENCES users(id),
    tags                    TEXT[] DEFAULT '{}',
    classification          VARCHAR(50),
    row_count_approx        BIGINT,
    size_bytes              BIGINT,
    column_count            INTEGER,
    source_ddl              TEXT,                     -- Original DDL from source (if available)
    extra_metadata          JSONB,                    -- Technology-specific metadata
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at              TIMESTAMPTZ,
    last_synced_at          TIMESTAMPTZ,
    last_profiled_at        TIMESTAMPTZ,
    schema_version          INTEGER NOT NULL DEFAULT 1,
    sla_seconds             INTEGER,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(schema_id, physical_name)
);

-- Catalog columns
CREATE TABLE catalog_columns (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id                UUID NOT NULL REFERENCES catalog_tables(id),
    physical_name           VARCHAR(500) NOT NULL,
    display_name            VARCHAR(500),
    business_name           VARCHAR(500),
    ordinal_position        INTEGER NOT NULL,
    native_type             VARCHAR(255) NOT NULL,
    normalized_type         VARCHAR(100) NOT NULL,
    type_precision          INTEGER,
    type_scale              INTEGER,
    is_nullable             BOOLEAN NOT NULL DEFAULT TRUE,
    is_primary_key          BOOLEAN NOT NULL DEFAULT FALSE,
    is_foreign_key          BOOLEAN NOT NULL DEFAULT FALSE,
    fk_ref_table_id         UUID REFERENCES catalog_tables(id),
    fk_ref_column_id        UUID,
    is_indexed              BOOLEAN NOT NULL DEFAULT FALSE,
    is_partition_column     BOOLEAN NOT NULL DEFAULT FALSE,
    default_value           TEXT,
    description             TEXT,
    tags                    TEXT[] DEFAULT '{}',
    classification          VARCHAR(50),
    pii_type                VARCHAR(100),
    masking_rule            VARCHAR(100),
    format_hint             VARCHAR(255),
    glossary_term_ids       UUID[] DEFAULT '{}',
    sample_values           JSONB,                    -- Array of sample values from last preview/profile
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(table_id, physical_name)
);

-- Schema versions (evolution tracking)
CREATE TABLE schema_versions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id                UUID NOT NULL REFERENCES catalog_tables(id),
    version_number          INTEGER NOT NULL,
    schema_snapshot         JSONB NOT NULL,           -- Full column list at this version
    changes_from_previous   JSONB,                    -- Diff from prior version
    change_types            TEXT[],                   -- Array of change type enums
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(table_id, version_number)
);

-- Schema change events
CREATE TABLE schema_change_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id                UUID NOT NULL REFERENCES catalog_tables(id),
    column_id               UUID REFERENCES catalog_columns(id),
    change_type             VARCHAR(100) NOT NULL,
    old_value               JSONB,
    new_value               JSONB,
    severity                VARCHAR(50) NOT NULL,     -- BREAKING/WARNING/INFO
    is_acknowledged         BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by         UUID REFERENCES users(id),
    acknowledged_at         TIMESTAMPTZ,
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Metadata profiles
CREATE TABLE metadata_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id                UUID NOT NULL REFERENCES catalog_tables(id),
    column_id               UUID REFERENCES catalog_columns(id),
    profile_scope           VARCHAR(50) NOT NULL,     -- TABLE/COLUMN
    sample_size             BIGINT,
    row_count               BIGINT,
    null_count              BIGINT,
    null_percent            NUMERIC,
    distinct_count          BIGINT,
    duplicate_count         BIGINT,
    min_value               TEXT,
    max_value               TEXT,
    mean_value              NUMERIC,
    median_value            NUMERIC,
    std_dev                 NUMERIC,
    percentiles             JSONB,                    -- {p5, p25, p50, p75, p95, p99}
    top_values              JSONB,                    -- [{value, count, percent}]
    histogram               JSONB,                    -- [{bucket_min, bucket_max, count}]
    pattern_analysis        JSONB,                    -- detected patterns
    profiled_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    profiled_by             UUID REFERENCES users(id)
);

-- Metadata audit log
CREATE TABLE metadata_audit_log (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type             VARCHAR(50) NOT NULL,     -- CONNECTION/DATABASE/SCHEMA/TABLE/COLUMN
    entity_id               UUID NOT NULL,
    action                  VARCHAR(100) NOT NULL,    -- VIEW/IMPORT/EDIT/DELETE/PREVIEW/SYNC/PROFILE
    actor_id                UUID REFERENCES users(id),
    ip_address              INET,
    action_metadata         JSONB,
    occurred_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sync jobs
CREATE TABLE metadata_sync_jobs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id           UUID NOT NULL REFERENCES connections(id),
    scope                   VARCHAR(50) NOT NULL,     -- FULL/INCREMENTAL/TABLE/SCHEMA
    scope_ref_id            UUID,                     -- schema_id or table_id if scoped
    status                  VARCHAR(50) NOT NULL,
    triggered_by            VARCHAR(50) NOT NULL,     -- USER/SCHEDULER/EVENT
    triggered_by_user_id    UUID REFERENCES users(id),
    objects_discovered      INTEGER DEFAULT 0,
    objects_changed         INTEGER DEFAULT 0,
    objects_deleted         INTEGER DEFAULT 0,
    error_count             INTEGER DEFAULT 0,
    started_at              TIMESTAMPTZ,
    ended_at                TIMESTAMPTZ,
    duration_seconds        NUMERIC,
    error_message           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User favorites
CREATE TABLE metadata_favorites (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id),
    entity_type             VARCHAR(50) NOT NULL,
    entity_id               UUID NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, entity_type, entity_id)
);

-- Key indexes
CREATE INDEX idx_cat_tables_schema_id ON catalog_tables(schema_id);
CREATE INDEX idx_cat_columns_table_id ON catalog_columns(table_id);
CREATE INDEX idx_cat_tables_tags ON catalog_tables USING GIN(tags);
CREATE INDEX idx_cat_columns_tags ON catalog_columns USING GIN(tags);
CREATE INDEX idx_cat_tables_search ON catalog_tables USING GIN(to_tsvector('english', coalesce(physical_name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')));
CREATE INDEX idx_cat_columns_search ON catalog_columns USING GIN(to_tsvector('english', coalesce(physical_name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')));
CREATE INDEX idx_schema_changes_table ON schema_change_events(table_id, detected_at DESC);
CREATE INDEX idx_profiles_table ON metadata_profiles(table_id, profiled_at DESC);
CREATE INDEX idx_sync_jobs_connection ON metadata_sync_jobs(connection_id, created_at DESC);
```

---

## 19. API Contracts

```
-- Connection APIs
GET    /api/v1/connections                                 List all connections
POST   /api/v1/connections                                 Create connection
GET    /api/v1/connections/:id                             Get connection detail
PUT    /api/v1/connections/:id                             Update connection
DELETE /api/v1/connections/:id                             Delete connection
POST   /api/v1/connections/:id/test                        Test connectivity
POST   /api/v1/connections/:id/sync                        Trigger sync
GET    /api/v1/connections/:id/sync-history                Sync job history
GET    /api/v1/connections/:id/health                      Connection health

-- Hierarchy APIs (lazy-loaded)
GET    /api/v1/connections/:id/databases                   List databases
GET    /api/v1/databases/:id/schemas                       List schemas
GET    /api/v1/schemas/:id/tables?page=&pageSize=&q=       List tables (paginated)
GET    /api/v1/tables/:id                                  Table detail
GET    /api/v1/tables/:id/columns                          Table columns
GET    /api/v1/tables/:id/schema-history                   Schema versions
GET    /api/v1/tables/:id/changes                          Schema change events
GET    /api/v1/columns/:id                                 Column detail

-- CRUD APIs
PUT    /api/v1/connections/:id/alias                       Rename connection
PUT    /api/v1/schemas/:id/metadata                        Edit schema metadata
PUT    /api/v1/tables/:id/metadata                         Edit table metadata
PUT    /api/v1/columns/:id/metadata                        Edit column metadata
DELETE /api/v1/tables/:id/catalog                          Remove table from catalog
DELETE /api/v1/schemas/:id/catalog                         Remove schema from catalog
POST   /api/v1/tables/:id/tags                             Apply tags
DELETE /api/v1/tables/:id/tags/:tag                        Remove tag
POST   /api/v1/metadata/bulk-tag                           Bulk apply tags

-- Preview APIs
POST   /api/v1/tables/:id/preview                          Preview table data
  body: { strategy, n, columns[], filter, partitionValue, strideK, timeRange }
POST   /api/v1/files/preview                               Preview file data
  body: { connectionId, path, format, formatOptions, strategy, n }
POST   /api/v1/streams/:id/preview                         Preview stream data
  body: { n, strategy, timeRange }

-- Import APIs
GET    /api/v1/connections/:id/source/databases            Fetch DBs from source (live)
GET    /api/v1/connections/:id/source/schemas?dbName=      Fetch schemas from source (live)
GET    /api/v1/connections/:id/source/tables?schemaName=   Fetch tables from source (live)
POST   /api/v1/import/start                                Start import job
GET    /api/v1/import/:jobId/status                        Import job progress
POST   /api/v1/import/:jobId/cancel                        Cancel import

-- Profile APIs
POST   /api/v1/tables/:id/profile                          Run table profile
POST   /api/v1/columns/:id/profile                         Run column profile
GET    /api/v1/tables/:id/profiles                         Profile history
GET    /api/v1/profiles/:id                                Single profile result

-- Search APIs
GET    /api/v1/metadata/search?q=&type=&tag=&connection=   Full-text search
GET    /api/v1/metadata/catalog                            Flat catalog browser

-- Schema File APIs
POST   /api/v1/files/infer-schema                          Infer schema from uploaded file
  body: multipart/form-data with file + formatOptions

-- Favorites & Recent
POST   /api/v1/favorites                                   Add favorite
DELETE /api/v1/favorites/:entityType/:entityId             Remove favorite
GET    /api/v1/favorites                                   List favorites
GET    /api/v1/recent                                      Recently accessed items

-- Audit
GET    /api/v1/metadata/audit?entityId=&action=&from=&to=  Metadata audit log
```

---

## 20. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Schema list (100 schemas) must load in < 500ms |
| **Performance** | Table list (page of 100) must load in < 800ms |
| **Performance** | Column list (200 columns) must load in < 300ms |
| **Performance** | Data preview (Top 25, RDBMS) must return in < 3s |
| **Performance** | File schema inference (1MB file) in < 5s |
| **Performance** | Full-text metadata search returns in < 1s across 10M objects |
| **Scalability** | Support catalogs with 10,000 connections, 100,000 schemas, 10M tables, 500M columns |
| **Scalability** | 500 concurrent preview requests without degradation |
| **UI Performance** | Tree with 10,000 visible nodes renders without jank (< 16ms per frame) via virtualization |
| **Reliability** | Metadata DB is source of truth; sync failures do not corrupt existing metadata |
| **Data Safety** | Preview queries cannot cause source data mutation (read-only connection mode enforced) |
| **Cost Protection** | Preview row limit hard-enforced at query layer; cannot be overridden by frontend |
| **Availability** | Metadata service: 99.9% uptime; degraded sync does not affect pipeline execution |
| **Security** | Credentials stored encrypted (AES-256); never returned to frontend |
| **Security** | PII-masked columns enforce masking at API layer regardless of frontend |
| **Compliance** | Metadata audit log retained minimum 3 years |

---

## 21. Acceptance Criteria Summary

| Feature | Acceptance Criteria |
|---|---|
| Hierarchy Tree | 7-level hierarchy renders correctly for all 25+ supported technologies; lazy loads per level; no full tree load on init |
| Lazy Loading | Expanding a schema with 1000 tables loads first 100 in < 1s; "Load More" loads next 100 correctly |
| Virtual Scroll | Tree with 5000 loaded nodes scrolls at 60fps; DOM nodes capped at ~200 |
| Data Preview | All 14 sampling strategies work for applicable source types; row limit enforced at source |
| File Parsing | All 15 file formats parse correctly; schema inference correct for CSV/JSON/Parquet/XML |
| Import Wizard | 7-step wizard completes end-to-end; schema/table selection scoped to user's DB access |
| CRUD Operations | Rename/edit updates display without affecting source; delete removes from catalog only; both audit-logged |
| Schema Evolution | Column add/remove/type-change detected on next sync; severity rated; affected pipelines identified |
| Profiling | 20+ statistics computed per column; stored; displayable; trend chart shown over N historical profiles |
| PII Classification | Auto-classification rules detect email/phone/SSN columns by name+value pattern; masking applied at API |
| Search | Full-text search returns results across all catalog levels in < 1s |
| RBAC | Viewer cannot preview data; Developer cannot delete; Admin can perform all actions |
| Audit | Every view/edit/delete/preview action logged with user, timestamp, IP |
| Cost Protection | Preview queries for BigQuery/Snowflake show estimated bytes scanned before execution |

---

*Document Version: 1.0 | Created: 2026-03 | Owner: ETL Platform Team*
