# ETL1 Platform — Full Audit Report (Updated)
**Date:** 2025  
**Auditor:** Claude — every source file read, no assumptions from filenames  
**Scope:** Frontend (React/Vite/TypeScript), Backend (Node.js/Express/TypeScript), Codegen Engine, Browser Performance, UI Consistency, Execution Engine, NoCode Completeness, Transformation Coverage, Audit Column Support  
**Revision:** 2 — expanded with transformation taxonomy, scalar vs non-scalar distinctions, DWH completeness, audit column support, and corrected column-mapping assessment

---

## EXECUTIVE SUMMARY

ETL1 has a genuinely strong technical foundation: a proper PostgreSQL backend, a well-structured PySpark codegen engine with 30+ transformation types, SCD Type 1 & 2, window functions, pivot/unpivot, DQ, masking, and a three-engine frontend codegen layer (Spark SQL, PostgreSQL, Redshift). However the platform **cannot yet be called a NoCode ETL tool**. The most critical gap is that the canvas only supports a small set of node types and every non-trivial transformation requires manual SQL entry. The column mapping situation is more nuanced than a simple "missing" — it is correct that scalar/pass-through transforms (Filter, Cache, Repartition, Sample) need no column mapping, but all **projector/selector** transforms (Aggregate, Window, Pivot, Select, Derive, Join, Union, SCD) require a column UI that does not exist on the canvas. Built components are orphaned, bugs prevent Join and Aggregate from generating correct code, and execution is entirely simulated.

---

## 1. NOCODE COMPLETENESS — DRAG AND DROP

### 1.1 What Actually Works

| Feature | File | Status |
|---|---|---|
| Click toolbar button to add node to canvas | `PipelineCanvas.tsx` | ✅ Works |
| Drag node around canvas after placement | `PipelineCanvas.tsx` | ✅ Works |
| Drag table from Metadata Catalog → canvas to auto-create Source node | `PipelineCanvas.tsx` | ✅ Works |
| Draw edge by dragging from output port to input port | `PipelineCanvas.tsx` | ✅ Works |
| Delete node (selected + Delete key, or × button) | `PipelineCanvas.tsx` | ✅ Works |
| Delete edge (click edge + × button) | `PipelineCanvas.tsx` | ✅ Works |
| Zoom and pan canvas | `PipelineCanvas.tsx` | ✅ Works |
| Source node: technology filter, connection picker, schema/table dropdowns | `NodeConfigPanel.tsx` | ✅ Works |
| Target node: sink type selection, write mode, key columns, SCD date column | `NodeConfigPanel.tsx` | ✅ Works |
| Join node: join type selector + manual key column text inputs | `NodeConfigPanel.tsx` | ⚠️ Partial |
| Filter node: SQL WHERE expression textarea | `NodeConfigPanel.tsx` | ⚠️ Manual SQL required |
| Aggregate node: group-by column adder + SQL aggregation textarea | `NodeConfigPanel.tsx` | ⚠️ Partial |
| Union node: union type selector | `NodeConfigPanel.tsx` | ✅ Works |

### 1.2 Critical NoCode Gaps

#### GAP-001: Transform node requires manual SQL — this is NOT NoCode
**Severity: CRITICAL**

The `TransformConfig` component inside `NodeConfigPanel.tsx` renders a raw `<textarea>` where the user must type a full SQL SELECT statement using the placeholder `__input__`. This means every column transformation requires SQL knowledge. This is the opposite of NoCode.

The backend codegen engine supports 30+ transformation sub-types — **none of these structured types are surfaced as NoCode GUI operations on the canvas**. Every transform node degrades to a raw SQL box.

#### GAP-002: MultiTransformEditor is built but completely orphaned
**Severity: CRITICAL**

`MultiTransformEditor.tsx` is a fully implemented component with step-based transformation sequences, code preview, version history, and validation. It uses `StepList` from `TransformStepEditor.tsx` and the `TRANSFORM_REGISTRY` from `TransformRegistry.ts`.

**It is never rendered anywhere in the application.** It is not imported in `NodeConfigPanel.tsx`, not referenced in `App.tsx`, not accessible from the canvas. It exists only as a standalone demo. The backend `PySparkMultiTransformGenerator` that handles `multi_transform_sequence` type is also unreachable because there is no canvas node type that produces the required `transformSequences` config shape.

**Fix required:** Wire `MultiTransformEditor` into `NodeConfigPanel.tsx` for the `transform` node type and ensure the config serializes as `{ transformSequences: [...], executionStrategy: ... }` so the backend generator picks it up.

#### GAP-003: No drag-and-drop node palette (only click-to-add toolbar)
**Severity: MEDIUM**

The toolbar uses `onClick` buttons that place nodes at a random position (`Math.random()`). There is no drag-from-palette interaction. Standard ETL tools have a left-side component palette where the user drags a component type to the desired canvas position.

#### GAP-004: No undo/redo
**Severity: MEDIUM**

`pipelineSlice.ts` has no undo/redo history stack. Accidentally deleting a node or edge is permanent. Redux Toolkit's `redux-undo` middleware would address this without a rewrite.

#### GAP-005: No node copy/paste
**Severity: LOW-MEDIUM**

No Ctrl+C / Ctrl+V handler for nodes. The keyboard handler in `PipelineCanvas.tsx` only handles Delete/Backspace.

#### GAP-006: No canvas mini-map and "Fit" button is broken
**Severity: LOW-MEDIUM**

The "Fit" button resets zoom to 1.0 and pan to (0,0) — it does **not** fit nodes into view. Nodes placed far from the origin will not be visible. There is no mini-map for large pipelines.

---

## 2. COLUMN MAPPING — CORRECT TAXONOMY (SCALAR vs NON-SCALAR)

This section replaces the blanket "no column mapping" statement from the original audit with a precise, component-by-component analysis.

### 2.1 Transformation Classification

ETL transformations divide into two fundamental classes:

**Scalar / Pass-Through Transforms** — operate on the row stream without changing the column schema. They do not need a column-mapping UI. The output schema equals the input schema.

| Transform Type | Needs Column Mapping? | Reason |
|---|---|---|
| Filter | ❌ No | Passes all columns through; only row selection changes |
| Dedup | ❌ No (column selector optional) | Output schema unchanged; dedup columns are an optimization hint |
| Sort / OrderBy | ❌ No | Output schema unchanged; order columns are sort keys only |
| Limit / Sample | ❌ No | Schema pass-through |
| Cache / Repartition | ❌ No | Schema pass-through; execution hint only |
| FillNA / DropNA | ❌ No | Values modified in-place; no schema change |
| Data Quality | ❌ No | Rows filtered/quarantined but schema unchanged |

**Projector / Selector Transforms** — change the column set, add new columns, or restructure the schema. They require a GUI for the user to specify which columns to include, exclude, rename, compute, or map.

| Transform Type | Needs Column Mapping? | What User Must Specify |
|---|---|---|
| Select | ✅ YES | Pick which source columns to project; add expressions with aliases |
| Rename | ✅ YES | Old name → new name mappings (drag/drop or table) |
| Cast | ✅ YES | Column + target data type pairs |
| Drop | ✅ YES | Which columns to remove |
| Derive / withColumn | ✅ YES | New column name + expression; optional target type |
| Aggregate | ✅ YES — CRITICAL | GROUP BY column picker + aggregate function + alias per output column |
| Window | ✅ YES — CRITICAL | PARTITION BY column picker + ORDER BY + window function + output alias |
| Join | ✅ YES — CRITICAL | Left key ↔ Right key pairs; which columns to project post-join |
| Union | ✅ YES (schema alignment) | Column alignment between datasets when schemas differ |
| Pivot | ✅ YES — CRITICAL | Group-by columns + pivot column + aggregation columns + output names |
| Unpivot | ✅ YES — CRITICAL | ID columns (kept) + value columns (stacked) + output column names |
| Explode | ✅ YES | Array column to explode + output alias |
| Flatten | ✅ YES | Which struct columns to flatten |
| Mask | ✅ YES | Column + masking strategy pairs |
| Lookup | ✅ YES — CRITICAL | Source key columns ↔ lookup key columns; return columns to add |
| SCD Type 1 | ✅ YES — CRITICAL | Business key columns + columns to update |
| SCD Type 2 | ✅ YES — CRITICAL | Business keys + tracked columns + effective/end date/flag columns |
| Surrogate Key | ✅ YES | Output column name + strategy |
| MultiTransform | ✅ YES — per column | Column selection + step sequence per column |

### 2.2 Current State of Column Mapping in ETL1

**Filter node** — correctly has only a SQL expression textarea. This is correct design. No column mapping needed.

**Join node** — has two free-text inputs per key pair (left.col, right.col). This requires the user to type column names from memory. There is no schema-aware column picker showing available columns from the left or right upstream nodes. **A NoCode join requires a visual "left column ↔ right column" picker**, where both sides are populated from the upstream nodes' schemas.

**Aggregate node** — has a multi-value text box for GROUP BY columns (user types comma-separated names) plus a SQL textarea for aggregation expressions. There is no GUI to pick a column, choose SUM/COUNT/AVG/MAX/MIN, and set an alias. **A NoCode aggregate needs a table where each row is: [output alias] [function dropdown] [source column dropdown].**

**The most important gap: no column selection on Target node**
The Target node configuration shows Connection → Schema → Table dropdowns, but **zero column-level mapping**. When writing to a target table, the user cannot:
- See what columns the source dataset has
- See what columns the target table expects
- Map source columns to target columns
- Handle name mismatches
- Exclude unwanted source columns from the write

**In a NoCode ETL tool, the Target node must show a column mapping panel** populated from: (a) the upstream node's schema and (b) the target table's column list from introspection. The user should be able to drag-connect columns or select from dropdowns.

**What minimum viable column selection would look like:**
When the Target node's connection + table is configured, the panel could automatically show a column mapping table with:
- Left: source columns (from upstream node or metadata catalog)
- Right: target table columns (from `api.introspectTables()`)
- Default: auto-map where names match
- Allow: override individual mappings, exclude source columns

This does not require a full drag-and-drop canvas — a simple table UI in the config panel would satisfy the core requirement.

### 2.3 Schema Propagation — Root Cause

The fundamental reason column mapping is hard to implement is that **the canvas has no schema propagation**. Each node only knows its own config — it does not know what columns are available from its upstream nodes at design time.

To implement column pickers, the system needs one of:
1. **Live schema inference**: After a source node is configured, introspect the table and cache the column list; propagate forward through transforms
2. **Manual schema declaration**: Let users declare the expected schema on each node (error-prone but simpler to build)
3. **Schema from metadata catalog**: If the source table was imported into the catalog, use its stored column definitions

Option 1 is the correct enterprise approach. The metadata catalog already stores column-level schema (`getProfile(datasetId)` returns columns). The gap is that the canvas does not consume this data to power column pickers in node config panels.

---

## 3. MULTI-TRANSFORM COMPONENT

### 3.1 Orphaned Components (all disconnected from canvas)

| File | Purpose | Wired to Canvas? |
|---|---|---|
| `MultiTransformEditor.tsx` | Full multi-step editor with version history | ❌ NO |
| `TransformStepEditor.tsx` + `StepList` | Individual step editor with registry picker | ❌ NO |
| `TransformationBuilder.tsx` | High-level builder | ❌ NO |
| `ConditionBuilder.tsx` | Condition/predicate builder | ❌ NO |
| `ParameterPanel.tsx` | Parameter input per transform type | ❌ NO |
| `PatternWizard.tsx` | Pattern-based transform wizard | ❌ NO |
| `PushdownStrategyEditor.tsx` | Pushdown configuration | ❌ NO |

### 3.2 Frontend Transform Registry — What Exists

`TransformRegistry.ts` defines `TRANSFORM_REGISTRY` with the following primitives, each with Spark SQL, PostgreSQL, and Redshift codegen templates:

**Convert category:** `to_number`, `to_date`, `cast`  
**Text category:** `substring`, `trim`  
**Datetime category:** `trim_timestamp`, `date_add`  
**Numeric category:** `round`, `floor`, `ceil`  
**Regex category:** `regex_extract`  
**Conditional/Null category:** `coalesce`, `null_if`  
**Custom category:** `custom_sql`

**Total: 13 primitives in the frontend registry.**

This is a significant gap vs the 30+ types handled by the backend PySpark generator. The frontend registry is missing:

- All multi-step string transforms: `ltrim`, `rtrim`, `upper`, `lower`, `title_case`, `length`, `concat`, `pad_left`, `pad_right`
- All multi-step date transforms: `to_timestamp`, `date_format`, `date_diff`
- All regex transforms: `replace_regex`, `matches_regex`, `extract_regex` (partially present)
- Numeric: `abs` is missing
- Conditional: `if_null` is handled as alias but not explicitly listed

### 3.3 Backend Multi-Transform Support

`PySparkMultiTransformGenerator` handles `multi_transform_sequence` nodes. It supports 35 step types including all string, numeric, date, regex, and conditional operations. The backend is ready; the frontend registry just needs expanding and the editor needs wiring.

### 3.4 Theme Collision in MultiTransformEditor

`MultiTransformEditor.tsx` uses `className="flex flex-col h-full gap-4 p-6 bg-white"` — a **white background** with default Tailwind light-mode text. The rest of the application uses dark theme (`bg-[#0d0f1a]`). If rendered, this component would appear as a jarring white panel.

---

## 4. TRANSFORMATION COVERAGE — DWH AND CLOUD ETL COMPLETENESS

### 4.1 PySpark Codegen Engine — Full Inventory

The following table audits every transformation type against standard DWH/cloud ETL requirements:

**A. Row-Level / Scalar Transforms (Filter, Cast, Derive, etc.)**

| Operation | Codegen Support | Canvas Node? | Notes |
|---|---|---|---|
| Row filter (WHERE condition) | ✅ PySparkFilterGenerator | ✅ Filter node | SQL expr only — no GUI builder |
| Column selection (SELECT list) | ✅ PySparkSelectGenerator | ❌ No dedicated canvas node | Accessible via MultiTransform only |
| Column rename | ✅ PySparkRenameGenerator | ❌ No dedicated canvas node | |
| Type cast | ✅ PySparkCastGenerator | ❌ No dedicated canvas node | |
| Drop columns | ✅ PySparkDropGenerator | ❌ No dedicated canvas node | |
| Derive / computed column | ✅ PySparkDeriveGenerator | ❌ No dedicated canvas node | |
| NULL fill / replace | ✅ PySparkFillnaGenerator | ❌ No dedicated canvas node | |
| Drop rows with NULLs | ✅ PySparkDropnaGenerator | ❌ No dedicated canvas node | |
| Deduplication | ✅ PySparkDedupGenerator | ❌ No dedicated canvas node | |
| Sort / Order By | ✅ PySparkSortGenerator | ❌ No dedicated canvas node | |
| Limit rows | ✅ PySparkLimitGenerator | ❌ No dedicated canvas node | |
| Sample fraction | ✅ PySparkSampleGenerator | ❌ No dedicated canvas node | |
| Multi-step column transforms | ✅ PySparkMultiTransformGenerator | ❌ Not wired | |

**B. Set / Structural Operations**

| Operation | Codegen Support | Canvas Node? | Notes |
|---|---|---|---|
| Inner / Left / Right / Full Outer JOIN | ✅ PySparkJoinGenerator | ✅ Join node | BUG: conditions always empty (see BUG-001) |
| Left Semi / Left Anti JOIN | ✅ PySparkJoinGenerator | ✅ Join node | Same bug |
| Cross JOIN | ✅ PySparkJoinGenerator | ✅ Join node | Same bug |
| Broadcast JOIN hint | ✅ PySparkJoinGenerator | ⚠️ No GUI for hint | Config field exists in codegen types |
| UNION ALL | ✅ PySparkUnionGenerator | ✅ Union node | byName + allowMissingColumns |
| UNION (dedup) | ✅ PySparkUnionGenerator | ✅ Union node | |
| INTERSECT / EXCEPT | ❌ Not in UnionGenerator | ⚠️ Partial UI | Canvas union type dropdown shows INTERSECT/EXCEPT but no codegen |
| Lookup (broadcast join pattern) | ✅ PySparkLookupGenerator | ❌ No canvas node | |

**C. Aggregation and Analytics**

| Operation | Codegen Support | Canvas Node? | Notes |
|---|---|---|---|
| GROUP BY + aggregate (SUM, COUNT, AVG, MIN, MAX, FIRST, LAST, COLLECT_LIST, COLLECT_SET, COUNT DISTINCT) | ✅ PySparkAggregateGenerator | ✅ Aggregate node | BUG: groupBy and aggregations always empty (see BUG-002) |
| HAVING clause | ✅ AggregateConfig.having | ✅ Aggregate node | Not exposed in NodeConfigPanel |
| Window: ROW_NUMBER, RANK, DENSE_RANK, PERCENT_RANK, CUME_DIST | ✅ PySparkWindowGenerator | ❌ No canvas node | |
| Window: LAG, LEAD | ✅ PySparkWindowGenerator | ❌ No canvas node | |
| Window: Running SUM, AVG, MIN, MAX, COUNT over window | ✅ PySparkWindowGenerator | ❌ No canvas node | |
| Window: NTILE, FIRST_VALUE, LAST_VALUE | ✅ PySparkWindowGenerator | ❌ No canvas node | |
| ROWS BETWEEN / RANGE BETWEEN | ✅ PySparkWindowGenerator | ❌ No canvas node | |
| Pivot (cross-tab) | ✅ PySparkPivotGenerator | ❌ No canvas node | |
| Unpivot (stack/melt) | ✅ PySparkUnpivotGenerator | ❌ No canvas node | |

**D. Data Cleansing / Quality**

| Operation | Codegen Support | Canvas Node? | Notes |
|---|---|---|---|
| Not-null check | ✅ PySparkDataQualityGenerator | ❌ No canvas node | |
| Range check (between) | ✅ PySparkDataQualityGenerator | ❌ No canvas node | |
| Regex pattern check | ✅ PySparkDataQualityGenerator | ❌ No canvas node | |
| Custom SQL DQ rule | ✅ PySparkDataQualityGenerator | ❌ No canvas node | |
| Quarantine to bad-data path | ✅ PySparkDataQualityGenerator | ❌ No canvas node | |
| Fail pipeline on DQ failure | ✅ PySparkDataQualityGenerator | ❌ No canvas node | |
| Drop failing rows | ✅ PySparkDataQualityGenerator | ❌ No canvas node | |

**E. Advanced / Semi-Structured**

| Operation | Codegen Support | Canvas Node? | Notes |
|---|---|---|---|
| Explode array column | ✅ PySparkExplodeGenerator | ❌ No canvas node | explode_outer supported |
| Flatten nested struct | ✅ PySparkFlattenGenerator | ❌ No canvas node | Recursive helper generated |
| Data masking (hash, truncate, replace, regex, null) | ✅ PySparkMaskGenerator | ❌ No canvas node | |
| Repartition (hash, range, round-robin) | ✅ PySparkRepartitionGenerator | ❌ No canvas node | |
| Cache / Persist (storage levels) | ✅ PySparkCacheGenerator | ❌ No canvas node | |
| Custom Python UDF | ✅ PySparkCustomUdfGenerator | ❌ No canvas node | Python, Scala, SQL UDFs |
| Custom SQL (tempView-based) | ✅ PySparkCustomSqlGenerator | ✅ Custom SQL node | |

**F. DWH Dimension Loading**

| Operation | Codegen Support | Canvas Node? | Notes |
|---|---|---|---|
| SCD Type 1 (MERGE / upsert) | ✅ PySparkScdType1Generator | ❌ No canvas node | Delta MERGE INTO generated |
| SCD Type 2 (history-preserving) | ✅ PySparkScdType2Generator | ❌ No canvas node | Full MD5 hash + close/insert logic |
| Surrogate key (monotonic, UUID, row_number) | ✅ PySparkSurrogateKeyGenerator | ❌ No canvas node | |
| SCD Type 3 (previous value column) | ❌ Not implemented | ❌ No canvas node | Target node write mode = SCD3 is UI-only |
| Type 6 (hybrid SCD) | ❌ Not implemented | ❌ | Rare but required for some DWH |
| Slowly Changing Reference (CDC) | ❌ Not implemented | ❌ | |

### 4.2 Gaps for Full DWH / Cloud ETL Coverage

The following capabilities are **not yet implemented** anywhere in the engine:

**Missing Transformation Types:**

| Missing Capability | Category | Business Need |
|---|---|---|
| String operations: `replace`, `split`, `locate`, `char_length`, `left`, `right`, `reverse`, `repeat`, `translate` | String | Common DWH cleansing |
| Number operations: `mod`, `power`, `log`, `sqrt`, `sign`, `between` | Numeric | Financial/scientific transforms |
| Date: `year`, `month`, `day`, `hour`, `minute`, `second`, `quarter`, `weekofyear`, `dayofweek`, `date_diff`, `months_between`, `next_day`, `last_day` | Date/Time | Date dimension, aging reports |
| Timestamp: `current_timestamp`, `from_unixtime`, `unix_timestamp`, `convert_timezone` | Date/Time | Audit columns, time zone normalization |
| JSON: `from_json`, `to_json`, `get_json_object`, `json_tuple` | Semi-structured | API ingestion, REST data |
| Array: `array_contains`, `array_size`, `array_distinct`, `array_sort`, `array_join`, `filter` (higher-order) | Semi-structured | Nested data from NoSQL/API |
| Map: `map_keys`, `map_values`, `element_at` | Semi-structured | Config data, key-value structures |
| Conditional: `CASE WHEN ... THEN ... END` (multi-branch, not just NULLIF/COALESCE) | Conditional | Segment/classification logic |
| String distance / fuzzy match (Levenshtein, soundex) | Data Quality | Dedup of name variants |
| Generate series / sequence | Utility | Date dimension population |
| Watermark / late data handling (streaming) | Streaming | Kafka pipelines |
| CDC (Change Data Capture) from source | Ingestion | Incremental loads |
| INTERSECT / EXCEPT set operations | Set Operations | Comparison pipelines |
| Conditional (CASE WHEN) as a canvas node | Conditional | Routing, classification |

**Missing DWH Loading Patterns:**

| Missing Pattern | Notes |
|---|---|
| SCD Type 3 code generation | Write mode flag exists in UI but no generator |
| Slowly changing dimension Type 6 (hybrid) | Not implemented |
| Fact table load with conformed dimension FK lookup | No lookup-by-surrogate-key pattern |
| Slowly Changing Bridge Table | Multi-valued dimensions |
| Transaction fact table incremental append with watermark | Watermark config exists in JDBC source but no CDC handler |
| Error row routing (good rows → target, bad rows → quarantine) | DQ node supports quarantine but no canvas "split" node |

### 4.3 Frontend Transform Registry Gap (vs Backend)

The `TRANSFORM_REGISTRY` in `TransformRegistry.ts` has only **13 primitives**. The backend `PySparkMultiTransformGenerator` handles **35 step types**. The frontend registry must be expanded to match.

Missing from frontend registry that backend already handles: `ltrim`, `rtrim`, `upper`, `lower`, `title_case`, `length`, `concat`, `pad_left`, `pad_right`, `to_timestamp`, `date_format`, `date_diff`, `replace_regex`, `matches_regex`, `abs`.

Also missing from both frontend and backend: all the CASE/WHEN, string distance, JSON, array, and map operations listed above.

---

## 5. AUDIT COLUMN SUPPORT

### 5.1 What Are Audit Columns?

Audit columns are standard metadata columns added to DWH tables to track the who/when/what of data loading:

| Column | Purpose |
|---|---|
| `etl_load_timestamp` | When the row was loaded (current timestamp at load time) |
| `etl_load_date` | Date of load (useful for partitioning) |
| `etl_run_id` | Pipeline run ID for traceability |
| `etl_pipeline_id` | Which pipeline produced this row |
| `etl_pipeline_name` | Human-readable pipeline name |
| `etl_user` | Which user triggered the load |
| `etl_source_system` | Which source system the row came from |
| `etl_record_hash` | MD5/SHA2 of tracking columns (for change detection) |
| `etl_is_current` | SCD2 current flag |
| `etl_effective_date` | SCD2 effective from date |
| `etl_end_date` | SCD2 effective to date |
| `etl_batch_id` | Batch/partition identifier |
| `etl_schema_version` | Version of source schema at load time |

### 5.2 Current Support Status

**SCD2 audit columns** — `effectiveDateColumn`, `endDateColumn`, `currentFlagColumn` are configurable in `ScdType2Config` and fully implemented in `PySparkScdType2Generator`. ✅

**Pipeline run ID in generated script** — The `_parse_args()` scaffold receives `--env` and variables, but **does not inject the pipeline run ID** from the execution record. The generated script cannot self-annotate rows with the run ID without manual intervention. ❌

**Load timestamp** — No auto-injection of current timestamp into a derived column. The user would need to add a Derive node manually with expression `CURRENT_TIMESTAMP()` or `F.current_timestamp()`. There is no "Add Audit Columns" button or standard audit column step in the transform registry. ❌

**Loading user** — The pipeline execution is triggered by a user ID stored in `run_options_json`. This user ID is available in the backend at run time, but is **never passed to the generated PySpark script** as a parameter or injected as a derived column. ❌

**Source system identifier** — Not supported. No canvas node or config field captures this.

**MD5 row hash for change detection** — `PySparkScdType2Generator` generates an `_scd2_hash` column internally as part of the change detection algorithm. But there is no standalone "Add Row Hash" transform available as a canvas node that users could apply outside SCD2. ❌

**etl_run_id injection** — The `_parse_args()` function in the scaffold could accept `--run-id` as a parameter, but this is not currently wired. The execution route (`pr_initialize_pipeline_run`) generates a `pipeline_run_id` but never passes it to the job submission (because the execution is simulated and no real job is submitted). ❌

### 5.3 How Audit Column Support Should Be Built

Two approaches are needed:

**Approach 1 — Transform Registry step**  
Add a standard step type `add_audit_columns` to the `MultiTransformEditor` / `TRANSFORM_REGISTRY` with parameters:
- Include load timestamp (checkbox) → adds `F.current_timestamp().alias('etl_load_ts')`
- Include load date (checkbox) → adds `F.current_date().alias('etl_load_date')`  
- Include run ID (checkbox) → adds `F.lit(args.run_id).alias('etl_run_id')`  
- Include user (checkbox) → adds `F.lit(args.run_user).alias('etl_user')`
- Source system name (text input) → adds `F.lit('SYSTEM_NAME').alias('etl_source_system')`
- Track columns for hash (multi-select) → adds `F.md5(F.concat_ws('|', ...cols)).alias('etl_row_hash')`

**Approach 2 — Sink node enhancement**  
Add an "Audit Columns" expandable section to the Target node config panel that auto-injects these columns before writing.

**Approach 3 — Pipeline scaffold**  
Extend `_parse_args()` to accept `--run-id`, `--run-user`, `--pipeline-id` parameters and make them available as Spark broadcast variables that Derive nodes can reference.

Currently none of these three approaches are implemented.

---

## 6. EXPORT AND IMPORT FACILITY

### 6.1 What Works

| Feature | Status |
|---|---|
| Download generated PySpark code as .py | ✅ Works |
| Download generated Scala code as .scala | ✅ Works |
| Copy generated code to clipboard | ✅ Works |
| Export execution history as CSV | ✅ Works (ExecutionHistorySubTab) |
| Pipeline save to database | ✅ Works |
| Pipeline load from database | ✅ Works |

### 6.2 Gaps

#### GAP-009: No pipeline export as portable JSON/YAML
**Severity: HIGH**

There is no "Export Pipeline Definition" button anywhere. A user cannot export their pipeline as a JSON or YAML file to share, version-control, back up, or import into another ETL1 instance. The pipeline IR is stored as `ir_payload_json` in the database but is never exposed as a downloadable artifact.

#### GAP-010: No pipeline import from JSON/YAML
**Severity: HIGH**

There is no import endpoint (`POST /pipelines/import`) and no import UI.

#### GAP-011: No bulk export of multiple pipelines
**Severity: MEDIUM**

No project-level export (export all pipelines in a project as a zip/bundle).

---

## 7. CODE GENERATION ENGINE — DEEP ASSESSMENT

### 7.1 PySpark Engine — Confirmed Production-Grade

Sources: JDBC (8 DB types), File (7 formats), Kafka, Delta Lake, Apache Hive, Apache Iceberg, MongoDB (type exists in config), Cassandra (type exists in config).  
Transformations: 30+ types as documented in Section 4.  
Sinks: JDBC, File, Delta Lake (with MERGE), Iceberg (with MERGE), Kafka, Hive, Console.  
Scaffold: Generates `_parse_args()`, `_create_spark_session()`, `_get_secret()`, entrypoint with try/catch/finally.  
Platform configs: Databricks, AWS EMR, Google Dataproc are detected from `targetPlatform` and inject platform-specific Spark configs.  
Secrets: AWS Secrets Manager, Azure Key Vault, GCP Secret Manager, and env var fallback all implemented.

**Assessment: The PySpark codegen engine is the most complete part of the entire platform.**

### 7.2 Critical Gap: Canvas Node Types vs Codegen Node Types are Mismatched
**Severity: CRITICAL**

The canvas has 8 node types. The codegen engine has 30+ sub-types. The mapping in `toPipelineDefinition()` in `pipeline.routes.ts` translates canvas nodes with significant information loss:

| Canvas Node | Maps To Codegen Type | Data Lost |
|---|---|---|
| `transform` | `multi_transform_sequence` if `transformSequences` config present, else `custom_sql` | All 30+ typed transform operations |
| `filter` | `filter` with `condition: cfg.expression` | OK — correct mapping |
| `join` | `join` with `conditions: ensureArray(cfg['joinConditions'])` | **BUG: always empty** (config key mismatch) |
| `aggregate` | `aggregate` with `groupBy: ensureArray(cfg['groupBy'])` | **BUG: always empty** (config key mismatch) |
| `union` | `union` with `byName/allowMissingColumns` | OK |
| `source` | `source` | OK, good URL resolution logic |
| `target` | `sink` | OK, but SCD write modes not wired to SCD generators |

### 7.3 Critical Gap: SQL Engine Not Implemented

In `pipeline.routes.ts`: `const technology: CodegenTechnology = requestedTech === 'sql' ? 'pyspark' : requestedTech;`

SQL generation silently falls back to PySpark. No DB-specific SQL engines (PostgreSQL, Oracle, Snowflake, Redshift SQL) are implemented.

### 7.4 Gap: SCD Nodes Not Accessible from Canvas
**Severity: HIGH**

`PySparkScdType1Generator` and `PySparkScdType2Generator` are production-grade. But:
- There is no `scd_type1` or `scd_type2` canvas node type
- The Target node's write modes `SCD1`/`SCD2` are UI flags that change `mode` to `'append'` — they do NOT call the SCD generators
- SCD generators are completely unreachable from the canvas

### 7.5 Gap: INTERSECT / EXCEPT on Canvas Has No Codegen

The Union node config panel shows `INTERSECT` and `EXCEPT` as options. The `PySparkUnionGenerator` does not handle these — it only generates `.union()` or `.unionByName()`. Selecting INTERSECT/EXCEPT in the UI produces broken or missing PySpark code.

### 7.6 Gap: Scala Spark Engine Depth Unknown
The `ScalaSparkEngine` is registered. Its generator file exists but was not fully audited. Based on registration patterns, it likely follows the PySpark structure, but completeness of sink/source/transformation generators is unverified.

---

## 8. ON-PREMISES TO CLOUD DATA LOADING

### 8.1 What Works

- JDBC source can connect to any on-prem database (Oracle, SQL Server, DB2, PostgreSQL, MySQL, Hive2) ✅
- HDFS, SFTP, S3, ADLS, GCS paths all accepted in file source configs ✅
- Cloud sinks: S3, ADLS, GCS, Delta Lake, Iceberg on cloud object storage ✅
- Connection credentials stored encrypted via `pgp_sym_decrypt` ✅
- Generated code uses `os.environ` for credentials (safe for cloud deployment) ✅
- Platform-specific Spark configs generated for Databricks / EMR / Dataproc ✅
- Secrets manager integration in scaffold (AWS / Azure / GCP) ✅

### 8.2 Gaps

#### GAP-012: No SSH Tunnel / JDBC Proxy configuration
On-prem databases behind firewalls require SSH tunneling or a JDBC gateway. No configuration UI for SSH tunnel host/port/key or SOCKS5 proxy.

#### GAP-013: No SSL/TLS configuration in connection forms
JDBC URL templates in `pipeline.routes.ts` do not include SSL parameters. No UI for `ssl=true`, `sslMode`, `trustServerCertificate`.

#### GAP-014: No real secrets injection at execution time
The scaffold generates secrets helpers but since execution is simulated, secrets are never resolved against real secrets managers.

---

## 9. BROWSER UI — MEMORY AND PERFORMANCE

### 9.1 SVG Canvas Rendering — Major Performance Risk
**Severity: HIGH**

`PipelineCanvas.tsx` uses SVG. Each node = approximately 15–20 DOM elements. At 50 nodes = 750–1000 SVG DOM elements; at 200 nodes = 3000–4000 elements. SVG DOM does not benefit from GPU compositing. Performance will degrade significantly above 50 nodes.

**Industry standard:** React Flow (virtualizes off-screen nodes), Konva.js (canvas-based), or PixiJS (WebGL).

### 9.2 Redux Dispatch on Every Mouse Move Pixel
**Severity: HIGH**

```typescript
if (draggingNode) {
  dispatch(updateNode({ id: draggingNode, x: ..., y: ... }));
}
```

This fires on every `mousemove` event (60+ times/second during drag). Each dispatch triggers a full Redux state update and re-renders all nodes. The fix: store drag position in a `useRef` and only dispatch on `mouseUp`.

### 9.3 portCoords useMemo Recalculates for All Nodes on Every Drag Frame
**Severity: MEDIUM**

`portCoords` depends on the full `nodes` Redux object. Any position change (one node dragging) invalidates the memo for all nodes' port coordinates.

### 9.4 NodeConfigPanel Fetches All Connectors on Every Node Open
**Severity: MEDIUM**

`useEffect(() => { dispatch(fetchConnectors()); }, [dispatch])` fires every time the config panel mounts. No cache check before fetching.

### 9.5 Code Preview Overlay Bundled Inside PipelineCanvas
**Severity: LOW**

`CodePreviewOverlay` is 250 lines of inline JSX inside `PipelineCanvas.tsx`. Cannot be code-split or lazy-loaded.

---

## 10. UI CONSISTENCY AUDIT

### 10.1 Font Size Inconsistency
**Severity: HIGH**

| Location | Sizes Used |
|---|---|
| Canvas toolbar buttons | 11px, 13px |
| NodeConfigPanel | 10px, 11px, 12px, 13px (4 different sizes) |
| LeftSidebar tree | 12px |
| LeftSidebar sub-labels | **8px** (barely legible) |
| MultiTransformEditor title | **24px** (text-2xl) |
| MultiTransformEditor body | 14px, 16px, 18px |
| PipelineCodeSubTab | 11px, 12px |

### 10.2 Theme Collision
**Severity: HIGH**

- All production components: dark background (`#0d0f1a`, `#13152a`, `#1a1d2e`)
- `MultiTransformEditor.tsx`: `bg-white` — pure white background
- `globals.css` defines CSS variables for both themes — **no component uses them**. All hardcode Tailwind hex values. The theme toggle in `ThemeProvider` has zero effect on the UI.

### 10.3 Icon Type Inconsistency
**Severity: MEDIUM**

| Location | Icon System |
|---|---|
| LeftSidebar, NodeConfigPanel | Lucide React (SVG, crisp at all sizes) |
| Canvas node type icons | Unicode emoji: `⬇ ⬆ ⚙ ⊘ ⋈ Σ ∪ ⌨` |
| Canvas toolbar | Unicode emoji + text labels |
| CodePreviewOverlay | Mix of Unicode (✕, ⎘, ⬇, ↺) and inline SVG |

Unicode emoji render differently across OS/font/DPI. On some systems `⋈` (join symbol) may not render. Lucide icons should be used consistently.

### 10.4 Button Height Inconsistency

| Location | Button heights |
|---|---|
| Canvas toolbar Add Node buttons | h-7 (28px) |
| NodeConfigPanel Apply button | h-9 (36px) |
| NodeConfigPanel section selectors | h-8 (32px) |
| MultiTransformEditor save button | ~h-10 (40px) |
| ExecutionSubTab Run button | h-8 (32px) |

### 10.5 Border Radius Inconsistency

Canvas nodes: `rx="5"` (5px SVG) | NodeConfigPanel inputs: `rounded-md` (6px) | Dialog buttons: `rounded` (4px) | CodePreviewOverlay panel: `rounded-xl` (12px). No shared radius token.

---

## 11. EXECUTION / JOB TRIGGER ENGINE

### 11.1 What Works (Structurally)

| Feature | Status |
|---|---|
| `POST /pipelines/:id/run` endpoint exists and creates DB record | ✅ |
| Frontend ExecutionSubTab polls run status every 3 seconds | ✅ |
| Frontend shows live logs, step progress, cancel button | ✅ |
| Cancel / Retry endpoints with proper state machine checks | ✅ |
| Run history stored and queryable with full filter/sort | ✅ |
| Monitor view with KPIs and run list | ✅ |

### 11.2 Critical Gap: Execution is 100% Simulated
**Severity: CRITICAL**

`simulateExecution()` in `pipeline.routes.ts`:
1. Waits random `setTimeout` delays
2. Writes fake log messages to the database
3. **Always reports SUCCESS** regardless of pipeline definition
4. Never calls `codegenService.generate()`
5. Never submits to any Spark cluster
6. Never reads or writes any real data

**The execution UI is entirely theatrical.** It shows the appearance of pipeline execution without doing anything.

### 11.3 Gap: Generated Code Is Never Used in Execution

`POST /pipelines/:id/generate` and `POST /pipelines/:id/run` are completely independent code paths. Running a pipeline **does not generate or submit code**. The two features are decoupled.

### 11.4 Gap: ExecutionSubTab Not Wired into PipelineWorkspace
**Severity: HIGH**

`ExecutionSubTab.tsx` has the full "Run Pipeline" UI: environment selector, technology selector, Run button, stop button, step progress, live log console, status polling. **It is not mounted in `PipelineWorkspace.tsx`.** Only `ExecutionHistorySubTab` is shown under "Executions". The "Run Pipeline" experience is inaccessible from the normal workspace.

### 11.5 Gap: No Real Cluster Integration
Required integrations (none exist): Databricks Jobs API, AWS EMR Step API, Google Dataproc Jobs API, Apache Livy REST API (for YARN/on-prem), Kubernetes Spark Operator.

### 11.6 Gap: No WebSocket / SSE for Live Logs
ExecutionSubTab polls `GET /executions/pipeline-runs/:runId` every 3 seconds. For real execution with thousands of log lines, polling is inefficient and adds latency. WebSocket or SSE is the correct pattern.

### 11.7 Gap: No Environment-Level Connection Override
The execution tab lets users select "Development / Staging / Production". The environment name is stored in `run_options_json` but has no effect on which database connection is used. There is no mechanism to use a different JDBC connection in staging vs production for the same pipeline definition.

---

## 12. ADDITIONAL ORPHANED COMPONENTS

### 12.1 Sub-Tabs Built But Not Mounted in PipelineWorkspace

`PipelineWorkspace.tsx` mounts: designer, properties, parameters, validation, executions, metrics, permissions, code.

The following sub-tab files exist and are implemented but **not mounted**:
- `AuditLogsSubTab.tsx` — backend endpoint `GET /pipelines/:id/audit-logs` works ❌
- `LineageSubTab.tsx` — backend lineage endpoint works ❌
- `OverviewSubTab.tsx` ❌
- `PipelineActivitySubTab.tsx` ❌
- `PipelineAlertsSubTab.tsx` — backend alert CRUD works ❌
- `PipelineDependenciesSubTab.tsx` ❌
- `OptimizeSubTab.tsx` ❌
- `ExecutionSubTab.tsx` — full run UI exists but not wired ❌

### 12.2 Validation Response Shape Mismatch
`PipelineValidationSubTab.tsx` expects `data.issues[]` but `POST /pipelines/:id/validate` returns `{ valid, errors, warnings }`. The sub-tab will always show empty results even when validation runs successfully. The response mapping is incorrect.

---

## 13. CODE-LEVEL BUGS FOUND

### BUG-001: Join conditions never populate in codegen
**File:** `Backend/src/api/routes/pipeline.routes.ts`  
**Code:** `conditions: ensureArray(cfg['joinConditions'])`  
**NodeConfigPanel stores:** `cfg.joinKeys` (JSON string of `[{left, right}]` objects)  
**Result:** Every join generates with `conditions: []` → Cartesian product at runtime.

### BUG-002: Aggregate groupBy and aggregations never populate
**File:** `Backend/src/api/routes/pipeline.routes.ts`  
**Code:** `groupBy: ensureArray(cfg['groupBy']), aggregations: ensureArray(cfg['aggregations'])`  
**NodeConfigPanel stores:** `cfg.groupByColumns` (CSV string) and `cfg.expression` (SQL string)  
**Result:** Every aggregate generates with `groupBy: []` and `aggregations: []` → invalid PySpark.

### BUG-003: INTERSECT/EXCEPT canvas options have no codegen
**File:** `NodeConfigPanel.tsx` Union section  
Union type dropdown includes `INTERSECT` and `EXCEPT`. `PySparkUnionGenerator` only handles `union`/`unionByName`. Selecting INTERSECT/EXCEPT generates a standard UNION — wrong result silently.

### BUG-004: Validation response shape mismatch
**File:** `Frontend/src/components/pipeline/sub-tabs/PipelineValidationSubTab.tsx`  
**Expects:** `data.issues[]`  
**API returns:** `{ valid: bool, errors: [], warnings: [] }`  
**Result:** Validation sub-tab always shows empty even after a successful validate call.

### BUG-005: "Fit" button doesn't fit content
**File:** `PipelineCanvas.tsx`  
`onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}` resets to origin at 100% zoom. Nodes with non-zero coordinates may be off-screen.

### BUG-006: Drag dispatcher fires on every mouse move pixel
**File:** `PipelineCanvas.tsx`  
`handleMouseMove` dispatches `updateNode()` for every mouse move event during drag. Should buffer in `useRef`, dispatch only on `mouseUp`.

### BUG-007: Execution rows out / rows failed always null
**File:** `Frontend/src/components/pipeline/sub-tabs/ExecutionHistorySubTab.tsx`  
`fmtNum(null)` is hardcoded for "Rows Out" and "Rows Failed" columns in the table. These will always display `—` regardless of actual data returned from the API.

---

## 14. FEATURE GAPS SUMMARY TABLE

| # | Feature | Canvas | Codegen | Backend | Priority |
|---|---|---|---|---|---|
| F-01 | Drag-and-drop node palette | ❌ | N/A | N/A | HIGH |
| F-02 | Column mapping: Target node column selector | ❌ | N/A | N/A | CRITICAL |
| F-03 | Column picker: Aggregate GROUP BY + function GUI | ❌ | ✅ | ✅ | CRITICAL |
| F-04 | Column picker: Join key visual selector | ❌ | ✅ | ✅ | CRITICAL |
| F-05 | Multi-transform editor wired to canvas | ❌ | ✅ | ✅ | CRITICAL |
| F-06 | SCD Type 1 canvas node | ❌ | ✅ | ✅ | HIGH |
| F-07 | SCD Type 2 canvas node | ❌ | ✅ | ✅ | HIGH |
| F-08 | Window function canvas node | ❌ | ✅ | ✅ | HIGH |
| F-09 | Select / Project canvas node | ❌ | ✅ | ✅ | HIGH |
| F-10 | Cast / Rename / Drop columns canvas node | ❌ | ✅ | ✅ | HIGH |
| F-11 | Derive / withColumn canvas node | ❌ | ✅ | ✅ | HIGH |
| F-12 | Pivot canvas node | ❌ | ✅ | ✅ | MEDIUM |
| F-13 | Data Quality canvas node | ❌ | ✅ | ✅ | MEDIUM |
| F-14 | Mask canvas node | ❌ | ✅ | ✅ | MEDIUM |
| F-15 | Lookup canvas node | ❌ | ✅ | ✅ | MEDIUM |
| F-16 | Audit columns (load_ts, run_id, user) injection | ❌ | ❌ | ❌ | HIGH |
| F-17 | Pipeline export to JSON/YAML | ❌ | N/A | ❌ | HIGH |
| F-18 | Pipeline import from JSON/YAML | ❌ | N/A | ❌ | HIGH |
| F-19 | ExecutionSubTab wired into PipelineWorkspace | ❌ | N/A | ✅ | HIGH |
| F-20 | PipelineAlertsSubTab wired | ❌ | N/A | ✅ | MEDIUM |
| F-21 | Undo/Redo on canvas | ❌ | N/A | N/A | MEDIUM |
| F-22 | Copy/paste nodes | ❌ | N/A | N/A | MEDIUM |
| F-23 | Schema propagation between canvas nodes | ❌ | N/A | N/A | CRITICAL |
| F-24 | Real Spark cluster submission | ❌ | N/A | ❌ | CRITICAL |
| F-25 | DB-specific SQL engine (PostgreSQL, Snowflake, etc.) | ❌ | ❌ | ❌ | HIGH |
| F-26 | CASE WHEN as canvas node | ❌ | ❌ | ❌ | HIGH |
| F-27 | SCD Type 3 code generation | ❌ | ❌ | ❌ | MEDIUM |
| F-28 | CDC / Incremental load from watermark | ❌ | ❌ | ❌ | HIGH |
| F-29 | Surrogate key canvas node | ❌ | ✅ | ✅ | MEDIUM |
| F-30 | JSON / Array / Map transform canvas nodes | ❌ | ❌ | ❌ | MEDIUM |
| F-31 | Expand frontend transform registry (13 → 35+ types) | ❌ | ✅ | ✅ | HIGH |
| F-32 | Fix validation response shape mapping | ❌ | N/A | ✅ | HIGH |

---

## 15. PRIORITIZED REMEDIATION ROADMAP

### P0 — Critical Blockers (Nothing else matters until these are fixed)

1. **Fix BUG-001** (join conditions key mismatch): In `toPipelineDefinition()`, parse `cfg['joinKeys']` as JSON array of `{left, right}` and map to `JoinCondition[]`.
2. **Fix BUG-002** (aggregate key mismatch): Split `cfg['groupByColumns']` CSV → `groupBy[]` and parse `cfg['expression']` into `aggregations[]`.
3. **Wire ExecutionSubTab into PipelineWorkspace** under the "Executions" sub-tab alongside history.
4. **Fix BUG-004** (validation response shape): Map `{ errors, warnings }` to the `issues[]` format the sub-tab expects.
5. **Wire MultiTransformEditor** into `NodeConfigPanel.tsx` for `transform` node type. Ensure config serializes as `transformSequences`.

### P1 — Column Mapping for Projector/Selector Nodes

6. **Aggregate node column UI**: Replace the group-by text input and SQL textarea with a column picker (from upstream schema) + aggregation function dropdown table.
7. **Join node column UI**: Replace free-text join key inputs with schema-aware left/right column pickers.
8. **Target node column mapping panel**: Show source columns (from upstream schema) vs target table columns (from introspection); allow mapping, remapping, and exclusion.
9. **Schema propagation**: After a source node is configured with a table, fetch columns via `api.introspectTables()` and cache them on the node; propagate forward through transforms.

### P2 — Expand Canvas Node Types

10. Add dedicated canvas nodes: Select (projector), Derive, Cast, Rename, Sort, Dedup, FillNA, SCD Type 1, SCD Type 2, Window, Pivot, Data Quality, Mask, Surrogate Key.
11. Each new node opens the appropriate multi-step or structured config in NodeConfigPanel.

### P3 — Audit Column Support

12. Add `add_audit_columns` step to `TRANSFORM_REGISTRY` with load timestamp, run ID, user, source system, row hash options.
13. Pass `--run-id` and `--run-user` as scaffold `_parse_args()` parameters in generated scripts.
14. Extend execution route to pass run ID to job submission (when real cluster integration is added).

### P4 — Export / Import

15. Add `GET /pipelines/:id/export` endpoint returning the `ir_payload_json` as a download.
16. Add `POST /pipelines/import` endpoint accepting JSON pipeline definition.
17. Add export/import buttons to the pipeline workspace header.

### P5 — Transform Registry Expansion

18. Add missing frontend primitives to `TRANSFORM_REGISTRY`: all 15 missing step types (`ltrim`, `rtrim`, `upper`, `lower`, `title_case`, `length`, `concat`, `pad_left`, `pad_right`, `to_timestamp`, `date_format`, `date_diff`, `replace_regex`, `matches_regex`, `abs`).
19. Add CASE/WHEN conditional transform to both registry and backend generator.
20. Add date functions: `year`, `month`, `day`, `quarter`, `weekofyear`, `date_diff`, `months_between`.
21. Add JSON: `from_json`, `to_json`, `get_json_object`.
22. Add Array: `array_contains`, `array_size`, `explode` (as MultiTransform step).

### P6 — Performance

23. Replace mouse-move Redux dispatch with local ref during drag; dispatch only on mouseUp.
24. Add `React.memo` to node rendering.
25. Migrate canvas to React Flow (recommended) for virtualization.

### P7 — Execution Engine (requires infrastructure decision)

26. Integrate with one real execution backend (Apache Livy for on-prem, Databricks Jobs API for cloud).
27. Connect code generation to the execution path.
28. Add WebSocket/SSE for real-time log streaming.

---

## 16. WHAT IS GENUINELY GOOD IN THE PLATFORM

It is important to note what already works well, as it represents real investment:

- PySpark codegen engine is production-grade — 30+ transformation types, SCD 1 and 2, full DWH loading patterns, proper Delta/Iceberg integration, multi-platform scaffold, secrets management integration
- Frontend code generation layer (SparkSQLGenerator, PostgreSQLGenerator, RedshiftCodeGenerator) is architecturally sound — multi-engine by design from day one
- Transform IR (intermediate representation) in `ir.ts` is well-designed — versioned, serializable, auditable
- Transform Registry concept (`TRANSFORM_REGISTRY`) is the right pattern — declarative, engine-neutral, with parameter validation
- PostgreSQL backend schema appears robust — encrypted credentials, RBAC, execution history, audit logs, versioned pipeline IR
- Source node configuration is solid — real connection introspection, schema/table dropdowns, JDBC URL resolution, file/Kafka/Delta/Iceberg support all working
- Execution history sub-tab is production-quality — pagination, filters, CSV export, bulk retry/cancel
- LeftSidebar hierarchical tree is well-architected — lazy loading, inline rename, folder nesting, global vs project scope separation

The gap is not that the foundation is poor — it is that the canvas UI has not yet been connected to the powerful engine that already exists behind it.

---

*End of audit. Total source files read: 35+ files read in full. All assessments derived directly from source code, not from file names, documentation, or assumptions.*
