# Multi-Transform Component — Detailed Requirements Document

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-03-01  
**Audience:** Product, Engineering, QA, UX

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Guiding Design Philosophy](#2-guiding-design-philosophy)
3. [User Workflows and UX Requirements](#3-user-workflows-and-ux-requirements)
4. [Plain-Language Transformation Catalog](#4-plain-language-transformation-catalog)
5. [Transformation Chaining and Error Handling](#5-transformation-chaining-and-error-handling)
6. [UI Design and Component Specification](#6-ui-design-and-component-specification)
7. [Execution Model and Code Generation](#7-execution-model-and-code-generation)
8. [Technology-Specific Code Generation Rules](#8-technology-specific-code-generation-rules)
9. [Persistence and Versioning](#9-persistence-and-versioning)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Security and Governance](#11-security-and-governance)
12. [Testing Matrix and Acceptance Criteria](#12-testing-matrix-and-acceptance-criteria)
13. [Open Questions and Decisions](#13-open-questions-and-decisions)

---

## 1. Purpose and Scope

### 1.1 Purpose

The Multi-Transform Component is a single, enterprise-grade UI component embedded within the ETL platform. It enables users — from data engineers to business analysts with no coding background — to compose, preview, reorder, validate, version, and persist a sequence of transformations applied to a single data column.

The component bridges the gap between technical SQL/Spark expressions and human-readable intent. A business user should be able to describe what they want to do to a column (e.g., "remove the time from this date", "replace blank values with zero") without knowing the underlying SQL syntax. The system then generates the correct, engine-specific, syntactically valid code behind the scenes.

### 1.2 Scope

| In Scope | Out of Scope |
|---|---|
| Column-level transform composition for ETL pipelines | Multi-column join-based transforms |
| Visual editor: add, edit, reorder, enable/disable, preview | Dataset-level aggregations as primary use case |
| Code generation for Spark SQL, PostgreSQL, Redshift | Custom engine plugin development |
| Persisted transform objects with versioning and audit trail | Orchestration scheduling |
| Integration with pipeline execution and mapping components | Data lineage graph UI |
| RBAC and governance controls | External secret management integration |

---

## 2. Guiding Design Philosophy

### 2.1 User-Friendliness First

> **Core Principle:** Every transformation presented in the UI must be described in plain, everyday language. Technical function names are hidden from the user. A layperson must be able to read a transform step and immediately understand what it does to their data.

**Examples of how this applies:**

| Technical Name | User-Facing Label | User-Facing Description |
|---|---|---|
| `trim_timestamp` | Remove Time from Date | "Keeps only the date part (e.g. 2024-06-15) and removes the hours, minutes, and seconds." |
| `to_number` | Convert Text to Number | "Turns a value stored as text (e.g. '1,200.50') into a real number the system can calculate with." |
| `regex_extract` | Pull Text Using a Pattern | "Finds and extracts a specific part of your text using a pattern you define. A wizard helps you build it." |
| `coalesce` | Use First Available Value | "Checks each value in your list in order and uses the first one that is not blank." |
| `null_if` | Blank Out a Specific Value | "If the value equals what you specify, treat it as blank (null) instead." |
| `map_lookup` | Replace Values Using a Lookup Table | "Swaps values based on a table you define — like replacing department codes with department names." |

### 2.2 Code Generation Philosophy

> **Core Principle:** The system generates **only syntactically valid, natively supported code** for the chosen target engine. It never silently emits broken or unsupported syntax.

- If a transformation is **natively supported** by the selected engine, the correct native syntax is generated automatically.
- If a transformation is **not natively supported**, the user is shown a clear warning **before saving or applying**, explaining what the limitation is and what alternatives exist.
- The system **never generates placeholder, pseudo-code, or fallback UDF stubs** unless the user explicitly opts in after seeing the warning.
- Code generation is **engine-aware from the moment the user starts building** — transforms that are unsupported on the selected engine are visually flagged in the palette before they are even added.

---

## 3. User Workflows and UX Requirements

### 3.1 Workflow: Create a Transform Sequence

```
User opens column in Mapping Editor
  └─> Clicks "Add Transformations" button on the column
        └─> Multi-Transform Editor opens (modal or side panel)
              └─> User sees palette of categorized transformations in plain language
                    └─> User clicks a transformation to add it as Step 1
                          └─> Parameters panel appears on the right with plain-language form
                                └─> User fills in parameters (guided by examples and tooltips)
                                      └─> Preview pane updates automatically
                                            └─> User adds more steps, repeating above
                                                  └─> User clicks Save
```

**Requirements:**
- The editor must open scoped to a single column, displaying the column name and data type prominently in the header.
- Each added step is assigned a sequential number (Step 1, Step 2, …) automatically.
- The palette must group transformations into plain-language categories (see Section 4).
- On first open for a column, if no prior transform exists, the editor starts empty with a "Get started by adding your first step" prompt.

### 3.2 Workflow: Edit a Transform Step

- Clicking a step in the list opens its parameter panel on the right.
- All parameter changes are validated **immediately** (client-side where possible, server-side for complex expressions).
- The preview pane refreshes automatically within 1 second of a valid change.
- Validation errors are shown inline beneath the relevant parameter field, in plain language (e.g., "The date format you entered doesn't match the values in this column. Try 'MM/dd/yyyy'").

### 3.3 Workflow: Reorder Steps

- Each step row has a drag handle on the left.
- Dragging a step to a new position reorders the sequence.
- Step numbers update instantly after drop.
- Preview recalculates immediately after reorder.
- Keyboard shortcut: `Alt + Up Arrow` / `Alt + Down Arrow` to move the selected step.

### 3.4 Workflow: Enable / Disable a Step

- Each step row has a toggle switch on the right.
- Disabling a step grays it out visually and excludes it from the chain — but it is not deleted.
- The preview and code generation reflect only enabled steps.
- Disabled steps are persisted as part of the saved transform object with `enabled: false`.

### 3.5 Workflow: Group Steps into a Block (Nested Transforms)

- User right-clicks multiple steps (or uses context menu) and selects "Group into Block".
- The block appears as a single collapsible step in the list.
- A block can be named (e.g., "Normalise Date Format").
- Blocks can be expanded to show their internal steps, or collapsed to a single row.
- Blocks can be reordered as a unit.
- Blocks can be ungrouped back into individual steps.

### 3.6 Workflow: Conditional Transforms (If/Else and Case/When)

- User adds an "If / Else" or "Multiple Conditions (Case)" step from the Conditional category.
- For **If / Else**: user defines one condition and two sub-step sequences (True branch, False branch) using a plain-language condition builder.
- For **Multiple Conditions (Case)**: user defines N condition/action pairs and an Else sequence.
- Each branch contains its own ordered list of steps.
- Branches are visually indented to show hierarchy.
- Plain-language condition builder replaces raw SQL for conditions (see Section 4 on Conditional UI).

### 3.7 Workflow: Preview and Sample Data

- The preview pane shows a table with: Row ID, Original Value, Value After Each Step, Final Value.
- Sampling strategies (user selectable):
  - **First N rows** (default N = 100)
  - **Random N rows**
  - **Stratified** (equal representation of distinct values)
  - **Custom Filter** (user writes a plain SQL WHERE clause)
- Preview must return results within 1 second for N = 100 on a warmed cache.
- Changed characters in the Final Value are highlighted in yellow compared to Original Value for easy diff reading.

### 3.8 Workflow: Save and Version

- User clicks **Save** (or presses `Ctrl + S`).
- A dialog prompts for:
  - Transform sequence name (required, e.g., "Normalise Order Date for Reporting")
  - Version description / change note (optional free text)
- Each save creates a new immutable version. Prior versions remain accessible.
- The version list is accessible via a "Version History" panel (clock icon in header).

### 3.9 Workflow: Apply to Pipeline

- User clicks **Apply to Pipeline**.
- The saved transform sequence is linked to the column in the mapping component.
- The engine-specific code is included in the pipeline's generated execution code.
- If the selected pipeline target engine does not support one or more transforms, a warning summary is shown before applying, listing the unsupported steps and available alternatives.

### 3.10 UX Rules Summary

| Rule | Detail |
|---|---|
| One editor per column | Editor is always scoped to a single column |
| Step numbering | Visible bold sequence number to the left of every step |
| Compact mode | Collapsed row shows step label + key parameter summary |
| Expanded mode | Shows full parameter form, inline examples, and validation messages |
| Inline help | Every step has a plain-language description and a worked example visible at all times |
| Undo / Redo | Unlimited depth within session. `Ctrl+Z` undo, `Ctrl+Y` redo |
| Keyboard shortcuts | `Enter` add step, `Ctrl+S` save, `Alt+↑/↓` reorder |
| Accessibility | Full keyboard navigation, ARIA roles on list and items, screen reader labels on all controls |
| Engine awareness | Unsupported transforms for the current engine are visually disabled in the palette |

---

## 4. Plain-Language Transformation Catalog

### 4.1 Catalog Structure

Transformations are grouped into categories using plain-language category names. Technical primitive IDs are used internally only and never shown to the user.

| User-Facing Category | Technical Category | What it covers |
|---|---|---|
| Convert Data Type | Conversion | Change how the value is stored or interpreted |
| Work with Text | String | Extract, replace, trim, or format text values |
| Work with Dates | DateTime | Parse, format, add or subtract from date/time values |
| Work with Numbers | Numeric | Round, floor, ceil, convert numeric values |
| Find & Replace with Patterns | Regex | Extract or replace using pattern matching (wizard-guided) |
| Conditional Logic | Conditional | If/Else and Case/When branching |
| Handle Missing Values | Aggregation / Coalesce | Deal with nulls, blanks, and fallback values |
| Custom Expression | Custom UDF | Advanced: write your own expression |

### 4.2 Full Transformation Catalog

Each entry below defines: User Label, Description (shown in UI), Parameters, Sample Input → Output, Technical ID, and Engine Support Notes.

---

#### Category: Convert Data Type

---

**Transform: Convert Text to Number**
- **Technical ID:** `to_number`
- **Description shown in UI:** "Turns a text value like '1,200.50' into a real number the system can do maths with. Choose your number format and locale."
- **Parameters (plain-language form):**
  - *Number format* — e.g., `#,##0.00` (with tooltip explaining what each symbol means)
  - *Locale* — Dropdown (e.g., English US, English UK, French, German)
  - *What to do if it can't convert* — Toggle: Fail the pipeline / Use blank (null)
- **Sample:** `"1,200.50"` → `1200.50`
- **Engine Support:** Spark SQL (native), PostgreSQL (native), Redshift (native)

---

**Transform: Convert Text to Date**
- **Technical ID:** `to_date`
- **Description shown in UI:** "Converts a text value that looks like a date (e.g., '15-Jun-2024') into a proper date the system understands. Tell it what format your text is in."
- **Parameters:**
  - *What does your date text look like?* — Format picker with guided examples (e.g., `dd-MMM-yyyy`, `MM/dd/yyyy`, `yyyy-MM-dd`)
  - *Timezone* — Dropdown of IANA timezones
  - *Strict matching* — Toggle: Yes (fail on partial match) / No (best-effort parse)
  - *What to do if it can't convert* — Fail / Use blank
- **Sample:** `"15-Jun-2024"` with format `dd-MMM-yyyy` → `2024-06-15`
- **Engine Support:** Spark SQL (native), PostgreSQL (native), Redshift (native)

---

**Transform: Change Data Type**
- **Technical ID:** `cast`
- **Description shown in UI:** "Directly changes the data type of this column's value. For example, turn a decimal number into a whole number, or a number into text."
- **Parameters:**
  - *Convert to* — Dropdown: Text, Whole Number (Integer), Decimal Number, Date, Timestamp, Boolean
  - *Format hint* — Appears conditionally for Date/Timestamp targets
- **Sample:** `1200.75` (Decimal) → `1200` (Whole Number)
- **Engine Support:** Spark SQL (native), PostgreSQL (native), Redshift (native)

---

#### Category: Work with Text

---

**Transform: Extract Part of Text**
- **Technical ID:** `substring`
- **Description shown in UI:** "Pulls out a piece of text from a specific position. For example, get the first 3 characters, or characters 5 through 10."
- **Parameters:**
  - *Start at position* — Number input (helper text: "1 = first character")
  - *How many characters?* — Number input
  - *Position counting style* — Toggle: Start from 1 (natural) / Start from 0 (technical)
- **Sample:** `"ORDER-20240615"` start=7, length=8 → `"20240615"`
- **Engine Support:** Spark SQL (native), PostgreSQL (native), Redshift (native)

---

#### Category: Work with Dates

---

**Transform: Remove Time from Date**
- **Technical ID:** `trim_timestamp`
- **Description shown in UI:** "Keeps only the date part and removes the time. For example, '2024-06-15 14:32:00' becomes '2024-06-15'. You can also round to the start of the month or year."
- **Parameters:**
  - *Round down to* — Dropdown: Day (default), Month, Year
- **Sample:** `"2024-06-15 14:32:00"` → `"2024-06-15"`
- **Engine Support:** Spark SQL (native `trunc`), PostgreSQL (native `DATE_TRUNC`), Redshift (native `DATE_TRUNC`)

---

**Transform: Add Time to a Date**
- **Technical ID:** `date_add`
- **Description shown in UI:** "Adds a number of days, months, or years to a date value. Useful for calculating deadlines, expiry dates, or future periods."
- **Parameters:**
  - *Add* — Number input
  - *Unit* — Dropdown: Days, Months, Years
- **Sample:** `"2024-06-15"` + 1 Month → `"2024-07-15"`
- **Engine Support:** Spark SQL (native `date_add` for days, `add_months` for months), PostgreSQL (`+ INTERVAL`), Redshift (`DATEADD`)
- **⚠ Note:** Month and Year arithmetic may differ by engine in leap year and end-of-month scenarios. The UI will show the engine-specific behaviour.

---

**Transform: Subtract Time from a Date**
- **Technical ID:** `date_sub`
- **Description shown in UI:** "Subtracts a number of days, months, or years from a date value. Useful for calculating past periods, age, or cutoff dates."
- **Parameters:**
  - *Subtract* — Number input
  - *Unit* — Dropdown: Days, Months, Years
- **Sample:** `"2024-06-15"` − 30 Days → `"2024-05-16"`
- **Engine Support:** Spark SQL (native), PostgreSQL (`- INTERVAL`), Redshift (`DATEADD` with negative)

---

#### Category: Work with Numbers

---

**Transform: Round a Number**
- **Technical ID:** `round`
- **Description shown in UI:** "Rounds a decimal number to a set number of decimal places. You can choose standard rounding, always round up, or always round down."
- **Parameters:**
  - *Decimal places* — Number input (0–10)
  - *Rounding mode* — Dropdown: Standard (half-up), Always Round Up (ceiling), Always Round Down (floor)
- **Sample:** `1200.567` to 2 decimal places → `1200.57`
- **Engine Support:** Spark SQL (native), PostgreSQL (native), Redshift (native)

---

**Transform: Round Down to Whole Number**
- **Technical ID:** `floor`
- **Description shown in UI:** "Always rounds a decimal number **down** to the nearest whole number, regardless of the decimal portion."
- **Parameters:** None
- **Sample:** `1200.99` → `1200`
- **Engine Support:** All engines (native)

---

**Transform: Round Up to Whole Number**
- **Technical ID:** `ceil`
- **Description shown in UI:** "Always rounds a decimal number **up** to the nearest whole number, regardless of the decimal portion."
- **Parameters:** None
- **Sample:** `1200.01` → `1201`
- **Engine Support:** All engines (native)

---

#### Category: Find & Replace with Patterns

> Pattern steps use a built-in Pattern Wizard that lets users test their pattern against live sample data with highlighted match groups — no prior regex experience required.

---

**Transform: Pull Text Using a Pattern**
- **Technical ID:** `regex_extract`
- **Description shown in UI:** "Finds a specific piece of text that matches a pattern you define. A step-by-step wizard helps you build and test the pattern with your real data."
- **Parameters:**
  - *Pattern* — Text input with Pattern Wizard button
  - *Which match to use* — Number (1 = first match group, 2 = second, etc.)
  - *Flags* — Multi-select: Case-insensitive, Match across lines
- **Sample:** `"REF: ORD-2024-001"` with pattern `ORD-(\d{4}-\d{3})` → `"2024-001"`
- **Engine Support:**
  - Spark SQL: `regexp_extract` (native)
  - PostgreSQL: `regexp_matches` (native)
  - Redshift: `regexp_substr` (native)
  - ⚠ **Group capture syntax differs by engine. Code is generated using the correct native function for the selected engine only.**

---

**Transform: Find and Replace Using a Pattern**
- **Technical ID:** `regex_replace`
- **Description shown in UI:** "Finds text that matches a pattern and replaces it with something else. Useful for cleaning up messy or inconsistent values."
- **Parameters:**
  - *Find pattern* — Text input with Pattern Wizard button
  - *Replace with* — Text input (supports back-references like `$1`)
  - *Flags* — Multi-select: Case-insensitive, Replace all occurrences
- **Sample:** `"  Hello   World  "` with pattern `\s+`, replace with `" "` → `"Hello World"`
- **Engine Support:**
  - Spark SQL: `regexp_replace` (native)
  - PostgreSQL: `regexp_replace` (native)
  - Redshift: `regexp_replace` (native)

---

#### Category: Conditional Logic

> Conditions in these steps are built using a plain-language condition builder — no SQL knowledge needed. Users pick field, comparator, and value from guided dropdowns.

---

**Transform: If / Else**
- **Technical ID:** `if_else`
- **Description shown in UI:** "Applies different transformations depending on whether a condition is true or false. Think of it as 'IF this is true, do X — otherwise, do Y'."
- **Parameters:**
  - *Condition* — Plain-language condition builder (e.g., "Value is greater than 1000", "Value contains 'CANCELLED'", "Value is blank")
  - *If true, apply these steps* — Embedded ordered step list (can contain any other transforms)
  - *If false, apply these steps* — Embedded ordered step list
- **Sample:** If value > 0 → Round to 2 decimal places. Else → Use 0.
- **Engine Support:** All engines (compiled to `CASE WHEN ... THEN ... ELSE ... END`)

---

**Transform: Multiple Conditions (Case / When)**
- **Technical ID:** `case_when`
- **Description shown in UI:** "Applies different transformations for multiple possible conditions — like a decision table. You define each condition and what to do when it matches, plus a fallback for anything else."
- **Parameters:**
  - *Conditions* — Ordered list of condition/action pairs (add/remove rows)
  - Each condition row: condition builder + embedded steps for that branch
  - *Everything else (fallback)* — Embedded step list
- **Sample:** When status = 'A' → 'Active'. When status = 'I' → 'Inactive'. Else → 'Unknown'.
- **Engine Support:** All engines (compiled to `CASE WHEN … WHEN … ELSE … END`)

---

#### Category: Handle Missing Values

---

**Transform: Use First Available Value**
- **Technical ID:** `coalesce`
- **Description shown in UI:** "Checks a list of values in order and uses the first one that is not blank. If this column is blank, fall back to another column or a fixed value."
- **Parameters:**
  - *Check these in order* — Ordered list of expressions (column references or fixed values). User can reference `{{_orig}}` for the original column value.
- **Sample:** `NULL` with fallback `"Unknown"` → `"Unknown"`
- **Engine Support:** All engines (native `COALESCE`)

---

**Transform: Blank Out a Specific Value**
- **Technical ID:** `null_if`
- **Description shown in UI:** "If the value equals a specific thing (like 'N/A' or -1 or ''), treat it as blank (null) instead. Useful for cleaning sentinel values."
- **Parameters:**
  - *If the value equals* — Text / Number input
- **Sample:** `"N/A"` → `NULL`; `"Active"` → `"Active"` (unchanged)
- **Engine Support:** All engines (native `NULLIF`)

---

**Transform: Replace Values Using a Lookup Table**
- **Technical ID:** `map_lookup`
- **Description shown in UI:** "Replaces values by looking them up in a table you define or select. For example, replace department codes like 'FIN' with full names like 'Finance'."
- **Parameters:**
  - *Lookup table* — Dropdown of available mapping tables in the catalog
  - *If no match found* — Options: Use blank (null) / Keep original value / Use custom default
- **Sample:** `"FIN"` → `"Finance"` (based on lookup table)
- **Engine Support:** All engines (compiled to `LEFT JOIN` or `CASE WHEN` depending on engine and table size)

---

#### Category: Custom Expression

---

**Transform: Write Your Own Expression**
- **Technical ID:** `custom_sql`
- **Description shown in UI:** "For advanced users: write a custom expression directly in the syntax of your target engine. The editor checks your syntax automatically."
- **Parameters:**
  - *Expression* — Code editor with syntax highlighting, autocomplete for column names and functions, inline linting
  - *Validation mode* — Toggle: Strict (must be valid for selected engine) / Permissive (warn but allow)
- ⚠ **This transform is engine-specific.** Expressions written for PostgreSQL will not be used when generating Spark SQL code. The system will warn the user and block pipeline application until expressions are provided for all required engines, or the pipeline target is confirmed.
- **Engine Support:** Depends entirely on user input. System validates against selected engine's dialect.

---

## 5. Transformation Chaining and Error Handling

### 5.1 Chaining Semantics

- Steps are applied **top to bottom** in sequence.
- Each step receives the **output value of the previous step** as its input.
- Any step can reference the **original column value** using the reserved token `{{_orig}}`.
- Disabled steps are skipped transparently — the chain continues with the last enabled step's output.
- Conditional steps evaluate their condition, then route the value through the appropriate branch's sub-steps. The branch output becomes the input for the next step in the main sequence.
- Nested blocks are treated as a single logical step; internally their steps execute in order.

### 5.2 Step-Level Error Handling

Every step has an **"If something goes wrong" policy**, presented to the user as a plain-language dropdown:

| User-Facing Option | Technical Policy | Behaviour |
|---|---|---|
| Stop the pipeline with an error | `FAIL` | Pipeline run fails; error log includes step number and parameters |
| Use a blank value (null) | `RETURN_NULL` | Step output is null; chain continues |
| Use this fallback value: [input] | `USE_DEFAULT` | Step output is the user-defined default; chain continues |
| Skip this step (use previous value) | `SKIP_STEP` | Step is bypassed; previous step's output passes through |

- Validation runs on every parameter change and at preview time.
- Runtime errors log the step index, step type, input value (truncated for PII), and policy applied.

---

## 6. UI Design and Component Specification

### 6.1 Layout Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER: [Column Name] · [Data Type] · [Sample: 100 rows] [Save][Revert] │
├──────────────────────────────┬──────────────────────────────────────────┤
│ STEP LIST (left)             │ PARAMETER PANEL (right)                  │
│                              │                                          │
│ ⠿ 1  📅 Remove Time…  ●     │  Remove Time from Date                   │
│ ⠿ 2  ➕ Add Time…     ●     │  ─────────────────────────────────────── │
│ ⠿ 3  🔄 Convert…      ●     │  Round down to: [ Day ▾ ]                │
│                              │                                          │
│ [ + Add a Transformation ]   │  Example: "2024-06-15 14:32:00"          │
│                              │           → "2024-06-15"                 │
├──────────────────────────────┴──────────────────────────────────────────┤
│ PREVIEW PANE                                                             │
│ Row │ Original Value         │ After Step 1  │ After Step 2  │ Final    │
│  1  │ 2024-06-15 14:32:00    │ 2024-06-15    │ 2024-07-15    │ …        │
│  2  │ 2024-11-30 08:00:00    │ 2024-11-30    │ 2024-12-30    │ …        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Visual Design Tokens

| Token | Value |
|---|---|
| Body font | Inter 14px |
| Label font | Inter 13px |
| Code/expression font | Monaco 13px |
| Primary colour | `#0B66FF` |
| Success colour | `#16A34A` |
| Danger / error colour | `#DC2626` |
| Surface (background) | `#FFFFFF` |
| Muted / secondary text | `#6B7280` |
| Unsupported step warning | `#F59E0B` (amber) |
| Primitive icon size | 16px SVG |
| Step type icon size | 20px SVG |
| Step row height | 56px |
| Parameter row height | 44px |
| Preview row height | 28px |

### 6.3 Step Row Elements (Left to Right)

1. **Drag handle** (`⠿`) — far left; activates drag-to-reorder
2. **Sequence number** — bold 13px, left-aligned
3. **Step type icon** — 20px SVG representing the transform category
4. **Step name** — bold 13px, plain-language label
5. **Parameter summary** — 12px muted text, e.g., "Round down to: Day"
6. **Engine warning badge** — amber `⚠` if step is unsupported on selected engine
7. **Enable/disable toggle** — right-aligned
8. **Context menu (`…`)** — far right; options: Duplicate, Insert Above, Insert Below, Delete, Group into Block

### 6.4 Parameter Panel Controls

| Control Type | Usage |
|---|---|
| Single-line text input | Short text values with placeholder and example |
| Dropdown with search | Type selection, locale, timezone, unit |
| Numeric input | With min/max/step validation |
| Date/format picker | Guided format picker with live example rendering |
| Pattern Wizard | Multi-step regex builder with live sample testing and match highlighting |
| Expression editor | Syntax highlighting, column/function autocomplete, inline lint messages |
| Toggle switch | Binary options (strict/permissive, yes/no) |
| Ordered list input | For coalesce fallback list, case_when condition rows |
| Preview this step button | Runs sample for selected step only |
| Apply to all columns checkbox | Applies identical step to all selected columns in the mapping |

### 6.5 Pattern Wizard (Regex Steps)

The Pattern Wizard makes regex accessible to non-technical users:

1. **Step 1 — Describe what you're looking for:** User selects from common patterns (e.g., "Phone number", "Email address", "Numbers only", "Date", "Custom").
2. **Step 2 — Test against your data:** Sample values from the column are shown; matches are highlighted in colour per group.
3. **Step 3 — Pick which part to use:** If multiple groups match, user clicks the highlighted group they want.
4. **Step 4 — Set options:** Case-insensitive toggle, replace-all toggle.
5. The pattern is stored internally and rendered as a generated expression for the selected engine.

### 6.6 Plain-Language Condition Builder (for If/Else and Case/When)

Users never write raw SQL conditions. Instead:

- **Field selector:** Dropdown — choose "This column's value" or another column.
- **Comparator:** Dropdown in plain English — "is equal to", "is greater than", "is less than", "is blank", "is not blank", "contains", "starts with", "ends with", "is one of".
- **Value input:** Appears based on comparator — text, number, date picker, or multi-value tag input.
- Multiple conditions can be combined with **AND / OR** toggles.
- A plain-language summary of the condition is shown beneath the builder (e.g., "Value is greater than 1000 AND value is not blank").

### 6.7 Preview Pane

- **Columns:** Row ID | Original Value | Value After Step N (one column per step) | Final Value
- **Diff highlight:** Characters changed between Original and Final are highlighted yellow.
- **Long values:** Truncated at 64 chars with expand-on-hover.
- **Sampling controls:**
  - First N (default 100)
  - Random N
  - Stratified by distinct value
  - Custom filter (plain SQL WHERE clause input)
- **Performance target:** Results within 1 second for N = 100 on warmed cache.

---

## 7. Execution Model and Code Generation

### 7.1 Three-Phase Execution Model

| Phase | Actor | Description |
|---|---|---|
| Design Time | Browser / Editor | Transform sequence stored as JSON (Intermediate Representation). No code generated yet. |
| Preview Time | Preview Service | IR compiled to engine code, executed against sample data in a sandbox. Result returned to UI. |
| Runtime | Pipeline Orchestrator | IR compiled to final engine code, embedded in the pipeline execution job. |

### 7.2 Intermediate Representation (IR)

The IR is the engine-neutral, serialisable form of the transform sequence.

**IR Node Fields:**

| Field | Type | Description |
|---|---|---|
| `stepId` | string | Unique identifier within the sequence |
| `type` | string | Technical primitive ID (e.g., `trim_timestamp`) |
| `params` | object | Key/value map of parameter values |
| `enabled` | boolean | Whether this step is active |
| `onError` | enum | `FAIL`, `RETURN_NULL`, `USE_DEFAULT`, `SKIP_STEP` |
| `defaultValue` | any | Used when `onError = USE_DEFAULT` |
| `metadata` | object | Display label, user description, category |
| `children` | array | Nested steps for blocks or conditional branches |

**IR Example:**

```json
{
  "column": "order_date",
  "columnType": "VARCHAR",
  "targetEngine": "postgresql",
  "steps": [
    {
      "stepId": "s1",
      "type": "trim_timestamp",
      "params": { "unit": "day" },
      "enabled": true,
      "onError": "RETURN_NULL",
      "metadata": { "label": "Remove Time from Date" }
    },
    {
      "stepId": "s2",
      "type": "date_add",
      "params": { "unit": "month", "amount": 1 },
      "enabled": true,
      "onError": "FAIL",
      "metadata": { "label": "Add 1 Month" }
    },
    {
      "stepId": "s3",
      "type": "to_date",
      "params": { "format": "yyyy-MM-dd" },
      "enabled": true,
      "onError": "FAIL",
      "metadata": { "label": "Convert to Date" }
    }
  ]
}
```

---

## 8. Technology-Specific Code Generation Rules

### 8.1 Core Principle — Valid Syntax Only

> The code generator **must only emit syntactically valid, engine-supported code for the selected target engine.** It must never produce:
> - Placeholder or pseudo-code expressions
> - Syntax from a different engine (e.g., Spark SQL functions in a PostgreSQL output)
> - Stubbed UDF calls the user has not explicitly defined
> - Silent fallbacks that appear valid but will fail at runtime

### 8.2 Engine Selection and Validation

- The **target engine is set at the pipeline level** and is visible in the editor header.
- When the editor opens, the transform palette immediately reflects the selected engine — unsupported transforms are shown with an amber `⚠` badge and cannot be added without acknowledgement.
- When the user switches the pipeline target engine, all steps are re-validated and any newly-incompatible steps are flagged.

### 8.3 Engine Capability Matrix

This matrix defines what is **natively supported** per engine. Only native support results in direct code generation. If a primitive is not listed as native for an engine, the user is warned.

| User Label | Technical ID | Spark SQL | PostgreSQL | Redshift |
|---|---|---|---|---|
| Convert Text to Number | `to_number` | ✅ native | ✅ native | ✅ native |
| Convert Text to Date | `to_date` | ✅ native | ✅ native | ✅ native |
| Change Data Type | `cast` | ✅ native | ✅ native | ✅ native |
| Extract Part of Text | `substring` | ✅ native | ✅ native | ✅ native |
| Remove Time from Date | `trim_timestamp` | ✅ `trunc` | ✅ `DATE_TRUNC` | ✅ `DATE_TRUNC` |
| Add Time to a Date (Days) | `date_add` | ✅ `date_add` | ✅ `+ INTERVAL` | ✅ `DATEADD` |
| Add Time to a Date (Months/Years) | `date_add` | ✅ `add_months` | ✅ `+ INTERVAL` | ✅ `DATEADD` |
| Subtract Time from a Date | `date_sub` | ✅ native | ✅ `- INTERVAL` | ✅ `DATEADD` (negative) |
| Round a Number | `round` | ✅ native | ✅ native | ✅ native |
| Round Down | `floor` | ✅ native | ✅ native | ✅ native |
| Round Up | `ceil` | ✅ native | ✅ native | ✅ native |
| Pull Text Using a Pattern | `regex_extract` | ✅ `regexp_extract` | ✅ `regexp_matches` | ✅ `regexp_substr` |
| Find and Replace Using a Pattern | `regex_replace` | ✅ `regexp_replace` | ✅ `regexp_replace` | ✅ `regexp_replace` |
| If / Else | `if_else` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `CASE WHEN` |
| Multiple Conditions | `case_when` | ✅ `CASE WHEN` | ✅ `CASE WHEN` | ✅ `CASE WHEN` |
| Use First Available Value | `coalesce` | ✅ native | ✅ native | ✅ native |
| Blank Out a Specific Value | `null_if` | ✅ native | ✅ native | ✅ native |
| Replace Values Using a Lookup | `map_lookup` | ⚠ via JOIN | ⚠ via JOIN | ⚠ via JOIN |
| Write Your Own Expression | `custom_sql` | ⚠ user-defined | ⚠ user-defined | ⚠ user-defined |

> ⚠ = Supported but requires additional configuration or generates a JOIN pattern rather than an inline expression. User is informed of this before saving.

### 8.4 Code Generation Examples

For the IR example in Section 7.2, the generator produces the following for each engine:

**PostgreSQL:**
```sql
(DATE_TRUNC('day', order_date::timestamp) + INTERVAL '1 month')::date
```

**Spark SQL:**
```sql
to_date(cast(add_months(trunc(to_timestamp(order_date, 'yyyy-MM-dd HH:mm:ss'), 'DD'), 1) AS STRING), 'yyyy-MM-dd')
```

**Redshift:**
```sql
CAST(DATEADD(month, 1, DATE_TRUNC('day', order_date::timestamp)) AS DATE)
```

### 8.5 Nested Composition Rule

- The code generator processes the step list **inside-out**: innermost expressions are compiled first and their output expression is substituted into the outer template.
- This ensures that nested steps and conditional branches produce correctly composed expressions.
- Generated code is formatted for readability (indented) in the code preview panel but minified for embedding in pipeline scripts.

### 8.6 Custom Expression Handling

- `custom_sql` steps are tagged with their target engine at save time.
- If a pipeline's target engine changes after a `custom_sql` step is saved, the step is flagged as "Expression not validated for new engine" and the user must review before re-applying.
- The system will not substitute a PostgreSQL expression into a Spark SQL pipeline silently.

---

## 9. Persistence and Versioning

### 9.1 Transform Object Schema

```json
{
  "id": "uuid",
  "name": "Normalise Order Date for Reporting",
  "description": "Strips time, adds 1 month, formats as date for monthly reporting.",
  "columnId": "col_order_date",
  "pipelineId": "pipeline_orders",
  "targetEngine": "postgresql",
  "author": "user_uuid",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "currentVersionId": "v3",
  "versions": [
    {
      "versionId": "v1",
      "createdAt": "ISO8601",
      "createdBy": "user_uuid",
      "changeNote": "Initial version",
      "ir": { /* full IR snapshot */ },
      "previewSample": { /* sample data used at save time */ },
      "diff": null
    }
  ]
}
```

### 9.2 Versioning Rules

- Every **Save** action creates a new immutable version entry.
- Prior versions are **never overwritten or deleted**.
- Each version stores: full IR snapshot, the preview sample used, a step-level diff vs. prior version, and the user's change note.
- Users can **restore** any prior version (which creates a new version from the restored state, preserving history).
- Version list is accessible in the editor via a "Version History" panel (clock icon in header).

### 9.3 Audit Trail

Every save and pipeline application is logged with:

| Field | Value |
|---|---|
| `userId` | UUID of user who performed action |
| `action` | `SAVE`, `APPLY`, `REVERT`, `DELETE` |
| `timestamp` | ISO 8601 UTC |
| `versionId` | Version created or referenced |
| `pipelineId` | Pipeline where transform was applied |
| `engine` | Target engine at time of action |

---

## 10. Non-Functional Requirements

### 10.1 Performance Targets

| Metric | Target |
|---|---|
| UI interaction response | P95 ≤ 50ms for up to 200 steps |
| Preview return (N=100, warmed cache) | P95 ≤ 1 second |
| Preview return (N=100, cold cache) | P95 ≤ 5 seconds |
| Code generation (IR → engine code) | P95 ≤ 200ms |
| Runtime throughput overhead | ≤ 20% slower than equivalent hand-written code |

### 10.2 Scalability

- The editor must support up to 200 steps in a single sequence without UI degradation.
- Step list must use virtual scrolling for sequences exceeding 50 visible steps.
- Code generation must support arbitrarily deeply nested blocks (up to 10 levels) without stack overflow.

### 10.3 Accessibility

- Full keyboard navigation for all editor functions.
- ARIA roles applied to step list (`role="list"`), step items (`role="listitem"`), and all interactive controls.
- Screen reader labels on all icon buttons, toggles, and drag handles.
- Colour is **never the sole indicator** of state (errors also use icons and text).
- Colour contrast ratios meet WCAG 2.1 AA (minimum 4.5:1 for text, 3:1 for UI components).

### 10.4 Browser and Device Support

- Supported browsers: Chrome 120+, Firefox 120+, Edge 120+, Safari 17+.
- Desktop only (minimum viewport: 1280px wide). Tablet layout is a stretch goal.
- Touch-based drag-and-drop is not required in v1.

---

## 11. Security and Governance

### 11.1 Role-Based Access Control (RBAC)

| Action | Required Role |
|---|---|
| View transform sequences | `VIEWER` or above |
| Create / edit transform sequences | `EDITOR` or above |
| Apply transforms to a pipeline | `PIPELINE_EDITOR` or above |
| Delete a transform sequence | `ADMIN` |
| View version history | `VIEWER` or above |
| Restore a prior version | `EDITOR` or above |

### 11.2 Data Security

- No database credentials, API keys, or user passwords may be stored within a transform object's IR or version snapshots.
- Preview sample data returned to the UI must respect column-level data masking rules configured at the dataset level.
- Custom expressions are validated server-side; they are executed in a sandboxed query context with no write permissions.

### 11.3 Audit Requirements

- All saves, applies, reverts, and deletes are logged to the platform audit log.
- Audit entries are immutable.
- Audit log is queryable by pipeline admins with filters on user, pipeline, date range, and action type.

---

## 12. Testing Matrix and Acceptance Criteria

### 12.1 Testing Matrix

| Test Type | Coverage Required |
|---|---|
| **Unit tests** | Each primitive: happy path, null input, type mismatch, locale/timezone edge cases |
| **Unit tests** | Code generator: each engine × each primitive = correct output string |
| **Unit tests** | Condition builder: all comparator types produce correct IR |
| **Integration tests** | Preview engine: each primitive against representative sample datasets |
| **Integration tests** | Full chain: multi-step sequence preview matches expected final value |
| **Integration tests** | Engine mapping: generated code executes without error on each real engine |
| **Regression tests** | Reorder steps: sequence numbers and preview update correctly |
| **Regression tests** | Enable/disable step: chain skips disabled step correctly |
| **Regression tests** | Nested blocks: collapse/expand, reorder, ungroup |
| **Regression tests** | Conditional branches: both branches produce correct results |
| **Performance tests** | Preview latency: P95 ≤ 1s for N=100, measured against warmed preview service |
| **Performance tests** | Editor with 200 steps: UI interaction P95 ≤ 50ms |
| **Performance tests** | Runtime throughput: transform overhead ≤ 20% vs hand-written equivalent |
| **Accessibility tests** | Keyboard-only full workflow: add, edit, reorder, save |
| **Accessibility tests** | Screen reader: all controls labelled and announced correctly |
| **Accessibility tests** | Colour contrast: WCAG 2.1 AA pass on all UI states |
| **Security tests** | Custom SQL sandboxing: no write operations permitted |
| **Security tests** | RBAC: unauthorised roles cannot create, edit, or apply |

### 12.2 Acceptance Criteria

The component is accepted when **all** of the following are true:

1. **Catalog coverage:** Editor supports at minimum 17 built-in primitives and custom SQL injection, with a path to extend to 40+ without breaking changes.
2. **Reorder correctness:** Reordering any step updates all sequence numbers and preview results deterministically.
3. **Preview-runtime parity:** Preview results match runtime results for the same sample data and engine within ±0.001% tolerance for numeric values and exact match for string/date values.
4. **Code generation correctness:** For every primitive marked as native-supported in the capability matrix, the generated code is syntactically valid and executes correctly on the target engine.
5. **Engine warning coverage:** Every primitive not natively supported for a given engine shows a clear user warning and blocks pipeline application until resolved.
6. **No silent fallbacks:** The system never emits code from a different engine dialect or undefined UDF stubs without explicit user acknowledgement.
7. **Versioning and audit:** Every save creates a version entry; every apply creates an audit log entry. Neither is ever skipped.
8. **Accessibility:** Keyboard-only user can complete the full create → configure → preview → save workflow. WCAG 2.1 AA automated and manual checks pass.
9. **User-friendliness:** A usability test with 5 non-technical users (no SQL background) results in ≥ 80% task completion rate for a defined scenario (add 3 steps, preview, save).
10. **Performance:** All performance targets in Section 10.1 are met under defined load conditions.

---

## 13. Open Questions and Decisions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | What is the exact list of engines to support in v1? (Spark SQL, PostgreSQL, Redshift confirmed — Snowflake, BigQuery?) | Product | Open |
| 2 | Should `map_lookup` support inline-defined mappings (key/value entry in the editor) in addition to catalog tables? | Product/UX | Open |
| 3 | What is the PII masking policy for preview sample data returned to the UI? | Data Governance | Open |
| 4 | Should the pattern wizard support named capture groups in addition to index-based? | Engineering | Open |
| 5 | Is there a maximum sequence length enforced at save time, or only as a UX recommendation? | Engineering | Open |
| 6 | Who is responsible for defining and maintaining the `map_lookup` catalog tables? | Data Stewardship | Open |
| 7 | Does version history need a retention policy (e.g., keep last 50 versions only)? | Platform/Legal | Open |
| 8 | Is the Pattern Wizard in scope for v1 or deferred to v2? | Product | Open |

---

*End of Document*

---
> **Document Control:** This document must be updated whenever acceptance criteria, engine support, or catalog entries change. All changes require a version note and author attribution.
