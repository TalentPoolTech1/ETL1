
# No-Code ETL Tool UI Requirement Specification
Version: 1.0  
Date: 2026-03-18  
Document Type: Detailed UI/UX, Admin, Security, and Audit Requirements  
Architecture Constraint: **Strictly tab-based within the ETL application shell. No page-based architecture is allowed.**  
Interaction Model: **Zero-code, drag-and-drop-first design.**

---

## 1. Purpose

This document defines the detailed UI requirements for a tab-based No-Code ETL tool. It focuses on how users interact with projects, folders, sub-folders, pipelines, orchestrators, connections, metadata, users, and roles entirely inside a persistent workspace layout.

The document is intended for:
- Product owners
- UI/UX designers
- Frontend developers
- Backend/API developers
- Security and IAM teams
- Audit/compliance teams
- Platform administrators
- QA and test engineers

This is a **development-ready requirement document** from the UI perspective, including object hierarchy, tab behavior, field definitions, audit controls, permissions visibility, history expectations, edit-state indicators, execution visibility, and administrative needs.

---

## 2. Core Design Principles

### 2.1 Mandatory Architecture Principles
1. The application shall use a **single shell layout**.
2. All objects shall open **inside tabs within the same ETL workspace**.
3. The system shall not navigate users to standalone pages for object management.
4. All editing shall happen inside tabs, panels, dialogs, drawers, or popups within the shell.
5. Pipelines and orchestrators shall be **strictly no-code**, with drag-and-drop visual design.
6. Tree navigation shall be the primary hierarchical explorer.
7. All objects must support consistent audit visibility.
8. Unsaved changes must be visually obvious.

### 2.2 UX Principles
1. Consistency across object types.
2. Low-friction discoverability for non-technical users.
3. Enterprise-grade auditability.
4. Fine-grained permissions visibility.
5. Strong contextual traceability.
6. Minimal ambiguity about what is saved vs unsaved.
7. Clear distinction between editable fields and read-only system fields.
8. Ability to open multiple objects side-by-side through tabs.

---

## 3. High-Level Shell Layout

The ETL tool shall provide a fixed shell with the following major regions:

### 3.1 Left Navigation / Object Explorer
A collapsible explorer tree containing:

- Projects
- Global Pipelines
- Global Orchestrators
- Connections
- Metadata
- Users
- Roles

The explorer shall support:
- Expand/collapse
- Search/filter
- Lazy loading for large trees
- Right-click context menus
- Keyboard navigation
- Iconography by object type
- Permission-aware visibility
- Favorite/pin support
- Recent items section
- Object status indicators

### 3.2 Top Toolbar
The top toolbar shall include:
- Global search
- Save
- Save All
- Undo
- Redo
- Run
- Validate
- Publish / Promote
- Compare versions
- Notifications
- User profile menu
- Environment selector
- Active project/workspace context
- Help / documentation
- Admin tools access based on role

### 3.3 Workspace Tab Strip
The center workspace shall support:
- Multiple open tabs
- Reordering tabs
- Pinning tabs
- Closing tabs
- Close others / close all
- Restore last closed tab
- Dirty-state indicators
- Overflow handling for many tabs
- Parent-child object grouping hints

### 3.4 Contextual Right Panel
A collapsible side panel may show:
- Properties summary
- Help
- Validation errors
- Dependency impact
- Selected node configuration
- Metadata preview
- Schema preview
- Parameter values
- Audit quick info

### 3.5 Bottom Panel
The bottom panel may show:
- Logs
- Validation output
- Warnings
- Execution console
- Diff viewer
- Debug trace
- Activity feed

---

## 4. Hierarchy of Objects

The hierarchy shall support at least the following:

```text
Projects
    Project Name
        Directory Name
            Sub-Directory Name
                Pipelines
                    Pipeline1
                    Pipeline2
                Orchestrators
                    Orchestrator1
                    Orchestrator2
            Pipelines
                Pipeline3
                Pipeline4
            Orchestrators
                Orchestrator3
                Orchestrator4
        Pipelines
            Pipeline5
            Pipeline6
        Orchestrators
            Orchestrator5
            Orchestrator6
    Project2

Global Pipelines
    Global Pipeline1
    Global Pipeline2

Global Orchestrators
    Global Orchestrator1
    Global Orchestrator2

Connections
    Cloud Technologies
        AWS
            Redshift
            S3
            RDS
        Azure
            Blob Storage
            Synapse Analytics
        GCP
        Oracle
    File Technologies
        CSV
        Arrow
        Parquet
        Avro
    RDBMS
        Oracle
        Postgres
        DB2
        MSSQL
        MySQL
    <many more>

Metadata
    Cloud Technologies
        AWS
            Redshift
                Dev Connection
                    Schema1
                        Table1
                            Col1
                            Col2
                            Col3
                QA Connection
                PROD Connection

Users
    User1
    User2
    User3

Roles
    Role1
    Role2
    Role3
```

---

## 5. Universal Object Behavior Requirements

These requirements apply to all openable objects unless explicitly overridden.

### 5.1 Common Header Fields
Every object tab shall display:
- Object icon
- Object name
- Object type
- Parent path / breadcrumb
- Environment/context if applicable
- Lock status
- Dirty status
- Read-only status if user lacks edit permission

### 5.2 Common Audit Fields
Every major object shall expose:
- Created By
- Created On
- Updated By
- Updated On
- Last Opened By
- Last Opened On
- Object ID
- Version / Revision number
- Status
- Optional description
- Optional tags
- Optional labels

### 5.3 Dirty State / Unsaved Change Behavior
1. If an object is modified and not saved, the tab label shall render in *italic*.
2. If the object name itself is being edited and unsaved, the tab name shall display the unsaved value in *italic*.
3. Dirty state shall persist until:
   - Save succeeds
   - Revert/discard succeeds
4. Closing a dirty tab shall prompt the user to:
   - Save
   - Discard
   - Cancel
5. Save All shall handle all dirty tabs.
6. Dirty state shall also appear in the explorer tree where feasible.

### 5.4 Common History Expectations
Each auditable object shall maintain:
- Who changed it
- When it was changed
- What field changed
- Old value
- New value
- Change reason if captured
- Action type
- Correlation/request ID
- Optional comment
- Version number impacted

### 5.5 Common Permissions Visibility
Each secured object shall support a Permissions view showing:
- User/role
- Permission source (direct / inherited)
- Permission set
- Effective access summary
- Last modified by
- Last modified on

---

## 6. Tab Standards by Object Type

## 6.1 Project Tab Requirements

When a project is opened, it shall open a **Project tab**.

### Mandatory sub-tabs within Project tab
1. Overview
2. Properties
3. Contents
4. History
5. Permissions
6. Activity

### 6.1.1 Project > Overview
The Overview sub-tab shall show:
- Project name
- Project description
- Project ID
- Created by / on
- Updated by / on
- Last opened by / on
- Number of directories
- Number of pipelines
- Number of orchestrators
- Number of connections referenced
- Number of users/roles with access
- Current status
- Recent activity summary
- Quick actions

### 6.1.2 Project > Properties
Fields:
- Project ID (read-only)
- Project Name (editable)
- Description (editable)
- Tags (editable)
- Labels (editable)
- Default environment (editable)
- Status (editable if allowed)
- Owner (editable if permitted)
- Created By (read-only)
- Created On (read-only)
- Updated By (read-only)
- Updated On (read-only)
- Last Opened By (read-only)
- Last Opened On (read-only)
- Version (read-only)
- Lock state (read-only)
- Retention policy reference (optional)
- Classification (optional)

### 6.1.3 Project > Contents
The Contents sub-tab shall show children of the project:
- Directories
- Sub-directories
- Pipelines
- Orchestrators

Capabilities:
- Create child object
- Rename
- Move
- Copy
- Delete
- Search within project
- Sort by name/date/type
- Filter by object type
- Open in new tab
- Show permission denied indicators

### 6.1.4 Project > History
Grid columns:
- Event timestamp
- Action
- Changed by
- Field/object changed
- Old value
- New value
- Version
- Comment
- Request/correlation ID

### 6.1.5 Project > Permissions
Grid columns:
- Principal type (user/role/group)
- Principal name
- Access level
- Inherited or direct
- Granted by
- Granted on
- Expiry if supported

Actions:
- Add permission
- Remove permission
- Edit permission
- View effective access
- View inherited path

### 6.1.6 Project > Activity
Shows non-structural events:
- Opened
- Run from project context
- Permission viewed
- Exported
- Shared
- Searched
- Validation triggered

---

## 6.2 Directory / Folder Tab Requirements

A directory or sub-directory shall open as a **Folder tab**.

### Mandatory sub-tabs
1. Overview
2. Properties
3. Contents
4. History
5. Permissions

### Folder Properties fields
- Folder ID
- Folder Name (editable)
- Parent path
- Description
- Tags
- Created By/On
- Updated By/On
- Last Opened By/On
- Folder type
- Sort preference
- Status
- Lock state

### Folder Contents
Displays:
- Sub-folders
- Pipelines
- Orchestrators

Capabilities:
- Drag-and-drop move
- Multi-select
- Bulk delete
- Bulk move
- Bulk permission apply if allowed
- Quick create
- Search/filter

---

## 6.3 Pipeline Tab Requirements

A pipeline shall open as a **Pipeline tab** and is one of the most feature-rich objects.

### Mandatory sub-tabs
1. Designer
2. Properties
3. Parameters
4. Validation
5. History
6. Executions
7. Dependencies
8. Permissions
9. Activity

### 6.3.1 Pipeline > Designer
This is the core no-code canvas.

The designer shall support:
- Drag-and-drop components
- Source, transformation, target nodes
- Visual links between nodes
- Auto-layout
- Manual layout
- Zoom in/out
- Fit to screen
- Pan
- Snap to grid
- Grouping
- Annotation/comments
- Copy/paste nodes
- Duplicate nodes
- Multi-select
- Delete node
- Undo/redo
- Node search
- Mini-map
- Node validation status
- Inline warnings
- Port-level connection rules
- Right-click context menu
- Keyboard shortcuts

Node configuration panel shall support:
- Node name
- Node type
- Input/output schema preview
- Connection selection
- Mapping configuration
- Runtime options
- Error handling options
- Sampling/preview
- Validation messages
- Parameter references

### 6.3.2 Pipeline > Properties
Fields:
- Pipeline ID (read-only)
- Pipeline Name (editable)
- Description (editable)
- Path
- Project
- Folder
- Status
- Owner
- Tags
- Labels
- Version
- Created By/On
- Updated By/On
- Last Opened By/On
- Last Executed By/On
- Last Successful Execution On
- Last Failed Execution On
- Runtime engine
- Default execution mode
- Retry policy summary
- Timeout summary
- Logging level
- Draft/Published state
- Lock state

### 6.3.3 Pipeline > Parameters
Grid/form fields:
- Parameter name
- Data type
- Required flag
- Default value
- Sensitive flag
- Description
- Scope
- Environment override available
- Validation rule
- Current resolved value preview if permitted

### 6.3.4 Pipeline > Validation
Shows:
- Validation status
- Errors
- Warnings
- Info messages
- Affected node
- Severity
- Rule ID
- Suggested fix

Capabilities:
- Revalidate
- Filter
- Jump to node
- Export results

### 6.3.5 Pipeline > History
Must include full modification history.

Columns:
- Timestamp
- Action type
- Modified by
- Object area
- Field/node changed
- Previous value
- New value
- Version
- Comment
- Correlation ID

Actions:
- Open version snapshot
- Compare versions
- Restore version if permitted

### 6.3.6 Pipeline > Executions
Must show historical executions with at least:
- Execution Name
- Execution ID
- Start Time
- End Time
- Duration
- Status
- Trigger type
- Triggered by
- Environment
- Rows processed if available
- Errors count
- Warning count
- Metalink to open execution

A selected execution shall open as an **Execution tab** within the same shell.

### 6.3.7 Pipeline > Dependencies
Shows:
- Upstream objects
- Downstream objects
- Shared connections
- Reused assets
- Referenced metadata
- Impact analysis
- Orchestrators invoking this pipeline

### 6.3.8 Pipeline > Permissions
Permissions shall include:
- View
- Edit
- Delete
- Execute/Run
- Approve/Publish
- Manage permissions
- View history
- View execution logs
- Export definition

### 6.3.9 Pipeline > Activity
Shows user interactions including:
- Opened
- Validated
- Saved
- Run requested
- Compared versions
- Exported
- Published
- Permission changed

---

## 6.4 Orchestrator Tab Requirements

An orchestrator shall open as an **Orchestrator tab**.

### Mandatory sub-tabs
1. Designer
2. Properties
3. Schedule
4. Parameters
5. History
6. Runs
7. Dependencies
8. Permissions
9. Activity

### 6.4.1 Orchestrator > Designer
The designer shall support:
- Drag-and-drop workflow steps
- Sequencing
- Branching
- Parallel blocks
- Conditions
- Retry logic
- Wait/delay
- Dependency triggers
- Manual approval step
- Event-based triggers
- Pipeline invocation nodes
- Global pipeline invocation
- Nested orchestrator references if supported
- Failure paths
- Compensation/recovery paths
- Notifications node

### 6.4.2 Orchestrator > Properties
Fields:
- Orchestrator ID
- Orchestrator Name (editable)
- Description
- Path
- Status
- Owner
- Version
- Created By/On
- Updated By/On
- Last Opened By/On
- Last Executed By/On
- Last Successful Run On
- Last Failed Run On
- Draft/Published state
- Lock state
- Timeout policy
- Retry policy
- Concurrency rule

### 6.4.3 Orchestrator > Schedule
Fields:
- Schedule enabled
- Frequency type
- Cron expression
- Time zone
- Effective from
- Effective to
- Catch-up rule
- Blackout windows
- Holiday calendar reference
- Max concurrent runs
- Misfire policy

### 6.4.4 Orchestrator > Runs
Columns:
- Run Name
- Run ID
- Start Time
- End Time
- Duration
- Status
- Trigger type
- Triggered by
- Failed step
- Environment
- Metalink to open run

### 6.4.5 Orchestrator > Permissions
Permissions shall include:
- View
- Edit
- Delete
- Execute
- Pause/Resume schedule
- Publish
- Manage permissions
- View history
- View run logs

---

## 6.5 Execution / Run Tab Requirements

Execution tabs are opened from pipeline or orchestrator execution history.

### Mandatory sub-tabs
1. Summary
2. Steps/Stages
3. Logs
4. Metrics
5. Inputs/Outputs
6. Errors
7. Lineage
8. Audit

### Summary fields
- Execution ID
- Execution name
- Parent object
- Parent object ID
- Start time
- End time
- Duration
- Status
- Trigger type
- Triggered by
- Environment
- Engine/node
- Retry count
- Correlation ID

### Steps/Stages
Columns:
- Step ID
- Step name
- Start time
- End time
- Duration
- Status
- Rows in
- Rows out
- Error count

### Logs
Capabilities:
- Filter by severity
- Search
- Download
- Copy
- Mask secrets
- Timestamp toggle
- Structured/plain view

### Metrics
Possible fields:
- Rows processed
- Bytes read
- Bytes written
- Throughput
- Memory indicators if available
- Warnings
- Retries
- CPU time if exposed
- Queue wait time if exposed

---

## 6.6 Connection Tab Requirements

A connection shall open as a **Connection tab**.

### Mandatory sub-tabs
1. Properties
2. Authentication
3. Connectivity/Test
4. Usage
5. History
6. Permissions
7. Security

### Properties
Fields:
- Connection ID
- Connection Name (editable)
- Technology type
- Vendor/platform
- Category
- Environment
- Endpoint/host
- Port
- Database/bucket/container name
- Region
- Description
- Owner
- Tags
- Created By/On
- Updated By/On
- Last Opened By/On
- Status

### Authentication
Fields depend on connector type:
- Auth mode
- Username
- Secret reference
- Key file reference
- OAuth status
- Token expiry summary
- SSL/TLS enabled
- Certificate alias

Sensitive values must never be exposed in plain text to unauthorized users.

### Connectivity/Test
Shows:
- Test connection button
- Last tested by
- Last tested on
- Test status
- Response time
- Failure reason
- Network/security diagnostics summary

### Usage
Shows where the connection is used:
- Pipelines
- Orchestrators
- Global assets
- Metadata scans

### Security
Shows:
- Secret source
- Rotation policy
- Last rotated on
- Rotation owner
- Masking status
- Restricted fields

---

## 6.7 Metadata Browser Requirements

Metadata objects may include connection, schema, table, column, file structure, partition, or external asset.

### Metadata tabs by level
- Connection metadata tab
- Schema metadata tab
- Table metadata tab
- Column metadata tab

### Metadata > Common sub-tabs
1. Overview
2. Structure
3. Profiling
4. Lineage
5. History
6. Permissions

### Table metadata fields
- Table name
- Fully qualified name
- Source connection
- Schema
- Object type
- Row count if available
- Last profiled on
- Last refreshed on
- Data classification
- Owner
- Tags
- Description

### Column metadata fields
- Column name
- Data type
- Length/precision/scale
- Nullable
- Default
- Key indicator
- Sensitive flag
- Masking rule
- Description
- Data classification
- Sample values if allowed
- Distinct count if available

---

## 6.8 Users Tab Requirements

Opening a user shall open a **User tab**.

### Mandatory sub-tabs
1. Profile
2. Access
3. Activity
4. Audit
5. Sessions
6. Preferences

### Profile fields
- User ID
- Username
- Display name
- Email
- Status
- User type
- Created On
- Created By
- Updated On
- Updated By
- Last Login On
- Last Opened On if applicable
- MFA status
- Default role
- Default workspace/project
- Locale/time zone

### Access
Shows:
- Assigned roles
- Direct permissions
- Effective permissions
- Project access
- Connection access
- Admin flags

### Sessions
Shows:
- Active session ID
- Login time
- Last activity time
- IP/device summary if allowed
- Terminate session action for admins

---

## 6.9 Roles Tab Requirements

Opening a role shall open a **Role tab**.

### Mandatory sub-tabs
1. Properties
2. Members
3. Permissions
4. Scope
5. History
6. Audit

### Role fields
- Role ID
- Role name (editable)
- Description
- Status
- Created By/On
- Updated By/On
- Last Opened By/On
- System role flag
- Custom role flag
- Assignable flag

### Members
Shows users/groups assigned to role.

### Permissions
Shows permission matrix by resource type:
- Projects
- Folders
- Pipelines
- Orchestrators
- Connections
- Metadata
- Users
- Roles
- Admin settings
- Execution logs
- Publish/promote abilities

---

## 7. Visual Standards and Behaviors

### 7.1 Tab Label Behavior
Tab labels shall support:
- Icon
- Name
- Dirty italic state
- Tooltip with full path
- Read-only indicator
- Lock indicator
- Error indicator
- Running indicator for active execution tabs

### 7.2 Typography Rules
- Unsaved object label: italic
- Read-only/system field labels: normal but subdued
- Errors: high visibility
- Warnings: medium visibility
- Disabled actions clearly muted

### 7.3 Icons and Status Colors
Each object type shall have a distinct icon.
Statuses shall have consistent colors:
- Draft
- Published
- Running
- Failed
- Success
- Warning
- Disabled
- Locked

Color shall not be the only status indicator.

---

## 8. Permissions and Security Requirements

### 8.1 Security Principles
The UI shall enforce and expose:
- Least privilege
- Separation of duties
- Permission inheritance transparency
- Secure secret handling
- No unauthorized metadata exposure
- Audit for security-sensitive actions

### 8.2 Permission Types
The product shall support at least:
- View
- Edit
- Delete
- Run/Execute
- Create child
- Rename
- Move
- Copy
- Publish
- Approve
- View history
- View audit
- Manage permissions
- Manage secrets
- Test connection
- View logs
- Download logs
- Administer users
- Administer roles

### 8.3 Inheritance
Permissions may be inherited along hierarchy:
- Project -> folder -> sub-folder -> pipeline/orchestrator
The UI shall clearly show:
- Direct grants
- Inherited grants
- Inheritance source path
- Effective permission summary

### 8.4 Secret Handling
The UI shall:
- Mask secrets by default
- Never display stored secret value after save
- Require elevated permission to modify secret references
- Log secret-related changes without exposing secret content

---

## 9. Audit and History Requirements

### 9.1 Events to Capture
The UI/backend system shall support surfacing audit events for:
- Create
- Edit
- Rename
- Delete
- Move
- Copy
- Open
- Save
- Save as
- Validate
- Run
- Cancel run
- Publish
- Promote
- Permission grant/revoke
- Role assignment
- Connection test
- Secret reference change
- Import/export
- Login/logout
- Failed access
- Failed run

### 9.2 Audit Grid Standards
Audit/history grids should support:
- Sorting
- Filtering
- Search
- Export
- Column chooser
- Date range filter
- User filter
- Action type filter
- Object type filter
- Environment filter

### 9.3 Field-Level Audit Expectations
For editable business fields, history should record:
- Field name
- Old value
- New value
- Actor
- Timestamp
- Version number
- Reason/comment if supplied

---

## 10. Administration Requirements

### 10.1 Admin UI Areas
Admins shall be able to manage, within tabs:
- Users
- Roles
- Permission templates
- Connection categories
- Environment definitions
- Retention settings
- Audit/logging settings
- Naming standards
- Object policies
- Approval workflow settings

### 10.2 Admin Visibility
Admins may need dashboards/tabs for:
- Failed executions
- Orchestrator backlog
- Connection failures
- Role changes
- User lockouts
- Secret expiry alerts
- Audit anomalies
- Stale pipelines/orchestrators
- Unused connections

---

## 11. Search, Filter, and Discoverability Requirements

The system shall support:
- Global search across object names
- Search by object ID
- Search by tag
- Search by creator/updater
- Search by recently opened
- Search within current tab
- Search within metadata
- Search within execution logs where permitted

Filters shall support:
- Type
- Status
- Environment
- Owner
- Updated date
- Created date
- Permission scope
- Connection technology

---

## 12. Validation and Error Handling Requirements

### 12.1 Save Validation
On save, the UI shall validate:
- Required fields
- Naming uniqueness within scope
- Illegal characters
- Permission to save
- Dependency integrity
- Schema compatibility where applicable

### 12.2 Designer Validation
For pipelines/orchestrators:
- Unconnected mandatory nodes
- Missing mappings
- Invalid parameter bindings
- Missing connection
- Circular dependencies if disallowed
- Schedule conflicts
- Missing target/source definitions

### 12.3 Error Presentation
Errors shall:
- Be contextual
- Identify object and field/node
- Provide actionable message
- Support jump-to-location
- Persist until resolved or refreshed

---

## 13. Non-Functional UI Requirements

### 13.1 Performance
The UI should:
- Open tabs quickly
- Lazy load large trees/grids
- Support thousands of objects in explorer via virtualization
- Avoid freezing during large history/execution loads
- Handle long tab lists gracefully

### 13.2 Accessibility
The UI shall support:
- Keyboard navigation
- Screen reader-friendly labels
- Sufficient contrast
- Visible focus states
- Non-color-only status indicators
- Accessible dialogs and menus

### 13.3 Scalability of Workspace
The UI shall support:
- Many simultaneously open tabs
- Long object names via tooltips
- Cross-tab state consistency
- Background refresh for execution state

---

## 14. Suggested Permission Matrix

| Resource | View | Edit | Delete | Run | Publish | Manage Permissions | View History | View Logs |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Project | Yes | Yes | Yes | No | No | Yes | Yes | No |
| Folder | Yes | Yes | Yes | No | No | Yes | Yes | No |
| Pipeline | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Orchestrator | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Connection | Yes | Yes | Yes | Test | No | Yes | Yes | Limited |
| Metadata | Yes | Limited | No | No | No | Limited | Yes | No |
| User | Yes | Yes | Yes | No | No | Yes | Yes | No |
| Role | Yes | Yes | Yes | No | No | Yes | Yes | No |

---

## 15. Suggested Object Creation Rules

### 15.1 Create Project
Required:
- Project name
Optional:
- Description
- Tags
- Owner
- Default environment

### 15.2 Create Folder
Required:
- Folder name
- Parent
Optional:
- Description
- Tags

### 15.3 Create Pipeline
Required:
- Pipeline name
- Parent path
Optional:
- Description
- Tags
- Execution defaults

### 15.4 Create Orchestrator
Required:
- Orchestrator name
- Parent path
Optional:
- Description
- Tags
- Schedule defaults

### 15.5 Create Connection
Required:
- Name
- Type
- Environment
- Authentication model
Optional:
- Description
- Tags

---

## 16. Recommended Activity/Event Labels

Standardize event names for UI grids:
- CREATED
- UPDATED
- RENAMED
- OPENED
- SAVED
- SAVED_AS
- DELETED
- MOVED
- COPIED
- VALIDATED
- EXECUTION_STARTED
- EXECUTION_SUCCEEDED
- EXECUTION_FAILED
- EXECUTION_CANCELLED
- PUBLISHED
- PERMISSION_GRANTED
- PERMISSION_REVOKED
- ROLE_ASSIGNED
- ROLE_REMOVED
- CONNECTION_TESTED
- SECRET_REFERENCE_CHANGED

---

## 17. QA Checklist for UI Delivery

### 17.1 Tab Model
- Every object opens in tab, not page
- Multiple tabs can stay open
- Dirty tabs show italic label
- Close prompts appear for dirty tabs

### 17.2 Properties and Audit
- Created/updated/opened fields visible
- Read-only fields non-editable
- Editable fields save correctly
- Last opened updates correctly

### 17.3 History
- History shows actor/time/change
- Rename actions recorded
- Version compare accessible where supported

### 17.4 Permissions
- Direct vs inherited shown clearly
- Effective permissions correct
- Unauthorized actions hidden or disabled

### 17.5 Pipeline/Orchestrator
- Designer is drag-and-drop
- Validation identifies bad nodes
- Execution history opens execution tabs
- Metalink works inside shell

### 17.6 Security
- Secrets masked
- Logs permission-controlled
- Audit visible for privileged users
- Failed access events captured where designed

---

## 18. Implementation Notes for Development Teams

1. Use a reusable object-tab framework so Project, Folder, Pipeline, Orchestrator, Connection, User, and Role tabs share common patterns.
2. Build sub-tabs as configurable modules.
3. Separate read-only system fields from editable business fields.
4. Introduce a universal dirty-state manager.
5. Introduce a universal history grid component.
6. Introduce a universal permissions grid component.
7. Use stable object IDs everywhere.
8. Support optimistic UI carefully for rename/save.
9. Ensure audit timestamps are consistently formatted.
10. Ensure all open actions can update "last opened" without causing noisy visual refresh.

---

## 19. Recommended Future Extensions

Potential future tabs or modules:
- Lineage explorer
- Approval workflow tab
- Promotion/release tab
- Data quality tab
- SLA monitoring tab
- Cost monitoring tab
- Reusable templates tab
- Shared assets catalog
- AI assistant suggestions panel
- Impact simulation tab

---

## 20. Final Summary

This No-Code ETL tool shall behave like an enterprise desktop workspace in the browser, not like a conventional page-based web application. All major objects must open in tabs within the ETL shell. Projects, folders, pipelines, orchestrators, connections, metadata objects, users, and roles must all expose consistent properties, audit, history, and permission visibility.

Pipelines and orchestrators must provide rich drag-and-drop designers, detailed history, and execution visibility. Unsaved changes must be clearly shown through italic tab labels and object names until persisted. Auditability, security, role-based visibility, inheritance clarity, and operational observability are not optional add-ons; they are first-class UI requirements.

This document should be used as the baseline for detailed UX design, API contracts, data model alignment, security control design, and QA test coverage.
