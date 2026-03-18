# SKILL.md — Users & Auth Service
**Service Domain:** `users`  
**Last Updated:** 2026-03-17  
**Logger Name:** `LoggerFactory.get('users')`  
**Error Domain:** `USR-*` → `Backend/src/shared/errors/catalog/usr.errors.ts`

> **Read before making any change to this service.**  
> Every change, user decision, or architectural rule must be appended to the  
> **"Living Decisions"** section at the bottom of this file.

---

## Purpose

Handles authentication (login, JWT issuance, session validation) and user identity
resolution (`/me`). Guards all other API routes via the `authGuard` middleware.

---

## File Map

| File | Role |
|---|---|
| `Backend/src/api/routes/auth.routes.ts` | `POST /api/auth/login`, `GET /api/auth/me` |
| `Backend/src/api/routes/user.routes.ts` | `GET /api/me` (mirrors `/auth/me` via UserController) |
| `Backend/src/api/controllers/user.controller.ts` | `getMe` — returns user profile + effective permissions |
| `Backend/src/api/middleware/auth.middleware.ts` | `authGuard` — JWT validation for all protected routes |
| `Backend/src/api/middleware/user-id.middleware.ts` | `userIdMiddleware` — extracts userId from JWT into `res.locals.userId` |
| `Backend/src/api/middleware/correlation.middleware.ts` | Injects `correlationId` / `requestId` into AsyncLocalStorage |
| `Backend/src/api/middleware/rbac.middleware.ts` | Permission checks via `HasPermission` pattern |
| `Backend/src/api/middleware/request-logger.middleware.ts` | Logs every inbound request via LoggerFactory |

---

## API Surface

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Email + password login, returns JWT |
| `GET` | `/api/auth/me` | JWT required | Returns authenticated user's profile |
| `GET` | `/api/me` | JWT required | Same as above, via UserController |

---

## Authentication Flow

```
Client → POST /api/auth/login { email, password }
  → Query etl.users WHERE email_address = $1 AND is_account_active = true
  → bcrypt.compare(password, password_hash_text)
  → jwt.sign({ sub: user_id, email, name }, APP_JWT_SECRET, { expiresIn: '8h' })
  → UPDATE etl.users SET last_login_dtm = NOW()
  → Return { token, user: { userId, email, fullName } }
```

All subsequent requests must carry `Authorization: Bearer <token>`.
`authGuard` middleware verifies the token and attaches `req.user = { userId, email, name }`.
`userIdMiddleware` then copies `req.user.userId` into `res.locals.userId` for service layer use.

---

## Database Tables

| Table | Schema | Purpose |
|---|---|---|
| `etl.users` | `etl` | User accounts — `user_id`, `email_address`, `password_hash_text`, `user_full_name`, `is_account_active`, `last_login_dtm` |
| `etl.user_attributes` | `etl` | Extended user attributes (EAV style) |
| `gov.user_roles` | `gov` | Global role assignments per user |
| `gov.project_user_roles` | `gov` | Project-scoped role assignments |
| `gov.roles` | `gov` | Role definitions |
| `gov.permissions` | `gov` | Permission definitions |
| `gov.role_permissions` | `gov` | M2M: roles → permissions |

**Critical column names:**
- `email_address` (NOT `email`)
- `password_hash_text` — stored as bcrypt hash via `crypt(pwd, gen_salt('bf',12))`
- `user_full_name` (NOT `name`)
- `is_account_active` (boolean — this is acceptable as a true account state flag, not a soft-delete)
- `last_login_dtm` (NOT `last_login_at`)

---

## JWT Configuration

| Env Var | Purpose | Default |
|---|---|---|
| `APP_JWT_SECRET` | Signing secret | `dev-secret-keep-it-safe` — **MUST be overridden in production** |
| Token expiry | `8h` | Hardcoded — configurable future work |

---

## Permissions Resolution (`GET /api/me`)

The `user.controller.ts` calls `gov.fn_get_user_permissions(user_id)` — a DB function
that aggregates permissions from both `gov.user_roles` (global) and `gov.project_user_roles`
(project-scoped). Returns a flat list of `perm_code_name` strings.

---

## Password Storage

```sql
-- Store (via lifecycle_logic.sql):
crypt(plain_password, gen_salt('bf', 12))

-- Verify (auth route):
bcrypt.compare(plain, stored_hash)  -- Node.js bcryptjs
```

**Never store plaintext passwords.** The DB function handles hashing; the Node.js `bcryptjs`
library handles verification. Both use bcrypt (blowfish, cost=12).

---

## Known Issues & Tech Debt

| Issue | Severity | Notes |
|---|---|---|
| `APP_JWT_SECRET` defaults to `'dev-secret-keep-it-safe'` — insecure in production | CRITICAL | Must enforce non-default value at startup |
| No token refresh endpoint | HIGH | Users are logged out after 8h with no way to refresh |
| No MFA support despite `mfa_secret_encrypted` column in `etl.users` | MEDIUM | Column exists but not wired up |
| No `POST /api/auth/logout` — no token invalidation mechanism | MEDIUM | JWT is stateless; logout needs a blocklist or short expiry |
| `user.controller.ts` calls `gov.fn_get_user_permissions` — this DB function may not exist yet | HIGH | Verify function exists in `database/logic/rbac_logic.sql` |
| `/api/auth/me` and `/api/me` are duplicate endpoints serving same purpose | LOW | Consolidate to one |
| No `POST /api/users` (user creation via API) — only DB-level provisioning via `lifecycle_logic.sql` | MEDIUM | Admin UI will need a user management API |
| User list / admin endpoints entirely missing | MEDIUM | Needed for governance/admin UI |

---

## Middleware Execution Order (server.ts)

```
correlationMiddleware   → injects correlationId into AsyncLocalStorage
requestLoggerMiddleware → logs request
authGuard               → validates JWT (on protected routes)
userIdMiddleware        → copies userId to res.locals
rbacMiddleware          → checks permissions (on routes that require it)
[route handler]
errorHandler            → global error serializer
```

---

## Living Decisions

> Append every user decision, architectural ruling, or critical instruction here.

- `2026-03-17` — SKILL.md created. Auth is fully functional (login + JWT). User management
  API (create/list/update/delete users) does not exist yet.
- `2026-03-17` — **Security Rule:** `APP_JWT_SECRET` must never use the default value in any
  non-local environment. Startup validation check should be added to `server.ts`.
- `2026-03-17` — **Password Rule:** Passwords are hashed via bcrypt cost=12. Never change
  the hashing algorithm without a migration plan. The DB function `crypt(pwd, gen_salt('bf',12))`
  and Node.js `bcryptjs.compare` must stay in sync.
- `2026-03-17` — **MFA Column Exists:** `etl.users.mfa_secret_encrypted` is present in the schema
  and encrypted via `pgp_sym_encrypt`. MFA flow has not been implemented in the API layer.
