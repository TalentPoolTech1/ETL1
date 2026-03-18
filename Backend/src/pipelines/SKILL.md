# SKILL.md — Pipelines Service
**Service Domain:** `pipelines`  
**Last Updated:** 2026-03-17  
**Logger Name:** `LoggerFactory.get('pipelines')` (not yet bound — see Known Issues)  
**Error Domain:** `PIPE-*` → `Backend/src/shared/errors/catalog/pipe.errors.ts`

> **Read before making any change to this service.**  
> Every change, user decision, or architectural rule must be appended to the  
> **"Living Decisions"** section at the bottom of this file.

---

## Purpose

Manages the full lifecycle of ETL pipeline definitions: create, save, version,
generate code, run, inspect lineage, and manage permissions/audit logs.

A pipeline is the core artifact of the platform. It stores a visual DAG as an
IR (Intermediate Representation) payload plus UI layout in the versioned content store.

---

## File Map

| File | Role |
|---|---|
| `Backend/src/api/routes/pipeline.routes.ts` | All `/api/pipelines/*` endpoints — **primary implementation** |
| `Backend/src/api/controllers/pipeline.controller.ts` | Legacy controller (uses old `pipeline.repository.ts`) — **partially superseded** |
| `Backend/src/db/repositories/pipeline.repository.ts` | **⚠️ LEGACY** — uses unqualified `pipelines` table with banned columns |
| `Backend/src/db/repositories/artifact.repository.ts` | Generated code artifact storage |
| `Backend/src/codegen/codegen.service.ts` | Code generation — called by `POST /:id/generate` |

---

## ⚠️ CRITICAL: Dual-Implementation Split

There are **two parallel pipeline implementations**. This is a known tech debt to be unified:

| Layer | Implementation | Schema Used | Status |
|---|---|---|---|
| `pipeline.routes.ts` (inline handlers) | New-style | `catalog.pipelines`, `catalog.pipeline_versions`, `catalog.pipeline_contents` | **CORRECT — use this** |
| `pipeline.controller.ts` + `pipeline.repository.ts` | Legacy | `pipelines` (unqualified, no schema), uses `is_active`, `name`, `tags` | **WRONG — must be eliminated** |

**Rule:** All new development goes into `pipeline.routes.ts` inline handlers using the
`catalog.*` schema. The legacy repository/controller is kept only because `validate`,
`generate`, `listArtifacts`, `getArtifact`, `downloadArtifact`, `getVersionHistory`,
`getExecutions` still delegate to it. These must be migrated to inline `catalog.*` SQL
one endpoint at a time.

---

## API Surface

| Method | Path | Handler | Notes |
|---|---|---|---|
| `POST` | `/api/pipelines` | inline in routes | Creates in `catalog.pipelines` |
| `GET` | `/api/pipelines` | legacy `ctrl.list` | **LEGACY** — reads from unqualified `pipelines` table |
| `GET` | `/api/pipelines/:id` | inline in routes | Reads `catalog.pipelines` + active version content |
| `PUT` | `/api/pipelines/:id` | inline in routes | Rename OR full versioned save (creates new `pipeline_versions` + `pipeline_contents`) |
| `DELETE` | `/api/pipelines/:id` | inline in routes | Physical delete |
| `POST` | `/api/pipelines/:id/validate` | legacy `ctrl.validate` | Validates IR via codegen service |
| `POST` | `/api/pipelines/:id/generate` | legacy `ctrl.generate` | Codegen + artifact persist |
| `GET` | `/api/pipelines/:id/artifacts` | legacy `ctrl.listArtifacts` | |
| `GET` | `/api/pipelines/:id/artifacts/:artifactId` | legacy `ctrl.getArtifact` | |
| `GET` | `/api/pipelines/:id/artifacts/:artifactId/download` | legacy `ctrl.downloadArtifact` | |
| `GET` | `/api/pipelines/:id/history` | legacy `ctrl.getVersionHistory` | |
| `GET` | `/api/pipelines/:id/executions` | legacy `ctrl.getExecutions` | |
| `POST` | `/api/pipelines/:id/run` | inline in routes | Creates `execution.pipeline_runs` row |
| `GET` | `/api/pipelines/:id/lineage` | inline in routes | Reads `execution.run_lineage` |
| `GET` | `/api/pipelines/:id/permissions` | inline in routes | Reads `gov.project_user_roles` |
| `PUT` | `/api/pipelines/:id/permissions` | stub | Not yet implemented |
| `GET` | `/api/pipelines/:id/audit-logs` | inline in routes | Reads `history.pipelines_history` |

---

## Database Tables (correct — catalog schema)

| Table | Purpose |
|---|---|
| `catalog.pipelines` | Master record — `pipeline_id`, `project_id`, `pipeline_display_name`, `pipeline_desc_text`, `active_version_id` |
| `catalog.pipeline_versions` | Immutable version records — `version_id`, `pipeline_id`, `version_num_seq`, `commit_msg_text`, `release_tag_label` |
| `catalog.pipeline_contents` | IR + UI payload — `version_id`, `ir_payload_json`, `ui_layout_json` |
| `execution.pipeline_runs` | One row per triggered run |
| `execution.run_lineage` | Column-level lineage per run |
| `history.pipelines_history` | Audit shadow table (auto-populated by trigger) |
| `gov.project_user_roles` | RBAC — accessed via project_id FK from pipeline |

---

## Versioning Model

```
catalog.pipelines (1)
  └── catalog.pipeline_versions (many — append-only)
        └── catalog.pipeline_contents (1:1 — body is mandatory, Law 14)
```

- Every `PUT /:id` with `nodes`/`edges` creates a new version (auto-increments `version_num_seq`).
- `catalog.pipelines.active_version_id` always points to the latest committed version.
- `GET /:id` joins through `active_version_id` → `pipeline_contents` to return the IR.
- **Law 14:** Every version MUST have a `pipeline_contents` row. Never create a version without its body.

---

## IR Payload Structure (`ir_payload_json`)

```json
{
  "nodes": [ { "id": "...", "type": "...", "data": { ... } } ],
  "edges": [ { "id": "...", "source": "...", "target": "..." } ]
}
```

The full node type definitions live in `Backend/src/codegen/core/types/pipeline.types.ts`.

---

## Business Rules

1. `pipelineDisplayName` is required on create.
2. `projectId` is required on create — a pipeline must always belong to a project.
3. A rename (`PUT` with only `pipelineDisplayName`) does NOT create a new version.
4. A full save (`PUT` with `nodes`/`edges`) always creates a new immutable version + content row.
5. Physical delete — `history.pipelines_history` trigger captures pre-delete image.
6. `POST /:id/run` creates a `PENDING` `pipeline_runs` row. Actual execution is handled
   by the execution engine (not yet implemented) reading the `PENDING` queue.
7. Lineage is written by the execution engine to `execution.run_lineage` — the API only reads it.

---

## Known Issues & Tech Debt

| Issue | Severity | Notes |
|---|---|---|
| Legacy `pipeline.repository.ts` uses `pipelines` (no schema), `is_active`, `name`, `description`, `tags` — **all violate architecture laws** | CRITICAL | Must be eliminated. Migrate all endpoints to `catalog.*` inline SQL |
| `GET /api/pipelines` (list all) still uses legacy controller → wrong table | HIGH | Rewrite in `pipeline.routes.ts` using `catalog.pipelines` |
| `validate`, `generate`, `listArtifacts`, `downloadArtifact`, `getVersionHistory` delegate to legacy controller/repository | HIGH | Must be migrated endpoint by endpoint |
| `PUT /:id/permissions` is a stub — returns `{ success: true }` without doing anything | HIGH | Implement `gov.project_user_roles` upsert |
| No pipeline `SKILL.md`-level validation that `ir_payload_json` matches the codegen schema | MEDIUM | Validate on save |
| `POST /:id/run` does not check if `active_version_id` is NULL before inserting | MEDIUM | Null version_id will break execution engine |

---

## Living Decisions

> Append every user decision, architectural ruling, or critical instruction here.

- `2026-03-17` — SKILL.md created. Dual-implementation split fully documented above.
- `2026-03-17` — **Critical Decision:** New pipeline work targets `catalog.*` schema ONLY.
  Legacy `pipeline.repository.ts` (using unqualified `pipelines` table) must be migrated and removed.
- `2026-03-17` — **Law 14:** Every `pipeline_versions` row MUST have a corresponding
  `pipeline_contents` row. `pr_commit_pipeline_version` stored procedure enforces this atomically.
  The backend inline SQL must replicate this guarantee (insert version + content in same transaction).
- `2026-03-17` — **Versioning Rule:** Versions are immutable. Once a `pipeline_contents` row is
  written, it is never updated. A save always creates a new version, never overwrites the old one.
