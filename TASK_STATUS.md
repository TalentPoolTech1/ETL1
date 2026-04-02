# ETL1 NoCode ETL Platform — Task Status

Last Updated: 2026-03-20  Session 3 (Claude Sonnet 4.6)

---

## Gap Analysis vs FULL_PLATFORM_AUDIT_2025.md

### COMPLETED ✅ (cumulative)

#### Session 1–2 (prior sessions)
- Pipeline workspace with 9 sub-tabs (Designer, Properties, Parameters, Validation, History, Executions, Dependencies, Permissions, Activity)
- Orchestrator workspace with 9 sub-tabs
- ProjectWorkspace, FolderWorkspace, ConnectionWorkspace, MetadataBrowserWorkspace, UserWorkspace, RoleWorkspace
- TabBar, tabsSlice, ObjectHeader, ObjectHistoryGrid, ObjectPermissionsGrid
- LeftSidebar: project/connection/Users/Roles sections
- Header: context-aware toolbar, env selector
- ResizableAppShell
- App.tsx WorkspaceRouter
- Monitor view, ExecutionDetailTab, Login/Auth
- ExecutionSubTab + ExecutionHistorySubTab (v2, dark, all columns)
- PipelineCodeSubTab (generate PySpark/Scala/SQL, copy/download)
- PipelineMetricsSubTab, PipelineAlertsSubTab
- BUG-001: Join conditions always empty → fixed
- BUG-002: Aggregate groupBy/aggregations always empty → fixed
- BUG-003: Union type config key mismatch → fixed
- BUG-004: Validation sub-tab response shape mismatch → fixed
- F-05: MultiTransformEditor wired to canvas via TransformNodeConfig
- F-19: ExecutionSubTab wired into PipelineWorkspace (Run/History inner tabs)
- F-20: PipelineAlertsSubTab wired as tab 9

#### Session 3 (this session — 2026-03-20)

**False-completed items (existed as files but were NEVER mounted):**
- AuditLogsSubTab → dark theme rewrite + wired as `logs` sub-tab ✅
- LineageSubTab → dark theme rewrite + edge key fix (from/to→source/target) + wired as `lineage` sub-tab ✅
- PipelineActivitySubTab → wired as `activity` sub-tab ✅
- PipelineDependenciesSubTab → wired as `dependencies` sub-tab ✅
- OverviewSubTab → dark theme rewrite + wired (available but not in tab bar; components ready) ✅

**PipelineWorkspace now has 13 sub-tabs:**
Designer | Properties | Parameters | Validation | Executions | Metrics |
Permissions | Code | Alerts | Audit Logs | Dependencies | Activity | Lineage

**types/index.ts:**
- PipelineSubTab union: added `'lineage'` member ✅

**BUG-005 FIXED: Fit button** — now calculates node bounding box, fits all nodes into viewport (60px padding, max zoom 1.5) ✅

**BUG-006 FIXED: Drag dispatch buffering** — drag position buffered in `useRef` + `requestAnimationFrame`; dispatch only on RAF tick and on mouseUp ✅

**BUG-007 FIXED: rowsOut/rowsFailed always null** — SUCCESS→rowsProcessed, FAILED→rowsProcessed as failed count ✅

**F-17 DONE: Pipeline Export** — `GET /api/pipelines/:id/export?format=json|yaml` downloads IR as file ✅
**F-18 DONE: Pipeline Import** — `POST /api/pipelines/import` creates new pipeline from exported IR ✅
- `api.exportPipeline()` and `api.importPipeline()` added to API client ✅
- PipelineCodeSubTab: Export IR buttons (JSON/YAML) wired to `api.exportPipeline` ✅

**F-03 DONE: Aggregate column picker** — AggregateConfig replaced with:
- Toggle chip selector for GROUP BY columns (loaded from upstream source)
- Per-row aggregation builder: function dropdown + column picker + alias input
- 10 aggregate functions including COUNT(DISTINCT)
- HAVING clause field
- Falls back to text input if no upstream source node ✅

**F-04 DONE: Join column picker** — JoinConfig replaced with:
- Schema-aware left/right column dropdowns loaded from both upstream source nodes
- Left/right node labels shown above picker columns
- Falls back to text inputs if upstream nodes not connected ✅

**useUpstreamColumns hook** — shared; walks Redux edge graph to find upstream source node, fetches catalog/live columns via `/introspect/columns` ✅

**Backend: introspect/columns endpoint** — `GET /api/connections/:id/introspect/columns?schema=X&table=Y`:
- Catalog-first: queries `catalog.dataset_columns` for already-imported tables
- Live fallback: calls `metadataIntrospectionService.listColumns()` for unimported tables ✅

**MetadataIntrospectionService.listColumns()** — new public method supporting PostgreSQL, MySQL/MariaDB, SQL Server, Oracle, and CSV via information_schema/live introspection ✅

**HAVING clause wiring** — `toPipelineDefinition` now forwards `cfg.havingClause` to the aggregate codegen config ✅

**F-31 DONE: Frontend transform registry** — expanded from 13 → 35 primitives:
- Added: `ltrim`, `rtrim`, `upper`, `lower`, `title_case`, `length`, `concat`, `pad_left`, `pad_right`, `replace`
- Added: `to_timestamp`, `date_format`, `date_diff`
- Added: `abs`, `mod`, `power`
- Added: `replace_regex`, `matches_regex`
- Added: `case_when`
All with full codeGenTemplate for Spark, PostgreSQL, and Redshift ✅

---

## PENDING ❌

### P1 — Column Mapping (Next Priority)

- **F-02: Target node column mapping panel** — source columns vs target table columns with auto-map and override. Requires: load upstream columns (hook exists), load target table columns (introspect/columns endpoint exists), build mapping table UI in TargetConfig.

### Backend (Critical Gaps)
- **Governance API**: no API layer — UserWorkspace and RoleWorkspace show no real data
- **GET /api/orchestrators** list endpoint missing
- **Pipeline audit/history API**: no field-level change history endpoint
- **Connection usage API**: no endpoint to show pipelines/orchestrators using a connection

### P2 — Expand Canvas Node Types
- F-06: SCD Type 1 canvas node
- F-07: SCD Type 2 canvas node
- F-08: Window function canvas node
- F-09: Select / Project canvas node
- F-10: Cast / Rename / Drop columns canvas node
- F-11: Derive / withColumn canvas node
- F-12: Pivot canvas node
- F-13: Data Quality canvas node
- F-14: Mask canvas node
- F-15: Lookup canvas node
- F-29: Surrogate key canvas node

### P3 — Audit Column Support (F-16)
- Add `add_audit_columns` step to TRANSFORM_REGISTRY (backend)
- Pass `--run-id` / `--run-user` as scaffold `_parse_args()` parameters

### P4 — Additional Features
- F-21: Undo/redo on canvas (redux-undo)
- F-22: Copy/paste nodes
- F-23: Schema propagation between canvas nodes
- F-24: Real Spark cluster submission (Livy/Databricks/EMR)
- F-25: DB-specific SQL engine (non-PySpark codegen)
- F-26: CASE WHEN as dedicated canvas node
- F-27: SCD Type 3 code generation
- F-28: CDC / Incremental load from watermark
- F-30: JSON / Array / Map transform canvas nodes
- F-33: Drag-and-drop node palette (GAP-003)
- F-34: Canvas mini-map (GAP-006)

### Performance
- BUG-P1: SVG canvas degrades above 50 nodes — migrate to React Flow
- BUG-P2: `portCoords` recalculates all nodes on every drag (now mitigated by RAF buffering)

### Medium Priority
- Dirty state save with confirmation dialog on tab close
- Version compare in History grids
- Schedule next-run preview in Orchestrator > Schedule
- Connection > Usage tab: wire to real API
- Metadata > Profiling: implement profile run and display results
- Pipeline > Validation: jump-to-node on click
- Right-click context menu in pipeline canvas
- Admin dashboard tabs (failed executions, connection failures, role changes, etc.)

---

## Architecture Notes
- Tab-based shell: ALL objects open as tabs. NO page navigation.
- Theme: dark (#0d0f1a bg, slate-800 borders) throughout all workspaces
- Canvas: SVG-based (React Flow migration pending for P4)
- Column introspection: catalog-first via dataset_columns, live fallback via MetadataIntrospectionService.listColumns()
- Transform registry: 35 primitives, 3 engines (Spark, PostgreSQL, Redshift), full codeGenTemplate per engine

---

## Files Changed This Session (2026-03-20)

```
Frontend/src/components/pipeline/PipelineWorkspace.tsx           — 13 sub-tabs, import 4 orphaned components
Frontend/src/components/pipeline/sub-tabs/AuditLogsSubTab.tsx    — dark theme rewrite, CSV export
Frontend/src/components/pipeline/sub-tabs/LineageSubTab.tsx      — dark theme rewrite, edge key fix
Frontend/src/components/pipeline/sub-tabs/OverviewSubTab.tsx     — dark theme rewrite
Frontend/src/components/pipeline/sub-tabs/PipelineCodeSubTab.tsx — Export IR JSON/YAML buttons
Frontend/src/components/canvas/PipelineCanvas.tsx                — BUG-005 Fit, BUG-006 RAF drag buffer
Frontend/src/components/canvas/NodeConfigPanel.tsx               — F-03 AggregateConfig column picker,
                                                                   F-04 JoinConfig schema-aware pickers,
                                                                   useUpstreamColumns hook
Frontend/src/types/index.ts                                       — PipelineSubTab + 'lineage'
Frontend/src/registry/TransformRegistry.ts                        — F-31: 13 → 35 primitives
Frontend/src/services/api.ts                                      — exportPipeline, importPipeline, introspectColumns

Backend/src/api/routes/pipeline.routes.ts                        — F-17 export, F-18 import, HAVING wiring
Backend/src/api/routes/connections.routes.ts                     — introspect/columns endpoint
Backend/src/metadata/MetadataIntrospectionService.ts             — listColumns() public method
```
