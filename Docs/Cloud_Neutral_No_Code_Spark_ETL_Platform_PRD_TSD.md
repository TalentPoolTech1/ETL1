# Cloud-Neutral No-Code Spark ETL Platform

---
# 1. High-Level Product Requirements Document (PRD)

## 1.1 Product Overview

### Vision
To provide a browser-based, cloud-agnostic, no-code platform that enables enterprises to design, version, and generate production-grade PySpark ETL pipelines deployable across multi-cloud Spark environments.

The platform generates portable, environment-driven PySpark projects executable across:
- Apache Spark clusters
- Amazon EMR
- Databricks
- Google Cloud Dataproc
- Kubernetes-based Spark
- Apache Airflow orchestration

The platform does NOT own or manage compute infrastructure.

---

## 1.2 Objectives

- Eliminate manual PySpark coding for standard ETL use cases.
- Generate readable, modular, production-grade code.
- Ensure cloud portability.
- Support enterprise governance and versioning.
- Maintain strict separation between control plane and execution plane.

---

## 1.3 Scope

### In Scope (Phase 1–2)
- Browser-based DAG builder
- Connector configuration management
- Logical transformation modeling
- IR-based compilation engine
- PySpark project generation
- Multi-environment configuration support (dev/qa/prod)
- Artifact packaging (ZIP structure)
- Versioned pipelines
- Structured logging generation
- Runtime parameterization
- Metadata persistence

### Out of Scope (Phase 1–2)
- Owning Spark clusters
- Streaming pipelines
- Real-time orchestration
- BI visualization
- AI-assisted transformation
- Cross-cloud data transfer

---

## 1.4 Functional Requirements

### Pipeline Authoring
- Drag-and-drop DAG builder
- Node configuration panels
- Schema validation
- Join builder
- Aggregation builder
- SCD Type 1 and Type 2 templates
- Partition configuration
- Execution parameter configuration

### Code Generation
- Modular PySpark project generation
- Structured logging support
- Config-driven runtime
- No hardcoded credentials
- CLI parameter support
- Error handling and retries

### Versioning
- Immutable pipeline versions
- Stored IR snapshot per version
- Compilation history tracking

### Logging & Observability
Generated jobs must log:
- Job start/end timestamps
- Input/output record counts
- Execution duration
- Partition metadata
- Structured JSON logging

---

## 1.5 Non-Functional Requirements

- Cloud-neutral Spark compatibility
- High availability (99.5% SLA target)
- Secure secret handling
- Multi-tenant architecture
- Scalable compilation engine
- Idempotent job execution design

---

# 2. Technology Stack & Architecture Requirements Document (TSD)

---

## 2.1 System Architecture Overview

The system consists of:

1. Frontend (Control Plane UI)
2. Backend API (Control Plane)
3. Compiler Service (IR-based Engine)
4. Metadata Database
5. Artifact Storage

Execution infrastructure is customer-owned.

---

## 2.2 Frontend Requirements

### Technology
- React
- TypeScript
- Vite (build tool)

### Responsibilities
- DAG visualization
- Node configuration
- Connector setup
- Environment configuration
- Version management UI
- Validation before submission

---

## 2.3 Backend API Requirements

### Technology
- Node.js (TypeScript)
- REST API architecture
- JWT-based authentication
- Role-based access control

### Responsibilities
- Authentication & authorization
- Pipeline CRUD operations
- Connector management
- Version management
- Metadata persistence
- Trigger compilation
- Artifact management

---

## 2.4 Compiler Service Requirements

### Technology
- Python
- FastAPI
- Jinja2 templating
- Strongly typed IR models (Pydantic)

### Responsibilities
- Validate logical DAG
- Normalize pipeline definition
- Build Intermediate Representation (IR)
- Optional logical optimization
- Generate modular PySpark project
- Package artifact

IR must be:
- Language agnostic
- Immutable per version
- Independent from UI structure

---

## 2.5 Database Requirements

### Technology
- PostgreSQL

### Responsibilities
- Store users and tenants
- Store projects and pipelines
- Store versioned IR snapshots
- Store connectors (encrypted)
- Store audit logs

---

## 2.6 Deployment Requirements

### SaaS Deployment
- Docker containers
- Reverse proxy (NGINX)
- Hosted on a cloud provider (AWS recommended for MVP)

### Enterprise Deployment
- Docker Compose package
- Optional Kubernetes Helm chart

---

## 2.7 Security Requirements

- Secrets encrypted at rest
- No credentials in generated code
- Runtime configuration-based secret resolution
- Role-based access control
- Tenant-level data isolation

---

## 2.8 Observability Requirements

- Structured backend logging
- Compilation logs
- Audit trails
- Health check endpoints
- Metrics collection support

---

## 2.9 CI/CD Requirements

- Git-based version control
- Automated build pipeline
- Container image versioning
- Migration scripts for database updates

---

## 2.10 Scalability Considerations

- Stateless backend APIs
- Horizontal scaling support
- Independent scaling of compiler service
- Asynchronous compilation capability

---

# End of Document
