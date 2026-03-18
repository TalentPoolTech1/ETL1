# ETL1 Platform — Code Generation Engine Audit Report
## Against the ETL Decision Matrix Framework

**Date:** 2026-03-08  
**Scope:** `Backend/src/codegen/` and `Frontend/src/transformations/` and `Frontend/src/registry/`  
**Framework:** ETL Execution Decision Matrix (Source/Target/Transform/Preference axes)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented and correct |
| ⚠️ | Partially implemented or has gaps |
| ❌ | Not implemented |
| 🚨 | Design gap / risk |
| 📝 | Notes / caveats |

---

## DIMENSION 1 — Source Type Coverage

The framework defines three source axes: **DB, File, Object Storage**.

### 1.1 Source Generators Registered in PySparkEngine

| Source Type | Generator Class | Status | Notes |
|-------------|----------------|--------|-------|
| JDBC (DB) | `PySparkJdbcSourceGenerator` | ✅ | Full: URL, driver inference, partition parallelism, query pushdown, secrets backends |
| File (CSV/Parquet/JSON/ORC/Avro/Delta/Iceberg/Hudi) | `PySparkFileSourceGenerator` | ✅ | Full format support, schema inference, glob patterns |
| Kafka (Streaming) | `PySparkKafkaSourceGenerator` | ✅ | Streaming + batch offsets, schema registry, watermark |
| Delta Lake | `PySparkDeltaSourceGenerator` | ✅ | Time travel (version/timestamp), Change Data Feed |
| Hive | `PySparkHiveSourceGenerator` | ✅ | Partition filter, predicate pushdown |
| Iceberg | `PySparkIcebergSourceGenerator` | ✅ | Catalog/namespace/table, snapshot, changelog |
| S3 / ADLS / GCS / HDFS | Via `FileSourceGenerator` | ⚠️ | Handled as file path — no cloud-specific auth generator (IAM roles, managed identity, service accounts) |
| MongoDB | Type defined in `pipeline.types.ts` | ❌ | No generator registered — will throw `No generator registered for node type "source:mongodb"` |
| Cassandra | Type defined in `pipeline.types.ts` | ❌ | No generator registered — same runtime error |
| API (REST) | Type defined in `pipeline.types.ts` | ❌ | No generator registered |

**Gap:** MongoDB, Cassandra, and API source types are declared in the type system and will appear valid to the validator but will **crash at generation time** with an unhandled generator error.

---

## DIMENSION 2 — Target Type Coverage

The framework defines two target axes: **DB, File**.

### 2.1 Sink Generators Registered

| Sink Type | Generator Class | Status | Notes |
|-----------|----------------|--------|-------|
| JDBC (DB) | `PySparkJdbcSinkGenerator` | ✅ | All write modes, batch size, truncate, custom options |
| File (Parquet/CSV/JSON/Delta/etc.) | `PySparkFileSinkGenerator` | ✅ | All formats, partition-by, compression, repartition |
| Delta Lake | `PySparkDeltaSinkGenerator` | ✅ | MERGE INTO with key, Z-Order, optimizeWrite, autoCompact |
| Iceberg | `PySparkIcebergSinkGenerator` | ✅ | SQL MERGE, overwrite, saveAsTable |
| Hive | `PySparkHiveSinkGenerator` | ✅ | createIfNotExists, partition-by, file format |
| Kafka | `PySparkKafkaSinkGenerator` | ✅ | JSON serialization, key column, topic |
| Console (debug) | `PySparkConsoleSinkGenerator` | ✅ | show() + printSchema() with production warning |
| S3 / ADLS / GCS | Via `FileSinkGenerator` (path) | ⚠️ | No cloud-specific writer config (e.g. S3 encryption, ADLS managed identity) |

---

## DIMENSION 3 — Transformation Complexity Coverage

The framework defines three tiers: **Simple, Medium, Advanced**.

### 3.1 Simple Transformations

| Transform | Type | Generator | Status |
|-----------|------|-----------|--------|
| Filter | `filter` | `PySparkFilterGenerator` | ✅ |
| Projection (Select) | `select` | `PySparkSelectGenerator` | ✅ — includes expression aliases |
| Rename | `rename` | `PySparkRenameGenerator` | ✅ — chained `withColumnRenamed` |
| Cast | `cast` | `PySparkCastGenerator` | ✅ — full `DataType` mapping |
| Drop columns | `drop` | `PySparkDropGenerator` | ✅ |
| Derive (computed columns) | `derive` | `PySparkDeriveGenerator` | ✅ — `withColumn` + optional cast |
| Sort / Order By | `sort` | `PySparkSortGenerator` | ✅ — nulls first/last |
| Limit | `limit` | `PySparkLimitGenerator` | ✅ — emits production warning |
| Fill NA | `fillna` | `PySparkFillnaGenerator` | ✅ — global or per-column |
| Drop NA | `dropna` | `PySparkDropnaGenerator` | ✅ — any/all + subset |

**Simple verdict: ✅ Complete.**

### 3.2 Medium Transformations

| Transform | Type | Generator | Status |
|-----------|------|-----------|--------|
| Join (inner/left/right/full/semi/anti/cross) | `join` | `PySparkJoinGenerator` | ✅ — broadcast hint, skew hint, same-name column handling, duplicate key drop |
| Union / Union By Name | `union` | `PySparkUnionGenerator` | ✅ — chain of 2+ inputs, allowMissingColumns |
| Aggregate (groupBy + having) | `aggregate` | `PySparkAggregateGenerator` | ✅ — all `AggregateFunction` types including distinct count |
| Window (rank/lag/lead/running totals) | `window` | `PySparkWindowGenerator` | ✅ — rowsBetween/rangeBetween, all window functions |
| Rank | Via `window` with `row_number`/`rank`/`dense_rank` | ✅ | Rank is a window function — correctly implemented |
| Deduplication | `dedup` | `PySparkDedupGenerator` | ✅ — `dropDuplicates()` with optional subset |

**Medium verdict: ✅ Complete.**

### 3.3 Advanced Transformations

| Transform | Framework Requirement | Generator | Status |
|-----------|----------------------|-----------|--------|
| SCD Type 1 | Required | ❌ | **No `SCD Type 1` generator registered.** `TransformationType` does not include `scd_type1` |
| SCD Type 2 | Required | ❌ | **No `SCD Type 2` generator registered.** `TransformationType` does not include `scd_type2` |
| Surrogate Key | Required | ❌ | Not in `TransformationType` |
| CDC (Change Data Capture) | Required | ❌ | Not in `TransformationType`. Delta CDF is available at source level (`readChangeFeed`) but no CDC transformation node |
| Python UDF | `custom_udf` | `PySparkCustomUdfGenerator` | ✅ — inline Python UDF, Scala warning, SQL registration |
| ML (model scoring) | Required | ❌ | Not in `TransformationType` |
| Complex JSON parsing | `explode` + `flatten` | ✅ | `PySparkExplodeGenerator` + `PySparkFlattenGenerator` — covers most cases |
| Multi-Transform Sequence | `multi_transform_sequence` | `PySparkMultiTransformGenerator` | ✅ — fully implemented with step compilation |

**Advanced verdict: 🚨 Critical gaps — SCD Type 1, SCD Type 2, Surrogate Key, CDC, ML are missing entirely.**

### 3.4 Additional/Special Transformations (Beyond Framework)

| Transform | Generator | Status | Notes |
|-----------|-----------|--------|-------|
| Pivot | `PySparkPivotGenerator` | ✅ | With optional pivot values |
| Unpivot (stack) | `PySparkUnpivotGenerator` | ✅ | Via SQL `stack()` function |
| Data Quality | `PySparkDataQualityGenerator` | ✅ | fail/drop/warn/quarantine with rule types |
| Repartition / Coalesce | `PySparkRepartitionGenerator` | ✅ | Hash, range, coalesce strategies |
| Cache / Persist | `PySparkCacheGenerator` | ✅ | StorageLevel + eager materialization |
| Data Masking | `PySparkMaskGenerator` | ✅ | hash/truncate/null/replace/regex strategies |
| Sample | `PySparkSampleGenerator` | ✅ — with seed reproducibility warning |
| Lookup (broadcast join) | `PySparkLookupGenerator` | ✅ — slimmed lookup with defaults |
| Custom SQL | `PySparkCustomSqlGenerator` | ✅ — createOrReplaceTempView + spark.sql() |

---

## DIMENSION 4 — Execution Preference / Decision Engine

### 4.1 Framework Execution Decision Matrix — Audit

The framework defines a 5-axis decision table: Source + Target + Transformations + User Preference → Execution Mode.

| Framework Scenario | Framework Decision | Engine Behavior | Status |
|---|---|---|---|
| DB → Same DB, SQL-compatible, DB preference | SQL Pushdown | ❌ No SQL engine registered. Only `pyspark` and `scala-spark`. Engine throws `No code engine registered for technology "sql"` | 🚨 |
| DB → Same DB, SQL-compatible, Spark preference | PySpark | ✅ PySpark engine selected and generates correctly | ✅ |
| DB → Same DB, Non-SQL transforms, DB preference | Validation Error | ❌ No validation rejects this — validator only checks node config, not execution feasibility | 🚨 |
| DB → Different DB, Spark preference | PySpark | ✅ Both JDBC sources readable; PySpark joins them | ✅ |
| DB → Different DB, DB preference | Validation Error | ❌ No validation rejects heterogeneous sources with DB preference | 🚨 |
| File → DB, Simple, DB preference | Native DB Import / Stage+SQL | ❌ No staging pathway exists | 🚨 |
| File → DB, Medium, DB preference | Stage + SQL | ❌ Not implemented | 🚨 |
| File → DB, Advanced, DB preference | Validation Error | ❌ Not validated | 🚨 |
| File → DB, Any, Spark preference | PySpark | ✅ File source → JDBC sink generates correctly | ✅ |
| File → File, Any, DB preference | Validation Error | ❌ Not validated | 🚨 |
| File → File, Any, Spark preference | PySpark | ✅ | ✅ |
| DB + File → DB, Spark | PySpark | ✅ Both sources generate; joined by PySpark | ✅ |
| DB + File → File, Spark | PySpark | ✅ | ✅ |

**Critical finding:** The validator (`PipelineValidator`) validates **structural** integrity only (node IDs, required config fields, DAG cycles). It has **zero knowledge** of:
- Execution mode vs. source/target feasibility
- Whether sources are heterogeneous
- Whether chosen transforms are SQL-compatible
- Whether SCD is being applied to a file target
- Whether DB execution is requested with a file source

---

## SECTION 5 — Source/Target Compatibility Matrix Validation

### 5.1 Framework Transformation Combination Scenarios (T1–T15)

| ID | Chain | Source | Target | Mode | Expected | Actual | Status |
|----|-------|--------|--------|------|----------|--------|--------|
| T1 | Filter | DB | DB | DB | SQL | ❌ No SQL engine | 🚨 |
| T2 | Filter → Join | DB | DB | DB | SQL | ❌ No SQL engine | 🚨 |
| T3 | Filter → Join → Aggregate | DB | DB | DB | SQL | ❌ No SQL engine | 🚨 |
| T4 | Filter → Join → Aggregate → Rank | DB | DB | DB | SQL | ❌ No SQL engine | 🚨 |
| T5 | Filter → Join → Aggregate → Rank → SCD1 | DB | DB | DB | SQL | ❌ No SCD generator | 🚨 |
| T6 | Filter → Join → Aggregate → Rank → SCD2 | DB | DB | DB | SQL | ❌ No SCD generator | 🚨 |
| T7 | Filter → Join → Aggregate | DB | DB | Spark | PySpark | ✅ Generates correct PySpark | ✅ |
| T8 | Filter → Join → Aggregate → Rank | DB+DB | DB | Spark | PySpark | ✅ Two JDBC sources, joined | ✅ |
| T9 | Filter → Join → Aggregate | File+DB | DB | Spark | PySpark | ✅ File + JDBC → JDBC sink | ✅ |
| T10 | Filter → Join → Aggregate → Rank | File | DB | DB | Stage+SQL | ❌ No staging pathway | 🚨 |
| T11 | Filter → Join → Aggregate → Rank → SCD1 | File | DB | DB | ❌ Validation Error | ❌ Not validated — would attempt and fail at generation | 🚨 |
| T12 | Filter → Join → Aggregate → Rank | File | DB | Spark | PySpark | ✅ | ✅ |
| T13 | Join → Aggregate → Rank → SCD2 | DB | File | DB | ❌ Validation Error | ❌ Not validated | 🚨 |
| T14 | Join → Aggregate | DB | File | Spark | PySpark | ✅ | ✅ |
| T15 | Filter → Join → Window → Dedup | File | File | Spark | PySpark | ✅ | ✅ |

**Score: 6 of 15 scenarios fully supported. 9 scenarios have gaps.**

---

## SECTION 6 — UI Validation Matrix Audit

The framework specifies 7 critical validation conditions that must be enforced in the UI (and ideally backend).

| Condition | Should | Actual | Status |
|-----------|--------|--------|--------|
| User selects DB execution but sources are heterogeneous | ❌ Reject | ❌ No validation — accepted and crashes at generation | 🚨 |
| User selects DB execution but transformation is SQL-unsupported (e.g. Python UDF) | ❌ Reject | ❌ No validation | 🚨 |
| User selects DB execution, source is file, transformation is advanced | ❌ Reject | ❌ No validation | 🚨 |
| User selects SCD on file target | ❌ Reject | ❌ SCD not implemented — wouldn't reach this check | 🚨 |
| User selects SCD but target is not DB | ❌ Reject | ❌ SCD not implemented | 🚨 |
| User selects ranking but DB does not support window functions | ❌ Reject | ❌ No DB capability matrix or window function feasibility check | 🚨 |
| User selects DB execution but source DB ≠ target DB | ❌ Reject | ❌ No validation — would crash at code generation with no SQL engine | 🚨 |

**All 7 UI validation conditions from the framework: NOT IMPLEMENTED.**

---

## SECTION 7 — Execution Pipeline Flow Audit

The framework defines this golden flow:

```
User builds DAG → Validation Engine → Execution Planner → Pushdown Optimizer → Connector Selector → Code Generator
```

### 7.1 Flow Component Audit

| Component | Exists? | Quality | Notes |
|-----------|---------|---------|-------|
| User builds DAG | ⚠️ | Canvas exists; saves nothing to backend | See UI audit |
| Validation Engine | ⚠️ | `PipelineValidator` — structural only | Missing execution-mode feasibility checks |
| Execution Planner | ❌ | Not implemented | No component selects DB vs Spark vs Hybrid based on pipeline topology |
| Pushdown Optimizer | ⚠️ | `PushdownStrategyEditor` in Frontend (orphaned) + `PushdownEligibilityEngine.ts` | Engine exists in Frontend but is not connected to code generation backend |
| Connector Selector | ⚠️ | `NodeGeneratorRegistry` selects generator per node type | No cross-node source/target compatibility check |
| Code Generator | ✅ | Full PySpark + Scala Spark generation | Works correctly when given valid input |

### 7.2 Golden Rules Audit

The framework specifies 5 golden rules for code generation:

| Rule | Status | Detail |
|------|--------|--------|
| 1. Validate pipeline | ⚠️ | Structural validation only; no execution-mode validation |
| 2. Choose execution engine | ⚠️ | Manually specified by caller; no auto-selection based on source/target topology |
| 3. Apply pushdown optimizations | ⚠️ | `PushdownEligibilityEngine` exists in Frontend but is disconnected from Backend |
| 4. Generate code | ✅ | High quality for supported transforms |
| 5. Inject secrets | ✅ | Secrets backend pattern implemented in JDBC source/sink generators (env, AWS Secrets Manager, Azure Key Vault, GCP) |

### 7.3 Engineering Quality Rules Audit

| Rule | Status | Detail |
|------|--------|--------|
| No full table reads when filters exist | ✅ | Filter generator uses `.filter()` correctly; JDBC `pushDownPredicate` option available |
| Pushdown where possible | ⚠️ | `pushDownPredicate: true` is default for JDBC; but no automatic filter pushdown to source |
| Staging when required | ❌ | No staging path for File → DB with DB execution mode |
| Correct DB connector (driver inference) | ✅ | `inferDriver()` in JDBC generator infers driver from URL for PostgreSQL, MySQL, MSSQL, Oracle, Redshift, Snowflake |
| Correct load method per target | ✅ | Delta MERGE, Iceberg MERGE, JDBC append/overwrite, file save all correctly differentiated |

---

## SECTION 8 — Hybrid Execution Assessment

The framework describes hybrid execution: SQL for pushdown-eligible operations, Spark for the rest.

| Capability | Status | Detail |
|-----------|--------|--------|
| Hybrid execution concept understood | ✅ | `PushdownStrategyEditor` and `PushdownEligibilityEngine.ts` demonstrate the concept in Frontend |
| Hybrid execution implemented in codegen | ❌ | Backend generates either full PySpark OR full Scala Spark. No hybrid SQL+PySpark code generation |
| Segment-level execution point assignment | ✅ | `ExecutionPointState.ts` models this in Frontend |
| Pushdown SQL extraction from pipeline segment | ❌ | No backend component extracts SQL-pushable segments and generates mixed SQL+Spark output |
| Hybrid code file output | ❌ | `CodegenService.generate()` returns a single technology artifact |

---

## SECTION 9 — SCD Implementation Gap (Critical)

SCD (Slowly Changing Dimensions) is a core ETL concept. The framework explicitly requires SCD Type 1 and SCD Type 2.

### 9.1 What is missing

| Item | Status |
|------|--------|
| `TransformationType` enum includes `scd_type1` / `scd_type2` | ❌ — not in `pipeline.types.ts` |
| `ScdType1Config` / `ScdType2Config` interfaces | ❌ |
| `PySparkScdType1Generator` | ❌ |
| `PySparkScdType2Generator` | ❌ |
| Frontend node type for SCD | ❌ |
| UI validation: SCD requires DB target | ❌ |
| UI validation: SCD requires merge capability | ❌ |

### 9.2 What SCD Type 1 would require

```python
# Expected generated output:
delta_target.alias("target").merge(
    source.alias("source"),
    "target.key = source.key"
).whenMatchedUpdate(set={...}).whenNotMatchedInsert(values={...}).execute()
```

The Delta MERGE sink generator already produces this pattern for `mode: 'merge'` — SCD Type 1 is actually **partially achievable** by routing to a Delta sink with `mergeKey` — but this is not surfaced as an explicit SCD node, has no surrogate key generation, and has no history tracking.

### 9.3 What SCD Type 2 would require

- `effective_date`, `end_date`, `is_current` column management
- Close existing active records (UPDATE end_date, is_current=false)
- Insert new records for changed rows
- This requires a **multi-step pattern** not representable by any current single node generator

---

## SECTION 10 — Frontend Transform Registry vs Backend Codegen Consistency

The Frontend has its own code generation (`TransformRegistry.ts` → `codeGenTemplate`) that runs in the browser, and the Backend has its own PySpark generator (`PySparkMultiTransformGenerator`). These must stay in sync.

### 10.1 Transforms in Frontend Registry vs Backend Multi-Transform Generator

| Transform ID | Frontend Registry | Backend `compileStep()` | Consistent? |
|---|---|---|---|
| `trim` | ✅ | ✅ `F.trim(col)` | ✅ |
| `to_date` | ✅ | ✅ `F.to_date(col, format)` | ✅ |
| `to_number` / `cast` | ✅ | ✅ `col.cast("decimal...")` | ✅ |
| `round` | ✅ | ✅ `F.round(col, decimals)` | ✅ |
| `floor` / `ceil` | ✅ | ✅ | ✅ |
| `regex_extract` | ✅ | ✅ `F.regexp_extract(...)` | ✅ |
| `coalesce` | ✅ | ✅ `F.coalesce(col, F.lit(...))` | ✅ |
| `null_if` | ✅ `NULLIF(x, y)` SQL | ✅ `F.when(col != val, col)` — correctly avoids `F.nullif()` which doesn't exist | ✅ |
| `substring` | ✅ `SUBSTRING(...)` SQL | ✅ `F.substring(col, start, length)` | ✅ |
| `trim_timestamp` | ✅ `TRUNC(...)` SQL | ❌ **Not in `compileStep()`** — `trim_timestamp` step would return `null` and emit a warning | 🚨 |
| `date_add` | ✅ | ✅ `F.date_add(col, days)` | ✅ |
| `concat` | Not in registry | ✅ `F.concat(col, F.lit(suffix))` | 📝 Backend-only |
| `ltrim` / `rtrim` | Not in registry | ✅ Backend-only | 📝 |
| `upper` / `lower` / `title_case` | Not in registry | ✅ Backend-only | 📝 |
| `length` | Not in registry | ✅ Backend-only | 📝 |
| `pad_left` / `pad_right` | Not in registry | ✅ Backend-only | 📝 |
| `abs` | Not in registry | ✅ Backend-only | 📝 |
| `to_timestamp` | Not in registry | ✅ Backend-only | 📝 |
| `date_format` / `date_diff` | Not in registry | ✅ Backend-only | 📝 |
| `extract_regex` | Matches `regex_extract` | ✅ `F.regexp_extract(...)` | ✅ |
| `replace_regex` | Not in registry | ✅ Backend-only | 📝 |
| `matches_regex` | Not in registry | ✅ Backend-only | 📝 |
| `if_null` | Not in registry | ✅ `F.coalesce(col, F.lit(...))` | 📝 |
| `custom_sql` | ✅ | ✅ `F.expr(expression)` | ✅ |

**Gap found:** `trim_timestamp` is in the Frontend registry with a template but has **no mapping in the backend `compileStep()` switch**. A step of type `trim_timestamp` would be silently skipped with a warning.

---

## SECTION 11 — Scala Spark Engine Coverage

The Scala engine exists but was not fully audited. Based on directory structure:

| Component | Status |
|-----------|--------|
| Scala engine registered | ✅ `ScalaSparkEngine` registered in `CodegenService` |
| Source generators | ✅ `all.source.generators.ts` present |
| Transformation generators | ✅ `all.transformation.generators.ts` present |
| Sink generators | ✅ `all.sink.generators.ts` present |
| SCD generators | ❌ Same gap as PySpark |
| SQL engine | ❌ `// Future: engineRegistry.register(new SqlEngine())` comment only |
| Pandas engine | ❌ `// Future: engineRegistry.register(new PandasEngine())` comment only |

---

## SECTION 12 — Code Quality Assessment of the Codegen Engine

| Aspect | Assessment |
|--------|------------|
| Architecture | ✅ Excellent — Engine/Node registry pattern is clean and extensible |
| Topological sort | ✅ Kahn's algorithm with deterministic ordering — production quality |
| Variable naming | ✅ `toVarName()` correctly sanitizes to Python identifiers, avoids reserved keywords |
| Type system | ✅ Comprehensive `pipeline.types.ts` covers all major data types including nested Struct/Array/Map |
| DataType → PySpark type mapping | ✅ `toPySparkType()` handles all primitive and complex types |
| Code builder | ✅ `CodeBuilder` is clean and avoids double-indentation problems |
| Warning propagation | ✅ Warnings accumulate through `GenerationContext` and surface in artifact metadata |
| Secrets handling | ✅ AWS/Azure/GCP/env backends — no hardcoded credentials |
| Multi-file artifact output | ✅ Generates `.py`, `requirements.txt`, `submit.sh`, `spark-defaults.conf` |
| Error recovery | ✅ Failed node generation emits `# ERROR:` comment and continues — pipeline still partially generates |
| Parallel JDBC partitioning | ✅ `numPartitions`/`partitionColumn`/`lowerBound`/`upperBound` with validation warnings |
| Broadcast hints | ✅ `broadcastHint: 'left' | 'right'` correctly injects `F.broadcast()` |
| AQE config | ✅ `spark.sql.adaptive.enabled=true` in generated `spark-defaults.conf` |

---

## SECTION 13 — Execution Decision Engine: What's Missing

This is the most critical architectural gap. The framework describes an **Execution Planner** that sits between the validator and the code generator. This component does not exist.

### What the Execution Planner should do (and doesn't):

```
Input: Pipeline DAG + user's execution preference (DB / Spark / Auto)

1. Analyze each source node:
   - Is it DB-backed (JDBC)?
   - Is it file-backed?
   - Is it streaming?

2. Analyze source heterogeneity:
   - Are all sources from the same DB instance/type?
   - Are any sources file-based?

3. Analyze transformation chain:
   - Are all transforms SQL-compatible?
   - Are any transforms Python UDF / ML / Flatten / Explode?
   - Are any transforms SCD?

4. Analyze target:
   - Is target the same DB as the source?
   - Is target a file?
   - Does target support MERGE (for SCD)?

5. Apply decision matrix → output execution plan:
   - FULL_SQL_PUSHDOWN
   - FULL_PYSPARK
   - HYBRID (partial pushdown + Spark)
   - STAGE_AND_LOAD
   - VALIDATION_ERROR (with reason)

6. Reject invalid combinations before reaching code generator
```

**Currently:** The caller specifies `pipeline.environment.technology` and the engine blindly uses it. No feasibility check occurs.

---

## SUMMARY SCORECARD

| Category | Max Score | Score | Notes |
|----------|-----------|-------|-------|
| Simple transformations | 10 | 10 | Complete |
| Medium transformations | 10 | 10 | Complete |
| Advanced transformations | 10 | 3 | SCD1/SCD2/Surrogate Key/CDC/ML missing |
| Source coverage | 10 | 7 | MongoDB/Cassandra/API missing |
| Target/Sink coverage | 10 | 9 | No cloud-native auth configs |
| Execution decision matrix | 15 | 4 | Only Spark path works end-to-end |
| UI validation rules | 10 | 0 | All 7 framework rules not implemented |
| SCD implementation | 10 | 0 | Not started |
| Hybrid execution | 10 | 2 | Concept exists in Frontend (orphaned) |
| Frontend/Backend consistency | 5 | 4 | `trim_timestamp` gap |
| Code generation quality | 10 | 9 | High quality; minor gaps |
| **Total** | **110** | **58** | **53% — Spark-only path is solid; decision engine layer is absent** |

---

## PRIORITY REMEDIATION PLAN

### P0 — Execution Planner (Blocking for Framework Compliance)

Build `ExecutionPlanner` class that takes `PipelineDefinition` + user preference and returns:
- `ExecutionPlan { mode: 'pyspark' | 'sql' | 'hybrid' | 'stage_and_load', errors: ValidationError[] }`
- Embed into `CodegenService.generate()` before engine selection
- Enforce all 7 UI validation matrix rules

### P1 — SCD Type 1 and Type 2

- Add `scd_type1` and `scd_type2` to `TransformationType`
- Implement `SCDType1Config` (merge key, update strategy)
- Implement `SCDType2Config` (surrogate key column, effective_date, end_date, is_current, change tracking columns)
- `PySparkScdType1Generator` — Delta MERGE + fallback to JDBC MERGE
- `PySparkScdType2Generator` — multi-step pattern: close active + insert new
- UI validation: SCD requires DB target with merge capability

### P2 — SQL Engine

- Implement `SqlEngine` for same-DB pushdown scenarios (T1–T6 in combination matrix)
- Register `SqlEngine` in `CodegenService`
- Generate ANSI SQL with dialect adapters (PostgreSQL, MySQL, MSSQL, Snowflake)

### P3 — Missing Source Generators

- `PySparkMongoSourceGenerator`
- `PySparkCassandraSourceGenerator`
- `PySparkApiSourceGenerator` (REST polling)

### P4 — Fix `trim_timestamp` in `compileStep()`

Add to backend `PySparkMultiTransformGenerator.compileStep()`:
```typescript
case 'trim_timestamp':
  return `F.date_trunc(${pyStringLiteral(String(p['unit'] ?? 'day').toLowerCase())}, ${col})`;
```

### P5 — Connect Frontend Pushdown Engine to Backend

Wire `PushdownEligibilityEngine.ts` output into the API pipeline submission payload, so the backend receives segment-level execution point assignments and generates hybrid code accordingly.

---

*End of Code Generation Engine Audit Report*
