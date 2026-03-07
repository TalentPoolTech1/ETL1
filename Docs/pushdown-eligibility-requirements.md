# Pushdown Eligibility, Execution Point Selection & Function Enforcement
## Detailed Requirements Document

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-03-01  
**Audience:** Product, Engineering, QA, UX  
**Companion To:** Multi-Transform Component Requirements v1.0

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Core Concepts and Terminology](#2-core-concepts-and-terminology)
3. [Pushdown Eligibility Engine](#3-pushdown-eligibility-engine)
4. [Execution Point Selection — User Workflow](#4-execution-point-selection--user-workflow)
5. [Function Eligibility Enforcement](#5-function-eligibility-enforcement)
6. [Execution Point Propagation and Lineage Rules](#6-execution-point-propagation-and-lineage-rules)
7. [Cross-Source Join Handling](#7-cross-source-join-handling)
8. [UI Design and Visual Specification](#8-ui-design-and-visual-specification)
9. [Pushdown Capability Matrix by Source Technology](#9-pushdown-capability-matrix-by-source-technology)
10. [Code Generation Rules](#10-code-generation-rules)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Testing Matrix and Acceptance Criteria](#12-testing-matrix-and-acceptance-criteria)
13. [Open Questions and Decisions](#13-open-questions-and-decisions)

---

## 1. Purpose and Scope

### 1.1 Purpose

When a user builds a data pipeline by dragging source tables, joining them, applying transformations, and aggregating results, the system must intelligently determine how far the computation can be "pushed down" to the source database engine before the data needs to be pulled into the PySpark processing engine.

Pushing computation down to the source (e.g., Oracle, PostgreSQL, MySQL) reduces data movement, improves performance, and leverages the source engine's native optimisations. However, not every operation is supported by every source engine, and once data passes through a PySpark step, subsequent operations on that derived data cannot be pushed back to the original source.

This document defines:

- How the system analyses and determines pushdown eligibility across a pipeline graph.
- How users are presented with the choice of where to execute each logical segment.
- How the system enforces function/transformation availability per source technology.
- How execution point decisions propagate through the pipeline and constrain downstream options.

### 1.2 Scope

| In Scope | Out of Scope |
|---|---|
| Pushdown eligibility detection for same-source segments | Cost-based automatic pushdown optimisation (v2) |
| User-controlled execution point selection per segment | Cross-cloud network routing decisions |
| Function availability enforcement per source technology | Custom JDBC driver plugin development |
| Visual pipeline graph with execution boundary markers | Streaming / real-time pipeline pushdown |
| Execution point propagation through lineage | Pushdown to non-SQL sources (files, APIs, NoSQL) |
| Cross-source join detection and boundary enforcement | Automatic UDF generation as pushdown fallback |
| Code generation for both pushdown SQL and PySpark | Query plan cost estimation |

### 1.3 Supported Source Technologies (v1)

| Technology | Pushdown Capable | Notes |
|---|---|---|
| Oracle | ✅ Yes | Full SQL dialect; most functions supported |
| PostgreSQL | ✅ Yes | Rich SQL; some analytic functions differ |
| MySQL | ✅ Yes | Limited analytic/window function support |
| SQL Server | ✅ Yes | T-SQL dialect; good analytic support |
| Redshift | ✅ Yes | PostgreSQL-based dialect |
| Snowflake | ✅ Yes | ANSI SQL + extensions |
| PySpark (intermediate) | N/A | PySpark is the fallback execution engine |

---

## 2. Core Concepts and Terminology

### 2.1 Definitions

| Term | Definition |
|---|---|
| **Pushdown** | Executing a computation (filter, join, aggregate, transform) inside the source database engine rather than in PySpark. The DB runs the SQL, PySpark only receives the result. |
| **Pushdown Segment** | A contiguous sequence of pipeline steps that can all be executed within a single source engine. Represented as a single SQL query sent to that engine. |
| **Execution Point** | The engine where a given segment of the pipeline executes: either the **Source DB** (pushdown) or the **PySpark Engine**. |
| **Execution Boundary** | The point in the pipeline graph where execution switches from the Source DB to PySpark, or vice versa. Boundaries are visualised in the pipeline graph. |
| **Pushdown Fence** | A step that cannot be pushed down to the source, forcing all subsequent steps onto PySpark. Once a fence is crossed, pushdown is no longer available for downstream steps on that column lineage. |
| **Lineage Break** | When a column's value has been derived by a PySpark step, it is no longer traceable to a direct source column. This column cannot be referenced in a pushdown segment. |
| **Source-Homogeneous Segment** | A set of steps where all source tables involved belong to the same technology and the same database connection. Required for pushdown. |
| **Cross-Source Join** | A join between tables from different source technologies (e.g., Oracle + PostgreSQL). Always executes in PySpark; cannot be pushed down. |
| **Function Eligibility** | Whether a specific transformation function is natively supported by the chosen execution engine (source DB technology or PySpark). |

### 2.2 Execution Point Values

Every step group in the pipeline has one of three execution point states:

| State | Icon | Meaning |
|---|---|---|
| **Pushdown to Source** | 🔵 DB icon | Executes as SQL in the source database. |
| **PySpark Engine** | 🟠 Spark icon | Executes as PySpark / Spark SQL in the cluster. |
| **Forced PySpark** | 🔴 Lock icon | Cannot be pushed down — locked to PySpark due to lineage break, cross-source dependency, or unsupported function. |

---

## 3. Pushdown Eligibility Engine

### 3.1 What Makes a Segment Pushdown-Eligible?

The system automatically analyses the pipeline graph and determines pushdown eligibility for each segment. A segment is eligible for pushdown **only when all of the following conditions are true:**

| Condition | Explanation |
|---|---|
| **Same source technology** | All tables in the segment come from the same DB technology (e.g., all Oracle). |
| **Same connection** | All tables are on the same database server / connection string. Tables from two different Oracle servers are NOT eligible for same-DB pushdown. |
| **No upstream PySpark lineage break** | None of the input columns were derived by a prior PySpark step. If a column's value was computed in PySpark, it does not exist in the source DB and cannot be referenced in a pushed-down query. |
| **All functions supported by source** | Every transformation applied in the segment is natively supported by the source DB technology. If any function in the segment is unsupported, the whole segment cannot be pushed down (unless the unsupported steps are moved to a PySpark sub-segment). |
| **No file or API sources mixed in** | File-based or API-sourced tables cannot participate in a pushdown segment. |

### 3.2 Automatic Eligibility Analysis

The system performs eligibility analysis **continuously** as the user builds the pipeline:

1. **On table addition:** When a table is dragged onto the canvas, its source technology and connection are registered.
2. **On join creation:** The system checks whether both sides of the join share source technology and connection.
3. **On transformation addition:** Each transformation is checked against the source technology's capability matrix.
4. **On execution point change:** When the user changes a segment's execution point, downstream eligibility is re-evaluated.

The result of the analysis is a **Pushdown Eligibility Map** — a data structure that annotates every node in the pipeline graph with its eligibility state and the reasons for any ineligibility.

### 3.3 Pushdown Boundary Detection — Worked Example

```
Pipeline Graph:
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  [Oracle: ORDERS]──┐                                                    │
│                    ├──[JOIN]──[FILTER]──[AGGREGATE]──┐                  │
│  [Oracle: ITEMS]───┘                                 │                  │
│                                                      ├──[JOIN]──[OUTPUT]│
│  [PostgreSQL: CUSTOMERS]─────────────────────────────┘                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

Eligibility Analysis:
  ORDERS + ITEMS JOIN     → ✅ Both Oracle, same connection → Pushdown eligible
  FILTER on joined set    → ✅ Oracle native → Pushdown eligible
  AGGREGATE on joined set → ✅ Oracle native (e.g. SUM, COUNT) → Pushdown eligible
  JOIN with CUSTOMERS     → ❌ Cross-source (Oracle + PostgreSQL) → Execution Boundary
  Everything after join   → 🔴 Forced PySpark (cross-source join result)

Resulting segments:
  Segment A [Oracle Pushdown]: ORDERS JOIN ITEMS → FILTER → AGGREGATE
  ── EXECUTION BOUNDARY ──
  Segment B [PySpark]: JOIN with CUSTOMERS → OUTPUT
```

### 3.4 Segment Boundary Visualisation Rules

- An **execution boundary line** is drawn across the pipeline graph between segments with different execution points.
- The boundary line is labelled with the direction of the transition (e.g., "Data moves from Oracle to PySpark here").
- Each segment is colour-coded: blue background tint for pushdown segments, orange background tint for PySpark segments.
- Hovering over a boundary shows a tooltip explaining why the boundary exists.

---

## 4. Execution Point Selection — User Workflow

### 4.1 System Default Behaviour

By default, the system automatically selects the **optimal execution point** for each segment:

- If a segment is pushdown-eligible → default to **Pushdown to Source**.
- If a segment is not eligible → default to **PySpark Engine**.
- The user is notified of the automatic assignment via an informational banner.

> **Default rule rationale:** Pushdown reduces data egress, latency, and Spark cluster load. Defaulting to pushdown when eligible is always the more efficient choice unless the user has a reason to override.

### 4.2 User Override — Choosing Execution Point

For any **pushdown-eligible** segment, the user may choose to override the default and execute in PySpark instead. This is a deliberate choice — for example, if the source DB is under load and the user wants to offload computation to the Spark cluster.

**How the user selects execution point:**

1. User clicks on a segment in the pipeline graph (highlighted by a segment selector).
2. An **Execution Point Panel** appears (sidebar or popover) showing:
   - Segment name / step range
   - Current execution point (with icon)
   - Eligibility status and reasons
   - A toggle or dropdown to switch between **Source DB** and **PySpark Engine**
3. If the user selects PySpark for an eligible segment, the system:
   - Marks the segment as PySpark.
   - Re-evaluates all downstream segments for lineage impact (see Section 6).
   - Shows a warning if the switch creates a lineage break that locks downstream segments out of pushdown.

**Switching is NOT allowed** (toggle is disabled + tooltip explains why) when:
- The segment is **Forced PySpark** (ineligible — user cannot push it down).
- Changing to pushdown would contradict an upstream PySpark lineage break (see Section 6.3).

### 4.3 Execution Point Panel — UI Specification

```
┌─────────────────────────────────────────────────────┐
│  ⚙ Execution Point                          [Close] │
├─────────────────────────────────────────────────────┤
│  Segment: Orders + Items → Filter → Aggregate       │
│                                                     │
│  Tables involved:                                   │
│    🔵 ORDERS (Oracle · prod-oracle-01)              │
│    🔵 ITEMS  (Oracle · prod-oracle-01)              │
│                                                     │
│  Eligibility:  ✅ Eligible for Source Pushdown      │
│  Reasons:      Same technology · Same connection    │
│                All functions supported in Oracle    │
│                No upstream lineage breaks           │
│                                                     │
│  Where should this run?                             │
│  ┌───────────────┐   ┌───────────────┐              │
│  │ 🔵 Source DB  │   │ 🟠 PySpark    │              │
│  │  (Oracle)     │   │   Engine      │              │
│  │  ← Selected   │   │               │              │
│  └───────────────┘   └───────────────┘              │
│                                                     │
│  ⚠ Switching to PySpark will force all downstream  │
│  segments that reference these columns to PySpark.  │
│                                     [Cancel] [Apply]│
└─────────────────────────────────────────────────────┘
```

### 4.4 Bulk Execution Point Assignment

- User can right-click a segment and select "Set all eligible upstream segments to Source DB" or "Force all to PySpark."
- A summary of the impact (how many segments affected, data movement estimate) is shown before applying.

---

## 5. Function Eligibility Enforcement

### 5.1 Core Enforcement Principle

> **The system must never allow a user to add a transformation that cannot be executed at the chosen execution point. Enforcement happens at the point of selection — not at code generation time.**

This means:
- If the execution point is **Source DB (Oracle)**, only Oracle-supported functions are available.
- If the execution point is **PySpark**, all PySpark-supported functions are available.
- Functions that are **unavailable** are not just greyed out — they are removed from the palette entirely OR shown with a clear "Not available for this source" state that explains why and what alternatives exist.

### 5.2 Unavailability vs No Alternative

The system distinguishes two situations:

#### Situation A — Function Not Supported, But Alternative Exists

The source technology does not support the exact function, but a functionally equivalent or similar operation is available.

**Action:** The unsupported function is shown in the palette with an amber badge. Clicking it opens an **Alternative Suggestion Panel** instead of the parameter form.

**Example:**

> User is working on an Oracle segment and tries to add **If / Else**.
>
> Oracle does not support a generic IF/ELSE expression in the same syntax as other engines — but it supports `CASE WHEN ... THEN ... ELSE ... END`.
>
> The system shows:
> ```
> ⚠ "If / Else" is not available in Oracle SQL.
>
> ✅ Available alternative: "Multiple Conditions (Case / When)"
>    This does the same thing and runs natively in Oracle.
>
> [Add Case/When Instead]   [Cancel]
> ```

#### Situation B — Function Not Supported, No Alternative

The source technology does not support the function and no equivalent exists for that technology.

**Action:** The function is shown in the palette with a red "Not available" badge. It is visually distinct (dimmed, red icon border). Clicking it shows an explanation panel but does **not** allow the function to be added.

**Example:**

> User is working on a PostgreSQL segment and tries to add **List Aggregation (LISTAGG)**.
>
> PostgreSQL does not have `LISTAGG`. The nearest is `STRING_AGG`, but the user's pipeline is connected to a PostgreSQL source and the execution point is set to Source DB.
>
> The system shows:
> ```
> ❌ "List Aggregation (LISTAGG)" is not available in PostgreSQL.
>
> There is no direct equivalent function natively supported in PostgreSQL
> for this operation in pushdown mode.
>
> Your options:
>   1. Switch this segment's execution point to PySpark Engine,
>      where collect_list() achieves the same result.
>   2. Keep the Source DB execution point and use a different approach.
>
> [Switch to PySpark]   [Close]
> ```

### 5.3 Function Enforcement Triggers

Enforcement is applied at the following moments:

| Trigger | Enforcement Action |
|---|---|
| User opens transformation palette | Palette is pre-filtered for the segment's current execution point and source technology |
| User drags a table from a different source | All transforms in existing steps are re-evaluated; incompatible ones are flagged immediately |
| User changes segment execution point | All transforms in the segment are re-validated; incompatible ones are highlighted |
| User switches pipeline target engine | Full re-validation across all segments |
| User saves or applies to pipeline | Final validation pass; save is blocked if any incompatible functions remain unresolved |

### 5.4 Inline Incompatibility Flags on Existing Steps

When a step that was previously valid becomes invalid (e.g., because the user changed the execution point or added a cross-source table):

- The step row in the step list shows a red `⊘` badge on the left.
- The step is NOT automatically removed — the user must resolve it.
- An **Issue Summary Banner** appears at the top of the editor listing all incompatible steps with one-click navigation to each.
- Saving or applying to the pipeline is **blocked** until all incompatibilities are resolved.

### 5.5 Resolution Options for Incompatible Steps

When a step is flagged as incompatible, the user is offered resolution options:

| Option | Description |
|---|---|
| **Replace with alternative** | If an alternative exists, replace this step with the suggested alternative (one click). |
| **Move segment to PySpark** | Switch the entire segment to PySpark execution, making the function available. |
| **Delete this step** | Remove the incompatible step from the sequence. |
| **Split segment here** | Insert an execution boundary before this step, moving it and all subsequent steps to PySpark. |

---

## 6. Execution Point Propagation and Lineage Rules

### 6.1 The Lineage Break Rule

> **Core Rule:** If a column's value is computed or transformed by a PySpark step, that computed value does not exist in the source database. It cannot be referenced in any downstream pushdown SQL query.

This rule creates a **lineage break** — a point in the pipeline after which the column is "PySpark-owned" and cannot re-enter a Source DB segment.

### 6.2 Lineage Tracking

The system tracks the **execution origin** of every column at every stage of the pipeline:

| Column Origin State | Meaning | Pushdown Eligible? |
|---|---|---|
| `SOURCE_DIRECT` | Column comes directly from a source table with no transformation, or only source-DB-executed transformations | ✅ Yes |
| `PYSPARK_DERIVED` | Column was created, transformed, or modified by a PySpark step | ❌ No — cannot be used in pushdown |
| `MIXED_UPSTREAM` | Column was derived from both source and PySpark-computed inputs | ❌ No — treated as PySpark-derived |

### 6.3 Propagation Rules

**Rule 1 — PySpark derivation is contagious downstream:**
If a PySpark step produces or modifies a column, all downstream steps that consume that column are forced to PySpark — even if those downstream steps are on a segment that would otherwise be pushdown-eligible.

**Rule 2 — PySpark derivation does NOT contaminate independent columns:**
If column A is PySpark-derived and column B is still source-direct, column B can still participate in a pushdown segment — as long as column A is not involved.

**Rule 3 — Joins on PySpark-derived columns force the join to PySpark:**
If either side of a join condition references a PySpark-derived column, the join must execute in PySpark.

**Rule 4 — Aggregates on PySpark-derived columns force the aggregate to PySpark:**
If any aggregate input column is PySpark-derived, the entire aggregate step moves to PySpark.

**Rule 5 — Once a column becomes PySpark-derived, it cannot revert:**
There is no mechanism to "push a column back" to the source DB. This is by design — the source DB no longer has the computed value.

### 6.4 Worked Example — Propagation

```
Pipeline:
  [Oracle: ORDERS] → [Step A: Remove Time from Date — PySpark ← user override]
                   → [Step B: Add 1 Month — user wants pushdown]
                   → [JOIN with Oracle: ITEMS]
                   → [Step C: Aggregate SUM]

Lineage Analysis:
  order_date (original)       → SOURCE_DIRECT ✅
  order_date after Step A     → PYSPARK_DERIVED ❌ (Step A executed in PySpark)
  order_date after Step B     → Cannot push down — input is PYSPARK_DERIVED
                                Step B forced to PySpark even though Add 1 Month
                                is Oracle-native, because its input is PYSPARK_DERIVED
  JOIN with ITEMS             → ITEMS columns are SOURCE_DIRECT ✅
                                But order_date is PYSPARK_DERIVED ❌
                                → JOIN must execute in PySpark
  Step C: Aggregate SUM       → Input has PYSPARK_DERIVED columns → PySpark

User Notification:
  ⚠ "Because 'Remove Time from Date' (Step A) is set to run in PySpark,
     all downstream steps on this column (Step B, the Join, and Aggregate)
     are also locked to PySpark.

     To enable pushdown for these steps, change Step A's segment
     execution point to Source DB (Oracle)."
```

### 6.5 Execution Point Lock Visualisation

In the pipeline graph:

- Columns with `PYSPARK_DERIVED` status are shown with an orange lineage trace.
- Steps that are **forced to PySpark due to upstream lineage** are shown with a 🔴 lock icon and a tooltip: "Locked to PySpark — this column was computed in PySpark upstream."
- The lock icon is distinct from a **user-chosen PySpark** step (🟠 no lock) so the user understands the difference between their choice and a system constraint.

### 6.6 Column Lineage Panel

A **Column Lineage Panel** is accessible per column (click the column name in any step's parameter panel):

```
┌─────────────────────────────────────────────────────┐
│  Column Lineage: order_date                 [Close] │
├─────────────────────────────────────────────────────┤
│  Origin: Oracle · ORDERS · order_date               │
│  Original Type: TIMESTAMP                           │
│                                                     │
│  Step 1 — Remove Time from Date                     │
│    Execution: 🟠 PySpark (user override)            │
│    Output type: DATE                                │
│    ⚠ Lineage break introduced here                 │
│                                                     │
│  Step 2 — Add 1 Month                               │
│    Execution: 🔴 Forced PySpark (upstream break)    │
│    Output type: DATE                                │
│                                                     │
│  Step 3 — JOIN condition reference                  │
│    Execution: 🔴 Forced PySpark (upstream break)    │
│                                                     │
│  To restore pushdown eligibility:                   │
│  → Change Step 1 to execute in Source DB (Oracle)  │
└─────────────────────────────────────────────────────┘
```

---

## 7. Cross-Source Join Handling

### 7.1 Detection

When the user creates a join between two tables (or segments) from different source technologies or different connections, the system immediately detects this as a **cross-source join**.

Cross-source joins are:
- Always executed in PySpark.
- Never pushdown-eligible.
- A permanent execution boundary is placed at the join.

### 7.2 Boundary Placement Rules for Cross-Source Joins

- All steps **before** the cross-source join remain eligible for pushdown on their respective source.
- The cross-source join itself executes in PySpark.
- All steps **after** the cross-source join execute in PySpark (unless another segment begins from a new direct source table).

**Visual in pipeline graph:**
```
[Oracle Segment 🔵]──────────────────────────────┐
                                                  ├──[CROSS-SOURCE JOIN]──[PySpark Segment 🟠]
[PostgreSQL Segment 🔵]──────────────────────────┘

  Oracle segment: can be pushed down to Oracle
  PostgreSQL segment: can be pushed down to PostgreSQL
  Join onward: forced PySpark — no pushdown possible
```

### 7.3 Pre-Join Pushdown Optimisation

Before the cross-source join executes in PySpark, the system generates and executes pushdown SQL for each source segment separately:

- **Oracle segment** → SQL query sent to Oracle, result fetched as a DataFrame.
- **PostgreSQL segment** → SQL query sent to PostgreSQL, result fetched as a DataFrame.
- **Join** → PySpark joins the two DataFrames.

This means the user gets pushdown benefit **up to** the cross-source join boundary, minimising the data pulled into PySpark.

### 7.4 User Notification for Cross-Source Joins

When the user connects two tables from different sources:

```
ℹ Cross-Source Join Detected

You are joining:
  🔵 ORDERS (Oracle · prod-oracle-01)
with
  🔵 CUSTOMERS (PostgreSQL · prod-pg-01)

These are on different database systems, so this join will run in PySpark.

The steps before the join will still run in their own databases
(reducing data movement). The join and all steps after it will run
in PySpark.

[Got it — Continue]   [Change Connection]
```

---

## 8. UI Design and Visual Specification

### 8.1 Pipeline Graph — Segment Colouring

| Segment Type | Background Tint | Border | Label |
|---|---|---|---|
| Source Pushdown (user-selected) | Blue `#EFF6FF` | `#0B66FF` 2px | "Oracle" / "PostgreSQL" etc. |
| PySpark (user-selected) | Orange `#FFF7ED` | `#F97316` 2px | "PySpark Engine" |
| Forced PySpark (system-locked) | Red `#FEF2F2` | `#DC2626` 2px dashed | "PySpark (Required)" |
| Pushdown-eligible but not yet decided | Grey `#F9FAFB` | `#9CA3AF` 1px dashed | "Eligible — choose execution point" |

### 8.2 Execution Boundary Line

- Drawn as a vertical dashed line across the pipeline canvas between two segments of different execution points.
- Colour: `#6B7280` dashed.
- Label floated above the line: e.g., "Data moves from Oracle → PySpark here".
- Hovering shows a tooltip with the reason for the boundary.

### 8.3 Step-Level Execution Indicators

Each step row in the Multi-Transform editor includes an execution point indicator chip:

| Chip | Colour | Meaning |
|---|---|---|
| `🔵 Oracle` | Blue | Step executing in Oracle (pushdown) |
| `🟠 PySpark` | Orange | Step executing in PySpark (user choice) |
| `🔴 PySpark (locked)` | Red | Step forced to PySpark (lineage/function constraint) |

### 8.4 Transformation Palette — Function Availability States

Each transformation card in the palette shows one of the following states based on current execution context:

| State | Visual | Interaction |
|---|---|---|
| **Available** | Normal card, coloured icon | Click to add |
| **Alternative available** | Amber `⚠` badge, amber icon border | Click → shows Alternative Suggestion Panel |
| **Not available — switch engine** | Red `⊘` badge, dimmed card | Click → shows explanation + "Switch to PySpark" button |
| **Not available — no alternative** | Red `⊘` badge, dimmed card, strikethrough name | Click → shows explanation only; cannot add |

### 8.5 Issue Resolution Banner

When incompatible steps exist in the current editor:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ⚠  2 steps have issues that must be resolved before saving.             │
│                                                                         │
│  • Step 2: "If / Else" — not supported in Oracle. [Fix →]              │
│  • Step 4: "List Aggregation" — not supported in PostgreSQL. [Fix →]   │
│                                                                 [Dismiss]│
└─────────────────────────────────────────────────────────────────────────┘
```

The banner is sticky at the top of the editor. "Fix →" navigates directly to the affected step.

### 8.6 Execution Point Impact Warning (on segment switch)

When a user switches a segment from Source DB to PySpark (or vice versa):

```
┌─────────────────────────────────────────────────────┐
│  ⚠  Changing Execution Point — Impact Preview       │
├─────────────────────────────────────────────────────┤
│  Switching "Segment A" from Oracle → PySpark will:  │
│                                                     │
│  • Force 3 downstream steps to PySpark              │
│    (they reference columns derived in this segment) │
│  • Remove pushdown eligibility from Segment B       │
│  • Increase estimated data movement by ~240 MB      │
│                                                     │
│  Affected columns: order_date, total_amount         │
│                                                     │
│              [Cancel]      [Switch Anyway]          │
└─────────────────────────────────────────────────────┘
```

---

## 9. Pushdown Capability Matrix by Source Technology

This matrix defines which transformation primitives are natively supported for pushdown to each source technology. Only primitives listed as ✅ native can be included in a pushdown segment for that engine.

> **Key:**
> ✅ Native — supported, generates direct SQL
> ⚠ Alt — not directly supported, but an alternative exists (user is guided to it)
> ❌ None — not supported, no equivalent, step cannot be used in pushdown for this engine

| User Label | Tech ID | Oracle | PostgreSQL | MySQL | SQL Server | Redshift | Snowflake |
|---|---|---|---|---|---|---|---|
| Convert Text to Number | `to_number` | ✅ `TO_NUMBER` | ✅ `CAST` | ✅ `CAST` | ✅ `CAST` | ✅ `TO_NUMBER` | ✅ `TO_NUMBER` |
| Convert Text to Date | `to_date` | ✅ `TO_DATE` | ✅ `TO_DATE` | ✅ `STR_TO_DATE` | ✅ `CONVERT` | ✅ `TO_DATE` | ✅ `TO_DATE` |
| Change Data Type | `cast` | ✅ `CAST` | ✅ `CAST` | ✅ `CAST` | ✅ `CAST` | ✅ `CAST` | ✅ `CAST` |
| Extract Part of Text | `substring` | ✅ `SUBSTR` | ✅ `SUBSTRING` | ✅ `SUBSTRING` | ✅ `SUBSTRING` | ✅ `SUBSTRING` | ✅ `SUBSTRING` |
| Remove Time from Date | `trim_timestamp` | ✅ `TRUNC` | ✅ `DATE_TRUNC` | ⚠ `DATE()`* | ✅ `CAST AS DATE` | ✅ `DATE_TRUNC` | ✅ `DATE_TRUNC` |
| Add Time to a Date | `date_add` | ✅ `+ INTERVAL` | ✅ `+ INTERVAL` | ✅ `DATE_ADD` | ✅ `DATEADD` | ✅ `DATEADD` | ✅ `DATEADD` |
| Subtract Time from a Date | `date_sub` | ✅ `- INTERVAL` | ✅ `- INTERVAL` | ✅ `DATE_SUB` | ✅ `DATEADD` (neg) | ✅ `DATEADD` (neg) | ✅ `DATEADD` (neg) |
| Round a Number | `round` | ✅ `ROUND` | ✅ `ROUND` | ✅ `ROUND` | ✅ `ROUND` | ✅ `ROUND` | ✅ `ROUND` |
| Round Down | `floor` | ✅ `FLOOR` | ✅ `FLOOR` | ✅ `FLOOR` | ✅ `FLOOR` | ✅ `FLOOR` | ✅ `FLOOR` |
| Round Up | `ceil` | ✅ `CEIL` | ✅ `CEIL` | ✅ `CEIL` | ✅ `CEILING` | ✅ `CEILING` | ✅ `CEIL` |
| Pull Text Using a Pattern | `regex_extract` | ✅ `REGEXP_SUBSTR` | ✅ `REGEXP_MATCHES` | ✅ `REGEXP_SUBSTR` | ⚠ Limited† | ✅ `REGEXP_SUBSTR` | ✅ `REGEXP_SUBSTR` |
| Find and Replace Using a Pattern | `regex_replace` | ✅ `REGEXP_REPLACE` | ✅ `REGEXP_REPLACE` | ✅ `REGEXP_REPLACE` | ⚠ Limited† | ✅ `REGEXP_REPLACE` | ✅ `REGEXP_REPLACE` |
| If / Else | `if_else` | ⚠ Use CASE WHEN | ✅ `CASE WHEN` | ✅ `IF()` or `CASE` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `IFF` or `CASE` |
| Multiple Conditions | `case_when` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `CASE WHEN` |
| Use First Available Value | `coalesce` | ✅ `COALESCE` | ✅ `COALESCE` | ✅ `COALESCE` | ✅ `COALESCE` | ✅ `COALESCE` | ✅ `COALESCE` |
| Blank Out a Specific Value | `null_if` | ✅ `NULLIF` | ✅ `NULLIF` | ✅ `NULLIF` | ✅ `NULLIF` | ✅ `NULLIF` | ✅ `NULLIF` |
| Replace Values Using Lookup | `map_lookup` | ⚠ via DECODE/JOIN | ⚠ via JOIN | ⚠ via JOIN | ⚠ via JOIN | ⚠ via JOIN | ⚠ via JOIN |
| List Aggregation | `list_agg` | ✅ `LISTAGG` | ❌ None‡ | ❌ None‡ | ✅ `STRING_AGG` | ✅ `LISTAGG` | ✅ `LISTAGG` |
| Write Your Own Expression | `custom_sql` | ⚠ User-defined | ⚠ User-defined | ⚠ User-defined | ⚠ User-defined | ⚠ User-defined | ⚠ User-defined |

> \* MySQL `DATE()` function truncates to day only; month/year truncation requires additional expression.
> † SQL Server has limited regex support via `LIKE` patterns only. Full regex requires CLR functions.
> ‡ PostgreSQL has `STRING_AGG` which is similar but not identical to `LISTAGG`. Because the behaviour and syntax differ materially, the system treats this as "None" for pushdown and directs users to PySpark's `collect_list()`.

### 9.1 PySpark Engine Capabilities

When execution point is PySpark, the full PySpark/Spark SQL function library is available. This includes all primitives above plus:

- `collect_list` / `collect_set` — equivalent of LISTAGG
- `explode` / `posexplode` — array operations
- `struct`, `map_from_arrays` — complex type construction
- All window functions (`ROW_NUMBER`, `RANK`, `LAG`, `LEAD`, etc.)
- All built-in Spark SQL functions

PySpark-only functions are clearly labelled "PySpark Only" in the palette and cannot be added to a pushdown segment.

---

## 10. Code Generation Rules

### 10.1 Per-Segment Code Generation

The code generator produces **separate, optimised code per execution segment:**

| Segment Type | Generated Artefact |
|---|---|
| Source DB Pushdown | A single SQL SELECT statement tailored to the source technology's dialect |
| PySpark Segment | PySpark DataFrame API code or Spark SQL string |
| Cross-Source Join | PySpark join of two DataFrames (each loaded from their respective source SQL) |

### 10.2 Pushdown SQL Generation Rules

- Generated SQL must be syntactically valid for the **exact source technology and version** (e.g., Oracle 19c, PostgreSQL 15).
- The SQL is a single composed query — filters, joins, aggregates, and transforms are composed into one statement to maximise pushdown benefit.
- Only columns required by downstream steps are projected — no `SELECT *`.
- The SQL is tested in a dry-run / EXPLAIN mode against the source before being saved to the pipeline.

### 10.3 PySpark Code Generation Rules

- For steps executing in PySpark, the generator produces PySpark DataFrame API calls chained in sequence.
- Spark SQL strings are used only when the expression cannot be naturally expressed in the DataFrame API.
- Column lineage metadata is preserved in code comments for debugging.

### 10.4 Composite Pipeline Code Structure

The generated pipeline code follows this structure:

```python
# ── SEGMENT A: Oracle Pushdown ─────────────────────────────────────────
oracle_sql = """
    SELECT
        o.order_id,
        TRUNC(o.order_date, 'DD') + INTERVAL '1' MONTH AS order_date_adjusted,
        SUM(i.line_total) AS total_amount
    FROM orders o
    JOIN items i ON o.order_id = i.order_id
    WHERE o.status = 'ACTIVE'
    GROUP BY o.order_id, TRUNC(o.order_date, 'DD')
"""
df_oracle = spark.read.jdbc(url=oracle_url, table=f"({oracle_sql})", properties=oracle_props)

# ── SEGMENT B: PostgreSQL Pushdown ─────────────────────────────────────
pg_sql = """
    SELECT customer_id, customer_name, region
    FROM customers
    WHERE active = true
"""
df_postgres = spark.read.jdbc(url=pg_url, table=f"({pg_sql})", properties=pg_props)

# ── EXECUTION BOUNDARY: Cross-Source Join → PySpark ────────────────────
# Columns from Oracle segment: order_date_adjusted is PYSPARK_DERIVED after join
df_joined = df_oracle.join(df_postgres, df_oracle.customer_id == df_postgres.customer_id, "left")

# ── SEGMENT C: PySpark ─────────────────────────────────────────────────
from pyspark.sql import functions as F

df_final = df_joined.withColumn(
    "order_month_label",
    F.date_format(F.col("order_date_adjusted"), "MMM-yyyy")
)
```

### 10.5 Validation Before Code Emission

Before any code is emitted for save or pipeline application, the system runs:

1. **Function eligibility check** — all steps valid for their execution point.
2. **Lineage consistency check** — no PYSPARK_DERIVED column referenced in a pushdown segment.
3. **Cross-source boundary check** — all cross-source joins are in PySpark segments.
4. **SQL syntax dry-run** — pushdown SQL is EXPLAIN-tested against the source (if connection available).
5. **PySpark syntax check** — generated PySpark code is statically analysed.

If any check fails, code is not emitted and the user is shown a specific, actionable error.

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Metric | Target |
|---|---|
| Eligibility analysis on pipeline graph change | P95 ≤ 100ms |
| Transformation palette load with eligibility filter applied | P95 ≤ 50ms |
| Execution point switch impact preview | P95 ≤ 200ms |
| Full pipeline code generation (all segments) | P95 ≤ 500ms |
| SQL dry-run / EXPLAIN against source | P95 ≤ 2s (async, non-blocking) |

### 11.2 Accuracy

- Lineage tracking must be 100% accurate — no false positives (flagging pushdown-eligible columns as PYSPARK_DERIVED) and no false negatives (missing a lineage break).
- Function capability matrix must be kept current with source DB versions. Version-specific overrides must be configurable without code changes.

### 11.3 Resilience

- If the eligibility analysis service is unavailable, the UI must degrade gracefully: show all steps as "eligibility unknown" and allow the user to proceed with warnings, but block pipeline application until analysis is confirmed.
- If a source DB connection is unavailable for dry-run testing, the SQL syntax check is skipped and a warning is shown. The user can still save but is informed the dry-run was skipped.

### 11.4 Extensibility

- The capability matrix must be data-driven (stored in a configuration file or database table), not hard-coded, so new source technologies can be added without code changes.
- New function primitives must be addable to the matrix without requiring changes to the code generation engine.

---

## 12. Testing Matrix and Acceptance Criteria

### 12.1 Testing Matrix

| Test Type | Scenario |
|---|---|
| **Unit — Eligibility Engine** | Same-source tables → eligible; cross-source → ineligible |
| **Unit — Eligibility Engine** | PySpark-derived column used in pushdown step → lineage break detected |
| **Unit — Eligibility Engine** | Function unsupported in source → palette state correct |
| **Unit — Capability Matrix** | Each function × each source technology → correct availability state |
| **Unit — Code Generator** | Pushdown segment → valid SQL for each source technology |
| **Unit — Code Generator** | PySpark segment → valid PySpark code |
| **Unit — Code Generator** | Composite pipeline → correct segment ordering and JDBC calls |
| **Integration** | Oracle + Oracle → JOIN + AGGREGATE → correct pushdown SQL generated and executes on real Oracle |
| **Integration** | Oracle + PostgreSQL join → boundary detected; two pushdown SQLs + PySpark join generated |
| **Integration** | PySpark override on segment A → downstream segment B locked to PySpark |
| **Integration** | Unsupported function added → alternative suggestion shown correctly |
| **Integration** | LISTAGG on PostgreSQL segment → red badge shown, "Switch to PySpark" offered |
| **Integration** | If/Else on Oracle segment → amber badge shown, "Use Case/When" offered |
| **Regression** | Switch execution point → impact warning shows correct affected columns and steps |
| **Regression** | Add function → change source tech → palette re-filters correctly |
| **Regression** | Remove cross-source join → eligibility re-evaluated correctly |
| **Performance** | Eligibility analysis on 50-node pipeline graph ≤ 100ms P95 |
| **Performance** | Palette load with filter ≤ 50ms P95 |
| **E2E — Happy Path** | Oracle+Oracle join → filter → aggregate → pushdown SQL generated → executes → result correct |
| **E2E — Mixed Path** | Oracle segment → PySpark → join with PostgreSQL → final output correct |
| **Accessibility** | Execution point panel: full keyboard navigation |
| **Accessibility** | Issue resolution banner: screen reader announces all flagged steps |

### 12.2 Acceptance Criteria

The feature is accepted when **all** of the following are verified:

1. **Eligibility detection accuracy:** The system correctly identifies pushdown-eligible segments for 100% of test pipeline configurations in the test suite, with zero false negatives for lineage breaks.

2. **Function enforcement strictness:** No unsupported function can be saved or applied to a pipeline for a pushdown segment on an incompatible source technology. Verified by attempting to add every function marked ❌ in the capability matrix to a pushdown segment for that engine — all must be blocked.

3. **Alternative guidance:** Every function marked ⚠ in the capability matrix correctly presents an alternative suggestion. Verified for all ⚠ entries.

4. **LISTAGG / no-alternative case:** Attempting to add `list_agg` to a PostgreSQL pushdown segment displays the "no alternative" explanation and the "Switch to PySpark" option. Adding to PySpark succeeds.

5. **If/Else on Oracle:** Attempting to add `if_else` to an Oracle pushdown segment presents the "Use Case/When" alternative. The replacement step is added correctly.

6. **Lineage propagation:** Setting any step to PySpark locks all downstream steps referencing that step's output columns to PySpark, with correct lock icons and tooltips. Verified for chains of up to 10 steps.

7. **Cross-source join handling:** A pipeline with Oracle + PostgreSQL tables produces two separate pushdown SQL queries and one PySpark join. Both SQL queries execute on their respective sources without error. The join result is correct.

8. **Code generation validity:** For every segment in the test suite, generated SQL is syntactically valid and executes without error on the target source engine. Generated PySpark code executes without error on a test cluster.

9. **User execution point choice:** User can switch any eligible segment from Source DB to PySpark and vice versa. The impact warning correctly lists all affected downstream columns and steps before the switch is applied.

10. **Save blocking:** The system blocks save and pipeline application when any incompatible step exists. The issue banner lists all incompatible steps with navigation links to each.

11. **Performance targets met:** All metrics in Section 11.1 verified under load testing.

12. **Usability:** A non-technical user presented with an ineligible function scenario (e.g., LISTAGG on PostgreSQL) can successfully resolve it (either switch to PySpark or delete the step) within 2 minutes without assistance, based on the in-UI guidance alone.

---

## 13. Open Questions and Decisions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Should the system support pushdown to the same source technology but **different connections** (e.g., two different Oracle servers)? In v1 the rule is same connection required. | Engineering/Product | Open |
| 2 | Should there be a cost-based automatic pushdown recommendation (e.g., "pushing this aggregate down saves ~3 GB of data movement")? | Product | Deferred v2 |
| 3 | For MySQL regex limitations, what is the exact boundary of `LIKE`-based support we expose vs. requiring PySpark? | Engineering | Open |
| 4 | PostgreSQL `STRING_AGG` vs `LISTAGG` — should we offer `STRING_AGG` as an explicit alternative with a clear behavioural difference note, rather than marking it as "None"? | Product | Open |
| 5 | What source DB **versions** need to be tracked? (e.g., Oracle 12c vs 19c have different `LISTAGG` capabilities). Should version be configurable per connection? | Engineering | Open |
| 6 | Should the dry-run SQL EXPLAIN be mandatory before save, or always advisory? | Product | Open |
| 7 | For `custom_sql` in a pushdown segment — should we validate the SQL against the source DB live, or only do static dialect checking? | Engineering | Open |
| 8 | Should Snowflake `IFF` be presented as the "If/Else" equivalent for Snowflake pushdown, or always guide users to `CASE WHEN` for consistency? | UX | Open |
| 9 | Data movement size estimates in the impact warning — how are these computed? Do we need source table statistics? | Engineering | Open |
| 10 | Should the capability matrix be editable by platform admins via a UI, or only via config file? | Product | Open |

---

*End of Document*

---
> **Document Control:** This document must be updated whenever capability matrix entries, eligibility rules, or source technology support changes. All changes require a version note and author attribution. This document is a companion to the Multi-Transform Component Requirements v1.0.
