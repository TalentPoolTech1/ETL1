1. Summary and Scope

Scope

    Single pipeline workspace presented as a tab in the main workspace.

    Under the pipeline tab, a sub‑tab row exposes: Editor (default), Overview, Execution History, Lineage, Permissions, Audit Logs, Execution.

    Each sub‑tab is a first‑class view; users can switch instantly without losing editor state.

    All interactions are audited and versioned; every execution row links to the execution log (metalink) and Monitor view.

Primary goals

    Make editing the pipeline the primary, immediate action (Editor default).

    Provide operational and governance views directly beneath the pipeline tab.

    Preserve tabbed workspace behavior: opening a pipeline creates a top‑level tab; sub‑tabs are internal to that tab.

    Ensure consistent UX, accessibility, and enterprise governance.

2. Global UI and Navigation (Tab + Sub‑tabs)

Top‑level pipeline tab

    Tab header: pipeline name (editable), status badge, quick actions (Run, Schedule, Clone, Export, More).

    Sub‑tab row: immediately below header, height 40px, items in order: Editor (default), Overview, Execution History, Lineage, Permissions, Audit Logs, Execution. Active sub‑tab shows 3px primary underline.

Sub‑tab semantics

    Editor: default landing when opening a pipeline tab. Editor state persists when switching sub‑tabs.

    Switching: switching sub‑tabs does not discard unsaved editor changes; unsaved indicator shown; switching prompts only if user attempts destructive action (e.g., close tab).

    Deep linking: each sub‑tab has a unique URL fragment so users can bookmark or share links to a specific sub‑tab (e.g., /pipelines/{id}#editor, #execution-history).

    Keyboard navigation: Ctrl/Cmd+1 → Editor, Ctrl/Cmd+2 → Overview, Ctrl/Cmd+3 → Execution History, Ctrl/Cmd+4 → Lineage, Ctrl/Cmd+5 → Permissions, Ctrl/Cmd+6 → Audit Logs, Ctrl/Cmd+7 → Execution.

State persistence

    Editor layout, zoom, selection, and unsaved changes persist per user session and are restored on tab reopen.

    Sub‑tab scroll positions persist per pipeline tab.

3. Editor Sub‑tab — Detailed Requirements (Default)

Purpose

    Provide the primary design surface for building and editing the pipeline: canvas, component palette, properties, multi‑transform editor, validation, run preview, and save/commit controls.

Layout

    Header area: pipeline name (editable), orchestrator name (editable), Save, Save & Run, Revert, Version dropdown, Run button.

    Left rail: component palette (Sources, Transforms, Targets, Utilities), Projects/Connections quick access.

    Center: pipeline canvas (grid, zoom, pan).

    Right rail: properties panel for selected node(s) and Multi‑Transform editor access.

    Bottom: data preview and validation console (default collapsed to 260px).

    Sub‑tab bar: remains visible; Editor is highlighted.

Editor behaviors

    Open pipeline: Editor loads by default and focuses the canvas.

    Auto‑validate: background validation runs on edits; errors/warnings surfaced in the validation console and inline on nodes.

    Save semantics: Save persists a draft version; Save & Run persists and triggers an execution (opens Execution sub‑tab). Each save creates a version entry in Overview and Audit Logs.

    Undo/Redo: local per‑tab undo stack; Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z.

    Collaborative presence: show collaborators editing the pipeline and node locks; live cursors optional.

Editor features

    Multi‑Transform integration: open column multi‑transform editor from node properties; sequence steps persist as part of node configuration.

    Inline SQL editor: for custom transforms, embedded Monaco editor with autocomplete for column names and functions.

    Preview on node: run node‑level preview using sample rows; preview results shown in bottom panel.

    Versioning: quick access to node and pipeline version history; ability to revert node config or pipeline to previous version.

    Designer actions: align/distribute, auto‑layout, group/ungroup, collapse/expand groups, comment threads on nodes.

Editor performance targets

    Canvas interactive P95 ≤ 50ms for up to 500 nodes.

    Node preview (sample 100 rows) P95 ≤ 1s on warmed preview service.

4. Other Sub‑tabs — Behavior and Requirements
Overview

    Editable fields: pipeline name, description, orchestrator mapping, tags, environment. Inline edits create audit entries.

    Health & metrics: last 5 runs, success rate, average duration, last error snippet.

    Quick actions: Run, Schedule, Clone, Export, Open Designer (focuses Editor).

    Dependencies summary: counts and links to Lineage.

Execution History

    Table: Run ID, Start/End, Duration, Status, Triggered By, Orchestrator, Artifacts, Actions.

    Metalink: each run row includes a Log metalink that opens the execution log in a new tab or side panel; same metalink used by Monitor.

    Bulk actions: retry, cancel, export artifacts.

    Filters: date range, status, user, orchestrator, tags.

Lineage

    Graph: interactive upstream/downstream graph; pipeline node centered.

    References list: where pipeline is used in orchestrators, dashboards, other pipelines.

    Impact analysis: run to produce report and list of affected objects.

Permissions

    RBAC UI: assign Viewer/Editor/Owner roles to users/groups/service accounts.

    Inheritance: toggle to inherit from project; break inheritance with warning.

    Time‑bound grants: set expiry and justification.

Audit Logs

    Immutable timeline: timestamp, user, action, summary, diff link.

    Diff viewer: humanized field diffs and JSON diff; ability to create revert request.

    Export: export audit slice for compliance.

Execution

    Run configuration: parameters, environment, secrets reference, schedule override.

    Live console: streaming logs, step timeline, metrics, artifacts.

    Actions: Pause, Resume, Stop, Retry Step, Skip Step.

    Linking: starting a run creates an execution record visible in Execution History and Monitor; execution rows include metalinks to open logs.

5. Data Model, APIs, and Integration Points

Metadata entities (additions for Editor)

    PipelineEditorState: { pipelineId, userId, layout, zoom, selection, unsavedChanges, lastSavedVersion } persisted as ephemeral drafts and optionally saved to catalog.

    NodeConfig: { nodeId, type, properties, transforms, version } where transforms contains Multi‑Transform JSON.

    ExecutionLink: { runId, pipelineId, logUrl, monitorUrl } used to create metalinks.

APIs (new/updated)

    GET /pipelines/{id}/editor-state — fetch persisted editor state for user.

    PATCH /pipelines/{id}/editor-state — save ephemeral editor state.

    POST /pipelines/{id}/save — commit pipeline changes (creates version).

    POST /pipelines/{id}/runs — start run; returns runId and logUrl.

    GET /pipelines/{id}/executions — list runs (existing).

    GET /executions/{runId}/log — returns metalink and streaming endpoint (existing).

    GET /pipelines/{id}/lineage — returns graph nodes/edges.

    POST /pipelines/{id}/impact — run impact analysis.

Editor → Execution integration

    Save & Run composes pipeline config and node transforms into IR, triggers code generation, and starts run. Execution record includes logUrl used by Execution History and Monitor.

Security & governance

    Editor actions require Edit permission; Save & Run requires Run permission. All actions logged to Audit Logs.

6. Acceptance Criteria, Testing, and Deliverables

Acceptance criteria (editor + sub‑tabs)

    Default landing: opening a pipeline tab focuses Editor by default.

    State persistence: editor layout and unsaved changes persist across sub‑tab switches and are restored on reopen.

    Sub‑tab switching: switching to Overview/Execution History/Lineage/Permissions/Audit Logs/Execution does not discard editor state; unsaved indicator visible.

    Inline rename: pipeline and orchestrator rename from Overview and Editor header persist and create audit entries.

    Execution metalink: every execution row in Execution History contains a working metalink to the execution log and Monitor.

    Save & Run: Save & Run triggers a run, creates execution record, and opens Execution sub‑tab with live console.

    Multi‑Transform: editor integrates Multi‑Transform editor; sequences persist in node config and are applied in generated code.

    Performance: Editor interactive P95 ≤ 50ms for 0–500 nodes; preview sample 100 rows P95 ≤ 1s.

    Security: RBAC enforced for Editor actions; audit entries created for all saves and runs.

    Accessibility: keyboard navigation and ARIA roles for Editor and sub‑tabs; WCAG 2.1 AA compliance.

Testing matrix

    Unit tests: editor state save/restore, node config CRUD, transform serialization.

    Integration tests: Save & Run flow, execution metalink resolution, sub‑tab switching with unsaved changes.

    E2E tests: open pipeline, edit nodes, add transforms, Save & Run, open execution log via metalink.

    Performance tests: canvas rendering and preview latency under representative loads.

    Security tests: permission enforcement for edit/run/save actions.

Deliverables

    Updated UI mockups showing pipeline tab with Editor default and sub‑tab row.

    Interactive prototype for Editor with state persistence and Save & Run flow.

    API OpenAPI spec updates for editor state endpoints and run integration.

    Test plan and automated test suites.

    Documentation for product and SRE runbooks for editor persistence and recovery.