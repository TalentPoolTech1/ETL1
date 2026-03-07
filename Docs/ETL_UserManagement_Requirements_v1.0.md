# No-Code ETL Platform — User Management Requirements

**Document Type:** Functional Requirements Specification (FRS)  
**Module:** User Management, RBAC, Security & Resource Mapping  
**Version:** 1.0 | March 2026  
**Status:** DRAFT — For Review

---

## Table of Contents

1. [Introduction & Scope](#1-introduction--scope)
2. [Roles & Permission Model](#2-roles--permission-model)
3. [Detailed Permission Matrix](#3-detailed-permission-matrix)
4. [User Management — CRUD Operations](#4-user-management--crud-operations)
5. [Resource-Level User Mappings](#5-resource-level-user-mappings)
6. [Permission Scope Definitions](#6-permission-scope-definitions)
7. [Security Requirements](#7-security-requirements)
8. [Audit Logging & Compliance](#8-audit-logging--compliance)
9. [Teams, Groups & Delegation](#9-teams-groups--delegation)
10. [UI/UX Requirements](#10-uiux-requirements)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Open Items & Implementation Notes](#12-open-items--implementation-notes)

---

## 1. Introduction & Scope

This document defines the complete functional and non-functional requirements for the User Management module of the No-Code ETL Platform. It covers identity management, role-based access control (RBAC), resource-level permissions, security policies, audit trails, and all associated CRUD operations accessible through the web-based UI.

### 1.1 Purpose

The User Management module governs who can access the ETL platform, what actions they can perform, and on which resources. It enforces least-privilege access principles and provides administrators with full visibility and control over the user ecosystem.

### 1.2 Scope of Coverage

- User lifecycle management (create, update, deactivate, delete)
- Role definitions and permission matrices
- Resource-level access mapping: Projects, Folders, Pipelines, Connections, Schedules, Environments
- Authentication and session security
- Audit logging and compliance
- UI requirements per module
- API security requirements

### 1.3 ETL Platform Resource Hierarchy

Permissions cascade downward through this hierarchy unless explicitly overridden at a lower level:

| Level | Resource | Description | Contains |
|-------|----------|-------------|----------|
| L1 | Organization | Top-level tenant boundary | Workspaces |
| L2 | Workspace | Business unit or team grouping | Projects |
| L3 | Project | Logical grouping of ETL work | Folders, Connections, Environments |
| L4 | Folder | Organizational container within a project | Pipelines, Sub-Folders |
| L5 | Pipeline | Individual ETL data flow definition | Jobs, Steps, Transformations |
| L6 | Job / Run | Single execution instance of a pipeline | Logs, Metrics, Artifacts |

---

## 2. Roles & Permission Model

### 2.1 System-Level Roles

System roles are platform-wide and not scoped to individual resources. Assigned by the Organization Administrator.

#### 2.1.1 Super Administrator

- Full unrestricted access to all organizations, workspaces, projects, and system settings
- Can create, modify, or delete any resource or user across the entire platform
- Manages billing, licensing, and platform-wide configurations
- Access to system diagnostics, infrastructure metrics, and global audit logs
- Can impersonate users for troubleshooting (with mandatory audit entry)
- Cannot be deleted; must be transferred to another user before account removal

#### 2.1.2 Organization Administrator (Org Admin)

- Full access within the assigned organization boundary
- Creates and manages workspaces, workspace admins, and all users within the org
- Configures SSO, MFA policies, password policies, and IP allowlists for the org
- Manages organization-level connections, shared environments, and licensed connectors
- Views all audit logs within the organization
- Cannot access other organizations or platform-level settings

#### 2.1.3 Workspace Administrator

- Full access within the assigned workspace
- Creates and manages projects, folders, pipelines within the workspace
- Assigns users to projects and manages project-level roles
- Views workspace-level audit logs and execution history
- Configures workspace-level settings (default environments, shared connections)
- Cannot modify org-level settings, SSO configuration, or billing

### 2.2 Functional Roles (Resource-Scoped)

Functional roles are scoped to specific resources (Project, Folder, Pipeline). A user can hold different functional roles on different resources simultaneously.

#### 2.2.1 Project Owner

- All permissions within the assigned project
- Manages project membership and assigns roles within the project to other users
- Creates, edits, executes, and deletes all folders and pipelines in the project
- Manages project-level connections and environment bindings
- Views complete project audit history
- Can archive or delete the entire project

#### 2.2.2 Developer

- Creates and edits pipelines, transformations, and data mappings in assigned scope
- Configures source/target connections within assigned pipelines
- Runs pipelines in Development and Staging environments **only** (not Production)
- Creates and manages folders within assigned project scope
- Cannot publish pipelines to production without Approver sign-off
- Cannot modify project membership, connections owned by other users, or production schedules
- Can view but not modify production pipeline configurations

#### 2.2.3 Analyst / Viewer

- View all pipeline configurations, data mappings, and transformation logic
- View execution logs, run history, metrics, and data lineage
- Cannot modify any pipeline, folder, or project configuration
- Cannot trigger any execution or schedule
- Can export run reports and lineage documentation
- Cannot view sensitive connection credentials (masked by default)

#### 2.2.4 Executor / Operator

- Can trigger immediate execution of approved/published pipelines
- Can start, stop, pause, and resume pipeline runs
- Can view execution logs, alerts, and metrics in real-time
- Cannot modify pipeline definitions, transformations, or configurations
- Can re-run failed jobs within the last 30 days
- Can manage execution schedules (enable/disable/modify run times)
- Cannot create new pipelines, folders, or connections

#### 2.2.5 Approver / Reviewer

- Reviews pipeline changes submitted by Developers for production deployment
- Approves or rejects promotion of pipelines from staging to production
- Adds review comments and change requests on pipeline submissions
- Views full diff of changes between pipeline versions
- Cannot directly edit pipelines; changes must be made by the Developer
- Can view all audit trails and change history for assigned pipelines

#### 2.2.6 Connection Manager

- Creates and manages source and target connection configurations
- Tests connectivity and validates credentials
- Assigns connections to projects and pipelines
- Rotates credentials and manages secret vault bindings
- Cannot view plaintext credentials; credentials are write-only via vault
- Cannot modify pipeline logic or execute pipelines

---

## 3. Detailed Permission Matrix

### 3.1 ETL Platform Actions — Full RBAC Matrix

| Action / Feature | Super Admin | Org Admin | WS Admin | Project Owner | Developer | Approver | Executor | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **— Users —** |
| CREATE User (Org) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| EDIT User Profile | ✅ | ✅ | Own Only | Own Only | Own Only | Own Only | Own Only | Own Only |
| DELETE / Deactivate User | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign Roles to User | ✅ | ✅ | WS Scope | Proj Scope | ❌ | ❌ | ❌ | ❌ |
| View All Users | ✅ | ✅ | WS Scope | Proj Scope | ❌ | ❌ | ❌ | ❌ |
| Impersonate User | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **— Projects —** |
| CREATE Project | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| EDIT Project Settings | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| DELETE Project | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| VIEW Project | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **— Folders —** |
| CREATE Folder | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| EDIT Folder | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| DELETE Folder | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| VIEW Folder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **— Pipelines —** |
| CREATE Pipeline | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| EDIT Pipeline (Dev/Stage) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| EDIT Pipeline (Prod) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| DELETE Pipeline | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| VIEW Pipeline Config | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SUBMIT Pipeline for Review | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| APPROVE Pipeline | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| PROMOTE Pipeline to Prod | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **— Execution —** |
| EXECUTE Pipeline (Dev) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| EXECUTE Pipeline (Prod) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| STOP / PAUSE Run | ✅ | ✅ | ✅ | ✅ | Own Only | ❌ | ✅ | ❌ |
| VIEW Run History / Logs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| RE-RUN Failed Job | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **— Connections —** |
| CREATE Connection | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| EDIT Connection | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| DELETE Connection | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| TEST Connection | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| VIEW Connection (masked) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **— Schedules —** |
| CREATE Schedule | ✅ | ✅ | ✅ | ✅ | Dev Env | ❌ | ✅ | ❌ |
| EDIT Schedule | ✅ | ✅ | ✅ | ✅ | Dev Env | ❌ | ✅ | ❌ |
| DELETE Schedule | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| VIEW Schedule | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **— Audit —** |
| VIEW Audit Logs (Org) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| VIEW Audit Logs (Workspace) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| VIEW Audit Logs (Project) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| EXPORT Audit Logs | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

> **Legend:** ✅ Full Access | ❌ No Access | `Own Only` = only own resources | `WS Scope` = within assigned Workspace | `Proj Scope` = within assigned Project | `Dev Env` = Development Environment only

---

## 4. User Management — CRUD Operations

### 4.1 User Listing Page

The User Management landing page provides a searchable, filterable table of all users within the administrator's scope.

**UI Requirements:**
- Sortable columns: Full Name, Email, Username, Status, Role(s), Last Login, Created Date, Workspace(s)
- Filter panel with multi-select: Status, Role, Workspace, MFA Status, Authentication Provider (SSO/Local)
- Global search bar: full-text search on name, email, and username
- Bulk actions toolbar: Activate, Deactivate, Assign Role, Delete, Export to CSV
- Pagination with configurable page sizes (25 / 50 / 100 / All)
- Column visibility toggle
- Export (CSV, Excel) respecting current filters

**Status Indicators:**

| Status | Color | Definition | Allowed Actions |
|--------|-------|------------|-----------------|
| Active | Green | User can log in and operate normally | Edit, Deactivate, Delete, Reset Password |
| Inactive | Gray | Manually deactivated by admin | Activate, Edit, Delete |
| Locked | Red | Auto-locked after failed login attempts | Unlock, Reset Password, Delete |
| Pending | Amber | Invitation sent, awaiting first login | Resend Invite, Cancel Invite, Delete |
| Suspended | Orange | Temporarily blocked (security event) | Review Security Log, Unsuspend |

### 4.2 Create User

**Required Fields:**
- First Name (max 64 chars)
- Last Name (max 64 chars)
- Email Address (unique, validated format, used as primary identifier)
- Authentication Type: Local Account | SSO Provider (dropdown of configured providers)
- Initial Role Assignment (at least one System or Workspace role required)

**Optional Fields:**
- Username (auto-generated from email if not provided; must be unique)
- Display Name / Alias
- Phone Number (for MFA)
- Job Title, Department, Cost Center (for audit and reporting)
- Profile Picture URL
- Notes / Internal Comments (admin-only, not visible to user)

**Create User Workflow:**

1. Admin fills out Create User form
2. System validates uniqueness of email and username in real-time
3. Admin selects: Invite via Email | Set Temporary Password | SSO Only
4. For Invite: system generates tokenized invite link (configurable expiry: 24h, 48h, 7d)
5. For Temp Password: system enforces password change on first login
6. Admin assigns initial workspace and role (required before saving)
7. System creates user record with status = `Pending` (invite) or `Active` (admin-set password)
8. Audit log entry created: `User Created by [Admin Name]`
9. Welcome email dispatched with onboarding instructions

**Bulk User Creation:**
- CSV import wizard supporting up to 500 users per batch
- Downloadable CSV template with column definitions and validation rules
- Pre-import validation run with per-row error report (does not abort on partial failure)
- Preview screen before commit
- Post-import summary: X created, Y failed, Z duplicates skipped

### 4.3 Edit User

**Admin-Editable Fields:**
- All fields from Create User form
- Account status toggle (Active / Inactive)
- Reset password / force password reset on next login
- Unlock account
- Revoke all active sessions
- MFA enforcement override
- Role assignments and resource mappings

**Self-Service (by User):**
- First Name, Last Name, Display Name
- Profile Picture
- Phone Number (for MFA)
- Password (must meet policy; cannot reuse last 12 passwords)
- MFA device enrollment/removal
- Notification preferences

> **Note:** Email address change requires admin approval and re-verification flow.

### 4.4 Deactivate vs Delete User

| Operation | Effect on Data | Reversible | Use Case | Audit Trail |
|-----------|---------------|------------|----------|-------------|
| Deactivate | All resources retained; sessions terminated; login blocked | Yes (Reactivate) | Temporary leave, offboarding with asset retention | Yes |
| Soft Delete | User marked deleted; data orphaned to workspace admin | Yes (within 30 days) | Permanent but cautious removal | Yes |
| Hard Delete | All user data, mappings, preferences purged | No | GDPR right-to-erasure requests | Yes (immutable) |

**Hard Delete Requirements:**
- Requires Super Admin or Org Admin with explicit `User Deletion` permission
- Shows impact summary before confirmation (X pipelines owned, Y connections, Z active schedules)
- Forces reassignment of owned resources before deletion is permitted
- Mandatory 48-hour delay between request and execution (grace period, cancellable)
- Cannot be performed on users with active production pipeline executions

---

## 5. Resource-Level User Mappings

### 5.1 User-to-Project Mapping

**Mapping Interface** (Project Settings > Members tab):
- Displays all current members with their role, assignment date, and assigned-by
- Search and filter by name, email, or role
- "Add Members" button opens user search modal with multi-select
- Role selection dropdown per user (Project Owner, Developer, Approver, Executor, Viewer)
- "Inherit from Workspace" toggle to auto-inherit workspace-level role

**Mapping Rules:**
- A user must have at minimum a Viewer role to appear in project-level contexts
- Project Owner cannot remove themselves; must transfer ownership first
- Workspace Admin always has implicit Project Owner access regardless of explicit mapping
- Users with no project mapping cannot access project resources even if they have workspace access
- Removing a user from a project terminates all folder and pipeline mappings within that project

### 5.2 User-to-Folder Mapping

Folder permissions restrict access within a project. By default, users with project access can see all folders. Enabling **Restricted Mode** on a folder hides it from all users except those explicitly mapped.

- Restricted Folders are indicated with a lock icon in the folder tree
- Folder-level roles mirror project roles but scope is limited to the folder and its pipelines
- Folder permissions **cannot exceed** the user's project-level permissions (additive constraint)
- Nested folders inherit parent folder permissions unless overridden
- Batch permission copy: copy permissions from one folder to another

**Folder Access Control UI** (Folder > Settings > Access Control):
- Toggle: "Public within project" vs "Restricted Access"
- When Restricted: user list shows only users with project membership; admin selects subset
- Effective Permissions preview: shows merged view of project + folder permissions per user

### 5.3 User-to-Pipeline Mapping

Pipelines inherit folder and project permissions by default. Administrators can further restrict individual pipelines within a shared folder.

- Pipeline-level access control is optional and additive (restricts, never grants above parent scope)
- "Locked Pipeline" flag prevents all modifications except by Project Owner and Workspace Admin
- Designated **Pipeline Owner** field (single user; defaults to creator) has full control over that pipeline
- Pipeline Owner can delegate permissions at pipeline level without admin intervention
- Developer can be restricted to specific pipelines within a folder (useful for contractor access)

**Production Pipeline Access Controls:**
- Production pipelines require explicit `Prod Access` flag per user
- Prod Access can only be granted by Workspace Admin or Project Owner
- Even with Prod Access, Developers remain read-only on production pipelines
- Executor role on a production pipeline grants execution rights only
- All production pipeline access changes trigger mandatory email notification to Project Owner

### 5.4 User-to-Connection Mapping

| Permission Level | Can View Name | Can View Config | Can Edit | Can Delete | Can Assign to Pipeline |
|---|:---:|:---:|:---:|:---:|:---:|
| Connection Owner | ✅ | ✅ (masked creds) | ✅ | ✅ | ✅ |
| Project Owner | ✅ | ✅ (masked creds) | ✅ | ✅ | ✅ |
| Developer (assigned) | ✅ | ❌ | ❌ | ❌ | ✅ |
| Developer (unassigned) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Executor / Approver | ✅ | ❌ | ❌ | ❌ | ❌ |
| Viewer | ✅ (name only) | ❌ | ❌ | ❌ | ❌ |

### 5.5 User-to-Schedule Mapping

- Schedule creation and management scoped to users with Executor or higher role
- Schedule ownership assigned to creator; transferable to another Executor
- Production schedules require Workspace Admin or Project Owner approval before activation
- Executor can enable/disable existing schedules but cannot delete them
- Alert routing from schedule failures can be configured per-user subscription

### 5.6 User-to-Environment Mapping

| Environment | Developer | Executor | Approver | Viewer | Notes |
|-------------|-----------|----------|----------|--------|-------|
| Development | Full R/W + Execute | Execute Only | View Only | View Only | Sandboxed; no production data |
| Staging / QA | Full R/W + Execute | Execute Only | Full R/W | View Only | Mirrors production schema |
| Production | View Only | Execute Only | Approve Only | View Only | Changes require approval workflow |
| UAT | R/W + Execute | Execute Only | Full R/W | View Only | Client-facing testing environment |

---

## 6. Permission Scope Definitions

### 6.1 View-Only Permission Scope

Users assigned View-Only access (Viewer / Analyst role) are restricted to read operations across all ETL platform components.

| Component | What Viewers Can See | What Viewers Cannot Do |
|-----------|---------------------|------------------------|
| Pipelines | Canvas layout, node config, transformation logic, version history | Modify anything; execute; approve; see unpublished drafts in other users' workspaces |
| Connections | Connection name, type, status, assigned pipelines | Credentials, host/port details, SSL certificates, secret references |
| Execution Logs | Run history, status, row counts, duration, error messages | Full stack traces (configurable), internal system logs, infrastructure metrics |
| Data Lineage | Full lineage graph, source-to-target mappings | Sample data (unless Data Preview permission explicitly granted) |
| Schedules | Schedule name, frequency, next run time, status | Schedule edit UI, history of schedule changes |
| Users/Teams | Own profile | Other user details, role assignments, audit logs |
| Settings | Own notification preferences | Project settings, security configuration, connector catalog |

### 6.2 Execute-Only Permission Scope

- **CAN** trigger: immediate run, scheduled run, conditional run
- **CAN** control: start, stop, pause, resume in-flight runs
- **CAN** re-run: failed jobs, individual failed steps within a run (step-level retry)
- **CAN** view: real-time execution progress, log streams, metrics, row counts, data quality results
- **CAN** manage: alert subscriptions for pipeline failures and completions
- **CAN** configure: run parameters for parameterized pipelines (within allowed parameter definitions)
- **CANNOT** modify pipeline logic, add/remove steps, change connection assignments
- **CANNOT** promote pipelines between environments or approve changes
- **CANNOT** create new pipelines, folders, or projects
- **CANNOT** access configuration of connections or secrets

### 6.3 Development-Only Permission Scope

- **CAN** create, edit, and delete pipelines in Development and Staging environments
- **CAN** design transformations, data mappings, lookups, filters, aggregations, and joins
- **CAN** configure pipeline parameters, input/output schemas, and error handling
- **CAN** use assigned connections in pipeline designs
- **CAN** execute pipelines in Development environment with non-production datasets
- **CAN** submit pipelines for review/approval targeting production deployment
- **CAN** view run history and logs for own pipelines across all environments
- **CANNOT** modify production pipeline configurations or execute in production
- **CANNOT** approve own submissions (requires a separate Approver user)
- **CANNOT** manage connections, environments, or project membership
- **CANNOT** access admin console, security settings, or user management

### 6.4 Admin-Only Permission Scope

**Org Admin Exclusive Functions:**
- SSO configuration (SAML 2.0, OIDC provider setup, attribute mapping)
- Organization-wide MFA policy enforcement
- IP allowlist and network access restrictions
- Password complexity policy configuration
- Session timeout and concurrent session policy
- User account lockout thresholds
- Connector catalog management (approve/restrict available connectors)
- Cross-workspace resource sharing configuration
- Organization audit log export and retention configuration

**Workspace Admin Exclusive Functions:**
- Workspace settings: name, description, default environment bindings
- Shared connection library management for the workspace
- Promotion gate configuration (approval workflow rules for production deployments)
- Workspace-level notification routing (email groups, Slack/Teams webhooks)
- Quota and resource limit configuration per project
- User onboarding templates and default role assignments for the workspace

**Project Owner Admin Functions:**
- Project member management: add, remove, role assignment
- Project settings: name, description, tags, metadata
- Resource limit overrides within workspace-set maximums
- Folder structure administration
- Production pipeline promotion final approval (if no dedicated Approver assigned)
- Project archival and restoration

---

## 7. Security Requirements

### 7.1 Authentication

#### 7.1.1 Local Authentication

- Password minimum length: 12 characters
- Must include: uppercase, lowercase, numeric, special character
- Cannot reuse last 12 passwords
- Password expiry: configurable (default 90 days for admin, 180 days for standard users)
- Bcrypt hashing with cost factor >= 12
- No plaintext or reversible encryption for passwords at any point

#### 7.1.2 Multi-Factor Authentication (MFA)

- Supported methods: TOTP (Authenticator App), SMS OTP, Email OTP, Hardware Key (FIDO2/WebAuthn)
- MFA enforcement policies: Optional | Required for Admin Roles | Required for All Users | Required for Production Access
- MFA enrollment wizard in user profile settings
- Backup codes: 8 single-use codes generated at enrollment (downloadable once)
- Admin can force MFA reset for individual users or all users in a workspace
- Grace period after MFA enforcement change: configurable (0–7 days)

#### 7.1.3 SSO / Federated Identity

- SAML 2.0 SP-initiated and IdP-initiated flows
- OIDC/OAuth 2.0 with PKCE
- Automatic user provisioning via SCIM 2.0 (create, update, deactivate synced from IdP)
- JIT (Just-In-Time) provisioning with configurable default role assignment
- Attribute mapping UI: map IdP attributes to platform fields (email, name, role, department)
- Multiple SSO providers configurable (e.g., corporate Okta + external contractor Azure AD)
- Fallback to local authentication: configurable (default: disabled for SSO-enforced orgs)

### 7.2 Session Management

| Setting | Default Value | Configurable Range | Scope |
|---------|--------------|-------------------|-------|
| Session Timeout (idle) | 30 minutes | 5 min – 8 hours | Per Org / Per User Role |
| Session Timeout (absolute) | 8 hours | 1 hour – 24 hours | Per Org |
| Concurrent Sessions | 3 sessions | 1 – 10 | Per Org |
| Remember Me Duration | 30 days | 1 – 90 days | Per Org (can disable) |
| Session Token Rotation | On every request | Always On | System |
| JWT Expiry (API tokens) | 1 hour | 15 min – 24 hours | Per Token |
| API Key Expiry | 365 days | 1 day – Never | Per Key |

### 7.3 Account Security

**Account Lockout Policy:**
- Failed login attempts threshold: 5 (configurable 3–10)
- Lockout duration: 15 minutes auto-unlock (configurable to manual unlock by admin)
- Progressive lockout: 5 attempts → 15 min | 10 attempts → 1 hour | 15 attempts → permanent lock
- Admin notified immediately upon account lockout via email and in-platform alert
- CAPTCHA challenge triggered after 3 failed attempts

**Suspicious Activity Detection:**
- Login from new device: email notification with device details
- Login from new geographic location: email alert + optional MFA re-challenge
- Concurrent sessions from different IP ranges: alert to admin
- Multiple failed MFA attempts: temporary MFA lockout (30 minutes)
- Unusual access pattern detection: after-hours bulk data access, mass resource downloads

### 7.4 Authorization Security

- All permission checks server-side; UI rendering never substitutes for API enforcement
- Zero-trust model: every API call validated against RBAC rules regardless of session state
- Resource-level permission tokens embedded in API responses to prevent IDOR attacks
- Rate limiting per user per endpoint: default 100 req/min (standard), 500 req/min (admin)
- CSRF token validation on all state-changing operations
- All inter-service calls use mutual TLS (mTLS) with short-lived service certificates

### 7.5 Credential & Secret Management

- Connection credentials never stored in application database; stored in integrated secret vault (HashiCorp Vault / AWS Secrets Manager / Azure Key Vault)
- Credentials are write-only from UI; never readable after initial entry
- Secret rotation UI: enter new credentials, test connection, then atomically replace in vault
- Credential access events logged: who used which connection, when, in which pipeline run
- Developers cannot view connection credentials; they reference connections by name only
- Production credentials accessible only by Connection Manager and Workspace Admin roles

### 7.6 Data Privacy & Compliance

- User PII (name, email, phone) encrypted at rest with AES-256
- Data masking in logs: email addresses, phone numbers, and internal user IDs masked in exported logs by default
- GDPR right-to-erasure: Hard Delete workflow with export-before-deletion option
- Data residency: user records stored in org-configured geographic region
- Privacy settings per user: control visibility of profile fields to other users
- Admin access to user data logged with mandatory justification field

---

## 8. Audit Logging & Compliance

### 8.1 Audit Log Coverage

| Event Category | Events Logged | Data Captured |
|---|---|---|
| Authentication | Login, Logout, Failed Login, MFA Success/Failure, Password Reset, Account Lock/Unlock | Timestamp, User ID, IP Address, Device Fingerprint, Geolocation, Success/Failure |
| User Management | Create, Edit, Deactivate, Delete, Role Assign, Role Revoke, Impersonation | Timestamp, Actor, Target User, Changed Fields (before/after), Reason |
| Resource Access | View Pipeline, View Connection, Download Report, Export Logs | Timestamp, User, Resource ID, Resource Type, Action |
| Pipeline Operations | Create, Edit, Delete, Execute, Stop, Approve, Promote, Rollback | Timestamp, User, Pipeline ID, Version, Environment, Old/New State |
| Permission Changes | Folder/Pipeline access granted/revoked, Project membership changes | Timestamp, Actor, Target User, Resource, Permission Before/After |
| Security Events | Suspicious login, Session hijack attempt, Rate limit exceeded, CSRF violations | Full request context, User, IP, Headers, Action attempted |
| Admin Actions | SSO config changes, Password policy changes, MFA policy changes, Bulk operations | Full change diff, Admin User, Timestamp, IP |

### 8.2 Audit Log UI Requirements

- Searchable by: User, Action Type, Date Range, Resource, IP Address, Success/Failure
- Exportable in: CSV, JSON, SIEM-compatible CEF format
- Immutable: no admin can edit or delete audit entries (append-only log)
- Retention: minimum 2 years online, configurable long-term archive to external storage
- Real-time streaming to SIEM integration (Splunk, DataDog, ELK) via webhook
- Alerts configurable on specific audit event patterns (e.g., alert on admin bulk delete)

### 8.3 Compliance Reporting — Pre-Built Reports

| Report | Description | Schedule Options |
|--------|-------------|-----------------|
| User Access Review | All users and their current permissions, per project | Weekly / Monthly / On-demand |
| Dormant Account Report | Users inactive > 30 / 60 / 90 days | Weekly |
| Privileged Access Report | All Admin role holders across the org | Daily / Weekly |
| Failed Authentication Summary | Count and details of auth failures | Daily |
| Permission Change History | All permission changes in a configurable time range | On-demand |

---

## 9. Teams, Groups & Delegation

### 9.1 User Groups

- Groups scoped at Workspace or Organization level
- A user can belong to multiple groups; effective permissions = union of all group permissions + individual assignments
- Groups can be synced from SCIM-compatible IdP (e.g., Azure AD groups mapped to platform groups)
- Group owners can manage membership; group role assignments managed by Workspace Admin
- Groups can be assigned as Pipeline Owner for shared ownership (e.g., "Data Engineering Team" owns all pipelines in a project)

### 9.2 Service Accounts

- Non-human identities for API-to-API integrations, CI/CD pipelines, and external orchestration tools
- Created by Workspace Admin; scoped to specific workspace(s)
- Assigned same roles as human users; recommended minimum: Executor for CI/CD, Developer for automated pipeline deployment
- Authenticate via API Key or OAuth 2.0 Client Credentials flow
- API Keys: generated with configurable expiry, IP restriction, and scope (read-only / execute / full)
- Service accounts cannot log into the web UI (no web session issued)
- Activity logged under service account identity in audit trails

### 9.3 Delegation & Temporary Access

- Project Owner can temporarily elevate a user to a higher role (max 72 hours)
- Temporary access auto-expires; no manual revocation required
- Temporary access changes generate `TEMP_PERMISSION_GRANT` audit entry with expiry timestamp
- Admin can grant "break-glass" access for incident response with automatic 4-hour expiry
- Delegation log accessible to Workspace Admin showing all active and expired temporary grants

---

## 10. UI/UX Requirements

### 10.1 Navigation Structure

| Navigation Item | Route | Accessible By | Description |
|---|---|---|---|
| User Management | `/admin/users` | Org Admin, WS Admin | User list, create, edit, deactivate |
| Roles & Permissions | `/admin/roles` | Org Admin, WS Admin | Role definitions and permission matrix viewer |
| Groups | `/admin/groups` | Org Admin, WS Admin | Group management and membership |
| Service Accounts | `/admin/service-accounts` | Org Admin, WS Admin | API key and service account management |
| Access Requests | `/admin/access-requests` | Project Owner+ | Pending access request approvals |
| Audit Logs | `/admin/audit` | Org Admin, WS Admin, Project Owner (limited) | Event log search and export |
| Security Settings | `/admin/security` | Org Admin | MFA policy, password policy, SSO config |
| My Profile | `/profile` | All Users | Self-service profile and credential management |

### 10.2 User Profile Page

- **Overview:** Avatar, Name, Email, Role badges (color-coded), Last Login, MFA Status, Account Status
- **Permissions tab:** Flat list of all effective permissions with source (Direct / Group / Inherited) — critical for debugging access issues
- **Activity tab:** Last 50 actions by this user within the visible audit scope
- **Security tab:** Active sessions list, MFA devices, login history
- **API Keys tab:** Service account tokens and personal access tokens

### 10.3 Permission Conflict Resolution UI

- **Effective Permissions Inspector:** For any user on any resource, shows merged computed permissions
- **Conflict Indicators:** If a group grants READ and a direct assignment grants DENY, show conflict with resolution rule (Explicit Deny wins)
- **"What can this user do?" simulation tool:** Select user + resource → system shows all permitted actions
- **"Who can access this resource?" reverse lookup:** Select pipeline/folder → system shows all users and their permission source

### 10.4 Access Request Workflow

1. User clicks "Request Access" on a locked resource
2. User provides reason/justification text (required)
3. Request routed to Project Owner or Workspace Admin (configurable)
4. Approver notified via email and in-platform notification
5. Approver reviews: user profile, requested resource, justification
6. Approver approves with role selection, or rejects with reason
7. User notified of decision; access granted or denied
8. Full workflow captured in audit log

### 10.5 Notification & Alerting Matrix

| Event | Notify User | Notify Admin | Channel |
|---|---|---|---|
| Account Created / Invited | ✅ Welcome email | ✅ Audit entry | Email |
| Password Reset | ✅ Confirmation + link | ✅ Audit entry | Email |
| Account Locked | ✅ Lockout + unlock instructions | ✅ Alert | Email + In-app |
| New Login (new device/location) | ✅ Security alert | If suspicious | Email |
| Role Assigned/Revoked | ✅ Notification | ✅ Audit entry | Email + In-app |
| MFA Policy Changed | ✅ Email with grace period notice | ✅ Audit entry | Email |
| Account Deactivation | ✅ Email notification | ✅ Audit entry | Email |
| Access Request Approved/Denied | ✅ Decision email | ✅ Audit entry | Email + In-app |
| Temporary Access Expiry (1hr before) | ✅ Warning email | ✅ Audit entry | Email + In-app |

---

## 11. Non-Functional Requirements

### 11.1 Performance

- User list page load (up to 10,000 users): < 2 seconds
- Permission check evaluation per API call: < 50ms at p99
- Audit log query (last 30 days): < 3 seconds
- Bulk user import (500 users): < 30 seconds with progress indicator
- Real-time permission propagation after role change: < 5 seconds

### 11.2 Availability & Reliability

- User management module SLA: 99.9% uptime
- Authentication service SLA: 99.99% uptime (critical path)
- Permission cache: distributed cache with 5-minute TTL; invalidated on any permission change
- Graceful degradation: if permission service unavailable, default to **deny** (fail secure)

### 11.3 Scalability

- Support up to 100,000 users per organization
- Support up to 10,000 concurrent authenticated sessions
- Support up to 1,000 projects per workspace, 10,000 pipelines per project
- RBAC evaluation scales horizontally with stateless permission evaluation service

### 11.4 Accessibility

- WCAG 2.1 Level AA compliance for all user management UI screens
- Full keyboard navigation for all management operations
- Screen reader compatible (ARIA labels on all interactive elements)
- High contrast mode support

---

## 12. Open Items & Implementation Notes

### 12.1 Recommended Phasing

| Phase | Features | Priority |
|-------|----------|----------|
| Phase 1 (MVP) | User CRUD, Local Auth, 3 core roles (Admin, Developer, Viewer), Project mapping, Basic audit log | P0 |
| Phase 2 | Full RBAC matrix, Folder/Pipeline mapping, MFA (TOTP), SSO (SAML), Execute role, Approver role | P1 |
| Phase 3 | Groups, Service Accounts, SCIM sync, Access Request Workflow, Secret Vault integration | P2 |
| Phase 4 | Behavioral analytics, SIEM integration, Compliance reports, FIDO2/WebAuthn, Delegation | P3 |

### 12.2 Key Decisions Required

- Secret vault provider selection: HashiCorp Vault vs AWS Secrets Manager vs Azure Key Vault
- Audit log storage backend: dedicated logging DB vs external SIEM as system of record
- Permission evaluation strategy: centralized permission service vs embedded per-service
- SCIM 2.0 implementation priority for enterprise customers
- Row-level security within pipeline data previews (for sensitive datasets)

### 12.3 Integration Points

| Integration | Purpose | Options |
|---|---|---|
| Identity Provider (IdP) | SSO, SCIM user sync | Okta, Azure AD, Ping Identity, Auth0 |
| Secret Management | Credential storage | HashiCorp Vault, AWS SM, Azure Key Vault |
| Notifications | Email/SMS alerts | SMTP, SendGrid, Twilio, Slack, Teams |
| SIEM | Audit log streaming | Splunk, Datadog, Elastic, Sumo Logic |
| Internal ETL Services | RBAC decision consumption | Pipeline Engine, Connection Registry, Scheduler, Execution Service |

---

*Document End — Version 1.0 | No-Code ETL Platform User Management FRS*
