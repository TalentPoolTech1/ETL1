# Monitor & Orchestrator — Enterprise ETL Platform
## Detailed Requirements Document v1.0

---

## Table of Contents

1. [Overview & Scope](#1-overview--scope)
2. [Monitor Module](#2-monitor-module)
   - 2.1 [Monitor Dashboard](#21-monitor-dashboard)
   - 2.2 [Execution List & Grid](#22-execution-list--grid)
   - 2.3 [Opening Execution as a Tab](#23-opening-execution-as-a-tab)
   - 2.4 [Execution Detail View](#24-execution-detail-view)
   - 2.5 [Auto-Refresh & Live Tracking](#25-auto-refresh--live-tracking)
   - 2.6 [Code Preservation](#26-code-preservation)
   - 2.7 [Execution Metrics Capture](#27-execution-metrics-capture)
   - 2.8 [Filtering & Search](#28-filtering--search)
   - 2.9 [Notifications & Alerts](#29-notifications--alerts)
   - 2.10 [Audit & Compliance](#210-audit--compliance)
   - 2.11 [Bulk Operations](#211-bulk-operations)
   - 2.12 [Export & Reporting](#212-export--reporting)
3. [Orchestrator Module](#3-orchestrator-module)
   - 3.1 [Orchestrator Dashboard](#31-orchestrator-dashboard)
   - 3.2 [Orchestrator Execution List](#32-orchestrator-execution-list)
   - 3.3 [Execution Groups — Parallel vs Serial](#33-execution-groups--parallel-vs-serial)
   - 3.4 [Pipeline Expand/Collapse View](#34-pipeline-expandcollapse-view)
   - 3.5 [Node-Level Success/Failure Mapping](#35-node-level-successfailure-mapping)
   - 3.6 [Orchestrator Opening as Tab](#36-orchestrator-opening-as-tab)
   - 3.7 [Orchestrator Filtering & Search](#37-orchestrator-filtering--search)
   - 3.8 [Retry, Skip & Override Controls](#38-retry-skip--override-controls)
   - 3.9 [Dependency Graph View](#39-dependency-graph-view)
   - 3.10 [SLA & Threshold Management](#310-sla--threshold-management)
4. [Shared Infrastructure](#4-shared-infrastructure)
   - 4.1 [Execution State Machine](#41-execution-state-machine)
   - 4.2 [Data Model — Executions](#42-data-model--executions)
   - 4.3 [Data Model — Metrics](#43-data-model--metrics)
   - 4.4 [Data Model — Orchestrators](#44-data-model--orchestrators)
   - 4.5 [API Contracts](#45-api-contracts)
   - 4.6 [WebSocket & Streaming](#46-websocket--streaming)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Security & RBAC](#6-security--rbac)
7. [UI/UX Standards](#7-uiux-standards)
8. [Acceptance Criteria Summary](#8-acceptance-criteria-summary)

---

## 1. Overview & Scope

### 1.1 Purpose
The Monitor and Orchestrator modules form the operational control center of the ETL platform. They provide real-time visibility, historical traceability, failure intelligence, performance analytics, and execution governance for every pipeline and orchestrated workflow executed within the system.

### 1.2 Guiding Principles
- **Zero blind spots**: Every byte of execution context is captured and queryable.
- **Developer-first**: Deep technical detail (logs, code, plans, metrics) is first-class.
- **Operations-grade**: SLA tracking, alerting, escalation, and compliance reporting.
- **Live by default**: Auto-refresh and streaming logs are on unless the user opts out.
- **Tab-native**: Every execution — pipeline or orchestrator — opens as a named, restorable tab inside the ETL workspace.
- **Immutable audit trail**: Captured data is append-only and tamper-evident.

### 1.3 Actors
| Actor | Role |
|---|---|
| ETL Developer | Creates, submits, debugs pipelines/orchestrators |
| Data Engineer | Monitors runs, interprets metrics, fixes failures |
| Operations / SRE | SLA monitoring, alerting, escalation |
| Data Steward | Audit, compliance, lineage tracing |
| Admin | RBAC, retention policies, system metrics |

---

## 2. Monitor Module

### 2.1 Monitor Dashboard

The Monitor module opens as a workspace tab. The default landing page is a **Dashboard** providing an at-a-glance operational summary.

#### 2.1.1 Dashboard Panels

**A. KPI Cards Row (Top)**
| Card | Metric | Computation |
|---|---|---|
| Total Executions Today | Count | All states, current calendar day |
| Running Now | Count | `status = RUNNING` at page load / last refresh |
| Success Rate (Today) | % | (SUCCESS / Total) × 100 |
| Failed (Today) | Count | `status = FAILED` current day |
| Avg Execution Time (Today) | Duration | mean(end_time - start_time) |
| SLA Breaches (Today) | Count | executions exceeding defined SLA threshold |
| Data Volume Processed (Today) | GB/TB | sum(bytes_read + bytes_written) |
| Active Users Running Jobs | Count | distinct submitted_by where status=RUNNING |

Each KPI card is:
- Clickable — clicking filters the execution grid to match
- Color-coded (green / amber / red) based on threshold
- Updatable on auto-refresh cycle

**B. Execution Status Donut Chart**
- Segments: PENDING, QUEUED, RUNNING, SUCCESS, FAILED, CANCELLED, SKIPPED, RETRYING
- Time range selector: Last 1h / 6h / 24h / 7d / 30d / Custom
- Clicking a segment filters the execution list

**C. Throughput Timeline Chart**
- Line chart: executions started vs completed per hour/day
- Overlay: failure rate line
- Brush/zoom selector for time range

**D. Top Failed Pipelines Table**
- Columns: Pipeline Name, Owner, Failure Count (selected period), Last Failure Time, Last Error Category
- Clickable row → opens execution detail

**E. Recent Activity Feed**
- Real-time stream of execution events: started / completed / failed / retried
- Max 50 entries, auto-scrolling, new entries highlighted
- Each entry is a metalink to the execution detail tab

**F. Execution Heatmap**
- Calendar heatmap (GitHub-style): each cell = one day, intensity = execution count
- Hover tooltip: date, count, success rate, failure count
- Click opens filtered execution list for that day

**G. User Activity Panel**
- Top 10 users by execution count (selected period)
- Bar chart + table
- Clickable user name → filters execution list by that user

**H. Resource Utilization Summary**
- CPU %, Memory %, Cluster queue depth
- Only if cluster/compute telemetry is wired to the platform

**I. Pipeline Health Scorecard**
- Table: Pipeline Name | Avg Duration (7d) | Success Rate (7d) | Trend (↑↓) | SLA Status
- Sortable columns

#### 2.1.2 Dashboard Controls
- **Refresh**: Manual button + auto-refresh toggle with interval selector (10s / 30s / 1m / 5m)
- **Date range**: Applied globally to all panels
- **My Jobs only**: Toggle to filter dashboard to executions by logged-in user
- **Save Layout**: Users can rearrange, show/hide panels; layout persisted per user in DB
- **Full Screen**: Each panel has full-screen expand mode
- **Export Dashboard**: PDF/PNG snapshot with timestamp watermark

---

### 2.2 Execution List & Grid

#### 2.2.1 Grid Columns (Default Visible)
| Column | Type | Notes |
|---|---|---|
| Execution ID | String/UUID | Truncated with copy icon; full on hover |
| Pipeline Name | Link | Metalink to pipeline editor |
| Version | String | Pipeline version at submission time |
| Status | Badge | Color-coded pill |
| Submitted By | String | Username + avatar |
| Submitted At | Datetime | Local timezone, relative time on hover |
| Started At | Datetime | When execution actually began (post-queue) |
| Ended At | Datetime | Null if still running |
| Duration | Duration | HH:MM:SS; animated for running jobs |
| Rows Processed | Number | Formatted (K/M/B) |
| Bytes Read | Size | Auto-scaled (KB/MB/GB/TB) |
| Bytes Written | Size | Auto-scaled |
| Trigger Type | Enum | MANUAL / SCHEDULED / API / ORCHESTRATOR |
| Environment | String | DEV / QA / STAGING / PROD |
| Cluster / Engine | String | Spark cluster name or local |
| Error Category | String | Null unless FAILED |
| Retry Count | Number | 0 if no retries |
| SLA Status | Badge | ON_TIME / AT_RISK / BREACHED / N/A |
| Tags | Tags | Colored tag pills |

#### 2.2.2 Grid Controls
- Column chooser: show/hide any column
- Column reorder: drag-and-drop
- Column resize: drag handles
- Sort: click header; multi-sort with Shift+Click
- Pinned columns: left-pin Execution ID, Pipeline Name by default
- Row selection: checkbox, select all on page, select all matching filter
- Density: Comfortable / Compact / Spacious
- Page size: 25 / 50 / 100 / 250
- Infinite scroll mode as alternative to pagination
- Row hover: shows quick action buttons (View / Retry / Cancel / Copy ID / Open in Tab)
- Row right-click context menu: all actions + "Copy Row as JSON"

#### 2.2.3 Status Badge Colors
| Status | Color |
|---|---|
| PENDING | Gray |
| QUEUED | Blue |
| RUNNING | Animated blue pulse |
| SUCCESS | Green |
| FAILED | Red |
| CANCELLED | Orange |
| SKIPPED | Light gray |
| RETRYING | Yellow pulse |
| TIMED_OUT | Dark red |
| PARTIALLY_COMPLETED | Amber |

---

### 2.3 Opening Execution as a Tab

#### 2.3.1 Tab Opening Mechanics
- **Double-click** on any execution row → opens execution detail as new tab
- **Click "Open in Tab"** from row quick actions
- **Click execution ID link** anywhere in the platform
- **Ctrl+Click** on row → opens without switching focus
- **URL deep-link**: `/workspace/monitor/executions/{execution_id}` resolves to the correct tab

#### 2.3.2 Tab Behavior
- Tab title: `[PipelineName] • [ShortExecID]` e.g. `CustomerLoad • e4f2a1`
- Tab icon: colored dot matching current execution status
- Tab icon animates (spinner) when status = RUNNING
- Tab icon auto-updates via WebSocket without manual refresh
- Multiple execution tabs can be open simultaneously
- Tabs survive page refresh (tab state persisted in localStorage + backend session)
- Tab close (×): prompts if execution is RUNNING — "Execution is still running. Close tab?" (Y/N)
- Tab drag-and-drop reordering
- Tab overflow: horizontal scroll with left/right arrows when tabs exceed width
- Tab context menu: Close / Close Others / Close All to the Right / Duplicate / Copy Link / Pin Tab
- Pinned tabs: smaller, icon-only, cannot be accidentally closed
- Tab tooltip on hover: full execution ID, pipeline name, status, submitted by, start time

#### 2.3.3 Tab Restoration
- On workspace reload, all previously open execution tabs are restored
- Restored tabs show cached last-known state while fetching fresh data
- Stale indicator shown if tab data is >60s old on restore

---

### 2.4 Execution Detail View

The execution detail tab has a sub-tab structure for organized navigation.

#### 2.4.1 Header Bar (Always Visible)
| Element | Detail |
|---|---|
| Execution ID | Full UUID with copy button |
| Pipeline Name | Metalink to pipeline editor (opens editor tab) |
| Pipeline Version | Version number with link to version history |
| Status Badge | Live-updated, animated if running |
| Progress Bar | % complete based on nodes completed / total nodes |
| Submitted By | User avatar + name |
| Environment | DEV/QA/PROD badge |
| Trigger Type | MANUAL / SCHEDULED / API / ORCHESTRATOR |
| SLA Indicator | ON_TIME / AT_RISK / BREACHED |
| Action Buttons | Retry / Cancel / Clone / Share / Export |

#### 2.4.2 Sub-Tab: Overview

**Timing Block**
- Submitted At, Queued At, Started At, Ended At
- Queue Wait Duration, Execution Duration, Total Wall Clock Duration
- Visual timeline bar: [Queued]→[Initializing]→[Running]→[Done]

**Execution Configuration**
- Environment variables passed at submission (masked if sensitive)
- Spark/compute configuration: executor count, memory, cores
- Runtime parameters / job arguments
- Connection aliases used
- Cluster name and version

**Error Summary** (if FAILED)
- Error category: DATA_ERROR / SCHEMA_MISMATCH / CONNECTION_FAILURE / TIMEOUT / OOM / PERMISSION / CUSTOM
- Error message (full, scrollable)
- Failed node name with metalink to Node Detail tab
- Stack trace (collapsible, monospaced)
- Suggested remediation hints (rule-based)

#### 2.4.3 Sub-Tab: Pipeline Canvas (Read-Only)

- Full read-only render of the pipeline canvas as it was at execution time (snapshot)
- Node coloring by execution status:
  - Gray = NOT_STARTED
  - Blue pulse = RUNNING
  - Green = SUCCESS
  - Red = FAILED
  - Orange = SKIPPED
  - Yellow = RETRYING
- Clicking a node → opens Node Detail panel (side drawer)
- Edge animation: data flowing (animated dashes) for RUNNING edges
- Minimap for large pipelines
- Zoom / pan controls
- Legend panel
- "Compare with Current Version" button: diff view showing what changed since execution

#### 2.4.4 Sub-Tab: Node Execution Detail

Table of all nodes in execution order:
| Column | Detail |
|---|---|
| Node Name | |
| Node Type | SOURCE / TRANSFORM / TARGET / JOIN / FILTER / AGGREGATE / CUSTOM |
| Status | Badge |
| Start Time | |
| End Time | |
| Duration | |
| Rows In | |
| Rows Out | |
| Rows Rejected | |
| Bytes Read | |
| Bytes Written | |
| CPU % (peak) | |
| Memory (peak) | |
| Error | Expandable |
| Retry Count | |

Clicking a node row → side drawer with:
- Full node configuration (JSON + visual form)
- Node-level log stream
- Node input/output schema
- Data preview (first 100 rows of output, if enabled)
- Lineage: upstream and downstream node links
- Node execution timeline bar
- Rejection log: rows that failed validation with reason

#### 2.4.5 Sub-Tab: Logs

- **Streaming log viewer** with:
  - Log level filter: ALL / DEBUG / INFO / WARN / ERROR / FATAL
  - Node filter: filter logs to specific node
  - Phase filter: INITIALIZATION / EXECUTION / TEARDOWN
  - Full-text search within logs (Ctrl+F)
  - Highlight matching text in results
  - Auto-scroll toggle (follows tail when running)
  - Line numbers
  - Timestamp column (absolute + relative)
  - Log source column: Spark Driver / Executor / Platform / User Code
  - Copy selected lines
  - Download full log as `.log` or `.txt`
  - Max log lines configurable (default 10,000, load more on demand)
  - Color coding by severity
  - Regex search mode toggle

#### 2.4.6 Sub-Tab: Code

**Preserved Code Viewer** — see Section 2.6 for full spec.

#### 2.4.7 Sub-Tab: Metrics

**Execution Metrics** — see Section 2.7 for full spec.

#### 2.4.8 Sub-Tab: Data Lineage

- Visual DAG of data flow from sources through transforms to targets
- Each node shows: table/file name, record count, schema
- Edge labels: transformation applied
- External system icons (S3, JDBC, Kafka, etc.)
- Time-travel: replay lineage at any execution step
- Export lineage as JSON (OpenLineage format compatible)

#### 2.4.9 Sub-Tab: Audit Trail

- Chronological list of all events for this execution
- Event types: SUBMITTED / QUEUED / STARTED / NODE_STARTED / NODE_COMPLETED / NODE_FAILED / RETRY_TRIGGERED / CANCELLED / COMPLETED / FAILED / ALERT_SENT
- Actor (user or system) for each event
- IP address and user-agent for user-initiated events
- Immutable (no delete/edit)

#### 2.4.10 Sub-Tab: Retry History

- List of all retry attempts for this execution
- Per retry: attempt number, trigger reason, start time, end time, status, diff from previous attempt
- "Compare Attempts" button: side-by-side metrics comparison
- Original submission always preserved (attempt 0)

---

### 2.5 Auto-Refresh & Live Tracking

#### 2.5.1 Refresh Modes
| Mode | Mechanism | Scope |
|---|---|---|
| Manual | User clicks Refresh button | Entire current view |
| Polling | Configurable interval timer | Execution list grid + dashboard KPIs |
| WebSocket Push | Server-sent events / WS | Individual execution detail tabs |
| Hybrid | WS for running jobs, polling for list | Default mode |

#### 2.5.2 Auto-Refresh Controls
- Global toggle in toolbar: ON / OFF
- Interval selector: 5s / 10s / 15s / 30s / 1m / 5m / Custom
- Per-tab override: each open execution tab can have its own refresh interval
- Visual countdown: progress ring or timer label showing next refresh
- "Paused" state when browser tab is not active (resumes on focus)
- Refresh indicator: pulsing dot in toolbar when auto-refresh is active
- Last refreshed timestamp always displayed

#### 2.5.3 WebSocket Events (Execution Detail Tab)
Events pushed from backend:
- `execution.status.changed` → update status badge, header, progress bar
- `execution.node.started` → update node table + canvas
- `execution.node.completed` → update node metrics + canvas
- `execution.node.failed` → highlight failure, open error panel
- `execution.log.line` → append to log viewer
- `execution.metric.updated` → refresh metrics panels
- `execution.completed` → final state; stop streaming; show summary modal
- `execution.cancelled` → update UI; disable active controls

#### 2.5.4 Connection Resilience
- Automatic WebSocket reconnect with exponential backoff (max 30s)
- Reconnect indicator shown in tab
- On reconnect: full state sync, then resume streaming
- Offline indicator: banner when WebSocket is disconnected
- Fallback to polling if WebSocket fails after 3 retries

---

### 2.6 Code Preservation

#### 2.6.1 What is Preserved
At execution submission time, the following are captured and stored immutably:

| Artifact | Format | Storage |
|---|---|---|
| Generated Spark/PySpark Code | `.py` / `.scala` | Blob in DB or object store |
| Generated SQL (if applicable) | `.sql` | Blob |
| Pipeline Definition Snapshot | JSON | DB column (JSONB) |
| Execution Configuration | JSON | DB column |
| Runtime Parameters | JSON | DB column (secrets masked) |
| Node Configuration Snapshots | JSONB per node | DB |
| Transformation Logic Snapshot | JSON | DB |
| Schema at Execution Time | JSON | DB |
| Connection References (no credentials) | JSON | DB |

#### 2.6.2 Code Viewer (Sub-Tab: Code)
- Monaco Editor (read-only) embedded in the tab
- Language: Python / Scala / SQL auto-detected
- Syntax highlighting
- Line numbers
- Search (Ctrl+F)
- Code folding
- Minimap
- Copy to clipboard button
- Download as file button
- "Open in Editor (Read-Only Fork)" button — creates a new pipeline draft pre-loaded with this code
- "Diff vs Current" button — side-by-side diff of preserved code vs current pipeline-generated code
- File tabs within Code sub-tab if multiple artifacts (PySpark + SQL):
  - `main.py` / `main.scala`
  - `query.sql`
  - `pipeline_definition.json`
  - `execution_config.json`

#### 2.6.3 Storage Strategy
- Stored in `execution_artifacts` table with foreign key to `executions`
- Content hash (SHA-256) stored for deduplication
- Retention policy configurable per environment (default: 90 days PROD, 30 days DEV)
- Compression: gzip for blobs > 10KB
- Object store (S3/GCS/Azure Blob) as overflow for large code artifacts
- Presigned URL returned to frontend for direct download

---

### 2.7 Execution Metrics Capture

#### 2.7.1 Platform-Level Metrics (Captured by ETL Platform)
| Metric | Description | Unit |
|---|---|---|
| queue_wait_duration | Time from submission to execution start | Seconds |
| execution_duration | Start to end of actual processing | Seconds |
| total_wall_clock | Submission to final state | Seconds |
| rows_read_total | Total rows read across all source nodes | Count |
| rows_written_total | Total rows written across all target nodes | Count |
| rows_rejected_total | Rows that failed validation/transformation | Count |
| bytes_read_total | Total bytes read | Bytes |
| bytes_written_total | Total bytes written | Bytes |
| nodes_total | Total nodes in pipeline | Count |
| nodes_succeeded | Nodes that completed successfully | Count |
| nodes_failed | Nodes that failed | Count |
| nodes_skipped | Nodes that were skipped | Count |
| retry_count | Number of retry attempts | Count |
| error_category | Categorized failure type | Enum |

#### 2.7.2 Node-Level Metrics (Per Node)
| Metric | Unit |
|---|---|
| node_start_time | Timestamp |
| node_end_time | Timestamp |
| node_duration_seconds | Seconds |
| rows_in | Count |
| rows_out | Count |
| rows_rejected | Count |
| bytes_read | Bytes |
| bytes_written | Bytes |
| cpu_peak_percent | % |
| memory_peak_mb | MB |
| shuffle_read_bytes | Bytes |
| shuffle_write_bytes | Bytes |
| spill_disk_bytes | Bytes |
| task_count | Count |
| failed_task_count | Count |

#### 2.7.3 Spark-Level Metrics (If Spark Engine)
| Metric | Unit |
|---|---|
| driver_memory_used_mb | MB |
| executor_count | Count |
| total_cores | Count |
| total_tasks | Count |
| failed_tasks | Count |
| stage_count | Count |
| failed_stage_count | Count |
| shuffle_read_bytes | Bytes |
| shuffle_write_bytes | Bytes |
| disk_spill_bytes | Bytes |
| gc_time_ms | Milliseconds |
| peak_executor_memory_mb | MB |
| jvm_heap_used_mb | MB |
| input_split_count | Count |
| output_partition_count | Count |

#### 2.7.4 Metrics Visualization (Sub-Tab: Metrics)
- **Timeline Charts**: Rows processed over time, bytes throughput, task parallelism
- **Node Gantt Chart**: Each node as a bar on a time axis, colored by status
- **Resource Usage Charts**: CPU %, Memory %, Executor utilization over time
- **Stage Waterfall**: Spark stage timeline (if Spark)
- **Comparison Mode**: Select 2–5 executions to compare metrics side-by-side
- **Anomaly Indicators**: Metrics that deviate >2σ from historical baseline flagged with ⚠
- **Export**: Download metrics as CSV or JSON
- **Metric History**: Sparkline trend for any metric over last N executions of same pipeline

---

### 2.8 Filtering & Search

#### 2.8.1 Filter Bar
Persistent, collapsible filter bar above the execution grid.

#### 2.8.2 Filter Dimensions
| Filter | Type | Options |
|---|---|---|
| Search | Full-text | Execution ID, pipeline name, error message, tags |
| Status | Multi-select | All statuses |
| Pipeline | Multi-select typeahead | All pipelines user has access to |
| Submitted By | Multi-select user picker | All users |
| Environment | Multi-select | DEV / QA / STAGING / PROD |
| Trigger Type | Multi-select | MANUAL / SCHEDULED / API / ORCHESTRATOR |
| Date Range | Date-range picker | Presets: Today / Yesterday / This Week / Last 7d / This Month / Last 30d / This Quarter / This Year / Custom |
| Date (exact) | Single date | Calendar picker |
| Month | Month picker | MM/YYYY |
| Year | Year picker | YYYY |
| Hour of Day | Range slider | 00–23 |
| Day of Week | Multi-select | Mon–Sun |
| Duration | Range slider | Min–Max seconds |
| Data Volume | Range slider | Bytes (auto-scaled) |
| Error Category | Multi-select | All error categories |
| Tags | Multi-select | All defined tags |
| SLA Status | Multi-select | ON_TIME / AT_RISK / BREACHED / N/A |
| Retry Count | Number range | 0–N |
| Cluster / Engine | Multi-select | All available clusters |
| Pipeline Version | Multi-select | All versions of selected pipeline |
| Orchestrator | Multi-select | Filter to executions triggered by specific orchestrators |
| Node Count | Number range | |
| Has Error | Toggle | Show only executions with errors |
| Has Warnings | Toggle | |
| Is Retried | Toggle | |
| Data Source | Multi-select | Filter by source connector type |
| Data Target | Multi-select | Filter by target connector type |

#### 2.8.3 Filter Behaviors
- All filters are combinable (AND logic between dimensions, OR within dimension)
- Advanced mode: switch to SQL-like expression editor for complex predicates
- Filter chips shown below filter bar for active filters
- Remove individual filter chips or "Clear All"
- Save filter preset: name, optional description, private/shared
- Load saved filter preset from dropdown
- URL sync: active filters encoded in URL for bookmarking/sharing
- Filter count badge on filter toggle button
- "My Executions" quick filter button (submitted_by = current user)
- "Today's Failures" quick filter button

#### 2.8.4 Global Search
- Ctrl+K command palette (platform-wide)
- Search across executions, pipelines, orchestrators, logs
- Fuzzy matching on pipeline name and execution ID
- Recent searches stored locally

---

### 2.9 Notifications & Alerts

#### 2.9.1 In-App Notifications
- Bell icon in top bar with unread count badge
- Notification types: Execution FAILED / SLA Breached / Retry triggered / Execution completed (for subscribed pipelines)
- Click notification → opens execution detail tab
- Mark as read / Mark all read / Dismiss

#### 2.9.2 Alert Rules (User-Configurable)
| Condition | Trigger |
|---|---|
| Execution FAILED | Any / specific pipeline / specific environment |
| SLA Breached | Any / specific pipeline |
| Duration > threshold | User-defined minutes |
| Failure rate > % | Over rolling window |
| Retry count > N | Per execution |
| Data volume deviation | % change from baseline |

Delivery channels: In-App / Email / Slack Webhook / Teams Webhook / PagerDuty
- Alert rule management UI in Settings → Alerts
- Snooze alert: 1h / 4h / 24h / Until Monday
- Alert history with sent status and delivery confirmation

---

### 2.10 Audit & Compliance

- Immutable audit log for every execution event
- Stored in dedicated `execution_audit_log` table (append-only, no UPDATE/DELETE)
- Events: created, started, completed, failed, retried, cancelled, viewed, code_accessed, log_downloaded, alert_sent
- Captures: timestamp, actor (user/system), IP, user-agent, event metadata
- Audit export: CSV / JSON for compliance reporting
- Retention policies: configurable minimum retention (default 7 years for PROD)
- WORM storage option for regulated industries

---

### 2.11 Bulk Operations

- Select multiple executions via checkbox
- Available bulk actions:
  - **Retry All Selected** (only FAILED/CANCELLED)
  - **Cancel All Selected** (only RUNNING/QUEUED)
  - **Tag Selected**: apply/remove tags to all selected
  - **Export Selected**: download execution summary as CSV/JSON/Excel
  - **Archive Selected**: move to archive (hidden from default list, searchable with filter)
  - **Delete Selected**: soft delete (admin only; requires confirmation with execution count)
  - **Compare Selected** (2–5): opens comparison view

---

### 2.12 Export & Reporting

- **Execution Report**: PDF/Excel report for selected date range
  - Summary KPIs, execution table, failure analysis, top failing pipelines
  - Scheduled report delivery via email (daily/weekly/monthly)
- **Raw Data Export**: CSV/JSON of execution records matching current filter
- **Metrics Export**: per execution or aggregated
- **Log Export**: full log bundle for selected execution(s) as ZIP
- **Audit Export**: compliance-ready CSV with all audit events
- Custom report builder: choose columns, groupings, aggregations, chart types

---

## 3. Orchestrator Module

### 3.1 Orchestrator Dashboard

Mirrors the Monitor Dashboard but scoped to orchestrator-level executions.

#### 3.1.1 Orchestrator KPI Cards
| Card | Metric |
|---|---|
| Active Orchestrators Running | Count |
| Total Pipelines in Flight | Sum of pipelines across all running orchestrators |
| Orchestrators Completed Today | Count |
| Orchestrators Failed Today | Count |
| Parallel Groups Running | Count |
| Average Orchestrator Duration (Today) | Duration |
| SLA Breaches (Orchestrators) | Count |
| Queue Depth | Pipelines waiting to start |

#### 3.1.2 Orchestrator-Specific Panels
- **Execution Gantt (Orchestrator Level)**: each orchestrator as a bar, expanded to show pipelines
- **Parallel vs Serial Distribution**: pie/donut of group types
- **Critical Path Analysis**: identifies the longest chain affecting orchestrator end time
- **Bottleneck Heatmap**: which pipelines most frequently delay the orchestrator

---

### 3.2 Orchestrator Execution List

Same grid capabilities as execution list (Section 2.2) with additional columns:

| Additional Column | Detail |
|---|---|
| Orchestrator Name | Name of the orchestrator definition |
| Orchestrator Version | Version at submission |
| Total Pipelines | Count of pipelines in this run |
| Pipelines Succeeded | Count |
| Pipelines Failed | Count |
| Pipelines Running | Count |
| Pipelines Pending | Count |
| Parallel Groups | Count of parallel groups defined |
| Critical Path Duration | Computed longest serial chain |
| Group Completion % | Percentage of groups fully completed |

---

### 3.3 Execution Groups — Parallel vs Serial

#### 3.3.1 Concept
An orchestrator defines an ordered list of **Execution Groups**. Each group contains one or more pipelines:
- **Serial Group** (type: SERIAL): contains a single pipeline; executes after previous group completes
- **Parallel Group** (type: PARALLEL): contains 2+ pipelines; all execute concurrently; group completes when all pipelines finish (configurable: ALL_COMPLETE / ANY_SUCCESS / MAJORITY_COMPLETE)

#### 3.3.2 Group Configuration
- Group name (user-defined)
- Group type: SERIAL / PARALLEL
- Pipelines in group: ordered list (order matters for serial; order is display-only for parallel)
- Concurrency limit: max parallel pipelines to run simultaneously (for PARALLEL groups)
- Completion policy:
  - ALL_COMPLETE: wait for all pipelines
  - ANY_SUCCESS: proceed when first succeeds
  - MAJORITY: proceed when >50% succeed
  - FIRST_COMPLETE: proceed when any finishes (regardless of status)
- On-failure policy per group:
  - FAIL_ORCHESTRATOR: halt everything
  - CONTINUE: skip failed pipeline, continue group
  - RETRY_GROUP: retry entire group up to N times
  - SKIP_TO_GROUP: jump to specified downstream group
- Dependency declarations: group B depends on group A (implicit: serial order; explicit: named dependency)
- Conditional execution: group executes only if expression evaluates true (e.g., previous group row count > 0)

#### 3.3.3 Visual Representation
- **Vertical swimlane view** (default):
  - Each group = horizontal band
  - Serial groups: single pipeline card
  - Parallel groups: multiple pipeline cards side-by-side
  - Group separator with label, type badge, completion policy
  - Timeline axis on left showing wall clock time
  - Connecting arrows between groups showing dependency

- **DAG view** (alternative):
  - Groups as nodes in a directed graph
  - Edges = dependencies
  - Node color by group status
  - Click group node → expands to show pipelines

#### 3.3.4 Runtime Group Status
| Group Status | Meaning |
|---|---|
| PENDING | Not yet started |
| WAITING | Waiting for upstream group |
| RUNNING | At least one pipeline running |
| PARTIALLY_COMPLETE | Some pipelines done, others running |
| COMPLETE | All pipelines done per completion policy |
| FAILED | Failure condition triggered |
| SKIPPED | Skipped due to condition or policy |

---

### 3.4 Pipeline Expand/Collapse View

#### 3.4.1 Collapsed View (Default)
Each pipeline within a group shown as a compact row:
| Element | Detail |
|---|---|
| Pipeline Name | Metalink to pipeline execution detail tab |
| Status Badge | Live-updated |
| Start Time | |
| End Time | Null if running |
| Duration | Live elapsed if running |
| Progress | % of nodes complete |
| Error Summary | Short error message if FAILED |
| Expand Toggle | > / ∨ arrow |

#### 3.4.2 Expanded View
Clicking expand on a pipeline row shows:
- Node execution table (same as Section 2.4.4 node table)
- Node-level status canvas thumbnail (mini pipeline diagram)
- Node-level failure/success indicator per node with next-node mapping arrows
- Error details panel:
  - Error category
  - Full error message (scrollable)
  - Stack trace (collapsible)
  - Failed node identification
  - Suggested remediation
- Timing breakdown: queue wait, initialization, execution, teardown
- Key metrics: rows processed, bytes read/written
- Log tail: last 20 log lines with "Open Full Logs" button
- "Open Full Execution" metalink → opens pipeline execution detail as tab

#### 3.4.3 Bulk Expand/Collapse
- "Expand All" / "Collapse All" buttons for all pipelines in the orchestrator
- "Expand Failed Only" quick action
- State remembered per orchestrator execution (per user, per session)

---

### 3.5 Node-Level Success/Failure Mapping

#### 3.5.1 Concept
Each node in a pipeline has configurable **outcome transitions**:
- **On SUCCESS → Next Node(s)**: default forward flow; can branch to multiple nodes
- **On FAILURE → Failure Handler Node**: redirect to error-handling branch instead of halting
- **On WARNING → Conditional Branch**: proceed to different node if warning threshold exceeded
- **On EMPTY OUTPUT → Skip Branch**: if node produces zero rows, skip downstream to specified node
- **On PARTIAL SUCCESS → Merge Branch**: partial results fed to a merge/reconciliation node

#### 3.5.2 Node Outcome Configuration (Pipeline Editor Integration)
Each node edge in the canvas can be typed:
| Edge Type | Visual | Meaning |
|---|---|---|
| SUCCESS | Solid green arrow | Normal forward flow |
| FAILURE | Dashed red arrow | Failure path |
| WARNING | Dashed orange arrow | Warning path |
| EMPTY | Dashed gray arrow | Zero rows path |
| CONDITIONAL | Dashed blue arrow | Expression-evaluated path |
| ALWAYS | Solid black arrow | Executes regardless of outcome |

#### 3.5.3 Failure Handler Nodes
Special node types for failure handling:
- **Alert Node**: sends notification on failure path
- **Compensate Node**: executes rollback/cleanup logic
- **Log Error Node**: writes structured error record to error table
- **Retry Node**: triggers retry of specified upstream node with delay
- **Terminate Node**: graceful orchestrator/pipeline termination with cleanup

#### 3.5.4 Runtime Visualization
In the execution canvas (read-only, Section 2.4.3):
- Active edge highlighted with animated flow
- SUCCESS edges: green animated dash
- FAILURE edges (if traversed): red animated dash
- SKIPPED edges: gray static line
- Each node shows: outcome badge (SUCCESS/FAILED/SKIPPED/WARNING) + arrival edge from upstream
- Failure path traversal visible: shows exactly which failure branch was taken
- Node tooltip: shows which outgoing edge was activated and why

#### 3.5.5 Pipeline-Level Same Behavior
Identical mapping applies at pipeline level within an orchestrator:
- **On PIPELINE_SUCCESS → Next Pipeline/Group**
- **On PIPELINE_FAILURE → Failure Group**: alternate group executed
- **On PIPELINE_PARTIAL → Merge Group**
- **On PIPELINE_EMPTY → Skip Group**
- Configurable per-pipeline within the orchestrator definition

---

### 3.6 Orchestrator Opening as Tab

Same mechanics as Section 2.3 for pipeline executions:
- Double-click orchestrator execution row
- Tab title: `[OrchestratorName] • [ShortExecID]`
- Tab icon: animated spinner if RUNNING, colored dot otherwise
- Deep-link URL: `/workspace/monitor/orchestrators/{orchestrator_execution_id}`
- All sub-tabs available (Overview, Canvas, Pipeline List, Logs, Metrics, Audit)
- Restoration on reload

#### 3.6.1 Orchestrator Detail Sub-Tabs
| Sub-Tab | Content |
|---|---|
| Overview | Header KPIs, timing, group progress, error summary |
| Execution Plan | DAG or swimlane showing groups + pipelines |
| Pipeline List | All pipelines (expand/collapse per Section 3.4) |
| Logs | Aggregated logs across all pipelines (with pipeline filter) |
| Metrics | Aggregated + per-pipeline metrics |
| Audit | Full event audit trail for orchestrator |
| Code | Orchestrator definition JSON, each pipeline's code |
| History | All previous executions of this orchestrator definition |

---

### 3.7 Orchestrator Filtering & Search

All filters from Section 2.8 apply, plus:

| Filter | Detail |
|---|---|
| Orchestrator Name | Multi-select |
| Group Name | Filter to orchestrators containing specific group |
| Pipeline Name (within orchestrator) | Filter to orchestrators that include specific pipeline |
| Group Type | PARALLEL / SERIAL / MIXED |
| Total Pipeline Count | Range |
| Parallel Group Count | Range |
| Has Failed Pipeline | Toggle |
| Has Failed Group | Toggle |
| Critical Path > threshold | Duration filter |
| Completion Policy | Multi-select |

---

### 3.8 Retry, Skip & Override Controls

#### 3.8.1 Granular Retry Options (Orchestrator Level)
- **Retry Full Orchestrator**: restart from beginning
- **Retry From Failed Group**: restart from the first failed group, skip succeeded groups
- **Retry Specific Group**: retry one specific group, mark rest as SKIPPED (proceed with results)
- **Retry Specific Pipeline**: retry one pipeline within a group; re-evaluate group completion
- **Retry From Failed Node** (pipeline level): restart pipeline from the failed node only

#### 3.8.2 Skip Controls
- **Skip Failed Pipeline**: mark pipeline as SKIPPED, continue orchestrator
- **Skip Failed Group**: mark entire group as SKIPPED, continue
- **Force Success**: mark failed pipeline/group as SUCCESS (audit-logged; requires elevated permission)
- Override requires: reason text input + confirmation dialog

#### 3.8.3 Real-Time Intervention
- **Pause Orchestrator**: prevents next group from starting; in-flight pipelines run to completion
- **Resume Orchestrator**: resumes from paused state
- **Cancel Pipeline**: cancel specific running pipeline; group failure policy kicks in
- **Inject Parameter Override**: modify a parameter for the next execution of a specific pipeline within the run (hot-patch)

---

### 3.9 Dependency Graph View

- Full DAG visualization of orchestrator execution plan
- Groups as nodes, dependencies as directed edges
- Critical path highlighted in red/orange
- Node size proportional to pipeline count in group
- Node color: status-based
- Time annotations on edges (estimated start time based on upstream completion)
- Interactive: click node → side panel with group detail
- Export as SVG/PNG
- Print-friendly layout mode

---

### 3.10 SLA & Threshold Management

#### 3.10.1 SLA Definition
- Per orchestrator: expected completion duration from start
- Per pipeline within orchestrator: individual SLA
- Per group: group-level SLA
- Warning threshold: % of SLA elapsed triggers AT_RISK status

#### 3.10.2 SLA Monitoring
- Real-time SLA progress bar in orchestrator header and pipeline rows
- Color: Green (< 80% of SLA elapsed) → Amber (80–100%) → Red (>100% = BREACHED)
- SLA breach auto-triggers alert per configured alert rules
- SLA breach creates audit event
- Post-execution SLA report: actual vs target, breach reasons, trend

---

## 4. Shared Infrastructure

### 4.1 Execution State Machine

```
PENDING → QUEUED → INITIALIZING → RUNNING → SUCCESS
                                           → FAILED → RETRYING → [RUNNING | FAILED]
                                           → TIMED_OUT
                                           → CANCELLED
                                           → PARTIALLY_COMPLETED
RUNNING → PAUSED → RUNNING
```

State transitions are atomic, persisted immediately, and emit WebSocket events.
Invalid transitions are rejected with error code `EXEC_INVALID_STATE_TRANSITION`.

---

### 4.2 Data Model — Executions

```sql
-- Core executions table
CREATE TABLE executions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id             UUID NOT NULL REFERENCES pipelines(id),
    pipeline_version        INTEGER NOT NULL,
    pipeline_snapshot       JSONB NOT NULL,           -- Full pipeline definition at submission
    status                  VARCHAR(50) NOT NULL,
    trigger_type            VARCHAR(50) NOT NULL,      -- MANUAL/SCHEDULED/API/ORCHESTRATOR
    orchestrator_execution_id UUID REFERENCES orchestrator_executions(id),
    orchestrator_group_id   UUID,
    submitted_by            UUID NOT NULL REFERENCES users(id),
    submitted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    queued_at               TIMESTAMPTZ,
    started_at              TIMESTAMPTZ,
    ended_at                TIMESTAMPTZ,
    duration_seconds        NUMERIC,
    queue_wait_seconds      NUMERIC,
    environment             VARCHAR(50) NOT NULL,
    cluster_name            VARCHAR(255),
    engine_version          VARCHAR(100),
    execution_config        JSONB,                    -- Spark config, params, env vars
    retry_count             INTEGER NOT NULL DEFAULT 0,
    retry_of_execution_id   UUID REFERENCES executions(id),
    error_category          VARCHAR(100),
    error_message           TEXT,
    error_stack_trace       TEXT,
    failed_node_id          UUID,
    tags                    TEXT[] DEFAULT '{}',
    sla_seconds             INTEGER,
    sla_status              VARCHAR(50),
    is_archived             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Node executions
CREATE TABLE execution_nodes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id            UUID NOT NULL REFERENCES executions(id),
    node_id                 VARCHAR(255) NOT NULL,
    node_name               VARCHAR(255) NOT NULL,
    node_type               VARCHAR(100) NOT NULL,
    node_config_snapshot    JSONB NOT NULL,
    status                  VARCHAR(50) NOT NULL,
    started_at              TIMESTAMPTZ,
    ended_at                TIMESTAMPTZ,
    duration_seconds        NUMERIC,
    rows_in                 BIGINT DEFAULT 0,
    rows_out                BIGINT DEFAULT 0,
    rows_rejected           BIGINT DEFAULT 0,
    bytes_read              BIGINT DEFAULT 0,
    bytes_written           BIGINT DEFAULT 0,
    cpu_peak_percent        NUMERIC,
    memory_peak_mb          NUMERIC,
    error_message           TEXT,
    error_stack_trace       TEXT,
    retry_count             INTEGER DEFAULT 0,
    outcome_edge_type       VARCHAR(50),              -- SUCCESS/FAILURE/WARNING/EMPTY
    next_node_ids           TEXT[],                   -- IDs of next nodes activated
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Execution artifacts (code preservation)
CREATE TABLE execution_artifacts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id            UUID NOT NULL REFERENCES executions(id),
    artifact_type           VARCHAR(100) NOT NULL,    -- PYSPARK/SCALA/SQL/PIPELINE_DEF/CONFIG
    file_name               VARCHAR(500) NOT NULL,
    content                 TEXT,                     -- Inline for small files
    storage_url             VARCHAR(2000),            -- Object store URL for large files
    content_hash            VARCHAR(64) NOT NULL,     -- SHA-256
    size_bytes              BIGINT NOT NULL,
    is_compressed           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Execution audit log (append-only)
CREATE TABLE execution_audit_log (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id            UUID NOT NULL,            -- No FK to allow cross-type reference
    entity_type             VARCHAR(50) NOT NULL,     -- PIPELINE_EXECUTION/ORCHESTRATOR_EXECUTION
    event_type              VARCHAR(100) NOT NULL,
    actor_id                UUID,
    actor_type              VARCHAR(50),              -- USER/SYSTEM/SCHEDULER
    ip_address              INET,
    user_agent              TEXT,
    event_metadata          JSONB,
    occurred_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_submitted_by ON executions(submitted_by);
CREATE INDEX idx_executions_submitted_at ON executions(submitted_at DESC);
CREATE INDEX idx_executions_pipeline_id ON executions(pipeline_id);
CREATE INDEX idx_executions_environment ON executions(environment);
CREATE INDEX idx_executions_tags ON executions USING GIN(tags);
CREATE INDEX idx_executions_error_category ON executions(error_category) WHERE error_category IS NOT NULL;
CREATE INDEX idx_executions_orchestrator ON executions(orchestrator_execution_id) WHERE orchestrator_execution_id IS NOT NULL;
```

---

### 4.3 Data Model — Metrics

```sql
CREATE TABLE execution_metrics (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id            UUID NOT NULL REFERENCES executions(id),
    scope                   VARCHAR(50) NOT NULL,     -- EXECUTION/NODE/SPARK
    node_execution_id       UUID REFERENCES execution_nodes(id),
    metric_name             VARCHAR(255) NOT NULL,
    metric_value            NUMERIC,
    metric_unit             VARCHAR(50),
    captured_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metrics_execution_id ON execution_metrics(execution_id);
CREATE INDEX idx_metrics_scope_name ON execution_metrics(scope, metric_name);
```

---

### 4.4 Data Model — Orchestrators

```sql
CREATE TABLE orchestrator_executions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orchestrator_id             UUID NOT NULL REFERENCES orchestrators(id),
    orchestrator_version        INTEGER NOT NULL,
    orchestrator_snapshot       JSONB NOT NULL,
    status                      VARCHAR(50) NOT NULL,
    submitted_by                UUID NOT NULL REFERENCES users(id),
    submitted_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at                  TIMESTAMPTZ,
    ended_at                    TIMESTAMPTZ,
    duration_seconds            NUMERIC,
    environment                 VARCHAR(50) NOT NULL,
    total_pipeline_count        INTEGER NOT NULL DEFAULT 0,
    succeeded_pipeline_count    INTEGER NOT NULL DEFAULT 0,
    failed_pipeline_count       INTEGER NOT NULL DEFAULT 0,
    skipped_pipeline_count      INTEGER NOT NULL DEFAULT 0,
    total_group_count           INTEGER NOT NULL DEFAULT 0,
    current_group_index         INTEGER,
    error_summary               TEXT,
    sla_seconds                 INTEGER,
    sla_status                  VARCHAR(50),
    tags                        TEXT[] DEFAULT '{}',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orchestrator_groups (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orchestrator_id         UUID NOT NULL REFERENCES orchestrators(id),
    group_name              VARCHAR(255) NOT NULL,
    group_type              VARCHAR(50) NOT NULL,     -- SERIAL/PARALLEL
    group_order             INTEGER NOT NULL,
    completion_policy       VARCHAR(50) NOT NULL DEFAULT 'ALL_COMPLETE',
    on_failure_policy       VARCHAR(50) NOT NULL DEFAULT 'FAIL_ORCHESTRATOR',
    concurrency_limit       INTEGER,
    condition_expression    TEXT,                     -- Boolean expression for conditional execution
    depends_on_group_ids    UUID[],
    pipelines               JSONB NOT NULL,           -- Ordered list of pipeline refs + configs
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orchestrator_group_executions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orchestrator_execution_id   UUID NOT NULL REFERENCES orchestrator_executions(id),
    group_id                    UUID NOT NULL REFERENCES orchestrator_groups(id),
    group_snapshot              JSONB NOT NULL,
    status                      VARCHAR(50) NOT NULL,
    started_at                  TIMESTAMPTZ,
    ended_at                    TIMESTAMPTZ,
    duration_seconds            NUMERIC,
    pipeline_execution_ids      UUID[],               -- Execution IDs of pipelines in this group
    failure_reason              TEXT,
    retry_count                 INTEGER DEFAULT 0
);
```

---

### 4.5 API Contracts

#### Execution APIs
```
GET    /api/v1/executions                          List with filter/sort/page
GET    /api/v1/executions/:id                      Single execution detail
GET    /api/v1/executions/:id/nodes                Node execution list
GET    /api/v1/executions/:id/nodes/:nodeId        Single node detail
GET    /api/v1/executions/:id/logs                 Paginated logs
GET    /api/v1/executions/:id/artifacts            List artifacts
GET    /api/v1/executions/:id/artifacts/:artId     Download artifact
GET    /api/v1/executions/:id/metrics              All metrics
GET    /api/v1/executions/:id/audit                Audit trail
POST   /api/v1/executions/:id/retry                Retry execution
POST   /api/v1/executions/:id/cancel               Cancel execution
GET    /api/v1/executions/stats/summary            Dashboard KPIs
GET    /api/v1/executions/stats/timeline           Timeline chart data
GET    /api/v1/executions/compare?ids=a,b,c        Multi-execution comparison

GET    /api/v1/orchestrator-executions             List
GET    /api/v1/orchestrator-executions/:id         Detail
GET    /api/v1/orchestrator-executions/:id/groups  Groups + pipeline status
POST   /api/v1/orchestrator-executions/:id/retry   Retry options
POST   /api/v1/orchestrator-executions/:id/pause   Pause
POST   /api/v1/orchestrator-executions/:id/resume  Resume
POST   /api/v1/orchestrator-executions/:id/cancel  Cancel
```

#### WebSocket Channels
```
ws://host/ws/executions/:id           Pipeline execution events
ws://host/ws/orchestrators/:id        Orchestrator execution events
ws://host/ws/monitor/dashboard        Dashboard live KPI updates
```

---

### 4.6 WebSocket & Streaming

- Protocol: WebSocket (ws/wss), fallback to Server-Sent Events (SSE)
- Authentication: JWT token passed as query param or cookie
- Heartbeat: ping/pong every 30s
- Message format: `{ "event": "execution.status.changed", "payload": { ... }, "timestamp": "..." }`
- Room-based subscriptions: client subscribes to specific execution IDs
- Log streaming: chunked, max 1000 lines per batch, resumable from line offset
- Backpressure: client sends ACK per batch; server throttles if no ACK within 5s

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Execution list must load (first 50 rows) in < 1s with 10M+ records |
| **Performance** | Execution detail tab must load in < 2s |
| **Performance** | WebSocket event delivery latency < 500ms from backend event |
| **Performance** | Log viewer must render 10,000 lines without UI freeze |
| **Scalability** | Support 10,000 concurrent WebSocket connections |
| **Scalability** | Handle 1,000 executions per minute |
| **Scalability** | Support 50+ simultaneous open execution tabs per session |
| **Availability** | Monitor service: 99.9% uptime SLA |
| **Data Retention** | Execution metadata: 7 years (configurable) |
| **Data Retention** | Logs: 90 days hot, 2 years cold (archival) |
| **Data Retention** | Code artifacts: 2 years (configurable) |
| **Reliability** | Zero execution events lost even during WebSocket disconnection |
| **Reliability** | Execution state recovery after backend restart |
| **Observability** | All API endpoints instrumented (latency, error rate, throughput) |
| **Observability** | WebSocket connection metrics (active connections, message rate) |

---

## 6. Security & RBAC

| Role | Monitor Permissions | Orchestrator Permissions |
|---|---|---|
| Viewer | View own executions + executions in shared pipelines | View orchestrator executions they're listed in |
| Developer | View + Retry + Cancel own executions | All Viewer + manage own orchestrators |
| Operator | View + Retry + Cancel all executions | All Developer + Pause/Resume/Force-Skip |
| Admin | Full access + Delete + Export + Manage alerts | Full access + Define SLA thresholds |
| Compliance | Read-only + Audit export | Read-only + Audit export |

Additional security:
- Sensitive execution parameters masked in UI and logs (configurable masking rules)
- Code artifacts access logged in audit trail
- Log download audited
- "Force Success" requires dual approval for PROD environment
- IP allowlist for compliance-sensitive audit exports

---

## 7. UI/UX Standards

- **Loading states**: Skeleton loaders for every data-fetching component (no blank screens)
- **Empty states**: Descriptive empty states with actionable CTAs ("No executions found. Adjust your filters or submit a pipeline.")
- **Error states**: Inline error messages with retry actions for every API failure
- **Responsive**: All views functional on 1366×768 minimum resolution
- **Keyboard navigation**: Full keyboard navigability (Tab, Enter, Arrow keys, Escape)
- **Accessibility**: WCAG 2.1 AA compliance (color contrast, ARIA labels, screen reader support)
- **Dark mode**: Full dark mode support (system preference + manual toggle)
- **Tooltips**: Contextual tooltips on all truncated values, icons, and status indicators
- **Confirmation dialogs**: All destructive actions (Cancel, Delete, Force Success) require typed confirmation for PROD
- **Undo**: Soft actions (Archive, Tag) support Undo within 10s via toast notification
- **Drag & drop**: Column reorder, tab reorder, group reorder in orchestrator
- **Copy everywhere**: Copy to clipboard button on all IDs, code blocks, error messages
- **Consistent iconography**: Status icons consistent throughout monitor and orchestrator
- **Loading progress**: Long operations (export, report generation) show progress bar

---

## 8. Acceptance Criteria Summary

| Feature | Acceptance Criteria |
|---|---|
| Monitor Dashboard | All KPI cards load in < 1s; each is filterable on click |
| Execution List | Supports all 30+ filter dimensions; combined filters work correctly |
| Tab Opening | Execution opens as named tab; tab survives page refresh; deep-link works |
| Execution Detail | All 9 sub-tabs present; data accurate against DB |
| Auto-Refresh | WebSocket events update UI within 500ms; polling fallback works |
| Code Preservation | Code captured at submission; viewable in Monaco; downloadable; diffable |
| Metrics | All listed metrics captured; charts render; comparison mode works |
| Orchestrator Expand/Collapse | All pipelines expand/collapse; expanded view shows full node detail |
| Parallel/Serial Groups | Groups correctly categorized; completion policy respected; visual correct |
| Node Outcome Mapping | All edge types configurable; runtime traversal correctly visualized |
| Retry Controls | All retry granularity levels work; audit logged; state machine correct |
| SLA Monitoring | SLA breach triggers alert; badge updates in real-time |
| RBAC | Role permissions enforced on all endpoints and UI elements |
| Audit Trail | Every listed event captured; immutable; exportable |

---

*Document Version: 1.0 | Created: 2026-03 | Owner: ETL Platform Team*
