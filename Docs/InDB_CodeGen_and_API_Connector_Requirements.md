# In-Database Code Generation Engine & API Connector Service
## Enterprise ETL Platform — Detailed Requirements Document v1.0

---

## Table of Contents

1. [Overview & Scope](#1-overview--scope)
2. [Pushdown Eligibility Engine](#2-pushdown-eligibility-engine)
3. [In-DB Code Generation Engine](#3-in-db-code-generation-engine)
4. [SCD Processing — In-Database](#4-scd-processing--in-database)
5. [Staging Table Management](#5-staging-table-management)
6. [Execution Orchestration & Progress Tracking](#6-execution-orchestration--progress-tracking)
7. [Database-Specific SQL Dialects](#7-database-specific-sql-dialects)
8. [Transaction & Error Management](#8-transaction--error-management)
9. [Rollback & Recovery](#9-rollback--recovery)
10. [Code Generation Output & Review](#10-code-generation-output--review)
11. [API Connector Service](#11-api-connector-service)
12. [REST API Connector](#12-rest-api-connector)
13. [SOAP / WSDL Connector](#13-soap--wsdl-connector)
14. [GraphQL Connector](#14-graphql-connector)
15. [OData Connector](#15-odata-connector)
16. [Webhook Ingest Connector](#16-webhook-ingest-connector)
17. [API Metadata & Schema Inference](#17-api-metadata--schema-inference)
18. [API Rate Limiting & Resilience](#18-api-rate-limiting--resilience)
19. [API Authentication Methods](#19-api-authentication-methods)
20. [Data Model](#20-data-model)
21. [API Contracts](#21-api-contracts)
22. [Non-Functional Requirements](#22-non-functional-requirements)
23. [Acceptance Criteria](#23-acceptance-criteria)

---

## 1. Overview & Scope

### 1.1 Purpose

This document defines two independent but complementary capabilities:

**Part A — In-Database Code Generation Engine (InDB Engine)**
When all sources and targets of a pipeline reside within the same database instance (or same database cluster for partitioned databases), the ETL platform must detect this condition and generate native SQL instead of Spark/PySpark code. This eliminates data movement to an external compute cluster, radically reduces latency, lowers infrastructure cost, and exploits the query optimizer of the target database engine.

**Part B — API Connector Service**
The ETL platform must provide first-class connectivity to REST APIs, SOAP/WSDL services, GraphQL endpoints, OData services, and Webhook streams as both source and target in pipelines. These connectors must support full metadata discovery, schema inference, authentication management, rate-limit handling, pagination, and data preview.

### 1.2 In-Scope Databases for InDB Engine
| Database | Warehouse Use Case | Notes |
|---|---|---|
| PostgreSQL 12+ | Operational DW / OLAP | Uses CTEs, window functions, MERGE (PG15+), UPSERT |
| Microsoft SQL Server 2016+ | Enterprise DW | Uses MERGE, CTEs, temp tables, T-SQL specifics |
| Oracle Database 12c+ | Enterprise DW | Uses MERGE, CTEs, ROWID, Oracle-specific syntax |
| Teradata 16.20+ | Enterprise DW | Uses MERGE, Volatile/Derived tables, BTEQ dialect |
| Snowflake | Cloud DW | Uses MERGE, CLONE, Zero-Copy Staging |
| Google BigQuery | Cloud DW | Uses MERGE, CTEs, Scripting |
| Amazon Redshift | Cloud DW | Uses CTEs, MERGE (Redshift MERGE syntax) |
| Azure Synapse Analytics | Cloud DW | Uses MERGE, CTAS, external tables |
| Databricks SQL | Lakehouse | Uses Delta MERGE, CTEs |
| ClickHouse | OLAP | Uses INSERT SELECT, ReplacingMergeTree pattern |

### 1.3 Design Principles
- **Intelligence first**: Platform decides pushdown vs Spark automatically; user can override.
- **Correctness over performance**: Generated SQL must be semantically equivalent to the pipeline definition with zero data loss.
- **Dialect purity**: Generated SQL must be 100% valid for the target DB with no cross-DB syntax leakage.
- **Transparent staging**: Staging tables are fully managed by the platform; user never manually creates them.
- **Full traceability**: Every generated statement is preserved, versioned, and linked to the execution record.
- **Atomicity guarantee**: Multi-step pipelines run within a transaction or coordinated transaction chain with rollback capability.

---

## 2. Pushdown Eligibility Engine

### 2.1 Eligibility Detection Algorithm

At pipeline save and at pipeline submission time, the platform runs the **Pushdown Eligibility Check**:

#### 2.1.1 Eligibility Conditions (ALL must be true)
1. All source nodes in the pipeline reference tables/views in the **same connection**.
2. All target nodes in the pipeline reference tables/views in the **same connection** as sources.
3. All intermediate transform nodes use operations the InDB Engine supports for the target DB dialect (see Section 3.3).
4. No node references an external file (S3, HDFS, SFTP, local) as source or target.
5. No node references a streaming source or target.
6. The connected database is in the supported InDB Engine database list (Section 1.2).
7. The database user credential on the connection has sufficient privileges (SELECT on sources, INSERT/UPDATE/DELETE/CREATE TABLE on target schema).

#### 2.1.2 Partial Eligibility (Hybrid Mode)
If conditions 1–4 are met for a **subgraph** of the pipeline (a subset of nodes all connected to the same DB), the platform may:
- Offer a **Hybrid Execution Plan**: InDB SQL for the eligible subgraph, Spark for ineligible nodes.
- Materialize the Spark output to a staging table in the DB and hand off to the InDB engine.
- Clearly show the split in the pipeline canvas (InDB nodes have a DB icon badge; Spark nodes have spark badge).

#### 2.1.3 Eligibility Result Display
- Pipeline canvas: global badge "IN-DB EXECUTION" (green) or "SPARK EXECUTION" (blue) or "HYBRID" (amber)
- Node-level badge: each node shows which engine will process it
- Eligibility panel (sidebar): list of reasons if pushdown is not fully eligible
- "Force Spark" override toggle: user can force Spark even if InDB is eligible (e.g., for testing/comparison)
- "Force InDB" toggle: grayed out with warning if not all conditions met; highlights unresolved nodes

### 2.2 Privilege Check
Before execution:
```
RDBMS Privileges Checked:
  - SELECT on all source tables/views
  - SELECT on system catalog (information_schema or equivalent)
  - CREATE TABLE in staging schema
  - INSERT, UPDATE, DELETE on target tables
  - DROP TABLE on staging schema (for cleanup)
  - EXECUTE on stored procedures (if proc-based execution selected)
Teradata:
  - Space check in staging database
  - CREATE TABLE, CREATE VOLATILE TABLE
Oracle:
  - CREATE TABLE in target/staging schema
  - EXECUTE privilege on DBMS_METADATA (for DDL extraction)
```
Privilege check result shown to user before execution starts. Missing privileges listed with remediation SQL to share with DBA.

---

## 3. In-DB Code Generation Engine

### 3.1 Architecture

```
Pipeline Definition (JSON)
         │
         ▼
┌─────────────────────────┐
│  Pushdown Eligibility   │
│  Engine                 │
└─────────┬───────────────┘
          │ ELIGIBLE
          ▼
┌─────────────────────────┐
│  Logical Plan Builder   │  → Dialect-agnostic logical query plan (DAG of operations)
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  Staging Planner        │  → Identifies which intermediate results need staging tables
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  SQL Code Generator     │  → Dialect-specific SQL (PostgreSQL / MSSQL / Oracle / Teradata)
│  (per dialect)          │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  SQL Plan Optimizer     │  → Merges eligible CTEs, removes redundant stages, adds hints
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  Execution Script       │  → Ordered list of SQL statements with dependency metadata
│  Assembler              │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  SQL Executor Service   │  → Executes statements, tracks progress, handles errors
└─────────────────────────┘
```

### 3.2 Logical Plan Operations
The logical plan represents operations in a DB-agnostic way. Each operation maps to SQL in each dialect:

| Logical Operation | Maps To |
|---|---|
| SELECT_COLUMNS | SELECT col1, col2, ... FROM |
| FILTER | WHERE clause |
| JOIN (INNER/LEFT/RIGHT/FULL/CROSS) | JOIN clause |
| AGGREGATE (GROUP BY) | GROUP BY + aggregate functions |
| WINDOW_FUNCTION | OVER (PARTITION BY ... ORDER BY ...) |
| SORT | ORDER BY |
| DISTINCT | SELECT DISTINCT |
| UNION / UNION_ALL | UNION / UNION ALL |
| INTERSECT | INTERSECT |
| EXCEPT / MINUS | EXCEPT / MINUS |
| LIMIT / FETCH_FIRST | TOP N / LIMIT N / FETCH FIRST N ROWS ONLY |
| RENAME_COLUMN | column AS alias |
| CAST_TYPE | CAST(col AS type) |
| COMPUTE_EXPRESSION | computed column expression |
| NULL_COALESCE | COALESCE / NVL / ISNULL |
| CONDITIONAL_EXPRESSION | CASE WHEN ... THEN ... END |
| SUBSTRING / STRING_OPS | dialect-specific string functions |
| DATE_TRUNC / DATE_ADD | dialect-specific date functions |
| PIVOT / UNPIVOT | dialect-specific or emulated |
| DEDUPLICATE (keep first/last) | ROW_NUMBER() OVER() WHERE rn=1 |
| LOOKUP_JOIN | Optimized as JOIN or IN subquery |
| INSERT_OVERWRITE | TRUNCATE + INSERT or DELETE + INSERT |
| UPSERT | MERGE / INSERT...ON CONFLICT |
| SCD_TYPE1 | MERGE with UPDATE on match |
| SCD_TYPE2 | MERGE with end-date + INSERT new |
| SCD_TYPE3 | UPDATE with current/previous columns |
| DELETE_MATCHING | DELETE WHERE key IN (subquery) |
| VALIDATE_CONSTRAINTS | Constraint check query |
| STAGE_WRITE | INSERT INTO staging_table SELECT ... |
| STAGE_READ | SELECT FROM staging_table |

### 3.3 Supported Transform Node Types for InDB Execution

| Transform Node | InDB Supported | Notes |
|---|---|---|
| Column Selector | ✓ | SELECT projection |
| Filter / Where | ✓ | WHERE clause |
| Join (all types) | ✓ | All standard JOIN types |
| Aggregate / Group By | ✓ | All standard aggregate functions |
| Sort | ✓ | ORDER BY |
| Deduplication | ✓ | ROW_NUMBER() partition |
| Union | ✓ | UNION / UNION ALL |
| Lookup | ✓ | LEFT JOIN pattern |
| Expression / Derived Column | ✓ | CASE / CAST / computed expressions |
| Type Cast | ✓ | CAST / CONVERT |
| Null Handler | ✓ | COALESCE / NVL |
| Window Functions | ✓ | All OVER() variants |
| Pivot / Unpivot | ✓ | Native or emulated |
| SCD Type 1/2/3 | ✓ | MERGE-based (see Section 4) |
| Data Validation | ✓ | Constraint query + error table insert |
| Slowly Changing Dim | ✓ | All SCD types |
| Row Splitter | ✓ | UNION ALL with different WHERE per output |
| Conditional Split | ✓ | CASE-based or multiple INSERT ... SELECT |
| Surrogate Key | ✓ | SEQUENCE / IDENTITY / ROW_NUMBER() |
| Rank / Row Number | ✓ | Window functions |
| Python UDF / Custom Code | ✗ | Cannot push down; forces Spark |
| ML Inference Node | ✗ | Cannot push down |
| File Read/Write | ✗ | Cannot push down |
| HTTP Call node | ✗ | Cannot push down |

### 3.4 CTE Optimization
- Simple linear pipelines (SOURCE → TRANSFORMS → TARGET) are collapsed into a single SQL statement using CTEs.
- Each transform step becomes a named CTE.
- Final INSERT/MERGE uses the last CTE as its source.
- No intermediate staging tables needed for simple linear chains.
- Example output (PostgreSQL):

```sql
-- Generated by ETL Platform InDB Engine
-- Pipeline: CustomerDimLoad | Execution: exec-uuid-1234
-- Generated at: 2026-03-02T10:00:00Z
-- DB Dialect: PostgreSQL 15

WITH
-- Step 1: Source - raw_customers
src_raw_customers AS (
    SELECT customer_id, first_name, last_name, email, created_at
    FROM staging.raw_customers
    WHERE load_date = CURRENT_DATE
),
-- Step 2: Filter active records
step_filter_active AS (
    SELECT * FROM src_raw_customers
    WHERE email IS NOT NULL AND customer_id IS NOT NULL
),
-- Step 3: Derive full_name
step_derive_columns AS (
    SELECT
        customer_id,
        TRIM(first_name || ' ' || last_name) AS full_name,
        LOWER(email) AS email,
        created_at,
        CURRENT_TIMESTAMP AS etl_load_ts
    FROM step_filter_active
),
-- Step 4: Deduplication
step_dedup AS (
    SELECT *
    FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS rn
        FROM step_derive_columns
    ) t
    WHERE rn = 1
)
-- Final: Merge into target
INSERT INTO dw.dim_customer (customer_id, full_name, email, created_at, etl_load_ts)
SELECT customer_id, full_name, email, created_at, etl_load_ts
FROM step_dedup
ON CONFLICT (customer_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    etl_load_ts = EXCLUDED.etl_load_ts;
```

---

## 4. SCD Processing — In-Database

### 4.1 SCD Type 1 — Overwrite

**Semantics**: When a source record matches the target by business key, overwrite all non-key attributes. No history is kept.

#### 4.1.1 Generated Pattern (PostgreSQL 15+)
```sql
MERGE INTO dw.dim_customer AS tgt
USING (
    SELECT customer_id, full_name, email, phone, address, etl_load_ts
    FROM {source_cte}
) AS src
ON tgt.customer_id = src.customer_id
WHEN MATCHED AND (
    tgt.full_name    IS DISTINCT FROM src.full_name OR
    tgt.email        IS DISTINCT FROM src.email OR
    tgt.phone        IS DISTINCT FROM src.phone OR
    tgt.address      IS DISTINCT FROM src.address
) THEN UPDATE SET
    full_name    = src.full_name,
    email        = src.email,
    phone        = src.phone,
    address      = src.address,
    updated_at   = CURRENT_TIMESTAMP,
    etl_load_ts  = src.etl_load_ts
WHEN NOT MATCHED THEN INSERT (
    customer_id, full_name, email, phone, address, created_at, etl_load_ts
) VALUES (
    src.customer_id, src.full_name, src.email, src.phone, src.address,
    CURRENT_TIMESTAMP, src.etl_load_ts
);
```

#### 4.1.2 PostgreSQL Pre-15 Fallback (INSERT ... ON CONFLICT)
```sql
INSERT INTO dw.dim_customer (customer_id, full_name, email, phone, address, created_at, etl_load_ts)
SELECT customer_id, full_name, email, phone, address, CURRENT_TIMESTAMP, etl_load_ts
FROM {source_cte}
ON CONFLICT (customer_id) DO UPDATE SET
    full_name   = EXCLUDED.full_name,
    email       = EXCLUDED.email,
    phone       = EXCLUDED.phone,
    address     = EXCLUDED.address,
    updated_at  = CURRENT_TIMESTAMP,
    etl_load_ts = EXCLUDED.etl_load_ts
WHERE (
    dw.dim_customer.full_name   IS DISTINCT FROM EXCLUDED.full_name OR
    dw.dim_customer.email       IS DISTINCT FROM EXCLUDED.email
);
```

#### 4.1.3 SQL Server T-SQL
```sql
MERGE dw.dim_customer WITH (HOLDLOCK) AS tgt
USING (SELECT ... FROM {source_cte}) AS src
ON tgt.customer_id = src.customer_id
WHEN MATCHED AND (
    tgt.full_name <> src.full_name OR tgt.email <> src.email
) THEN UPDATE SET
    tgt.full_name = src.full_name, tgt.email = src.email,
    tgt.updated_at = GETDATE()
WHEN NOT MATCHED BY TARGET THEN INSERT (...) VALUES (...)
WHEN NOT MATCHED BY SOURCE AND :delete_unmatched = 'Y' THEN DELETE;
```

#### 4.1.4 Oracle
```sql
MERGE INTO dw.dim_customer tgt
USING (SELECT ... FROM {source_cte}) src
ON (tgt.customer_id = src.customer_id)
WHEN MATCHED THEN UPDATE SET
    tgt.full_name = src.full_name,
    tgt.updated_at = SYSDATE
    WHERE tgt.full_name != src.full_name
WHEN NOT MATCHED THEN INSERT (customer_id, full_name, ...) VALUES (src.customer_id, ...);
```

#### 4.1.5 Teradata
```sql
MERGE INTO dw.dim_customer AS tgt
USING (SELECT ... FROM {source_cte}) AS src
ON tgt.customer_id = src.customer_id
WHEN MATCHED THEN UPDATE SET full_name = src.full_name, updated_at = CURRENT_TIMESTAMP
WHEN NOT MATCHED THEN INSERT (customer_id, full_name, ...) VALUES (src.customer_id, ...);
```

#### 4.1.6 SCD1 Configuration Options (per node in pipeline)
| Option | Description | Default |
|---|---|---|
| Business Key Columns | Columns used for MERGE ON clause | Required |
| Update Columns | Columns to overwrite on match | All non-key columns |
| Change Detection | Compare before UPDATE (avoid no-op updates) | ON |
| Delete Unmatched | Delete target rows not in source | OFF |
| Soft Delete | Mark as deleted instead of hard DELETE | OFF |
| Soft Delete Column | Column name for soft delete flag | `is_deleted` |
| Delete Flag Value | Value to set for soft delete | `'Y'` / `true` / `1` |
| Updated At Column | Auto-set timestamp column on UPDATE | `updated_at` |
| ETL Timestamp Column | Column to stamp with ETL run time | `etl_load_ts` |

---

### 4.2 SCD Type 2 — Full History

**Semantics**: When source record changes, end-date the current target row and insert a new row representing the current state. Full history of all changes is preserved.

#### 4.2.1 Required Target Table Columns
| Column | Purpose | Generated Default |
|---|---|---|
| Surrogate Key | Unique row identifier (auto-generated) | `BIGINT IDENTITY / SERIAL / SEQUENCE` |
| Business Key(s) | Natural key(s) from source | User-defined |
| Attribute Columns | Tracked attributes | User-defined |
| `effective_start_date` | When this version became active | `CURRENT_TIMESTAMP` |
| `effective_end_date` | When this version was superseded | `NULL` (active) / timestamp |
| `is_current` | Boolean flag for current row | `TRUE` / `FALSE` |
| `record_hash` | Hash of tracked columns for change detection | SHA-256 / MD5 |
| `etl_load_ts` | ETL batch timestamp | `CURRENT_TIMESTAMP` |
| `source_system` | Identifier of originating source | Optional |
| `created_at` | Row creation timestamp | `CURRENT_TIMESTAMP` |

If the target table lacks required SCD2 columns, the platform alerts the user and offers "Auto-Add SCD2 Columns" which generates and executes the ALTER TABLE statements, stored in execution artifacts.

#### 4.2.2 SCD2 Execution Steps (Multi-Statement — Requires Staging)

**Step 1: Write incoming data to staging table**
```sql
CREATE TABLE {staging_schema}.stg_scd2_dim_customer_{exec_id} (
    customer_id     VARCHAR(50),
    full_name       VARCHAR(200),
    email           VARCHAR(200),
    phone           VARCHAR(50),
    address         VARCHAR(500),
    record_hash     CHAR(64),
    etl_load_ts     TIMESTAMP
);

INSERT INTO {staging_schema}.stg_scd2_dim_customer_{exec_id}
SELECT
    customer_id, full_name, email, phone, address,
    ENCODE(SHA256(CAST((full_name||'|'||email||'|'||phone||'|'||address) AS BYTEA)), 'hex'),
    CURRENT_TIMESTAMP
FROM {source_cte};
```

**Step 2: Identify changed records**
```sql
CREATE TABLE {staging_schema}.stg_scd2_changed_{exec_id} AS
SELECT s.*
FROM {staging_schema}.stg_scd2_dim_customer_{exec_id} s
INNER JOIN dw.dim_customer t
    ON s.customer_id = t.customer_id AND t.is_current = TRUE
WHERE s.record_hash <> t.record_hash;
```

**Step 3: Identify new records (no match)**
```sql
CREATE TABLE {staging_schema}.stg_scd2_new_{exec_id} AS
SELECT s.*
FROM {staging_schema}.stg_scd2_dim_customer_{exec_id} s
LEFT JOIN dw.dim_customer t
    ON s.customer_id = t.customer_id AND t.is_current = TRUE
WHERE t.customer_id IS NULL;
```

**Step 4: Expire changed records (end-date current rows)**
```sql
UPDATE dw.dim_customer
SET
    effective_end_date = CURRENT_TIMESTAMP - INTERVAL '1 second',
    is_current = FALSE
WHERE customer_id IN (SELECT customer_id FROM {staging_schema}.stg_scd2_changed_{exec_id})
AND is_current = TRUE;
```

**Step 5: Insert new versions for changed records**
```sql
INSERT INTO dw.dim_customer
    (customer_id, full_name, email, phone, address,
     effective_start_date, effective_end_date, is_current, record_hash, etl_load_ts)
SELECT
    customer_id, full_name, email, phone, address,
    CURRENT_TIMESTAMP, NULL, TRUE, record_hash, etl_load_ts
FROM {staging_schema}.stg_scd2_changed_{exec_id};
```

**Step 6: Insert brand new records**
```sql
INSERT INTO dw.dim_customer
    (customer_id, full_name, email, phone, address,
     effective_start_date, effective_end_date, is_current, record_hash, etl_load_ts)
SELECT
    customer_id, full_name, email, phone, address,
    CURRENT_TIMESTAMP, NULL, TRUE, record_hash, etl_load_ts
FROM {staging_schema}.stg_scd2_new_{exec_id};
```

**Step 7: Handle source deletes (optional)**
```sql
UPDATE dw.dim_customer
SET effective_end_date = CURRENT_TIMESTAMP, is_current = FALSE
WHERE customer_id NOT IN (
    SELECT customer_id FROM {staging_schema}.stg_scd2_dim_customer_{exec_id}
)
AND is_current = TRUE;
```

**Step 8: Cleanup staging tables**
```sql
DROP TABLE IF EXISTS {staging_schema}.stg_scd2_dim_customer_{exec_id};
DROP TABLE IF EXISTS {staging_schema}.stg_scd2_changed_{exec_id};
DROP TABLE IF EXISTS {staging_schema}.stg_scd2_new_{exec_id};
```

#### 4.2.3 SCD2 Configuration Options (per node)
| Option | Description | Default |
|---|---|---|
| Business Key Columns | For MERGE matching | Required |
| Tracked Columns | Columns whose changes trigger a new version | All non-key, non-SCD2 system columns |
| Surrogate Key Column | Name of the auto-generated surrogate key | `sk_{table_name}` |
| Surrogate Key Strategy | IDENTITY / SEQUENCE / UUID / ROW_HASH | DB-dependent default |
| Effective Start Column | Name | `effective_start_date` |
| Effective End Column | Name | `effective_end_date` |
| Is Current Column | Name | `is_current` |
| End Date for Active | NULL (preferred) or high date (e.g., 9999-12-31) | NULL |
| Change Detection | Hash all tracked cols vs compare each col | HASH (faster) |
| Hash Algorithm | MD5 (faster) / SHA-256 (safer) | SHA-256 |
| Handle Deletes | NONE / SOFT_DELETE / HARD_END_DATE | NONE |
| Late Arriving Records | INSERT_HISTORICAL / REJECT / LOG | REJECT |
| Retroactive Correction | Re-open ended rows if source sends backdated data | OFF |

---

### 4.3 SCD Type 3 — Limited History (Current + Previous)

**Semantics**: Keep only the current and one previous value for tracked attributes. One row per business key.

#### 4.3.1 Generated SQL (PostgreSQL)
```sql
UPDATE dw.dim_customer tgt
SET
    previous_address    = tgt.current_address,
    current_address     = src.address,
    address_changed_at  = CURRENT_TIMESTAMP,
    previous_email      = tgt.current_email,
    current_email       = src.email,
    email_changed_at    = CURRENT_TIMESTAMP,
    etl_load_ts         = CURRENT_TIMESTAMP
FROM (SELECT * FROM {source_cte}) src
WHERE tgt.customer_id = src.customer_id
AND (
    tgt.current_address IS DISTINCT FROM src.address OR
    tgt.current_email   IS DISTINCT FROM src.email
);

INSERT INTO dw.dim_customer (customer_id, current_address, current_email, ...)
SELECT customer_id, address, email, ...
FROM {source_cte}
WHERE customer_id NOT IN (SELECT customer_id FROM dw.dim_customer);
```

#### 4.3.2 SCD3 Configuration Options
| Option | Description |
|---|---|
| Business Key Columns | For UPDATE WHERE clause |
| Tracked Columns | Each generates current_ / previous_ column pair |
| Changed At Column | Auto-suffix pattern: `{col}_changed_at` |
| Handle New Records | INSERT / REJECT / LOG |
| Track N Versions | Extended SCD3: keep N previous values as JSON array |

---

### 4.4 SCD Type 4 (Mini-Dimension)
- Current values stored in main dimension; history in separate history table
- Platform generates INSERT into history table + UPDATE on main table
- History table auto-created if not exists

### 4.5 SCD Type 6 (Hybrid: 1+2+3)
- Combines SCD2 (new rows for history) + SCD3 (current/previous columns on active row)
- Platform generates the full multi-step SQL covering both patterns
- Most complex; requires staging + multi-step execution

### 4.6 Mixed SCD Columns
Within a single target table, different columns can have different SCD strategies:
- e.g., `email`: SCD Type 1 (just overwrite), `address`: SCD Type 2 (full history), `marketing_flag`: SCD Type 3 (current/previous)
- Platform generates a combined MERGE statement handling each column's strategy appropriately
- This is a first-class configuration option in the SCD node properties panel

---

## 5. Staging Table Management

### 5.1 When Staging Tables Are Required
| Scenario | Staging Required | Reason |
|---|---|---|
| SCD Type 2 processing | YES | Multi-step: identify changes → expire → insert |
| SCD Type 4/6 | YES | Multi-table write |
| Complex multi-join pipeline exceeding CTE nesting limit | YES | DB-specific CTE depth/size limit |
| Pipeline with fan-out (one source feeds multiple targets) | YES | Intermediate result materialized once |
| Error row capture | YES | Separate error materialization |
| Incremental load with watermark | YES | Stage new records before applying |
| Aggregation + raw insert to different targets | YES | Shared source materialized |
| Large dataset optimizer struggles with inline | YES | Force materialization for optimizer |

### 5.2 Staging Table Design

#### 5.2.1 Who Decides the Design
The **InDB Code Generation Engine** fully determines staging table structure. The user never manually defines a staging table. The engine:
1. Analyzes what columns the next step needs from this intermediate result.
2. Generates `CREATE TABLE` DDL with only the required columns.
3. Adds platform tracking columns to every staging table.

#### 5.2.2 Standard Staging Table Tracking Columns
Every platform-generated staging table includes:
| Column | Type | Purpose |
|---|---|---|
| `_etl_exec_id` | VARCHAR(36) | Execution UUID — for isolation and cleanup |
| `_etl_step_seq` | INTEGER | Which step produced this row |
| `_etl_row_hash` | CHAR(64) | SHA-256 of business columns |
| `_etl_inserted_at` | TIMESTAMP | When this row was staged |
| `_etl_row_status` | VARCHAR(20) | VALID / REJECTED / DUPLICATE / PENDING |
| `_etl_error_msg` | VARCHAR(2000) | Populated for REJECTED rows |

These columns are stripped before the final INSERT/MERGE into the target table.

#### 5.2.3 Staging Table Naming Convention
```
{staging_schema}.{platform_prefix}_{pipeline_short_id}_{step_name}_{exec_id_short}

Examples:
  etl_staging.etl_custload_src_raw_e4f2a1
  etl_staging.etl_custload_scd2_changed_e4f2a1
  etl_staging.etl_custload_scd2_new_e4f2a1
  etl_staging.etl_custload_errors_e4f2a1
```

Rules:
- `staging_schema` configurable per connection (default: `etl_staging`)
- `platform_prefix`: always `etl_`
- `pipeline_short_id`: first 8 chars of pipeline UUID
- `step_name`: logical name of the step (snake_case, max 20 chars)
- `exec_id_short`: first 6 chars of execution UUID
- Max total length: 128 characters

#### 5.2.4 Staging Schema Management
- Platform creates the staging schema if it does not exist (requires CREATE SCHEMA privilege)
- Staging schema is configurable per connection
- Staging schema should be separate from production schemas (enforced — warning if same schema chosen)
- Teradata: uses Volatile Tables instead of persistent staging tables (zero cleanup needed)
- BigQuery: uses temp tables within same dataset (prefixed `_tmp_`)
- Snowflake: uses temp tables (auto-dropped at session end)

#### 5.2.5 Staging Table Lifecycle
```
EXECUTION_START
     │
     ├── Step 1: CREATE staging tables
     │
     ├── Step N: POPULATE / READ staging tables
     │
     ├── Final Step: INSERT/MERGE into target tables
     │
     └── POST_EXECUTION:
             ├── SUCCESS: DROP all staging tables for this execution
             └── FAILURE:
                     ├── keep_staging_on_failure = TRUE: PRESERVE for debugging
                     └── keep_staging_on_failure = FALSE: DROP and log final row counts
```

#### 5.2.6 Staging Orphan Cleanup
- Background job runs every 30 minutes (configurable)
- Detects staging tables for executions older than X hours where execution is not RUNNING
- Drops orphaned staging tables; logs cleanup events
- Alert if orphaned staging tables exceed configured disk quota

#### 5.2.7 Staging Table Configuration per Pipeline
| Setting | Default | Description |
|---|---|---|
| Staging Schema | `etl_staging` | Schema to create staging tables in |
| Keep Staging on Failure | `false` | Preserve for post-mortem debugging |
| Keep Staging on Success | `false` | Preserve for audit (adds cleanup debt) |
| Staging Table Type | PERSISTENT / VOLATILE (Teradata) / TEMP (PG, MSSQL) | DB-dependent |
| Staging Row Limit | None | Safety cap: abort if staging would exceed N rows |
| Max Staging Disk | None | Safety cap in MB; abort if exceeded |

---

## 6. Execution Orchestration & Progress Tracking

### 6.1 Execution Plan Structure

The InDB execution plan is an ordered list of **SQL Steps**, each with:
```json
{
  "step_seq": 1,
  "step_name": "create_staging_scd2_src",
  "step_type": "CREATE_TABLE",
  "sql": "CREATE TABLE etl_staging.etl_...",
  "depends_on_steps": [],
  "is_staging_step": true,
  "staging_table_name": "etl_staging.etl_custload_src_e4f2a1",
  "estimated_rows": null,
  "timeout_seconds": 120,
  "on_error": "ABORT",
  "rollback_sql": "DROP TABLE IF EXISTS etl_staging.etl_custload_src_e4f2a1"
}
```

### 6.2 Step Types
| Step Type | Description |
|---|---|
| CREATE_TABLE | Create staging or temp table |
| INSERT_STAGING | Populate staging table |
| SELECT_VALIDATE | Run count/validation query before proceeding |
| UPDATE | UPDATE statement on target |
| INSERT | INSERT statement into target |
| MERGE | MERGE/UPSERT statement |
| DELETE | DELETE statement |
| ALTER_TABLE | Add SCD2 columns if missing |
| DROP_TABLE | Cleanup staging table |
| CHECKPOINT | Record progress milestone |
| VALIDATE_COUNTS | Assert row count matches expectation |
| VACUUM / ANALYZE | Post-load maintenance (PostgreSQL) |
| UPDATE_STATS | UPDATE STATISTICS (SQL Server, Teradata) |
| COMMIT | Explicit COMMIT (Oracle, Teradata) |
| SAVEPOINT | Create savepoint for partial rollback |

### 6.3 Progress Tracking

#### 6.3.1 Progress Tracking UI
In the Execution Detail Tab:
- **Step Progress Rail**: vertical timeline of all steps; each step shows status badge
- **Current Step Highlight**: currently executing step pulsing
- **Step Duration Bar**: Gantt-style bar per step
- **DB Query ID Display**: shows native DB query/session ID for DBA-side debugging
- **Row Count per Step**: rows affected shown as steps complete
- **Cumulative Progress %**: (completed steps / total steps) × 100
- **Cancel at Step Boundary**: stops execution after current step, triggers rollback

#### 6.3.2 Checkpointing
- After every N steps (default: 5), a CHECKPOINT event is written
- Checkpoints store: execution_id, step_seq completed, timestamp, row counts so far
- On failure, checkpoint data shown in execution detail so user knows how far it got
- Resume from checkpoint: shown to user so they can manually resume from correct step in re-run

### 6.4 Row Count Validation Steps
After every INSERT/MERGE/UPDATE step, optional validation:
```sql
SELECT COUNT(*) AS actual_count FROM {staging_or_target}
WHERE _etl_exec_id = '{exec_id}';
-- Platform compares against expected_count; ABORT if mismatch > threshold
```
- Validation threshold: abort if actual rows < expected × (1 - tolerance%)
- Default tolerance: 0%
- Skip validation: can be turned off for large tables where COUNT is expensive

---

## 7. Database-Specific SQL Dialects

### 7.1 Dialect Registry
Each supported DB has a **Dialect Module** in the InDB Engine:

| Dialect Module | Key Differences Handled |
|---|---|
| `PostgreSQLDialect` | MERGE (PG15+) vs INSERT ON CONFLICT; ILIKE; $$ quoting; SERIAL vs GENERATED ALWAYS AS IDENTITY; RETURNING clause; ::cast syntax |
| `SQLServerDialect` | MERGE WITH (HOLDLOCK); GETDATE(); TOP vs LIMIT; ISNULL; T-SQL #temp tables; OUTPUT clause; IDENTITY; NOLOCK hints; DATEADD/DATEDIFF |
| `OracleDialect` | MERGE differences; SYSDATE; NVL; ROWNUM vs FETCH FIRST; SEQUENCE.NEXTVAL; VARCHAR2; CLOB; DUAL; CONNECT BY; TO_DATE/TO_CHAR |
| `TeradataDialect` | VOLATILE TABLE; SEL vs SELECT; DATEFORM; COLLECT STATS; AMP distribution; PRIMARY INDEX; MULTISET vs SET tables |
| `SnowflakeDialect` | MERGE; CLONE; VARIANT/OBJECT/ARRAY types; TIME_TRAVEL; IDENTIFIER() quoting; NVL; ZEROIFNULL |
| `BigQueryDialect` | MERGE; Scripting (DECLARE/SET); backtick identifiers; STRUCT/ARRAY; PROJECT.DATASET.TABLE notation |
| `RedshiftDialect` | MERGE; CREATE TABLE AS; SORTKEY/DISTKEY; LISTAGG; NVL; GETDATE |

### 7.2 Type Mapping Table (Cross-DB)
| Platform Type | PostgreSQL | SQL Server | Oracle | Teradata |
|---|---|---|---|---|
| STRING | VARCHAR / TEXT | NVARCHAR | VARCHAR2 | VARCHAR |
| INTEGER | INTEGER | INT | NUMBER(10) | INTEGER |
| LONG | BIGINT | BIGINT | NUMBER(19) | BIGINT |
| DECIMAL(p,s) | NUMERIC(p,s) | DECIMAL(p,s) | NUMBER(p,s) | DECIMAL(p,s) |
| BOOLEAN | BOOLEAN | BIT | NUMBER(1) | BYTEINT |
| DATE | DATE | DATE | DATE | DATE |
| TIMESTAMP | TIMESTAMP | DATETIME2 | TIMESTAMP | TIMESTAMP |
| TIMESTAMP_TZ | TIMESTAMPTZ | DATETIMEOFFSET | TIMESTAMP WITH TIME ZONE | TIMESTAMP WITH TIME ZONE |
| JSON | JSONB | NVARCHAR(MAX) | CLOB | JSON |
| UUID | UUID | UNIQUEIDENTIFIER | RAW(16) | CHAR(36) |
| BINARY | BYTEA | VARBINARY | RAW / BLOB | BYTE |

### 7.3 Function Translation Table
| Platform Function | PostgreSQL | SQL Server | Oracle | Teradata |
|---|---|---|---|---|
| `CURRENT_TIMESTAMP` | `CURRENT_TIMESTAMP` | `GETDATE()` | `SYSDATE` | `CURRENT_TIMESTAMP` |
| `COALESCE(a,b)` | `COALESCE(a,b)` | `ISNULL(a,b)` | `NVL(a,b)` | `COALESCE(a,b)` |
| `STRING_AGG(x,sep)` | `STRING_AGG(x,sep)` | `STRING_AGG(x,sep)` | `LISTAGG(x,sep)` | `XMLAGG(...)` |
| `LIMIT N` | `LIMIT N` | `TOP N` | `FETCH FIRST N ROWS ONLY` | `TOP N` |
| `DATE_TRUNC('month',d)` | `DATE_TRUNC('month',d)` | `DATETRUNC(month,d)` | `TRUNC(d,'MM')` | `TRUNC(d,'MM')` |
| `EXTRACT(year FROM d)` | `EXTRACT(year FROM d)` | `YEAR(d)` | `EXTRACT(YEAR FROM d)` | `EXTRACT(YEAR FROM d)` |
| `MD5(str)` | `MD5(str)` | `HASHBYTES('MD5',str)` | `DBMS_CRYPTO.HASH(...)` | `HASHBYTES(str,1)` |

---

## 8. Transaction & Error Management

### 8.1 Transaction Strategies

| Strategy | Description | Default For |
|---|---|---|
| SINGLE_TRANSACTION | All steps in one BEGIN...COMMIT | Snowflake, short pipelines |
| STEP_TRANSACTIONS | Each step in its own transaction | Teradata |
| SAVEPOINT_CHAIN | One outer transaction; SAVEPOINT after each step | PostgreSQL, MSSQL, Oracle |
| AUTOCOMMIT_WITH_COMPENSATION | No transaction; failed step triggers compensating DELETE | NoSQL / forced override |

### 8.2 Error Handling Per Step
| Policy | Action |
|---|---|
| ABORT | Stop execution; rollback transaction; mark FAILED |
| SKIP_AND_CONTINUE | Skip failed step; continue; note in log |
| RETRY_N_TIMES | Retry up to N times with configurable delay |
| ROUTE_TO_ERROR_TABLE | Capture failed rows into error table; continue with valid rows |
| ALERT_AND_WAIT | Send alert; pause execution; wait for manual RESUME or CANCEL |

### 8.3 Error Table for Row-Level Failures
```sql
CREATE TABLE {staging_schema}.etl_errors_{exec_id_short} (
    _etl_exec_id        VARCHAR(36),
    _etl_step_seq       INTEGER,
    _etl_step_name      VARCHAR(255),
    _etl_error_code     VARCHAR(100),
    _etl_error_msg      TEXT,
    _etl_source_row     JSONB,
    _etl_occurred_at    TIMESTAMP
);
```

### 8.4 Deadlock & Lock Timeout Handling
- SQL Server: MERGE WITH (HOLDLOCK) to prevent phantom read issues
- All DBs: configurable lock wait timeout per connection (default: 30s)
- On deadlock: automatic retry up to 3 times with jittered delay (1s, 2s, 4s)
- On lock timeout: mark step as FAILED with error category `LOCK_TIMEOUT`

---

## 9. Rollback & Recovery

### 9.1 Rollback Types

| Rollback Type | Mechanism |
|---|---|
| Transaction Rollback | DB-native ROLLBACK |
| Savepoint Rollback | ROLLBACK TO SAVEPOINT |
| Compensating Rollback | Platform executes pre-generated compensating SQL |
| Staging-Only Rollback | DROP staging tables only; target untouched |

### 9.2 Compensating SQL Generation
For each data-modifying step, the engine pre-generates a compensating statement:
| Step | Compensating SQL |
|---|---|
| INSERT INTO target | DELETE FROM target WHERE _etl_exec_id = '{exec_id}' |
| UPDATE target | UPDATE target SET ... (restore from snapshot in staging) |
| SCD2 expire rows | UPDATE target SET is_current=TRUE, effective_end_date=NULL WHERE... |
| SCD2 insert new rows | DELETE FROM target WHERE _etl_exec_id = '{exec_id}' |

Compensating SQL stored in `indb_execution_steps.rollback_sql` and in execution artifacts.

### 9.3 Rollback Trigger Points
- Automatic: on any step with `on_error = ABORT`
- Manual: user clicks "Rollback" on a FAILED or PAUSED execution
- Time-limit: configurable max execution time; auto-abort + rollback if exceeded

---

## 10. Code Generation Output & Review

### 10.1 Generated Artifact Set
| Artifact | Description |
|---|---|
| `execution_plan.json` | Full ordered step list with metadata |
| `generated.sql` | All SQL statements in execution order, commented |
| `staging_ddl.sql` | All CREATE TABLE statements for staging tables |
| `rollback.sql` | All compensating SQL statements |
| `validate.sql` | All row count validation queries |
| `type_mappings.json` | Column type mapping used for this execution |
| `dialect.txt` | Which dialect was used and version |

### 10.2 SQL Review Mode (Pre-Execution)
- "Review Generated SQL" panel — shows full execution plan
- Step-by-step view: each step with SQL, estimated rows, step type
- "Copy All" and "Download as .sql" buttons
- Syntax highlighting with DB-specific keywords
- **Dry Run** mode: run all steps with EXPLAIN instead of actual execution (no data modified)
  - PostgreSQL: `EXPLAIN (ANALYZE FALSE, FORMAT JSON)`
  - SQL Server: `SET SHOWPLAN_XML ON`
  - Oracle: `EXPLAIN PLAN FOR ...`
  - Teradata: `EXPLAIN ...`
- "Approve and Execute" button

### 10.3 Diff vs Previous Execution
- "Diff SQL" button: side-by-side diff of generated SQL vs previous execution's SQL
- Highlights: new CTEs added, changed WHERE clauses, new columns, changed join conditions

---

## 11. API Connector Service

### 11.1 Supported API Types

| Connector Type | Read | Write | Schema Inference | Auth |
|---|---|---|---|---|
| REST API (JSON) | ✓ | ✓ | ✓ (sample-based) | All types |
| REST API (XML response) | ✓ | ✓ | ✓ | All types |
| REST API (CSV response) | ✓ | ✗ | ✓ | All types |
| SOAP / WSDL | ✓ | ✓ | ✓ (from WSDL) | Basic/WS-Security |
| GraphQL | ✓ | ✓ (mutations) | ✓ (introspection) | All types |
| OData v2/v4 | ✓ | ✓ | ✓ (service metadata) | All types |
| JSON-RPC | ✓ | ✓ | Partial | API Key/Basic |
| Webhooks (inbound) | ✓ (receive) | ✗ | ✓ (from payload) | HMAC/Basic |
| gRPC | ✓ | ✓ | ✓ (Protobuf) | mTLS/Token |

---

## 12. REST API Connector

### 12.1 Connection Configuration
| Field | Description |
|---|---|
| Base URL | e.g., `https://api.example.com/v2` |
| Default Headers | Key-value pairs added to every request |
| Default Query Params | Added to every request |
| SSL/TLS | Verify cert (ON by default) / custom CA cert upload |
| Request Timeout | Seconds (default: 30) |
| Authentication | See Section 19 |
| Environment-Specific Override | Different base URL / creds per DEV/QA/PROD |

### 12.2 Endpoint Configuration (Source)
| Field | Description |
|---|---|
| HTTP Method | GET (source) |
| Endpoint Path | e.g., `/customers` or `/customers/{customer_id}` |
| Path Parameters | Key-value map; can reference pipeline parameters |
| Query Parameters | Static or expression-based |
| Response Format | JSON / XML / CSV / TSV |
| Response Root Path | JSONPath / XPath to array of records (e.g., `$.data`) |
| Pagination | See Section 12.4 |
| Rate Limit | See Section 18 |

### 12.3 Endpoint Configuration (Target)
| Field | Description |
|---|---|
| HTTP Method | POST / PUT / PATCH / DELETE |
| Endpoint Path | Static or parameterized |
| Body Template | Jinja2 mapping from pipeline columns to request body |
| Batch Mode | Send N records per request |
| Response Field Capture | Extract response body field as output column |
| Idempotency Key | Header for idempotent POST |
| On Error Response | FAIL / RETRY / SKIP / LOG |

### 12.4 Pagination Strategies
| Strategy | Mechanism |
|---|---|
| Page Number | `?page=N&pageSize=100` |
| Offset / Limit | `?offset=N&limit=100` |
| Cursor-Based | `?cursor={next_cursor}` |
| Link Header (RFC 5988) | Parse `Link: <url>; rel="next"` header |
| Next URL in Body | JSONPath to next URL in response body |
| Token-Based | `?pageToken={token}` |
| Keyset / Seek | `?after_id={last_id}` |
| None (single response) | No pagination (default) |

Pagination Safety: Max pages configurable (default: 10,000). Circuit breaker: stop if N consecutive pages return 0 records.

### 12.5 Batch Write Mode
- Batch size: configurable (default: 100 records per request)
- Batch formats: JSON array / NDJSON / CSV with headers / XML
- Per-row success/failure parsing; failures routed to error log
- Sequential vs parallel batches with concurrency limit

### 12.6 Request Body Templating
```json
{
  "customer_id": "{{row.customer_id}}",
  "profile": {
    "name": "{{row.full_name}}",
    "email": "{{row.email | lower}}",
    "registered_at": "{{row.created_at | isoformat}}"
  },
  "metadata": {
    "source": "ETL",
    "batch_id": "{{pipeline.execution_id}}"
  }
}
```
Available filters: `lower`, `upper`, `trim`, `isoformat`, `jsonencode`, `urlencode`, `base64`

### 12.7 API Source Incremental Load
- Watermark-based: send `?updated_since={last_run_timestamp}`
- ETag-based: use conditional GET headers (`If-None-Match`)
- Platform stores watermark per connection+endpoint in `api_connector_state`
- Watermark updated after successful execution only

---

## 13. SOAP / WSDL Connector

### 13.1 Connection Configuration
| Field | Description |
|---|---|
| WSDL URL | URL to the WSDL document |
| WSDL Upload | Alternatively, upload WSDL file directly |
| Service Name | From WSDL |
| Port Name | From WSDL (binding) |
| Endpoint URL Override | Override the URL defined in WSDL |
| SOAP Version | 1.1 / 1.2 (auto-detected from WSDL) |
| Authentication | Basic / WS-Security UsernameToken / Certificate |
| SSL Certificate | Client certificate for mutual TLS |

### 13.2 WSDL Parsing
- Platform fetches and parses WSDL on connection creation
- Extracts: service, port, operations, input/output message types, complex types
- All operations listed in metadata tree: Connection → Service → Operations
- Each operation shows: input schema, output schema, fault schema
- WSDL cached; "Refresh WSDL" option in connection settings

### 13.3 Operation Configuration
| Field | Description |
|---|---|
| Operation | Select from parsed WSDL operations |
| Input Mapping | Map pipeline columns to SOAP request elements |
| Output Mapping | Map SOAP response elements to pipeline columns |
| SOAP Headers | Custom SOAP header elements |
| Response Array Path | XPath to repeating result elements |

### 13.4 SOAP Request Builder UI
- Visual form built from WSDL schema (not raw XML editing)
- Required fields marked; optional fields collapsible
- Preview generated SOAP XML envelope
- "Test Operation" button: sends live request, shows raw response

### 13.5 SOAP Fault Handling
- FaultCode and FaultString extracted and shown in execution error detail
- Configurable: ABORT / SKIP / RETRY on SOAP fault

---

## 14. GraphQL Connector

### 14.1 Connection Configuration
| Field | Description |
|---|---|
| Endpoint URL | GraphQL endpoint |
| Introspection Enabled | Auto-fetch schema via introspection query |
| Schema File Upload | Alternative if introspection disabled |
| Authentication | See Section 19 |

### 14.2 Schema Discovery via Introspection
- Platform sends standard introspection query
- Parses and stores type definitions in metadata catalog
- Types listed in hierarchy: Connection → Types → Fields

### 14.3 Query Configuration (Source)
| Field | Description |
|---|---|
| Query / Document | Full GraphQL query (Monaco editor with GQL syntax highlighting) |
| Variables | JSON map of variables (static or expression-based) |
| Data Path | JSONPath to data array in response |
| Pagination | Relay Cursor Connections spec or custom |

### 14.4 Mutation Configuration (Target)
| Field | Description |
|---|---|
| Mutation Document | Full GraphQL mutation text |
| Variable Mapping | Map pipeline row columns to mutation variables |
| Response Field Capture | Extract fields from mutation response |
| Batch via Aliases | Auto-generate batched mutations using GraphQL aliases |

### 14.5 Subscription Support (Streaming Source)
- Connects to GraphQL subscription over WebSocket
- Receives events; each event is a pipeline row
- Used for streaming/CDC ingestion pipelines

---

## 15. OData Connector

### 15.1 Connection Configuration
| Field | Description |
|---|---|
| Service Root URL | e.g., `https://services.odata.org/V4/Northwind/` |
| OData Version | V2 / V4 (auto-detected from `$metadata`) |
| CSRF Token | Required by SAP NetWeaver OData; auto-fetch via GET $metadata |

### 15.2 Metadata Discovery
- Platform fetches `{service_root}/$metadata` to get EDMX
- Parses entity types, entity sets, navigation properties, function imports
- Entity sets shown in hierarchy tree as tables; properties shown as columns

### 15.3 Query Configuration
| Feature | Mechanism |
|---|---|
| $select | Choose columns to return |
| $filter | OData filter expression builder (visual + manual) |
| $expand | Navigate to related entities (inline expand) |
| Server-Driven Paging | Follow `@odata.nextLink` automatically |
| Delta / Change Tracking | Follow `@odata.deltaLink` for incremental loads |

### 15.4 Write Configuration
- Create entity: POST to entity set
- Update entity: PATCH / PUT by key
- Delete entity: DELETE by key
- Batch operations: OData $batch endpoint (RFC 2046 multipart)
- ETag-based optimistic concurrency: `If-Match` on updates

---

## 16. Webhook Ingest Connector

### 16.1 Platform-Hosted Webhook Endpoint
- Platform exposes unique, authenticated webhook URL per connector:
  `POST https://etl.platform.host/api/v1/webhooks/{webhook_id}/ingest`
- URL shown in connector settings for user to register with the external system

### 16.2 Webhook Authentication
- HMAC-SHA256 signature validation (header: `X-Signature-256`)
- Basic Auth / Bearer Token
- IP Allowlist: restrict inbound calls to specific IP ranges
- All authentication methods combinable

### 16.3 Webhook Processing Modes
| Mode | Description |
|---|---|
| BUFFER_AND_BATCH | Buffer events; trigger pipeline on schedule or when N events accumulated |
| REAL_TIME | Trigger pipeline execution immediately per event |
| STREAM_TO_QUEUE | Write raw payloads to internal queue; pipeline reads from queue |

### 16.4 Payload Schema
- Auto-infer schema from first N received payloads
- Schema stored and versioned per webhook connector
- Schema evolution detection: new fields / type changes on new payloads

---

## 17. API Metadata & Schema Inference

### 17.1 Schema Inference Sources
| API Type | Schema Source |
|---|---|
| REST JSON | Sample response analysis |
| REST XML | XML schema inference |
| SOAP | WSDL XSD types (exact schema) |
| GraphQL | Introspection query (exact schema) |
| OData | EDMX metadata document (exact schema) |
| gRPC | Protobuf definition file (.proto) |
| Webhook | Sampled payload inference |

### 17.2 API Endpoints in Metadata Tree
```
API Connectors (Technology Group)
  └── REST API (Technology)
        └── Salesforce CRM Connection (Connection)
              └── v58.0 (API Version)
                    ├── Accounts Endpoint → Fields: Id, Name, Industry, ...
                    ├── Contacts Endpoint
                    └── Opportunities Endpoint
```

### 17.3 Schema Review & Edit
After inference, user sees schema table: column names, types, nullable — all editable before saving. Nested objects: flatten or keep as struct. Arrays: explode into rows or keep as array column.

---

## 18. API Rate Limiting & Resilience

### 18.1 Rate Limit Configuration
| Setting | Default |
|---|---|
| Requests per second | 10 |
| Requests per minute | 500 |
| Requests per hour | 10,000 |
| Max concurrent requests | 5 |

### 18.2 Rate Limit Detection
- Detect `429 Too Many Requests`
- Parse `Retry-After` header; parse `X-RateLimit-Remaining` / `X-RateLimit-Reset` headers
- Auto-backoff: on 429, wait `Retry-After` seconds (default 60s if not provided), then resume

### 18.3 Retry Policy
| Setting | Default |
|---|---|
| Max retries | 3 |
| Retry on status codes | 429, 500, 502, 503, 504, 408 |
| Initial backoff | 1s |
| Backoff strategy | EXPONENTIAL_JITTER |
| Max backoff | 120s |

### 18.4 Circuit Breaker
- After N consecutive failures (default: 5), open circuit for 60s
- Half-open: one probe request; success → close; failure → remain open
- Circuit breaker state visible in connection health indicator in tree

---

## 19. API Authentication Methods

### 19.1 Supported Methods

| Method | Implementation |
|---|---|
| No Auth | Anonymous requests |
| API Key | Header / Query param / Custom header name |
| Basic Auth | `Authorization: Basic base64(user:pass)` |
| Bearer Token (Static) | `Authorization: Bearer {token}` |
| OAuth 2.0 — Client Credentials | Fetch token from token URL; auto-refresh on expiry |
| OAuth 2.0 — Authorization Code | Redirect flow; store refresh token |
| OAuth 2.0 — Password Grant | Username + password → token |
| JWT (Self-Signed) | Platform signs JWT with private key |
| HMAC Signature | Sign request body/headers with shared secret |
| AWS Signature V4 | For AWS services (API Gateway, DynamoDB, etc.) |
| Digest Auth | HTTP Digest Authentication |
| NTLM / Kerberos | Windows/AD-authenticated services |
| Mutual TLS (mTLS) | Client certificate authentication |
| WS-Security | UsernameToken / X.509 for SOAP |
| Custom Script | User provides Python snippet to compute auth headers dynamically |

### 19.2 OAuth 2.0 Token Management
- Token stored encrypted in `api_connector_tokens` table
- Auto-refresh: platform refreshes token when < 60s remaining
- Token rotation: handle new refresh token on each refresh cycle correctly
- Scopes configurable per connection

### 19.3 Credential Security
- All secrets encrypted at rest using AES-256 with per-tenant key
- Secrets never returned to frontend (masked in UI as `••••••`)
- Audit log: every connection test, sync, and execution that uses a credential

### 19.4 Environment-Specific Credentials
Each connection has separate DEV / QA / STAGING / PROD credentials. Platform auto-selects based on pipeline execution environment.

---

## 20. Data Model

```sql
-- InDB execution plan
CREATE TABLE indb_execution_plans (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id            UUID NOT NULL REFERENCES executions(id),
    dialect                 VARCHAR(100) NOT NULL,
    db_version              VARCHAR(100),
    total_steps             INTEGER NOT NULL,
    transaction_strategy    VARCHAR(50) NOT NULL,
    staging_schema          VARCHAR(255),
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_sql           TEXT NOT NULL,
    execution_plan_json     JSONB NOT NULL
);

-- InDB execution steps (progress tracking)
CREATE TABLE indb_execution_steps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id        UUID NOT NULL REFERENCES executions(id),
    step_seq            INTEGER NOT NULL,
    step_name           VARCHAR(255) NOT NULL,
    step_type           VARCHAR(50) NOT NULL,
    sql_text            TEXT NOT NULL,
    rollback_sql        TEXT,
    status              VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    started_at          TIMESTAMPTZ,
    ended_at            TIMESTAMPTZ,
    duration_ms         BIGINT,
    rows_affected       BIGINT,
    error_message       TEXT,
    db_query_id         VARCHAR(500),
    db_session_id       VARCHAR(500),
    estimated_rows      BIGINT,
    actual_rows         BIGINT,
    bytes_processed     BIGINT,
    is_staging_step     BOOLEAN NOT NULL DEFAULT FALSE,
    staging_table_name  VARCHAR(500),
    UNIQUE(execution_id, step_seq)
);

-- Staging table registry
CREATE TABLE indb_staging_tables (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id        UUID NOT NULL REFERENCES executions(id),
    step_id             UUID REFERENCES indb_execution_steps(id),
    table_name          VARCHAR(500) NOT NULL,
    schema_name         VARCHAR(255) NOT NULL,
    connection_id       UUID NOT NULL REFERENCES connections(id),
    purpose             VARCHAR(255),
    ddl                 TEXT NOT NULL,
    row_count           BIGINT,
    size_bytes          BIGINT,
    created_at          TIMESTAMPTZ,
    dropped_at          TIMESTAMPTZ,
    is_dropped          BOOLEAN NOT NULL DEFAULT FALSE,
    keep_on_failure     BOOLEAN NOT NULL DEFAULT FALSE
);

-- InDB dialect config per connection
CREATE TABLE indb_dialect_config (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id           UUID NOT NULL REFERENCES connections(id) UNIQUE,
    dialect                 VARCHAR(100) NOT NULL,
    db_version              VARCHAR(100),
    staging_schema          VARCHAR(255) NOT NULL DEFAULT 'etl_staging',
    transaction_strategy    VARCHAR(50) NOT NULL,
    keep_staging_on_failure BOOLEAN NOT NULL DEFAULT FALSE,
    max_cte_depth           INTEGER DEFAULT 50,
    lock_wait_timeout_secs  INTEGER DEFAULT 30,
    custom_dialect_hints    JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API Connectors
CREATE TABLE api_connectors (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id           UUID NOT NULL REFERENCES connections(id),
    api_type                VARCHAR(50) NOT NULL,
    base_url                VARCHAR(2000) NOT NULL,
    default_headers         JSONB,
    default_params          JSONB,
    ssl_verify              BOOLEAN NOT NULL DEFAULT TRUE,
    custom_ca_cert          TEXT,
    proxy_url               VARCHAR(500),
    request_timeout_secs    INTEGER NOT NULL DEFAULT 30,
    connection_timeout_secs INTEGER NOT NULL DEFAULT 10,
    auth_type               VARCHAR(100) NOT NULL,
    auth_config             JSONB,                    -- Encrypted
    rate_limit_rps          NUMERIC,
    rate_limit_rpm          INTEGER,
    rate_limit_rph          INTEGER,
    max_concurrent          INTEGER DEFAULT 5,
    retry_max               INTEGER DEFAULT 3,
    retry_backoff_strategy  VARCHAR(50) DEFAULT 'EXPONENTIAL_JITTER',
    retry_max_wait_secs     INTEGER DEFAULT 120,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API Endpoints (metadata catalog)
CREATE TABLE api_endpoints (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id            UUID NOT NULL REFERENCES api_connectors(id),
    endpoint_path           VARCHAR(2000) NOT NULL,
    http_method             VARCHAR(10) NOT NULL,
    display_name            VARCHAR(255),
    description             TEXT,
    inferred_schema         JSONB,
    schema_source           VARCHAR(50),
    response_root_path      VARCHAR(500),
    pagination_type         VARCHAR(50),
    pagination_config       JSONB,
    incremental_config      JSONB,
    tags                    TEXT[],
    last_sampled_at         TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API connector state (watermarks, etags, cursors)
CREATE TABLE api_connector_state (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id            UUID NOT NULL REFERENCES api_connectors(id),
    endpoint_id             UUID REFERENCES api_endpoints(id),
    state_key               VARCHAR(255) NOT NULL,
    state_value             TEXT,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(connector_id, endpoint_id, state_key)
);

-- API OAuth tokens (encrypted)
CREATE TABLE api_connector_tokens (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id            UUID NOT NULL REFERENCES api_connectors(id),
    environment             VARCHAR(50) NOT NULL,
    access_token            TEXT NOT NULL,            -- Encrypted
    refresh_token           TEXT,                     -- Encrypted
    token_type              VARCHAR(50),
    expires_at              TIMESTAMPTZ,
    scope                   TEXT,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(connector_id, environment)
);

-- Webhook connector config
CREATE TABLE webhook_connectors (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id            UUID NOT NULL REFERENCES api_connectors(id),
    webhook_id              UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    ingest_url              VARCHAR(2000) NOT NULL,
    auth_type               VARCHAR(50) NOT NULL,
    hmac_secret             TEXT,                     -- Encrypted
    ip_allowlist            INET[],
    processing_mode         VARCHAR(50) NOT NULL DEFAULT 'BUFFER_AND_BATCH',
    buffer_max_events       INTEGER DEFAULT 1000,
    buffer_flush_interval   INTEGER DEFAULT 60,
    payload_schema          JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_indb_steps_execution ON indb_execution_steps(execution_id, step_seq);
CREATE INDEX idx_staging_tables_execution ON indb_staging_tables(execution_id);
CREATE INDEX idx_staging_not_dropped ON indb_staging_tables(is_dropped, created_at) WHERE NOT is_dropped;
CREATE INDEX idx_api_endpoints_connector ON api_endpoints(connector_id);
CREATE INDEX idx_connector_state_lookup ON api_connector_state(connector_id, endpoint_id, state_key);
```

---

## 21. API Contracts

```
-- InDB Engine APIs
GET    /api/v1/executions/:id/indb-plan              Get execution plan
GET    /api/v1/executions/:id/indb-steps             List all steps with status
GET    /api/v1/executions/:id/indb-steps/:stepId     Single step detail
POST   /api/v1/pipelines/:id/generate-sql            Generate SQL without executing
POST   /api/v1/pipelines/:id/explain                 Run EXPLAIN on generated SQL
GET    /api/v1/executions/:id/staging-tables         List staging tables
POST   /api/v1/executions/:id/rollback               Trigger compensating rollback
POST   /api/v1/executions/:id/cleanup-staging        Manually drop staging tables
GET    /api/v1/connections/:id/indb-config           Get InDB config
PUT    /api/v1/connections/:id/indb-config           Update InDB config
GET    /api/v1/pipelines/:id/pushdown-eligibility    Check pushdown eligibility

-- API Connector APIs
POST   /api/v1/api-connectors                        Create API connector
GET    /api/v1/api-connectors/:id                    Get connector
PUT    /api/v1/api-connectors/:id                    Update connector
DELETE /api/v1/api-connectors/:id                    Delete connector
POST   /api/v1/api-connectors/:id/test               Test connectivity
POST   /api/v1/api-connectors/:id/refresh-schema     Re-infer schema
POST   /api/v1/api-connectors/:id/oauth/authorize    Start OAuth flow
POST   /api/v1/api-connectors/:id/oauth/callback     OAuth callback
POST   /api/v1/api-connectors/:id/oauth/refresh      Manually refresh token

-- API Endpoint APIs
GET    /api/v1/api-connectors/:id/endpoints          List endpoints
POST   /api/v1/api-connectors/:id/endpoints          Create endpoint
PUT    /api/v1/api-endpoints/:id                     Update endpoint
POST   /api/v1/api-endpoints/:id/preview             Preview endpoint data
POST   /api/v1/api-endpoints/:id/infer-schema        Re-infer schema from live call
POST   /api/v1/api-connectors/:id/import-openapi     Import from OpenAPI spec
POST   /api/v1/api-connectors/:id/import-wsdl        Import from WSDL
POST   /api/v1/api-connectors/:id/graphql-introspect  GraphQL introspection

-- Webhook APIs
POST   /api/v1/webhook-connectors                    Create webhook connector
POST   /api/v1/webhooks/:webhookId/ingest            Inbound webhook receive endpoint
GET    /api/v1/webhook-connectors/:id/events         List buffered events
DELETE /api/v1/webhook-connectors/:id/events         Clear buffer
```

---

## 22. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **InDB — SQL Generation** | SQL generation for 20-node pipeline completes in < 2s |
| **InDB — Dialect Accuracy** | Generated SQL passes DB-native syntax validation with 0 errors |
| **InDB — SCD Correctness** | SCD2 is idempotent: running twice on same data produces identical result |
| **InDB — Transaction Safety** | No partial writes on failure; all target tables consistent after rollback |
| **InDB — Staging Cleanup** | Orphaned staging tables cleaned within 1 hour of detection |
| **InDB — Progress Latency** | Step progress updates visible in UI within 3s of DB state change |
| **API — Request Overhead** | Platform overhead (excluding API response time): < 100ms per request |
| **API — Throughput** | 1000 API rows/sec processing throughput (platform side) |
| **API — Auth Refresh** | OAuth token refresh completes in < 500ms; no request dropped due to expiry |
| **API — Rate Limit** | Platform rate limiter enforces configured limits with < 5% overshoot |
| **API — Schema Inference** | REST JSON schema inferred from 100 sample records in < 5s |
| **Scalability** | 100 concurrent InDB executions across 10 connections without resource contention |
| **Security** | API credentials never appear in logs, error messages, or API responses |
| **Reliability** | Staging cleanup never removes tables for RUNNING executions |

---

## 23. Acceptance Criteria

| Feature | Acceptance Criteria |
|---|---|
| Pushdown Eligibility | 100% accuracy on eligible/ineligible classification for all 10 supported DB types |
| CTE Collapsing | Linear pipeline generates single SQL with CTEs; no staging table created |
| SCD1 — All 4 DBs | MERGE-based SCD1 generates valid, executable SQL for PG/MSSQL/Oracle/Teradata; change detection works |
| SCD2 — 8-Step Plan | Executes correctly; expired rows get end-date; new rows get new SK; run is idempotent |
| SCD3 — All 4 DBs | current/previous column UPDATE generates correctly for all dialects |
| Mixed SCD Columns | Single table with SCD1+SCD2+SCD3 columns generates one combined MERGE statement |
| Staging Lifecycle | Staging tables created, populated, used, and dropped within single execution; no orphans after success |
| Orphan Cleanup | Orphaned tables (FAILED + keep=false) cleaned within 30 min by background job |
| Progress Tracking | Every step status update visible in UI within 3s; cancel stops at next step boundary |
| Rollback | Transaction rollback on ABORT leaves all target tables in pre-execution state |
| Privilege Check | Missing privileges reported with exact remediation SQL before execution starts |
| Dry Run | EXPLAIN mode shows query plan per step; zero rows affected |
| REST Connector | All 8 pagination strategies work; incremental watermark updates after success only |
| SOAP Connector | WSDL parsing extracts all operations; test call succeeds; fault handling works |
| GraphQL Connector | Introspection builds complete type schema; mutation captures response fields |
| OData Connector | EDMX parsed; $filter/$select/$expand work; server-driven paging followed to completion |
| Webhook Connector | Inbound POST accepted, HMAC-authenticated, buffered, triggers pipeline on schedule |
| OAuth 2.0 | Client credentials flow; auto-refresh before expiry; token never exposed in logs |
| Rate Limiting | 429 triggers backoff; Retry-After honored; pipeline continues after wait |
| API Schema Inference | REST JSON schema inferred correctly for flat, nested, and array-containing responses |

---

*Document Version: 1.0 | Created: 2026-03 | Owner: ETL Platform Team*
