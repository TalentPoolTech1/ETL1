
---

## 15. Hierarchical & Recursive Functions

> Hierarchical functions allow traversal of tree-structured data (parent-child relationships). Support varies dramatically by engine.

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Hierarchical query (connect by) | `CONNECT BY` | ✅ `CONNECT BY PRIOR` — native Oracle syntax | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | 🔵 SPARK GraphFrames | ORA: unique native. All others: PySpark |
| Recursive CTE | `WITH RECURSIVE cte AS (…)` | ✅ (12c+ as `WITH cte (… CYCLE …)`) | ✅ `WITH RECURSIVE` | ✅ `WITH RECURSIVE` (8.0+) | ✅ `WITH cte AS (… UNION ALL …)` | ❌ NONE | ✅ `WITH RECURSIVE` | 🔵 SPARK GraphFrames | RS: disable; ORA: note syntax |
| Level in hierarchy | `LEVEL` (pseudocolumn) | ✅ `LEVEL` (CONNECT BY) | ⚠️ ALT via recursive CTE | ⚠️ ALT via recursive CTE | ⚠️ ALT via recursive CTE | ❌ NONE | ⚠️ ALT | 🔵 SPARK custom | ORA: unique; others: amber |
| Root node | `CONNECT_BY_ROOT(col)` | ✅ Oracle only | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | 🔵 SPARK GraphFrames | ORA: unique native |
| Path string | `SYS_CONNECT_BY_PATH(col, sep)` | ✅ Oracle only | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | 🔵 SPARK custom | ORA: unique native |
| Is leaf? | `CONNECT_BY_ISLEAF` | ✅ Oracle only | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | 🔵 SPARK GraphFrames | ORA: unique native |
| Is cycle? | `CONNECT_BY_ISCYCLE` | ✅ Oracle only (with NOCYCLE) | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | 🔵 SPARK GraphFrames | ORA: unique native |
| Flatten hierarchy to rows | `FLATTEN recursive CTE` | ✅ via CONNECT BY | ✅ via WITH RECURSIVE | ✅ via WITH RECURSIVE | ✅ via CTE | ❌ NONE | ✅ via RECURSIVE | 🔵 SPARK GraphFrames | RS: PySpark only |

---

## 16. Array & Collection Functions

> Array functions are primarily available in PySpark and PostgreSQL. Oracle, MySQL, SQL Server, and Redshift have limited or no native array support in SQL queries.

### 16.1 Array Construction & Access

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Create array literal | `ARRAY[v1, v2, …]` | ❌ NONE | ✅ `ARRAY[v1,v2]` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `ARRAY_CONSTRUCT(v1,v2)` | ✅ `F.array(col1,col2)` | ORA/MY/SS/RS: PySpark only |
| Get element at index | `ARRAY[n]` or `element_at` | ❌ NONE | ✅ `arr[n]` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `arr[n]` | ✅ `element_at(col,n)` | ORA/MY/SS/RS: PySpark only |
| Array length / size | `ARRAY_LENGTH(arr)` | ❌ NONE | ✅ `ARRAY_LENGTH(arr,1)` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `ARRAY_SIZE` | ✅ `size(col)` | ORA/MY/SS/RS: PySpark only |
| Append element to array | `ARRAY_APPEND(arr, val)` | ❌ NONE | ✅ `ARRAY_APPEND` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `ARRAY_APPEND` | ✅ `array_append(col,val)` (Spark 3.4+) | ORA/MY/SS/RS: PySpark only |
| Prepend element to array | `ARRAY_PREPEND(val, arr)` | ❌ NONE | ✅ `ARRAY_PREPEND` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | 🔵 SPARK `F.concat(F.array(lit(v)),col)` | PG: native; others: PySpark |
| Concatenate two arrays | `ARRAY_CAT(a, b)` | ❌ NONE | ✅ `ARRAY_CAT` / `\|\|` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `ARRAY_CAT` | ✅ `F.concat(col1,col2)` | ORA/MY/SS/RS: PySpark only |
| Check if value in array | `val = ANY(arr)` | ❌ NONE | ✅ `= ANY(arr)` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `ARRAY_CONTAINS(arr,val)` | ✅ `array_contains(col,val)` | ORA/MY/SS/RS: PySpark only |
| Remove duplicates from array | `ARRAY_DISTINCT(arr)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `ARRAY_DISTINCT` | ✅ `array_distinct(col)` | PySpark/SF only |
| Remove element from array | `ARRAY_REMOVE(arr, val)` | ❌ NONE | ✅ `ARRAY_REMOVE` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `array_remove(col,val)` | PG/PySpark only |
| Sort array | `ARRAY_SORT(arr)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `ARRAY_SORT` | ✅ `array_sort(col)` | SF/PySpark only |
| Flatten nested array | `FLATTEN(arr)` | ❌ NONE | ✅ `UNNEST` (to rows) | ❌ NONE | ❌ NONE | ✅ `SUPER` type | ✅ `FLATTEN` | ✅ `flatten(col)` | ORA/MY/SS: PySpark only |
| Slice array | `ARRAY_SLICE(arr, from, to)` | ❌ NONE | ✅ `arr[from:to]` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `ARRAY_SLICE` | ✅ `slice(col,from,length)` | ORA/MY/SS/RS: PySpark only |

### 16.2 Explode / Unpivot

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Explode array to rows | `UNNEST / EXPLODE` | ⚠️ ALT `TABLE(COLUMN_VALUE)` | ✅ `UNNEST(arr)` | ❌ NONE | ⚠️ ALT `OPENJSON` | ❌ NONE | ✅ `FLATTEN(input=>arr)` | ✅ `explode(col)` | MY/RS: PySpark only |
| Explode with index | `POSEXPLODE` | ❌ NONE | ✅ `UNNEST WITH ORDINALITY` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `FLATTEN` with index | ✅ `posexplode(col)` | ORA/MY/SS/RS: PySpark only |
| Explode outer (keep nulls) | `EXPLODE_OUTER` | ❌ NONE | ✅ `LEFT JOIN UNNEST` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ via LEFT JOIN | ✅ `explode_outer(col)` | ORA/MY/SS/RS: PySpark only |
| Zip two arrays | `ARRAYS_ZIP(a, b)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `ARRAYS_ZIP` | ✅ `arrays_zip(col1,col2)` | PySpark/SF only |
| Map from arrays | `MAP_FROM_ARRAYS(keys, vals)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `OBJECT_CONSTRUCT_KEEP_NULL` | ✅ `map_from_arrays(col1,col2)` | PySpark/SF only |
| Aggregate to array | `COLLECT_LIST / ARRAY_AGG` | ❌ NONE | ✅ `ARRAY_AGG` | ❌ NONE | ❌ NONE | ⚠️ PARTIAL | ✅ `ARRAY_AGG` | ✅ `collect_list(col)` | ORA/MY/SS: PySpark only |
| Aggregate to distinct set | `COLLECT_SET / ARRAY_AGG(DISTINCT)` | ❌ NONE | ✅ `ARRAY_AGG(DISTINCT …)` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `ARRAY_AGG(DISTINCT …)` | ✅ `collect_set(col)` | ORA/MY/SS/RS: PySpark only |
| Transform array elements | `TRANSFORM(arr, x -> expr)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `TRANSFORM(arr, e -> expr)` | ✅ `transform(col, lambda x: …)` | PySpark/SF only |
| Filter array elements | `FILTER(arr, x -> cond)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `FILTER(arr, e -> cond)` | ✅ `filter(col, lambda x: …)` | PySpark/SF only |
| Reduce array | `AGGREGATE(arr, init, fn)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `aggregate(col,init,merge,finish)` | PySpark only |
| Array intersection | `ARRAY_INTERSECT(a, b)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `ARRAY_INTERSECTION` | ✅ `array_intersect(col1,col2)` | PySpark/SF only |
| Array union | `ARRAY_UNION(a, b)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `ARRAY_CAT` + distinct | ✅ `array_union(col1,col2)` | PySpark/SF only |
| Array except | `ARRAY_EXCEPT(a, b)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `array_except(col1,col2)` | PySpark only |

---

## 17. JSON Functions

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Parse JSON string | `JSON_PARSE / PARSE_JSON` | ✅ (12c+) | ✅ `::json` / `::jsonb` | ✅ `JSON_DOC` (8.0+) | ✅ `OPENJSON / ISJSON` | ✅ `JSON_PARSE` | ✅ `PARSE_JSON` | ✅ `from_json(col, schema)` | All: enable with version notes |
| Extract JSON field (string) | `JSON_VALUE(doc, path)` | ✅ `JSON_VALUE` (12c+) | ✅ `json_col->>'key'` | ✅ `JSON_UNQUOTE(JSON_EXTRACT(…))` | ✅ `JSON_VALUE` | ✅ `JSON_EXTRACT_PATH_TEXT` | ✅ `GET_PATH / JSON_EXTRACT_PATH_TEXT` | ✅ `get_json_object(col,'$.key')` | Enable all; path syntax varies |
| Extract JSON object | `JSON_QUERY(doc, path)` | ✅ `JSON_QUERY` | ✅ `json_col->'key'` | ✅ `JSON_EXTRACT` | ✅ `JSON_QUERY` | ✅ `JSON_EXTRACT_PATH` | ✅ `GET_PATH` | ✅ `get_json_object()` | Enable all |
| Check key exists | `JSON_EXISTS(doc, path)` | ✅ `JSON_EXISTS` (12c+) | ✅ `jsonb ? 'key'` | ✅ `JSON_CONTAINS_PATH` | ✅ `ISJSON + JSON_VALUE IS NOT NULL` | ⚠️ ALT `JSON_EXTRACT_PATH_TEXT IS NOT NULL` | ✅ `GET_PATH IS NOT NULL` | ✅ `get_json_object() is not null` | All: compose |
| Modify JSON | `JSON_MODIFY(doc, path, val)` | ✅ `JSON_MERGEPATCH` | ✅ `jsonb_set` | ✅ `JSON_SET` | ✅ `JSON_MODIFY` | ❌ NONE | ✅ compose | ✅ custom UDF | RS: disable |
| Convert row to JSON | `ROW_TO_JSON / TO_JSON` | ⚠️ ALT compose | ✅ `ROW_TO_JSON` | ✅ `JSON_OBJECT` | ✅ `FOR JSON PATH` | ⚠️ ALT | ✅ `OBJECT_CONSTRUCT` | ✅ `to_json(struct(cols…))` | Most: amber |
| Array of rows to JSON | `JSON_ARRAYAGG(col)` | ✅ `JSON_ARRAYAGG` (12c+) | ✅ `JSON_AGG` | ✅ `JSON_ARRAYAGG` | ✅ `FOR JSON PATH` | ⚠️ ALT | ✅ `ARRAY_AGG` compose | ✅ `to_json(collect_list(col))` | All: amber/compose |
| JSON to rows | `JSON_TABLE` | ✅ `JSON_TABLE` (12c+) | ✅ `jsonb_to_recordset` | ✅ `JSON_TABLE` | ✅ `OPENJSON` | ⚠️ ALT `super` type | ✅ `FLATTEN` | ✅ `from_json` + `explode` | All: complex; show PySpark preferred |
| Validate JSON | `IS JSON` | ✅ `IS JSON` | ✅ compose | ✅ `JSON_VALID` | ✅ `ISJSON()` | ✅ `IS_VALID_JSON` (via compose) | ✅ `IS_VALID_JSON` | ✅ custom UDF | All: note differences |
| JSON object keys | `JSON_OBJECT_KEYS(doc)` | ⚠️ ALT | ✅ `json_object_keys` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ compose | ✅ custom UDF | MY/SS/RS/ORA: limit |
| Merge JSON objects | `JSON_MERGE` | ✅ `JSON_MERGEPATCH` | ✅ `jsonb \|\| jsonb` | ✅ `JSON_MERGE_PATCH` | ❌ NONE | ❌ NONE | ✅ `OBJECT_INSERT` | ✅ custom UDF | SS/RS: PySpark only |
| Prettify JSON | `JSON_PRETTY(doc)` | ❌ NONE | ❌ NONE | ✅ `JSON_PRETTY` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ custom Python | MY: unique |
| JSON path query | `JSONPATH` | ⚠️ ALT | ✅ `jsonb @? '$.key'` | ⚠️ ALT | ⚠️ ALT | ❌ NONE | ⚠️ ALT | ✅ `get_json_object` + jsonpath | PG: best native support |
| Struct/map to JSON string | `TO_JSON(struct)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `to_json(col)` | PySpark only |
| JSON string to struct | `FROM_JSON(s, schema)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `from_json(col,schema)` | PySpark only |
| Flatten JSON to columns | `JSON_NORMALIZE` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `json_normalize` via pandas UDF | PySpark only |

---

## 18. Encoding & Hashing Functions

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| MD5 hash | `MD5(s)` | ✅ `DBMS_CRYPTO.HASH` | ✅ `MD5(s)` | ✅ `MD5(s)` | ✅ `HASHBYTES('MD5',s)` | ✅ `MD5(s)` | ✅ `MD5(s)` | ✅ `md5(col)` | Enable all; ORA: amber (package required) |
| SHA-1 hash | `SHA1(s)` | ✅ `DBMS_CRYPTO.HASH` | ✅ `encode(sha1(s::bytea),'hex')` | ✅ `SHA1(s)` | ✅ `HASHBYTES('SHA1',s)` | ✅ `SHA1(s)` | ✅ `SHA1(s)` | ✅ `sha1(col)` | Enable all |
| SHA-256 hash | `SHA2(s, 256)` | ✅ `DBMS_CRYPTO.HASH` | ✅ `encode(sha256(s::bytea),'hex')` | ✅ `SHA2(s,256)` | ✅ `HASHBYTES('SHA2_256',s)` | ✅ `SHA2(s,256)` | ✅ `SHA2(s,256)` | ✅ `sha2(col,256)` | Enable all |
| SHA-512 hash | `SHA2(s, 512)` | ✅ `DBMS_CRYPTO` | ✅ `encode(sha512(…),'hex')` | ✅ `SHA2(s,512)` | ✅ `HASHBYTES('SHA2_512',s)` | ✅ `SHA2(s,512)` | ✅ `SHA2(s,512)` | ✅ `sha2(col,512)` | Enable all |
| CRC32 checksum | `CRC32(s)` | ❌ NONE | ❌ NONE | ✅ `CRC32(s)` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `crc32(col)` | MY/PySpark: enabled; others: disable |
| Hash integer | `HASH(val)` | ✅ `ORA_HASH` | ✅ `HASHTEXT` | ❌ NONE | ✅ `CHECKSUM` | ✅ `STRTOL` | ✅ `HASH(val)` | ✅ `hash(col)` | Enable all; name varies |
| Base64 encode | `BASE64_ENCODE(s)` | ✅ UTL_RAW compose | ✅ `encode(val::bytea,'base64')` | ✅ `TO_BASE64` | ⚠️ ALT | ✅ `BASE64_ENCODE` | ✅ `BASE64_ENCODE` | ✅ `base64(col)` | SS: amber |
| Base64 decode | `BASE64_DECODE(s)` | ✅ UTL_RAW compose | ✅ `decode(val,'base64')::text` | ✅ `FROM_BASE64` | ❌ NONE | ✅ `BASE64_DECODE` | ✅ `BASE64_DECODE` | ✅ `unbase64(col)` | SS: disable pushdown |
| URL encode | `URL_ENCODE(s)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `URL_ENCODE` | ✅ custom UDF | Most: PySpark only |
| URL decode | `URL_DECODE(s)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `URL_DECODE` | ✅ custom UDF | Most: PySpark only |
| UUID generate | `UUID()` | ✅ `SYS_GUID()` | ✅ `GEN_RANDOM_UUID()` | ✅ `UUID()` | ✅ `NEWID()` | ✅ `UUID_GENERATE` | ✅ `UUID_STRING()` | ✅ `uuid()` | Enable all; syntax varies |
| UUID to binary | `UUID_TO_BIN(uuid)` | ❌ NONE | ⚠️ ALT `uuid::bytea` | ✅ `UUID_TO_BIN` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ custom UDF | MY: native |

---

## 19. Statistical Functions

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Correlation coefficient | `CORR(y, x)` | ✅ | ✅ | ❌ NONE | ❌ NONE | ✅ | ✅ | ✅ `corr(col1,col2)` | MY/SS: PySpark only |
| Covariance (sample) | `COVAR_SAMP(y, x)` | ✅ | ✅ | ❌ NONE | ❌ NONE | ✅ | ✅ | ✅ `covar_samp()` | MY/SS: PySpark only |
| Covariance (population) | `COVAR_POP(y, x)` | ✅ | ✅ | ❌ NONE | ❌ NONE | ✅ | ✅ | ✅ `covar_pop()` | MY/SS: PySpark only |
| Regression slope | `REGR_SLOPE(y, x)` | ✅ | ✅ | ❌ NONE | ❌ NONE | ✅ | ✅ | 🔵 SPARK via MLlib | MY/SS: PySpark/MLlib |
| Regression intercept | `REGR_INTERCEPT(y, x)` | ✅ | ✅ | ❌ NONE | ❌ NONE | ✅ | ✅ | 🔵 SPARK via MLlib | MY/SS: PySpark/MLlib |
| Linear regression R² | `REGR_R2(y, x)` | ✅ | ✅ | ❌ NONE | ❌ NONE | ✅ | ✅ | 🔵 SPARK via MLlib | MY/SS: PySpark/MLlib |
| Skewness | `SKEWNESS(col)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `skewness(col)` | PySpark only |
| Kurtosis | `KURTOSIS(col)` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `kurtosis(col)` | PySpark only |
| Approximate count distinct | `APPROX_COUNT_DISTINCT(col)` | ✅ `APPROX_COUNT_DISTINCT` (12c+) | ⚠️ ALT `COUNT(DISTINCT)` | ❌ NONE | ✅ `APPROX_COUNT_DISTINCT` (2019+) | ✅ `APPROXIMATE COUNT DISTINCT` | ✅ `APPROX_COUNT_DISTINCT` | ✅ `approx_count_distinct(col)` | MY: disable pushdown |
| Approximate percentile | `APPROX_PERCENTILE(col, p)` | ✅ `APPROX_PERCENTILE` (12c+) | ⚠️ ALT `PERCENTILE_CONT` | ❌ NONE | ❌ NONE | ✅ `APPROXIMATE PERCENTILE_DISC` | ✅ `APPROX_PERCENTILE` | ✅ `percentile_approx(col,p)` | MY/SS: PySpark only |
| Hypothesis test | `STATS_T_TEST_ONE(col,val)` | ✅ (Oracle specific) | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | 🔵 SPARK via SciPy UDF | ORA unique; others: PySpark |
| Rank correlation (Spearman) | `STATS_SPEARMAN_CORR` | ✅ Oracle only | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | 🔵 SPARK custom UDF | ORA unique |
| Rank test | `STATS_WSR_TEST` | ✅ Oracle only | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | 🔵 SPARK custom UDF | ORA unique |
| Histogram bucket assign | `WIDTH_BUCKET(val,min,max,n)` | ✅ | ✅ | ❌ NONE | ❌ NONE | ❌ NONE | ✅ | ✅ `Bucketizer` (MLlib) | MY/SS/RS: PySpark |

---

## 20. Technology-Specific Unique Functions

> These functions are unique to a single technology and have no cross-engine equivalent. They are shown **only** when that technology is the source and the execution point is Source DB.

### 20.1 Oracle-Unique Functions

| Function | Description | Available In UI When |
|---|---|---|
| `ROWNUM` | Pseudo-column: sequential row number | Oracle pushdown only |
| `ROWID` | Physical row address | Oracle pushdown only — read-only use |
| `DECODE(e,s1,r1,…)` | Compact CASE WHEN alternative | Oracle pushdown only |
| `NVL(v,d)` | Null-value replacement (2-arg) | Oracle pushdown only (shown as alias for COALESCE) |
| `NVL2(e,nn,nv)` | Not-null/null branch | Oracle pushdown only |
| `LNNVL(cond)` | True if condition is false or NULL | Oracle pushdown only |
| `SYS_GUID()` | Generate globally unique identifier | Oracle pushdown only |
| `ORA_HASH(e,max,seed)` | Oracle deterministic hash | Oracle pushdown only |
| `CONNECT BY PRIOR` | Hierarchical traversal | Oracle pushdown only |
| `SYS_CONNECT_BY_PATH` | Path string in hierarchy | Oracle pushdown only |
| `CONNECT_BY_ROOT` | Root value in hierarchy | Oracle pushdown only |
| `LEVEL` (pseudocolumn) | Depth in hierarchy | Oracle pushdown only |
| `DUMP(e,fmt)` | Internal datatype dump | Oracle pushdown only |
| `VSIZE(e)` | Size in bytes of Oracle internal rep | Oracle pushdown only |
| `MONTHS_BETWEEN(d1,d2)` | Fractional months between dates | Oracle preferred (others: compose) |
| `LAST_DAY(d)` | Last day of month | Oracle native |
| `NEXT_DAY(d, day_name)` | Next occurrence of weekday | Oracle pushdown only |
| `TRUNC(d, unit)` | Date truncation with unit string | Oracle native |
| `ROUND(d, unit)` | Date rounding with unit string | Oracle native |
| `TO_SINGLE_BYTE(s)` | Convert multi-byte to single-byte | Oracle pushdown only |
| `SOUNDEX` extended | Oracle extended soundex | Oracle pushdown only |
| `LISTAGG … WITHIN GROUP` | Ordered string aggregation | Oracle pushdown only (standard in 21c) |
| `WM_CONCAT` (deprecated) | Old aggregation (pre-LISTAGG) | Oracle pushdown only — warn as deprecated |
| `PIVOT / UNPIVOT` | Rotate rows to columns | Oracle native (others: PySpark) |
| `STATS_*` family | Statistical tests | Oracle pushdown only |
| `MODEL` clause | In-database spreadsheet model | Oracle pushdown only |
| `MATCH_RECOGNIZE` | Pattern matching in sequences | Oracle pushdown only |

### 20.2 PostgreSQL-Unique Functions

| Function | Description | Available In UI When |
|---|---|---|
| `GENERATE_SERIES(from,to,step)` | Generate row series | PG pushdown only |
| `STRING_TO_ARRAY(s,delim)` | Split string to text array | PG pushdown only |
| `ARRAY_TO_STRING(arr,sep)` | Join array to string | PG pushdown only |
| `jsonb_set(doc,path,val)` | Modify JSONB value | PG pushdown only |
| `json_object_keys(doc)` | Get keys of JSON object | PG pushdown only |
| `ROW_TO_JSON(row)` | Convert record to JSON | PG pushdown only |
| `json_agg(col)` | Aggregate to JSON array | PG pushdown only |
| `TSQUERY / TSVECTOR` | Full-text search types | PG pushdown only |
| `TO_TSVECTOR(text)` | Convert text to search vector | PG pushdown only |
| `TO_TSQUERY(text)` | Convert query string | PG pushdown only |
| `@@` (text search match) | Match text against tsquery | PG pushdown only |
| `AGE(d1,d2)` | Human-readable interval | PG pushdown only |
| `EXTRACT(EPOCH FROM …)` | Seconds since epoch | PG pushdown only |
| `CBRT(n)` | Cube root | PG pushdown only |
| `||` (array concat) | Array concatenation | PG pushdown only |
| `ANY(arr)` / `ALL(arr)` | Scalar vs array comparison | PG pushdown only |
| `DISTINCT ON (col)` | Deduplication with order | PG pushdown only |
| `FILTER (WHERE cond)` | Conditional aggregate | PG pushdown only |
| `WINDOW` named window | Reusable window definition | PG pushdown only |
| `LATERAL` join | Correlated lateral join | PG pushdown only |
| `TABLESAMPLE` | Row sampling | PG pushdown only |
| `CROSSTAB` | Pivot via extension | PG + tablefunc extension |
| `LEVENSHTEIN(s1,s2)` | Edit distance | PG + fuzzystrmatch extension |

### 20.3 MySQL-Unique Functions

| Function | Description | Available In UI When |
|---|---|---|
| `GROUP_CONCAT(col ORDER BY … SEPARATOR …)` | String aggregation with order | MySQL pushdown only |
| `FIND_IN_SET(val, csv)` | Position in comma-separated list | MySQL pushdown only |
| `FIELD(val, v1, v2, …)` | Position of value in list | MySQL pushdown only |
| `ELT(n, v1, v2, …)` | Return Nth value from list | MySQL pushdown only |
| `BIT_LENGTH(s)` | String length in bits | MySQL pushdown only |
| `MAKE_SET(bits, v1, v2, …)` | Set string from bit mask | MySQL pushdown only |
| `PERIOD_ADD(period, n)` | Add months to YYYYMM period | MySQL pushdown only |
| `PERIOD_DIFF(p1, p2)` | Months between YYYYMM periods | MySQL pushdown only |
| `FROM_DAYS(n)` | Convert day number to date | MySQL pushdown only |
| `TO_DAYS(d)` | Convert date to day number | MySQL pushdown only |
| `MAKEDATE(y, dayofyear)` | Construct date from year + DOY | MySQL pushdown only |
| `MAKETIME(h, m, s)` | Construct time from parts | MySQL pushdown only |
| `JSON_TABLE(doc,path,columns)` | JSON rows (8.0+) | MySQL pushdown only |
| `REGEXP_LIKE, REGEXP_SUBSTR` (8.0+) | Full regex support | MySQL 8.0+ pushdown only |
| `ST_*` spatial functions | Spatial geometry operations | MySQL pushdown only |

### 20.4 SQL Server-Unique Functions

| Function | Description | Available In UI When |
|---|---|---|
| `IIF(cond, true_val, false_val)` | Inline if | SS pushdown only (others: CASE WHEN) |
| `CHOOSE(n, v1, v2, …)` | Choose from indexed list | SS pushdown only |
| `FORMAT(val, fmt, culture)` | Locale-aware formatting | SS pushdown only |
| `TRY_CAST(x AS type)` | Cast without exception | SS pushdown only (others: CASE WHEN) |
| `TRY_CONVERT(type, val)` | Convert without exception | SS pushdown only |
| `TRY_PARSE(s AS type)` | Parse without exception | SS pushdown only |
| `EOMONTH(d, n)` | End of month (+ offset months) | SS pushdown only |
| `DATEFROMPARTS(y,m,d)` | Construct date from parts | SS pushdown only |
| `DATETIMEFROMPARTS(y,m,d,h,mi,s,ms)` | Construct datetime | SS pushdown only |
| `TIMEFROMPARTS(h,m,s,fs,prec)` | Construct time | SS pushdown only |
| `DATENAME(part, date)` | Date part as string | SS pushdown only |
| `SWITCHOFFSET(ts, tz)` | Change timezone offset | SS pushdown only |
| `AT TIME ZONE 'tz'` | Timezone conversion | SS 2016+ pushdown only |
| `STRING_SPLIT(s, delim)` | Split string to table | SS pushdown only |
| `STRING_AGG(col, sep)` | String aggregation (2017+) | SS pushdown only |
| `TRANSLATE(s, from, to)` | Character translation | SS 2017+ pushdown only |
| `TRIM / LTRIM / RTRIM` extended | Extended trim with chars (2017+) | SS pushdown only |
| `CONCAT_WS(sep, …)` | Concat with separator (2017+) | SS pushdown only |
| `OPENJSON(doc)` | Parse JSON to rows | SS pushdown only |
| `FOR JSON PATH` | Rows to JSON | SS pushdown only |
| `PIVOT / UNPIVOT` | Rotate rows/columns | SS pushdown only |
| `CROSS APPLY / OUTER APPLY` | Lateral-style join | SS pushdown only |

### 20.5 Snowflake-Unique Functions

| Function | Description | Available In UI When |
|---|---|---|
| `IFF(cond, t, f)` | Inline conditional | SF pushdown only |
| `ZEROIFNULL(val)` | Returns 0 if null | SF pushdown only |
| `NULLIFZERO(val)` | Returns null if 0 | SF pushdown only |
| `EQUAL_NULL(a, b)` | NULL-safe equality | SF pushdown only |
| `OBJECT_CONSTRUCT(k,v,…)` | Build JSON object | SF pushdown only |
| `OBJECT_INSERT(obj,k,v)` | Add key to object | SF pushdown only |
| `OBJECT_KEYS(obj)` | Get object keys | SF pushdown only |
| `ARRAY_CONSTRUCT(v,…)` | Build array | SF pushdown only |
| `ARRAY_COMPACT(arr)` | Remove nulls from array | SF pushdown only |
| `ARRAY_FLATTEN(arr)` | Flatten nested arrays | SF pushdown only |
| `ARRAYS_OVERLAP(a,b)` | Check array overlap | SF pushdown only |
| `FLATTEN(input=>col)` | Explode variant/array to rows | SF pushdown only |
| `PARSE_JSON(s)` | Parse JSON string to VARIANT | SF pushdown only |
| `PARSE_XML(s)` | Parse XML to OBJECT | SF pushdown only |
| `STRTOK(s,delim,n)` | Tokenize string (Nth token) | SF pushdown only |
| `STRTOK_TO_ARRAY(s,delim)` | Tokenize to array | SF pushdown only |
| `EDITDISTANCE(s1,s2)` | Levenshtein edit distance | SF pushdown only |
| `JAROWINKLER_SIMILARITY(s1,s2)` | Jaro-Winkler similarity (0–100) | SF pushdown only |
| `SOUNDEX_P123(s)` | Phonex soundex variant | SF pushdown only |
| `UNIFORM(lo,hi,rng)` | Random number in range | SF pushdown only |
| `NORMAL(mean,std,rng)` | Random normal distribution | SF pushdown only |
| `TIMEADD(unit,n,ts)` | Add interval to timestamp | SF pushdown only |
| `TIMEDIFF(unit,t1,t2)` | Difference in time units | SF pushdown only |
| `DATE_PART(part,d)` | Extract date component | SF pushdown only |
| `CONVERT_TIMEZONE(from,to,ts)` | Timezone conversion | SF pushdown only |
| `GENERATOR(rowcount=>n)` | Generate N rows | SF pushdown only |
| `SEQ4() / SEQ8()` | Monotonic sequence generator | SF pushdown only |
| `CONDITIONAL_TRUE_EVENT` | Sessionize / event count | SF pushdown only |
| `BOOLAND_AGG / BOOLOR_AGG` | Boolean aggregate | SF pushdown only |
| `MINHASH / MINHASH_COMBINE` | MinHash LSH | SF pushdown only |

### 20.6 PySpark-Unique Functions (Spark SQL & DataFrame API)

| Function | Description | Notes |
|---|---|---|
| `explode(col)` | Array/map to rows | Spark only |
| `posexplode(col)` | Array to rows with index | Spark only |
| `explode_outer(col)` | Explode keeping nulls | Spark only |
| `collect_list(col)` | Aggregate to ordered list | Spark only |
| `collect_set(col)` | Aggregate to distinct set | Spark only |
| `from_json(col, schema)` | Parse JSON with schema | Spark only |
| `to_json(col)` | Struct/map to JSON string | Spark only |
| `schema_of_json(s)` | Infer schema from JSON string | Spark only |
| `from_csv(col, schema)` | Parse CSV string to struct | Spark only |
| `to_csv(col)` | Struct to CSV string | Spark only |
| `arrays_zip(a,b)` | Zip two arrays element-wise | Spark only |
| `map_from_arrays(k,v)` | Create map from key/value arrays | Spark only |
| `map_keys(col)` | Extract map keys | Spark only |
| `map_values(col)` | Extract map values | Spark only |
| `map_entries(col)` | Extract map as array of structs | Spark only |
| `transform(col, fn)` | Apply lambda to array elements | Spark only |
| `filter(col, fn)` | Filter array with lambda | Spark only |
| `aggregate(col,init,merge,finish)` | Reduce array with lambda | Spark only |
| `zip_with(a,b,fn)` | Combine arrays with lambda | Spark only |
| `flatten(col)` | Flatten nested array | Spark only |
| `sequence(start,end,step)` | Generate number sequence | Spark only |
| `array_sort(col)` | Sort array | Spark only |
| `array_distinct(col)` | Remove duplicates from array | Spark only |
| `array_except(a,b)` | Elements in a but not b | Spark only |
| `array_intersect(a,b)` | Common elements | Spark only |
| `array_union(a,b)` | Combined unique elements | Spark only |
| `array_remove(col,val)` | Remove all occurrences | Spark only |
| `forall(col,fn)` | Test if all elements satisfy | Spark only |
| `exists(col,fn)` | Test if any element satisfies | Spark only |
| `element_at(col,n)` | Get element at index (1-based) | Spark only |
| `skewness(col)` | Column skewness | Spark only |
| `kurtosis(col)` | Column kurtosis | Spark only |
| `bit_and(col)` | Bitwise AND aggregate | Spark only |
| `bit_or(col)` | Bitwise OR aggregate | Spark only |
| `bit_xor(col)` | Bitwise XOR aggregate | Spark only |
| `nth_value(col,n)` | Nth value in window | Spark only |
| `percentile_approx(col,p,acc)` | Approximate percentile | Spark only |
| `date_trunc(unit,col)` | Truncate timestamp | Spark native |
| `trunc(col,unit)` | Truncate date | Spark native |
| `from_utc_timestamp(col,tz)` | UTC to local timestamp | Spark only |
| `to_utc_timestamp(col,tz)` | Local to UTC timestamp | Spark only |
| `window(col,dur,slide,start)` | Time-window grouping | Spark Streaming |
| `monotonically_increasing_id()` | Unique row ID (non-sequential) | Spark only |
| `spark_partition_id()` | Current partition ID | Spark only |
| `input_file_name()` | Source file name for row | Spark only |
| `pandas_udf(fn, schema)` | Vectorized Python UDF | Spark only |
| `udf(fn, returnType)` | Row-level Python UDF | Spark only |

---

## 21. UI Enable/Disable Implementation Rules

### 21.1 Palette State Decision Tree

The UI palette must evaluate the following decision tree **for every function, every time** the execution context changes:

```
For each function F in the catalog:

  1. What is the current execution point of this segment?
     ├─ SOURCE_DB (specific technology T)
     │    ├─ Is F natively supported in T?  →  ✅ ENABLE — generate native code
     │    ├─ Does F have an alternative in T?  →  ⚠️ ENABLE with amber badge + alt suggestion
     │    └─ No support, no alternative  →  ❌ DISABLE — show "not available for [T]"
     │
     └─ PYSPARK
          ├─ Is F supported in PySpark?  →  ✅ ENABLE — generate PySpark code
          └─ F has no PySpark equivalent  →  ❌ DISABLE — mark as unavailable
```

### 21.2 Function State Display Rules

| Palette State | Visual | Tooltip / Click Behaviour |
|---|---|---|
| ✅ Available | Normal card, coloured icon | Click → opens parameter form |
| ⚠️ Alternative Available | Amber border, `⚠` badge | Click → "Not native for [T]. [Alt name] does the same thing. [Use Alt] [Learn More]" |
| ⚠️ Partial Support | Amber border, `⚠!` badge | Click → opens form with limitation note inline |
| ❌ Not Available — force PySpark | Red border, `⊘` badge, function name not strikethrough | Click → "[Function] is not available in [T]. Switch this segment to PySpark to use it. [Switch to PySpark] [Close]" |
| ❌ Not Available — no equivalent | Red border, `⊘` badge, function name strikethrough | Click → "[Function] is not available in [T] and has no equivalent. This cannot be pushed down. [Close]" |
| 🔵 PySpark Only | Blue border, Spark icon, "PySpark Only" label | Click → "This function only runs in PySpark. Add it to a PySpark segment. [Go to PySpark Segment]" |

### 21.3 Context Re-evaluation Triggers

The palette and all existing step rows must be re-evaluated when:

| Trigger | Re-evaluation Scope |
|---|---|
| Source table's DB technology changes | All steps in all segments that include this table |
| Segment execution point switched (Source DB ↔ PySpark) | All steps in that segment |
| Cross-source join added or removed | All downstream segments |
| Pipeline target engine changed globally | All segments |
| Column lineage changes (upstream PySpark derivation added) | Downstream segments |
| User reverts to a prior version | Full re-evaluation of all steps |

### 21.4 Step-Level Incompatibility Display

When an existing step becomes incompatible after a context change:

1. The step row shows a red `⊘` badge on the left.
2. A tooltip on hover: "This step ([function name]) is not supported in [technology] at pushdown. Resolve before saving."
3. The step remains in the sequence (not auto-deleted).
4. Saving and pipeline application are blocked.
5. The issue banner at top of editor lists all incompatible steps with [Fix →] links.

### 21.5 Resolution Options Table

| Scenario | Resolution Options |
|---|---|
| Function not in source DB, equivalent exists | [Replace with [Alt Name]] · [Switch segment to PySpark] · [Delete step] |
| Function not in source DB, no equivalent | [Switch segment to PySpark] · [Delete step] |
| Function is PySpark-only, in Source DB segment | [Move step to PySpark segment] · [Switch segment to PySpark] · [Delete step] |
| Function partially supported (limitation applies) | [Keep with limitation warning] · [Switch to PySpark for full support] · [Use Alternative] |
| Custom SQL step, engine changed | [Re-enter expression for new engine] · [Switch to PySpark] · [Delete step] |

### 21.6 Version-Specific Engine Notes

Engine versions affect function availability. The UI must respect:

| Technology | Version-Specific Behaviour |
|---|---|
| Oracle | `JSON_TABLE`, `JSON_ARRAYAGG`, `JSON_OBJECTAGG` require 12c+; `APPROX_*` require 12c+; recursive CTE requires 11g R2+; `MATCH_RECOGNIZE` requires 12c+ |
| MySQL | Window functions require 8.0+; full regex (`REGEXP_*`) require 8.0.13+ with group support |
| PostgreSQL | `STRING_AGG` requires 9.0+; `FILTER` clause requires 9.4+; `MAKE_DATE` requires 9.4+; `ENDS_WITH` requires 14+ |
| SQL Server | `IIF`, `CHOOSE`, `EOMONTH` require 2012+; `STRING_AGG` requires 2017+; `TRANSLATE`, `CONCAT_WS` require 2017+; `AT TIME ZONE` requires 2016+; `TRY_CAST` requires 2012+ |
| Redshift | Limited window frame support; no `GROUPS` frame; limited JSON support vs PostgreSQL |
| Snowflake | Most functions available in all versions; check Snowflake release notes for newest additions |

The platform stores the **database version per connection** and the UI must check this before enabling version-restricted functions.

---

## 22. Cross-Technology Equivalency Quick Reference

> Fast lookup for the most common operations and their exact syntax per engine.

### 22.1 "How do I do X?" Quick Reference

| Operation | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark |
|---|---|---|---|---|---|---|---|
| Get current date | `TRUNC(SYSDATE)` | `CURRENT_DATE` | `CURDATE()` | `CAST(GETDATE() AS DATE)` | `CURRENT_DATE` | `CURRENT_DATE()` | `current_date()` |
| Get current timestamp | `SYSDATE` | `NOW()` | `NOW()` | `GETDATE()` | `GETDATE()` | `CURRENT_TIMESTAMP()` | `current_timestamp()` |
| Format date to string | `TO_CHAR(d,'YYYY-MM-DD')` | `TO_CHAR(d,'YYYY-MM-DD')` | `DATE_FORMAT(d,'%Y-%m-%d')` | `FORMAT(d,'yyyy-MM-dd')` | `TO_CHAR(d,'YYYY-MM-DD')` | `TO_CHAR(d,'YYYY-MM-DD')` | `date_format(col,'yyyy-MM-dd')` |
| Parse date from string | `TO_DATE(s,'YYYY-MM-DD')` | `TO_DATE(s,'YYYY-MM-DD')` | `STR_TO_DATE(s,'%Y-%m-%d')` | `CONVERT(date,s,23)` | `TO_DATE(s,'YYYY-MM-DD')` | `TO_DATE(s,'YYYY-MM-DD')` | `to_date(col,'yyyy-MM-dd')` |
| Add 1 month to date | `ADD_MONTHS(d,1)` | `d + INTERVAL '1 month'` | `DATE_ADD(d, INTERVAL 1 MONTH)` | `DATEADD(month,1,d)` | `DATEADD(month,1,d)` | `DATEADD(month,1,d)` | `add_months(col,1)` |
| Days between dates | `d1 - d2` | `EXTRACT(EPOCH FROM d1-d2)/86400` | `DATEDIFF(d1,d2)` | `DATEDIFF(day,d1,d2)` | `DATEDIFF(day,d1,d2)` | `DATEDIFF(day,d1,d2)` | `datediff(col1,col2)` |
| Concatenate strings | `s1 \|\| s2` | `CONCAT(s1,s2)` | `CONCAT(s1,s2)` | `s1 + s2` | `s1 \|\| s2` | `CONCAT(s1,s2)` | `concat(col1,col2)` |
| Concatenate with separator | `s1\|\|sep\|\|s2` | `CONCAT_WS(sep,s1,s2)` | `CONCAT_WS(sep,s1,s2)` | `CONCAT_WS(sep,s1,s2)` | `s1\|\|sep\|\|s2` | `CONCAT_WS(sep,s1,s2)` | `concat_ws(sep,col1,col2)` |
| Null replacement | `NVL(col,0)` | `COALESCE(col,0)` | `IFNULL(col,0)` | `ISNULL(col,0)` | `NVL(col,0)` | `NVL(col,0)` | `coalesce(col,lit(0))` |
| If null then X | `CASE WHEN c IS NULL THEN x ELSE c END` | `COALESCE(c,x)` | `IFNULL(c,x)` | `ISNULL(c,x)` | `NVL(c,x)` | `NVL(c,x)` | `F.coalesce(col,F.lit(x))` |
| Regex extract group 1 | `REGEXP_SUBSTR(s,p,1,1,NULL,1)` | `(REGEXP_MATCHES(s,p))[1]` | `REGEXP_SUBSTR(s,p,1,0,'',1)` (8.0.13+) | ❌ (no native) | `REGEXP_SUBSTR(s,p,1,1,'e',1)` | `REGEXP_SUBSTR(s,p,1,1,'e',1)` | `regexp_extract(col,p,1)` |
| String aggregation | `LISTAGG(c,',') WITHIN GROUP (ORDER BY x)` | `STRING_AGG(c,',' ORDER BY x)` | `GROUP_CONCAT(c ORDER BY x SEPARATOR ',')` | `STRING_AGG(c,',' ORDER BY x)` | `LISTAGG(c,',') WITHIN GROUP (ORDER BY x)` | `LISTAGG(c,',') WITHIN GROUP (ORDER BY x)` | `collect_list(c)` + `concat_ws` |
| Row number per group | `ROW_NUMBER() OVER (PARTITION BY g ORDER BY x)` | same | same | same | same | same | `row_number().over(Window.partitionBy(g).orderBy(x))` |
| Running total | `SUM(c) OVER (PARTITION BY g ORDER BY x ROWS UNBOUNDED PRECEDING)` | same | same | same | same | same | `sum(c).over(Window.partitionBy(g).orderBy(x).rowsBetween(-sys.maxsize,0))` |
| Previous row value | `LAG(c,1) OVER (PARTITION BY g ORDER BY x)` | same | same | same | same | same | `lag(c,1).over(Window.partitionBy(g).orderBy(x))` |
| Cast to integer | `CAST(c AS NUMBER(10))` | `CAST(c AS INTEGER)` | `CAST(c AS SIGNED)` | `CAST(c AS INT)` | `CAST(c AS INT)` | `CAST(c AS INT)` | `col.cast('int')` |
| Round to 2 decimals | `ROUND(c,2)` | `ROUND(c,2)` | `ROUND(c,2)` | `ROUND(c,2)` | `ROUND(c,2)` | `ROUND(c,2)` | `round(col,2)` |
| Hierarchical query | `CONNECT BY PRIOR` | `WITH RECURSIVE cte AS (…)` | `WITH RECURSIVE cte AS (…)` | `WITH cte AS (… UNION ALL …)` | ❌ | `WITH RECURSIVE cte AS (…)` | GraphFrames |

---

*End of Document*

---
> **Document Control:** This matrix must be reviewed and updated whenever a new source technology version is added to the platform, or when platform function support is extended. Each update requires a version note, author, and date. This document is the authoritative reference for UI enable/disable decisions and code generation function mappings.
>
> **Companion Documents:**
> - Multi-Transform Component Requirements v1.0
> - Pushdown Eligibility & Execution Point Selection Requirements v1.0
