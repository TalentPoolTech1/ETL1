# Environment Variables — ETL1 Platform

**Document Type:** Developer Reference  
**Applies To:** Both `Frontend/` and `Backend/` services  
**Last Updated:** 2026-03-18

---

## What is a `.env` file?

A `.env` (dot-env) file is a plain-text file that holds **environment-specific configuration values** — things like database passwords, server ports, API URLs, and secret keys. Instead of hard-coding these values into source code, they are read at runtime from the `.env` file.

**Why not hard-code them?**

| Problem with hard-coding | How `.env` solves it |
|---|---|
| Same code runs in dev, QA, staging, production — each needs different DB passwords, different API URLs | One `.env` file per environment, same source code |
| Secrets in source code get committed to Git and become a security risk | `.env` is in `.gitignore` — never committed |
| Changing a database host would require a code change and redeployment | Change one line in `.env`, restart the process |
| Different developers may have different local setups | Each developer has their own `.env` locally |

The pattern comes from the **Twelve-Factor App** methodology — a widely adopted standard for building cloud-ready, deployable software.

---

## How variables get loaded

### Backend (Node.js)
The backend uses the `dotenv` npm package (or equivalent). On startup it reads `Backend/.env` and populates `process.env`. Code accesses values like:
```typescript
const port    = process.env.PORT ?? '3000';
const dbHost  = process.env.DB_HOST;
const secret  = process.env.JWT_SECRET;
```

### Frontend (Vite + React)
Vite has built-in `.env` support. It reads `Frontend/.env` at **build time** and **dev-server time**. Only variables prefixed with `VITE_` are injected into the browser bundle. Code accesses them like:
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
const wsUrl  = import.meta.env.VITE_WS_URL;
```

> **Critical:** Variables without the `VITE_` prefix are invisible to frontend code. This is a security guard — you cannot accidentally expose a backend secret to the browser.

---

## File inventory

```
ETL1/
├── Frontend/
│   ├── .env            ← Your local values (git-ignored, never commit)
│   └── .env.example    ← Template showing what keys are needed (committed to Git)
└── Backend/
    └── .env            ← Your local values (git-ignored, never commit)
```

There is no `.env.example` for the Backend yet — one is created below as part of this documentation.

---

## Frontend environment variables

**File:** `Frontend/.env`  
**Loaded by:** Vite (build tool and dev server)  
**Accessible in code via:** `import.meta.env.VARIABLE_NAME`

### Current variables

```ini
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
VITE_ENV=development
```

---

### `VITE_API_URL`

**Purpose:** The base URL of the backend REST API. Every API call in `Frontend/src/services/api.ts` is relative to this URL.

**How it is used:**
```typescript
// Frontend/src/services/api.ts
constructor(baseURL: string = import.meta.env.VITE_API_URL || 'http://localhost:3000/api') {
  this.client = axios.create({ baseURL, ... });
}
```
Every `api.getPipelines()`, `api.runPipeline()`, etc. prepends this URL.

**Per-environment values:**

| Environment | Value |
|---|---|
| Local development | `http://localhost:3000/api` |
| QA (on-prem) | `http://qa-server-ip:3000/api` |
| Staging (cloud) | `https://etl1-staging.yourcompany.com/api` |
| Production (cloud) | `https://etl1.yourcompany.com/api` |

**What breaks if wrong:** Every API call fails. The browser console shows CORS errors or `ERR_CONNECTION_REFUSED`. The app loads the shell but all data shows empty or error states.

---

### `VITE_WS_URL`

**Purpose:** The WebSocket server URL for real-time features — execution log streaming, live run status updates, and pipeline run progress push events.

**How it is used:**  
Currently declared but not yet wired to a WebSocket client in the frontend code. Reserved for when real-time log streaming is implemented (the execution log viewer currently polls every 5 seconds instead).

**Per-environment values:**

| Environment | Value |
|---|---|
| Local development | `ws://localhost:3000` |
| Production (HTTPS) | `wss://etl1.yourcompany.com` |

> **Note:** When the site runs on HTTPS (`https://`), WebSocket must use `wss://` (secure). Using `ws://` on an HTTPS page will be blocked by the browser.

**What breaks if wrong:** Real-time log streaming will not connect. The polling fallback will still show logs, just with a delay.

---

### `VITE_ENV`

**Purpose:** A label identifying which deployment environment the frontend is running in. Used for conditional behaviour and debug tooling.

**Possible values:** `development` | `qa` | `staging` | `production`

**How it is used (current):** Not yet wired to runtime logic, but the intent is:
- Show more verbose error messages in `development`
- Enable Redux DevTools only in `development` / `qa`
- Show environment badge in the header (currently hard-coded to "Development" — this variable should drive it)
- Disable certain debug panels in `production`

**What breaks if wrong:** Nothing critical today, but environment-specific UI guards will not work correctly once implemented.

---

## Backend environment variables

**File:** `Backend/.env`  
**Loaded by:** Node.js via `dotenv`  
**Accessible in code via:** `process.env.VARIABLE_NAME`

### Current variables

```ini
PORT=3000
NODE_ENV=development

# ── PostgreSQL ──
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=admin123
DB_NAME=etl_db

# ── Security ──
JWT_SECRET=super-secret-key-change-in-prod
APP_JWT_SECRET=super-secret-key-change-in-prod
APP_ENCRYPTION_KEY=32-character-secret-key-for-aes256

# ── Service behaviour ──
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:5173
```

---

### `PORT`

**Purpose:** The TCP port the Express HTTP server listens on.

**Used by:**
```typescript
// Backend/src/api/server.ts (or app.ts)
const port = process.env.PORT ?? 3000;
app.listen(port, () => { ... });
```

**Must match:** `VITE_API_URL` in the frontend. If you change `PORT=4000`, you must also set `VITE_API_URL=http://localhost:4000/api`.

**Per-environment values:**

| Environment | Value |
|---|---|
| Local development | `3000` |
| Docker container | `3000` (mapped by Docker to host port) |
| Cloud (behind load balancer) | `3000` (load balancer terminates on 443, forwards to 3000) |

**What breaks if wrong:** Backend refuses to start on the intended port, or frontend cannot reach the API.

---

### `NODE_ENV`

**Purpose:** Tells Node.js and all npm libraries what mode the application is running in. This is a widely-recognised convention.

**Possible values:** `development` | `test` | `production`

**What it controls:**
- Express enables detailed error stack traces when `development`
- Many libraries (Sequelize, Passport, etc.) change performance/debug behaviour
- The logging framework may change verbosity
- `production` disables development-only middleware

**What breaks if wrong:** Setting `production` locally may hide useful error messages. Setting `development` in production exposes stack traces to end users.

---

### `DB_HOST`

**Purpose:** Hostname or IP address of the PostgreSQL server.

**Per-environment values:**

| Environment | Value |
|---|---|
| Local (Postgres installed locally) | `localhost` |
| Local (Postgres in Docker) | `localhost` or `127.0.0.1` |
| On-prem server | `192.168.1.50` or `db.internal.company.com` |
| Cloud (AWS RDS) | `etl1-db.abc123xyz.us-east-1.rds.amazonaws.com` |
| Cloud (Azure Postgres) | `etl1-pg.postgres.database.azure.com` |

**What breaks if wrong:** The backend cannot connect to the database. All API calls return 500 errors. You will see `ECONNREFUSED` or `getaddrinfo ENOTFOUND` in the logs.

---

### `DB_PORT`

**Purpose:** TCP port PostgreSQL listens on. Default PostgreSQL port is `5432`.

**When to change:** If you run PostgreSQL on a non-standard port (e.g. `5433` for a secondary instance, or when two Postgres versions are installed side-by-side).

**What breaks if wrong:** Same as `DB_HOST` — connection refused errors.

---

### `DB_USER`

**Purpose:** The PostgreSQL username the backend authenticates as.

**Security note:** This user should have only the permissions it needs (SELECT, INSERT, UPDATE, DELETE on the ETL schema tables). It should **not** be the `postgres` superuser in production.

**What breaks if wrong:** Authentication failure — `password authentication failed for user "..."` in logs.

---

### `DB_PASSWORD`

**Purpose:** Password for the PostgreSQL user above.

**Security requirements:**
- Must be at least 20 characters in production
- Must not be committed to Git (`.env` is in `.gitignore`)
- Must be rotated periodically in production environments
- In cloud deployments, use a secrets manager (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault) and inject at deploy time — do not store in a `.env` file on a production server

**What breaks if wrong:** Authentication failure. Same error as above.

---

### `DB_NAME`

**Purpose:** The name of the PostgreSQL database (catalog) the backend connects to.

**Convention in this project:** `etl_db`

**Per-environment values:**

| Environment | Database name |
|---|---|
| Local development | `etl_db` |
| QA | `etl_db_qa` |
| Staging | `etl_db_staging` |
| Production | `etl_db_prod` |

Keeping separate database names per environment prevents a developer accidentally running a migration against the production database.

**What breaks if wrong:** `database "..." does not exist` error. Backend fails to start or all DB queries fail.

---

### `JWT_SECRET` and `APP_JWT_SECRET`

**Purpose:** The secret key used to **sign** JSON Web Tokens (JWTs). JWTs are the auth tokens issued on login and verified on every API request.

**Why there are two:** `JWT_SECRET` appears to be a legacy key; `APP_JWT_SECRET` is the current one used by the auth service. Both should be set to the same value during migration. Once all code references `APP_JWT_SECRET`, `JWT_SECRET` can be removed.

**How JWTs work with this key:**
1. User logs in with email + password
2. Backend verifies credentials against the database
3. Backend signs a JWT with `APP_JWT_SECRET` → sends token to browser
4. Frontend stores token in `localStorage.authToken`
5. Every subsequent API call sends `Authorization: Bearer <token>` header
6. Backend verifies the token signature using `APP_JWT_SECRET` — if tampered or using the wrong key, verification fails and a 401 is returned

**Security requirements:**
- Must be at least 32 characters, random, unpredictable
- Never the same between environments
- Never committed to Git
- Changing this key **invalidates all existing sessions** — all users are logged out
- In production: use a secrets manager; rotate annually or after any suspected compromise

**What breaks if wrong:** If you change this key, all currently issued JWTs become invalid. Users get 401 Unauthorized on every request. If you set it to something too short or predictable, tokens can be forged.

**Generate a secure value:**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

### `APP_ENCRYPTION_KEY`

**Purpose:** A symmetric encryption key used to encrypt sensitive data stored in the database — specifically **connection credentials** (passwords, API keys, OAuth secrets). The backend uses AES-256 encryption (via `pgcrypto`) with this key before storing anything sensitive.

**How it is used:**
```typescript
// Backend sets this as a PostgreSQL session variable before any DB call
await client.query(`SET LOCAL app.encryption_key = '${encKey}'`);
// PostgreSQL trigger/function then uses it to encrypt with pgcrypto
```

**Requirements:**
- Must be exactly **32 characters** for AES-256
- Must be random and unpredictable
- Must never change once data is encrypted — if you change it, all previously encrypted connection credentials become unreadable
- Must be stored in a secrets manager in production, never in a `.env` file on a server

**What breaks if wrong:**
- Wrong key → all stored connection secrets decrypt to garbage → all connections fail
- Key too short → encryption library throws an error at startup
- Key changed after data exists → data is irrecoverable without the original key

**Generate a secure value:**
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
# produces exactly 32 hex characters
```

---

### `LOG_LEVEL`

**Purpose:** Controls the minimum severity of log messages that get written to log files. Messages below this level are silently discarded.

**Levels (lowest to highest severity):**
```
TRACE → DEBUG → INFO → WARN → ERROR → FATAL
```

**Per-environment recommendation:**

| Environment | Value | Why |
|---|---|---|
| Local development | `debug` | See all details while building |
| QA | `info` | Normal operational messages |
| Staging | `info` | Mirror production behaviour |
| Production | `warn` | Only problems; minimise disk I/O |

**What changes:**
- `debug`: Logs every DB query, every HTTP request parameter, every transform step
- `info`: Logs successful operations, starts, completions
- `warn`: Logs only unexpected but non-fatal conditions
- `error`: Logs only failures

**What breaks if wrong:** Setting `trace` in production floods disk with logs and may expose sensitive request data. Setting `error` in development hides useful diagnostic messages.

---

### `CORS_ORIGIN`

**Purpose:** Cross-Origin Resource Sharing (CORS) is a browser security mechanism. When the frontend (running on `http://localhost:5173`) makes an HTTP request to the backend (running on `http://localhost:3000`), the browser considers this a "cross-origin" request and blocks it by default unless the backend explicitly permits it.

This variable tells the backend which origin(s) are allowed to make requests.

**How it is used:**
```typescript
// Express CORS middleware
app.use(cors({ origin: process.env.CORS_ORIGIN }));
```

**Per-environment values:**

| Environment | Value |
|---|---|
| Local development | `http://localhost:5173` |
| QA | `https://etl1-qa.yourcompany.com` |
| Staging | `https://etl1-staging.yourcompany.com` |
| Production | `https://etl1.yourcompany.com` |

**What breaks if wrong:**
- Wrong origin → browser blocks all API calls from the frontend with a CORS error (visible in browser DevTools Network tab as `blocked by CORS policy`)
- Setting `*` (wildcard) in production is a security risk — allows any website to call your API on behalf of a logged-in user

---

## The `.env.example` files

The `.env.example` file is the **template** that gets committed to Git. It shows every variable name that is needed, with safe placeholder values — never real secrets.

When a new developer joins or a new server is provisioned:
1. Copy `.env.example` to `.env`
2. Fill in the real values for that environment
3. Never commit `.env`

**Frontend `.env.example` is already correct** — it only contains safe URLs, no secrets.

**Backend `.env.example` has now been created** at `Backend/.env.example`.

---

## Complete variable reference at a glance

| Variable | File | Required | Secret | Changes per environment |
|---|---|---|---|---|
| `VITE_API_URL` | Frontend | Yes | No | Yes — URL changes per deployment |
| `VITE_WS_URL` | Frontend | Yes | No | Yes — URL changes per deployment |
| `VITE_ENV` | Frontend | No | No | Yes — dev/qa/staging/production |
| `PORT` | Backend | Yes | No | Rarely — usually stays 3000 |
| `NODE_ENV` | Backend | Yes | No | Yes |
| `DB_HOST` | Backend | Yes | No | Yes — different DB server per env |
| `DB_PORT` | Backend | Yes | No | Rarely |
| `DB_USER` | Backend | Yes | No | Possibly — different users per env |
| `DB_PASSWORD` | Backend | Yes | **Yes** | Yes — different passwords per env |
| `DB_NAME` | Backend | Yes | No | Yes — different DB name per env |
| `JWT_SECRET` | Backend | Yes | **Yes** | Yes — unique per env |
| `APP_JWT_SECRET` | Backend | Yes | **Yes** | Yes — unique per env |
| `APP_ENCRYPTION_KEY` | Backend | Yes | **Yes** | Yes — unique per env, never change once set |
| `LOG_LEVEL` | Backend | Yes | No | Yes — debug→info→warn |
| `CORS_ORIGIN` | Backend | Yes | No | Yes — frontend URL per env |

---

## Per-environment cheatsheet

### Local development (default)
```ini
# Frontend/.env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
VITE_ENV=development

# Backend/.env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<your local postgres password>
DB_NAME=etl_db
JWT_SECRET=<64 char random hex>
APP_JWT_SECRET=<same as above>
APP_ENCRYPTION_KEY=<exactly 32 chars>
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:5173
```

### QA / Staging (on-prem server)
```ini
# Frontend/.env  (or injected by CI/CD)
VITE_API_URL=http://192.168.1.100:3000/api
VITE_WS_URL=ws://192.168.1.100:3000
VITE_ENV=qa

# Backend/.env  (on the server)
PORT=3000
NODE_ENV=production
DB_HOST=192.168.1.101
DB_PORT=5432
DB_USER=etl_app
DB_PASSWORD=<strong random password>
DB_NAME=etl_db_qa
JWT_SECRET=<different 64 char hex from dev>
APP_JWT_SECRET=<same as JWT_SECRET>
APP_ENCRYPTION_KEY=<different 32 chars from dev>
LOG_LEVEL=info
CORS_ORIGIN=http://192.168.1.100:5173
```

### Production (cloud — SaaS)
```ini
# These should be injected by your deployment pipeline (CI/CD),
# NOT stored in .env files on the server.

# Frontend (Vite build-time — set in CI/CD environment)
VITE_API_URL=https://api.etl1.yourcompany.com
VITE_WS_URL=wss://api.etl1.yourcompany.com
VITE_ENV=production

# Backend (injected by container orchestrator / secrets manager)
PORT=3000
NODE_ENV=production
DB_HOST=<rds-endpoint or azure-pg-endpoint>
DB_PORT=5432
DB_USER=etl_app_prod
DB_PASSWORD=<from secrets manager>
DB_NAME=etl_db_prod
JWT_SECRET=<from secrets manager>
APP_JWT_SECRET=<from secrets manager>
APP_ENCRYPTION_KEY=<from secrets manager>
LOG_LEVEL=warn
CORS_ORIGIN=https://etl1.yourcompany.com
```

---

## Security rules — DO and DON'T

### DO
- ✅ Keep `.env` in `.gitignore` — both Frontend and Backend already do this
- ✅ Use `.env.example` as the committed template — safe placeholder values only
- ✅ Generate secrets with `crypto.randomBytes()` — never invent them by hand
- ✅ Use a secrets manager (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault) in production
- ✅ Use different secret values in every environment
- ✅ Back up `APP_ENCRYPTION_KEY` separately — losing it makes all stored credentials unreadable
- ✅ Update `.env.example` whenever a new variable is added
- ✅ Document every new variable in this file

### DON'T
- ❌ Never commit `.env` to Git
- ❌ Never put real passwords, JWT secrets, or encryption keys in `.env.example`
- ❌ Never use weak passwords like `admin123`, `password`, or `changeme` — not even locally
- ❌ Never set `CORS_ORIGIN=*` in production
- ❌ Never share your local `.env` via Slack, email, or chat
- ❌ Never change `APP_ENCRYPTION_KEY` in an environment that already has encrypted data
- ❌ Never use the same `JWT_SECRET` / `APP_ENCRYPTION_KEY` across environments

---

## Onboarding a new developer — step by step

1. Clone the repository
2. `cd Frontend && cp .env.example .env` — already has correct local defaults
3. `cd ../Backend && cp .env.example .env`
4. Edit `Backend/.env` — set `DB_PASSWORD` to your local PostgreSQL password
5. Generate a local JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   Paste into `JWT_SECRET` and `APP_JWT_SECRET`
6. Generate a local encryption key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   ```
   Paste into `APP_ENCRYPTION_KEY` (should be exactly 32 chars)
7. Run the database setup from `database/master_install.sql`
8. `cd Backend && npm install && npm run dev`
9. `cd Frontend && npm install && npm run dev`
10. App should be running at `http://localhost:5173`

---

## Adding a new environment variable — checklist

When you add a new variable to the codebase:

- [ ] Add it to `Backend/.env` (local value) or `Frontend/.env`
- [ ] Add it to `Backend/.env.example` (safe placeholder + comment explaining purpose)
- [ ] Add it to `Frontend/.env.example` if applicable
- [ ] Document it in this file (`ENV_VARIABLES_GUIDE.md`) with: purpose, how used, per-env values, what breaks if wrong
- [ ] Update `CLAUDE.md` Living Decisions if it affects the platform architecture
- [ ] Notify the team — other developers need to add it to their local `.env` manually
