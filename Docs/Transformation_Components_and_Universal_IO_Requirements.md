# Transformation Components, Universal I/O, Compression & Lakehouse SCD
## Enterprise ETL Platform — Detailed Requirements Document v1.0

---

## Table of Contents

1. [Overview & Scope](#1-overview--scope)
2. [Transformation Component Catalogue](#2-transformation-component-catalogue)
   - 2.1 [Set Operation Components](#21-set-operation-components)
   - 2.2 [Join Components](#22-join-components)
   - 2.3 [Aggregate Components](#23-aggregate-components)
   - 2.4 [Analytical / Window Function Components](#24-analytical--window-function-components)
   - 2.5 [Pivot & Unpivot Components](#25-pivot--unpivot-components)
   - 2.6 [Filter & Conditional Components](#26-filter--conditional-components)
   - 2.7 [Expression & Derived Column Components](#27-expression--derived-column-components)
   - 2.8 [Deduplication & Sort Components](#28-deduplication--sort-components)
   - 2.9 [Schema & Type Components](#29-schema--type-components)
   - 2.10 [Lookup Components](#210-lookup-components)
   - 2.11 [Sampling & Splitting Components](#211-sampling--splitting-components)
   - 2.12 [String Processing Components](#212-string-processing-components)
   - 2.13 [Date & Time Components](#213-date--time-components)
   - 2.14 [Numeric & Math Components](#214-numeric--math-components)
   - 2.15 [JSON & XML Components](#215-json--xml-components)
   - 2.16 [Array & Struct Components](#216-array--struct-components)
   - 2.17 [Data Quality Components](#217-data-quality-components)
   - 2.18 [SCD Components](#218-scd-components)
   - 2.19 [Surrogate Key & Sequence Components](#219-surrogate-key--sequence-components)
   - 2.20 [Audit & Metadata Injection Components](#220-audit--metadata-injection-components)
3. [Code Generation Coverage Matrix](#3-code-generation-coverage-matrix)
4. [Universal Read/Write Support](#4-universal-readwrite-support)
   - 4.1 [Read Support Matrix](#41-read-support-matrix)
   - 4.2 [Write Support Matrix](#42-write-support-matrix)
   - 4.3 [Cross-Technology I/O Examples](#43-cross-technology-io-examples)
5. [Compression Support](#5-compression-support)
6. [Lakehouse SCD Support](#6-lakehouse-scd-support)
   - 6.1 [Delta Lake](#61-delta-lake)
   - 6.2 [Apache Iceberg](#62-apache-iceberg)
   - 6.3 [Apache Hudi](#63-apache-hudi)
   - 6.4 [Snowflake](#64-snowflake)
   - 6.5 [BigQuery](#65-bigquery)
   - 6.6 [Azure Synapse Analytics](#66-azure-synapse-analytics)
   - 6.7 [Databricks](#67-databricks)
7. [Write Mode Semantics](#7-write-mode-semantics)
8. [Performance Standards & Optimisation Requirements](#8-performance-standards--optimisation-requirements)
9. [Data Model Additions](#9-data-model-additions)
10. [API Additions](#10-api-additions)
11. [Acceptance Criteria](#11-acceptance-criteria)

---

## 1. Overview & Scope

### 1.1 Purpose
This document defines:

1. **Every transformation component** available to pipeline designers — covering set operations, joins, aggregation, analytical functions, pivot/unpivot, data quality, SCD, and all supporting utility transforms — expressed as first-class visual canvas nodes with full property panels.

2. **Universal I/O** — every supported technology must have parity between read and write operations; no technology is read-only unless it is architecturally impossible to write to it.

3. **Compression** — comprehensive compression codec support on all file-based and object-store writes and reads.

4. **Lakehouse SCD** — SCD Type 1 and Type 2 targeting Delta Lake, Iceberg, Hudi, Snowflake, BigQuery, Azure Synapse, and Databricks using platform-native merge/upsert mechanisms (MERGE INTO Delta, Iceberg MERGE, BigQuery MERGE scripting, Snowflake MERGE).

5. **Code Generation Coverage** — explicit cross-reference of every transformation component against PySpark, Scala Spark, and InDB SQL code generators to ensure zero gaps.

### 1.2 Governing Standards
- **Apache Spark 3.5** as the distributed compute standard
- **SQL:2016** as the SQL standard baseline
- **Delta Lake 3.x** / **Iceberg 1.x** / **Hudi 0.14+** for lakehouse targets
- **Snappy as default compression** for columnar formats; **GZIP as default** for text formats
- **Parquet as preferred columnar format** for intermediate data
- **Zero data loss guarantee**: every write operation must be atomic or have compensating logic

---

## 2. Transformation Component Catalogue

Each component is a canvas node with:
- **Properties Panel**: configures the operation (right-side drawer)
- **Input Ports**: named data stream inputs (left side of node)
- **Output Ports**: named data stream outputs (right side of node)
- **Code Preview**: shows the generated PySpark / Scala / SQL for this node in real time
- **Validation**: inline error/warning badges if configuration is incomplete or incompatible
- **Documentation Tab**: inline help within the properties panel
- **Test Row Count**: shows live row count estimate based on upstream node output (lazy, on demand)

---

### 2.1 Set Operation Components

#### 2.1.1 UNION (Deduplicating)
**Purpose**: Combine two or more datasets and remove duplicate rows.

**Input Ports**: 2 to N (dynamic — user can add inputs)
**Output Ports**: 1

**Properties**:
| Property | Type | Description |
|---|---|---|
| Inputs | Port list | 2–N input streams |
| Column Alignment | SELECT: BY_POSITION / BY_NAME / MANUAL | How columns are matched across inputs |
| Column Mapping | Table | For MANUAL: map input A col → output col, input B col → output col |
| Output Schema | Auto-derived or manual | Union of all input schemas |
| Null Handling | INCLUDE / EXCLUDE_ALL_NULL_ROWS | Whether rows where all columns are null are dropped |
| Performance Hint | REPARTITION_BEFORE_DISTINCT / NONE | Repartition before dedup for large datasets |

**Code Generation:**
- PySpark: `df_a.unionByName(df_b).distinct()` (or `.union()` with positional)
- Scala: `dfA.unionByName(dfB).distinct()`
- SQL: `SELECT ... FROM a UNION SELECT ... FROM b`

**Validation Rules**:
- Column count must match (for BY_POSITION mode)
- Column types must be compatible or explicitly cast
- At least 2 inputs required

---

#### 2.1.2 UNION ALL (Non-Deduplicating)
**Purpose**: Combine datasets retaining all rows including duplicates.

Same as UNION but no distinct step.

**Code Generation:**
- PySpark: `df_a.unionByName(df_b, allowMissingColumns=True)`
- SQL: `SELECT ... UNION ALL SELECT ...`

**Configuration additions over UNION:**
| Property | Description |
|---|---|
| Allow Missing Columns | Fills NULL for columns absent in some inputs |
| Missing Column Fill | NULL / ZERO / EMPTY_STRING / CUSTOM_VALUE |
| Add Source Tag | Adds `_source_stream` column indicating which input stream the row came from |
| Source Tag Column Name | Default: `_source_tag` |
| Source Tag Values | User-defined label per input port |

---

#### 2.1.3 INTERSECT
**Purpose**: Return only rows present in ALL input datasets.

**Input Ports**: 2
**Output Ports**: 1

**Properties**:
| Property | Description |
|---|---|
| Column Alignment | BY_POSITION / BY_NAME |
| Distinct | INTERSECT (distinct, default) / INTERSECT ALL (retain duplicates — emulated in Spark) |
| Comparison Columns | All columns (default) / selected subset of columns |

**Code Generation:**
- PySpark: `df_a.intersect(df_b)` / for INTERSECT ALL: self-join pattern
- SQL: `SELECT ... INTERSECT SELECT ...`

---

#### 2.1.4 EXCEPT / MINUS
**Purpose**: Return rows from the left input that do NOT appear in the right input.

**Input Ports**: 2 (Left, Right)
**Output Ports**: 1

**Properties**:
| Property | Description |
|---|---|
| Mode | EXCEPT (distinct) / EXCEPT ALL (retain duplicates — emulated) |
| Comparison Columns | All / subset |
| Output | LEFT_ONLY (default) / RIGHT_ONLY / SYMMETRIC_DIFFERENCE |

**Code Generation:**
- PySpark: `df_a.subtract(df_b)`
- SQL: `SELECT ... EXCEPT SELECT ...` / `SELECT ... MINUS SELECT ...` (Oracle/Teradata)

---

#### 2.1.5 ZIP / INTERLEAVE
**Purpose**: Row-number-based combination of two datasets (positional pairing).

**Properties**:
| Property | Description |
|---|---|
| Join Key | ROW_NUMBER (default) / user-defined sort order for deterministic pairing |
| Mismatch Policy | TRUNCATE_TO_SHORTER / PAD_WITH_NULL / FAIL |

**Code Generation:**
- PySpark: ROW_NUMBER window function + join on rn

---

### 2.2 Join Components

#### 2.2.1 Inner Join
**Purpose**: Return rows with matching keys in both left and right datasets.

**Input Ports**: 2 (Left, Right)
**Output Ports**: 1 (Matched)

**Properties**:
| Property | Type | Description |
|---|---|---|
| Left Input | Port | Left dataset |
| Right Input | Port | Right dataset |
| Join Conditions | List | One or more equality conditions: Left.col = Right.col |
| Non-Equality Conditions | Expression | Additional WHERE-style conditions (e.g., L.date BETWEEN R.start AND R.end) |
| Column Selection | Picker | Which columns from left and right to include in output |
| Column Conflict Resolution | PREFIX_LEFT / PREFIX_RIGHT / RENAME_MANUAL / DROP_RIGHT | For duplicate column names |
| Broadcast Hint | AUTO / FORCE_LEFT / FORCE_RIGHT / NONE | For Spark broadcast join optimization |
| Output Row Count Estimate | Display only | Estimated output based on upstream stats |

**Code Generation:**
- PySpark: `df_left.join(df_right, join_conditions, 'inner')`
- SQL: `SELECT ... FROM left INNER JOIN right ON ...`

---

#### 2.2.2 Left Outer Join
Returns all rows from left; nulls for right where no match.

Same properties as Inner Join. Additional:
| Property | Description |
|---|---|
| Null Fill Strategy | For right-side null columns: NULL (default) / DEFAULT_VALUE / EXPRESSION |
| Null Fill Value | Configurable per column |

**Code Generation:**
- PySpark: `df_left.join(df_right, cond, 'left')`
- SQL: `LEFT OUTER JOIN`

---

#### 2.2.3 Right Outer Join
Returns all rows from right; nulls for left where no match.
**Code Generation:** `'right'` / `RIGHT OUTER JOIN`

---

#### 2.2.4 Full Outer Join
Returns all rows from both; nulls where no match.
**Code Generation:** `'full'` / `FULL OUTER JOIN`

---

#### 2.2.5 Left Semi Join
Returns only rows from the left that have at least one match in the right. No columns from right in output.

| Property | Description |
|---|---|
| Join Condition | Left.col = Right.col |
| Equivalent Pattern | WHERE EXISTS (SELECT 1 FROM right WHERE ...) |

**Code Generation:**
- PySpark: `df_left.join(df_right, cond, 'leftsemi')`
- SQL: `WHERE EXISTS (subquery)` or `INNER JOIN ... SELECT left.*`

---

#### 2.2.6 Left Anti Join
Returns only rows from left that have NO match in right. Inverse of semi join.

**Code Generation:**
- PySpark: `df_left.join(df_right, cond, 'leftanti')`
- SQL: `WHERE NOT EXISTS (subquery)` or `LEFT JOIN ... WHERE right.key IS NULL`

---

#### 2.2.7 Cross Join (Cartesian Product)
Returns every combination of rows from both inputs. WARNING badge shown; row count estimate displayed to warn user.

| Property | Description |
|---|---|
| Max Output Rows Guard | Platform aborts if estimated cross product exceeds N rows (default: 10M) |
| Filter After Join | Optional WHERE condition applied after cross join |

**Code Generation:**
- PySpark: `df_left.crossJoin(df_right).filter(...)`
- SQL: `CROSS JOIN`

---

#### 2.2.8 Non-Equi Join (Theta Join)
Join on non-equality conditions: range joins, inequality conditions.

| Property | Description |
|---|---|
| Condition Expression | Full boolean expression (e.g., L.price BETWEEN R.min_price AND R.max_price) |
| Join Type | INNER / LEFT / FULL |
| Range Join Optimization | ON (enables Spark 3.x range join optimization when applicable) |

**Code Generation:**
- PySpark: `df_left.join(df_right, expr(condition), 'inner')`
- Spark 3.3+: `join(...).hint('range_join', bucket_size)` for range joins

---

#### 2.2.9 Self Join
Joins a dataset with itself. Platform handles aliasing automatically.

| Property | Description |
|---|---|
| Left Alias | Default: `left` |
| Right Alias | Default: `right` |
| Join Condition | Uses alias-prefixed columns |

---

#### 2.2.10 Lookup Join
Optimized read-from-reference-table pattern. The "right" side is a cached/broadcast reference dataset.

| Property | Description |
|---|---|
| Lookup Source | Reference table from metadata catalog or another pipeline output |
| Lookup Key Columns | Columns to match on |
| Output Columns | Columns to bring from lookup |
| Not Found Policy | NULL / DEFAULT_VALUE / REJECT_ROW / FAIL_PIPELINE |
| Cache Strategy | BROADCAST (default for small tables) / CACHE / DYNAMIC |
| Refresh Policy | ONCE_PER_EXECUTION / EVERY_N_ROWS / ON_KEY_MISS |

---

#### 2.2.11 Multi-Way Join (N-Way)
Joins 3 or more datasets in a single node. Platform generates left-deep join tree.

| Property | Description |
|---|---|
| Inputs | 3–N input ports |
| Join Pairs | List of (left_port, right_port, condition, join_type) |
| Join Order | Auto-optimize (smallest first) / manual |
| Broadcast Candidates | Mark small inputs for broadcast |

---

### 2.3 Aggregate Components

#### 2.3.1 Group By Aggregate
**Purpose**: GROUP BY with one or more aggregate functions.

**Input Ports**: 1
**Output Ports**: 1 (aggregated), optional 1 (ungrouped passthrough rows if CUBE/ROLLUP)

**Properties**:
| Property | Description |
|---|---|
| Group By Columns | Multi-select from input schema |
| Aggregate Functions | List: (output_column_name, function, input_column, options) |
| HAVING Clause | Filter on aggregate result |
| Grouping Sets | NONE / ROLLUP / CUBE / GROUPING SETS (custom) |
| Null Treatment | IGNORE NULLS / INCLUDE NULLS per function |
| Distinct Aggregation | Mark specific functions as COUNT DISTINCT / SUM DISTINCT |
| Output Sort | Sort by group key after aggregation |

**Supported Aggregate Functions:**
| Function | Description | Distinct Support |
|---|---|---|
| COUNT(*) | Row count | N/A |
| COUNT(col) | Non-null count | ✓ (COUNT DISTINCT) |
| SUM(col) | Sum | ✓ |
| AVG(col) | Average | ✓ |
| MIN(col) | Minimum | — |
| MAX(col) | Maximum | — |
| STDDEV_POP / STDDEV_SAMP | Standard deviation | — |
| VAR_POP / VAR_SAMP | Variance | — |
| MEDIAN(col) | Median (exact or approx) | — |
| PERCENTILE(col, p) | Exact percentile | — |
| APPROX_PERCENTILE(col, p, accuracy) | Approximate percentile (HyperLogLog) | — |
| FIRST(col, ignoreNulls) | First value in group | — |
| LAST(col, ignoreNulls) | Last value in group | — |
| COLLECT_LIST(col) | Array of all values | — |
| COLLECT_SET(col) | Distinct values as array | — |
| STRING_AGG(col, sep) | Concatenated string | ✓ |
| CORR(col1, col2) | Pearson correlation | — |
| COVAR_POP / COVAR_SAMP | Covariance | — |
| KURTOSIS(col) | Kurtosis | — |
| SKEWNESS(col) | Skewness | — |
| BOOL_AND / EVERY | Logical AND across group | — |
| BOOL_OR / ANY | Logical OR across group | — |
| BIT_AND / BIT_OR / BIT_XOR | Bitwise aggregates | — |
| HISTOGRAM_NUMERIC | Histogram as array of structs | — |
| APPROX_COUNT_DISTINCT | HyperLogLog distinct count | — |
| MODE(col) | Most frequent value | — |
| REGR_SLOPE / REGR_INTERCEPT | Linear regression | — |
| CUSTOM | User-defined aggregate expression | — |

**Code Generation:**
- PySpark: `df.groupBy(*group_cols).agg(F.sum('col').alias('sum_col'), ...)`
- SQL: `SELECT group_cols, SUM(col) AS sum_col ... GROUP BY group_cols HAVING ...`
- ROLLUP: `df.rollup(*group_cols).agg(...)` / `GROUP BY ROLLUP(a,b)`
- CUBE: `df.cube(*group_cols).agg(...)` / `GROUP BY CUBE(a,b)`
- GROUPING SETS: SQL `GROUP BY GROUPING SETS((a),(b),(a,b))`

---

#### 2.3.2 Running Aggregate (Cumulative)
Cumulative aggregation without explicit GROUP BY — aggregate grows with each row.

| Property | Description |
|---|---|
| Aggregate Function | SUM / COUNT / MIN / MAX / AVG |
| Partition By | Optional — reset accumulation per partition |
| Order By | Required — defines accumulation order |
| Frame | UNBOUNDED PRECEDING TO CURRENT ROW (default) |

**Code Generation:** Spark Window function (see 2.4)

---

#### 2.3.3 Distinct Count (Exact & Approximate)
Dedicated node for count distinct operations with accuracy control.

| Property | Description |
|---|---|
| Columns | Columns to count distinct on |
| Mode | EXACT (COUNT DISTINCT) / APPROXIMATE (HyperLogLog) |
| HLL Accuracy | 0.01–0.20 (default: 0.05) |
| Group By | Optional grouping |

---

### 2.4 Analytical / Window Function Components

#### 2.4.1 Window Function Node
**Purpose**: Apply any SQL window function (OVER clause) to a dataset.

**Input Ports**: 1
**Output Ports**: 1 (original columns + new window columns)

**Properties**:
| Property | Description |
|---|---|
| Window Definitions | List of named windows: (name, PARTITION BY cols, ORDER BY cols + direction, FRAME) |
| Window Functions | List: (output_col, function, window_name) |
| Keep Original Columns | YES / NO |
| Null Ordering | NULLS FIRST / NULLS LAST per ORDER BY column |

**Window Frame Types:**
| Frame | Syntax |
|---|---|
| ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW | Cumulative |
| ROWS BETWEEN N PRECEDING AND CURRENT ROW | Rolling N rows |
| ROWS BETWEEN N PRECEDING AND N FOLLOWING | Centered window |
| RANGE BETWEEN INTERVAL '7 days' PRECEDING AND CURRENT ROW | Time-based rolling window |
| ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING | From current to end |
| ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING | Entire partition |

**Supported Window Functions:**
| Category | Functions |
|---|---|
| **Ranking** | ROW_NUMBER(), RANK(), DENSE_RANK(), PERCENT_RANK(), CUME_DIST(), NTILE(n) |
| **Offset** | LAG(col, n, default), LEAD(col, n, default), FIRST_VALUE(col, ignoreNulls), LAST_VALUE(col, ignoreNulls), NTH_VALUE(col, n) |
| **Aggregate** | SUM, COUNT, AVG, MIN, MAX, STDDEV, VAR, COLLECT_LIST, STRING_AGG (all with OVER) |
| **Statistical** | PERCENTILE_CONT(p), PERCENTILE_DISC(p), MEDIAN |
| **Custom** | User-defined expression in OVER clause |

**Code Generation:**
```python
# PySpark
from pyspark.sql import Window
w = Window.partitionBy('dept').orderBy('salary').rowsBetween(-6, 0)
df.withColumn('rolling_avg', F.avg('salary').over(w))
```
```sql
-- SQL
AVG(salary) OVER (PARTITION BY dept ORDER BY salary ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)
```

---

#### 2.4.2 Rank Node (Simplified)
Dedicated node for common ranking patterns with simplified UI.

| Property | Description |
|---|---|
| Rank Function | ROW_NUMBER / RANK / DENSE_RANK / NTILE(n) |
| Partition By | Optional grouping for reset |
| Order By | Required; defines rank order |
| Output Column Name | Default: `_rank` |
| Keep Only Top N | Optional: filter to top N per partition after ranking |

---

#### 2.4.3 Lag / Lead Node
Simplified access to previous/next row values.

| Property | Description |
|---|---|
| Function | LAG / LEAD |
| Column | Column to access from previous/next row |
| Offset | Number of rows back/forward (default: 1) |
| Default Value | Value when no row exists at offset |
| Partition By | Optional |
| Order By | Required |
| Output Column | User-named |

---

#### 2.4.4 Running Total / Moving Average (UI Shortcut)
Simplified node for the most common window patterns.

| Property | Description |
|---|---|
| Pattern | CUMULATIVE_SUM / CUMULATIVE_COUNT / MOVING_AVG / MOVING_SUM / MOVING_MIN / MOVING_MAX |
| Column | Input column |
| Window Size | N rows (for MOVING patterns) |
| Partition By | Optional |
| Order By | Required |

---

#### 2.4.5 Sessionization Node
Groups events into sessions based on time gap between events.

| Property | Description |
|---|---|
| User/Entity Key | Column identifying the entity |
| Timestamp Column | Event timestamp |
| Session Timeout | Inactivity gap in seconds/minutes that starts a new session |
| Session ID Column | Output column for session identifier |
| Session Start / End Columns | Optional output columns |
| Session Duration Column | Optional |
| Event Count Per Session | Optional |

**Code Generation:**
- PySpark: LAG window function to detect gap; conditional SUM to assign session IDs

---

### 2.5 Pivot & Unpivot Components

#### 2.5.1 PIVOT Node
**Purpose**: Transform row values into column headers (wide format).

**Input Ports**: 1
**Output Ports**: 1

**Properties**:
| Property | Description |
|---|---|
| Row Identifier Columns | Columns that identify each entity (these remain as rows) |
| Pivot Column | The column whose distinct values become new column headers |
| Value Column | The column whose values populate the pivoted cells |
| Aggregate Function | SUM / COUNT / MAX / MIN / AVG / FIRST / LAST |
| Pivot Values | EXPLICIT (user-lists values) / AUTO_DETECT (scan distinct values — expensive) |
| Explicit Values | List of values from Pivot Column that become column headers |
| Missing Value Fill | NULL / ZERO / CUSTOM |
| Column Name Pattern | Pattern for output column names: `{pivot_col}_{value}` / `{value}` / custom |
| Column Name Sanitize | Replace special characters in generated column names |
| Max Columns Guard | Abort if AUTO_DETECT generates more than N columns (default: 500) |

**Code Generation:**
```python
# PySpark
df.groupBy(*id_cols).pivot('quarter', ['Q1','Q2','Q3','Q4']).agg(F.sum('revenue'))
```
```sql
-- SQL Server / Oracle
SELECT * FROM (SELECT id, quarter, revenue FROM t) AS src
PIVOT (SUM(revenue) FOR quarter IN ([Q1],[Q2],[Q3],[Q4])) AS pvt
```

**Note on Databases:**
- PostgreSQL: emulated via CASE WHEN aggregate pattern (no native PIVOT)
- Oracle 11g+: native PIVOT
- SQL Server: native PIVOT
- Teradata: emulated via CASE WHEN
- Snowflake: emulated via CASE WHEN
- BigQuery: native PIVOT (SQL 2022)
- Spark: native `.pivot()`

---

#### 2.5.2 UNPIVOT Node
**Purpose**: Transform column headers into row values (long format / melt).

**Input Ports**: 1
**Output Ports**: 1

**Properties**:
| Property | Description |
|---|---|
| Identity Columns | Columns to keep as-is (not unpivoted) |
| Value Columns | Columns to unpivot (their names become values in Name Column) |
| Name Column | Output column that holds the original column names |
| Value Column | Output column that holds the original column values |
| Name Column Label | Default: `metric_name` |
| Value Column Label | Default: `metric_value` |
| Null Handling | INCLUDE (default) / EXCLUDE (drop rows where value is null) |
| Multi-Value Unpivot | Multiple value columns grouped together (Spark 3.4+ UNPIVOT syntax) |

**Code Generation:**
```python
# PySpark (stack function)
df.select(
    'id',
    F.expr("stack(4, 'Q1', Q1, 'Q2', Q2, 'Q3', Q3, 'Q4', Q4) as (quarter, revenue)")
)
```
```sql
-- SQL Server
SELECT id, quarter, revenue FROM t
UNPIVOT (revenue FOR quarter IN ([Q1],[Q2],[Q3],[Q4])) AS unpvt
-- BigQuery / Spark 3.4
UNPIVOT(revenue FOR quarter IN (Q1, Q2, Q3, Q4))
```

---

#### 2.5.3 TRANSPOSE Node
Full matrix transpose: rows become columns, columns become rows.
Platform generates: pivot-all pattern with dynamic column detection.
WARNING: deterministic only when combined with explicit sort.

---

### 2.6 Filter & Conditional Components

#### 2.6.1 Filter / WHERE Node
**Input Ports**: 1
**Output Ports**: 1 (matching), optional 1 (non-matching — for error/audit routing)

**Properties**:
| Property | Description |
|---|---|
| Filter Expression | Boolean expression builder (visual AND/OR tree OR raw SQL/Spark expression) |
| Expression Mode | VISUAL / SQL_EXPR / SPARK_EXPR |
| Output Non-Matching | YES / NO; if YES, second output port activated |
| Non-Match Port Label | Default: `rejected` |
| Stats Collection | Count matching vs non-matching rows (small overhead) |

**Code Generation:**
- PySpark: `df.filter(expr(condition))`
- SQL: `WHERE condition`

---

#### 2.6.2 Conditional Split Node
**Purpose**: Route rows to different output ports based on evaluated conditions.

**Input Ports**: 1
**Output Ports**: 2 to N (dynamic)

**Properties**:
| Property | Description |
|---|---|
| Conditions | Ordered list of (label, boolean_expression) — first match wins |
| Default Output | Which port receives rows matching no condition |
| Evaluation Order | TOP_DOWN_FIRST_MATCH (default) / ALL_MATCHING (row goes to all matching ports) |
| Output Port Labels | User-defined name per port |

**Example Output Ports:** `high_value_customers`, `medium_value`, `low_value`, `unclassified`

---

#### 2.6.3 Case / Switch Node
**Purpose**: Add a computed column based on CASE WHEN logic.

**Properties**:
| Property | Description |
|---|---|
| Input Column | Column to evaluate (CASE col WHEN) or expression (CASE WHEN expr) |
| Conditions | List of (WHEN condition, THEN value) |
| ELSE Value | Default value when no condition matches |
| Output Column | Name of the new column |
| Output Type | Inferred or explicit |
| Replace Mode | ADD_COLUMN / REPLACE_EXISTING |

---

#### 2.6.4 Null Filter Node
Quickly filter or route rows based on null presence.

**Properties**: Column multi-select; policy: DROP_IF_ANY_NULL / DROP_IF_ALL_NULL / DROP_IF_NULL_IN_KEY_COLS; non-null output port + null output port.

---

### 2.7 Expression & Derived Column Components

#### 2.7.1 Derived Column Node
**Purpose**: Add one or more computed columns using expressions.

**Properties**: list of (output_column_name, expression, type_override). Expressions support:
- Arithmetic: +, -, *, /, %, **
- String: CONCAT, SUBSTRING, TRIM, UPPER, LOWER, REPLACE, REGEXP_REPLACE, SPLIT, LENGTH, LPAD, RPAD, REVERSE, FORMAT
- Conditional: IF, IFF, CASE, COALESCE, NULLIF, NVL
- Type conversion: CAST, TRY_CAST, TO_DATE, TO_TIMESTAMP, TO_NUMBER
- Array/Struct: GET, EXPLODE, ARRAY_CONTAINS, MAP_KEYS
- Hashing: MD5, SHA1, SHA256, SHA512, CRC32, HASH (platform-neutral)
- Encoding: BASE64_ENCODE, BASE64_DECODE, URL_ENCODE, URL_DECODE, HEX
- Business: DATEDIFF, DATE_ADD, DATE_FORMAT, LAST_DAY, NEXT_DAY
- Statistical: ROUND, FLOOR, CEIL, ABS, SIGN, SQRT, LOG, POW, EXP
- Regex: REGEXP_EXTRACT, REGEXP_EXTRACT_ALL, RLIKE

Monaco editor with autocomplete for column names and function library.

---

#### 2.7.2 Column Rename Node
Mass rename with pattern support.

**Properties**: table of (source_col → target_col); pattern rename: prefix add/remove, suffix add/remove, regex replace, snake_to_camel, camel_to_snake.

---

#### 2.7.3 Column Select / Drop Node
Choose columns to keep or drop.

**Properties**: INCLUDE mode (select to keep) or EXCLUDE mode (select to drop); pattern select (e.g., keep all columns starting with `dim_`); reorder by drag-and-drop.

---

#### 2.7.4 Column Reorder Node
Drag-and-drop column reordering without adding/removing columns.

---

#### 2.7.5 Type Cast Node
Explicit type conversion with error handling.

**Properties**: list of (column, target_type, error_policy: FAIL / NULL / DEFAULT_VALUE); TRY_CAST mode; date/timestamp format strings per column.

---

### 2.8 Deduplication & Sort Components

#### 2.8.1 Deduplication Node

**Properties**:
| Property | Description |
|---|---|
| Dedup Key Columns | Columns that define a "duplicate" |
| Keep Strategy | KEEP_FIRST / KEEP_LAST / KEEP_MAX_BY / KEEP_MIN_BY |
| Order By (for KEEP_FIRST/LAST) | Sort definition to determine first/last |
| Max By / Min By Column | For KEEP_MAX_BY / KEEP_MIN_BY |
| Full Row Dedup | Dedup on ALL columns (exact duplicate removal) |
| Stats | Count duplicates removed |

**Code Generation:**
```python
# PySpark
w = Window.partitionBy(*key_cols).orderBy(F.desc('updated_at'))
df.withColumn('rn', F.row_number().over(w)).filter('rn = 1').drop('rn')
# OR for full dedup:
df.dropDuplicates()
# OR:
df.dropDuplicates(subset=key_cols)
```

---

#### 2.8.2 Sort / Order By Node

**Properties**:
| Property | Description |
|---|---|
| Sort Columns | List of (column, ASC/DESC, NULLS_FIRST/NULLS_LAST) |
| Scope | GLOBAL (total order) / PARTITION_BY (within partitions) |
| Partition By Columns | For PARTITION scope |
| Performance Warning | Global sort is expensive on large datasets — warning shown |
| Repartition Before Sort | Number of output partitions for GLOBAL sort |

**Code Generation:**
- PySpark: `df.orderBy(...)` / `df.sortWithinPartitions(...)`
- SQL: `ORDER BY`

---

#### 2.8.3 Limit / Sample Node

**Properties**:
| Property | Description |
|---|---|
| Mode | LIMIT_N / FRACTION_SAMPLE / STRATIFIED_SAMPLE |
| N | Row count for LIMIT_N |
| Fraction | 0.0–1.0 for FRACTION_SAMPLE |
| With Replacement | YES / NO for FRACTION_SAMPLE |
| Random Seed | For reproducibility |
| Stratify Column | For STRATIFIED_SAMPLE |
| Stratum Fractions | Per-value fractions |

---

### 2.9 Schema & Type Components

#### 2.9.1 Schema Mapper Node
Visual column mapping between source schema and target schema.

**Properties**: drag-and-drop mapping; auto-map by name / by position / by type similarity; unmapped source columns: DROP / PASS_THROUGH; unmapped target columns: NULL / FAIL; type mismatch: CAST / FAIL / WARN.

---

#### 2.9.2 Schema Validator Node
Assert schema matches expected definition. Pipeline fails if schema drifts.

**Properties**: expected schema (captured at design time or from metadata catalog); validation rules: EXACT_MATCH / SUBSET (source has at least expected cols) / SUPERSET; on failure: FAIL / WARN / LOG.

---

#### 2.9.3 Flatten / Explode Node
Flatten nested structs and arrays into rows or columns.

| Property | Description |
|---|---|
| Mode | EXPLODE_ARRAY (row per element) / EXPLODE_ARRAY_WITH_INDEX / FLATTEN_STRUCT / EXPLODE_MAP |
| Column | Nested column to explode/flatten |
| Outer Explode | EXPLODE_OUTER — retain row even if array is empty/null |
| Max Depth | For recursive flatten |
| Naming Pattern | For flattened struct fields: `{parent}_{child}` |

---

#### 2.9.4 Struct Builder Node
Construct a STRUCT column from multiple columns.

**Properties**: list of (field_name, source_column); output column name; nested structs supported.

---

#### 2.9.5 Array Builder Node
Construct ARRAY columns from multiple columns or from grouped rows.

---

### 2.10 Lookup Components

See 2.2.10 for Lookup Join. Additional dedicated components:

#### 2.10.1 Value Replace / Map Node
Replace specific values in a column using a mapping table.

**Properties**: column; mapping table (source_value → target_value) — inline or from reference table; unmatched values: KEEP / NULL / DEFAULT; case-sensitive: YES / NO.

---

#### 2.10.2 Fuzzy Match Node
Approximate string matching using edit distance / phonetic algorithms.

| Property | Description |
|---|---|
| Match Algorithm | LEVENSHTEIN / JARO_WINKLER / SOUNDEX / METAPHONE / NGRAM |
| Match Threshold | 0.0–1.0 similarity score |
| Left Column | Column in main stream |
| Right Dataset | Reference dataset to match against |
| Right Column | Column in reference dataset |
| Output: Match Score | YES / NO |
| Output: Matched Value | The matched reference value |

---

### 2.11 Sampling & Splitting Components

#### 2.11.1 Random Split Node
Split dataset into N portions by percentage.

**Properties**: list of (port_label, percentage); must sum to 100%; random seed; with/without replacement.

---

#### 2.11.2 Stratified Split Node
Split proportionally preserving category distribution.

**Properties**: stratify column; split fractions per stratum; output ports per split.

---

#### 2.11.3 Hash Partition Split Node
Route rows deterministically to output ports based on hash of key columns.

**Properties**: key columns; number of output ports (2–N); hash function: HASH / MURMUR3 / MD5.

---

#### 2.11.4 Time-Based Split Node
Route rows to different outputs based on date/timestamp criteria.

---

### 2.12 String Processing Components

#### 2.12.1 String Transform Node
Bulk string operations on one or more columns.

**Operations**: UPPER, LOWER, TRIM (BOTH/LEADING/TRAILING), LTRIM, RTRIM, PAD_LEFT, PAD_RIGHT, TRUNCATE_AT_N, REMOVE_WHITESPACE, REMOVE_SPECIAL_CHARS, NORMALIZE_UNICODE, REMOVE_DIACRITICS, CAMEL_TO_SNAKE, SNAKE_TO_CAMEL, TITLE_CASE.

---

#### 2.12.2 Regex Transform Node
Apply regex operations to string columns.

**Operations**: EXTRACT (first match, capture group), EXTRACT_ALL (all matches as array), REPLACE (with literal or back-reference), SPLIT (to array), TEST (boolean: matches / not), NAMED_GROUPS (extract named capture groups as separate columns).

---

#### 2.12.3 String Split / Tokenize Node
Split string column into array or multiple columns.

**Properties**: delimiter (literal / regex); max splits; output as ARRAY / MULTIPLE_COLUMNS; column naming for MULTIPLE_COLUMNS.

---

#### 2.12.4 Parse JSON String Node
Parse a string column containing JSON into struct/map.

**Properties**: column; inferred schema / explicit schema; on parse error: FAIL / NULL / ORIGINAL_STRING.

---

#### 2.12.5 Parse XML String Node
Parse a string column containing XML into struct.

**Properties**: column; root element path; schema definition; namespace handling.

---

### 2.13 Date & Time Components

#### 2.13.1 Date Transform Node
**Operations**:
| Operation | Description |
|---|---|
| DATE_FORMAT | Format timestamp to string with pattern |
| PARSE_DATE | Parse string to date with format pattern |
| EXTRACT | Extract part: year, month, day, hour, minute, second, dayofweek, dayofyear, quarter, week |
| DATE_ADD | Add N days/months/years/hours/minutes/seconds |
| DATE_DIFF | Difference between two dates in specified unit |
| DATE_TRUNC | Truncate to year/month/week/day/hour/minute/second |
| LAST_DAY | Last day of month |
| NEXT_DAY | Next occurrence of day-of-week |
| IS_WEEKEND | Boolean: is Saturday or Sunday |
| IS_BUSINESS_DAY | Boolean: not weekend and not holiday |
| TIMEZONE_CONVERT | Convert timestamp from TZ to TZ |
| UNIX_TIMESTAMP | Convert to/from UNIX epoch seconds |
| FISCAL_YEAR | Derive fiscal year/quarter from calendar date |
| AGE | Compute age in years/months/days |

---

#### 2.13.2 Late Arriving Data Handler Node
Manage events that arrive after their expected time window.

**Properties**: watermark column; maximum lateness threshold; handling: DROP / ROUTE_TO_LATE_PORT / ACCEPT_WITH_FLAG; late flag column name.

---

### 2.14 Numeric & Math Components

#### 2.14.1 Numeric Transform Node
Per-column numeric operations: ROUND(n), FLOOR, CEIL, ABS, NEGATE, SIGN, SQRT, LOG(base), LOG2, LOG10, EXP, POW(n), MOD(n), NORMALIZE (min-max scaling), STANDARDIZE (z-score).

---

#### 2.14.2 Binning / Bucketizer Node
Discretize continuous numeric values into bins.

**Properties**: column; bin strategy: EQUAL_WIDTH / EQUAL_FREQUENCY / CUSTOM_EDGES; number of bins / edge list; output column (ordinal label or range string); handle out-of-range: ERROR / CLIP / NULL.

---

#### 2.14.3 Imputer Node
Fill missing numeric values using statistical imputation.

**Properties**: columns; strategy per column: MEAN / MEDIAN / MODE / CONSTANT / FORWARD_FILL / BACKWARD_FILL / INTERPOLATE_LINEAR / REGRESSION (uses other columns); group by (impute within groups).

---

### 2.15 JSON & XML Components

#### 2.15.1 JSON Path Extract Node
Extract values from a JSON column using JSONPath expressions.

**Properties**: list of (output_column, jsonpath_expression, output_type); on missing path: NULL / DEFAULT / FAIL.

---

#### 2.15.2 JSON Build Node
Construct a JSON string from multiple columns.

**Properties**: structure template or column list → JSON object; nested JSON support; null handling: INCLUDE_NULLS / OMIT_NULLS.

---

#### 2.15.3 XML Path Extract Node
Extract values from XML column using XPath expressions.

**Properties**: list of (output_column, xpath_expression, output_type, multi_value: FIRST/ARRAY); namespace map.

---

### 2.16 Array & Struct Components

#### 2.16.1 Array Operations Node
Per-element and aggregate operations on ARRAY columns.

**Operations**: ARRAY_LENGTH, ARRAY_CONTAINS, ARRAY_DISTINCT, ARRAY_SORT, ARRAY_MIN, ARRAY_MAX, ARRAY_SUM, ARRAY_JOIN (to string), ARRAY_SLICE, ARRAY_APPEND, ARRAY_PREPEND, ARRAY_REMOVE, ARRAY_INTERSECT, ARRAY_UNION, ARRAY_EXCEPT, ARRAY_ZIP, ARRAY_FLATTEN, ARRAY_AGGREGATE.

---

#### 2.16.2 Map Operations Node
Operations on MAP columns.

**Operations**: MAP_KEYS, MAP_VALUES, MAP_GET, MAP_CONTAINS_KEY, MAP_MERGE, MAP_FILTER, MAP_TRANSFORM_VALUES, MAP_FROM_ARRAYS, MAP_FROM_ENTRIES.

---

### 2.17 Data Quality Components

#### 2.17.1 Data Validation Node
**Purpose**: Assert rules against data; route non-conforming rows.

**Output Ports**: 1 (valid), 1 (invalid with violation details)

**Properties**: list of validation rules:
| Rule Type | Examples |
|---|---|
| NOT_NULL | column must not be null |
| NOT_EMPTY | string column must not be empty string |
| RANGE | numeric in [min, max] |
| DATE_RANGE | date in [start, end] |
| REGEX_MATCH | column matches pattern |
| ENUM_CHECK | value in allowed set |
| UNIQUE | no duplicates on column (uses window function) |
| REFERENTIAL_INTEGRITY | value exists in reference table |
| CUSTOM_SQL | user-defined SQL predicate |
| LENGTH_RANGE | string length in [min, max] |
| PRECISION_SCALE | numeric within precision/scale limits |
| CROSS_COLUMN | e.g., start_date < end_date |

**On Rule Failure Policy**: ROUTE_TO_INVALID / MARK_WITH_FLAG_COLUMN / LOG / FAIL_PIPELINE (per rule or global)

---

#### 2.17.2 Anomaly Detection Node
Statistical anomaly flagging.

**Properties**: column; method: Z_SCORE / IQR / ISOLATION_SCORE; threshold; action: FLAG_COLUMN / ROUTE_TO_ANOMALY_PORT / LOG.

---

#### 2.17.3 Masking / Anonymization Node
Apply data masking to sensitive columns.

**Operations**: FULL_MASK, PARTIAL_MASK(first_n, last_n), HASH (MD5/SHA), PSEUDONYMIZE (consistent token), GENERALIZE (replace DOB with birth_year), NOISE_ADDITION (numeric), FORMAT_PRESERVE_MASK (email → x@x.com preserving domain length), NULLIFY.

---

### 2.18 SCD Components

#### 2.18.1 SCD Type 1 Node
(All code generation details in InDB_CodeGen document, Section 4.1)

Visual node wrapping SCD1 logic. Works for both InDB (SQL) and Spark (DataFrame merge).

**Spark SCD1 Code Generation:**
```python
# PySpark - Delta Lake target
from delta.tables import DeltaTable

delta_tbl = DeltaTable.forName(spark, 'dw.dim_customer')
delta_tbl.alias('tgt').merge(
    source_df.alias('src'),
    'tgt.customer_id = src.customer_id'
).whenMatchedUpdateAll(
    condition="tgt.record_hash != src.record_hash"
).whenNotMatchedInsertAll().execute()
```

---

#### 2.18.2 SCD Type 2 Node
(All code generation details in InDB_CodeGen document, Section 4.2)

**Spark SCD2 Code Generation (Delta Lake):**
```python
from delta.tables import DeltaTable

# Step 1: Stage incoming with hash
staged = source_df.withColumn(
    'record_hash',
    F.sha2(F.concat_ws('|', *tracked_cols), 256)
)

# Step 2: Merge to close current records
DeltaTable.forName(spark, 'dw.dim_customer').alias('tgt').merge(
    staged.alias('src'),
    'tgt.customer_id = src.customer_id AND tgt.is_current = true'
).whenMatchedUpdate(
    condition="tgt.record_hash != src.record_hash",
    set={
        'is_current': 'false',
        'effective_end_date': 'current_timestamp() - interval 1 second'
    }
).execute()

# Step 3: Insert new versions
new_versions = staged.join(
    DeltaTable.forName(spark, 'dw.dim_customer').toDF()
        .filter('is_current = true')
        .select('customer_id', 'record_hash'),
    on='customer_id', how='left'
).filter(
    (F.col('record_hash') != F.col('tgt_record_hash')) |
    F.col('tgt_record_hash').isNull()
).select(
    *source_cols,
    F.lit(True).alias('is_current'),
    F.current_timestamp().alias('effective_start_date'),
    F.lit(None).cast('timestamp').alias('effective_end_date'),
    F.current_timestamp().alias('etl_load_ts')
)

new_versions.write.format('delta').mode('append').saveAsTable('dw.dim_customer')
```

---

#### 2.18.3 SCD Type 3 Node
(All code generation details in InDB_CodeGen document, Section 4.3)

---

### 2.19 Surrogate Key & Sequence Components

#### 2.19.1 Surrogate Key Generator Node

**Properties**:
| Property | Description |
|---|---|
| Strategy | SEQUENTIAL_INTEGER / UUID / MD5_HASH / SHA256_HASH / SNOWFLAKE_ID / CUSTOM_SEQ |
| Start Value | For SEQUENTIAL_INTEGER; default 1 |
| Increment | For SEQUENTIAL_INTEGER; default 1 |
| Input Columns (for hash strategies) | Columns to hash for deterministic SK |
| Output Column Name | Default: `sk_{table_name}` |
| Uniqueness Guarantee | WITHIN_BATCH (row_number) / GLOBAL (sequence from DB) / UUID (always unique) |
| Partition-Safe | YES for distributed execution (uses monotonically_increasing_id base + row_number offset) |

**Code Generation:**
```python
# PySpark - Sequential (batch-scoped)
df.withColumn('sk_customer', F.row_number().over(
    Window.orderBy(F.monotonically_increasing_id())
) + start_value - 1)

# PySpark - UUID
df.withColumn('sk_customer', F.expr('uuid()'))

# PySpark - Hash-based
df.withColumn('sk_customer', F.sha2(F.concat_ws('|', *key_cols), 256))
```

---

#### 2.19.2 Sequence / Auto-Increment Node
Pull next sequence value from DB (for DB-backed targets).

**Properties**: connection; sequence name; output column; batch fetch size (fetch N values in one DB call; assign locally).

---

### 2.20 Audit & Metadata Injection Components

#### 2.20.1 Audit Column Injector Node
Automatically adds standard audit columns to every row.

**Properties**: list of audit columns to inject:
| Column | Value | Configurable |
|---|---|---|
| `_etl_execution_id` | Current execution UUID | Column name configurable |
| `_etl_pipeline_id` | Pipeline UUID | |
| `_etl_pipeline_version` | Pipeline version | |
| `_etl_run_date` | Execution date (date only) | |
| `_etl_run_timestamp` | Full timestamp | |
| `_etl_source_system` | User-defined label | |
| `_etl_batch_id` | Batch identifier | |
| `_etl_record_hash` | SHA-256 of selected columns | Column list configurable |
| `_etl_row_number` | Sequence within batch | |

---

#### 2.20.2 Change Data Capture (CDC) Flag Node
Compare incoming rows with existing target data and classify each row.

**Properties**: key columns; comparison columns; target reference (table from catalog or prior snapshot); output: CDC_TYPE column with values: INSERT / UPDATE / DELETE / UNCHANGED / UPSERT.

---

## 3. Code Generation Coverage Matrix

This matrix confirms every transformation component generates correct code in all three engines:

| Component | PySpark | Scala Spark | InDB SQL (PostgreSQL) | InDB SQL (MSSQL) | InDB SQL (Oracle) | InDB SQL (Teradata) | InDB SQL (Snowflake) | InDB SQL (BigQuery) |
|---|---|---|---|---|---|---|---|---|
| UNION | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| UNION ALL | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| INTERSECT | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| EXCEPT / MINUS | ✓ | ✓ | ✓ EXCEPT | ✓ EXCEPT | ✓ MINUS | ✓ MINUS | ✓ MINUS | ✓ EXCEPT |
| INNER JOIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| LEFT JOIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RIGHT JOIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| FULL OUTER JOIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SEMI JOIN | ✓ | ✓ | ✓ WHERE EXISTS | ✓ WHERE EXISTS | ✓ WHERE EXISTS | ✓ WHERE EXISTS | ✓ | ✓ |
| ANTI JOIN | ✓ | ✓ | ✓ WHERE NOT EXISTS | ✓ | ✓ | ✓ | ✓ | ✓ |
| CROSS JOIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| NON-EQUI JOIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GROUP BY AGGREGATE | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ROLLUP | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| CUBE | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| WINDOW FUNCTIONS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PIVOT | ✓ | ✓ | ✓ CASE/WHEN | ✓ Native | ✓ Native | ✓ CASE/WHEN | ✓ CASE/WHEN | ✓ Native |
| UNPIVOT | ✓ stack() | ✓ stack() | ✓ CASE/WHEN | ✓ Native | ✓ Native | ✓ CASE/WHEN | ✓ CASE/WHEN | ✓ Native |
| DEDUPLICATION | ✓ | ✓ | ✓ ROW_NUMBER | ✓ ROW_NUMBER | ✓ ROW_NUMBER | ✓ ROW_NUMBER | ✓ | ✓ |
| SCD TYPE 1 | ✓ Delta MERGE | ✓ Delta MERGE | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SCD TYPE 2 | ✓ Delta MERGE | ✓ Delta MERGE | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SCD TYPE 3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SURROGATE KEY | ✓ | ✓ | ✓ SEQUENCE | ✓ IDENTITY | ✓ SEQUENCE | ✓ IDENTITY | ✓ SEQUENCE | ✓ GENERATE_UUID |

---

## 4. Universal Read/Write Support

### 4.1 Read Support Matrix

| Technology | Read Modes | Format | Incremental | Partition Pruning |
|---|---|---|---|---|
| PostgreSQL | JDBC full / incremental / query / view | Tabular | ✓ watermark | ✓ WHERE pushdown |
| MySQL / MariaDB | JDBC | Tabular | ✓ | ✓ |
| Oracle | JDBC / OCI | Tabular | ✓ | ✓ |
| SQL Server | JDBC / BULK | Tabular | ✓ | ✓ |
| Teradata | JDBC / FastExport | Tabular | ✓ | ✓ |
| DB2 | JDBC | Tabular | ✓ | ✓ |
| Snowflake | Snowflake Spark connector | Tabular | ✓ | ✓ |
| BigQuery | BigQuery Storage Read API | Tabular | ✓ | ✓ |
| Redshift | JDBC + S3 Unload | Tabular | ✓ | ✓ |
| Azure Synapse | JDBC + Blob Staging | Tabular | ✓ | ✓ |
| Databricks | Databricks Connect / JDBC | Tabular | ✓ | ✓ |
| Delta Lake | Native Delta reader | Tabular | ✓ CDF | ✓ |
| Apache Iceberg | Iceberg catalog reader | Tabular | ✓ snapshot | ✓ |
| Apache Hudi | Hudi reader (COW/MOR) | Tabular | ✓ incremental | ✓ |
| Apache Hive | HiveContext / Thrift | Tabular | ✓ | ✓ |
| Amazon S3 | S3A / AWS SDK | File | ✓ modified-since | ✓ partition filter |
| Azure Blob / ADLS | ABFS / WASBS | File | ✓ | ✓ |
| GCS | GCS Connector | File | ✓ | ✓ |
| HDFS | HDFS client | File | ✓ | ✓ |
| SFTP / FTP | Custom connector | File | ✓ modified-since | — |
| Local Filesystem | Direct I/O | File | ✓ | — |
| Apache Kafka | Structured Streaming / Batch | Stream | ✓ offset | ✓ topic filter |
| AWS Kinesis | KCL / Spark connector | Stream | ✓ shard | — |
| Azure Event Hubs | Event Hubs Spark connector | Stream | ✓ | — |
| Google Pub/Sub | Pub/Sub Spark connector | Stream | ✓ | — |
| MongoDB | Mongo Spark connector | Document | ✓ oplog | — |
| Cassandra | Spark Cassandra connector | Tabular | ✓ token range | ✓ |
| Elasticsearch | ES Hadoop connector | Document | ✓ | ✓ |
| DynamoDB | Glue DynamoDB connector | Key-Value | ✓ | — |
| REST API | HTTP client | JSON/XML | ✓ watermark | — |
| SOAP | SOAP client | XML | ✓ | — |
| GraphQL | HTTP client | JSON | ✓ cursor | — |
| OData | HTTP client | JSON/XML | ✓ deltaLink | ✓ $filter |

### 4.2 Write Support Matrix

| Technology | Write Modes | Format | SCD1 | SCD2 | Compression | Partitioned Write |
|---|---|---|---|---|---|---|
| PostgreSQL | INSERT / UPSERT / MERGE / TRUNCATE+INSERT / UPDATE / DELETE | Tabular | ✓ InDB | ✓ InDB | N/A (DB internal) | ✓ partition tables |
| MySQL | INSERT / UPSERT / TRUNCATE+INSERT | Tabular | ✓ InDB | ✓ InDB (staging) | N/A | ✓ |
| Oracle | INSERT / MERGE / TRUNCATE+INSERT | Tabular | ✓ InDB | ✓ InDB | N/A | ✓ |
| SQL Server | INSERT / MERGE / BULK INSERT / TRUNCATE+INSERT | Tabular | ✓ InDB | ✓ InDB | N/A | ✓ |
| Teradata | INSERT / MERGE / FastLoad / MultiLoad | Tabular | ✓ InDB | ✓ InDB | N/A | ✓ |
| Snowflake | COPY INTO / MERGE / INSERT / TRUNCATE+INSERT | Tabular | ✓ | ✓ | Snowflake internal | ✓ CLUSTER BY |
| BigQuery | INSERT / MERGE / LOAD / TRUNCATE / APPEND | Tabular | ✓ | ✓ | Internal | ✓ PARTITION BY |
| Redshift | COPY (S3 staging) / MERGE / INSERT / TRUNCATE+INSERT | Tabular | ✓ InDB | ✓ InDB | Parquet/GZIP staging | ✓ SORTKEY |
| Azure Synapse | COPY INTO / MERGE / INSERT | Tabular | ✓ InDB | ✓ InDB | Parquet/GZIP staging | ✓ |
| Databricks | Delta MERGE / APPEND / OVERWRITE / INSERT OVERWRITE | Delta | ✓ Delta MERGE | ✓ Delta MERGE | Snappy/ZSTD/GZIP | ✓ partition by |
| Delta Lake | Delta MERGE / APPEND / OVERWRITE | Delta | ✓ Delta MERGE | ✓ Delta MERGE | Snappy/ZSTD/GZIP | ✓ |
| Apache Iceberg | Iceberg MERGE / APPEND / OVERWRITE | Iceberg | ✓ MERGE INTO | ✓ MERGE INTO | Snappy/GZIP/ZSTD | ✓ |
| Apache Hudi | Upsert (COPY_ON_WRITE) / MergeOnRead | Hudi | ✓ UPSERT | ✓ MOR | Snappy/GZIP | ✓ |
| Apache Hive | INSERT OVERWRITE / INSERT INTO | Tabular | Staging+MERGE | Staging+MERGE | Snappy/ORC/GZIP | ✓ |
| Amazon S3 | Write file(s) | Parquet/ORC/CSV/JSON/AVRO/Delta | — | — | All codecs | ✓ Hive-style |
| Azure Blob / ADLS | Write file(s) | Same as S3 | — | — | All codecs | ✓ |
| GCS | Write file(s) | Same as S3 | — | — | All codecs | ✓ |
| HDFS | Write file(s) | Same as S3 | — | — | All codecs | ✓ |
| SFTP / FTP | Upload file(s) | CSV/JSON/Parquet | — | — | GZIP/ZIP | — |
| Apache Kafka | Produce messages | JSON/Avro/Protobuf | — | — | LZ4/Snappy/GZIP | ✓ topic partition key |
| AWS Kinesis | Produce records | JSON/binary | — | — | — | ✓ shard key |
| Azure Event Hubs | Produce events | JSON/Avro | — | — | — | ✓ partition key |
| MongoDB | insertMany / updateMany / replaceOne / bulkWrite | Document | ✓ replaceOne | ✓ custom | — | — |
| Cassandra | INSERT / UPSERT (LWT) | Tabular | ✓ | Staging+manual | — | ✓ partition key |
| Elasticsearch | Index / Bulk API | JSON Document | ✓ upsert | — | — | ✓ index pattern |
| DynamoDB | PutItem / UpdateItem / BatchWrite | Key-Value | ✓ | — | — | — |
| REST API | POST / PUT / PATCH / DELETE | JSON/XML | ✓ (PUT/PATCH) | — | — | — |
| SOAP | Operation call | XML | ✓ (update op) | — | — | — |

### 4.3 Cross-Technology I/O Examples

The following combinations are explicitly supported and tested:

| Source | Target | Notes |
|---|---|---|
| Oracle RDBMS | Parquet on S3 | Full + incremental; partition by date |
| PostgreSQL | Delta Lake on HDFS | SCD2 via Delta MERGE |
| Parquet on S3 | Redshift | Via COPY from S3 (most efficient path) |
| Parquet on S3 | Snowflake | Via COPY INTO from stage |
| Parquet on S3 | BigQuery | Via BigQuery Load Job |
| CSV on SFTP | PostgreSQL | Parse → validate → UPSERT |
| Kafka topic | Delta Lake | Structured Streaming → Delta MERGE |
| REST API | Snowflake | Paginate → stage → MERGE |
| Oracle | ORC on HDFS | JDBC read → write ORC with Snappy |
| SQL Server | Iceberg on S3 | Bulk export → Iceberg write → partition |
| MongoDB | Parquet on Azure Blob | Schema inference → Parquet write |
| Elasticsearch | PostgreSQL | ES scroll → JDBC batch upsert |
| Delta Lake (Databricks) | Snowflake | Delta JDBC → Snowflake COPY |
| BigQuery | Parquet on GCS | BigQuery export API → GCS |
| Hive | ORC on HDFS | INSERT OVERWRITE with partition |
| CSV on local FS | MySQL | Parse → LOAD DATA INFILE (bulk insert) |
| Kafka (Avro) | BigQuery | Schema Registry decode → BQ stream insert |

---

## 5. Compression Support

### 5.1 Compression Codec Matrix

| Codec | File Formats | Read | Write | Splittable | Speed | Ratio | Use Case |
|---|---|---|---|---|---|---|---|
| **NONE** (uncompressed) | All | ✓ | ✓ | ✓ | Fastest | 1.0x | Dev/Debug, small files |
| **GZIP** | CSV, JSON, XML, Text, Parquet | ✓ | ✓ | ✗ (as file) | Medium | High | General purpose, archival |
| **ZLIB** | Various | ✓ | ✓ | ✗ | Medium | High | HTTP streaming |
| **DEFLATE** | Avro, Parquet | ✓ | ✓ | ✓ (within Parquet row group) | Medium | High | Parquet internals |
| **Snappy** | Parquet, ORC, Avro | ✓ | ✓ | ✓ (block-level) | Very Fast | Medium | **Default for Parquet/ORC** |
| **LZ4** | Parquet, ORC, Kafka | ✓ | ✓ | ✓ | Fastest | Low-Medium | Low-latency pipelines |
| **LZ4_RAW** | Parquet | ✓ | ✓ | ✓ | Fastest | Low | Parquet internals |
| **BZIP2** | Text, CSV, JSON | ✓ | ✓ | ✓ (at block level) | Slow | Very High | Cold archival storage |
| **ZSTD** | Parquet, ORC, Delta | ✓ | ✓ | ✓ | Fast | Very High | **Recommended for Delta Lake** |
| **ZSTD (level 1–22)** | Parquet, ORC, Delta | ✓ | ✓ | ✓ | Configurable | Configurable | Tune speed vs ratio |
| **BZ2 / BZip2** | CSV, Text | ✓ | ✓ | ✓ | Slow | Very High | Archive |
| **LZO** | Text, Parquet, ORC | ✓ | ✓ | ✓ (splittable LZO) | Fast | Medium | Hadoop legacy |
| **ZIP** | Any (container) | ✓ | ✓ | ✗ | Medium | High | SFTP/FTP transfers, Excel |
| **ZIP with DEFLATE** | ZIP container | ✓ | ✓ | ✗ | Medium | High | Windows compatibility |
| **TAR + GZIP (.tar.gz / .tgz)** | Any (container) | ✓ | ✓ | ✗ | Medium | High | Unix/Linux bundles |
| **TAR + BZIP2 (.tar.bz2)** | Any | ✓ | ✓ | ✗ | Slow | Very High | High-ratio archives |
| **TAR + ZSTD (.tar.zst)** | Any | ✓ | ✓ | ✗ | Fast | Very High | Modern archival |
| **7-Zip (7z)** | Any (container) | ✓ | ✓ | ✗ | Slow | Max | Maximum compression archival |
| **Snappy framing** | Text, JSON (NDJSON) | ✓ | ✓ | ✓ | Fast | Medium | Streaming |
| **XZ / LZMA** | Any | ✓ | ✓ | ✗ | Very Slow | Max | Archival |
| **Parquet — internal page compression** | Parquet only | ✓ | ✓ | ✓ | Per codec | Per codec | Parquet-specific tuning |
| **ORC — Zlib / Snappy / LZO / ZSTD** | ORC only | ✓ | ✓ | ✓ | Per codec | Per codec | ORC-specific tuning |
| **Delta Lake — Snappy / ZSTD / GZIP** | Delta format | ✓ | ✓ | ✓ | Per codec | Per codec | Delta-specific |
| **Avro — Deflate / Snappy / ZSTD / BZ2** | Avro only | ✓ | ✓ | ✓ | Per codec | Per codec | Avro-specific |

### 5.2 Compression Configuration (per Write Node)

**Target Node Properties — Compression Tab:**
| Property | Type | Description |
|---|---|---|
| Compression Codec | Select | From matrix above, filtered to what the format supports |
| ZSTD Compression Level | Slider (1–22) | Only shown when ZSTD selected; default: 3 |
| Parquet Row Group Size | MB | Default: 128MB; tune for read performance |
| Parquet Page Size | KB | Default: 1MB |
| ORC Stripe Size | MB | Default: 256MB |
| ORC Row Index Stride | Integer | Default: 10,000 |
| Split Size | MB | For splittable codecs; tune for parallelism |
| Multi-file Output | YES/NO | Whether to write one file or multiple partitioned files |
| File Size Target | MB | Platform auto-adjusts partition count to hit target file size |
| Max Files Per Output | Integer | Cap on output files |

### 5.3 Compression for Intermediate Staging (Platform-Managed)
- Platform always writes intermediate Spark shuffle data using Snappy (default) or configured codec
- Intermediate files between pipeline stages: Parquet + Snappy
- Configurable globally in platform settings: Settings → Performance → Intermediate Format

### 5.4 Auto-Codec Selection Rules (When "AUTO" selected)
| Target Format | Recommended Codec | Reason |
|---|---|---|
| Parquet → cold storage (S3/GCS Glacier tier) | ZSTD level 6 | Best ratio for infrequently accessed |
| Parquet → hot storage (frequent reads) | Snappy | Fastest decompression |
| Parquet → Delta Lake | ZSTD level 3 | Delta default; good balance |
| ORC | Snappy | Fastest; ORC has its own column encoding |
| CSV → SFTP delivery | GZIP | Universal compatibility |
| CSV → archival | BZIP2 | Best text compression ratio |
| JSON Lines | Snappy framing | Streaming-friendly |
| Avro | Snappy | Standard for Kafka/Hadoop ecosystem |
| Any → Windows systems | ZIP DEFLATE | Windows native support |
| Any → high-security archival | ZSTD level 19 | Max ratio with reasonable speed |

---

## 6. Lakehouse SCD Support

### 6.1 Delta Lake

#### 6.1.1 SCD Type 1 — Delta MERGE
**Supported Versions**: Delta Lake 1.0+

```python
# Generated PySpark code
from delta.tables import DeltaTable
from pyspark.sql import functions as F

delta_tbl = DeltaTable.forName(spark, '{target_catalog}.{target_schema}.{target_table}')

(delta_tbl.alias('tgt')
    .merge(
        source_df.alias('src'),
        '{merge_condition}'  # e.g., tgt.customer_id = src.customer_id
    )
    .whenMatchedUpdate(
        condition='{change_condition}',  # hash check
        set={col: f'src.{col}' for col in update_cols}
    )
    .whenNotMatchedInsert(
        values={col: f'src.{col}' for col in insert_cols}
    )
    .whenNotMatchedBySourceDelete(  # Delta 2.3+ for soft delete
        condition='{delete_condition}'
    )
    .execute()
)
```

#### 6.1.2 SCD Type 2 — Delta MERGE (Two-Operation Pattern)
```python
# Operation 1: Expire changed current rows
(DeltaTable.forName(spark, target_table).alias('tgt')
    .merge(
        staged_changes.alias('src'),
        'tgt.{bk} = src.{bk} AND tgt.is_current = true'
    )
    .whenMatchedUpdate(set={
        'is_current': 'false',
        'effective_end_date': "date_sub(current_timestamp(), 1)"
    })
    .execute()
)

# Operation 2: Insert new versions
(spark.createDataFrame(new_versions_df)
    .write.format('delta')
    .mode('append')
    .option('mergeSchema', 'true')
    .saveAsTable(target_table)
)
```

#### 6.1.3 Delta-Specific Features Used
| Feature | Used For |
|---|---|
| `mergeSchema = true` | Auto-evolve Delta schema when new columns arrive |
| `overwriteSchema = true` | Full schema replacement (breaking change, requires confirmation) |
| `optimizeWrite = true` | Compact small files on write |
| `autoOptimize.autoCompact = true` | Background compaction |
| `dataChange = false` | Optimize-only writes (compaction without data change events) |
| Delta Change Data Feed (CDF) | Capture SCD2 changes for downstream CDC |
| Time Travel (`VERSION AS OF`, `TIMESTAMP AS OF`) | Read historical versions for SCD2 lookback |
| `RESTORE TABLE` | Rollback Delta table to prior version on pipeline failure |
| `OPTIMIZE ... ZORDER BY` | Co-locate data by frequently-queried columns |
| `VACUUM` | Remove files for expired Delta versions (configurable retention) |

---

### 6.2 Apache Iceberg

#### 6.2.1 SCD Type 1 — Iceberg MERGE INTO
```python
# Spark SQL
spark.sql(f"""
MERGE INTO {catalog}.{schema}.{target_table} AS tgt
USING (SELECT * FROM staged_source) AS src
ON tgt.{bk} = src.{bk}
WHEN MATCHED AND tgt.record_hash != src.record_hash
  THEN UPDATE SET {', '.join([f'tgt.{c} = src.{c}' for c in update_cols])}
WHEN NOT MATCHED
  THEN INSERT ({', '.join(insert_cols)}) VALUES ({', '.join([f'src.{c}' for c in insert_cols])})
""")
```

#### 6.2.2 SCD Type 2 — Iceberg MERGE (Row-level Delete + Insert)
- Iceberg supports `DELETE FROM ... WHERE` and `INSERT INTO`
- Or: `MERGE INTO` with update to close rows + separate insert for new versions

#### 6.2.3 Iceberg-Specific Features Used
| Feature | Used For |
|---|---|
| Snapshot isolation | Read consistent data during SCD2 write |
| Partition evolution | Change partitioning without full table rewrite |
| Schema evolution | Add/rename/drop columns safely |
| `CALL system.rewrite_data_files` | Compaction |
| `CALL system.expire_snapshots` | Clean old snapshots |
| Time travel (`AS OF VERSION`, `AS OF TIMESTAMP`) | SCD2 lookback |
| Row-level deletes (position/equality deletes) | Efficient soft deletes |

---

### 6.3 Apache Hudi

#### 6.3.1 SCD Type 1 — Hudi UPSERT (COPY_ON_WRITE)
```python
hudi_options = {
    'hoodie.table.name': target_table,
    'hoodie.datasource.write.recordkey.field': bk_columns,
    'hoodie.datasource.write.precombine.field': updated_at_col,
    'hoodie.datasource.write.operation': 'upsert',       # SCD1
    'hoodie.datasource.write.table.type': 'COPY_ON_WRITE',
    'hoodie.datasource.hive_sync.enable': 'true',
    'hoodie.cleaner.commits.retained': '10',
    'hoodie.parquet.compression.codec': 'snappy',
}

(source_df.write
    .format('hudi')
    .options(**hudi_options)
    .mode('append')
    .save(target_path)
)
```

#### 6.3.2 SCD Type 2 — Hudi (MERGE_ON_READ with custom logic)
```python
# Hudi doesn't have native SCD2 MERGE; platform generates:
# Step 1: Read current active records matching incoming keys
# Step 2: Expire them by adding effective_end_date via UPDATE operation
# Step 3: Insert new versions as new records with new sk

hudi_delete_options = {
    **base_options,
    'hoodie.datasource.write.operation': 'upsert',
    'hoodie.datasource.write.payload.class': 'org.apache.hudi.common.model.OverwriteWithLatestAvroPayload'
}

# Close current rows
expired_rows.write.format('hudi').options(**hudi_delete_options).mode('append').save(target_path)

# Insert new versions
new_rows.write.format('hudi').options(**hudi_delete_options).mode('append').save(target_path)
```

#### 6.3.3 Hudi-Specific Features
| Feature | Used For |
|---|---|
| COW (Copy-On-Write) | Read-optimized; SCD1 preferred |
| MOR (Merge-On-Read) | Write-optimized; real-time CDC |
| `hoodie.datasource.write.precombine.field` | Deduplication key for upsert |
| Hudi Timeline | Incremental reads since last commit |
| `CALL hudi_metadata` | Table stats |
| Compaction scheduling | Background MOR compaction to base files |

---

### 6.4 Snowflake

#### 6.4.1 SCD Type 1
```sql
-- Generated SQL
MERGE INTO {schema}.{target_table} AS tgt
USING (SELECT * FROM {staging_table}) AS src
ON tgt.{bk} = src.{bk}
WHEN MATCHED AND tgt.record_hash != src.record_hash
  THEN UPDATE SET
    {update_assignments},
    tgt.updated_at = CURRENT_TIMESTAMP(),
    tgt.etl_load_ts = '{exec_ts}'
WHEN NOT MATCHED
  THEN INSERT ({insert_cols}) VALUES ({insert_vals});
```

#### 6.4.2 SCD Type 2
```sql
-- Step 1: Expire changed rows
MERGE INTO {schema}.{target_table} tgt
USING {staging_schema}.stg_changed_{exec_id} src
ON tgt.{bk} = src.{bk} AND tgt.is_current = TRUE
WHEN MATCHED THEN UPDATE SET
  tgt.is_current = FALSE,
  tgt.effective_end_date = DATEADD('second', -1, CURRENT_TIMESTAMP());

-- Step 2: Insert new versions
INSERT INTO {schema}.{target_table}
SELECT {cols}, TRUE AS is_current, CURRENT_TIMESTAMP() AS effective_start_date,
       NULL AS effective_end_date, '{exec_id}' AS etl_load_ts
FROM {staging_schema}.stg_changed_{exec_id}
UNION ALL
SELECT {cols}, TRUE, CURRENT_TIMESTAMP(), NULL, '{exec_id}'
FROM {staging_schema}.stg_new_{exec_id};
```

#### 6.4.3 Snowflake-Specific Optimizations
| Feature | Used For |
|---|---|
| Zero-Copy Clone | Staging table creation (instant, no storage cost) |
| Snowflake Streams | CDC capture on staging tables for incremental SCD |
| Snowflake Tasks | Schedule SCD refresh |
| COPY INTO | Bulk load from S3/Azure/GCS stage into staging table |
| Transient Tables | Staging tables (no Fail-Safe cost) |
| `SYSTEM$CLUSTERING_INFORMATION` | Verify clustering effectiveness post-SCD2 |
| Time Travel | Rollback SCD2 changes using `AT (OFFSET => ...)` |
| `UNDROP TABLE` | Recovery after accidental drop |

---

### 6.5 BigQuery

#### 6.5.1 SCD Type 1
```sql
-- Generated BigQuery SQL
MERGE `{project}.{dataset}.{target_table}` AS tgt
USING (
    SELECT * FROM `{project}.{dataset}.{staging_table}`
) AS src
ON tgt.{bk} = src.{bk}
WHEN MATCHED AND tgt.record_hash != src.record_hash
  THEN UPDATE SET
    {update_assignments},
    tgt.updated_at = CURRENT_TIMESTAMP(),
    tgt.etl_load_ts = CURRENT_TIMESTAMP()
WHEN NOT MATCHED
  THEN INSERT ({insert_cols}) VALUES ({insert_vals});
```

#### 6.5.2 SCD Type 2 (BigQuery Scripting)
```sql
DECLARE exec_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP();

-- Step 1: Create staging
CREATE OR REPLACE TEMP TABLE stg_incoming AS
SELECT *, SHA256(CONCAT_WS('|', {tracked_cols})) AS record_hash
FROM {source_view};

-- Step 2: Expire changed rows
MERGE `{project}.{dataset}.{target_table}` tgt
USING (
    SELECT s.{bk}, s.record_hash
    FROM stg_incoming s
    JOIN `{project}.{dataset}.{target_table}` t
      ON s.{bk} = t.{bk} AND t.is_current = TRUE
    WHERE s.record_hash != t.record_hash
) chg
ON tgt.{bk} = chg.{bk} AND tgt.is_current = TRUE
WHEN MATCHED THEN UPDATE SET
    is_current = FALSE,
    effective_end_date = TIMESTAMP_SUB(exec_ts, INTERVAL 1 SECOND);

-- Step 3: Insert new versions
INSERT INTO `{project}.{dataset}.{target_table}`
SELECT {cols}, TRUE, exec_ts, NULL, exec_ts
FROM stg_incoming src
WHERE NOT EXISTS (
    SELECT 1 FROM `{project}.{dataset}.{target_table}` t
    WHERE t.{bk} = src.{bk} AND t.is_current = TRUE AND t.record_hash = src.record_hash
);
```

#### 6.5.3 BigQuery-Specific Optimizations
| Feature | Used For |
|---|---|
| Partitioned tables (DATE/TIMESTAMP/INTEGER) | SCD2 partition by effective_start_date |
| Clustered tables | Cluster by {bk} for faster MERGE |
| BigQuery Storage Write API | Bulk inserts without staging |
| Materialized Views | Pre-computed current-record view |
| Time Travel (`FOR SYSTEM_TIME AS OF`) | Rollback SCD2 state |
| Column-level security | Mask sensitive SCD2 columns |
| Reservation / Slot control | Ensure MERGE has sufficient compute |

---

### 6.6 Azure Synapse Analytics

#### 6.6.1 SCD Type 1
```sql
-- T-SQL MERGE
MERGE INTO [{schema}].[{target_table}] WITH (HOLDLOCK) AS tgt
USING [{staging_schema}].[{staging_table}] AS src
ON tgt.[{bk}] = src.[{bk}]
WHEN MATCHED AND tgt.record_hash != src.record_hash
  THEN UPDATE SET {update_assignments}, tgt.updated_at = GETDATE()
WHEN NOT MATCHED BY TARGET
  THEN INSERT ({insert_cols}) VALUES ({insert_vals})
WHEN NOT MATCHED BY SOURCE AND :delete_unmatched = 'Y'
  THEN DELETE;
```

#### 6.6.2 SCD Type 2
Same multi-step pattern as SQL Server (Section 4.2 of InDB document) with Synapse-specific:
- CTAS (CREATE TABLE AS SELECT) for staging instead of SELECT INTO
- Distribution hints: `DISTRIBUTE BY HASH({bk})` on staging and target
- Statistics update: `UPDATE STATISTICS [{target}]` post-merge

#### 6.6.3 Synapse-Specific Optimizations
| Feature | Used For |
|---|---|
| Hash Distribution | Distribute target and staging on same key to eliminate shuffling |
| Clustered Columnstore Index | Default for large SCD2 tables |
| Statistics | Auto-create stats on join/filter columns |
| CTAS | Fast staging table creation with distribution |
| Result Set Caching | Cache current-record view |
| Workload Management | Assign SCD jobs to appropriate resource class |
| `DBCC SHOW_STATISTICS` | Diagnose MERGE performance |

---

### 6.7 Databricks

#### 6.7.1 SCD Type 1 — Delta MERGE (Databricks Optimized)
```python
# Uses Databricks-optimized Delta MERGE with low-shuffle mode
spark.conf.set("spark.databricks.delta.merge.enableLowShuffle", "true")
spark.conf.set("spark.databricks.delta.optimizeWrite.enabled", "true")

from delta.tables import DeltaTable

(DeltaTable.forName(spark, f'{catalog}.{schema}.{target_table}')
    .alias('tgt')
    .merge(source_df.alias('src'), merge_condition)
    .whenMatchedUpdateAll(condition=change_condition)
    .whenNotMatchedInsertAll()
    .execute()
)
```

#### 6.7.2 SCD Type 2 — Databricks Delta with Unity Catalog
```python
# Databricks recommended SCD2 pattern using Delta's CDF
spark.conf.set("spark.databricks.delta.properties.defaults.enableChangeDataFeed", "true")

# Same two-operation MERGE pattern as Delta Lake (Section 6.1.2)
# Plus: register to Unity Catalog with lineage tracking
```

#### 6.7.3 Databricks-Specific Features
| Feature | Used For |
|---|---|
| Unity Catalog | Table governance, column lineage, access control |
| Delta Live Tables (DLT) | Declarative SCD pipeline with APPLY CHANGES INTO |
| `APPLY CHANGES INTO` | Native DLT SCD1/SCD2 syntax |
| Photon Engine | Vectorized execution for MERGE acceleration |
| Low-shuffle MERGE | Reduce shuffle in large MERGE operations |
| Liquid Clustering | Replace static partitioning for SCD2 tables |
| Predictive Optimization | Auto-OPTIMIZE and auto-VACUUM |
| Delta Sharing | Share SCD2 results with external consumers |

#### 6.7.4 `APPLY CHANGES INTO` — DLT Native SCD
```python
# Databricks Delta Live Tables — highest-level SCD abstraction
import dlt
from pyspark.sql.functions import col

@dlt.view
def source_data():
    return spark.readStream.format("cloudFiles")...

dlt.apply_changes(
    target="dim_customer",
    source="source_data",
    keys=["customer_id"],
    sequence_by=col("updated_at"),
    apply_as_deletes=col("op_type") == "DELETE",
    apply_as_truncates=col("op_type") == "TRUNCATE",
    except_column_list=["op_type", "op_timestamp"],
    stored_as_scd_type=2  # or 1
)
```

---

## 7. Write Mode Semantics

Every target node must expose a **Write Mode** selector. The platform ensures each mode is semantically correct per target technology:

| Write Mode | Description | Technologies |
|---|---|---|
| **APPEND** | Add rows to existing data; never remove | All |
| **OVERWRITE** | Replace all existing data atomically | All |
| **OVERWRITE_PARTITION** | Replace only matching partition(s) | Partitioned targets: S3, HDFS, Hive, Delta, Iceberg, BigQuery |
| **UPSERT (SCD1)** | Insert new; update existing by key | RDBMS, Snowflake, BigQuery, Delta, Iceberg, Hudi, Elasticsearch, MongoDB |
| **SCD2** | Insert new; close changed; retain history | RDBMS, Snowflake, BigQuery, Delta, Iceberg, Hudi, Synapse |
| **SCD3** | In-place current/previous swap | RDBMS, Snowflake, BigQuery |
| **MERGE_CUSTOM** | User-defined MERGE condition (advanced) | RDBMS, Snowflake, BigQuery, Delta, Iceberg |
| **TRUNCATE_AND_LOAD** | Truncate target then bulk insert | RDBMS, Snowflake, Synapse, Hive |
| **DELETE_MATCHING** | Delete rows from target matching source keys | RDBMS, Snowflake, BigQuery, Delta, Iceberg |
| **INSERT_IF_NOT_EXISTS** | Insert only rows with no matching key in target | RDBMS, Snowflake, Delta |
| **ERROR_IF_EXISTS** | Fail if target already has data | Development/Audit use cases |
| **IGNORE_IF_EXISTS** | Skip rows that already exist in target | RDBMS (INSERT IGNORE), Hudi |

### 7.1 Write Mode Conflict Guards
- OVERWRITE on production table: requires confirmation dialog + reason text
- TRUNCATE_AND_LOAD on tables > 1M rows: warning banner with row count
- SCD2 on table without surrogate key column: auto-add with confirmation
- DELETE_MATCHING estimated deletions shown before execution

---

## 8. Performance Standards & Optimisation Requirements

### 8.1 Spark Execution Optimisations (Platform-Generated Code Must Include)

| Optimisation | Condition | Generated Code |
|---|---|---|
| Broadcast Join | Right-side dataset < `spark.sql.autoBroadcastJoinThreshold` (default 10MB) | `.hint('broadcast')` on small DF |
| Adaptive Query Execution (AQE) | Always | `spark.conf.set("spark.sql.adaptive.enabled", "true")` |
| Partition Coalescing | AQE enabled | `spark.conf.set("spark.sql.adaptive.coalescePartitions.enabled", "true")` |
| Skew Join Optimization | AQE enabled | `spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")` |
| Dynamic Partition Pruning | Filtered partition writes | `spark.conf.set("spark.sql.optimizer.dynamicPartitionPruning.enabled", "true")` |
| Columnar Vectorized Reading | Parquet, ORC sources | `spark.conf.set("spark.sql.parquet.enableVectorizedReader", "true")` |
| Predicate Pushdown | All JDBC sources | Enabled by default in Spark JDBC connector |
| Column Pruning | All sources | Spark catalyst optimizer — SELECT only needed columns |
| Partition Discovery | Hive-style S3/HDFS | `basePath` option; read partition columns without scanning |
| Repartition Before Shuffle | Large GROUP BY / JOIN | `df.repartition(n, key_col)` before heavy operations |
| Bucketing | Repeated joins on same key | `df.write.bucketBy(n, key).saveAsTable(...)` |
| Bloom Filter | Large fact-dimension joins | `spark.conf.set("spark.sql.parquet.bloomFilter.enabled", "true")` |
| Caching | Reused DataFrames (fan-out) | `df.cache()` on shared nodes; `df.unpersist()` after last use |
| Kryo Serialization | Complex object shuffles | `spark.serializer = org.apache.spark.serializer.KryoSerializer` |
| Off-Heap Memory | Large datasets | `spark.memory.offHeap.enabled = true` |
| Z-Order / Liquid Clustering | Delta Lake repeated queries | `OPTIMIZE tbl ZORDER BY (key_col)` post-write |

### 8.2 JDBC Read Optimisations
| Optimisation | Configuration |
|---|---|
| Parallel JDBC reads | `numPartitions`, `partitionColumn`, `lowerBound`, `upperBound` |
| Fetch size | `fetchsize` (default: 1000; set to 10000–50000 for bulk reads) |
| Push-down predicates | `pushDownPredicate = true` |
| Push-down aggregates | `pushDownAggregate = true` (Spark 3.2+) |
| Connection pooling | HikariCP per executor |
| Isolation level | `isolationLevel = READ_UNCOMMITTED` for read performance on analytics queries |

### 8.3 Write Optimisations
| Optimisation | When Applied |
|---|---|
| Coalesce before write | When output is small (avoid many tiny files): `df.coalesce(n)` |
| Target file size | `spark.sql.files.maxRecordsPerFile` or explicit `repartition` |
| Parquet dictionary encoding | Always enabled for low-cardinality columns |
| Parquet statistics | Always written (min/max per row group; enables predicate pushdown on read) |
| Delta optimizeWrite | `spark.databricks.delta.optimizeWrite.enabled = true` |
| Snowflake multi-cluster | Use `COPY INTO` + multiple stages for parallel bulk load |
| BigQuery Storage Write API | Prefer over legacy load jobs for streaming + commits |
| Redshift COPY | Always via S3 staging; never via JDBC INSERT for bulk |
| Synapse COPY INTO | Use instead of INSERT for > 100K rows |

### 8.4 Memory & Resource Requirements per Component

| Component | Memory Intensity | Recommendations |
|---|---|---|
| SORT (global) | HIGH | Increase executor memory; repartition beforehand |
| GROUP BY + COLLECT_LIST | HIGH | Use approximate functions if exact not needed |
| CROSS JOIN | EXTREME | Warn user; set row limit guard |
| SCD2 (Spark) | MEDIUM-HIGH | Cache staging DFs; use Delta low-shuffle merge |
| PIVOT (auto-detect) | HIGH | Require explicit column list for production |
| WINDOW (large frame) | HIGH | Partition window by date or entity key |
| FUZZY MATCH | VERY HIGH | Use blocking keys to reduce candidate pairs |
| UNION ALL (many inputs) | LOW | Fine |
| BROADCAST JOIN | LOW (small side) | Verify small side < threshold before enabling |
| DEDUP (window-based) | MEDIUM | Repartition by dedup key before window |

### 8.5 Data Skew Handling
- **Salting**: for skewed join keys, platform generates salted join pattern (adds random salt to key; explodes other side N times)
- **AQE skew detection**: enabled by default; platform generates AQE-enabled code
- **Skew diagnostic**: during execution, platform detects partitions > 3× median size and logs warning with skewed partition stats
- **Manual repartition hint**: node property "Repartition Before Join" with configurable N partitions and key

---

## 9. Data Model Additions

```sql
-- Transformation component registry (what components are available)
CREATE TABLE transform_component_definitions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_type          VARCHAR(100) NOT NULL UNIQUE,  -- e.g., 'UNION', 'PIVOT', 'SCD_TYPE2'
    category                VARCHAR(100) NOT NULL,
    display_name            VARCHAR(255) NOT NULL,
    description             TEXT,
    min_inputs              INTEGER NOT NULL DEFAULT 1,
    max_inputs              INTEGER NOT NULL DEFAULT 1,
    min_outputs             INTEGER NOT NULL DEFAULT 1,
    max_outputs             INTEGER NOT NULL DEFAULT 1,
    input_port_labels       JSONB,                         -- Named input ports
    output_port_labels      JSONB,
    properties_schema       JSONB NOT NULL,                -- JSON Schema for the properties panel
    pyspark_template        TEXT,                          -- Code generation template
    scala_template          TEXT,
    sql_template_postgresql TEXT,
    sql_template_mssql      TEXT,
    sql_template_oracle     TEXT,
    sql_template_teradata   TEXT,
    sql_template_snowflake  TEXT,
    sql_template_bigquery   TEXT,
    sql_template_delta      TEXT,
    sql_template_iceberg    TEXT,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    requires_staging        BOOLEAN NOT NULL DEFAULT FALSE,
    performance_warning     TEXT,
    documentation_url       VARCHAR(500),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Write mode support per technology
CREATE TABLE technology_write_modes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technology              VARCHAR(100) NOT NULL,
    write_mode              VARCHAR(50) NOT NULL,
    is_supported            BOOLEAN NOT NULL DEFAULT FALSE,
    implementation_notes    TEXT,
    UNIQUE(technology, write_mode)
);

-- Compression codec support per format
CREATE TABLE compression_codec_support (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_format             VARCHAR(50) NOT NULL,
    codec                   VARCHAR(50) NOT NULL,
    read_supported          BOOLEAN NOT NULL DEFAULT FALSE,
    write_supported         BOOLEAN NOT NULL DEFAULT FALSE,
    is_splittable           BOOLEAN NOT NULL DEFAULT FALSE,
    relative_speed          VARCHAR(20),
    relative_ratio          VARCHAR(20),
    is_default_for_format   BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(file_format, codec)
);

-- Pipeline node instances (stores component config)
CREATE TABLE pipeline_nodes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id             UUID NOT NULL REFERENCES pipelines(id),
    component_type          VARCHAR(100) NOT NULL,
    node_label              VARCHAR(255),
    position_x              NUMERIC NOT NULL,
    position_y              NUMERIC NOT NULL,
    properties              JSONB NOT NULL,               -- Component-specific config
    input_port_connections  JSONB,                        -- {port_name: upstream_node_id}
    output_port_connections JSONB,                        -- {port_name: [downstream_node_ids]}
    validation_errors       JSONB,                        -- Current validation state
    estimated_row_count     BIGINT,                       -- Lazy estimated output
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 10. API Additions

```
-- Transformation component APIs
GET    /api/v1/transform-components                    List all component definitions
GET    /api/v1/transform-components/:type              Single component definition
GET    /api/v1/transform-components/:type/schema       JSON Schema for properties panel

-- Code preview (real-time, called from pipeline editor as user configures)
POST   /api/v1/pipelines/:id/nodes/:nodeId/preview-code
  body: { nodeProperties, targetEngine: 'pyspark'|'scala'|'sql', dialect }
  returns: { code, warnings }

-- Pipeline canvas node APIs
GET    /api/v1/pipelines/:id/nodes                     All nodes
POST   /api/v1/pipelines/:id/nodes                     Create node
PUT    /api/v1/pipelines/:id/nodes/:nodeId             Update node properties
DELETE /api/v1/pipelines/:id/nodes/:nodeId             Delete node
POST   /api/v1/pipelines/:id/nodes/:nodeId/validate    Validate node configuration
POST   /api/v1/pipelines/:id/nodes/:nodeId/estimate-rows  Estimate output row count

-- Write mode APIs
GET    /api/v1/technologies/:tech/write-modes          Supported write modes for technology
GET    /api/v1/connections/:id/write-modes             Supported write modes for connection

-- Compression APIs
GET    /api/v1/file-formats/:format/codecs             Supported compression codecs for format
GET    /api/v1/file-formats/:format/codecs/default     Default codec for format

-- Lakehouse SCD
POST   /api/v1/pipelines/:id/validate-scd-target       Validate SCD target table has required columns
POST   /api/v1/tables/:id/prepare-scd2                 Add missing SCD2 columns to target table
  body: { connection_id, schema, table, scd_config }
POST   /api/v1/tables/:id/delta-optimize               Run OPTIMIZE + ZORDER on Delta table
POST   /api/v1/tables/:id/delta-vacuum                 Run VACUUM on Delta table
GET    /api/v1/tables/:id/delta-history                Get Delta table history
```

---

## 11. Acceptance Criteria

| Feature | Acceptance Criteria |
|---|---|
| Set Operations | UNION, UNION ALL, INTERSECT, EXCEPT/MINUS nodes all produce correct results for BY_NAME and BY_POSITION alignment; code generated for all 8 DB dialects + PySpark + Scala |
| Join Components | All 9 join types generate correct PySpark/Scala/SQL; broadcast hints applied when small-side flag set; cross join guard blocks > 10M row cartesian products |
| Aggregate Functions | All 25+ aggregate functions generate valid code; ROLLUP/CUBE/GROUPING SETS produce correct multi-level aggregations |
| Window Functions | All 4 frame types and all 15+ window functions generate correct OVER() syntax for all dialects |
| PIVOT | Static (explicit values) and dynamic (auto-detect) pivot correct; CASE/WHEN emulation correct for PG/Teradata/Snowflake |
| UNPIVOT | Stack-based PySpark and native SQL UNPIVOT both produce correct long-format output |
| Write Matrix | Every technology in Section 4.2 supports at least APPEND, OVERWRITE, and UPSERT modes; file-based technologies support all listed compression codecs |
| Cross-Tech I/O | All 18 example cross-technology combinations in Section 4.3 execute end-to-end without errors |
| Compression | All 24 compression codecs read and write correctly for their supported formats; auto-codec selection applies correct default |
| Delta SCD1 | MERGE generates correct low-shuffle Delta MERGE; idempotent on re-run |
| Delta SCD2 | Two-operation pattern correctly expires old rows and inserts new versions; CDF captures changes |
| Iceberg SCD1/SCD2 | MERGE INTO generates valid Iceberg SQL; snapshot isolation maintained during write |
| Hudi SCD1 | UPSERT with precombine field correctly deduplicates; COW and MOR both supported |
| Snowflake SCD2 | Transient staging tables used; Time Travel available for rollback; ZORDER/CLUSTER BY applied |
| BigQuery SCD2 | DECLARE/SET scripting; partitioned target by effective_start_date; MERGE uses clustered key |
| Synapse SCD1 | Hash-distributed MERGE eliminates broadcast; columnstore index on target |
| Databricks SCD2 | APPLY CHANGES INTO (DLT) generates correct SCD2; Unity Catalog lineage captured |
| AQE | All generated PySpark code has AQE + skew join + partition coalescing enabled |
| Predicate Pushdown | JDBC sources with filter nodes push WHERE clause to source DB (verified via query plan) |
| Broadcast Join | Nodes with small lookup input auto-apply broadcast hint; code preview shows hint |
| Skew Guard | Partitions > 3× median size detected during execution; warning logged in execution detail |
| Dedup Performance | Dedup node with repartition-before-window option enabled produces correct results without OOM for 1B row dataset |
| Code Preview | Every node shows live-generated PySpark/Scala/SQL as user configures properties; zero latency gap > 500ms |
| Component Validation | Every component with incomplete configuration shows inline error; pipeline cannot be submitted with validation errors |

---

*Document Version: 1.0 | Created: 2026-03 | Owner: ETL Platform Team*
