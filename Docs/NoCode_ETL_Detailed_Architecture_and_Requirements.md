# Cloud-Neutral No‑Code Web‑Based ETL Platform — Detailed Architecture & Requirements (v1)

**Purpose**: Provide a more complete, “implementation-grade” requirement + technical architecture document for a no‑code, web-based ETL product that generates **portable batch Spark / PySpark** pipelines. This extends the existing PRD/TSD with deeper layers, components, interfaces, and operational concerns.

**Scope note**: This document is focused on **Phase 1–2** (batch ETL, code generation, multi-env config, governance), and explicitly excludes streaming/orchestration ownership (execution plane is customer-owned). Airflow integration is treated as *optional*.

---

## 0. Guiding Principles & Quality Attributes

### 0.1 Key Principles
1. **Control plane vs execution plane separation**
   - Control plane stores metadata, validates pipelines, compiles artifacts.
   - Execution plane runs generated artifacts on customer Spark.
2. **Cloud neutrality**
   - No vendor SDK lock-in in generated code. Environment-specific values are injected via config.
3. **Immutable versions**
   - Pipeline *versions* are immutable; edits create new versions or drafts.
4. **Declarative IR**
   - UI emits a stable Intermediate Representation (IR) that is independent from UI widget structure.
5. **Security-first**
   - Secrets never embedded in generated code. Secrets resolved at runtime via secret providers.
6. **Auditable & governed**
   - Every significant state change is recorded (who/what/when), tenant isolated.

### 0.2 Non-Functional Requirements (NFRs)
- **Availability**: 99.5% (SaaS target); graceful degradation if compiler is down.
- **Scalability**: horizontal scale for API; async compilation; DB read scaling.
- **Performance**:
  - DAG load < 2s for 300 nodes typical.
  - Validation < 1s typical.
  - Compile < 30s typical; large pipelines < 3 min.
- **Security**: encryption at rest, RBAC, audit log retention, tenant isolation.
- **Reliability**: idempotent compilation, retryable jobs, deterministic codegen.
- **Extensibility**: plugin approach for connectors/transforms.
- **Compliance**: SOC2-aligned practices, least privilege, change management.

---

## 1. Architecture Plan (Layered)

### 1.1 Architecture Diagram (Logical)

```mermaid
flowchart LR
  %% =========================
  %% Control Plane (Vendor)
  %% =========================
  subgraph CP[Control Plane (Vendor / SaaS or Self-Hosted)]
    direction LR

    subgraph UI[Web UI (React/TS)]
      A1[DAG Builder]
      A2[Node Config Panels]
      A3[Catalog Browser]
      A4[Env/Secrets UI]
      A5[Versioning & Review]
      A6[Compile & Artifact UI]
    end

    subgraph API[Backend API (Node.js/TS)]
      B1[AuthN/AuthZ\nJWT + RBAC/ABAC]
      B2[Pipeline Service\nDraft/Version/Validation]
      B3[Catalog Service\nConnectors/Datasets]
      B4[Environment Service\nDEV/QA/PROD + Overrides]
      B5[Compilation Orchestrator\nQueue + Status]
      B6[Artifact Service\nSigned Downloads]
      B7[Telemetry Ingest\n(optional)]
      B8[Audit/Observability\nLogs/Metrics/Trace]
    end

    subgraph DB[(PostgreSQL Metadata DB)]
      C1[Tenants/Users/Roles]
      C2[Projects/Folders]
      C3[Pipelines/Versions]
      C4[IR Snapshots + UI Metadata]
      C5[Compilation Jobs/Artifacts]
      C6[Connectors/Catalog/Schema]
      C7[Env/Overrides/Params]
      C8[Runs/Logs/Metrics]
      C9[Audit Log]
    end

    subgraph OS[(Object Storage)]
      D1[Artifacts (.zip)\n+ manifest.json]
      D2[Optional Archives\n(Audit/Logs)]
    end

    subgraph COMP[Compiler Service (Python/FastAPI)]
      E1[IR Validate/Normalize]
      E2[Plan (Logical/Physical)]
      E3[Generate Code]
      E4[Package ZIP]
      E5[Publish Artifact]
    end

    subgraph Q[Job Queue\n(Postgres/Redis/RabbitMQ)]
      F1[Compilation Job Queue]
    end
  end

  %% =========================
  %% Execution Plane (Customer)
  %% =========================
  subgraph EP[Execution Plane (Customer-Owned)]
    direction LR
    G1[Spark Runtime\n(EMR/Databricks/Dataproc/K8s)]
    G2[Orchestrator\n(Airflow/etc) optional]
    G3[Secrets Provider\n(Vault/AWS SM/GCP SM)]
    G4[Runtime Config\nYAML/JSON + Params]
  end

  %% =========================
  %% Flows
  %% =========================
  A1 -->|Draft save/validate/version| B2
  A3 -->|Browse catalog| B3
  A4 -->|Env/overrides| B4
  A6 -->|Compile request| B5
  B5 -->|enqueue| F1
  F1 -->|pull job| COMP
  COMP -->|read IR/version| DB
  COMP -->|write status/logs| DB
  COMP -->|upload artifact| OS
  B6 -->|signed URL| OS
  UI -->|download artifact| B6

  OS -->|download ZIP| EP
  EP -->|run| G1
  G3 -->|resolve secrets| G1
  G4 -->|inject params/config| G1
  G1 -->|optional telemetry push| B7
  B7 --> DB
  B8 --> DB
```

### 1.2 High-Level Component Map
**Frontend (Web UI)**
- DAG Builder
- Config Panels
- Versioning & Review
- Environment & Secrets UI
- Catalog Browser

**Control Plane APIs (Backend)**
- Auth + RBAC
- Pipeline CRUD + Validation
- Versioning + Lifecycle
- Connector & Catalog
- Compilation Orchestration
- Artifact Management
- Audit & Observability

**Compiler Service**
- IR validation + normalization
- Physical planning
- Code generation (templates)
- Packaging
- Artifact publication
- Compile logs

**Metadata Store (PostgreSQL)**
- Tenants/users/projects/pipelines/versions/IR
- Connectors/datasets/schema registry
- Environments/overrides
- Runs/logs/metrics (control-plane view)
- Governance/audit

**Artifact Store**
- Object storage (S3/GCS/Azure Blob/minio)
- ZIP artifacts, manifests, checksums

**Optional Integrations**
- Secret providers (Vault, AWS SM, GCP SM)
- Git export (optional)
- Airflow DAG export (optional)
- External catalog (optional)

### 1.2 Data Flows (Happy Path)
1. User creates/edits pipeline in UI → UI saves draft to API.
2. User validates pipeline → API runs fast validations; returns issues.
3. User versions/publishes → API creates immutable version + IR snapshot.
4. User requests compilation → API enqueues compilation job with version_id.
5. Compiler fetches version IR → generates code → packages ZIP → uploads artifact → updates compilation status.
6. User downloads artifact or triggers external deployment/run.
7. Optional: execution telemetry is posted back (job_run, metrics, logs).

### 1.3 Deployment Topologies
- **SaaS (recommended MVP)**: multi-tenant control plane hosted by vendor.
- **Enterprise self-host**: docker compose / k8s helm chart; customer manages DB/storage.

---

## 2. Detailed Technical Architecture by Layer

## 2.1 Layer A — Web UI (Frontend)

### 2.1.1 Responsibilities
- Interactive DAG authoring
- Node configuration & schema mapping UI
- Pre-validation (basic)
- Version comparison and approval workflows (optional)
- Environment configuration editor
- Connector setup wizard
- Artifact download & compilation status view

### 2.1.2 Components
1. **DAG Canvas**
   - Pan/zoom, grid, snap, multi-select.
   - Node palette + drag drop.
   - Edge creation w/ port awareness.
   - Subgraph/collapse (optional).
2. **Node Config Panel**
   - Dynamic forms per node type.
   - Schema preview and mapping editor.
   - Join/aggregation builders.
   - Partitioning + output mode.
   - SCD templates (Type 1/2).
3. **Schema & Catalog Explorer**
   - Browse datasets, columns, tags, glossary.
   - Dataset search, filter, lineage view (optional).
4. **Validation & Diagnostics**
   - Inline errors on nodes/edges.
   - “Problems” panel with severity, code, suggested fix.
5. **Versioning UI**
   - Draft vs versioned view.
   - Commit message + tag.
   - Diff (IR diff summary; node changes).
6. **Environments UI**
   - DEV/QA/PROD environment definitions.
   - Overrides editor w/ JSON schema.
7. **Compilation & Artifacts UI**
   - Trigger compile, view status and logs.
   - Download ZIP, view manifest.

### 2.1.3 UI Data Models (contract with API)
- **PipelineDraft**: mutable UI state.
- **PipelineVersion**: immutable snapshot pointer.
- **IRDocument**: canonical payload for compiler.
- **UIMetadata**: coordinates, colors, selections, expanded/collapsed state.

### 2.1.4 UI Requirements
- Offline-safe autosave: drafts saved every N seconds or on change-set.
- Conflict resolution: optimistic concurrency via version numbers/ETags.
- Accessibility: keyboard nav, screen reader support (best effort).
- Audit display: show who changed what and when.

---

## 2.2 Layer B — API Gateway & Backend Services (Control Plane)

### 2.2.1 Responsibilities
- Multi-tenant API surface
- AuthN/AuthZ (JWT + RBAC)
- CRUD for pipelines, versions, connectors, envs
- Validation (syntactic + semantic)
- Compilation orchestration (async)
- Artifact registry & download permissions
- Audit events & observability endpoints

### 2.2.2 Suggested Service Decomposition
You can ship as a modular monolith initially; later split into services.

1. **Identity Service**
   - Users, sessions, SSO/OIDC (optional)
2. **Governance Service**
   - Roles/permissions/policies
   - Audit log writing & search
3. **Workspace Service**
   - Tenants/workspaces/projects/folders
4. **Pipeline Service**
   - Draft save/load
   - Versioning/publish
   - Validation endpoints
5. **Catalog Service**
   - Connectors, datasets, schema discovery cache
6. **Compilation Service (or orchestrator)**
   - Enqueue compilation jobs
   - Track status
   - Provide compile logs
7. **Artifact Service**
   - Artifact metadata, signed URLs for object store download
8. **Execution Telemetry Service**
   - Accept job run status/metrics/logs pushed from execution plane

### 2.2.3 API Contracts (Representative)
- `POST /pipelines` create pipeline
- `PUT /pipelines/{id}/draft` save draft payload
- `POST /pipelines/{id}/validate` validate draft
- `POST /pipelines/{id}/versions` create version from draft (commit msg)
- `GET /pipeline-versions/{versionId}/ir` fetch IR snapshot
- `POST /pipeline-versions/{versionId}/compile` enqueue compilation
- `GET /compilations/{jobId}` compilation status/logs
- `GET /artifacts/{artifactId}/download` get signed URL
- `POST /connectors` create connector (config referencing secrets)
- `POST /telemetry/job-runs` ingest run status (optional push)

### 2.2.4 Validation Responsibilities
Validation is split into two stages:
1. **Fast validation (API)**:
   - DAG acyclic, all required fields present
   - schema references exist
   - type compatibility (basic)
2. **Deep validation (Compiler)**:
   - optimized planning feasibility
   - detailed type mapping
   - join key correctness, nullability inference, etc.

### 2.2.5 Concurrency & Versioning
- Use optimistic locking with `version` column or ETag headers.
- Draft save requires matching `version` to avoid overwrites.
- Publish creates immutable `pipeline_version` + `pipeline_ir(checksum)`.

---

## 2.3 Layer C — Metadata Persistence (PostgreSQL)

### 2.3.1 Canonical Storage Strategy
- **Source of truth for pipeline logic**: `pipeline_ir.ir_payload` per version.
- **UI-only**: `pipeline_ir.ui_metadata` and `user_work_drafts.draft_payload`.
- Optional relational denormalization:
  - `transform_nodes`, `dag_edges`, `column_mappings` can be derived from IR.
  - If used, define them as *materialized* (rebuildable) for search/reporting.

### 2.3.2 Additional DB Requirements Often Needed (Recommended)
These items are commonly required for a production no-code ETL tool and are not explicit in the current DDL:

1. **Runtime Parameters (strong model)**
   - Define parameters per pipeline or per version
   - Bind per environment and per run for reproducibility

2. **Compilation Jobs (async)**
   - Separate request/job tracking from artifact outputs

3. **Immutability Enforcement**
   - DB triggers to prevent mutation of versioned artifacts/IR

4. **Tenant Isolation**
   - Either add `tenant_id` everywhere or enforce RLS with inherited tenancy

5. **Release/Promotion Model**
   - Promote a compiled artifact/version to environments with approvals

### 2.3.3 Recommended Additional Tables (Conceptual)
- `pipeline_parameters`
- `pipeline_parameter_bindings`
- `job_run_parameters`
- `compilation_jobs`
- `environment_releases` (promotion history)
- `connector_secret_bindings`

(If you want, I can generate SQL DDL for these aligned to your existing style.)

---

## 2.4 Layer D — Compilation Orchestration (Async System)

### 2.4.1 Responsibilities
- Queue compile jobs
- Deduplicate compilations by checksum (optional)
- Rate limit / quota
- Retry policy
- Correlate logs and final artifacts

### 2.4.2 Components
1. **Job Queue**
   - Options: Postgres-based queue, Redis (BullMQ), RabbitMQ, Kafka.
   - MVP: Postgres table queue + worker polling is OK.
2. **Compilation Worker**
   - Pulls `compilation_jobs` PENDING
   - Calls compiler service with version_id
   - Updates status and persists logs
3. **Artifact Publisher**
   - Upload ZIP + manifest to object storage
   - Store checksum, size, content-type
4. **Status API**
   - Exposes job lifecycle and streaming logs (optional)

### 2.4.3 Job State Machine
`PENDING → RUNNING → (SUCCESS | FAILED | CANCELED)`
- Retries: FAILED with retry_count < max → PENDING
- Idempotency: (version_id, compiler_version, target_engine, checksum) unique key.

---

## 2.5 Layer E — Compiler Service (IR → PySpark Project)

### 2.5.1 Responsibilities
- Validate and normalize IR
- Build physical plan (Spark operators)
- Generate modular code
- Package project structure
- Produce compilation logs and manifest

### 2.5.2 Internal Modules
1. **IR Parser & Validator**
   - JSON schema validation + Pydantic models
2. **Normalizer**
   - canonical ordering, defaults, inferred metadata
3. **Logical Planner**
   - build DAG, resolve schemas, column lineage, type inference
4. **Physical Planner**
   - select Spark strategies (broadcast join hints, repartition points)
5. **Code Generator**
   - Jinja templates or AST-based generator
6. **Packaging**
   - zip project, include `requirements.txt`, `README`, `manifest.json`
7. **Static Analyzer (optional)**
   - lint, detect risky patterns

### 2.5.3 Generated Project Structure (Example)
```
pipeline_<name>/
  src/
    main.py
    pipeline/
      __init__.py
      nodes/
        node_<id>_<name>.py
      utils/
        logging.py
        io.py
        schema.py
  conf/
    base.yaml
    env.dev.yaml
    env.qa.yaml
    env.prod.yaml
  tests/ (optional)
  manifest.json
  README.md
```

### 2.5.4 Logging Requirements
- JSON structured logs
- Standard fields: `correlation_id`, `pipeline_id`, `version_id`, `node_id`, `env`
- Metrics emission:
  - record counts
  - duration per node
  - partition info
  - schema drift warnings

---

## 2.6 Layer F — Artifact Storage & Distribution

### 2.6.1 Requirements
- Immutable artifact objects
- Signed URL download
- Optional retention policies
- Checksums stored in DB and manifest

### 2.6.2 Components
- Object store bucket/container
- Artifact registry metadata in DB (`compilation_artifacts`)
- CDN (optional) for large downloads

---

## 2.7 Layer G — Execution Plane Integration (Customer-owned Spark)

### 2.7.1 Integration Modes
1. **Download & run**: user downloads ZIP, runs on Spark cluster.
2. **Git export**: push generated project to customer repo, CI builds.
3. **Orchestrator export**: generate Airflow DAG wrapper (optional).

### 2.7.2 Runtime Inputs
- env config (YAML/JSON)
- secrets resolved at runtime from secret provider
- job parameters passed via CLI or env vars

### 2.7.3 Telemetry Pushback (Optional)
- Execution runtime posts `job_runs`, `task_runs`, `job_metrics`, `job_logs` to control plane.
- Must be resilient to control plane downtime (buffer locally).

---

## 2.8 Layer H — Security & Governance Layer (Cross-cutting)

### 2.8.1 Security Controls
- RBAC: permissions on pipeline/view/edit/compile/download.
- ABAC (optional): dataset-level access policies.
- Tenant isolation: schema-level constraints + RLS.

### 2.8.2 Secret Handling
- Connector configs reference secrets by key, not value.
- Secret providers stored per tenant; references audited.
- Rotation support (optional).

### 2.8.3 Audit & Compliance
- Every create/update/delete recorded in audit tables.
- Global audit search for compliance investigations.
- Retention policies configurable per tenant.

---

## 2.9 Layer I — Observability (Control Plane)

### 2.9.1 Logs
- API request logs with request_id, tenant_id.
- Compilation logs stored with job correlation.
- Execution telemetry logs (if enabled).

### 2.9.2 Metrics
- API latency, error rates
- queue depth, compile time percentiles
- artifact download counts
- active users, pipelines per tenant

### 2.9.3 Tracing (Optional)
- OpenTelemetry traces across API → queue → compiler.

---

## 3. Detailed Functional Requirements (Expanded)

## 3.1 Pipeline Authoring
- Node types (Phase 1):
  - Source (JDBC, files), Filter, Select/Project, Derive Column, Join, Aggregate, Sort, Deduplicate, Repartition, Sink (JDBC/files), Cache/Persist
- Join builder:
  - join type, keys, null-safe equality, broadcast hints
- Aggregation builder:
  - group keys, agg funcs, window functions (optional)
- SCD templates:
  - Type 1 overwrite, Type 2 history with effective dates
- Partition config:
  - partition columns, number of partitions, coalesce options
- Schema validation:
  - column existence, types, name collisions
- Error handling policies:
  - fail-fast vs continue with quarantine (optional)

## 3.2 Versioning & Lifecycle
- Draft autosave and restore
- Immutable versions with commit messages
- Tags and release notes (optional)
- Branching optional; if present, merge rules defined

## 3.3 Compilation & Packaging
- Build targets:
  - PySpark batch
- Config-driven runtime:
  - per environment configs
  - CLI parameter overrides
- Artifact manifest:
  - pipeline_id, version_id, checksum, build time, compiler version
- Deterministic builds:
  - same IR + compiler version ⇒ same checksum artifact

## 3.4 Connector Management
- Connector types:
  - JDBC (Postgres, MySQL, SQL Server, Oracle)
  - Object storage (S3/GCS/Blob) as files
  - Warehouse connectors (Snowflake/BigQuery) via JDBC/official libs (cloud-neutral constraint may require adapters)
- Credential fields never stored in plain text; stored as secret refs
- Connector test connection endpoint (runs in control plane)

## 3.5 Environment Management
- Global environments per tenant
- Pipeline overrides per environment
- Promotion workflow (optional):
  - DEV compile → QA approval → PROD promotion

## 3.6 Auditing
- Track who created/edited/published/compiled/downloaded artifacts
- Export audit logs (CSV/JSON) (optional)

---

## 4. Interfaces & Contracts

### 4.1 IR Schema (High-Level)
IR contains:
- pipeline metadata
- nodes: type, config, inputs/outputs schema, logical expressions
- edges: connections between nodes/ports
- runtime params schema
- environment variable placeholders
- lineage metadata (optional)

### 4.2 Artifact Manifest
`manifest.json` includes:
- pipeline_id, version_id
- compiler_version, target_engine
- checksum, build_timestamp
- required runtime variables + parameters
- entrypoint command

---

## 5. Operational Requirements

### 5.1 Backups & DR
- daily DB backups, PITR if possible
- artifact store lifecycle policies
- restore tests quarterly

### 5.2 Data Retention
- logs retained 30–90 days
- audit retained 90–365 days (tenant configurable)

### 5.3 Rate Limiting & Quotas
- per-tenant compile concurrency
- max DAG nodes per pipeline (configurable)

---

## 6. Appendix — Suggested Roadmap (Phased)

### Phase 1 (MVP)
- DAG builder + draft save
- Basic connectors
- IR snapshot versioning
- Compile to PySpark project ZIP
- Environments + overrides
- RBAC + audit log
- Artifact store integration

### Phase 2
- Rich transforms (SCD, DQ)
- Async compile queue
- Telemetry ingestion + dashboards
- Promotion workflow
- External catalog sync (optional)
