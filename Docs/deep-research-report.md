# Tab-Based No-Code ETL UI Requirements Research Report

## Problem framing and design constraints

Your UI requirement is best understood as a “desktop-in-the-browser” workspace: a persistent ETL shell where **everything** (projects, folders, pipelines, orchestrators, executions, permissions, history, admin) opens as tabs. The practical implication is that the application’s primary UX primitives are (a) the **Object Explorer tree** and (b) the **workspace tab system**, not pages or route-based screens.

Two security/audit research inputs heavily shape the UI requirements for history, access, and traceability:

- Security logging guidance emphasizes capturing **who/what/when/where**, as well as key event classes such as authentication/authorization failures, configuration changes, “higher-risk” admin operations (e.g., user privilege changes), and optionally **data changes**. citeturn7view0  
- Log management guidance highlights the need for systematic generation, review, protection, and retention of audit records (and operational processes around log analysis and long-term storage). citeturn4view0  

Those sources justify why your UI needs first-class **History**, **Audit**, **Permissions**, and **Execution** tabs as product primitives rather than “nice-to-have” screens.

## UX architecture for tab-only ETL shells

A tab-only ETL shell benefits from a strict separation of concerns:

- **Navigation model:** Open/activate tabs rather than switching pages.
- **State model:** Every object tab can become “dirty” and must visibly express that state until saved.
- **Audit model:** Viewing (“last opened”) must be tracked separately from modification (“last updated”), and both should be viewable in the Properties tab without conflating them. citeturn7view0turn4view0  

The “dirty state = italic” requirement is a UI contract that developers should treat as a universal rule, because visual edit-state indicators reduce accidental loss and clarify whether the user is looking at persisted state vs. local edits (especially when multiple tabs are open simultaneously).

Research also supports making audit trails **time-correlated** and **standardized** to improve analysis and correlation across systems. citeturn6view3 In practice, for UI this means your History/Audit grids should consistently show timestamps, correlation IDs, and stable object identifiers, and should support exporting in consistent formats.

## Object tabs, attributes, and behaviors

To meet your stated hierarchy and “no pages” constraint, the requirements define each object’s **main tab** and its **sub-tabs** (Properties, History, Permissions, etc.) with explicit field lists. The core objects you called out have these non-negotiable UI structures:

- **Project:** at minimum a Properties sub-tab with editable Project Name plus audit fields (created/updated/opened). The documentation expands this to include Overview, History, and Permissions to align with auditability and access-control expectations. citeturn7view0  
- **Folder (Directory/Sub-directory):** like Project (Properties + audit), plus a Contents sub-tab for child navigation and management.
- **Pipeline:** Properties + History + Executions + Permissions, with the additional strict rule that **renames and other unsaved edits italicize the tab label and header name until saved** (your direct requirement).
- **Orchestrator:** same pattern as Pipeline, plus a Runs tab (and optional Schedule sub-tab).

Finally, the “Execution metalink” requirement is modeled as a first-class operational object: selecting a run from an Executions/Runs grid opens an **Execution tab** inside the same shell. This aligns with common orchestration and job-history UX patterns where run details present start/end times, task metadata, and logs in structured sub-views. citeturn1search6turn1search2  

## Audit, history, and execution observability

The research strongly supports your “who changed what when” requirement as a security and operational baseline:

- Logging guidance explicitly calls out event attributes (“when, where, who and what”), and recommends logging key events like authentication and authorization failures, configuration changes, and user administration actions. citeturn7view0  
- NIST guidance highlights audit record generation, review, protection, and retention as central log management concerns, and recognizes the need to store records with sufficient detail for an appropriate period of time. citeturn4view0  
- Audit trail design also needs to address privacy risk: audit records can inadvertently contain personally identifiable information, so systems should consider limiting PII in audit records to what is needed. citeturn6view3  

These points directly drive concrete UI requirements implemented in the documents:

- Every secured object exposes audit fields (created/updated/opened) in Properties.
- Pipeline/Orchestrator History sub-tabs show diffs at field level (old/new values), actor identity, timestamp, and correlation ID.
- Executions/Runs sub-tabs list historical runs with start/end timestamps and status, and open an Execution tab.
- Logs are searchable, filterable, and downloadable only with appropriate permission, and must support redaction/masking of secrets by default.

For timestamp interoperability and copy/paste, aligning UI “copy as ISO” to an internet timestamp profile is a robust choice. citeturn0search11  

## Security and administration requirements

Your request for “who has access and what level (edit/delete/view/run/etc.)” is operationally an RBAC requirement. Research from entity["organization","National Institute of Standards and Technology","us standards agency"] includes a formal RBAC model and guidance recognizing RBAC as a standard approach to enterprise authorization. citeturn2search0turn2search4  

Two additional security principles shape the UI requirements:

- Least privilege: access privileges should be restricted to the minimum necessary for assigned tasks. citeturn2search2  
- Authorization and access-control failures are security events worth logging and monitoring. citeturn7view0turn2search1  

As a result, the Permissions tab requirements in the delivered documents emphasize:

- Explicit vs. inherited grants (especially important in your hierarchy).
- “Effective permissions for me” summary (reduces confusion and support load).
- Separation of “view vs. use vs. manage credentials” for Connections (so users can discover connections without gaining secret access).
- Admin-only Users and Roles areas with history/audit views.

## Requirement document deliverables

### Download package
- [Download the full Markdown package (ZIP)](sandbox:/mnt/data/nocode-etl-ui-requirements-md.zip)

### Individual Markdown files
- [README](sandbox:/mnt/data/nocode-etl-ui-requirements/README.md)  
- [Consolidated requirements](sandbox:/mnt/data/nocode-etl-ui-requirements/nocode-etl-ui-requirements.md)  
- [UI shell and tab system](sandbox:/mnt/data/nocode-etl-ui-requirements/ui-shell-and-tab-system.md)  
- [Object model and object tabs](sandbox:/mnt/data/nocode-etl-ui-requirements/object-model-and-object-tabs.md)  
- [Pipeline and orchestrator designers](sandbox:/mnt/data/nocode-etl-ui-requirements/pipeline-and-orchestrator-designers.md)  
- [Connections and metadata](sandbox:/mnt/data/nocode-etl-ui-requirements/connections-and-metadata.md)  
- [Security, admin, permissions, and audit](sandbox:/mnt/data/nocode-etl-ui-requirements/security-admin-audit.md)