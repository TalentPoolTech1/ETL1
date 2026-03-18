# SKILL.md — Metadata Service
**Service Domain:** `metadata`  
**Last Updated:** 2026-03-17  
**Logger Name:** `LoggerFactory.get('metadata')`  
**Error Domain:** `META-*` → `Backend/src/shared/errors/catalog/meta.errors.ts`

> **Read before making any change to this service.**  
> Every change, user decision, or architectural rule must be appended to the  
> **"Living Decisions"** section at the bottom of this file.

---

## Purpose

Manages the **catalog layer** — datasets, dataset column schemas, node templates
(the drag-and-drop palette), and the type mapping/transform libraries that power
the pipeline canvas.

- **Datasets** — registered data assets linked to a connector (`catalog.datasets` + `catalog.dataset_columns`)
- **Node Templates** — the palette of draggable nodes available in the canvas UI
- **Type Mapping Registry** — cross-system type compatibility (`meta.type_mapping_registry`)
- **Transform Library** — reusable transformation snippets (`meta.transform_library`)
- **Global Variable Registry** — platform-wide configuration variables (`meta.global_variable_registry`)

---

## File Map

| File | Role |
|---|---|
| `Backend/src/api/routes/node-template.routes.ts` | `/api/node-templates/*` endpoints |
| `Backend/src/db/repositories/node-template.repository.ts` | SQL for `meta.*` tables |
| *(Dataset routes — NOT YET IMPLEMENTED)* | — |
| *(Frontend)* `MetadataTree.tsx` | Left-sidebar dataset/schema browser |

---

## API Surface

### Node Templates (existing)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/node-templates` | List all node templates for canvas palette |
| `GET` | `/api/node-templates/:id` | Get single template |
| `POST` | `/api/node-templates` | Create template (admin) |
| `PUT` | `/api/node-templates/:id` | Update template (admin) |
| `DELETE` | `/api/node-templates/:id` | Delete template (admin) |

### Datasets (NOT YET IMPLEMENTED — planned)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/datasets` | List registered datasets (`?connectorId&projectId`) |
| `POST` | `/api/datasets` | Register a dataset (link connector → table) |
| `GET` | `/api/datasets/:id` | Get dataset with column schema |
| `PUT` | `/api/datasets/:id` | Update dataset metadata |
| `DELETE` | `/api/datasets/:id` | Physical delete |
| `POST` | `/api/datasets/:id/refresh-schema` | Re-introspect columns from source connector |
| `GET` | `/api/datasets/:id/columns` | List columns for dataset |
| `GET` | `/api/datasets/:id/lineage` | Dataset lineage (upstream/downstream) |

### Type Mapping & Transform Library (NOT YET IMPLEMENTED)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/meta/type-mappings` | Get type compatibility matrix |
| `GET` | `/api/meta/transform-library` | List reusable transform snippets |
| `GET` | `/api/meta/global-variables` | List global variables |

---

## Database Tables

| Table | Schema | Purpose |
|---|---|---|
| `catalog.datasets` | `catalog` | Registered datasets — `dataset_id`, `connector_id`, `dataset_display_name`, `dataset_type_code`, `source_schema_name_text`, `source_table_name_text` |
| `catalog.dataset_columns` | `catalog` | Column-level schema — `column_name_text`, `data_type_code`, `is_nullable_flag`, `constraint_type_code`, `fk_ref_dataset_id`, `fk_ref_column_name_text` |
| `catalog.asset_tags` | `catalog` | Tag assignments (NO array columns — proper join table) |
| `catalog.file_format_options` | `catalog` | File format configuration (CSV delimiters, etc.) |
| `catalog.branches` | `catalog` | Pipeline version branching metadata |
| `meta.type_mapping_registry` | `meta` | Cross-system data type compatibility |
| `meta.transform_library` | `meta` | Reusable transform snippets |
| `meta.global_variable_registry` | `meta` | Platform-wide config variables |

**Critical — `catalog.dataset_columns` composite key behaviour:**
A single column can appear in multiple rows with different `constraint_type_code` values.
Example: a column that is both a `PK` and part of a `UK` has two rows.
Never assume one row per column — always aggregate by `column_name_text`.

**Critical — `catalog.datasets` banned columns (do NOT add):**
- `name` → use `dataset_display_name`
- `description` → use `dataset_desc_text`
- `is_vetted_flag` → removed by design (see `database/memory.md`)
- `dataset_metadata_json` → removed; `catalog.dataset_columns` IS the metadata
- `tags` (array) → use `catalog.asset_tags` join table

---

## Dataset Type Codes (`dataset_type_code`)

| Code | Meaning |
|---|---|
| `TABLE` | Relational table |
| `VIEW` | Database view |
| `FILE` | File-based dataset (S3, ADLS, GCS, etc.) |
| `STREAM` | Kafka topic or streaming source |
| `API` | REST/GraphQL API endpoint |

---

## Schema Refresh Flow

`POST /api/datasets/:id/refresh-schema` must:
1. Load the dataset record → get `connector_id`, `source_schema_name_text`, `source_table_name_text`
2. Call `connectionsService.describeTable(connector_id, database, schema, table, userId)`
3. Diff returned columns against current `catalog.dataset_columns`
4. DELETE removed columns, INSERT new columns, UPDATE changed columns — in one transaction
5. Log the refresh result

The connections service owns the external introspection. The metadata service owns persistence.

---

## Node Template Structure

A node template defines the visual and functional properties of a draggable canvas node:

```typescript
{
  templateId: string
  nodeTypeCode: string          // matches codegen engine node type
  displayName: string
  category: string              // SOURCE | TRANSFORM | SINK | UTILITY
  configSchema: JSONSchema      // form schema for properties panel
  iconName: string
  isEnabled: boolean
}
```

---

## Known Issues & Tech Debt

| Issue | Severity | Notes |
|---|---|---|
| Dataset CRUD endpoints do not exist | CRITICAL | `MetadataTree.tsx` in frontend has no API to call |
| `POST /api/datasets/:id/refresh-schema` not implemented | HIGH | Column introspection result discarded after describe — must persist to `catalog.dataset_columns` |
| `meta.type_mapping_registry`, `meta.transform_library`, `meta.global_variable_registry` have no API layer | HIGH | Needed for transformation builder UI |
| No tag management endpoints (`catalog.asset_tags`) | MEDIUM | Cannot tag datasets from UI |
| `catalog.file_format_options` table has no API | MEDIUM | Needed for FILE type dataset configuration |
| `MetadataTree.tsx` currently renders static mock data | HIGH | Must be wired to real dataset/schema API |

---

## Living Decisions

> Append every user decision, architectural ruling, or critical instruction here.

- `2026-03-17` — SKILL.md created. Node template API exists. Dataset, type-mapping, and
  transform-library APIs do not exist yet. MetadataTree.tsx is rendering mocks.
- `2026-03-17` — **Column Metadata Rule:** `catalog.dataset_columns` IS the schema metadata.
  `dataset_metadata_json` was removed and must never be re-added (see `database/memory.md`).
  All column-level metadata belongs in `catalog.dataset_columns` rows.
- `2026-03-17` — **Tag Rule:** Tags on datasets/pipelines/connectors must use `catalog.asset_tags`
  join table. Never add an array column for tags (Law 11, `database/memory.md`).
- `2026-03-17` — **FK Constraint Tracking:** `catalog.dataset_columns.constraint_type_code`
  supports `PK`, `UK`, `FK`, `NONE`. Composite keys = multiple rows for same column.
  `fk_ref_dataset_id` + `fk_ref_column_name_text` track FK target for lineage resolution.
- `2026-03-17` — **Schema Refresh Ownership:** Connections service calls the external source.
  Metadata service persists the result. These concerns must not be mixed.
