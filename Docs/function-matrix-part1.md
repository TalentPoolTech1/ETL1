# Comprehensive Function Capability Matrix
## Cross-Technology Function Support Reference & UI Enable/Disable Specification

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-03-01  
**Audience:** Product, Engineering, QA, UX  
**Companion To:** Multi-Transform Component Requirements v1.0 · Pushdown Eligibility Requirements v1.0

---

## Table of Contents

1. [Purpose, Scope and How to Read This Document](#1-purpose-scope-and-how-to-read-this-document)
2. [Technologies Covered](#2-technologies-covered)
3. [Master Function Category Index](#3-master-function-category-index)
4. [Numeric & Mathematical Functions](#4-numeric--mathematical-functions)
5. [String & Text Functions](#5-string--text-functions)
6. [Date & Time Functions](#6-date--time-functions)
7. [Data Type Conversion Functions](#7-data-type-conversion-functions)
8. [Conditional Logic Functions](#8-conditional-logic-functions)
9. [NULL Handling Functions](#9-null-handling-functions)
10. [Aggregate Functions](#10-aggregate-functions)
11. [Window & Analytical Functions](#11-window--analytical-functions)
12. [Ranking Functions](#12-ranking-functions)
13. [Concatenation Functions](#13-concatenation-functions)
14. [Regular Expression Functions](#14-regular-expression-functions)
15. [Hierarchical & Recursive Functions](#15-hierarchical--recursive-functions)
16. [Array & Collection Functions](#16-array--collection-functions)
17. [JSON Functions](#17-json-functions)
18. [Encoding & Hashing Functions](#18-encoding--hashing-functions)
19. [Statistical Functions](#19-statistical-functions)
20. [Technology-Specific Unique Functions](#20-technology-specific-unique-functions)
21. [UI Enable/Disable Implementation Rules](#21-ui-enabledisable-implementation-rules)
22. [Cross-Technology Equivalency Quick Reference](#22-cross-technology-equivalency-quick-reference)

---

## 1. Purpose, Scope and How to Read This Document

### 1.1 Purpose

This document provides the **complete, exhaustive function capability matrix** for every function category relevant to data transformation pipelines, mapped across all supported source technologies and execution engines. It is the authoritative reference for:

- Which functions are natively available per technology.
- What the exact syntax / function name is per technology.
- What equivalent or substitute function exists when native support is absent.
- When no equivalent exists and the function must be executed in PySpark.
- How the UI must enable, disable, substitute, or warn per function per technology context.

### 1.2 How to Read the Matrix Tables

Each function row contains:

| Column | Meaning |
|---|---|
| **Function (User Label)** | Plain-English name shown in the UI palette |
| **Standard SQL / Logical Name** | Canonical SQL standard name or concept |
| **Oracle** | Support level + exact Oracle syntax |
| **PostgreSQL** | Support level + exact PostgreSQL syntax |
| **MySQL** | Support level + exact MySQL syntax |
| **SQL Server** | Support level + exact SQL Server syntax |
| **Redshift** | Support level + exact Redshift syntax |
| **Snowflake** | Support level + exact Snowflake syntax |
| **PySpark** | Support level + exact PySpark / Spark SQL syntax |
| **UI Behaviour** | What the UI must do when source is a given technology |

### 1.3 Support Level Legend

| Symbol | Meaning | UI Behaviour |
|---|---|---|
| ✅ | **Native** — fully supported, direct syntax available | Enable in palette — generates native code |
| ⚠️ ALT | **Alternative exists** — not exact match but equivalent achievable | Enable with amber badge — show alternative on click |
| ⚠️ PARTIAL | **Partial support** — supported but with limitations (noted) | Enable with amber badge — show limitation note |
| ❌ NONE | **Not supported** — no equivalent possible at pushdown level | Disable for pushdown — force PySpark or block |
| 🔵 SPARK | **PySpark / Spark SQL only** — not available in any SQL pushdown | Only available when execution point = PySpark |
| ✳️ UDF | **Requires user-defined function** — not built-in | Show with UDF badge — warn user |

---

## 2. Technologies Covered

| ID | Technology | Dialect | Notes |
|---|---|---|---|
| ORA | Oracle | Oracle SQL (19c baseline) | PL/SQL extended functions noted separately |
| PG | PostgreSQL | PostgreSQL SQL (14+ baseline) | |
| MY | MySQL | MySQL SQL (8.0 baseline) | |
| SS | SQL Server | T-SQL (SQL Server 2019 baseline) | |
| RS | Redshift | Redshift SQL (PostgreSQL 8.x derived) | Some PG functions absent |
| SF | Snowflake | Snowflake SQL | |
| PS | PySpark | PySpark 3.x / Spark SQL 3.x | Includes DataFrame API + Spark SQL |

---

## 3. Master Function Category Index

| # | Category | Count of Functions | Priority |
|---|---|---|---|
| 4 | Numeric & Mathematical | 42 | High |
| 5 | String & Text | 48 | High |
| 6 | Date & Time | 52 | Critical |
| 7 | Data Type Conversion | 18 | Critical |
| 8 | Conditional Logic | 10 | High |
| 9 | NULL Handling | 8 | High |
| 10 | Aggregate | 24 | High |
| 11 | Window & Analytical | 22 | High |
| 12 | Ranking | 8 | High |
| 13 | Concatenation | 8 | Medium |
| 14 | Regular Expression | 10 | Medium |
| 15 | Hierarchical & Recursive | 8 | Medium |
| 16 | Array & Collection | 22 | Medium (PySpark) |
| 17 | JSON | 16 | Medium |
| 18 | Encoding & Hashing | 12 | Medium |
| 19 | Statistical | 14 | Low–Medium |
| 20 | Technology-Specific Unique | varies | Reference |
| **Total** | | **~322** | |

---

## 4. Numeric & Mathematical Functions

### 4.1 Basic Arithmetic & Rounding

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Round to decimal places | `ROUND(n, d)` | ✅ `ROUND` | ✅ `ROUND` | ✅ `ROUND` | ✅ `ROUND` | ✅ `ROUND` | ✅ `ROUND` | ✅ `round()` | Enable all |
| Round down (Floor) | `FLOOR(n)` | ✅ `FLOOR` | ✅ `FLOOR` | ✅ `FLOOR` | ✅ `FLOOR` | ✅ `FLOOR` | ✅ `FLOOR` | ✅ `floor()` | Enable all |
| Round up (Ceiling) | `CEIL(n)` | ✅ `CEIL` | ✅ `CEIL` | ✅ `CEILING` | ✅ `CEILING` | ✅ `CEIL` | ✅ `CEIL` | ✅ `ceil()` | Enable all; note SS/MY use CEILING |
| Truncate decimal | `TRUNC(n, d)` | ✅ `TRUNC` | ✅ `TRUNC` | ✅ `TRUNCATE` | ⚠️ ALT `ROUND(n,d,1)` | ✅ `TRUNC` | ✅ `TRUNC` | ✅ `bround()` / `floor` | SS: amber badge — uses ROUND with truncate flag |
| Absolute value | `ABS(n)` | ✅ `ABS` | ✅ `ABS` | ✅ `ABS` | ✅ `ABS` | ✅ `ABS` | ✅ `ABS` | ✅ `abs()` | Enable all |
| Modulo (remainder) | `MOD(n, d)` | ✅ `MOD` | ✅ `MOD` | ✅ `MOD` | ⚠️ ALT `n % d` | ✅ `MOD` | ✅ `MOD` | ✅ `col % d` | SS: amber badge — use % operator |
| Integer division | `DIV(n, d)` | ⚠️ ALT `TRUNC(n/d)` | ✅ `n / d` (integer) | ✅ `DIV` | ✅ `n / d` (integer) | ✅ `n / d` | ✅ `DIV0` | ✅ `(col / d).cast(int)` | Oracle: amber |
| Power / Exponent | `POWER(n, e)` | ✅ `POWER` | ✅ `POWER` | ✅ `POWER` | ✅ `POWER` | ✅ `POWER` | ✅ `POWER` | ✅ `pow()` | Enable all |
| Square root | `SQRT(n)` | ✅ `SQRT` | ✅ `SQRT` | ✅ `SQRT` | ✅ `SQRT` | ✅ `SQRT` | ✅ `SQRT` | ✅ `sqrt()` | Enable all |
| Cube root | `CBRT(n)` | ⚠️ ALT `POWER(n,1/3)` | ✅ `CBRT` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `cbrt()` | PG: enable. Oracle: amber. MY/SS/RS: disable pushdown, force PySpark |
| Natural logarithm | `LN(n)` | ✅ `LN` | ✅ `LN` | ✅ `LN` | ✅ `LOG(n)` | ✅ `LN` | ✅ `LN` | ✅ `log(col)` | SS: amber — uses LOG |
| Log base 10 | `LOG10(n)` | ✅ `LOG(10,n)` | ✅ `LOG(n)` | ✅ `LOG10` | ✅ `LOG10` | ✅ `LOG(10,n)` | ✅ `LOG(10,n)` | ✅ `log10(col)` | Note syntax variation |
| Log arbitrary base | `LOG(base, n)` | ✅ `LOG(b,n)` | ✅ `LOG(b,n)` | ✅ `LOG(b,n)` | ✅ `LOG(b,n)` | ✅ `LOG(b,n)` | ✅ `LOG(b,n)` | ✅ `F.log(b, col)` | Enable all |
| Exponential (e^n) | `EXP(n)` | ✅ `EXP` | ✅ `EXP` | ✅ `EXP` | ✅ `EXP` | ✅ `EXP` | ✅ `EXP` | ✅ `exp()` | Enable all |

### 4.2 Sign & Comparison

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Sign of number | `SIGN(n)` | ✅ `SIGN` | ✅ `SIGN` | ✅ `SIGN` | ✅ `SIGN` | ✅ `SIGN` | ✅ `SIGN` | ✅ `signum()` | Enable all |
| Minimum of two values | `LEAST(a, b)` | ✅ `LEAST` | ✅ `LEAST` | ✅ `LEAST` | ⚠️ ALT `CASE WHEN` | ✅ `LEAST` | ✅ `LEAST` | ✅ `least()` | SS: amber — CASE WHEN alternative |
| Maximum of two values | `GREATEST(a, b)` | ✅ `GREATEST` | ✅ `GREATEST` | ✅ `GREATEST` | ⚠️ ALT `CASE WHEN` | ✅ `GREATEST` | ✅ `GREATEST` | ✅ `greatest()` | SS: amber — CASE WHEN alternative |
| Clamp value in range | `CLAMP(n, lo, hi)` | ⚠️ ALT `LEAST(GREATEST(n,lo),hi)` | ⚠️ ALT `LEAST(GREATEST(n,lo),hi)` | ⚠️ ALT | ⚠️ ALT | ⚠️ ALT | ⚠️ ALT | ✅ `F.greatest(F.least(col,hi),lo)` | All: amber — composed expression |
| Random number 0–1 | `RANDOM()` | ✅ `DBMS_RANDOM.VALUE` | ✅ `RANDOM()` | ✅ `RAND()` | ✅ `RAND()` | ✅ `RANDOM()` | ✅ `RANDOM()` | ✅ `rand()` | Note: non-deterministic — warn user |
| Random integer in range | `RANDINT(lo, hi)` | ⚠️ ALT compose | ⚠️ ALT `FLOOR(RANDOM()*(hi-lo)+lo)` | ⚠️ ALT `FLOOR(RAND()*(hi-lo)+lo)` | ⚠️ ALT | ⚠️ ALT | ✅ `UNIFORM(lo,hi,RANDOM())` | ✅ `F.rand()` composition | All except SF: amber |

### 4.3 Trigonometric Functions

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Sine | `SIN(n)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `sin()` | Enable all |
| Cosine | `COS(n)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `cos()` | Enable all |
| Tangent | `TAN(n)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `tan()` | Enable all |
| Arc sine | `ASIN(n)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `asin()` | Enable all |
| Arc cosine | `ACOS(n)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `acos()` | Enable all |
| Arc tangent | `ATAN(n)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `atan()` | Enable all |
| Arc tangent 2-arg | `ATAN2(y, x)` | ✅ `ATAN2` | ✅ `ATAN2` | ✅ `ATAN2` | ✅ `ATN2` | ✅ `ATAN2` | ✅ `ATAN2` | ✅ `atan2()` | SS: note ATN2 name |
| PI constant | `PI()` | ✅ `ACOS(-1)` | ✅ `PI()` | ✅ `PI()` | ✅ `PI()` | ✅ `ACOS(-1)` | ✅ `PI()` | ✅ `F.lit(math.pi)` | ORA/RS: amber |
| Degrees to radians | `RADIANS(n)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `radians()` | Enable all |
| Radians to degrees | `DEGREES(n)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `degrees()` | Enable all |
| Hyperbolic sine | `SINH(n)` | ✅ | ✅ | ✅ | ✅ | ❌ NONE | ✅ | ✅ `sinh()` | RS: disable pushdown |
| Hyperbolic cosine | `COSH(n)` | ✅ | ✅ | ✅ | ✅ | ❌ NONE | ✅ | ✅ `cosh()` | RS: disable pushdown |
| Hyperbolic tangent | `TANH(n)` | ✅ | ✅ | ✅ | ✅ | ❌ NONE | ✅ | ✅ `tanh()` | RS: disable pushdown |

### 4.4 Formatting & Display

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Format number with commas | `FORMAT(n, d)` | ⚠️ ALT `TO_CHAR` | ⚠️ ALT `TO_CHAR` | ✅ `FORMAT(n,d)` | ✅ `FORMAT(n,d)` | ⚠️ ALT `TO_CHAR` | ✅ `TO_CHAR` | ✅ `format_number()` | ORA/PG/RS: amber |
| Number to formatted string | `TO_CHAR(n, fmt)` | ✅ `TO_CHAR` | ✅ `TO_CHAR` | ⚠️ ALT `FORMAT` | ⚠️ ALT `FORMAT`/`CONVERT` | ✅ `TO_CHAR` | ✅ `TO_CHAR` | ✅ `format_number()` | MY/SS: amber |
| Integer to binary string | `BIN(n)` | ❌ NONE | ⚠️ ALT `n::bit(32)::text` | ✅ `BIN` | ⚠️ ALT `CONVERT(varbinary,n)` | ❌ NONE | ❌ NONE | ✅ `bin()` | Most: disable pushdown or amber |
| Integer to hex string | `HEX(n)` | ✅ `TO_HEX` (12c+) | ✅ `TO_HEX` | ✅ `HEX` | ✅ `CONVERT(varbinary,n)` | ⚠️ ALT | ✅ `TO_HEX` | ✅ `hex()` | SS/RS: amber |
| Hex to integer | `UNHEX / HEX_TO_INT` | ⚠️ ALT | ✅ `('x'||hex)::bit(32)::int` | ✅ `CONV(hex,16,10)` | ✅ `CONVERT(int,…)` | ❌ NONE | ✅ `STRTOL` | ✅ `conv(col,16,10)` | RS: force PySpark |

---

## 5. String & Text Functions

### 5.1 Case Transformation

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Convert to uppercase | `UPPER(s)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `upper()` | Enable all |
| Convert to lowercase | `LOWER(s)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `lower()` | Enable all |
| Capitalise first letter | `INITCAP(s)` | ✅ `INITCAP` | ✅ `INITCAP` | ❌ NONE | ❌ NONE | ✅ `INITCAP` | ✅ `INITCAP` | ✅ `initcap()` | MY/SS: disable pushdown |
| Capitalise each word | `PROPER / INITCAP` | ✅ `INITCAP` | ✅ `INITCAP` | ❌ NONE | ❌ NONE | ✅ `INITCAP` | ✅ `INITCAP` | ✅ `initcap()` | MY/SS: disable pushdown |

### 5.2 Trimming & Padding

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Remove leading & trailing spaces | `TRIM(s)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `trim()` | Enable all |
| Remove leading spaces | `LTRIM(s)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `ltrim()` | Enable all |
| Remove trailing spaces | `RTRIM(s)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `rtrim()` | Enable all |
| Trim specific character | `TRIM(char FROM s)` | ✅ | ✅ | ✅ | ⚠️ ALT `REPLACE` | ✅ | ✅ | ✅ `regexp_replace(col,'^x+\|x+$','')` | SS: amber |
| Pad left to length | `LPAD(s, n, c)` | ✅ | ✅ | ✅ | ⚠️ ALT `RIGHT(REPLICATE+s,n)` | ✅ | ✅ | ✅ `lpad()` | SS: amber |
| Pad right to length | `RPAD(s, n, c)` | ✅ | ✅ | ✅ | ⚠️ ALT `LEFT(s+REPLICATE,n)` | ✅ | ✅ | ✅ `rpad()` | SS: amber |

### 5.3 Substring & Position

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Extract substring | `SUBSTRING(s, pos, len)` | ✅ `SUBSTR` | ✅ `SUBSTRING` | ✅ `SUBSTRING` | ✅ `SUBSTRING` | ✅ `SUBSTRING` | ✅ `SUBSTRING` | ✅ `substring()` | Oracle uses SUBSTR |
| Extract from position to end | `SUBSTR(s, pos)` | ✅ `SUBSTR` | ✅ `SUBSTRING` | ✅ `SUBSTRING` | ✅ `SUBSTRING` | ✅ `SUBSTRING` | ✅ `SUBSTR` | ✅ `substring(col,pos)` | Enable all |
| Find position of substring | `INSTR / POSITION` | ✅ `INSTR` | ✅ `POSITION` | ✅ `INSTR` / `LOCATE` | ✅ `CHARINDEX` | ✅ `POSITION` | ✅ `POSITION` | ✅ `instr()` / `locate()` | Syntax varies by engine |
| Find Nth occurrence | `INSTR(s, sub, start, n)` | ✅ `INSTR` (4-arg) | ⚠️ ALT regex | ⚠️ ALT `LOCATE(sub,s,start)` | ❌ NONE | ❌ NONE | ✅ `CHARINDEX` (2-arg only) | ✅ custom UDF | MY/ORA: limited; SS/RS: disable |
| String length in chars | `LENGTH(s)` | ✅ `LENGTH` | ✅ `LENGTH` | ✅ `LENGTH` | ✅ `LEN` | ✅ `LENGTH` | ✅ `LENGTH` | ✅ `length()` | SS uses LEN |
| String length in bytes | `LENGTHB(s)` | ✅ `LENGTHB` | ✅ `OCTET_LENGTH` | ✅ `LENGTH` (byte mode) | ✅ `DATALENGTH` | ✅ `OCTET_LENGTH` | ✅ `OCTET_LENGTH` | ✅ `octet_length()` | Name varies |
| Reverse a string | `REVERSE(s)` | ✅ `REVERSE` | ✅ `REVERSE` | ✅ `REVERSE` | ✅ `REVERSE` | ✅ `REVERSE` | ✅ `REVERSE` | ✅ `reverse()` | Enable all |
| Get character at position | `CHAR_AT(s, n)` | ✅ `SUBSTR(s,n,1)` | ✅ `SUBSTR(s,n,1)` | ✅ `SUBSTR(s,n,1)` | ✅ `SUBSTRING(s,n,1)` | ✅ `SUBSTR(s,n,1)` | ✅ `SUBSTR(s,n,1)` | ✅ `substring(col,n,1)` | All: compose |
| Repeat string N times | `REPEAT(s, n)` | ⚠️ ALT `RPAD` trick | ✅ `REPEAT` | ✅ `REPEAT` | ✅ `REPLICATE` | ✅ `REPEAT` | ✅ `REPEAT` | ✅ `repeat()` | Oracle: amber; SS: REPLICATE |
| Replace substring | `REPLACE(s, from, to)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `regexp_replace()` / `translate()` | Enable all |
| Translate characters | `TRANSLATE(s, from, to)` | ✅ | ✅ | ❌ NONE | ❌ NONE | ✅ | ✅ | ✅ `translate()` | MY/SS: disable pushdown |
| ASCII code of first char | `ASCII(s)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `ascii()` | Enable all |
| Character from ASCII code | `CHR(n)` | ✅ `CHR` | ✅ `CHR` | ✅ `CHAR` | ✅ `CHAR` | ✅ `CHR` | ✅ `CHR` | ✅ `chr()` | MY/SS use CHAR |
| Unicode code point | `UNICODE(s)` | ✅ `ASCII` (Unicode-aware) | ✅ `ASCII` | ✅ `ORD` | ✅ `UNICODE` | ✅ `ASCII` | ✅ `ASCII` | ✅ `ascii()` | SS: UNICODE; MY: ORD |

### 5.4 Splitting & Parsing

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Split string and get part | `SPLIT_PART(s, delim, n)` | ⚠️ ALT regexp | ✅ `SPLIT_PART` | ❌ NONE | ❌ NONE | ✅ `SPLIT_PART` | ✅ `SPLIT_PART` | ✅ `split(col,delim)[n]` | MY/SS: disable pushdown |
| Split to array | `STRING_TO_ARRAY(s, d)` | ❌ NONE | ✅ `string_to_array` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `STRTOK_TO_ARRAY` | ✅ `split()` | Most: disable pushdown |
| Left N characters | `LEFT(s, n)` | ✅ `SUBSTR(s,1,n)` | ✅ `LEFT` | ✅ `LEFT` | ✅ `LEFT` | ✅ `LEFT` | ✅ `LEFT` | ✅ `left()` | Oracle: SUBSTR |
| Right N characters | `RIGHT(s, n)` | ✅ `SUBSTR(s,-n)` | ✅ `RIGHT` | ✅ `RIGHT` | ✅ `RIGHT` | ✅ `RIGHT` | ✅ `RIGHT` | ✅ `right()` | Oracle: SUBSTR(-n) |
| Check if string contains | `CONTAINS(s, sub)` | ✅ `INSTR > 0` | ✅ `POSITION > 0` | ✅ `LOCATE > 0` | ✅ `CHARINDEX > 0` | ✅ `POSITION > 0` | ✅ `CONTAINS` | ✅ `contains()` | All: composed via INSTR/POSITION/CHARINDEX > 0 except SF |
| Check if starts with | `STARTS_WITH(s, prefix)` | ✅ `LIKE 'prefix%'` | ✅ `STARTS_WITH` | ✅ `LIKE` | ✅ `LIKE` | ✅ `STARTS_WITH` | ✅ `STARTSWITH` | ✅ `startswith()` | ORA/MY/SS: LIKE expression |
| Check if ends with | `ENDS_WITH(s, suffix)` | ✅ `LIKE '%suffix'` | ✅ `ENDS_WITH` (14+) | ✅ `LIKE` | ✅ `LIKE` | ✅ `ENDS_WITH` | ✅ `ENDSWITH` | ✅ `endswith()` | ORA/MY/SS: LIKE expression |

### 5.5 Soundex & Phonetic

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Soundex code | `SOUNDEX(s)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `soundex()` | Enable all |
| String difference (Soundex) | `DIFFERENCE(s1,s2)` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ | ❌ NONE | ❌ NONE | ✅ UDF | SS only natively |
| Edit distance (Levenshtein) | `LEVENSHTEIN(s1,s2)` | ❌ NONE | ✅ `levenshtein` | ❌ NONE | ❌ NONE | ❌ NONE | ✅ `EDITDISTANCE` | 🔵 SPARK custom UDF | Most: PySpark only |

---

## 6. Date & Time Functions

> **Priority: Critical** — Date/Time functions are the most technology-divergent category. Syntax variations are significant and must be handled precisely per engine.

### 6.1 Getting Current Date & Time

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Current date | `CURRENT_DATE` | ✅ `SYSDATE` / `CURRENT_DATE` | ✅ `CURRENT_DATE` | ✅ `CURDATE()` | ✅ `CAST(GETDATE() AS DATE)` | ✅ `CURRENT_DATE` | ✅ `CURRENT_DATE()` | ✅ `current_date()` | Syntax differs; warn user |
| Current timestamp | `CURRENT_TIMESTAMP` | ✅ `SYSDATE` / `CURRENT_TIMESTAMP` | ✅ `NOW()` / `CURRENT_TIMESTAMP` | ✅ `NOW()` | ✅ `GETDATE()` | ✅ `CURRENT_TIMESTAMP` | ✅ `CURRENT_TIMESTAMP()` | ✅ `current_timestamp()` | Non-deterministic; warn |
| Current timestamp (no TZ) | `LOCALTIMESTAMP` | ✅ `LOCALTIMESTAMP` | ✅ `LOCALTIMESTAMP` | ✅ `NOW()` | ✅ `GETDATE()` | ✅ `LOCALTIMESTAMP` | ✅ `LOCALTIMESTAMP()` | ✅ `current_timestamp()` | Note: MY/SS don't distinguish |
| Current time | `CURRENT_TIME` | ✅ `TO_CHAR(SYSDATE,'HH24:MI:SS')` | ✅ `CURRENT_TIME` | ✅ `CURTIME()` | ✅ `CONVERT(time,GETDATE())` | ✅ `CURRENT_TIME` | ✅ `TIME_FROM_PARTS(...)` | ✅ `current_timestamp()` | ORA: amber |
| Current UTC timestamp | `UTC_TIMESTAMP` | ✅ `SYS_EXTRACT_UTC(SYSTIMESTAMP)` | ✅ `NOW() AT TIME ZONE 'UTC'` | ✅ `UTC_TIMESTAMP()` | ✅ `GETUTCDATE()` | ✅ `GETDATE() AT TIME ZONE 'UTC'` | ✅ `CONVERT_TIMEZONE('UTC',CURRENT_TIMESTAMP)` | ✅ `unix_timestamp()` | All: compose |

### 6.2 Date Part Extraction

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Extract year | `YEAR(d)` | ✅ `EXTRACT(YEAR FROM d)` | ✅ `EXTRACT(YEAR FROM d)` | ✅ `YEAR(d)` | ✅ `YEAR(d)` | ✅ `EXTRACT(YEAR FROM d)` | ✅ `YEAR(d)` | ✅ `year()` | Enable all; ORA/PG use EXTRACT |
| Extract month (number) | `MONTH(d)` | ✅ `EXTRACT(MONTH FROM d)` | ✅ `EXTRACT(MONTH FROM d)` | ✅ `MONTH(d)` | ✅ `MONTH(d)` | ✅ `EXTRACT(MONTH FROM d)` | ✅ `MONTH(d)` | ✅ `month()` | Enable all |
| Extract day of month | `DAY(d)` | ✅ `EXTRACT(DAY FROM d)` | ✅ `EXTRACT(DAY FROM d)` | ✅ `DAY(d)` | ✅ `DAY(d)` | ✅ `EXTRACT(DAY FROM d)` | ✅ `DAY(d)` | ✅ `dayofmonth()` | Enable all |
| Extract hour | `HOUR(d)` | ✅ `EXTRACT(HOUR FROM d)` | ✅ `EXTRACT(HOUR FROM d)` | ✅ `HOUR(d)` | ✅ `DATEPART(hour,d)` | ✅ `EXTRACT(HOUR FROM d)` | ✅ `HOUR(d)` | ✅ `hour()` | Enable all |
| Extract minute | `MINUTE(d)` | ✅ `EXTRACT(MINUTE FROM d)` | ✅ `EXTRACT(MINUTE FROM d)` | ✅ `MINUTE(d)` | ✅ `DATEPART(minute,d)` | ✅ `EXTRACT(MINUTE FROM d)` | ✅ `MINUTE(d)` | ✅ `minute()` | Enable all |
| Extract second | `SECOND(d)` | ✅ `EXTRACT(SECOND FROM d)` | ✅ `EXTRACT(SECOND FROM d)` | ✅ `SECOND(d)` | ✅ `DATEPART(second,d)` | ✅ `EXTRACT(SECOND FROM d)` | ✅ `SECOND(d)` | ✅ `second()` | Enable all |
| Extract millisecond | `MILLISECOND(d)` | ✅ `EXTRACT(MILLISECOND FROM d)` | ✅ `EXTRACT(MILLISECONDS FROM d)` | ✅ `MICROSECOND(d)/1000` | ✅ `DATEPART(millisecond,d)` | ✅ `EXTRACT(MILLISECONDS FROM d)` | ✅ `EXTRACT(MILLISECOND FROM d)` | ✅ custom expr | All: note syntax differences |
| Day of week (number) | `DAYOFWEEK(d)` | ✅ `TO_CHAR(d,'D')` | ✅ `EXTRACT(DOW FROM d)` | ✅ `DAYOFWEEK(d)` | ✅ `DATEPART(weekday,d)` | ✅ `EXTRACT(DOW FROM d)` | ✅ `DAYOFWEEK(d)` | ✅ `dayofweek()` | Note: Sunday=1 in some, 0 in others |
| Day of week (name) | `DAYNAME(d)` | ✅ `TO_CHAR(d,'DAY')` | ✅ `TO_CHAR(d,'Day')` | ✅ `DAYNAME(d)` | ✅ `DATENAME(weekday,d)` | ✅ `TO_CHAR(d,'Day')` | ✅ `DAYNAME(d)` | ✅ `date_format(col,'EEEE')` | All: compose |
| Day of year | `DAYOFYEAR(d)` | ✅ `TO_CHAR(d,'DDD')` | ✅ `EXTRACT(DOY FROM d)` | ✅ `DAYOFYEAR(d)` | ✅ `DATEPART(dayofyear,d)` | ✅ `EXTRACT(DOY FROM d)` | ✅ `DAYOFYEAR(d)` | ✅ `dayofyear()` | Enable all |
| Week of year | `WEEKOFYEAR(d)` | ✅ `TO_CHAR(d,'IW')` | ✅ `EXTRACT(WEEK FROM d)` | ✅ `WEEKOFYEAR(d)` | ✅ `DATEPART(week,d)` | ✅ `EXTRACT(WEEK FROM d)` | ✅ `WEEKOFYEAR(d)` | ✅ `weekofyear()` | Enable all |
| Quarter number | `QUARTER(d)` | ✅ `TO_CHAR(d,'Q')` | ✅ `EXTRACT(QUARTER FROM d)` | ✅ `QUARTER(d)` | ✅ `DATEPART(quarter,d)` | ✅ `EXTRACT(QUARTER FROM d)` | ✅ `QUARTER(d)` | ✅ `quarter()` | Enable all |
| ISO week year | `YEAROFWEEK(d)` | ✅ `TO_CHAR(d,'IYYY')` | ✅ `EXTRACT(ISOYEAR FROM d)` | ⚠️ ALT complex | ⚠️ ALT complex | ⚠️ ALT | ✅ `YEAROFWEEKISO(d)` | ✅ `date_format(col,'YYYY')` | MY/SS/RS: amber |
| Month name | `MONTHNAME(d)` | ✅ `TO_CHAR(d,'MONTH')` | ✅ `TO_CHAR(d,'Month')` | ✅ `MONTHNAME(d)` | ✅ `DATENAME(month,d)` | ✅ `TO_CHAR(d,'Month')` | ✅ `MONTHNAME(d)` | ✅ `date_format(col,'MMMM')` | All: compose |
| Last day of month | `LAST_DAY(d)` | ✅ `LAST_DAY` | ✅ `DATE_TRUNC('month',d)+INTERVAL '1 month'-1` | ✅ `LAST_DAY` | ✅ `EOMONTH` | ✅ `LAST_DAY` | ✅ `LAST_DAY` | ✅ `last_day()` | PG/SS: compose |
| First day of month | `FIRST_DAY(d)` | ✅ `TRUNC(d,'MM')` | ✅ `DATE_TRUNC('month',d)` | ✅ `DATE_FORMAT(d,'%Y-%m-01')` | ✅ `DATEADD(day,1-DAY(d),d)` | ✅ `DATE_TRUNC('month',d)` | ✅ `DATE_TRUNC('month',d)` | ✅ `trunc(col,'MM')` | All: compose |

### 6.3 Date Arithmetic

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Add days to date | `DATE_ADD(d, n_days)` | ✅ `d + n` | ✅ `d + INTERVAL 'n day'` | ✅ `DATE_ADD(d, INTERVAL n DAY)` | ✅ `DATEADD(day,n,d)` | ✅ `DATEADD(day,n,d)` | ✅ `DATEADD(day,n,d)` | ✅ `date_add(col,n)` | Enable all; syntax varies |
| Subtract days from date | `DATE_SUB(d, n_days)` | ✅ `d - n` | ✅ `d - INTERVAL 'n day'` | ✅ `DATE_SUB(d, INTERVAL n DAY)` | ✅ `DATEADD(day,-n,d)` | ✅ `DATEADD(day,-n,d)` | ✅ `DATEADD(day,-n,d)` | ✅ `date_sub(col,n)` | Enable all; syntax varies |
| Add months | `ADD_MONTHS(d, n)` | ✅ `ADD_MONTHS` | ✅ `d + INTERVAL 'n month'` | ✅ `DATE_ADD(d, INTERVAL n MONTH)` | ✅ `DATEADD(month,n,d)` | ✅ `DATEADD(month,n,d)` | ✅ `DATEADD(month,n,d)` | ✅ `add_months(col,n)` | Enable all |
| Add years | `ADD_YEARS(d, n)` | ✅ `ADD_MONTHS(d,n*12)` | ✅ `d + INTERVAL 'n year'` | ✅ `DATE_ADD(d, INTERVAL n YEAR)` | ✅ `DATEADD(year,n,d)` | ✅ `DATEADD(year,n,d)` | ✅ `DATEADD(year,n,d)` | ✅ `add_months(col,n*12)` | Enable all |
| Add hours | `ADD_HOURS(d, n)` | ✅ `d + n/24` | ✅ `d + INTERVAL 'n hour'` | ✅ `DATE_ADD(d, INTERVAL n HOUR)` | ✅ `DATEADD(hour,n,d)` | ✅ `DATEADD(hour,n,d)` | ✅ `DATEADD(hour,n,d)` | ✅ `col + expr.hours(n)` | Enable all |
| Difference in days | `DATEDIFF(d1, d2)` | ✅ `d1 - d2` | ✅ `EXTRACT(EPOCH FROM d1-d2)/86400` | ✅ `DATEDIFF(d1,d2)` | ✅ `DATEDIFF(day,d1,d2)` | ✅ `DATEDIFF(day,d1,d2)` | ✅ `DATEDIFF(day,d1,d2)` | ✅ `datediff(col1,col2)` | ORA/PG: compose |
| Difference in months | `MONTHS_BETWEEN(d1,d2)` | ✅ `MONTHS_BETWEEN` | ⚠️ ALT `EXTRACT(YEAR…)*12+EXTRACT(MONTH…)` | ⚠️ ALT `PERIOD_DIFF` | ✅ `DATEDIFF(month,d1,d2)` | ✅ `DATEDIFF(month,d1,d2)` | ✅ `DATEDIFF(month,d1,d2)` | ✅ `months_between()` | PG/MY: amber |
| Difference in hours | `HOUR_DIFF(d1,d2)` | ✅ `(d1-d2)*24` | ✅ `EXTRACT(EPOCH FROM d1-d2)/3600` | ✅ `TIMESTAMPDIFF(HOUR,d1,d2)` | ✅ `DATEDIFF(hour,d1,d2)` | ✅ `DATEDIFF(hour,d1,d2)` | ✅ `DATEDIFF(hour,d1,d2)` | ✅ custom expr | All: compose |
| Difference in seconds | `SECOND_DIFF(d1,d2)` | ✅ `(d1-d2)*86400` | ✅ `EXTRACT(EPOCH FROM d1-d2)` | ✅ `TIMESTAMPDIFF(SECOND,d1,d2)` | ✅ `DATEDIFF(second,d1,d2)` | ✅ `DATEDIFF(second,d1,d2)` | ✅ `DATEDIFF(second,d1,d2)` | ✅ custom expr | All: compose |

### 6.4 Date Truncation & Rounding

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Truncate to start of day | `DATE_TRUNC('day',d)` | ✅ `TRUNC(d,'DD')` | ✅ `DATE_TRUNC('day',d)` | ✅ `DATE(d)` | ✅ `CAST(d AS DATE)` | ✅ `DATE_TRUNC('day',d)` | ✅ `DATE_TRUNC('day',d)` | ✅ `trunc(col,'dd')` | All: enable; syntax varies |
| Truncate to start of month | `DATE_TRUNC('month',d)` | ✅ `TRUNC(d,'MM')` | ✅ `DATE_TRUNC('month',d)` | ✅ `STR_TO_DATE(DATE_FORMAT(d,'%Y-%m'),'%Y-%m')` | ✅ `DATEADD(day,1-DAY(d),CAST(d AS DATE))` | ✅ `DATE_TRUNC('month',d)` | ✅ `DATE_TRUNC('month',d)` | ✅ `trunc(col,'MM')` | MY/SS: amber |
| Truncate to start of year | `DATE_TRUNC('year',d)` | ✅ `TRUNC(d,'YEAR')` | ✅ `DATE_TRUNC('year',d)` | ✅ `STR_TO_DATE(YEAR(d),'%Y')` | ✅ `DATEFROMPARTS(YEAR(d),1,1)` | ✅ `DATE_TRUNC('year',d)` | ✅ `DATE_TRUNC('year',d)` | ✅ `trunc(col,'yyyy')` | MY/SS: amber |
| Truncate to start of quarter | `DATE_TRUNC('quarter',d)` | ✅ `TRUNC(d,'Q')` | ✅ `DATE_TRUNC('quarter',d)` | ⚠️ ALT complex | ⚠️ ALT complex | ✅ `DATE_TRUNC('quarter',d)` | ✅ `DATE_TRUNC('quarter',d)` | ✅ `trunc(col,'QQ')` | MY/SS: amber |
| Truncate to start of week | `DATE_TRUNC('week',d)` | ✅ `TRUNC(d,'IW')` | ✅ `DATE_TRUNC('week',d)` | ✅ `DATE_SUB(d, WEEKDAY(d))` | ⚠️ ALT `DATEADD(day,-(DATEPART(weekday,d)-1),d)` | ✅ `DATE_TRUNC('week',d)` | ✅ `DATE_TRUNC('week',d)` | ✅ `trunc(col,'week')` | MY/SS: amber |
| Round date to nearest unit | `DATE_ROUND(d, unit)` | ✅ `ROUND(d,'unit')` | ⚠️ ALT compose | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ✅ custom expr | ORA only native; others: PySpark |

### 6.5 Date Formatting & Parsing

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Format date as string | `TO_CHAR(d, fmt)` / `DATE_FORMAT` | ✅ `TO_CHAR(d,'YYYY-MM-DD')` | ✅ `TO_CHAR(d,'YYYY-MM-DD')` | ✅ `DATE_FORMAT(d,'%Y-%m-%d')` | ✅ `FORMAT(d,'yyyy-MM-dd')` | ✅ `TO_CHAR(d,'YYYY-MM-DD')` | ✅ `TO_CHAR(d,'YYYY-MM-DD')` | ✅ `date_format(col,'yyyy-MM-dd')` | Format string syntax varies significantly |
| Parse string to date | `TO_DATE(s, fmt)` | ✅ `TO_DATE(s,'fmt')` | ✅ `TO_DATE(s,'fmt')` | ✅ `STR_TO_DATE(s,'fmt')` | ✅ `CONVERT(date,s,fmt_code)` | ✅ `TO_DATE(s,'fmt')` | ✅ `TO_DATE(s,'fmt')` | ✅ `to_date(col,'fmt')` | MY: %format codes; SS: numeric style codes |
| Parse string to timestamp | `TO_TIMESTAMP(s, fmt)` | ✅ `TO_TIMESTAMP` | ✅ `TO_TIMESTAMP` | ✅ `STR_TO_DATE` + cast | ✅ `CONVERT(datetime,s)` | ✅ `TO_TIMESTAMP` | ✅ `TO_TIMESTAMP` | ✅ `to_timestamp(col,'fmt')` | MY/SS: compose |
| Unix timestamp to date | `FROM_UNIXTIME(n)` | ✅ `TO_DATE('1970-01-01') + n/86400` | ✅ `TO_TIMESTAMP(n)` | ✅ `FROM_UNIXTIME(n)` | ✅ `DATEADD(s,n,'1970-01-01')` | ✅ `(TIMESTAMP 'epoch' + n * INTERVAL '1 second')` | ✅ `TO_TIMESTAMP(n)` | ✅ `from_unixtime(col)` | All: compose |
| Date to Unix timestamp | `UNIX_TIMESTAMP(d)` | ✅ `(d - DATE '1970-01-01') * 86400` | ✅ `EXTRACT(EPOCH FROM d)` | ✅ `UNIX_TIMESTAMP(d)` | ✅ `DATEDIFF(s,'1970-01-01',d)` | ✅ `EXTRACT(EPOCH FROM d)` | ✅ `DATE_PART('epoch',d)` | ✅ `unix_timestamp(col)` | ORA/SS: compose |
| Convert timezone | `CONVERT_TZ(d, from, to)` | ✅ `FROM_TZ / AT TIME ZONE` | ✅ `d AT TIME ZONE 'tz'` | ✅ `CONVERT_TZ(d,from,to)` | ✅ `AT TIME ZONE` (2016+) | ✅ `CONVERT_TIMEZONE(from,to,d)` | ✅ `CONVERT_TIMEZONE(from,to,d)` | ✅ `from_utc_timestamp()` / `to_utc_timestamp()` | All supported; syntax varies |
| Make date from parts | `DATE_FROM_PARTS(y,m,d)` | ✅ `TO_DATE(y\|\|'-'\|\|m\|\|'-'\|\|d,'YYYY-MM-DD')` | ✅ `MAKE_DATE(y,m,d)` | ✅ `STR_TO_DATE` compose | ✅ `DATEFROMPARTS(y,m,d)` | ✅ `DATE_FROM_PARTS(y,m,d)` | ✅ `DATE_FROM_PARTS(y,m,d)` | ✅ `make_date(y,m,d)` | ORA/MY/PG: compose |
| Make timestamp from parts | `TIMESTAMP_FROM_PARTS(y,m,d,h,mi,s)` | ✅ `TO_TIMESTAMP` compose | ✅ `MAKE_TIMESTAMP` | ✅ compose | ✅ `DATETIMEFROMPARTS` | ✅ `TIMESTAMP_FROM_PARTS` | ✅ `TIMESTAMP_FROM_PARTS` | ✅ `make_timestamp()` | SS/SF/RS: native |
| Age / time since | `AGE(d)` | ✅ compose | ✅ `AGE(d)` | ✅ compose | ✅ compose | ✅ compose | ✅ compose | ✅ custom expr | PG only native |

### 6.6 Interval & Duration Handling

| Function (User Label) | SQL Name | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake | PySpark | UI Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| Create interval | `INTERVAL n UNIT` | ✅ `INTERVAL 'n' unit` | ✅ `INTERVAL 'n unit'` | ✅ `INTERVAL n UNIT` | ✅ `DATEADD` only | ✅ `INTERVAL 'n unit'` | ✅ `INTERVAL n UNIT` | ✅ via `timedelta` / expr | SS: no standalone interval |
| Interval to seconds | `INTERVAL_TO_SECONDS` | ✅ compose | ✅ `EXTRACT(EPOCH FROM interval)` | ✅ `TIME_TO_SEC` | ⚠️ ALT | ✅ `EXTRACT(EPOCH FROM interval)` | ✅ compose | ✅ custom expr | |
| Overlay (business days) | `BUSINESS_DAY_ADD` | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | 🔵 SPARK custom | PySpark only with custom logic |

