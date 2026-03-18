# SKILL.md — Projects Service
**Service Domain:** `projects`  
**Last Updated:** 2026-03-17  
**Logger Name:** `LoggerFactory.get('projects')`  
**Error Domain:** No dedicated domain yet — uses inline `AppError` (NEEDS MIGRATION to `proj.errors.ts`)

> **Read before making any change to this service.**  
> Every change, user decision, or architectural rule must be appended to the  
> **"Living Decisions"** section at the bottom of this file.

---

## Purpose

Manages the top-level organisational container — `etl.projects`. Projects are the
root of the entire resource hierarchy:

```
etl.projects
  └── catalog.pipelines  (many per project)
  └── catalog.orchestrators  (many per project)
  └── etl.folders  (optional hierarchy within a project, LTREE)
  └── gov.project_user_roles  (RBAC per project)
```

There is **no workspaces concept**. `etl.projects` IS the workspace. See Law 9 in `database/memory.md`.

---

## File Map

| File | Role |
|---|---|
| `Backend/src/api/routes/projects.routes.ts` | Express routes — all `/api/projects/*` endpoints + sub-resources |
| `Backend/src/api/controllers/projects.controller.ts` | Request validation (currently thin — most logic in routes) |
| `Backend/src/api/services/projects.service.ts` | Business logic — delegates to repository |
| `Backend/src/db/repositories/projects.repository.ts` | All SQL against `etl.projects`, `etl.folders` |

---

## API Surface

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects (ordered by display name) |
| `POST` | `/api/projects` | Create project |
| `GET` | `/api/projects/:id` | Get project by ID |
| `PUT` | `/api/projects/:id` | Update project (display name, description) |
| `DELETE` | `/api/projects/:id` | Physical delete (cascade) |
| `GET` | `/api/projects/:id/pipelines` | List pipelines belonging to this project |
| `GET` | `/api/projects/:id/orchestrators` | List orchestrators belonging to this project |

---

## Database Tables

| Table | Schema | Purpose |
|---|---|---|
| `etl.projects` | `etl` | Top-level container |
| `etl.folders` | `etl` | Optional sub-folder hierarchy (LTREE + parent FK) |
| `catalog.pipelines` | `catalog` | Referenced here for sub-resource listing |
| `catalog.orchestrators` | `catalog` | Referenced here for sub-resource listing |
| `gov.project_user_roles` | `gov` | RBAC assignments per project |

**Column names (correct — not banned names):**
- `project_display_name` (NOT `name`)
- `project_desc_text` (NOT `description`)
- `created_by_user_id`, `updated_by_user_id`
- `created_dtm`, `updated_dtm`

---

## Business Rules

1. `projectDisplayName` is required on create (400 if blank).
2. Physical delete cascades — all pipelines, orchestrators, folders, RBAC rows are deleted with the project.
   The history triggers capture the pre-delete snapshot for audit.
3. Folders use a dual mechanism: `parent_folder_id` FK (referential integrity) + `hierarchical_path_ltree`
   (O(1) subtree queries). Both must be kept in sync on folder create/move.
4. No `owner_id` — project ownership is governed by `gov.project_user_roles`. Any user can be assigned
   any role at the project level.
5. No `is_active` / `lifecycle_status_code` — a project exists or is deleted. No staging state.

---

## Session Variables (required before every DB call)

```typescript
await client.query(`SET LOCAL app.user_id = '${userId}'`);
await client.query(`SET LOCAL app.encryption_key = '${encKey}'`);
```

---

## Known Issues & Tech Debt

| Issue | Severity | Notes |
|---|---|---|
| `projects.service.ts` uses inline `AppError` with hardcoded code `PROJ-001` instead of a `projErrors` catalog | HIGH | Create `Backend/src/shared/errors/catalog/proj.errors.ts` with proper factory functions |
| `projects.service.ts` column map uses `name` / `description` implicitly — check repository for banned column names | MEDIUM | Audit `projects.repository.ts` for any `name` / `description` raw SQL |
| No folder CRUD endpoints exist yet | MEDIUM | `etl.folders` table exists in DB but no API layer |
| No project-level stats endpoint (pipeline count, last run, etc.) | LOW | Needed for Dashboard |
| `DELETE /api/projects/:id` does not validate dependent resources before delete | MEDIUM | Should warn if active pipeline runs exist |

---

## How to Add a New Endpoint

1. Add route in `projects.routes.ts`
2. Add handler in `projects.controller.ts`
3. Add method in `projects.service.ts` — validate, call repository, wrap errors
4. Add SQL in `projects.repository.ts`
5. Create `Backend/src/shared/errors/catalog/proj.errors.ts` for new error codes
6. **Update this SKILL.md**

---

## Living Decisions

> Append every user decision, architectural ruling, or critical instruction here.

- `2026-03-17` — SKILL.md created. Service is partially implemented. Folder hierarchy has DB support
  but no API layer. Error catalog is inline (not a proper domain catalog file).
- `2026-03-17` — **Law (from CLAUDE.md):** `etl.projects` is the top-level container.
  No workspaces table. No workspace_id column anywhere. Law 9.
- `2026-03-17` — **Law:** No `owner_id` / `owner_user_id` on projects. Access is via `gov.project_user_roles`.
- `2026-03-17` — **Future Work:** Folder CRUD (`POST/PUT/DELETE /api/projects/:id/folders`) is required
  for the left-sidebar tree in the Frontend MetadataTree component. Must use both `parent_folder_id`
  FK and `hierarchical_path_ltree` on every write.
