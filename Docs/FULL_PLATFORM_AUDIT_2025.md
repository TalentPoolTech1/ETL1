# ETL1 Platform — Full Audit Report (Updated)
**Date:** 2025  
**Auditor:** Claude — every source file read, no assumptions from filenames  
**Scope:** Frontend (React/Vite/TypeScript), Backend (Node.js/Express/TypeScript), Codegen Engine, Browser Performance, UI Consistency, Execution Engine, NoCode Completeness, Transformation Coverage, Audit Column Support  
**Revision:** 7 — BUG-001–004/007 ✅ | F-02/F-05/F-06–F-15/F-16/F-17/F-18/F-19/F-20/F-23/F-29/F-32–F-35 ✅ | Permission inheritance ✅ | Sub-tabs fully wired ✅

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
| Transform node: per-column step sequences via MultiTransformEditor | `NodeConfigPanel.tsx` | ✅ WIRED |

### 1.2 Critical NoCode Gaps

#### GAP-001: Transform node (custom_sql type) requires manual SQL
**Severity: HIGH** (reduced from CRITICAL — `transform` node type is now wired to MultiTransformEditor)

The `custom_sql` node type still renders a raw `<textarea>`. The `transform` node type now uses `TransformNodeConfig` → `MultiTransformEditor` with step-based GUI. GAP remains only for users who explicitly choose `custom_sql`.

#### ~~GAP-002: MultiTransformEditor is built but completely orphaned~~ ✅ FIXED

`MultiTransformEditor.tsx` is now wired into `NodeConfigPanel.tsx` via `TransformNodeConfig` for the `transform` node type. The config panel shows a list of per-column transform sequences with Add/Edit/Delete. The editor opens as an absolute overlay within the aside panel. Config serialises as `cfg.transformSequences` (JSON). The backend `PySparkMultiTransformGenerator` reads `transformSequences` and is now reachable from the canvas.

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

### 2.1 Transformation Classification

**Scalar / Pass-Through Transforms** — no column-mapping UI needed:

| Transform Type | Needs Column Mapping? | Reason |
|---|---|---|
| Filter | ✅ WIRED | Passes all columns through; only row selection changes |
| Dedup | ✅ WIRED | Optional column subset selector |
| Sort / OrderBy | ✅ WIRED | Multi-column sort with asc/desc/nulls-first |
| Limit / Sample | ✅ WIRED | Limit: row count; Sample: fraction+seed+replacement |
| Cache / Repartition | ✅ WIRED | Cache: storage level + eager; Repartition: partitions + strategy + columns |
| FillNA / DropNA | ✅ WIRED | FillNA: global or per-column; DropNA: any/all + column subset |
| Data Quality | ✅ WIRED | DQ rules + failureAction + quarantinePath |

**Projector / Selector Transforms** — require column mapping GUI:

| Transform Type | Needs Column Mapping? | What User Must Specify |
|---|---|---|
| Select | ✅ YES | Pick which source columns to project; add expressions with aliases |
| Rename | ✅ YES | Old name → new name mappings |
| Cast | ✅ YES | Column + target data type pairs |
| Drop | ✅ YES | Which columns to remove |
| Derive / withColumn | ✅ YES | New column name + expression |
| Aggregate | ✅ YES — CRITICAL | GROUP BY column picker + aggregate function + alias per output column |
| Window | ✅ YES — CRITICAL | PARTITION BY + ORDER BY + window function + output alias |
| Join | ✅ YES — CRITICAL | Left key ↔ Right key pairs |
| Union | ✅ YES (schema alignment) | Column alignment between datasets |
| Pivot | ✅ YES — CRITICAL | Group-by + pivot column + aggregation columns |
| Unpivot | ✅ YES — CRITICAL | ID columns + value columns + output column names |
| Explode | ✅ YES | Array column to explode + output alias |
| Flatten | ✅ YES | Which struct columns to flatten |
| Mask | ✅ YES | Column + masking strategy pairs |
| Lookup | ✅ YES — CRITICAL | Source key ↔ lookup key; return columns |
| SCD Type 1 | ✅ YES — CRITICAL | Business key columns + columns to update |
| SCD Type 2 | ✅ YES — CRITICAL | Business keys + tracked columns + effective/end date columns |
| Surrogate Key | ✅ YES | Output column name + strategy |
| MultiTransform | ✅ YES — per column | Column selection + step sequence |

### 2.2 Current State — Target Node Column Mapping Gap

The Target node configuration shows Connection → Schema → Table dropdowns, but **zero column-level mapping**. There is no UI to see source columns, see target table columns, map them, handle mismatches, or exclude unwanted columns.

Minimum viable: a column mapping table populated from (a) upstream node schema and (b) target table introspection, with auto-map where names match and the ability to override individual mappings.

### 2.3 Schema Propagation — Root Cause

The canvas has no schema propagation — each node only knows its own config. Column pickers require one of: live schema inference (correct enterprise approach), manual schema declaration, or schema from metadata catalog. The metadata catalog already stores column-level schema (`getProfile(datasetId)` returns columns). The gap is that the canvas does not consume this data.

---

## 3. MULTI-TRANSFORM COMPONENT

### 3.1 Orphaned Components Status

| File | Purpose | Wired to Canvas? |
|---|---|---|
| `MultiTransformEditor.tsx` | Full multi-step editor with version history | ✅ WIRED — via TransformNodeConfig in NodeConfigPanel (transform node type) |
| `TransformStepEditor.tsx` + `StepList` | Individual step editor with registry picker | ✅ Used internally by MultiTransformEditor |
| `TransformationBuilder.tsx` | High-level builder | ✅ WIRED — opens as overlay in NodeConfigPanel `custom_sql` node (TransformConfig) |
| `ConditionBuilder.tsx` | Condition/predicate builder | ✅ WIRED — toggle in NodeConfigPanel FilterConfig; output written to `config.expression` via `conditionToSQL()` |
| `ParameterPanel.tsx` | Parameter input per transform type | ✅ WIRED — used internally by `TransformStepEditor` |
| `PatternWizard.tsx` | Pattern-based transform wizard | ✅ WIRED — "Pattern Library" button in `TransformNodeConfig`; on complete inserts new `regex_extract` TransformSequence |
| `PushdownStrategyEditor.tsx` | Pushdown configuration | ✅ WIRED — rendered in `OptimizeSubTab` |

### 3.2 Frontend Transform Registry — 13 Primitives (gap vs 35 backend)

**Convert:** `to_number`, `to_date`, `cast` | **Text:** `substring`, `trim` | **Datetime:** `trim_timestamp`, `date_add` | **Numeric:** `round`, `floor`, `ceil` | **Regex:** `regex_extract` | **Conditional/Null:** `coalesce`, `null_if` | **Custom:** `custom_sql`

Missing from frontend but backend handles: `ltrim`, `rtrim`, `upper`, `lower`, `title_case`, `length`, `concat`, `pad_left`, `pad_right`, `to_timestamp`, `date_format`, `date_diff`, `replace_regex`, `matches_regex`, `abs`.

### 3.3 Backend Multi-Transform Support

`PySparkMultiTransformGenerator` handles `multi_transform_sequence` nodes with 35 step types. Now reachable from the canvas via `transform` node → `TransformNodeConfig` → `MultiTransformEditor`.

### 3.4 Theme Collision — ✅ FIXED

`MultiTransformEditor.tsx` dark-themed. All `bg-white`, `bg-gray-*`, `text-gray-*`, `border-gray-*` classes replaced with dark equivalents (`bg-[#0d0f1a]`, `bg-[#1e2035]`, `text-slate-*`, `border-slate-*`). Title font normalised to 18px.

---

## 4. TRANSFORMATION COVERAGE — DWH AND CLOUD ETL COMPLETENESS

### 4.1 PySpark Codegen Engine — Full Inventory

**A. Row-Level / Scalar Transforms**

| Operation | Codegen | Canvas | Notes |
|---|---|---|---|
| Row filter | ✅ PySparkFilterGenerator | ✅ | SQL expr only |
| Column selection | ✅ PySparkSelectGenerator | ❌ | Via MultiTransform only |
| Column rename | ✅ | ❌ | |
| Type cast | ✅ | ❌ | |
| Drop columns | ✅ | ❌ | |
| Derive / withColumn | ✅ | ❌ | |
| NULL fill / replace | ✅ | ✅ WIRED | `fillna` node → FillNAConfig (global or per-column mode) |
| Drop rows with NULLs | ✅ | ✅ WIRED | `dropna` node → DropNAConfig (any/all + column subset) |
| Deduplication | ✅ | ✅ WIRED | `dedup` node → DedupConfig (optional column subset) |
| Sort | ✅ | ✅ WIRED | `sort` node → SortConfig (multi-column, asc/desc, nulls first) |
| Limit / Sample | ✅ | ✅ WIRED | `limit` node → LimitConfig; `sample` node → SampleConfig (fraction/seed/replacement) |
| Multi-step column transforms | ✅ | ✅ WIRED | `transform` node → MultiTransformEditor |

**B. Set / Structural Operations**

| Operation | Codegen | Canvas | Notes |
|---|---|---|---|
| All JOIN types | ✅ | ✅ | ✅ BUG-001 FIXED |
| Broadcast JOIN hint | ✅ | ⚠️ | No GUI for hint |
| UNION ALL / UNION | ✅ | ✅ | ✅ BUG-003 FIXED |
| INTERSECT / EXCEPT | ❌ | ⚠️ | UI present, no codegen; unionType preserved |
| Lookup | ✅ | ❌ | |

**C. Aggregation and Analytics**

| Operation | Codegen | Canvas | Notes |
|---|---|---|---|
| GROUP BY + all aggregate functions | ✅ | ✅ | ✅ BUG-002 FIXED |
| HAVING clause | ✅ | ✅ | Not exposed in NodeConfigPanel UI |
| All Window functions | ✅ | ❌ | |
| Pivot / Unpivot | ✅ | ❌ | |

**D–F. Data Quality, Advanced, DWH** — see Section 4.1 in previous revisions. All production-grade in PySpark engine; none have canvas nodes.

### 4.2 Gaps for Full DWH / Cloud ETL Coverage

Missing: string ops (`replace`, `split`, etc.), numeric ops (`mod`, `power`, etc.), date functions, timestamp functions, JSON ops, array/map ops, CASE WHEN, string distance, generate series, watermark/CDC, INTERSECT/EXCEPT codegen, SCD Type 3, Type 6. Full list in Revision 4 of this document.

---

## 5. AUDIT COLUMN SUPPORT

**SCD2 audit columns** — fully implemented in `PySparkScdType2Generator`. ✅

**Pipeline run ID, load timestamp, loading user, source system** — ✅ FIXED. `--run-id` and `--run-user` scaffold args wired. `PySparkAddAuditColumnsGenerator` registered as `add_audit_columns` transformation type. Canvas toolbar "Audit" node added. NodeConfigPanel config section (column name overrides + source toggle). `pipeline.routes.ts` IR translation added. `TransformationType` union extended.

---

## 6. EXPORT AND IMPORT FACILITY

Downloads of generated code and execution history CSV work. Pipeline IR export/import as JSON/YAML does not exist — no endpoint, no UI. ❌

---

## 7. CODE GENERATION ENGINE

### 7.1 PySpark Engine — Confirmed Production-Grade (unchanged from Rev 4)

### 7.2 Canvas → Codegen Node Type Mapping

| Canvas Node | Maps To | Status |
|---|---|---|
| `transform` | `multi_transform_sequence` (if sequences present) else `custom_sql` | ✅ MultiTransform NOW REACHABLE |
| `filter` | `filter` | ✅ |
| `join` | `join` with `parseJoinConditions(cfg)` | ✅ BUG-001 FIXED |
| `aggregate` | `aggregate` with `parseGroupByColumns` + `parseAggregations` | ✅ BUG-002 FIXED |
| `union` | `union` with correct `byName`/`allowMissingColumns`/`unionType` | ✅ BUG-003 FIXED |
| `source` | `source` with URL resolution | ✅ |
| `target` | `sink` | ⚠️ SCD write modes not wired to SCD generators |

### 7.3–7.5 Remaining gaps: SQL engine fallback, SCD nodes unreachable from canvas, INTERSECT/EXCEPT no codegen. (Unchanged from Rev 4)

---

## 8–10. ON-PREM/CLOUD, PERFORMANCE, UI CONSISTENCY (Unchanged from Rev 4)

Performance: SVG canvas degrades above 50 nodes; Redux drag dispatch on every mousemove; portCoords recalculates all nodes on drag.

UI: Font sizes inconsistent (8px–18px); `globals.css` CSS variables unused by all components except MultiTransformEditor (now fixed); canvas node Unicode emoji vs Lucide SVG icons.

---

## 11. EXECUTION / JOB TRIGGER ENGINE

Execution is 100% simulated — `simulateExecution()` always reports SUCCESS, never calls codegen or submits to cluster. `/generate` and `/run` are independent code paths.

ExecutionSubTab ✅ WIRED inside `ExecutionsSlot` in `PipelineWorkspace` with Run/History inner toggle.

No real cluster integration, no WebSocket/SSE for live logs, no environment-level connection override.

---

## 12. ADDITIONAL ORPHANED COMPONENTS

Sub-tabs wired: `ExecutionSubTab` (Run/History inner tabs) ✅, `PipelineAlertsSubTab` (tab 9 "Alerts") ✅

~~Still not mounted: `AuditLogsSubTab`, `LineageSubTab`, `OverviewSubTab`, `PipelineActivitySubTab`, `PipelineDependenciesSubTab`, `OptimizeSubTab`.~~ ✅ ALL WIRED — Overview, Optimize, AuditLogs, Lineage, Activity, Dependencies all mounted in PipelineWorkspace. `overview` and `optimize` added to `PipelineSubTab` type.

---

## 13. CODE-LEVEL BUGS

| Bug | Status |
|---|---|
| BUG-001: Join conditions always empty → Cartesian product | ✅ FIXED |
| BUG-002: Aggregate groupBy/aggregations always empty → invalid PySpark | ✅ FIXED |
| BUG-003: Union type used wrong config key | ✅ FIXED (v2 — corrected logic: UNION→.distinct(), UNION_BY_NAME→unionByName(), UNION_ALL→union()) |
| BUG-004: Validation sub-tab response shape mismatch | ✅ FIXED |
| BUG-005: "Fit" button resets to origin, not node bounds | ✅ FIXED (canvas calculates node bounds) |
| BUG-006: Redux dispatch on every mousemove during drag | ✅ FIXED (RAF buffer) |
| BUG-007: Execution rows out/failed always null | ✅ FIXED — simulateExecution INSERTs pipeline_node_runs with real rows_in_num/rows_out_num |

---

## 14. FEATURE GAPS SUMMARY TABLE

| # | Feature | Canvas | Codegen | Backend | Status |
|---|---|---|---|---|---|
| F-01 | Drag-and-drop node palette | ❌ | N/A | N/A | OPEN |
| F-02 | Column mapping: Target node column selector | ✅ | N/A | N/A | ✅ FIXED — ColumnMappingPanel with auto-map + overrides |
| F-03 | Column picker: Aggregate GROUP BY + function GUI | ✅ | ✅ | ✅ | ✅ FIXED |
| F-04 | Column picker: Join key visual selector | ✅ | ✅ | ✅ | ✅ FIXED |
| F-05 | Multi-transform editor wired to canvas | ✅ | ✅ | ✅ | ✅ FIXED |
| F-06 | SCD Type 1 canvas node | ✅ | ✅ | ✅ | ✅ FIXED |
| F-07 | SCD Type 2 canvas node | ✅ | ✅ | ✅ | ✅ FIXED |
| F-08 | Window function canvas node | ✅ | ✅ | ✅ | ✅ FIXED |
| F-09 | Select / Project canvas node | ✅ | ✅ | ✅ | ✅ FIXED |
| F-10 | Cast / Rename / Drop columns canvas node | ✅ | ✅ | ✅ | ✅ FIXED |
| F-11 | Derive / withColumn canvas node | ✅ | ✅ | ✅ | ✅ FIXED |
| F-12 | Pivot canvas node | ✅ | ✅ | ✅ | ✅ FIXED |
| F-13 | Data Quality canvas node | ✅ | ✅ | ✅ | ✅ FIXED |
| F-14 | Mask canvas node | ✅ | ✅ | ✅ | ✅ FIXED |
| F-15 | Lookup canvas node | ✅ | ✅ | ✅ | ✅ FIXED |
| F-16 | Audit columns (load_ts, run_id, user) injection | ✅ | ✅ | ✅ | ✅ FIXED |
| F-17 | Pipeline export to JSON/YAML | ✅ | N/A | ✅ | ✅ FIXED — Export button in PipelineWorkspace header |
| F-18 | Pipeline import from JSON/YAML | ✅ | N/A | ✅ | ✅ FIXED — Import file picker in PipelineWorkspace header |
| F-19 | ExecutionSubTab wired into PipelineWorkspace | ✅ | N/A | ✅ | ✅ FIXED |
| F-20 | PipelineAlertsSubTab wired | ✅ | N/A | ✅ | ✅ FIXED |
| F-21 | Undo/Redo on canvas | ✅ | N/A | N/A | ✅ FIXED — ring-buffer (past/future max-50) in pipelineSlice; Ctrl+Z/Y + toolbar buttons in PipelineCanvas |
| F-22 | Copy/paste nodes | ✅ | N/A | N/A | ✅ FIXED — clipboard[] in pipelineSlice; Ctrl+C/V handlers + copySelected/pasteClipboard reducers |
| F-23 | Schema propagation between canvas nodes | ✅ | N/A | N/A | ✅ FIXED — BFS walk in useUpstreamColumns + cachedColumns on source node |
| F-24 | Real Spark cluster submission | ❌ | N/A | ❌ | OPEN |
| F-25 | DB-specific SQL engine | ❌ | ❌ | ❌ | OPEN |
| F-26 | CASE WHEN as canvas node | ✅ | ✅ | ✅ | ✅ FIXED — case_when canvas node + CaseWhenConfig + PySparkCaseWhenGenerator + IR translation |
| F-27 | SCD Type 3 code generation | ❌ | ❌ | ❌ | OPEN |
| F-28 | CDC / Incremental load from watermark | ❌ | ❌ | ❌ | OPEN |
| F-29 | Surrogate key canvas node | ✅ | ✅ | ✅ | ✅ FIXED |
| F-30 | JSON / Array / Map transform canvas nodes | ❌ | ❌ | ❌ | OPEN |
| F-31 | Expand frontend transform registry (13 → 35+ types) | ✅ | ✅ | ✅ | ✅ FIXED — TransformRegistry.ts now has 35 primitives (confirmed via grep) |
| F-32 | Fix validation response shape mapping | ✅ | N/A | ✅ | ✅ FIXED |
| F-33 | Fix join conditions key mismatch | N/A | ✅ | ✅ | ✅ FIXED |
| F-34 | Fix aggregate groupBy/aggregations key mismatch | N/A | ✅ | ✅ | ✅ FIXED |
| F-35 | Fix union type config key mapping | N/A | ✅ | ✅ | ✅ FIXED |

---

## 15. PRIORITIZED REMEDIATION ROADMAP

### P0 — All Completed ✅
1. ~~Fix BUG-001 (join conditions)~~ ✅
2. ~~Fix BUG-002 (aggregate mapping)~~ ✅
3. ~~Fix BUG-003 (union type)~~ ✅
4. ~~Fix BUG-004 (validation response shape)~~ ✅
5. ~~Wire ExecutionSubTab into PipelineWorkspace~~ ✅ — ExecutionsSlot with Run/History inner tabs
6. ~~Wire PipelineAlertsSubTab~~ ✅ — tab 9 "Alerts"
7. ~~Wire MultiTransformEditor into NodeConfigPanel~~ ✅ — TransformNodeConfig overlay, sequences list, dark-themed

### P1 — Column Mapping for Projector/Selector Nodes (Next Priority)
8. **Aggregate node column UI** — replace GROUP BY text input and SQL textarea with column picker + aggregation function dropdown table.
9. **Join node column UI** — replace free-text join key inputs with schema-aware left/right column pickers.
10. **Target node column mapping panel** — source columns vs target table columns with auto-map and override.
11. **Schema propagation** — fetch columns after source node configured, cache on node, propagate forward through transforms.

### P2 — Expand Canvas Node Types
12. Add dedicated canvas nodes: Select, Derive, Cast, Rename, Sort, Dedup, FillNA, SCD Type 1, SCD Type 2, Window, Pivot, Data Quality, Mask, Surrogate Key.

### P3 — Audit Column Support ✅ COMPLETE
13. ~~Add `add_audit_columns` step to `TRANSFORM_REGISTRY`~~ ✅
14. ~~Pass `--run-id` and `--run-user` as scaffold `_parse_args()` parameters~~ ✅

### P4 — Export / Import
15. Add `GET /pipelines/:id/export` endpoint returning `ir_payload_json` as download.
16. Add `POST /pipelines/import` endpoint.

### P5 — Transform Registry Expansion
17. Add 15 missing frontend primitives (`ltrim`, `rtrim`, `upper`, `lower`, `title_case`, `length`, `concat`, `pad_left`, `pad_right`, `to_timestamp`, `date_format`, `date_diff`, `replace_regex`, `matches_regex`, `abs`).
18. Add CASE/WHEN conditional, date extraction functions, JSON/Array/Map operations.

### P6 — Performance
19. Buffer drag in `useRef`, dispatch only on `mouseUp`.
20. `React.memo` on node rendering.
21. Migrate canvas to React Flow.

### P7 — Execution Engine
22. Integrate real execution backend (Livy, Databricks, or EMR).
23. Connect code generation to execution path.
24. Add WebSocket/SSE for real-time log streaming.

---

## 16. WHAT IS GENUINELY GOOD IN THE PLATFORM

- PySpark codegen engine is production-grade — 30+ transformation types, SCD 1 and 2, full DWH loading patterns, proper Delta/Iceberg integration, multi-platform scaffold, secrets management integration
- Frontend code generation layer (SparkSQLGenerator, PostgreSQLGenerator, RedshiftCodeGenerator) — multi-engine by design from day one
- Transform IR (`ir.ts`) — versioned, serializable, auditable
- Transform Registry concept (`TRANSFORM_REGISTRY`) — declarative, engine-neutral, with parameter validation
- PostgreSQL backend schema — encrypted credentials, RBAC, execution history, audit logs, versioned pipeline IR
- Source node configuration — real connection introspection, schema/table dropdowns, JDBC URL resolution, file/Kafka/Delta/Iceberg support
- Execution history sub-tab — pagination, filters, CSV export, bulk retry/cancel
- LeftSidebar hierarchical tree — lazy loading, inline rename, folder nesting, global vs project scope separation
- MultiTransformEditor is now wired — `transform` nodes can produce structured step-based codegen via the GUI

The gap is not that the foundation is poor — it is that the canvas UI has not yet been fully connected to the powerful engine that already exists behind it.

---

*End of audit. Revision 7. All P0–P4 items complete. Canvas now has 20 node types (up from 9). Schema propagation wired. Export/Import working. Sub-tabs fully mounted. Remaining open: F-01 (drag palette), F-21 (undo/redo), F-22 (copy/paste), F-26 (CASE WHEN), F-27 (SCD3), F-28 (CDC), F-30 (JSON/Array/Map), F-31 (transform registry expansion), INTERSECT/EXCEPT codegen.*
