# ETL1 Implementation Audit Worklog

Last updated: 2026-03-18

This file is the live audit ledger and future remediation backlog for ETL1.
Only verified findings belong here.
If a claim is not proven by code, route, SQL, or runtime evidence, mark it `NOT VERIFIED`.

Status legend:
- `FULLY WIRED`
- `PARTIAL`
- `STUB`
- `BROKEN`
- `NOT VERIFIED`

Severity legend:
- `CRITICAL`
- `HIGH`
- `MEDIUM`
- `LOW`

## Verification Log

- `2026-03-18` — Verified repository bootstrap and operating rules in `CLAUDE.md`.
- `2026-03-18` — Ran `npm run build` in `Backend/`; build failed with TypeScript errors.
- `2026-03-18` — Ran `npm run build` in `Frontend/`; build did not complete successfully in current audit pass and an independent repo scan also reported frontend quality-gate failures.
- `2026-03-18` — Verified frontend screen wiring against `Frontend/src/components`, `Frontend/src/store/slices`, and `Frontend/src/services/api.ts`.
- `2026-03-18` — Verified backend route coverage against `Backend/src/api/server.ts` and route files under `Backend/src/api/routes`.
- `2026-03-18` — Re-ran `npm run build` in `Backend/`; build passed.
- `2026-03-18` — Re-ran `npm run build` in `Frontend/`; build passed.
- `2026-03-18` — Re-ran `npm test -- --run` in `Frontend/`; tests passed.

## Remediation Delta (2026-03-18)

Latest verified status updates (superseding original finding status tags above):

- `SYS-001` -> `FULLY WIRED` (backend compile gate now green).
- `SYS-002` -> `PARTIAL` (frontend build/test gates restored with `jsdom` + tests; lint/typecheck parity remains to be verified end-to-end).
- `SYS-003` -> `FULLY WIRED` (frontend default API base URL aligned to backend default port).
- `UI-001` -> `FULLY WIRED` (global pipeline add wired to create action).
- `UI-002` -> `FULLY WIRED` (global orchestrator add wired to create action).
- `HEAD-001` -> `FULLY WIRED` (misleading `Save All` affordance removed).
- `HEAD-002` -> `FULLY WIRED` (stub `Publish` affordance removed).
- `HEAD-003` -> `FULLY WIRED` (search converted to explicit "coming soon" placeholder).
- `PROJ-001` -> `FULLY WIRED` (project load path now typed/mapped with visible error state).
- `PROJ-002` -> `FULLY WIRED` (project save uses explicit payload mapping and surfaces failures).
- `PROJ-006` -> `PARTIAL` (name/description mapping fixed; unsupported fields now read-only).
- `FOLD-001` -> `FULLY WIRED` (folder save now uses backend rename API).
- `FOLD-002` -> `FULLY WIRED` (new sub-folder action wired).
- `FOLD-003` -> `FULLY WIRED` (new pipeline action wired).
- `FOLD-004` -> `FULLY WIRED` (new orchestrator action wired).
- `FOLD-005` -> `FULLY WIRED` (folder contents now loaded from children/pipelines/orchestrators APIs).
- `GOV-001` -> `PARTIAL` (governance users mapper aligned to backend DTO and role shapes where available).
- `GOV-003` -> `PARTIAL` (search/filter now stateful; row menu remains non-functional).
- `USER-001` -> `FULLY WIRED` (broken save path removed by eliminating unsupported save affordance).
- `USER-002` -> `FULLY WIRED` (stub reset/deactivate controls removed from workspace header actions).
- `USER-004` -> `PARTIAL` (user DTO mapping and role-object normalization fixed; activity/audit/session remains stubbed).
- `GOV-API-001` -> `FULLY WIRED` (broken `updateUser` client contract removed to match backend surface).
- `API-004` -> `FULLY WIRED` (`GET /api/orchestrators` list route added).
- `API-007` -> `FULLY WIRED` (pipeline audit endpoint now propagates backend errors instead of false-empty success).
- `API-008` -> `FULLY WIRED` (orchestrator audit endpoint now propagates backend errors instead of false-empty success).
- `API-009` -> `FULLY WIRED` (cancel endpoints now return 404/409 when no valid transition occurs).
- `API-011` -> `FULLY WIRED` (connection test-result persistence columns aligned to schema).
- `API-012` -> `FULLY WIRED` (connection summaries now derive health status from backend data path).
- `API-015` -> `FULLY WIRED` (node-template create now uses middleware-derived user identity).
- `API-016` -> `FULLY WIRED` (`POST /api/connections/test` implemented).
- `API-017` -> `PARTIAL` (`GET /api/nodes/:nodeId/preview` route implemented with stable placeholder payload contract).
- `API-018` -> `FULLY WIRED` (runtime whitelist added for list ordering params before SQL assembly).
- `API-019` -> `FULLY WIRED` (folder/orchestrator delete now validates existence and returns 404 on missing rows).
- `SYS-004` -> `FULLY WIRED` (frontend build now passes in current workspace configuration).
- `SYS-005` -> `FULLY WIRED` (frontend test runner now operational with `jsdom` installed).
- `API-020` -> `FULLY WIRED` (pipeline save payload mapping fixed in workspace + header paths).
- `API-021` -> `FULLY WIRED` (codegen client now sends `{ options: { ... } }` contract expected by backend).
- `PIPE-005` -> `FULLY WIRED` (parameter load failures now shown in UI with retry path).
- `API-022` -> `PARTIAL` (pipeline run now captures request options and persists environment/technology metadata; deeper execution-model integration remains).
- `API-023` -> `PARTIAL` (orchestrator run now accepts/echoes options and applies environment where resolvable; no concurrency persistence model yet).
- `DB-001` -> `PARTIAL` (folder delete moved to DB procedure; create path still route-implemented).
- `DB-002` -> `PARTIAL` (orchestrator delete moved to DB procedure; create path still route-implemented).
- `DB-003` -> `FULLY WIRED` (connector health read now uses `catalog.fn_get_connector_health`).

## Findings Log

### SYS-001
- Severity: `CRITICAL`
- Status: `BROKEN`
- Module/Object: Backend build verification
- Area: Runtime readiness / release gate
- Evidence:
  - `Backend/package.json` uses `tsc --project tsconfig.json` for `npm run build`.
  - Audit run of `npm run build` in `Backend/` failed with many TypeScript errors, including:
    - `src/api/controllers/pipeline.controller.ts(152,39): Cannot find name 'GeneratedArtifact'`
    - `src/api/routes/pipeline.routes.ts(136,83): Cannot find name 'id'`
    - `src/shared/types/api.types.ts(125,43): Cannot find module '../codegen/core/types/pipeline.types'`
- Impact:
  - Backend is not releasable from a clean build path.
  - Any route judged "working" is still operating in a repo that does not pass its own compile gate.
- Fix area:
  - `Backend/src/shared/types/api.types.ts`
  - `Backend/src/api/controllers/pipeline.controller.ts`
  - `Backend/src/api/routes/pipeline.routes.ts`
  - codegen type exports/imports

### SYS-002
- Severity: `CRITICAL`
- Status: `BROKEN`
- Module/Object: Frontend quality gates
- Area: Release verification / testability
- Evidence:
  - Frontend repo scan found broken build/test/lint/typecheck gates.
  - `Frontend/vitest.config.ts` is configured for `jsdom`, while `Frontend/package.json` does not list `jsdom`.
  - No frontend test files were found under `Frontend/src`.
- Impact:
  - UI wiring cannot be trusted through automated verification.
  - Regression detection is effectively absent.
- Fix area:
  - `Frontend/vitest.config.ts`
  - `Frontend/package.json`
  - add assertion-based tests for primary flows

### SYS-003
- Severity: `HIGH`
- Status: `PARTIAL`
- Module/Object: Platform startup/config
- Area: Environment alignment
- Trace:
  - Frontend API client default -> `http://localhost:3000/api`
  - Backend server default -> port `3001`
- Evidence:
  - `Frontend/src/services/api.ts`
  - `Backend/src/api/server.ts`
- Impact:
  - Fresh local startup will fail unless environment overrides are supplied.
- Fix area:
  - align frontend default base URL with backend default port or require env config explicitly

### UI-001
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Left sidebar -> Global Pipelines
- Action: `New global pipeline`
- UI path:
  - `Frontend/src/components/layout/LeftSidebar.tsx`
- Trace:
  - visible add button -> `onAdd={() => { /* TODO */ }}`
  - no thunk
  - no dialog open
  - no API call
- Evidence:
  - `Frontend/src/components/layout/LeftSidebar.tsx:995`
- Impact:
  - User-facing create affordance exists with no execution path.
- Fix area:
  - wire to `openCreatePipeline({ projectId: null, folderId: null })`

### UI-002
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Left sidebar -> Global Orchestrators
- Action: `New global orchestrator`
- UI path:
  - `Frontend/src/components/layout/LeftSidebar.tsx`
- Trace:
  - visible add button -> `onAdd={() => { /* TODO */ }}`
  - no thunk
  - no dialog open
  - no API call
- Evidence:
  - `Frontend/src/components/layout/LeftSidebar.tsx:1023`
- Impact:
  - User-facing create affordance exists with no execution path.
- Fix area:
  - wire to `openCreateOrchestrator({ projectId: null, folderId: null })`

### HEAD-001
- Severity: `HIGH`
- Status: `BROKEN`
- Module/Object: Global header toolbar
- Action: `Save All`
- UI path:
  - Header toolbar -> `ToolbarActions`
- Trace:
  - `dirtyTabCount > 1` shows `Save All`
  - button calls same `handleSave`
  - `handleSave` only saves active pipeline and then marks active tab saved
- Evidence:
  - `Frontend/src/components/layout/Header.tsx:97-107`
  - `Frontend/src/components/layout/Header.tsx:148-150`
- Impact:
  - Label promises multi-tab persistence; implementation only targets current tab.
- Fix area:
  - implement iteration over dirty tabs with tab-type-specific save behavior

### HEAD-002
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Global header toolbar
- Action: `Publish`
- UI path:
  - Header toolbar -> `ToolbarActions`
- Trace:
  - button is rendered for pipeline/orchestrator
  - no `onClick`
  - no API/service/backend path
- Evidence:
  - `Frontend/src/components/layout/Header.tsx:165-167`
- Impact:
  - Release/promotion action is visually advertised but not implemented.
- Fix area:
  - define publish action contract end to end or hide the control

### HEAD-003
- Severity: `MEDIUM`
- Status: `STUB`
- Module/Object: Global header
- Action: Global search
- UI path:
  - Header search field
- Trace:
  - input renders only
  - no state binding
  - no search handler
  - no API call
- Evidence:
  - `Frontend/src/components/layout/Header.tsx:207-213`
- Impact:
  - Search affordance is misleading.
- Fix area:
  - wire to object search or remove until implemented

### PROJ-001
- Severity: `HIGH`
- Status: `PARTIAL`
- Module/Object: Project workspace
- Action: Load project
- UI path:
  - open project tab -> `ProjectWorkspace`
- Trace:
  - `useEffect` calls `(api as any).getProject?.(projectId)`
  - response is merged directly into local `formData`
  - no mapping layer verifies shape
  - errors are silently ignored
- Evidence:
  - `Frontend/src/components/project/ProjectWorkspace.tsx:174-180`
- Impact:
  - Load path is weakly typed and can silently fail without user feedback.
- Fix area:
  - remove `any` usage, map API contract explicitly, surface load errors

### PROJ-002
- Severity: `HIGH`
- Status: `PARTIAL`
- Module/Object: Project workspace
- Action: Save project
- UI path:
  - properties tab -> dirty state -> Save button
- Trace:
  - user edits local fields
  - `handleSave` calls `(api as any).updateProject?.(projectId, formData)`
  - exception path is swallowed
  - no reload from backend after save
  - tab is marked saved even though backend response is ignored
- Evidence:
  - `Frontend/src/components/project/ProjectWorkspace.tsx:189-197`
- Impact:
  - Project save can fail without message and without post-save verification.
- Fix area:
  - explicit payload mapping, error handling, optimistic save only after confirmed response

### PROJ-003
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Project workspace
- Action: History view
- Trace:
  - renders `ObjectHistoryGrid rows={[]}`
  - no API call
- Evidence:
  - `Frontend/src/components/project/ProjectWorkspace.tsx:223`
- Fix area:
  - add project audit/history endpoint and loader

### PROJ-004
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Project workspace
- Action: Permissions view
- Trace:
  - renders `ObjectPermissionsGrid rows={[]}`
  - no API call
- Evidence:
  - `Frontend/src/components/project/ProjectWorkspace.tsx:224`
- Fix area:
  - add project permissions query/mutation wiring

### PROJ-005
- Severity: `MEDIUM`
- Status: `STUB`
- Module/Object: Project workspace
- Action: Activity view
- Trace:
  - static placeholder text only
- Evidence:
  - `Frontend/src/components/project/ProjectWorkspace.tsx`
- Impact:
  - Project-level activity is a UI shell.
- Fix area:
  - bind to project audit/activity stream

### FOLD-001
- Severity: `CRITICAL`
- Status: `STUB`
- Module/Object: Folder workspace
- Action: Save folder properties
- UI path:
  - folder properties -> Save
- Trace:
  - local state update only
  - `handleSave` waits `300ms` using `setTimeout` promise
  - no API call
  - tab is marked saved after delay
- Evidence:
  - `Frontend/src/components/folder/FolderWorkspace.tsx:132-137`
- Impact:
  - Fake save success with zero persistence.
- Fix area:
  - connect to folder update endpoint and refetch/refresh state

### FOLD-002
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Folder workspace
- Action: `New Sub-folder`
- Trace:
  - button visible
  - no `onClick`
  - no dialog
  - no API call
- Evidence:
  - `Frontend/src/components/folder/FolderWorkspace.tsx:90-92`
- Fix area:
  - dispatch `openCreateFolder` with current folder as parent

### FOLD-003
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Folder workspace
- Action: `New Pipeline`
- Trace:
  - button visible
  - no handler
- Evidence:
  - `Frontend/src/components/folder/FolderWorkspace.tsx:93-95`
- Fix area:
  - dispatch `openCreatePipeline` with `folderId`

### FOLD-004
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Folder workspace
- Action: `New Orchestrator`
- Trace:
  - button visible
  - no handler
- Evidence:
  - `Frontend/src/components/folder/FolderWorkspace.tsx:96-98`
- Fix area:
  - dispatch `openCreateOrchestrator` with `folderId`

### FOLD-005
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Folder workspace
- Action: Load folder contents
- Trace:
  - contents tab renders placeholder text only
  - no folder contents fetch
- Evidence:
  - `Frontend/src/components/folder/FolderWorkspace.tsx:100-103`
- Fix area:
  - call folder children / folder pipeline / folder orchestrator endpoints and render tree/list

### META-001
- Severity: `CRITICAL`
- Status: `STUB`
- Module/Object: Metadata browser workspace
- Action: Load metadata object overview
- Trace:
  - local `useState` seeds static placeholder fields
  - no API call
  - no load effect
- Evidence:
  - `Frontend/src/components/metadata/MetadataBrowserWorkspace.tsx:174-188`
- Impact:
  - Metadata object screen is not connected to repository data at all.
- Fix area:
  - define actual metadata object endpoint and map fields explicitly

### META-002
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Metadata browser workspace
- Action: `Refresh Metadata`
- Trace:
  - button rendered
  - no `onClick`
  - no API call
- Evidence:
  - `Frontend/src/components/metadata/MetadataBrowserWorkspace.tsx:197-200`
- Fix area:
  - bind to metadata refresh endpoint or remove button

### META-003
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Metadata browser workspace
- Action: Structure / profiling / lineage / history / permissions
- Trace:
  - `columns` state initialized to empty array
  - profiling tab placeholder with no handler
  - lineage tab placeholder text
  - history grid uses empty rows
  - permissions grid uses empty rows
- Evidence:
  - `Frontend/src/components/metadata/MetadataBrowserWorkspace.tsx:188`
  - `Frontend/src/components/metadata/MetadataBrowserWorkspace.tsx:205-210`
- Fix area:
  - real metadata APIs for structure, profile, lineage, history, permissions

### META-004
- Severity: `CRITICAL`
- Status: `BROKEN`
- Module/Object: Metadata API contract
- Action: Metadata tree / metadata profile
- Trace:
  - frontend API client calls `/metadata/tree`, `/metadata/tree/search`, `/metadata/:id/profile`
  - backend only mounts `/api/node-templates`
  - no `/api/metadata` routes found in backend
- Evidence:
  - `Frontend/src/services/api.ts`
  - `Backend/src/api/server.ts`
  - `Backend/src/api/routes/node-template.routes.ts`
- Impact:
  - Metadata features cannot work end to end on current backend surface.
- Fix area:
  - implement `/api/metadata/*` or rewire frontend to actual backend endpoints

### GOV-001
- Severity: `HIGH`
- Status: `PARTIAL`
- Module/Object: Governance main view
- Action: Load users
- Trace:
  - `api.getUsers()` called on users tab
  - mapping expects `user_full_name`, `user_email`, `role_name`, `is_active_flag`
  - backend governance users route currently returns `displayName`, `email`, `isActive`
- Evidence:
  - `Frontend/src/components/views/GovernanceView.tsx:31-40`
  - `Backend/src/api/routes/governance.routes.ts`
- Impact:
  - role/status values will be defaulted or wrong because field names do not align.
- Fix area:
  - align frontend mapper to actual backend DTO or normalize backend response

### GOV-002
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Governance main view
- Action: Invite User
- Trace:
  - visible button
  - no handler
- Evidence:
  - `Frontend/src/components/views/GovernanceView.tsx:54-57`
- Fix area:
  - open invite dialog and connect to governance create-user flow

### GOV-003
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Governance main view
- Action: User search / filter / row action menu
- Trace:
  - search input not bound to state
  - filter button has no handler
  - row action menu button has no handler
- Evidence:
  - `Frontend/src/components/views/GovernanceView.tsx:93-104`
  - `Frontend/src/components/views/GovernanceView.tsx:147-150`
- Fix area:
  - implement local filter state and/or API-backed search/filter actions

### GOV-004
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Governance main view
- Action: Roles & permissions section
- Trace:
  - informational text only
  - no load call
  - no role list
  - no permission matrix
  - `Manage Custom Roles` button has no handler
- Evidence:
  - `Frontend/src/components/views/GovernanceView.tsx:160-173`
- Fix area:
  - replace with real role/permission management workspace or route

### GOV-005
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Governance main view
- Action: System audit log
- Trace:
  - uses `AuditLogsSubTab pipelineId=""`
  - pipeline audit component is reused with empty pipeline id
  - no system audit endpoint call
- Evidence:
  - `Frontend/src/components/views/GovernanceView.tsx:178-181`
- Fix area:
  - implement governance/system audit endpoint and dedicated viewer

### GOV-006
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Governance main view
- Field group: Activity sidebar
- Trace:
  - `mockActivities` constant populates right sidebar
- Evidence:
  - `Frontend/src/components/views/GovernanceView.tsx:19-23`
  - `Frontend/src/components/views/GovernanceView.tsx:186-187`
- Fix area:
  - bind to real governance/system activity feed

### USER-001
- Severity: `CRITICAL`
- Status: `BROKEN`
- Module/Object: User workspace
- Action: Save user profile
- Trace:
  - UI save -> `api.updateUser(userId, payload)` -> `PUT /governance/users/:id`
  - backend governance routes expose `GET /users/:id`, `POST /users/:id/roles`, `DELETE /users/:id/roles/:roleId`
  - no `PUT /users/:id` route exists
- Evidence:
  - `Frontend/src/components/governance/UserWorkspace.tsx:268-282`
  - `Frontend/src/services/api.ts:352`
  - `Backend/src/api/routes/governance.routes.ts`
- Impact:
  - User profile save cannot complete successfully end to end.
- Fix area:
  - add update-user backend path or remove save affordance until available

### USER-002
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: User workspace
- Actions: `Reset Password`, `Deactivate`
- Trace:
  - both buttons render
  - no click handler
  - no API call
- Evidence:
  - `Frontend/src/components/governance/UserWorkspace.tsx:301-307`
- Fix area:
  - wire to auth/governance admin actions

### USER-003
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: User workspace
- Actions: Activity, audit, sessions
- Trace:
  - activity grid empty
  - audit grid empty
  - sessions tab placeholder
- Evidence:
  - `Frontend/src/components/governance/UserWorkspace.tsx`
- Fix area:
  - add endpoints and loaders for user activity/audit/session data

### ROLE-001
- Severity: `CRITICAL`
- Status: `STUB`
- Module/Object: Role workspace
- Action: Entire role detail screen
- Trace:
  - no API import
  - no load effect
  - local state only
  - save path is `await new Promise(r => setTimeout(r, 300))`
  - tab marked saved after delay
- Evidence:
  - `Frontend/src/components/governance/RoleWorkspace.tsx:177-213`
- Impact:
  - Role editing is completely non-persistent.
- Fix area:
  - wire role CRUD + permission matrix + member assignment to governance endpoints

### ROLE-002
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Role workspace
- Action: Assign User / remove member
- Trace:
  - members tab receives `members={[]}`
  - Assign User button no handler
  - Remove button no handler
- Evidence:
  - `Frontend/src/components/governance/RoleWorkspace.tsx:75-105`
  - `Frontend/src/components/governance/RoleWorkspace.tsx:232`
- Fix area:
  - load role members and wire add/remove role membership actions

### ORCH-001
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Orchestrator workspace
- Actions: Parameters, history, alerts, metrics
- Trace:
  - parameters tab is placeholder text
  - history grid uses empty rows
  - alerts placeholder text
  - metrics placeholder text
- Evidence:
  - `Frontend/src/components/orchestrator/OrchestratorWorkspace.tsx:60-79`
- Fix area:
  - add real orchestrator parameter/history/alert/metrics flows

### ORCH-002
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Orchestrator permissions
- Action: Load/update permissions
- Trace:
  - `INITIAL_GRANTS` constant seeds screen
  - no API import
  - no load effect
  - add/remove/change role are local state only
- Evidence:
  - `Frontend/src/components/orchestrator/sub-tabs/OrchestratorPermissionsSubTab.tsx:16-21`
  - `Frontend/src/components/orchestrator/sub-tabs/OrchestratorPermissionsSubTab.tsx:35-60`
- Fix area:
  - bind to orchestrator permissions endpoints and replace static grants

### ORCH-003
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Orchestrator dependencies
- Action: Load dependencies
- Trace:
  - static text only
  - no API call
- Evidence:
  - `Frontend/src/components/orchestrator/sub-tabs/OrchestratorDependenciesSubTab.tsx`
- Fix area:
  - derive from DAG / orchestrator pipeline map or execution lineage

### ORCH-004
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Orchestrator activity
- Action: Load activity
- Trace:
  - static empty-state only
  - no API call
- Evidence:
  - `Frontend/src/components/orchestrator/sub-tabs/OrchestratorActivitySubTab.tsx`
- Fix area:
  - add orchestrator activity/audit feed

### ORCH-005
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Orchestrator overview
- Action: Overview stats / runs / pipelines list
- Trace:
  - `MOCK_RUNS` and `MOCK_PIPELINES` constants drive screen
  - no API call
- Evidence:
  - `Frontend/src/components/orchestrator/sub-tabs/OrchestratorOverviewSubTab.tsx`
- Fix area:
  - bind to orchestrator detail + run history + DAG mapping endpoints

### ORCH-006
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Orchestrator audit logs
- Action: Load audit entries
- Trace:
  - `MOCK_ENTRIES` constant drives screen
  - no API call
- Evidence:
  - `Frontend/src/components/orchestrator/sub-tabs/OrchestratorAuditLogsSubTab.tsx`
- Fix area:
  - call `/orchestrators/:id/audit-logs` and display real diffs

### PIPE-001
- Severity: `HIGH`
- Status: `PARTIAL`
- Module/Object: Pipeline permissions
- Action: Add/remove/change grants
- Trace:
  - UI loads `/pipelines/:id/permissions`
  - save mutates local state first
  - `persist()` swallows backend failures
  - backend permissions endpoints currently return static success / empty grants
- Evidence:
  - `Frontend/src/components/pipeline/sub-tabs/PermissionsSubTab.tsx:38-60`
  - `Backend/src/api/routes/pipeline.routes.ts`
- Impact:
  - Screen appears interactive but cannot be trusted for real persistence.
- Fix area:
  - make backend real first, then block optimistic UI until response is verified

### PIPE-002
- Severity: `HIGH`
- Status: `BROKEN`
- Module/Object: Pipeline dependencies
- Action: Load dependencies from lineage
- Trace:
  - UI calls `/pipelines/:id/lineage`
  - UI computes dependencies from edges
  - backend lineage route returns single current pipeline node and empty edges
- Evidence:
  - `Frontend/src/components/pipeline/sub-tabs/PipelineDependenciesSubTab.tsx:19-47`
  - `Backend/src/api/routes/pipeline.routes.ts:184-187`
- Impact:
  - Dependencies screen will always show no upstream/downstream results regardless of real graph.
- Fix area:
  - implement real lineage backend before relying on UI transformation

### PIPE-003
- Severity: `MEDIUM`
- Status: `PARTIAL`
- Module/Object: Pipeline activity
- Action: Load activity
- Trace:
  - UI calls pipeline audit logs endpoint and maps results
  - refresh path exists
  - backend audit feed is very shallow and maps only create/update/delete style history rows
- Evidence:
  - `Frontend/src/components/pipeline/sub-tabs/PipelineActivitySubTab.tsx`
  - `Backend/src/api/routes/pipeline.routes.ts`
- Fix area:
  - expand backend activity semantics or rename tab to audit history

### CONN-001
- Severity: `HIGH`
- Status: `PARTIAL`
- Module/Object: Connection workspace
- Action: Save connection
- Trace:
  - local fields -> `api.updateConnection(connectionId, formData)`
  - error path swallowed
  - no refetch after save
  - tab marked saved after request regardless of returned payload shape
- Evidence:
  - `Frontend/src/components/connection/ConnectionWorkspace.tsx:341-348`
- Fix area:
  - explicit payload mapper, error handling, reload after save

### CONN-002
- Severity: `HIGH`
- Status: `PARTIAL`
- Module/Object: Connection workspace
- Action: Header-level `Test`
- Trace:
  - header action directly calls `api.testConnectionById(connectionId)`
  - response ignored
  - no status refresh
  - no success/failure display
- Evidence:
  - `Frontend/src/components/connection/ConnectionWorkspace.tsx:361-366`
- Fix area:
  - route through same stateful connectivity test flow or remove duplicate action

### CONN-003
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Connection workspace
- Actions: Usage / history / permissions
- Trace:
  - usage tab placeholder text
  - history grid empty rows
  - permissions grid empty rows
- Evidence:
  - `Frontend/src/components/connection/ConnectionWorkspace.tsx:383-386`
- Fix area:
  - add connection usage/history/permissions APIs and loaders

### GOV-API-001
- Severity: `CRITICAL`
- Status: `BROKEN`
- Module/Object: Governance API contract
- Action: Update user
- Trace:
  - frontend client exposes `updateUser(id, data)` -> `PUT /governance/users/:id`
  - backend route surface has no matching `PUT /users/:id`
- Evidence:
  - `Frontend/src/services/api.ts:352`
  - `Backend/src/api/routes/governance.routes.ts`
- Fix area:
  - add matching route/service/repository/procedure or remove client method

### AUTHZ-001
- Severity: `CRITICAL`
- Status: `PARTIAL`
- Module/Object: Backend authorization
- Action scope: API protection beyond authentication
- Trace:
  - `authGuard` is mounted on `/api`
  - `requirePermission()` middleware exists
  - repo-wide search found no route usage of `requirePermission()`
- Evidence:
  - `Backend/src/api/server.ts:63-75`
  - `Backend/src/api/middleware/rbac.middleware.ts`
- Impact:
  - Authenticated users may reach routes without permission enforcement.
- Fix area:
  - apply RBAC middleware to sensitive CRUD/run/admin routes

### API-001
- Severity: `CRITICAL`
- Status: `STUB`
- Module/Object: Pipeline permissions backend
- Action: Get/update pipeline permissions
- Trace:
  - GET returns `{ grants: [], inheritFromProject: true }`
  - PUT returns `{ success: true }`
  - no DB read/write
- Evidence:
  - `Backend/src/api/routes/pipeline.routes.ts:250-251`
- Fix area:
  - implement real permissions persistence and validation

### API-002
- Severity: `CRITICAL`
- Status: `STUB`
- Module/Object: Orchestrator permissions backend
- Action: Get/update orchestrator permissions
- Trace:
  - GET returns static empty grants
  - PUT returns static success
  - no DB read/write
- Evidence:
  - `Backend/src/api/routes/orchestrators.routes.ts:164-167`
- Fix area:
  - implement real permissions persistence and validation

### API-003
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Pipeline lineage backend
- Action: Get lineage
- Trace:
  - returns current pipeline node only with no edges
- Evidence:
  - `Backend/src/api/routes/pipeline.routes.ts:184-187`
- Fix area:
  - replace stub with lineage query/service

### API-004
- Severity: `HIGH`
- Status: `BROKEN`
- Module/Object: Orchestrator list backend
- Action: List project orchestrators
- Trace:
  - frontend client expects `/projects/:projectId/orchestrators`
  - backend server mounts `/api/orchestrators`
  - current orchestrator route file exposes `/global`, `/:id`, create/update/delete/run/permissions/audit`
  - no `GET /api/orchestrators` list route found
- Evidence:
  - `Frontend/src/services/api.ts`
  - `Backend/src/api/routes/orchestrators.routes.ts:4-12`
- Fix area:
  - add list route(s) or change frontend to existing route surface

### PROJ-006
- Severity: `CRITICAL`
- Status: `BROKEN`
- Module/Object: Project workspace
- Field group: `name`, `description`, `defaultEnvironment`, `owner`, `tags`, `labels`
- Trace:
  - UI form uses local keys `name`, `description`, `defaultEnvironment`, `owner`, `tags`, `labels`
  - frontend API client types project update around `projectDisplayName` and `projectDescText`
  - backend update route only reads `projectDisplayName` and `projectDescText`
  - workspace sends raw `formData` without mapping
- Evidence:
  - `Frontend/src/components/project/ProjectWorkspace.tsx:158-169`
  - `Frontend/src/components/project/ProjectWorkspace.tsx:193`
  - `Frontend/src/services/api.ts:63-64`
  - `Backend/src/api/routes/projects.routes.ts:104-110`
- Impact:
  - Edits made in visible project fields are not aligned to the backend contract.
  - Extra business fields shown in UI have no proven persistence path.
- Fix area:
  - introduce explicit UI<->API project mapper and remove unsupported editable fields until backed

### USER-004
- Severity: `CRITICAL`
- Status: `BROKEN`
- Module/Object: User workspace
- Field group: user detail mapping / roles display
- Trace:
  - backend returns `userId`, `email`, `displayName`, `isActive`, `roles`
  - frontend loader expects `user_id`, `user_login_name`, `user_full_name`, `user_email`, `is_active_flag`
  - access tab casts `roles` to `string[]`
  - backend actually returns role objects `{ roleId, roleName }`
- Evidence:
  - `Backend/src/api/routes/governance.routes.ts:94-101`
  - `Frontend/src/components/governance/UserWorkspace.tsx:237-257`
  - `Frontend/src/components/governance/UserWorkspace.tsx:111-125`
- Impact:
  - User profile fields can remain on defaults even when backend data exists.
  - Role rendering is type-incompatible with the backend payload and is not trustworthy.
- Fix area:
  - normalize governance DTOs and add a typed mapper before setting local form state

### ORCH-007
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Orchestrator workspace
- Action: Permissions tab context binding
- Trace:
  - workspace resolves `orchId`
  - permissions sub-tab is rendered without `orchId`
  - permissions sub-tab itself uses local mock grants and does not know which orchestrator it is editing
- Evidence:
  - `Frontend/src/components/orchestrator/OrchestratorWorkspace.tsx:39`
  - `Frontend/src/components/orchestrator/OrchestratorWorkspace.tsx:68`
  - `Frontend/src/components/orchestrator/sub-tabs/OrchestratorPermissionsSubTab.tsx:35-60`
- Impact:
  - Even if backend permissions endpoints were implemented later, the current tab component is not wired with object identity.
- Fix area:
  - pass `orchId` into the sub-tab and bind all mutations to that object

### PIPE-004
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Pipeline alerts
- Action: Add / edit / delete / enable alert rules
- Trace:
  - component accepts `pipelineId`
  - no API client imported
  - `pipelineId` is unused
  - rules live only in local React state
- Evidence:
  - `Frontend/src/components/pipeline/sub-tabs/PipelineAlertsSubTab.tsx:54-72`
  - `Frontend/src/components/pipeline/sub-tabs/PipelineAlertsSubTab.tsx:74-195`
- Impact:
  - Alert rules are lost on refresh and have no backend existence.
- Fix area:
  - define alert rule API/repository/procedure chain or remove the tab until implemented

### PIPE-005
- Severity: `MEDIUM`
- Status: `PARTIAL`
- Module/Object: Pipeline parameters
- Action: Load parameters
- Trace:
  - load calls `/pipelines/:id/parameters`
  - failure path writes only to `console.error`
  - UI does not expose parameter load failure to the user
- Evidence:
  - `Frontend/src/components/pipeline/sub-tabs/PipelineParametersSubTab.tsx:28-37`
- Impact:
  - Parameters can fail to load while the screen degrades silently into empty/default state from the user’s perspective.
- Fix area:
  - show a visible error state and retry path for parameter load failures

### API-005
- Severity: `CRITICAL`
- Status: `BROKEN`
- Module/Object: Pipeline backend model
- Action scope: pipeline list / validate / generate / artifacts / history / executions
- Trace:
  - active route file mixes two persistence models
  - `GET /api/pipelines/:id`, `PUT /api/pipelines/:id`, `POST /api/pipelines/:id/run` use `catalog.*` + `execution.*`
  - `GET /api/pipelines`, `POST /api/pipelines/:id/validate`, `POST /api/pipelines/:id/generate`, artifact/history/execution endpoints delegate to `pipelineController`
  - controller delegates to `pipelineRepository` and `artifactRepository`
  - repositories target legacy unqualified tables `pipelines`, `pipeline_versions`, `generated_artifacts`, `pipeline_executions`
  - backend migrations create those legacy tables separately from golden-source `catalog.pipelines` / `catalog.pipeline_versions`
- Evidence:
  - `Backend/src/api/routes/pipeline.routes.ts:43-67`
  - `Backend/src/api/routes/pipeline.routes.ts:70-163`
  - `Backend/src/db/repositories/pipeline.repository.ts:54-205`
  - `Backend/src/db/repositories/artifact.repository.ts:49-168`
  - `Backend/src/db/migrations/001_create_codegen_tables.sql:7-98`
  - `database/schema/base_tables.sql:329-359`
- Impact:
  - Different pipeline endpoints are not operating on a single canonical backend model.
  - A pipeline fetched from the designer path is not proven to be the same pipeline seen by validation/codegen/history paths.
- Fix area:
  - collapse all pipeline routes onto one schema/model
  - remove or migrate legacy `pipelines` / `pipeline_versions` / `generated_artifacts` / `pipeline_executions`

### API-006
- Severity: `HIGH`
- Status: `PARTIAL`
- Module/Object: Pipeline save endpoint
- Action: `PUT /api/pipelines/:id`
- Trace:
  - route decides "rename mode" when `pipelineDisplayName !== undefined && body.nodes === undefined`
  - rename path updates only `catalog.pipelines`
  - versioned save path calls `catalog.pr_commit_pipeline_version`
- Evidence:
  - `Backend/src/api/routes/pipeline.routes.ts:111-132`
- Impact:
  - Metadata-only save requests can be silently routed into rename-only behavior with no version/body persistence.
- Fix area:
  - use explicit action intent or stricter payload validation instead of `nodes === undefined` heuristic

### API-007
- Severity: `HIGH`
- Status: `PARTIAL`
- Module/Object: Pipeline audit backend
- Action: `GET /api/pipelines/:id/audit-logs`
- Trace:
  - route queries `history.pipelines_history`
  - catch block returns `success: true, data: []`
  - failure is indistinguishable from no history
- Evidence:
  - `Backend/src/api/routes/pipeline.routes.ts:253-273`
- Impact:
  - Audit failures are masked as empty history.
- Fix area:
  - propagate/log backend errors instead of returning false-empty success

### API-008
- Severity: `HIGH`
- Status: `PARTIAL`
- Module/Object: Orchestrator audit backend
- Action: `GET /api/orchestrators/:id/audit-logs`
- Trace:
  - route queries `history.orchestrators_history`
  - catch block returns `success: true, data: []`
  - failure is masked
- Evidence:
  - `Backend/src/api/routes/orchestrators.routes.ts:171-191`
- Impact:
  - Broken audit trail looks the same as "no entries".
- Fix area:
  - remove swallowed catch and align with global error/logging policy

### API-009
- Severity: `HIGH`
- Status: `BROKEN`
- Module/Object: Execution backend
- Actions: Cancel pipeline run / cancel orchestrator run
- Trace:
  - cancel routes issue guarded `UPDATE ... WHERE status IN (...)`
  - neither route checks `rowCount`
  - both return `{ success: true }` even if no run existed or no state transition happened
- Evidence:
  - `Backend/src/api/routes/executions.routes.ts:359-371`
  - `Backend/src/api/routes/executions.routes.ts:524-536`
- Impact:
  - UI can show successful cancellation for no-op requests.
- Fix area:
  - check affected rows and return 404/409-style responses for invalid cancel attempts

### API-010
- Severity: `HIGH`
- Status: `BROKEN`
- Module/Object: Execution backend
- Action: `GET /api/executions/orchestrator-runs/:runId`
- Trace:
  - endpoint returns orchestrator data in pipeline-shaped fields
  - `pipelineRunId <- orch_run_id`
  - `pipelineName <- orchestrator_name`
  - `versionLabel` forced to empty string
  - `slaStatus` forced to `N_A`
  - `nodes` forced to `[]`
- Evidence:
  - `Backend/src/api/routes/executions.routes.ts:478-495`
- Impact:
  - Contract is semantically misleading and hides missing orchestrator-detail implementation.
- Fix area:
  - define a real orchestrator-run DTO or explicitly documented shared execution DTO

### API-011
- Severity: `HIGH`
- Status: `BROKEN`
- Module/Object: Connection test backend
- Action: Persist connection test history
- Trace:
  - service calls `connectionsRepository.recordTestResult(...)` after plugin test
  - repository inserts into `catalog.connection_test_results`
  - insert uses columns `test_latency_ms`, `test_steps_json`, `test_error_text`
  - declared table schema uses `response_time_ms`, `error_message_text`, and has no `test_steps_json`
  - repository catches the resulting failure and logs a debug message only
- Evidence:
  - `Backend/src/api/services/connections.service.ts:284-291`
  - `Backend/src/db/repositories/connections.repository.ts:391-412`
  - `database/schema/base_tables.sql:1079-1086`
- Impact:
  - Live test may run, but historical test evidence is not persisted.
- Fix area:
  - align repository insert statement with actual table schema or change schema intentionally

### API-012
- Severity: `HIGH`
- Status: `STUB`
- Module/Object: Connection list/get backend
- Field group: `healthStatusCode`
- Trace:
  - connection summary mapper forces `healthStatusCode: 'UNKNOWN'`
  - repository already contains a health lookup and DB schema contains `catalog.connector_health`
- Evidence:
  - `Backend/src/api/services/connections.service.ts:438-448`
  - `Backend/src/db/repositories/connections.repository.ts:363-384`
  - `database/schema/base_tables.sql:1334-1343`
- Impact:
  - Connection health shown through summary DTOs is static placeholder data.
- Fix area:
  - derive health from repository or remove the field from the summary until real

### API-013
- Severity: `MEDIUM`
- Status: `MISSING`
- Module/Object: User backend
- Action: `GET /api/me`
- Trace:
  - `user.routes.ts` defines `GET /me`
  - server does not mount `userRouter`
  - frontend uses `/api/auth/me`, not `/api/me`
- Evidence:
  - `Backend/src/api/routes/user.routes.ts:1-12`
  - `Backend/src/api/server.ts:61-75`
  - `Frontend/src/services/api.ts:41-42`
- Impact:
  - Dead endpoint and duplicate user-profile surface remain in the codebase.
- Fix area:
  - remove dead route or mount it intentionally and document why both paths exist

### API-014
- Severity: `HIGH`
- Status: `BROKEN`
- Module/Object: Legacy execution controller/repository path
- Action scope: history / logs via alternate controller
- Trace:
  - `execution.controller.ts` documents history/log endpoints
  - no mounted routes use that controller
  - repository expects `version_id` from `execution.fn_get_pipeline_run_history`
  - SQL function does not return `version_id`
  - repository also participates in backend build failures via missing API types
- Evidence:
  - `Backend/src/api/controllers/execution.controller.ts:5-29`
  - `Backend/src/db/repositories/execution.repository.ts:92-107`
  - `database/logic/execution_logic.sql:31-42`
- Impact:
  - Dead execution stack exists with incorrect field mapping and compile issues.
- Fix area:
  - remove dead stack or migrate active routes onto a corrected repository implementation

### API-015
- Severity: `MEDIUM`
- Status: `PARTIAL`
- Module/Object: Node template backend
- Action: `POST /api/node-templates`
- Trace:
  - route is protected by `authGuard` globally
  - route does not use `userIdMiddleware`
  - create path reads `req.headers['x-user-id']` directly for `createdBy`
- Evidence:
  - `Backend/src/api/server.ts:64-70`
  - `Backend/src/api/routes/node-template.routes.ts:25-32`
- Impact:
  - Identity source for template creation is weaker and less consistent than the rest of the API.
- Fix area:
  - use authenticated request identity via middleware, not raw client header trust

### API-016
- Severity: `HIGH`
- Status: `MISSING`
- Module/Object: Connection API contract
- Action: `POST /api/connections/test`
- Trace:
  - frontend client exposes `testConnection(config)` -> `/connections/test`
  - backend routes only expose `POST /api/connections/:id/test`
- Evidence:
  - `Frontend/src/services/api.ts:272-274`
  - `Backend/src/api/routes/connections.routes.ts:62`
- Impact:
  - Unsaved connection test flow has no server implementation.
- Fix area:
  - add unsaved-config test route or remove the client method and any UI that depends on it

### API-017
- Severity: `HIGH`
- Status: `MISSING`
- Module/Object: Preview API contract
- Action: `GET /api/nodes/:nodeId/preview`
- Trace:
  - frontend client exposes `getPreview(nodeId)` -> `/nodes/${nodeId}/preview`
  - `DataPreviewPanel` calls that method
  - no backend route exists for node preview
- Evidence:
  - `Frontend/src/services/api.ts:136-138`
  - `Frontend/src/components/preview/DataPreviewPanel.tsx:28`
  - repo-wide route search found no `/nodes/:nodeId/preview`
- Impact:
  - Data preview UI cannot execute end to end.
- Fix area:
  - add preview backend route/service/query path or remove the UI action

### API-018
- Severity: `CRITICAL`
- Status: `BROKEN`
- Module/Object: Legacy pipeline list backend
- Action: `GET /api/pipelines`
- Trace:
  - route delegates to `pipelineController.list`
  - controller reads `orderBy` and `orderDir` directly from query params
  - repository interpolates them into SQL string: `ORDER BY ${orderCol} ${orderDir}`
  - runtime validation is not enforced; TypeScript union types do not sanitize incoming strings
- Evidence:
  - `Backend/src/api/controllers/pipeline.controller.ts:38-45`
  - `Backend/src/db/repositories/pipeline.repository.ts:117-126`
- Impact:
  - Query-ordering inputs are SQL-injection-capable if this legacy endpoint is reachable.
- Fix area:
  - whitelist order columns/directions at runtime before SQL assembly or use fixed mapping

### API-019
- Severity: `MEDIUM`
- Status: `BROKEN`
- Module/Object: Folder / orchestrator delete backend
- Actions: `DELETE /api/folders/:id`, `DELETE /api/orchestrators/:id`
- Trace:
  - both routes execute `DELETE ... WHERE id = $1`
  - neither checks `rowCount`
  - both return success unconditionally
- Evidence:
  - `Backend/src/api/routes/folders.routes.ts:239-247`
  - `Backend/src/api/routes/orchestrators.routes.ts:129-137`
- Impact:
  - UI can receive successful deletion for nonexistent objects.
- Fix area:
  - verify affected rows and return 404 when nothing was deleted

### SYS-004
- Severity: `CRITICAL`
- Status: `BROKEN`
- Module/Object: Frontend build verification
- Action: `npm run build`
- Trace:
  - command executed in `Frontend/`
  - TypeScript compilation fails before Vite build completes
- Evidence:
  - command output: `tsconfig.json(18,35): error TS5096: Option 'allowImportingTsExtensions' can only be used when either 'noEmit' or 'emitDeclarationOnly' is set.`
  - `Frontend/tsconfig.json`
- Impact:
  - Frontend does not pass its declared build path.
- Fix area:
  - align `allowImportingTsExtensions` usage with TypeScript emit settings or remove it from build config

### SYS-005
- Severity: `HIGH`
- Status: `BROKEN`
- Module/Object: Frontend test verification
- Action: `npm test -- --run`
- Trace:
  - command executed in `Frontend/`
  - Vitest exits immediately on missing dependency
- Evidence:
  - command output: `MISSING DEPENDENCY  Cannot find dependency 'jsdom'`
  - `Frontend/package.json`
  - `Frontend/vitest.config.ts`
- Impact:
  - Frontend test runner is not operational in the checked-in workspace.
- Fix area:
  - add `jsdom` or reconfigure Vitest environment to match installed dependencies

### API-020
- Severity: `HIGH`
- Status: `BROKEN`
- Module/Object: Pipeline save contract
- Action: Save pipeline from workspace/header
- Trace:
  - frontend stores active pipeline as `{ id, projectId, name, description, nodes, edges, ... }`
  - workspace save calls `api.savePipeline(activePipeline.id, activePipeline)`
  - backend save route looks for `pipelineDisplayName`, `pipelineDescText`, `nodes`, `edges`, `uiLayout`
  - name/description keys do not match backend rename/save keys
- Evidence:
  - `Frontend/src/components/pipeline/PipelineWorkspace.tsx:63-74`
  - `Frontend/src/components/pipeline/PipelineWorkspace.tsx:85-94`
  - `Frontend/src/components/layout/Header.tsx:97-107`
  - `Backend/src/api/routes/pipeline.routes.ts:109-132`
- Impact:
  - General save path does not prove persistence of visible pipeline name/description edits.
- Fix area:
  - add explicit UI->API payload mapping for pipeline saves

### API-021
- Severity: `HIGH`
- Status: `BROKEN`
- Module/Object: Pipeline code generation contract
- Action: Generate code for selected target
- Trace:
  - code tab sends `api.generateCode(pipelineId, { technology: target })`
  - API client posts that object directly as request body
  - backend controller reads `req.body?.options` and ignores top-level `technology`
- Evidence:
  - `Frontend/src/components/pipeline/sub-tabs/PipelineCodeSubTab.tsx:73-85`
  - `Frontend/src/services/api.ts:116-118`
  - `Backend/src/api/controllers/pipeline.controller.ts:103-109`
- Impact:
  - User-selected target technology is not guaranteed to influence backend code generation.
- Fix area:
  - send `{ options: { technology } }` or change backend contract to accept top-level options

### API-022
- Severity: `HIGH`
- Status: `PARTIAL`
- Module/Object: Pipeline run contract
- Action: Run pipeline with environment/technology selections
- Trace:
  - execution UI captures `environment` and `technology`
  - frontend calls `api.runPipeline(pipelineId, { environment, technology })`
  - backend route inserts a run with `trigger_type_code = 'MANUAL'` and ignores request body entirely
- Evidence:
  - `Frontend/src/components/pipeline/sub-tabs/ExecutionSubTab.tsx:33-35`
  - `Frontend/src/components/pipeline/sub-tabs/ExecutionSubTab.tsx:96-102`
  - `Frontend/src/services/api.ts:108-110`
  - `Backend/src/api/routes/pipeline.routes.ts:165-180`
- Impact:
  - Run configuration choices shown to the user are not wired into backend execution state.
- Fix area:
  - persist/run against explicit environment and technology inputs or remove those controls

### API-023
- Severity: `MEDIUM`
- Status: `PARTIAL`
- Module/Object: Orchestrator run contract
- Action: Run orchestrator with options
- Trace:
  - frontend API exposes `runOrchestrator(id, { environment, concurrency })`
  - backend route for `POST /api/orchestrators/:id/run` ignores request body and inserts a generic `PENDING` manual run
- Evidence:
  - `Frontend/src/services/api.ts:173-175`
  - `Backend/src/api/routes/orchestrators.routes.ts:143-158`
- Impact:
  - Any future UI using orchestrator run options will not affect backend behavior.
- Fix area:
  - align run request payload with actual backend execution contract

### ORCH-001
- Severity: `CRITICAL`
- Status: `STUB`
- Module/Object: Orchestrator properties sub-tab
- Action scope: load/edit/save orchestrator properties
- Trace:
  - component seeds local state with placeholder fields
  - no load effect
  - no API client imported
  - edits only mutate local React state and call `onDirty`
- Evidence:
  - `Frontend/src/components/orchestrator/sub-tabs/OrchestratorPropertiesSubTab.tsx:21-48`
  - `Frontend/src/components/orchestrator/sub-tabs/OrchestratorPropertiesSubTab.tsx:50-92`
- Impact:
  - Orchestrator properties screen is a UI shell with no persistence path.
- Fix area:
  - load real orchestrator DTO, map editable fields explicitly, and wire save/update endpoint

### DB-001
- Severity: `MEDIUM`
- Status: `PARTIAL`
- Module/Object: Folder backend vs DB procedures
- Action scope: create/delete folder
- Trace:
  - backend folder routes compute LTREE paths and issue direct `INSERT` / `DELETE`
  - database already defines `etl.pr_create_folder(...)` and `etl.pr_delete_folder(...)`
- Evidence:
  - `Backend/src/api/routes/folders.routes.ts:154-190`
  - `Backend/src/api/routes/folders.routes.ts:239-247`
  - `database/logic/hierarchy_logic.sql:103-140`
- Impact:
  - Folder path semantics are implemented twice, increasing drift risk between route logic and DB logic.
- Fix area:
  - move folder create/delete onto the existing DB procedures or retire the procedures explicitly

### DB-002
- Severity: `MEDIUM`
- Status: `PARTIAL`
- Module/Object: Orchestrator backend vs DB procedures
- Action scope: create/delete orchestrator
- Trace:
  - backend orchestrator routes use direct `INSERT` / `DELETE`
  - database already defines `catalog.pr_create_orchestrator(...)` and `catalog.pr_delete_orchestrator(...)`
- Evidence:
  - `Backend/src/api/routes/orchestrators.routes.ts:77-96`
  - `Backend/src/api/routes/orchestrators.routes.ts:129-137`
  - `database/logic/pipeline_logic.sql:122-142`
- Impact:
  - Canonical orchestrator CRUD behavior is split between route SQL and DB procedures.
- Fix area:
  - route create/delete should call the declared procedures or the procedures should be removed from the supported path

### DB-003
- Severity: `LOW`
- Status: `PARTIAL`
- Module/Object: Connection health backend vs DB functions
- Action scope: read connector health
- Trace:
  - repository reads `catalog.connector_health` directly and swallows any error as "table may not exist"
  - database defines `catalog.fn_get_connector_health(...)`
  - schema also declares `catalog.connector_health` as part of the golden-source install
- Evidence:
  - `Backend/src/db/repositories/connections.repository.ts:363-384`
  - `database/logic/catalog_logic.sql:244-259`
  - `database/schema/base_tables.sql:1334-1343`
- Impact:
  - Active read path does not use the DB function intended for UI consumption and assumes schema absence that the golden-source schema already contradicts.
- Fix area:
  - use `catalog.fn_get_connector_health` or tighten direct-query error handling to actual failure modes

## Static / Mock / Placeholder Field Ledger

- `GovernanceView.mockActivities` -> static activity sidebar data.
- `MetadataBrowserWorkspace.data` -> static metadata object field values.
- `MetadataBrowserWorkspace.columns` -> empty static array.
- `OrchestratorPermissionsSubTab.INITIAL_GRANTS` -> static permissions dataset.
- `OrchestratorOverviewSubTab.MOCK_RUNS` -> static run history.
- `OrchestratorOverviewSubTab.MOCK_PIPELINES` -> static pipeline membership.
- `OrchestratorAuditLogsSubTab.MOCK_ENTRIES` -> static audit history.
- `ProjectWorkspace` default stats (`folderCount`, `pipelineCount`, `orchestratorCount`, `connectionCount`, `memberCount`) stay local unless `getProject` happens to return them.
- `FolderWorkspace` default metadata fields are local placeholders only.
- `ConnectionWorkspace` security fields (`secretSource`, `rotationPolicy`, `maskingStatus`) are seeded locally and not proven to come from backend.

## Logging Gaps Ledger

- Header toolbar actions swallow errors with empty catches; failure context is lost in UI:
  - `Frontend/src/components/layout/Header.tsx`
- Project save swallows exceptions:
  - `Frontend/src/components/project/ProjectWorkspace.tsx`
- Folder save is fake and has no backend/logging path:
  - `Frontend/src/components/folder/FolderWorkspace.tsx`
- Connection save swallows exceptions:
  - `Frontend/src/components/connection/ConnectionWorkspace.tsx`
- Pipeline permissions UI swallows persistence failures:
  - `Frontend/src/components/pipeline/sub-tabs/PermissionsSubTab.tsx`
- Backend migration runner still uses `console.log` rather than platform logger:
  - `Backend/src/db/migration-runner.ts`

## Next Audit Targets

- Trace project/folder/pipeline/orchestrator create flows end to end including dialogs, thunks, routes, and SQL.
- Trace monitor/execution screens to confirm run, retry, cancel, detail, logs, and KPI coverage.
- Trace connection CRUD/test/health/list schemas/tables flows.
- Verify backend route-to-query/procedure coverage against SQL in `database/logic/*.sql`.
- Build CRUD completeness matrix by object type.
