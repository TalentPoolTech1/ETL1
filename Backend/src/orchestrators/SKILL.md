# SKILL.md — Orchestrators Service
**Service Domain:** `orchestrators`  
**Last Updated:** 2026-03-17  
**Logger Name:** `LoggerFactory.get('orchestrators')` (not yet bound — see Known Issues)  
**Error Domain:** `ORCH-*` → `Backend/src/shared/errors/catalog/orch.errors.ts`

> **Read before making any change to this service.**  
> Every change, user decision, or architectural rule must be appended to the  
> **"Living Decisions"** section at the bottom of this file.

---

## Purpose

Manages orchestrators — DAG-based workflow containers that coordinate the execution
of multiple pipelines in a defined order with dependencies.

An orchestrator is a design-time artifact (`catalog.orchestrators`). At runtime it
produces `execution.orchestrator_runs` rows, with child pipeline runs tracked in
`execution.orchestrator_pipeline_run_map`.

---

## File Map

| File | Role |
|---|---|
| `Backend/src/api/routes/orchestrators.routes.ts` | All `/api/orchestrators/*` endpoints — inline implementation |

> No dedicated service or repository file yet. All logic is inline in the route handler.
> Future: Extract to `orchestrators.service.ts` + `orchestrators.repository.ts`.

---

## API Surface

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/orchestrators/:id` | Get orchestrator by ID |
| `POST` | `/api/orchestrators` | Create orchestrator |
| `PUT` | `/api/orchestrators/:id` | Update orchestrator (name, desc, DAG definition) |
| `DELETE` | `/api/orchestrators/:id` | Physical delete |
| `POST` | `/api/orchestrators/:id/run` | Trigger orchestrator run (MANUAL) |
| `GET` | `/api/orchestrators/:id/permissions` | Get permissions (stub) |
| `PUT` | `/api/orchestrators/:id/permissions` | Update permissions (stub) |
| `GET` | `/api/orchestrators/:id/audit-logs` | Get history from `history.orchestrators_history` |

---

## Database Tables

| Table | Schema | Purpose |
|---|---|---|
| `catalog.orchestrators` | `catalog` | Master record — `orch_id`, `project_id`, `orch_display_name`, `orch_desc_text`, `dag_definition_json` |
| `catalog.orchestrator_pipeline_map` | `catalog` | Design-time M2M: which pipelines belong to this orchestrator (rebuilt on DAG save) |
| `execution.orchestrator_runs` | `execution` | One row per triggered orchestrator execution |
| `execution.orchestrator_pipeline_run_map` | `execution` | Runtime M2M: which pipeline runs belong to an orch run |
| `history.orchestrators_history` | `history` | Audit shadow table (auto-populated by trigger) |

**Correct column names:**
- `orch_display_name` (NOT `name`)
- `orch_desc_text` (NOT `description`)
- `dag_definition_json` (NOT `config` or `definition`)
- `orch_run_id` (for orchestrator runs)
- `run_status_code`, `trigger_type_code` (NOT `status`, `type`)

---

## DAG Definition (`dag_definition_json`)

The DAG is stored as a JSON blob in `catalog.orchestrators.dag_definition_json`.
Structure (to be formalised — currently schema-free):

```json
{
  "nodes": [
    { "id": "pipeline-uuid", "type": "pipeline", "dependencies": [] }
  ],
  "edges": [
    { "from": "pipeline-uuid-A", "to": "pipeline-uuid-B" }
  ],
  "concurrency": "sequential | parallel",
  "maxParallelism": 3
}
```

On every DAG save (`PUT /:id` with `dagDefinitionJson`), the `catalog.orchestrator_pipeline_map`
table must be **rebuilt** (delete existing rows, re-insert from new DAG nodes).
**This is not yet implemented — see Known Issues.**

---

## Run Trigger

`POST /:id/run` inserts into `execution.orchestrator_runs` with status `PENDING`.
The execution engine (not yet built) picks up `PENDING` rows and:
1. Creates `orchestrator_pipeline_run_map` rows
2. Fans out individual `pipeline_runs` in dependency order
3. Updates `orchestrator_runs.run_status_code` as execution progresses

---

## Business Rules

1. `orchDisplayName` is required on create.
2. `projectId` is required on create — orchestrators belong to a project.
3. When a DAG is saved, `catalog.orchestrator_pipeline_map` must be rebuilt atomically.
4. Physical delete removes the orchestrator; history trigger captures pre-delete state.
5. Permissions inherit from the parent project by default (`inheritFromProject: true`).

---

## Known Issues & Tech Debt

| Issue | Severity | Notes |
|---|---|---|
| No `LoggerFactory.get('orchestrators')` — zero logging in all handlers | HIGH | Add logger to every route |
| No `AppError` / `orchErrors` wrapping | HIGH | Use `orch.errors.ts` catalog |
| `catalog.orchestrator_pipeline_map` NOT rebuilt on DAG save (`PUT /:id`) | CRITICAL | Must delete+reinsert from `dagDefinitionJson.nodes` in same transaction |
| `GET /api/orchestrators` (list all) endpoint MISSING | HIGH | The OrchestratorWorkspace frontend expects a list |
| Permissions endpoints are stubs returning empty grants | HIGH | Implement `gov.project_user_roles` read/write |
| No validation of `dagDefinitionJson` structure | MEDIUM | Validate pipeline UUIDs in DAG nodes exist in `catalog.pipelines` |
| No `GET /api/projects/:id/orchestrators` with orch run counts | LOW | Useful for project overview |

---

## Living Decisions

> Append every user decision, architectural ruling, or critical instruction here.

- `2026-03-17` — SKILL.md created. Service implemented inline in routes (no dedicated service/repo files yet).
- `2026-03-17` — **Critical Missing Feature:** `catalog.orchestrator_pipeline_map` must be
  rebuilt on every `PUT /:id` that includes `dagDefinitionJson`. Without this, the design-time
  M2M relationship is stale. Implementation: in the same transaction as the UPDATE, run
  `DELETE FROM catalog.orchestrator_pipeline_map WHERE orch_id = $1` then re-insert from nodes array.
- `2026-03-17` — **Architectural Rule:** The orchestrator does NOT directly call pipelines.
  It creates `PENDING` orchestrator_runs rows. The execution engine owns the fan-out logic.
- `2026-03-17` — **Missing Endpoint:** `GET /api/orchestrators` (list all, or list by projectId)
  is required by the Frontend `OrchestratorWorkspace` component but does not exist yet.
