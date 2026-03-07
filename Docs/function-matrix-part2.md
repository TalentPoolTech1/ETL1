
---

## 7. Data Type Conversion Functions

> **Priority: Critical** — Type conversion is at the heart of all ETL work. Every engine has different casting rules and implicit conversion behaviours that must be explicitly controlled.

### 7.1 Explicit Casting

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Cast to integer | `CAST(x AS INT)` | ✅ `CAST(x AS NUMBER(10))` | ✅ `CAST(x AS INTEGER)` | ✅ `CAST(x AS SIGNED)` | ✅ `CAST(x AS INT)` | ✅ `CAST(x AS INT)` | ✅ `CAST(x AS INT)` | ✅ `col.cast('int')` | Enable all; show target type picker |
| Cast to bigint | `CAST(x AS BIGINT)` | ✅ `CAST(x AS NUMBER(19))` | ✅ `CAST(x AS BIGINT)` | ✅ `CAST(x AS SIGNED)` | ✅ `CAST(x AS BIGINT)` | ✅ `CAST(x AS BIGINT)` | ✅ `CAST(x AS BIGINT)` | ✅ `col.cast('long')` | Enable all |
| Cast to decimal/numeric | `CAST(x AS DECIMAL(p,s))` | ✅ `CAST(x AS NUMBER(p,s))` | ✅ `CAST(x AS NUMERIC(p,s))` | ✅ `CAST(x AS DECIMAL(p,s))` | ✅ `CAST(x AS DECIMAL(p,s))` | ✅ `CAST(x AS DECIMAL(p,s))` | ✅ `CAST(x AS NUMBER(p,s))` | ✅ `col.cast(DecimalType(p,s))` | Show precision/scale inputs |
| Cast to float/double | `CAST(x AS FLOAT)` | ✅ `CAST(x AS FLOAT)` | ✅ `CAST(x AS FLOAT8)` | ✅ `CAST(x AS DOUBLE)` | ✅ `CAST(x AS FLOAT)` | ✅ `CAST(x AS FLOAT)` | ✅ `CAST(x AS FLOAT)` | ✅ `col.cast('double')` | Enable all |
| Cast to varchar/string | `CAST(x AS VARCHAR(n))` | ✅ `CAST(x AS VARCHAR2(n))` | ✅ `CAST(x AS VARCHAR(n))` | ✅ `CAST(x AS CHAR(n))` | ✅ `CAST(x AS VARCHAR(n))` | ✅ `CAST(x AS VARCHAR(n))` | ✅ `CAST(x AS VARCHAR(n))` | ✅ `col.cast('string')` | Show length input |
| Cast to date | `CAST(x AS DATE)` | ✅ `CAST(x AS DATE)` | ✅ `CAST(x AS DATE)` | ✅ `CAST(x AS DATE)` | ✅ `CAST(x AS DATE)` | ✅ `CAST(x AS DATE)` | ✅ `CAST(x AS DATE)` | ✅ `col.cast('date')` | Enable all |
| Cast to timestamp | `CAST(x AS TIMESTAMP)` | ✅ `CAST(x AS TIMESTAMP)` | ✅ `CAST(x AS TIMESTAMP)` | ✅ `CAST(x AS DATETIME)` | ✅ `CAST(x AS DATETIME2)` | ✅ `CAST(x AS TIMESTAMP)` | ✅ `CAST(x AS TIMESTAMP)` | ✅ `col.cast('timestamp')` | Enable all |
| Cast to boolean | `CAST(x AS BOOLEAN)` | ❌ NONE (no bool type) | ✅ `CAST(x AS BOOLEAN)` | ✅ `CAST(x AS UNSIGNED)` (0/1) | ✅ `CAST(x AS BIT)` | ✅ `CAST(x AS BOOLEAN)` | ✅ `CAST(x AS BOOLEAN)` | ✅ `col.cast('boolean')` | ORA: disable pushdown; MY/SS: amber |
| Convert number to string (formatted) | `TO_CHAR(n, fmt)` | ✅ `TO_CHAR` | ✅ `TO_CHAR` | ✅ `FORMAT` | ✅ `FORMAT` | ✅ `TO_CHAR` | ✅ `TO_CHAR` | ✅ `format_number()` | Enable all |
| Parse number from string | `TO_NUMBER(s, fmt)` | ✅ `TO_NUMBER` | ✅ `CAST/REPLACE` compose | ✅ `CAST` + clean | ✅ `CAST` / `TRY_CAST` | ✅ `CAST` | ✅ `TO_NUMBER` | ✅ `col.cast('double')` | PG/MY/SS/RS: amber — no format mask |
| Try cast (no error on fail) | `TRY_CAST(x AS type)` | ✅ `CASE WHEN … THEN … END` | ✅ compose | ❌ NONE | ✅ `TRY_CAST` | ❌ NONE | ✅ `TRY_CAST` | ✅ `col.cast(…)` (returns null on fail) | SS/SF: native; others: compose |
| Safe divide (avoid zero div) | `SAFE_DIVIDE(a, b)` | ✅ `CASE WHEN b=0 THEN NULL ELSE a/b END` | ✅ `NULLIF` compose | ✅ `IF(b=0,NULL,a/b)` | ✅ `CASE WHEN` | ✅ compose | ✅ `IFF(b=0,NULL,a/b)` | ✅ `F.when(col2==0,None).otherwise(col1/col2)` | All: compose |
| Implicit type coercion check | `TYPEOF(x)` | ✅ `DUMP(x)` | ✅ `pg_typeof(x)` | ❌ NONE | ✅ `SQL_VARIANT_PROPERTY` | ❌ NONE | ✅ `TYPEOF(x)` | ✅ `schema` inspection | Debug tool — not in transform palette |
| Number base conversion | `CONV(n, from_base, to_base)` | ⚠️ ALT | ❌ NONE | ✅ `CONV` | ⚠️ ALT | ❌ NONE | ⚠️ ALT | ✅ `conv(col,from,to)` | MY: native; PySpark: Spark SQL `conv()` |
| Encode to base64 | `BASE64_ENCODE(s)` | ✅ `UTL_RAW.CAST_TO_RAW` + encode | ✅ `encode(x::bytea,'base64')` | ✅ `TO_BASE64` | ✅ `sys.fn_varbintohexstr` (approx) | ✅ `BASE64_ENCODE` | ✅ `BASE64_ENCODE` | ✅ `base64(col)` | ORA/SS: amber |
| Decode from base64 | `BASE64_DECODE(s)` | ✅ compose | ✅ `decode(x,'base64')::text` | ✅ `FROM_BASE64` | ❌ NONE | ✅ `BASE64_DECODE` | ✅ `BASE64_DECODE` | ✅ `unbase64(col)` | SS: disable pushdown |

---

## 8. Conditional Logic Functions

### 8.1 Core Conditionals

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| If / Then / Else | `IF(cond, true_val, false_val)` | ⚠️ ALT `CASE WHEN` | ⚠️ ALT `CASE WHEN` | ✅ `IF(cond,t,f)` | ⚠️ ALT `IIF(cond,t,f)` (2012+) | ⚠️ ALT `CASE WHEN` | ✅ `IFF(cond,t,f)` | ✅ `F.when(cond,t).otherwise(f)` | ORA/PG/RS: amber — CASE WHEN. SS: IIF. SF: IFF |
| Case When (simple) | `CASE col WHEN val THEN res END` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `F.when().when().otherwise()` | Enable all |
| Case When (searched) | `CASE WHEN cond THEN res END` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `F.when().when().otherwise()` | Enable all |
| Decode (Oracle-style) | `DECODE(expr, s1,r1, s2,r2, default)` | ✅ `DECODE` | ⚠️ ALT `CASE WHEN` | ⚠️ ALT `CASE WHEN` | ⚠️ ALT `CASE WHEN` | ⚠️ ALT `CASE WHEN` | ⚠️ ALT `DECODE` (limited) | ✅ `F.when()` chain | ORA: native; all others: CASE WHEN |
| IIF (inline if) | `IIF(cond, t, f)` | ⚠️ ALT `CASE WHEN` | ⚠️ ALT `CASE WHEN` | ⚠️ ALT `IF` | ✅ `IIF` (2012+) | ⚠️ ALT `CASE WHEN` | ✅ `IFF` | ✅ `F.when(cond,t).otherwise(f)` | SS/SF: native; others: compose |
| Choose from list by index | `CHOOSE(n, v1, v2, …)` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `CHOOSE` | ❌ NONE | ❌ NONE | ✅ `F.element_at(F.array(…),n)` | SS: native; others: PySpark |
| Switch (multi-value shorthand) | `SWITCH(col, val:res …)` | ⚠️ ALT `DECODE` | ⚠️ ALT `CASE WHEN` | ⚠️ ALT `CASE WHEN` | ⚠️ ALT `IIF` chain | ⚠️ ALT `CASE WHEN` | ⚠️ ALT `CASE WHEN` | ✅ `F.when()` chain | All: amber — CASE WHEN |
| Boolean AND | `AND` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `&` / `F.col()&F.col()` | Enable all |
| Boolean OR | `OR` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `\|` / `F.col()\|F.col()` | Enable all |
| Boolean NOT | `NOT` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `~col` | Enable all |

---

## 9. NULL Handling Functions

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Use first non-null value | `COALESCE(v1, v2, …)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `coalesce()` | Enable all |
| Replace null with value | `NVL(val, default)` | ✅ `NVL` | ⚠️ ALT `COALESCE` | ⚠️ ALT `IFNULL` | ⚠️ ALT `ISNULL` | ⚠️ ALT `NVL` | ✅ `NVL` | ✅ `F.coalesce(col, F.lit(default))` | ORA/RS/SF: native; others: amber |
| Replace null with value (alias) | `IFNULL(val, default)` | ⚠️ ALT `NVL` | ⚠️ ALT `COALESCE` | ✅ `IFNULL` | ⚠️ ALT `ISNULL` | ⚠️ ALT `NVL` | ✅ `IFNULL` | ✅ `F.coalesce()` | MY/SF: native; others: amber |
| Replace null with value (MSSQL) | `ISNULL(val, default)` | ⚠️ ALT `NVL` | ⚠️ ALT `COALESCE` | ⚠️ ALT `IFNULL` | ✅ `ISNULL` | ⚠️ ALT `NVL` | ⚠️ ALT `IFNULL` | ✅ `F.coalesce()` | SS: native; others: amber |
| Nullify if equal to value | `NULLIF(val, match)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `F.nullif()` / `F.when(col==match, None)` | Enable all |
| NVL2 (null/not-null branch) | `NVL2(expr, not_null_val, null_val)` | ✅ `NVL2` | ⚠️ ALT `CASE WHEN … IS NULL` | ⚠️ ALT `IF(expr IS NULL,…)` | ⚠️ ALT `CASE WHEN` | ✅ `NVL2` | ✅ `NVL2` | ✅ `F.when(col.isNotNull(),v1).otherwise(v2)` | ORA/RS/SF: native; others: amber |
| Check if null | `IS NULL` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `col.isNull()` | Enable all |
| Check if not null | `IS NOT NULL` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `col.isNotNull()` | Enable all |

---

## 10. Aggregate Functions

### 10.1 Standard Aggregates

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Sum | `SUM(col)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `sum()` | Enable all |
| Count rows | `COUNT(*)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `count()` | Enable all |
| Count distinct | `COUNT(DISTINCT col)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `countDistinct()` | Enable all |
| Average | `AVG(col)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `avg()` | Enable all |
| Minimum | `MIN(col)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `min()` | Enable all |
| Maximum | `MAX(col)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `max()` | Enable all |
| Standard deviation (sample) | `STDDEV(col)` | ✅ `STDDEV` | ✅ `STDDEV` | ✅ `STDDEV` | ✅ `STDEV` | ✅ `STDDEV` | ✅ `STDDEV` | ✅ `stddev()` | Enable all |
| Standard deviation (population) | `STDDEV_POP(col)` | ✅ | ✅ | ✅ | ✅ `STDEVP` | ✅ | ✅ | ✅ `stddev_pop()` | Enable all; SS uses STDEVP |
| Variance (sample) | `VARIANCE(col)` | ✅ | ✅ | ✅ | ✅ `VAR` | ✅ | ✅ | ✅ `variance()` | Enable all |
| Variance (population) | `VAR_POP(col)` | ✅ | ✅ | ✅ | ✅ `VARP` | ✅ | ✅ | ✅ `var_pop()` | Enable all |
| Median | `MEDIAN(col)` | ✅ `MEDIAN` | ⚠️ ALT `PERCENTILE_CONT(0.5)` | ❌ NONE | ⚠️ ALT `PERCENTILE_CONT(0.5)` | ⚠️ ALT `PERCENTILE_CONT(0.5)` | ✅ `MEDIAN` | ✅ `percentile_approx(col,0.5)` | ORA/SF: native; MY: disable pushdown |
| Percentile (exact) | `PERCENTILE_CONT(p)` | ✅ | ✅ | ❌ NONE | ✅ | ✅ | ✅ | ✅ `percentile(col,p)` | MY: disable pushdown |
| Percentile (discrete) | `PERCENTILE_DISC(p)` | ✅ | ✅ | ❌ NONE | ✅ | ✅ | ✅ | ✅ `percentile(col,p)` | MY: disable pushdown |
| Mode | `MODE()` | ✅ (18c+) | ✅ `MODE()` WITHIN GROUP | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | 🔵 SPARK custom | MY/SS/RS: PySpark only |
| Bit AND aggregate | `BIT_AND(col)` | ❌ NONE | ✅ `BIT_AND` | ✅ `BIT_AND` | ✅ | ✅ `BIT_AND` | ✅ `BIT_AND` | ✅ `bit_and()` | ORA: disable |
| Bit OR aggregate | `BIT_OR(col)` | ❌ NONE | ✅ `BIT_OR` | ✅ `BIT_OR` | ✅ | ✅ `BIT_OR` | ✅ `BIT_OR` | ✅ `bit_or()` | ORA: disable |
| Boolean AND aggregate | `BOOL_AND(col)` | ❌ NONE | ✅ `BOOL_AND` | ❌ NONE | ❌ NONE | ✅ `BOOL_AND` | ✅ `BOOLAND_AGG` | ✅ `F.min(col.cast('int'))==1` | MY/SS/ORA: PySpark only |
| Boolean OR aggregate | `BOOL_OR(col)` | ❌ NONE | ✅ `BOOL_OR` | ❌ NONE | ❌ NONE | ✅ `BOOL_OR` | ✅ `BOOLOR_AGG` | ✅ `F.max(col.cast('int'))==1` | MY/SS/ORA: PySpark only |

### 10.2 String Aggregation

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Concatenate group into string | `LISTAGG(col, delim)` | ✅ `LISTAGG` | ❌ NONE (use STRING_AGG) | ✅ `GROUP_CONCAT` | ✅ `STRING_AGG` | ✅ `LISTAGG` | ✅ `LISTAGG` | ✅ `collect_list()` + `concat_ws()` | PG: ❌ disable pushdown; MY: GROUP_CONCAT amber |
| Concatenate group to string (ISO) | `STRING_AGG(col, delim)` | ⚠️ ALT `LISTAGG` | ✅ `STRING_AGG` (9.0+) | ⚠️ ALT `GROUP_CONCAT` | ✅ `STRING_AGG` | ✅ `LISTAGG` | ✅ `LISTAGG` | ✅ `collect_list()` + `concat_ws()` | ORA/MY: amber; RS: LISTAGG |
| Concatenate group (MySQL) | `GROUP_CONCAT` | ⚠️ ALT | ⚠️ ALT | ✅ `GROUP_CONCAT(col ORDER BY … SEPARATOR …)` | ⚠️ ALT | ⚠️ ALT | ⚠️ ALT | ✅ `collect_list()` + `concat_ws()` | MY: native; others: amber |
| Collect values to array | `ARRAY_AGG(col)` | ❌ NONE | ✅ `ARRAY_AGG` | ❌ NONE | ❌ NONE | ✅ `ARRAY_AGG` (limited) | ✅ `ARRAY_AGG` | ✅ `collect_list()` | MY/SS/ORA: PySpark only |
| Collect distinct values to array | `ARRAY_AGG(DISTINCT col)` | ❌ NONE | ✅ | ❌ NONE | ❌ NONE | ❌ NONE | ✅ | ✅ `collect_set()` | Most: PySpark only |

---

## 11. Window & Analytical Functions

> Window functions operate over a defined window (partition + ordering) within a result set. They do not collapse rows like aggregates.

### 11.1 Window Function Syntax Template

```sql
FUNCTION() OVER (
  PARTITION BY col1, col2
  ORDER BY col3 ASC
  ROWS BETWEEN n PRECEDING AND CURRENT ROW
)
```

| Technology | Window Support | Frame Clauses | Notes |
|---|---|---|---|
| Oracle | ✅ Full | ✅ ROWS/RANGE | Since Oracle 8i; full ANSI support |
| PostgreSQL | ✅ Full | ✅ ROWS/RANGE/GROUPS | Most complete implementation |
| MySQL | ✅ Full | ✅ ROWS/RANGE | Since MySQL 8.0 |
| SQL Server | ✅ Full | ⚠️ PARTIAL | ORDER BY required for most; ROWS supported; RANGE limited |
| Redshift | ⚠️ PARTIAL | ⚠️ PARTIAL | No GROUPS; limited frame types |
| Snowflake | ✅ Full | ✅ ROWS/RANGE | |
| PySpark | ✅ Full | ✅ ROWS/RANGE | `Window.partitionBy().orderBy().rowsBetween()` |

### 11.2 Running / Cumulative Aggregates (as Window Functions)

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Running total | `SUM() OVER (ORDER BY…)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `sum().over(w)` | Enable all |
| Running count | `COUNT() OVER (ORDER BY…)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `count().over(w)` | Enable all |
| Running average | `AVG() OVER (ORDER BY…)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `avg().over(w)` | Enable all |
| Running min | `MIN() OVER (ORDER BY…)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `min().over(w)` | Enable all |
| Running max | `MAX() OVER (ORDER BY…)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `max().over(w)` | Enable all |
| Sliding window average (N rows) | `AVG() OVER (… ROWS BETWEEN N PRECEDING AND CURRENT ROW)` | ✅ | ✅ | ✅ | ⚠️ PARTIAL | ✅ | ✅ | ✅ `avg().over(w.rowsBetween(-n,0))` | SS: RANGE only for some; amber |
| Cumulative distribution | `CUME_DIST() OVER` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `cume_dist().over(w)` | Enable all |
| Percent rank | `PERCENT_RANK() OVER` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `percent_rank().over(w)` | Enable all |

### 11.3 Lead / Lag (Offset Access)

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Value of next row | `LEAD(col, offset, default)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `lead(col, offset, default).over(w)` | Enable all |
| Value of previous row | `LAG(col, offset, default)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `lag(col, offset, default).over(w)` | Enable all |
| First value in window | `FIRST_VALUE(col)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `first(col).over(w)` | Enable all |
| Last value in window | `LAST_VALUE(col)` | ✅ | ✅ | ✅ | ✅ | ⚠️ PARTIAL | ✅ | ✅ `last(col).over(w)` | RS: frame clause needed; amber |
| Nth value in window | `NTH_VALUE(col, n)` | ✅ | ✅ | ✅ | ❌ NONE | ❌ NONE | ✅ | ✅ `nth_value(col,n).over(w)` | SS/RS: disable pushdown |

---

## 12. Ranking Functions

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Row number (unique sequential) | `ROW_NUMBER() OVER` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `row_number().over(w)` | Enable all |
| Rank (gaps for ties) | `RANK() OVER` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `rank().over(w)` | Enable all |
| Dense rank (no gaps for ties) | `DENSE_RANK() OVER` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `dense_rank().over(w)` | Enable all |
| N-tile bucket | `NTILE(n) OVER` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `ntile(n).over(w)` | Enable all |
| Width bucket (histogram) | `WIDTH_BUCKET(val, min, max, n)` | ✅ | ✅ | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `WIDTH_BUCKET` | ✅ `F.when()` chain or Bucketizer | MY/SS/RS: PySpark only |

---

## 13. Concatenation Functions

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Concatenate two strings | `CONCAT(s1, s2)` | ✅ `CONCAT` / `\|\|` | ✅ `CONCAT` / `\|\|` | ✅ `CONCAT` | ✅ `CONCAT` / `+` | ✅ `CONCAT` / `\|\|` | ✅ `CONCAT` / `\|\|` | ✅ `concat()` | Enable all |
| Concatenate many strings | `CONCAT(s1,s2,s3,…)` | ✅ `CONCAT(s1,s2,…)` | ✅ `CONCAT(s1,s2,…)` | ✅ `CONCAT` | ✅ `CONCAT` | ✅ `CONCAT` | ✅ `CONCAT` | ✅ `concat(col1,col2,…)` | Enable all |
| Concatenate with separator | `CONCAT_WS(sep, s1, s2, …)` | ⚠️ ALT compose | ✅ `CONCAT_WS` | ✅ `CONCAT_WS` | ✅ `CONCAT_WS` | ✅ `CONCAT_WS` | ✅ `CONCAT_WS` | ✅ `concat_ws(sep, cols…)` | ORA: amber |
| Pipe concatenation | `s1 \|\| s2` | ✅ | ✅ | ⚠️ (only in ANSI mode) | ❌ use `+` | ✅ | ✅ | ✅ | MY/SS: amber |
| Concatenate with null skip | `CONCAT_WS` (skips nulls) | ⚠️ ALT | ✅ `CONCAT_WS` (nulls skipped) | ✅ | ✅ | ✅ | ✅ | ✅ `concat_ws` (nulls skipped) | ORA: amber — CONCAT does not skip nulls |
| Repeat and concatenate | `REPEAT(s,n)` | ⚠️ ALT `RPAD` | ✅ | ✅ | ✅ `REPLICATE` | ✅ | ✅ | ✅ `repeat()` | ORA: amber |
| Wrap with prefix/suffix | `FORMAT('prefix{0}suffix', col)` | ⚠️ ALT `'prefix'\|\|col\|\|'suffix'` | ⚠️ ALT compose | ⚠️ ALT compose | ✅ `FORMATMESSAGE` / compose | ⚠️ ALT | ⚠️ ALT | ✅ `F.concat(F.lit(prefix),col,F.lit(suffix))` | All: compose |
| Array to string | `ARRAY_TO_STRING(arr, sep)` | ❌ NONE | ✅ `ARRAY_TO_STRING` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `ARRAY_TO_STRING` | ✅ `concat_ws(sep, col)` | MY/SS/ORA/RS: PySpark only |

---

## 14. Regular Expression Functions

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Match test (boolean) | `REGEXP_LIKE(s, pattern)` | ✅ `REGEXP_LIKE` | ✅ `s ~ pattern` | ✅ `s REGEXP pattern` | ⚠️ ALT `LIKE` (limited) | ✅ `s ~ pattern` | ✅ `REGEXP_LIKE` | ✅ `col.rlike(pattern)` | SS: only LIKE — no full regex; amber |
| Extract first match | `REGEXP_SUBSTR(s, pattern)` | ✅ `REGEXP_SUBSTR` | ✅ `REGEXP_MATCHES` (returns array) | ✅ `REGEXP_SUBSTR` | ❌ NONE | ✅ `REGEXP_SUBSTR` | ✅ `REGEXP_SUBSTR` | ✅ `regexp_extract(col,pattern,0)` | SS: disable pushdown |
| Extract Nth capture group | `REGEXP_SUBSTR(s, p, 1, 1, null, n)` | ✅ (6th param = group) | ✅ `(REGEXP_MATCHES(s,p))[n]` | ✅ (8.0.13+ with group param) | ❌ NONE | ✅ compose | ✅ `REGEXP_SUBSTR(s,p,1,1,'e',n)` | ✅ `regexp_extract(col,pattern,n)` | SS: disable; MY 8.0+ amber |
| Replace with regex | `REGEXP_REPLACE(s, p, r)` | ✅ `REGEXP_REPLACE` | ✅ `REGEXP_REPLACE` | ✅ `REGEXP_REPLACE` | ❌ NONE | ✅ `REGEXP_REPLACE` | ✅ `REGEXP_REPLACE` | ✅ `regexp_replace(col,pattern,repl)` | SS: disable pushdown |
| Count regex matches | `REGEXP_COUNT(s, pattern)` | ✅ `REGEXP_COUNT` | ⚠️ ALT `array_length(regexp_matches…,'g')` | ❌ NONE | ❌ NONE | ✅ `REGEXP_COUNT` | ✅ `REGEXP_COUNT` | ✅ `size(F.array_remove(split(col,pattern),…))` | MY/SS: PySpark; PG: amber |
| Instr with regex | `REGEXP_INSTR(s, pattern)` | ✅ `REGEXP_INSTR` | ⚠️ ALT compose | ⚠️ ALT | ❌ NONE | ✅ `REGEXP_INSTR` | ✅ `REGEXP_INSTR` | ✅ custom UDF | SS: disable |
| Extract all matches | `REGEXP_EXTRACT_ALL(s, p)` | ❌ NONE | ✅ `REGEXP_MATCHES(s,p,'g')` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `regexp_extract_all(col,pattern,idx)` | Most: PySpark only |
| Split by regex | `REGEXP_SPLIT(s, p)` | ❌ NONE | ✅ `REGEXP_SPLIT_TO_ARRAY` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `STRTOK_TO_ARRAY` (limited) | ✅ `split(col, pattern)` | Most: PySpark only |
| Named capture groups | regex with `(?P<name>…)` | ⚠️ Oracle 21c+ | ✅ | ❌ NONE | ❌ NONE | ❌ NONE | ✅ | ✅ | MY/SS/RS: disable; ORA: amber |
| Lookahead / lookbehind | `(?=…) (?<=…)` | ⚠️ PARTIAL | ✅ | ❌ NONE | ❌ NONE | ❌ NONE | ⚠️ PARTIAL | ✅ | MY/SS/RS: PySpark only |

