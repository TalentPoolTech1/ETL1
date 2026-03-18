# SKILL.md — Executions Service
**Service Domain:** `executions`  
**Last Updated:** 2026-03-17  
**Logger Name:** `LoggerFactory.get('executions')` (not yet bound to route handlers — see Known Issues)  
**Error Domain:** `EXEC-*` → `Backend/src/shared/errors/catalog/exec.errors.ts`

> **Read before making any change to this service.**  
> Every change, user decision, or architectural rule must be appended to the  
> **"Living Decisions"** section at the bottom of this file.

---

## Purpose

Provides the monitoring and observability plane for all pipeline and orchestrator runs.
Handles KPI dashboards, run listings with filters, per-run details, log streaming,
node-level telemetry, retry, and cancel operations.

**This service is READ-HEAVY.** It does not own the execution engine — it reads
rows written by the (future) execution engine microservice.

---

## File Map

| File | Role |
|---|---|
| `Backend/src/api/routes/executions.routes.ts` | All `/api/executions/*` endpoints — inline implementation |
| `Backend/src/api/controllers/execution.controller.ts` | Legacy stub — `getHistory` + `getLogs` (thin, uses old repository) |
| `Backend/src/db/repositories/execution.repository.ts` | Repository for legacy execution queries |

---

## API Surface

### Pipeline Runs

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/executions/kpis` | Aggregate stats for date range (`?projectId&dateFrom&dateTo`) |
| `GET` | `/api/executions/pipeline-runs` | Paginated run list with filters |
| `GET` | `/api/executions/pipeline-runs/:runId` | Full run detail |
| `GET` | `/api/executions/pipeline-runs/:runId/logs` | Paginated log lines |
| `GET` | `/api/executions/pipeline-runs/:runId/nodes` | Node-level telemetry for run |
| `POST` | `/api/executions/pipeline-runs/:runId/retry` | Create new PENDING run from existing |
| `POST` | `/api/executions/pipeline-runs/:runId/cancel` | Set status to CANCELLED |

### Orchestrator Runs

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/executions/orchestrator-runs` | Paginated orch run list with filters |
| `GET` | `/api/executions/orchestrator-runs/:runId` | Full orch run detail |
| `POST` | `/api/executions/orchestrator-runs/:runId/retry` | Retry orchestrator run |
| `POST` | `/api/executions/orchestrator-runs/:runId/cancel` | Cancel orchestrator run |

---

## Query Parameters

### `/api/executions/pipeline-runs`
| Param | Type | Description |
|---|---|---|
| `pipelineId` | UUID | Filter by pipeline |
| `projectId` | UUID | Filter by project |
| `status` | string | `PENDING` / `QUEUED` / `RUNNING` / `SUCCESS` / `FAILED` / `CANCELLED` |
| `triggerType` | string | `MANUAL` / `SCHEDULED` / `API` / `ORCHESTRATOR` |
| `search` | string | ILIKE on `pipeline_display_name` |
| `dateFrom` | date | Start date (inclusive) |
| `dateTo` | date | End date (inclusive) |
| `myJobsOnly` | boolean | Filter by `triggered_by_user_id = current user` |
| `page` | int | 1-based (default: 1) |
| `pageSize` | int | Max 500 (default: 50) |

---

## Database Tables

| Table | Schema | Purpose |
|---|---|---|
| `execution.pipeline_runs` | `execution` | One row per pipeline execution attempt |
| `execution.pipeline_node_runs` | `execution` | Per-node telemetry within a run |
| `execution.pipeline_run_logs` | `execution` | Log lines emitted during a run |
| `execution.pipeline_run_metrics` | `execution` | Metrics (bytes, rows, duration) |
| `execution.orchestrator_runs` | `execution` | One row per orchestrator execution |
| `execution.orchestrator_pipeline_run_map` | `execution` | M2M: which pipeline runs belong to an orch run |
| `execution.run_lineage` | `execution` | Column-level data lineage per run |

**Critical column names (use these, not old names):**
- `pipeline_run_id` (NOT `job_run_id`)
- `pipeline_node_runs` (NOT `task_runs`)
- `pipeline_run_logs` (NOT `job_logs`)
- `pipeline_run_metrics` (NOT `job_metrics`)
- `run_status_code` (NOT `status`)
- `trigger_type_code` (NOT `trigger_type`)

---

## Run Status Codes

| Code | Meaning |
|---|---|
| `PENDING` | Inserted, not yet picked up by engine |
| `QUEUED` | Accepted by engine, waiting for resources |
| `RUNNING` | Actively executing |
| `SUCCESS` | Completed successfully |
| `FAILED` | Terminated with error |
| `CANCELLED` | Manually cancelled |

---

## KPI Fields (GET /kpis response)

| Field | Formula |
|---|---|
| `totalToday` | COUNT(*) in date range |
| `runningNow` | COUNT WHERE status = RUNNING |
| `successRateToday` | COUNT(SUCCESS) / COUNT(*) * 100 |
| `failedToday` | COUNT WHERE status = FAILED |
| `avgDurationMsToday` | AVG(run_duration_ms) WHERE status = SUCCESS |
| `slaBreachesToday` | COUNT WHERE sla_status_code = BREACHED |
| `dataVolumeGbToday` | SUM(bytes_read + bytes_written) / 1e9 |

---

## Retry Logic

Retry creates a **new** `pipeline_runs` row with:
- Same `pipeline_id` and `version_id` as the original
- `run_status_code = 'PENDING'`
- `trigger_type_code = 'MANUAL'`
- `retry_count_num = original.retry_count + 1`

It does NOT mutate the original run. Original run record is preserved for audit.

---

## Cancel Logic

Sets `run_status_code = 'CANCELLED'` and `end_dtm = CURRENT_TIMESTAMP` WHERE current
status is in (`PENDING`, `QUEUED`, `RUNNING`). Idempotent — cancelling a FAILED run is a no-op.

---

## Known Issues & Tech Debt

| Issue | Severity | Notes |
|---|---|---|
| No `LoggerFactory.get('executions')` in route handlers — uses no logging at all | HIGH | Every route handler must add `log.info/warn/error` |
| No `AppError` / `execErrors` wrapping — raw `next(err)` propagation on all routes | HIGH | Import and use `exec.errors.ts` catalog |
| KPI query uses string interpolation for `projectFilter` — SQL injection risk | CRITICAL | Parameterise the project filter properly |
| `pipeline-runs/:runId` detail returns `nodes: []` — never populated from `pipeline_node_runs` | HIGH | Join or follow-up query to `pipeline_node_runs` needed |
| `orchestrator-runs/:runId` detail repurposes `pipelineRunId` field name for orch run ID — misleading | MEDIUM | Use proper `orchRunId` in response shape |
| No real-time streaming — logs endpoint is polled | MEDIUM | Future: WebSocket or SSE for live log tailing |
| `execution.orchestrator_pipeline_run_map` never queried — orch run detail shows no child pipeline runs | HIGH | Join through this table in orch run detail and orch run list |
| Pagination cap is 500 but no cursor-based pagination for high-volume log queries | MEDIUM | Logs endpoint should use cursor (log_id) not offset |

---

## Living Decisions

> Append every user decision, architectural ruling, or critical instruction here.

- `2026-03-17` — SKILL.md created. Route handlers are fully inline in `executions.routes.ts`.
  Legacy `execution.controller.ts` is a thin stub targeting old schema — not used by the routes.
- `2026-03-17` — **Correct Table Names:** `execution.pipeline_runs` (not `job_runs`),
  `execution.pipeline_node_runs` (not `task_runs`), `execution.pipeline_run_logs` (not `job_logs`),
  `execution.pipeline_run_metrics` (not `job_metrics`). Any code using old names must be updated.
- `2026-03-17` — **Critical Security Issue:** KPI endpoint builds project filter via string interpolation.
  Must be parameterised before production use.
- `2026-03-17` — **Design Principle:** This service never triggers execution — it only reads run state.
  Triggering is done via `POST /api/pipelines/:id/run` (pipelines service) and
  `POST /api/orchestrators/:id/run` (orchestrators service).
