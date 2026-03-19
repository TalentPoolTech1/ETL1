# Don't — Prohibited Behaviors for AI Sessions

> This file documents behaviors that have caused problems in past sessions.
> Every AI session MUST read this file before making any changes.

---

## DON'T 1 — Never write DB function definitions from scratch when they already exist in the live DB

**What happened:**
Functions already existed in the live DB (created in a previous session) with correct definitions that the backend routes already depended on. Instead of reading those definitions first, new definitions were written from scratch with different column names, column order, and logic.

**Why it was dangerous:**
- `CREATE OR REPLACE FUNCTION` in PostgreSQL cannot change a return type — the apply failed.
- The attempted "fix" was to DROP the functions and recreate from the new (wrong) definitions.
- Dropping + recreating with changed column names/logic would have silently broken every route that referenced the original column names — a bigger mess than the original problem.

**The correct behavior:**
1. When a function/procedure already exists in the live DB, run `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = '...'` FIRST.
2. Copy that definition **verbatim** into the SQL source file.
3. Only write new definitions from scratch for objects that **do not yet exist** in the DB.
4. Before applying any SQL file to the live DB, check for return type conflicts using `\df` — confirm no DROP will be needed.
5. **Never DROP a function or procedure** without: (a) explaining to the user exactly what will be dropped, (b) explaining why, and (c) confirming there is zero behavior change risk.

**Rule:** The live DB is the truth. SQL source files follow the DB — not the other way around.

---

## DON'T 7 — Never invent column names — always read the existing schema first

**What happened:**
New function definitions were written with invented audit column names. The existing schema consistently uses `created_by_user_id` / `updated_by_user_id` throughout every table — but new code was written without reading the existing tables first.

**The correct behavior:**
Before writing any SQL function, procedure, or table column that references or mirrors an existing object:
1. Read `database/schema/base_tables.sql` OR the latest `BKP/V_<version>.sql` first.
2. Follow the exact naming convention already established — do not invent new names.
3. Audit columns in this project are: `created_dtm`, `updated_dtm`, `created_by_user_id`, `updated_by_user_id`, `hist_action_by`, `hist_action_dtm`, `hist_action_cd`.

---

## DON'T 6 — Never query the live DB directly to inspect schema/functions — use the backup file

**What happened:**
Repeated `psql` queries were fired to inspect table structures, function definitions, and return types — one at a time, each requiring a permission prompt from the user.

**The correct behavior:**
The DB is exported as versioned backup files at:
`/home/venkateswarlu/Documents/ETL1/database/BKP/V_<version>.sql`

Always read the **latest `V_<version>.sql`** file (highest version number / most recently modified) to inspect any DB object. This gives a complete, accurate snapshot without firing live DB queries.

---

## DON'T 2 — Never execute code or tools mid-conversation when the user is asking a question

**What happened:**
While the user was asking a question about why functions were being dropped, tool calls for database operations were fired in parallel — before answering the question.

**The correct behavior:**
When the user asks a question or raises a concern, **stop all tool execution**, answer the question fully in text first, then wait for the user's direction before proceeding with any action.

---

## DON'T 3 — Never rewrite entire files

**What happened:**
Full file rewrites were used instead of surgical targeted edits, making it impossible to review exactly what changed and risking overwriting correct logic with incorrect logic.

**The correct behavior:**
Always use targeted `edit_file` on the exact lines that need changing. Full rewrites are strictly prohibited unless the user explicitly says "rewrite the whole file". Read the file first, identify the minimal diff, apply only that.

---

## DON'T 4 — Never assume — always verify before acting

**What happened:**
Column names, function signatures, and table structures were assumed based on what "should" exist rather than what actually exists in the DB. This caused cascading failures across routes and DB functions.

**The correct behavior:**
Before writing any DB function, route handler, or service code that references a DB object:
1. Verify the table/column names in `base_tables.sql` or by querying the live DB.
2. Verify the function signature and return type from `pg_get_functiondef()`.
3. Cross-check what the route expects vs what the DB returns.
4. Fix all three layers (DB, service, UI) in alignment — fixing one layer without checking the others breaks elsewhere.

---

## DON'T 5 — Never skip explaining a destructive or hard-to-reverse action

**What happened:**
DROP statements were fired without explaining to the user what was being dropped, why it was needed, and what the recovery plan was.

**The correct behavior:**
For any destructive action (DROP, DELETE, ALTER, force-push, etc.):
1. Stop.
2. Explain to the user: what will be dropped/deleted, why it is necessary, what the risk is, and how it will be recovered.
3. Wait for explicit user approval before proceeding.

---
