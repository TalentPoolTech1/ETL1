# SKILL.md — Governance Service
**Service Domain:** `governance`  
**Last Updated:** 2026-03-17  
**Logger Name:** `LoggerFactory.get('governance')`  
**Error Domain:** `GOV-*` → `Backend/src/shared/errors/catalog/gov.errors.ts`

> **Read before making any change to this service.**  
> Every change, user decision, or architectural rule must be appended to the  
> **"Living Decisions"** section at the bottom of this file.

---

## Purpose

Governs data access, data quality, and semantic definitions across the platform.
Encompasses:
- **RBAC** — roles, permissions, user-to-role assignments (global + per-project)
- **Secrets** — encrypted environment-scoped secrets (API keys, passwords, tokens)
- **Data Quality** — DQ rule definitions and DQ check results
- **Glossary** — business term definitions
- **Data Contracts** — schema/SLA agreements between producers and consumers

---

## File Map

| File | Role |
|---|---|
| `Backend/src/shared/errors/catalog/gov.errors.ts` | `GOV-*` error factories |
| `database/logic/rbac_logic.sql` | `gov.*` CRUD stored procedures — canonical implementation |
| `database/logic/governance_logic.sql` | DQ rules, glossary, data contracts CRUD |
| *(API routes — NOT YET IMPLEMENTED)* | — |

> **No API routes exist yet for governance.** The Frontend `GovernanceView.tsx` and
> `HasPermission.tsx` component exist but the backend endpoints have not been built.
> See Known Issues / Planned Endpoints below.

---

## Database Tables

| Table | Schema | Purpose |
|---|---|---|
| `gov.permissions` | `gov` | Permission definitions (`perm_code_name`, `perm_desc_text`) |
| `gov.roles` | `gov` | Role definitions (`role_code`, `role_display_name`) |
| `gov.role_permissions` | `gov` | M2M: role → permissions |
| `gov.user_roles` | `gov` | Global role assignments: user → role |
| `gov.project_user_roles` | `gov` | Project-scoped assignments: user + project → role |
| `gov.secrets` | `gov` | Encrypted secrets per environment (`secret_value_encrypted`) |
| `gov.dq_rules` | `gov` | Data quality rule definitions |
| `gov.dq_results` | `gov` | DQ check execution results |
| `gov.glossary_terms` | `gov` | Business glossary term definitions |
| `gov.data_contracts` | `gov` | Schema/SLA contracts between datasets |

---

## RBAC Model

```
gov.permissions  (PERM_READ_PIPELINE, PERM_RUN_PIPELINE, PERM_MANAGE_CONNECTORS, ...)
     ↑ M2M via gov.role_permissions
gov.roles        (ROLE_VIEWER, ROLE_DEVELOPER, ROLE_ADMIN, ...)
     ↑ assigned via
gov.user_roles           (global assignment — user has this role on everything)
gov.project_user_roles   (scoped — user has this role only within a specific project)
```

Permission resolution (most specific wins):
1. Check `gov.project_user_roles` for user + project
2. Fall back to `gov.user_roles` (global)
3. Aggregate all permissions from the resolved role(s)

The DB function `gov.fn_get_user_permissions(user_id)` returns the flat union.
This is called by `user.controller.ts` (`GET /api/me`).

---

## Secrets Model

`gov.secrets` stores environment-scoped encrypted secrets:
- `secret_value_encrypted` → `pgp_sym_encrypt(plain_value, app.encryption_key)`
- Used by pipelines to inject credentials at runtime (Spark configuration, JDBC URLs, etc.)
- Scoped to `execution.environments` — a secret belongs to one environment

---

## Planned API Endpoints (NOT YET BUILT)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/governance/roles` | List all roles |
| `POST` | `/api/governance/roles` | Create role |
| `GET` | `/api/governance/permissions` | List all permissions |
| `GET` | `/api/governance/users/:userId/roles` | Get user's global roles |
| `POST` | `/api/governance/users/:userId/roles` | Assign global role to user |
| `DELETE` | `/api/governance/users/:userId/roles/:roleId` | Revoke global role |
| `GET` | `/api/governance/projects/:projectId/members` | List project members + roles |
| `POST` | `/api/governance/projects/:projectId/members` | Add project member with role |
| `DELETE` | `/api/governance/projects/:projectId/members/:userId` | Remove project member |
| `GET` | `/api/governance/secrets` | List secrets (metadata only, not values) |
| `POST` | `/api/governance/secrets` | Create secret |
| `GET` | `/api/governance/glossary` | List glossary terms |
| `POST` | `/api/governance/glossary` | Create glossary term |
| `GET` | `/api/governance/dq-rules` | List DQ rules |
| `POST` | `/api/governance/dq-rules` | Create DQ rule |
| `GET` | `/api/governance/data-contracts` | List data contracts |

---

## Frontend Components Waiting for These Endpoints

| Component | Path | Needs |
|---|---|---|
| `GovernanceView.tsx` | `/src/components/views/GovernanceView.tsx` | All governance endpoints |
| `HasPermission.tsx` | `/src/components/common/HasPermission.tsx` | Uses `GET /api/me` permissions array |
| `PermissionsSubTab.tsx` | Pipeline + Orchestrator sub-tabs | `GET/PUT /:id/permissions` |

---

## Known Issues & Tech Debt

| Issue | Severity | Notes |
|---|---|---|
| No governance API routes exist | CRITICAL | All endpoints listed above must be built |
| `gov.errors.ts` exists but no governance service is wired up | HIGH | Create `governance.routes.ts`, `governance.service.ts`, `governance.repository.ts` |
| RBAC is checked in frontend only via `HasPermission` — no server-side permission check on API routes | CRITICAL | `rbac.middleware.ts` exists but not applied to routes |
| `gov.secrets` encryption requires `app.encryption_key` session var — ensure all governance DB calls set it | HIGH | |
| No audit log for RBAC changes (role grant/revoke) | MEDIUM | `gov.*` tables lack history triggers in current audit_triggers.sql — verify |

---

## Living Decisions

> Append every user decision, architectural ruling, or critical instruction here.

- `2026-03-17` — SKILL.md created. Governance is DB-complete (schema, stored procedures)
  but has NO API layer. This is a major gap — the governance service must be built.
- `2026-03-17` — **RBAC Enforcement Rule:** Server-side RBAC via `rbac.middleware.ts` must
  be applied to all sensitive routes (pipeline delete, connector delete, user management).
  Frontend-only RBAC via `HasPermission` is insufficient for security.
- `2026-03-17` — **Secrets Rule:** Secret VALUES are never returned in API responses —
  only metadata (secret_name, environment, created_dtm). The encrypted blob never leaves the DB.
- `2026-03-17` — **No `owner_id` Rule:** There is no concept of a resource owner.
  All access is governed by `gov.user_roles` and `gov.project_user_roles` role assignments.
