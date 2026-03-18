# ETL1 Platform — Full Implementation Audit Report
## Part 3 of 3: Logging Audit + Severity Defect List + CRUD Matrix + Remediation Backlog

---

## 7. LOGGING AUDIT REPORT

### 7.1 Logging Infrastructure

The platform uses a `LoggerFactory.get('module')` custom logger. Evidence:
- `projects.routes.ts` imports `LoggerFactory` but never calls `log.*` in any route handler
- `governance.routes.ts` imports `log` and uses it for role assign/revoke only
- `auth.routes.ts` uses `log.warn` on login failure, `log.info` on success — **best logging in codebase**
- `connections.controller.ts` has NO logging calls
- `pipeline.routes.ts` has NO logging calls whatsoever
- `executions.routes.ts` has NO logging calls

### 7.2 Action-Wise Logging Coverage

| Module | Action | API Entry Log | Business Logic Log | DB Call Log | Success Log | Failure Log | User/Object ID Logged | Status |
|---|---|---|---|---|---|---|---|---|
| Auth | Login | N | N | N | Y (log.info) | Y (log.warn) | Y (userId) | PARTIAL |
| Auth | Change password | N | N | N | Y | N | Y (userId) | PARTIAL |
| Project | Create | N | N | N | N | N | N | MISSING |
| Project | Update | N | N | N | N | N | N | MISSING |
| Project | Delete | N | N | N | N | N | N | MISSING |
| Folder | Create | N | N | N | N | N | N | MISSING |
| Folder | Delete | N | N | N | N | N | N | MISSING |
| Pipeline | Create | N | N | N | N | N | N | MISSING |
| Pipeline | Save/Version | N | N | N | N | N | N | MISSING |
| Pipeline | Delete | N | N | N | N | N | N | MISSING |
| Pipeline | Run trigger | N | N | N | N | N | N | MISSING |
| Pipeline | Generate code | N | N | N | N | N | N | MISSING |
| Pipeline | Validate | N | N | N | N | N | N | MISSING |
| Connection | Create | N | N | N | N | N | N | MISSING |
| Connection | Test | N | N | N | N | N | N | MISSING |
| Connection | Update | N | N | N | N | N | N | MISSING |
| Connection | Delete | N | N | N | N | N | N | MISSING |
| Execution | Retry run | N | N | N | N | N | N | MISSING |
| Execution | Cancel run | N | N | N | N | N | N | MISSING |
| Governance | Assign role | Y (log.info) | Y | N | Y | N | Y | GOOD |
| Governance | Revoke role | Y (log.info) | Y | N | Y | N | Y | GOOD |

### 7.3 Key Logging Gaps

1. **No request-level logging**: No middleware logs incoming request method/path/userId for any module except auth. Impossible to trace "who did what when" without DB audit tables alone.

2. **No structured error logging with context**: All route handlers use `next(err)` to delegate to error middleware. The error middleware (not read) may log, but no route-level context (pipelineId, projectId, userId, action) is included in errors.

3. **Run trigger events not logged**: When a user triggers a pipeline run, this is a high-value audit event. No log entry is written. The execution.pipeline_runs table record exists but no application log is emitted.

4. **Permissions changes not logged**: The permission endpoints (which are stubs) have no log calls. When implemented, role/grant changes must be logged with before/after values.

5. **Connection test results not logged**: Security-sensitive operation (tests network connectivity to external systems). Should log outcome with connectorId and userId.

6. **Code generation not logged**: When a user generates PySpark/Scala code, no log entry is written. This is a significant audit event in a regulated ETL platform.

7. **No correlation ID / request ID**: No X-Request-Id header propagation. Impossible to correlate frontend errors to backend logs.

8. **DB audit tables cover DML**: `history.pipelines_history` and `history.orchestrators_history` likely have DB-level triggers capturing INSERT/UPDATE/DELETE. This partially compensates for application-level logging gaps but cannot capture business-level events (run triggered, code generated, test connection executed).

---

## 8. CRUD COMPLETENESS MATRIX

| Object | Create | Read | Update | Rename | Delete | Clone | List/Search | History | Audit Trail | UI Present | API Present | Service | Repository | DB Query | Fully Wired | Partial | Stub | Missing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Project | Y | Y | Y | Y | Y | N | Y | N | DB trigger | Y | Y | None | None | Inline SQL | Y | — | — | Clone, Perms |
| Folder | Y | Y | N | Y | Y | N | Y | N | DB trigger | Y | Y | None | None | Inline SQL | Y | — | — | Update, Clone, Move |
| Pipeline | Y | Y | Y | Y | Y | N | Y | Y (versions) | DB trigger | Y | Y | Partial (ctrl+inline) | pipelineRepository | Inline SQL | Y | Sub-tabs | — | Clone, Schedule, Params, Properties API |
| Orchestrator | Y | Y | Y | Y | Y | N | Y | N | DB trigger | Y | Y | None | None | Inline SQL | Y | Run | — | Clone, Schedule |
| Connection | Y | Y | Y | N | Y | N | Y | N | N | Y | Y | connectionsService | ConnectionsRepository | Via service | Y | Update/Delete UI | — | Rename, Clone |
| Run (Pipeline) | Y (trigger) | Y | Partial (cancel/retry) | N | N | N (retry=new) | Y | Y | N | Y | Y | None | None | Inline SQL | Y | Run engine | — | — |
| Run (Orchestrator) | Y (trigger) | Y | Partial | N | N | N | Y | N | N | Y | Y | None | None | Inline SQL | Y | Run engine | — | — |
| Parameters | N | N | N | N | N | N | N | N | N | Y (UI only) | N | N | N | N | — | — | Y | API, Persistence |
| Alert Rules | N | N | N | N | N | N | N | N | N | Y (UI only) | N | N | N | N | — | — | Y | API, Persistence |
| Properties (extended) | N | N | N | N | N | N | N | N | N | Y (UI only) | N | N | N | N | — | — | Y | API, Persistence |
| Schedule | N | N | N | N | N | N | N | N | N | Button exists | N | N | N | N | — | — | — | Y (entire feature) |
| User | N | Y (API) | N | N | N | N | Y | N | DB trigger | Y (stub) | Partial | None | None | Inline SQL | — | — | Y (UI) | Create, Update, Delete |
| Role | N | Y | N | N | N | N | Y | N | N | Y (list only) | Partial | None | None | Inline SQL | — | PW | — | Create, Update, Delete, Assign UI |
| Permission | N | Stub | Stub | N | N | N | N | N | N | Y (stub) | Stub | None | None | None | — | — | Y | Real Implementation |
| Lineage | N | Stub | N | N | N | N | N | N | N | Y | Stub | None | None | None | — | — | Y | Real Implementation |

---

## 9. SEVERITY-BASED DEFECT LIST

### CRITICAL (Misleads users; data loss; crashes; fake success presented as real)

| ID | Module | Defect | Impact |
|---|---|---|---|
| C-001 | Pipeline/Parameters | PipelineParametersSubTab: zero persistence. Users believe parameters are saved. | Data loss |
| C-002 | Pipeline/Properties | PipelinePropertiesSubTab: all hardcoded. No save. 15+ fake field values. | Misleads users |
| C-003 | Connections | ConnectionsManager crashes on load: `response.data.map is not a function` | Runtime crash |
| C-004 | Governance | GovernanceView displays hardcoded mockUsers array to all users | Shows wrong data |
| C-005 | Governance | UserWorkspace.handleSave is `setTimeout(300)` — fake save with spinner | Fake persistence |
| C-006 | Pipeline/Alerts | PipelineAlertsSubTab init with demo email/Slack. No API. Fake alert management. | Users think alerts are configured |

### HIGH (Feature broken; significant user impact; visible but non-functional)

| ID | Module | Defect | Impact |
|---|---|---|---|
| H-001 | Pipeline | PipelineActivitySubTab: `events = []` forever. Stub comment in code. | Feature unusable |
| H-002 | Pipeline | PipelineDependenciesSubTab: `deps = []` forever. Stub comment. | Feature unusable |
| H-003 | Pipeline | OptimizeSubTab: hardcoded PostgreSQL/Snowflake mock data. | Misleads users |
| H-004 | Pipeline | OverviewSubTab Save: `setEditing(false)` only. No API. | Silent data loss |
| H-005 | Pipeline | OverviewSubTab Schedule/Clone: dead buttons. | Broken UX |
| H-006 | Pipeline | PipelineCodeSubTab: response field mismatch — always shows placeholder. | Feature broken |
| H-007 | Pipeline | Permissions GET/PUT: static stub responses. No DB. | Feature broken |
| H-008 | Pipeline | Lineage: 1-node hardcoded stub. | Feature broken |
| H-009 | Orchestrator | Same permissions stub as pipeline. | Feature broken |
| H-010 | Execution | No execution engine — all runs stay PENDING. | Critical ops gap |
| H-011 | Connection | New Connection button on main page: no onClick. | Dead button |
| H-012 | Connection | ConnectionsManager status hardcoded 'active'. | Misleads users |
| H-013 | Connection | ConnectionsManager lastTested hardcoded to now. | Misleads users |
| H-014 | Connection | Missing updateConnector/deleteConnector Redux thunks. | Actions unavailable |
| H-015 | Governance | UserWorkspace: never loads real user data. Defaults only. | Shows wrong data |
| H-016 | Governance | GovernanceView audit tab: AuditLogsSubTab missing pipelineId prop. | Feature broken |
| H-017 | Dashboard | Compute resource gauges: fake arithmetic formulas. | Misleads operators |
| H-018 | Schedule | Schedule feature entirely absent. Button visible. | Dead feature |
| H-019 | Folder | Sub-folder not reflected in tree after creation. | UI desync |
| H-020 | Folder | Folder-scoped pipeline/orch not reflected after creation. | UI desync |
| H-021 | Folder | Rename does not update ltree path — stale paths in DB. | DB inconsistency |
| H-022 | Sidebar | Global Pipelines/Orchestrators + button is `/* TODO */`. | Dead buttons |
| H-023 | Execution | Run detail: `nodes:[]` always — hardcoded empty array. | Missing data |
| H-024 | Governance | UserWorkspace Reset Password: no onClick. | Dead button |
| H-025 | Governance | UserWorkspace Deactivate: no onClick. | Dead button |
| H-026 | Dashboard | `kpis.activePipelines` field missing from KPI query. | Always shows 0 |

### MEDIUM (Incomplete; degrades UX; incorrect data shown)

| ID | Module | Defect | Impact |
|---|---|---|---|
| M-001 | Dashboard | Data Freshness hardcoded 92.5. | Fake metric |
| M-002 | Execution | KPI: unused `projectFilter` variable (dead code). | Code quality |
| M-003 | Pipeline | ExecutionSubTab: static 5-step timeline, not real pipeline structure. | UX mismatch |
| M-004 | Pipeline | Controller duality: ctrl methods unreachable for inline routes. | Dead code |
| M-005 | Project | DELETE /api/projects: no row-count check — silent success on missing. | Incorrect response |
| M-006 | Connection | Missing user-level update/delete thunks for connection workspace. | Feature gap |
| M-007 | Auth | JWT expires 8h with no refresh mechanism. | Session drops |
| M-008 | Settings | Interface density / sidebar behavior: no persistence. | UX regression |
| M-009 | Settings | Notification preferences: no persistence. | Feature incomplete |
| M-010 | Lineage | No cross-pipeline / platform-wide lineage. | Feature incomplete |

### LOW (Minor issues; code quality; edge cases)

| ID | Module | Defect | Impact |
|---|---|---|---|
| L-001 | Pipeline | Ctrl methods (create/getById/update/delete) shadowed by inline handlers. | Dead code |
| L-002 | Execution | KPI dead variable `projectFilter` never used. | Code smell |
| L-003 | Settings | "Manage Personal Access Tokens" button: no onClick. | Dead button |
| L-004 | Logging | No request-level logging middleware for any module. | Ops gap |
| L-005 | Logging | No correlation IDs propagated. | Debug difficulty |

---

## 10. FIX RECOMMENDATIONS

| Priority | Defect ID | Root Cause | Exact Fix Area | Dependency / Ripple Effect |
|---|---|---|---|---|
| 1 | C-003 | Wrong response mapping in ConnectionsManager | `ConnectionsManager.tsx` line 28: change `response.data.map` to `response.data.data.map` | None — isolated 1-line fix |
| 2 | C-001 | No parameters API + no persistence | Create `GET/POST/DELETE /api/pipelines/:id/parameters` → new DB table `catalog.pipeline_parameters` → Redux thunk → PipelineParametersSubTab load/save | DB migration + new route + thunk + component update |
| 3 | C-002 | Properties fields all hardcoded; no save | Create `GET/PUT /api/pipelines/:id/properties` for owner/tags/labels/retryPolicy/timeout/loggingLevel → new columns or JSONB in catalog.pipelines → PipelinePropertiesSubTab onDirty + save handler | DB migration + API |
| 4 | C-004 | GovernanceView uses mockUsers | Replace `const mockUsers = [...]` with `useEffect(() => { api.getUsers()... })` and bind to real API response | None — isolated to GovernanceView.tsx |
| 5 | C-005 | UserWorkspace handleSave fake | Implement `PUT /api/governance/users/:id` endpoint → `handleSave` calls it | New API endpoint |
| 6 | C-006 | AlertsSubTab: no API | Create `GET/POST/DELETE /api/pipelines/:id/alerts` → new `catalog.pipeline_alerts` table → bind component | DB migration + new route |
| 7 | H-011 | ConnectionsManager New Connection no onClick | Add `onClick={() => dispatch(openCreateConnection())}` to button in ConnectionsManager | 1-line fix |
| 8 | H-004 | OverviewSubTab Save: no API call | In Save handler: add `await api.savePipeline(pipelineId, { pipelineDisplayName: draftName, pipelineDescText: draftDesc })` | None |
| 9 | H-005 | Schedule/Clone dead buttons | Add `openScheduleDialog` and `openCloneDialog` dispatches; create dialogs + API endpoints | Large feature |
| 10 | H-006 | PipelineCodeSubTab field mismatch | In PipelineCodeSubTab: change `d.generatedCode ?? d.code` to `d.artifact?.files?.find(f => f.isEntryPoint)?.content ?? d.preview` | 1-line fix once code path confirmed |
| 11 | H-009/H-007 | Permissions stubs | Create `gov.pipeline_permissions` and `gov.orchestrator_permissions` tables → real GET/PUT | DB migration + route rewrite |
| 12 | H-008 | Lineage stub | Implement lineage service that queries `execution.pipeline_runs` + `pipeline_node_runs` to build graph; update lineage route | New service |
| 13 | H-010 | No execution engine | Build execution worker service: poll `execution.pipeline_runs WHERE run_status_code='PENDING'`, submit to Spark, update status | Major new service |
| 14 | H-019 | Sub-folder not in tree after create | In `projectsSlice.ts` `createFolder.fulfilled`: emit a custom event or add sub-folder to parent FolderNode via React context/callback | Needs FolderNode refactor or context pattern |
| 15 | H-020 | Folder-scoped pipeline not in tree | Same as above — propagate new pipeline to FolderNode local state via callback or React context | Same refactor |
| 16 | H-021 | Folder rename: ltree not updated | In `PUT /api/folders/:id/rename`: after updating display name, also update `hierarchical_path_ltree` and all children paths using ltree UPDATE | Complex — requires recursive ltree update |
| 17 | H-015/GOV-003 | UserWorkspace loads no data | Add `useEffect(() => { api.getUser(tab.objectId).then(...populate formData) }, [tab.objectId])` | Also needs GOV API endpoint for user detail |
| 18 | H-016/GOV-004 | GovernanceView audit tab: no pipelineId | Create a separate `SystemAuditLogsSubTab` component that calls a new `GET /api/audit/system-logs` endpoint | New component + endpoint |
| 19 | H-001/H-002 | Activity + Dependencies always empty | H-001: Wire to AuditLogsSubTab or create `/api/pipelines/:id/activity`; H-002: Wire to lineage service once built | Depends on H-012 for dependencies |
| 20 | H-003 | OptimizeSubTab hardcoded | Replace `const mockSequence` with selector: `const nodes = useAppSelector(s => s.pipeline.nodes)` + convert to TransformSequence | Component change only |
| 21 | H-017 | Dashboard fake compute gauges | Replace with real metrics endpoint (Prometheus/Spark REST) or remove gauges | Infrastructure dependency |
| 22 | H-018 | Schedule feature missing | Implement full schedule CRUD: `catalog.pipeline_schedules` table + CRUD routes + dialog UI + cron integration | Major new feature |
| 23 | H-022 | Global Pipeline/Orch + buttons TODO | Replace `/* TODO */` with `dispatch(openCreatePipeline({projectId:null}))` and load data on expand | 2 one-line fixes |
| 24 | H-026 | activePipelines missing from KPI | Add `COUNT(DISTINCT p.pipeline_id) FILTER (WHERE pr.run_status_code='RUNNING') AS active_pipelines` to KPI query | 1 SQL addition |
| 25 | M-007 | JWT no refresh | Implement `POST /api/auth/refresh` with refresh token mechanism | Auth system extension |

---

## 11. FINAL VERDICT

### Production-Ready Modules

| Module | Verdict | Reason |
|---|---|---|
| Authentication (Login/Logout/Change PW) | ✅ PRODUCTION READY | bcrypt, JWT, DB update — all correct |
| Monitor View (pipeline + orchestrator runs) | ✅ PRODUCTION READY | Full filter/pagination/retry/cancel/KPIs — all wired |
| Pipeline CRUD (create/rename/delete/open) | ✅ PRODUCTION READY | All operations genuinely wired end to end |
| Orchestrator CRUD (create/rename/delete) | ✅ PRODUCTION READY | Same |
| Folder CRUD (with ltree caveat) | ⚠️ NEAR READY | Rename ltree bug + post-create tree sync must be fixed |
| Execution History Sub-tab | ✅ PRODUCTION READY | Real API; all filters; retry; cancel; export |
| Connection Create + Test + Browse | ✅ PRODUCTION READY | Full flow via service layer |
| Audit Logs Sub-tab (pipeline) | ✅ PRODUCTION READY | Reads real DB history table |
| Pipeline Validation Sub-tab | ✅ PRODUCTION READY | Real codegen service validation |
| Pipeline Metrics Sub-tab | ✅ PRODUCTION READY | Live computation from real execution data |
| Governance Backend (users/roles/project members API) | ✅ PRODUCTION READY (API only) | All CRUD routes present and wired to DB |

### Risky Modules (Partially wired — use with caution)

| Module | Risk | What Must Be Fixed Before Production |
|---|---|---|
| Pipeline Properties Sub-tab | HIGH | Entire sub-tab is placeholder. Remove or implement. |
| Pipeline Parameters Sub-tab | CRITICAL | Users will lose all parameter configuration. Block from release. |
| Pipeline Alerts Sub-tab | HIGH | Ships with demo data. Block from release. |
| Pipeline Activity Sub-tab | HIGH | Permanently empty. Remove tab or implement. |
| Pipeline Dependencies Sub-tab | HIGH | Permanently empty. Remove tab or implement. |
| Pipeline Optimize Sub-tab | HIGH | Hardcoded PostgreSQL/Snowflake. Remove or implement. |
| Pipeline Overview Save/Schedule/Clone | HIGH | Multiple dead buttons. Fix before release. |
| Pipeline Code Generation | HIGH | Field mismatch. Fix response mapping. |
| Connection Manager (main page) | CRITICAL | Crashes on load. Fix response.data.data mapping. |
| Permissions (pipeline + orchestrator) | MEDIUM | Stub — acceptable to hide behind feature flag |
| Lineage | MEDIUM | Stub — acceptable to mark as "coming soon" |

### UI Shells (No backend — must not be released as functional)

| Module | Status |
|---|---|
| GovernanceView (Users tab) | Hardcoded mockUsers — must replace |
| UserWorkspace | Fake save, no data load — not functional |
| Dashboard Compute Gauges | Fake metrics |
| Schedule Feature | Entirely absent |
| Global Pipeline/Orchestrator creation | TODO comment — dead buttons |

### Must-Fix Before Any Release (Ordered)

1. **C-003** — Fix ConnectionsManager crash (1-line fix)
2. **C-004** — Replace mockUsers in GovernanceView
3. **C-005** — Implement UserWorkspace real save
4. **C-001** — Implement Parameters persistence API
5. **H-011** — Add onClick to New Connection button
6. **H-004** — Add API call to OverviewSubTab save
7. **H-006** — Fix PipelineCodeSubTab field mapping
8. **H-022** — Fix TODO buttons for global pipeline/orch creation
9. **H-026** — Add activePipelines to KPI query
10. **H-017** — Remove or replace fake compute gauges

---

## 12. PRIORITIZED TOP 25 DEFECT LIST

| Rank | ID | Severity | Module | Description | Fix Effort |
|---|---|---|---|---|---|
| 1 | C-003 | CRITICAL | Connections | ConnectionsManager crashes on load — wrong response mapping | XS (1 line) |
| 2 | C-001 | CRITICAL | Pipeline/Params | Parameters tab: zero persistence, no API | L |
| 3 | C-002 | CRITICAL | Pipeline/Props | Properties tab: all hardcoded, no save | L |
| 4 | C-004 | CRITICAL | Governance | GovernanceView: hardcoded mockUsers | S |
| 5 | C-005 | CRITICAL | Governance | UserWorkspace: fake save (setTimeout only) | M |
| 6 | C-006 | CRITICAL | Pipeline/Alerts | Alerts tab: demo data, no API | L |
| 7 | H-010 | HIGH | Execution | No execution engine — all runs stay PENDING | XL |
| 8 | H-011 | HIGH | Connections | New Connection button on main page: no onClick | XS |
| 9 | H-004 | HIGH | Pipeline | Overview Save: no API call | S |
| 10 | H-006 | HIGH | Pipeline | Code tab: field mismatch, always shows placeholder | XS |
| 11 | H-005 | HIGH | Pipeline | Overview Schedule/Clone: dead buttons | L |
| 12 | H-001 | HIGH | Pipeline | Activity tab: permanent empty stub | M |
| 13 | H-002 | HIGH | Pipeline | Dependencies tab: permanent empty stub | M |
| 14 | H-003 | HIGH | Pipeline | Optimize tab: hardcoded mock sequence | S |
| 15 | H-007/H-008 | HIGH | Pipeline | Permissions + Lineage: both stubs | L |
| 16 | H-015 | HIGH | Governance | UserWorkspace: never loads real user data | M |
| 17 | H-016 | HIGH | Governance | GovernanceView audit tab: missing pipelineId prop | M |
| 18 | H-017 | HIGH | Dashboard | Fake compute gauge arithmetic | M |
| 19 | H-018 | HIGH | Schedule | Entire schedule feature missing | XL |
| 20 | H-019/H-020 | HIGH | Folder | Post-create tree sync issues for sub-folders/scoped items | M |
| 21 | H-021 | HIGH | Folder | Rename does not update ltree path | M |
| 22 | H-022 | HIGH | Sidebar | Global Pipelines/Orchs + button is TODO | XS |
| 23 | H-026 | HIGH | Dashboard | activePipelines missing from KPI query | XS |
| 24 | H-012/H-013 | HIGH | Connections | Status+lastTested hardcoded in ConnectionsManager | S |
| 25 | M-007 | MEDIUM | Auth | JWT expires without refresh mechanism | M |

**Effort scale:** XS=<30min, S=1-4h, M=1-2 days, L=3-5 days, XL=1-3 weeks

---

## 13. ALL STUBBED ACTIONS (Complete List)

```
PipelineParametersSubTab - Add parameter (local state only)
PipelineParametersSubTab - Remove parameter (local state only)
PipelineParametersSubTab - Edit parameter (local state only)
PipelinePropertiesSubTab - Save properties (no save button; no API)
PipelineActivitySubTab - View activity (events=[] always)
PipelineAlertsSubTab - Add alert rule (local state; hardcoded demo init)
PipelineAlertsSubTab - Toggle alert rule (local state only)
PipelineAlertsSubTab - Delete alert rule (local state only)
PipelineDependenciesSubTab - View dependencies (deps=[] always)
OptimizeSubTab - Optimize view (hardcoded mock sequence)
OverviewSubTab - Save pipeline name/description (setEditing(false) only)
OverviewSubTab - Schedule pipeline (no onClick)
OverviewSubTab - Clone pipeline (no onClick)
ExecutionSubTab - Step timeline (hardcoded 5 steps)
pipeline.routes.ts - GET /:id/lineage (hardcoded 1-node graph)
pipeline.routes.ts - GET /:id/permissions (static {grants:[], inheritFromProject:true})
pipeline.routes.ts - PUT /:id/permissions (returns success without DB write)
orchestrators.routes.ts - GET /:id/permissions (same static stub)
orchestrators.routes.ts - PUT /:id/permissions (same fake success)
ConnectionsManager - New Connection button (no onClick)
GovernanceView - Users tab (hardcoded mockUsers)
GovernanceView - Roles tab (static text only)
GovernanceView - Invite user button (no onClick)
UserWorkspace - Load user profile (no API call)
UserWorkspace - Save user profile (setTimeout fake)
UserWorkspace - Reset Password button (no onClick)
UserWorkspace - Deactivate user button (no onClick)
UserWorkspace - Activity sub-tab (empty ObjectHistoryGrid)
UserWorkspace - Audit sub-tab (empty ObjectHistoryGrid)
DashboardView - CPU/Memory/Disk/Network gauges (fake arithmetic)
DashboardView - Data Freshness metric (hardcoded 92.5)
SettingsView - Interface density (local state, no persist)
SettingsView - Notification toggles (local state, no persist)
SettingsView - Manage Access Tokens (no onClick)
LeftSidebar - Global Pipelines + button (/* TODO */)
LeftSidebar - Global Orchestrators + button (/* TODO */)
LineageExplorer - Platform lineage (no API backing)
```

---

## 14. ALL FIELDS USING STATIC/MOCK VALUES

```
PipelinePropertiesSubTab.project = '' (hardcoded empty string)
PipelinePropertiesSubTab.folder = '' (hardcoded empty string)
PipelinePropertiesSubTab.status = 'draft' (hardcoded)
PipelinePropertiesSubTab.owner = '' (hardcoded empty)
PipelinePropertiesSubTab.runtimeEngine = 'Spark' (hardcoded)
PipelinePropertiesSubTab.executionMode = 'batch' (hardcoded)
PipelinePropertiesSubTab.retryPolicy = '3 retries, 60s delay' (hardcoded)
PipelinePropertiesSubTab.timeout = '4 hours' (hardcoded)
PipelinePropertiesSubTab.loggingLevel = 'INFO' (hardcoded)
PipelinePropertiesSubTab.publishedState = 'draft' (hardcoded)
PipelinePropertiesSubTab.lockState = 'Unlocked' (hardcoded)
PipelinePropertiesSubTab.updatedBy = '—' (hardcoded)
PipelinePropertiesSubTab.lastOpenedBy = '—' (hardcoded)
PipelinePropertiesSubTab.lastOpenedOn = '—' (hardcoded)
PipelinePropertiesSubTab.lastExecutedBy = '—' (hardcoded)
PipelinePropertiesSubTab.lastExecutedOn = '—' (hardcoded)
PipelinePropertiesSubTab.lastSuccessOn = '—' (hardcoded)
PipelinePropertiesSubTab.lastFailedOn = '—' (hardcoded)
PipelineAlertsSubTab.target[0] = 'team@example.com' (hardcoded demo)
PipelineAlertsSubTab.target[1] = '#data-alerts' (hardcoded demo)
OptimizeSubTab.sourceTechnology = 'PostgreSQL' (hardcoded)
OptimizeSubTab.targetTechnology = 'Snowflake' (hardcoded)
ExecutionHistorySubTab.rowsOut = null (always fmtNum(null))
ExecutionHistorySubTab.rowsFailed = null (always fmtNum(null))
ExecutionHistorySubTab.env = '—' (always hardcoded)
ConnectionsManager.status = 'active' (hardcoded for all connections)
ConnectionsManager.lastTested = new Date().toISOString() (always current time)
GovernanceView.users = mockUsers array (4 hardcoded users)
GovernanceView.users[0].name = 'Admin User'
GovernanceView.users[0].email = 'admin@etl1.io'
GovernanceView.users[0].role = 'Super Admin'
GovernanceView.users[1].name = 'Data Engineer'
GovernanceView.users[1].email = 'de@etl1.io'
GovernanceView.users[2].name = 'Analyst One'
GovernanceView.users[2].email = 'ana1@etl1.io'
GovernanceView.users[3].name = 'Security Officer'
GovernanceView.users[3].email = 'security@etl1.io'
UserWorkspace.email = '' (hardcoded empty default)
UserWorkspace.userType = 'standard' (hardcoded)
UserWorkspace.mfaStatus = 'Disabled' (hardcoded)
UserWorkspace.createdBy = '—' (hardcoded)
UserWorkspace.lastLogin = '—' (hardcoded)
UserWorkspace.roles = [] (hardcoded empty array)
DashboardView.cpuUtilization = runningNow*15+12 (fake formula)
DashboardView.memoryUsage = runningNow*10+34 (fake formula)
DashboardView.diskIO = dataVolumeGbToday*2+5 (fake formula)
DashboardView.networkEgress = dataVolumeGbToday*3+18 (fake formula)
DashboardView.dataFreshness = 92.5 (hardcoded constant)
DashboardView.activePipelines = undefined (field missing from KPI query)
executions.routes.ts.runDetail.nodes = [] (hardcoded empty array)
pipeline.routes.ts.lineage.nodes = [{single node}] (hardcoded stub)
pipeline.routes.ts.lineage.edges = [] (hardcoded empty)
pipeline.routes.ts.permissions.grants = [] (hardcoded empty)
pipeline.routes.ts.permissions.inheritFromProject = true (hardcoded)
```

---

## 15. ALL LOGGING GAPS

```
projects.routes.ts - No logging in Create, Update, Delete, List routes
folders.routes.ts - No logging in any route handler
pipeline.routes.ts - No logging in any route handler
orchestrators.routes.ts - No logging in any route handler
connections.controller.ts - No logging in any handler (create/test/update/delete)
executions.routes.ts - No logging in retry, cancel, or run trigger handlers
auth.routes.ts - Missing: no API entry log; missing failure context in change-password
governance.routes.ts - GOOD for role assign/revoke; missing in list users, project members
ConnectionsManager.tsx - No logging on connection test result
PipelineCodeSubTab.tsx - No logging on code generation
ExecutionSubTab.tsx - No logging on run trigger or status poll
UserWorkspace.tsx - No logging on save attempt
No request-level logging middleware (no X-Request-Id, no path/method/userId logging)
No correlation ID propagation anywhere in the stack
No before/after values logged for pipeline renames or orchestrator updates
No audit log written when pipeline run is triggered via API (only DB insert)
No audit log for code generation events
No audit log for connection test events
No structured error context (pipelineId/projectId/userId) in error propagation
```

---

## 16. RECOMMENDED FIX SEQUENCE

**Phase 1 — Critical Crash Fixes (Same day)**
1. Fix `ConnectionsManager.tsx` response mapping crash (C-003)
2. Fix `PipelineCodeSubTab.tsx` artifact field mapping (H-006)
3. Fix `GovernanceView` audit tab missing `pipelineId` (H-016)
4. Fix Global Pipelines/Orchestrators `/* TODO */` buttons (H-022)
5. Add `activePipelines` to KPI query (H-026)

**Phase 2 — Remove/Replace Obvious Stubs That Mislead Users (1 week)**
6. Replace `mockUsers` in GovernanceView with real API (C-004)
7. Remove hardcoded demo targets from PipelineAlertsSubTab or disable tab (C-006)
8. Add onClick to ConnectionsManager New Connection button (H-011)
9. Add API call to OverviewSubTab save button (H-004)
10. Fix UserWorkspace to load real user data + implement real save (C-005 + H-015)
11. Replace OptimizeSubTab hardcoded mockSequence with real pipeline nodes (H-003)
12. Remove or hide DashboardView fake compute gauges (H-017)
13. Remove fake Data Freshness hardcoded value (M-001)

**Phase 3 — Implement Core Missing APIs (2-3 weeks)**
14. Pipeline Parameters API + persistence (C-001)
15. Pipeline Properties extended fields API (C-002)
16. Pipeline Alerts API (C-006)
17. Permissions DB tables + real GET/PUT for pipeline + orchestrator (H-007/H-008/H-009)
18. Fix folder rename to update ltree path + all children (H-021)
19. Fix post-create tree sync for sub-folders and folder-scoped items (H-019/H-020)
20. Add `updateConnector` and `deleteConnector` Redux thunks (H-014)

**Phase 4 — Build Missing Features (3-6 weeks)**
21. Schedule feature (CRUD + dialog + cron integration) (H-018)
22. Clone pipeline/orchestrator (H-005 partial)
23. Real lineage service (H-008)
24. Execution engine worker service (H-010)
25. JWT refresh token mechanism (M-007)
26. Request-level logging middleware + correlation IDs (L-004/L-005)
