# ETL1 NoCode ETL Platform — Task Status

Last Updated: 2026-03-18  Session 2

---

## Gap Analysis vs nocode_etl_ui_requirements.md

### COMPLETED ✅
- Pipeline workspace with 9 sub-tabs (Designer, Properties, Parameters, Validation, History, Executions, Dependencies, Permissions, Activity)
- Orchestrator workspace with 9 sub-tabs (Designer, Properties, Schedule, Parameters, History, Runs, Dependencies, Permissions, Activity)
- **NEW** ProjectWorkspace — 6 sub-tabs (Overview, Properties, Contents, History, Permissions, Activity)
- **NEW** FolderWorkspace — 5 sub-tabs (Overview, Properties, Contents, History, Permissions)
- **NEW** ConnectionWorkspace — 7 sub-tabs (Properties, Authentication, Connectivity/Test, Usage, History, Permissions, Security)
- **NEW** MetadataBrowserWorkspace — 6 sub-tabs (Overview, Structure, Profiling, Lineage, History, Permissions)
- **NEW** UserWorkspace — 6 sub-tabs (Profile, Access, Activity, Audit, Sessions, Preferences)
- **NEW** RoleWorkspace — 6 sub-tabs (Properties, Members, Permissions, Scope, History, Audit)
- **NEW** TabBar — type icons, dirty italic+asterisk, right-click context menu, overflow scroll, restore last closed
- **NEW** tabsSlice — closeOthers, closeAll, pinTab, unpinTab, restoreLastClosed, updateTab
- **NEW** Tab interface — hierarchyPath, isPinned, TabType union
- **NEW** ObjectHeader — hierarchy breadcrumb, status badges, dirty/locked/readonly indicators
- **NEW** ObjectHistoryGrid — reusable sortable/filterable/exportable audit grid
- **NEW** ObjectPermissionsGrid — inherited vs direct permissions, expand for effective perms
- **NEW** LeftSidebar — project click opens Project tab, connections open ConnectionWorkspace detail, Users section, Roles section
- **NEW** Header — context-aware toolbar (Save, SaveAll, Validate, Run, Publish, Undo/Redo), environment selector, dirty count badge
- **NEW** ResizableAppShell — right/bottom panels only render when content provided
- App.tsx WorkspaceRouter — handles all new tab types (project, folder, connection, metadata, user, role)
- Monitor view, ExecutionDetailTab, Login/Auth

---

## PENDING ❌

### High Priority
- **Execution tab full spec** (Summary/Steps/Logs/Metrics/Inputs-Outputs/Errors/Lineage/Audit 8 sub-tabs) — currently only Summary+Steps+Logs
- **Connection tab**: Authentication form needs dynamic fields per connector type (not all connectors are user/password)
- **Pipeline > History**: wire to real audit API (currently shows empty grid)
- **Orchestrator > History**: same
- **Pipeline > Executions**: wire grid "open" metalink to open Execution tab within shell
- **Users section in sidebar**: load real users from governance API (currently placeholder list)
- **Roles section in sidebar**: load real roles from governance API
- **Metadata tree**: lazy loading from real catalog API (currently static metadata-catalog page)
- **Global Pipelines / Global Orchestrators** sections in sidebar (spec requires these)
- **Folder nesting**: sub-folders under projects in sidebar tree (currently flat pipelines/orchestrators only)
- **Admin dashboard tabs**: failed executions, connection failures, role changes, user lockouts, secret expiry

### Backend (Critical Gaps)
- **Governance API**: no API layer — UserWorkspace and RoleWorkspace show no real data
- **Metadata/Dataset API**: missing — MetadataBrowserWorkspace shows no structure
- **RBAC middleware**: not applied to any route
- **GET /api/orchestrators** list endpoint missing
- **Pipeline audit/history API**: no endpoint for field-level change history
- **Connection usage API**: no endpoint to show pipelines/orchestrators using a connection

### Medium Priority
- **Dirty state save with confirmation dialog** on tab close (currently just marks saved without prompting)
- **Real undo/redo** in pipeline designer (toolbar buttons are disabled)
- **Version compare** in History grids
- **Schedule next-run preview** in Orchestrator > Schedule
- **Connection > Usage** tab: wire to real API
- **Metadata > Profiling**: implement profile run and display results
- **Pipeline > Validation**: jump-to-node on click (requires canvas integration)
- **Right-click context menu** in pipeline canvas (existing canvas component)
- **Dark mode toggle** in Header or Settings

### Low Priority
- Lineage explorer visual (graph/DAG view)
- Approval workflow tab
- Data quality tab
- SLA monitoring tab
- Cost monitoring tab
- AI assistant suggestions panel
- Impact simulation tab
- Notification tray panel

---

## Architecture Notes
- Tab-based shell: ALL objects open as tabs. NO page navigation.
- Dirty state: tab label italic + asterisk when unsaved
- Hierarchy path stored in tab.hierarchyPath: "Projects → ProjectA → Pipeline_X"
- Type icons: each object type has distinct icon in TabBar (Workflow=pipeline, GitMerge=orch, etc.)
- Theme: dark (`#0d0f1a` bg, `slate-800` borders) throughout all workspaces
- Thin client: paginated/lazy APIs — no massive data in browser memory
- Permission-aware: unauthorized actions should be hidden/disabled (spec requirement — not yet wired)

---

## Files Changed This Session — v2 Execution & Scheduling (2026-03-18)
```
Frontend/src/components/pipeline/sub-tabs/ExecutionHistorySubTab.tsx — full rewrite (dark, all v2 columns, filters, export)
Frontend/src/components/pipeline/sub-tabs/PipelineCodeSubTab.tsx    — NEW (generate PySpark/Scala/SQL + copy/download)
Frontend/src/components/pipeline/sub-tabs/PipelineMetricsSubTab.tsx — NEW (success rate, avg duration, status breakdown, duration chart)
Frontend/src/components/pipeline/sub-tabs/PipelineAlertsSubTab.tsx  — NEW (alert rule CRUD, channels: email/slack/webhook/pagerduty)
Frontend/src/components/monitor/ExecutionDetailTab.tsx              — rewrite (dark, log search+download, code copy+download)
Frontend/src/components/orchestrator/sub-tabs/OrchestratorScheduleSubTab.tsx — v2 rewrite (Cron/Interval/Event/Manual, name, failure handling)
Frontend/src/components/pipeline/PipelineWorkspace.tsx              — 12 sub-tabs (added Metrics, Code, Alerts)
Frontend/src/types/index.ts                                         — PipelineSubTab extended (metrics, code, alerts, logs)
```

---

## Files Changed This Session (2026-03-18)
```
Frontend/src/types/index.ts              — extended Tab, new tab types, sub-tab types
Frontend/src/store/slices/tabsSlice.ts   — closeOthers/All, pin, restore, updateTab
Frontend/src/components/tabs/TabBar.tsx  — full rewrite with icons/dirty/context-menu
Frontend/src/components/shared/ObjectHeader.tsx         — NEW
Frontend/src/components/shared/ObjectHistoryGrid.tsx    — NEW
Frontend/src/components/shared/ObjectPermissionsGrid.tsx — NEW
Frontend/src/components/project/ProjectWorkspace.tsx    — NEW
Frontend/src/components/folder/FolderWorkspace.tsx      — NEW
Frontend/src/components/connection/ConnectionWorkspace.tsx — NEW
Frontend/src/components/metadata/MetadataBrowserWorkspace.tsx — NEW
Frontend/src/components/governance/UserWorkspace.tsx    — NEW
Frontend/src/components/governance/RoleWorkspace.tsx    — NEW
Frontend/src/components/pipeline/PipelineWorkspace.tsx  — rewritten (9 sub-tabs)
Frontend/src/components/pipeline/sub-tabs/PipelinePropertiesSubTab.tsx   — NEW
Frontend/src/components/pipeline/sub-tabs/PipelineParametersSubTab.tsx   — NEW
Frontend/src/components/pipeline/sub-tabs/PipelineValidationSubTab.tsx   — NEW
Frontend/src/components/pipeline/sub-tabs/PipelineDependenciesSubTab.tsx — NEW
Frontend/src/components/pipeline/sub-tabs/PipelineActivitySubTab.tsx     — NEW
Frontend/src/components/orchestrator/OrchestratorWorkspace.tsx — rewritten (9 sub-tabs)
Frontend/src/components/orchestrator/sub-tabs/OrchestratorPropertiesSubTab.tsx — NEW
Frontend/src/components/orchestrator/sub-tabs/OrchestratorScheduleSubTab.tsx   — NEW
Frontend/src/components/orchestrator/sub-tabs/OrchestratorDependenciesSubTab.tsx — NEW
Frontend/src/components/orchestrator/sub-tabs/OrchestratorActivitySubTab.tsx    — NEW
Frontend/src/components/layout/LeftSidebar.tsx  — project tabs, conn detail, Users/Roles sections
Frontend/src/components/layout/Header.tsx       — context-aware toolbar, env selector
Frontend/src/components/layout/ResizableAppShell.tsx — panel guard fix
Frontend/src/App.tsx                            — WorkspaceRouter for all tab types
TASK_STATUS.md                                  — this file
CLAUDE.md                                       — Living Decisions appended
```
