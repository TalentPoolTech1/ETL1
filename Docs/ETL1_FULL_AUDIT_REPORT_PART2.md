# ETL1 Platform — Full Implementation Audit Report
## Part 2 of 3: Traceability Matrices (CSV-style)

---

## 3. ACTION TRACEABILITY MATRIX

> Status legend: FW=Fully Wired, PW=Partial, STUB=Stub, DEAD=Dead button/no handler, MISS=Missing entirely, BROKEN=Wrong wiring

```
Module,Screen,Action,UI Handler,API Endpoint,Service/Thunk,Request Payload,Missing Inputs,Response Used?,UI Refresh?,Logging?,Status
Project,LeftSidebar,List projects,fetchProjects on mount,GET /api/projects,fetchProjects thunk,none,none,Y,Y (sidebar tree),Partial,FW
Project,LeftSidebar,Create project,CreateProjectDialog submit,POST /api/projects,createProject thunk,projectDisplayName+projectDescText,none,Y,Y (Redux push),Y (api level),FW
Project,LeftSidebar,Rename project,InlineRename onCommit,PUT /api/projects/:id,renameProject thunk,projectDisplayName,none,N (just success),Y (Redux update name),N,FW
Project,LeftSidebar,Delete project,window.confirm + dispatch,DELETE /api/projects/:id,deleteProject thunk,id,none,N,Y (Redux remove),N,FW
Project,—,Clone project,—,—,—,—,ENTIRE ACTION MISSING,—,—,—,MISS
Project,—,Project permissions,—,GET/POST /api/governance/projects/:pid/members,—,—,NO UI,—,—,—,MISS
Folder,LeftSidebar,Create root folder,CreateFolderDialog submit,POST /api/folders,createFolder thunk,projectId+folderDisplayName+folderTypeCode,none,Y,Y (root folders only),N,FW
Folder,LeftSidebar,Create sub-folder,FolderNode dispatch,POST /api/folders,createFolder thunk,projectId+parentFolderId+folderDisplayName,none,Y,N (sub-folder NOT added to parent local state),N,PW
Folder,FolderNode,Rename folder,InlineRename onCommit,PUT /api/folders/:id/rename,renameFolder thunk,folderDisplayName,none,N,Y (root only; nested folders miss),N,PW
Folder,FolderNode,Delete folder,window.confirm + dispatch,DELETE /api/folders/:id,deleteFolder thunk,id,none,N,Y,N,FW
Folder,—,Move folder,—,—,—,—,ENTIRE ACTION MISSING,—,—,—,MISS
Pipeline,LeftSidebar,Create pipeline,CreatePipelineDialog submit,POST /api/pipelines,createPipeline thunk,projectId+pipelineDisplayName+pipelineDescText+folderId,none,Y (returns pipelineId),Y (project root only; folder-scoped items NOT updated),N,PW
Pipeline,LeftSidebar,Rename pipeline,InlineRename,PUT /api/pipelines/:id,renamePipeline thunk,pipelineDisplayName,none,N,Y (Redux update),N,FW
Pipeline,LeftSidebar,Delete pipeline,window.confirm + dispatch,DELETE /api/pipelines/:id,deletePipeline thunk,id,none,Y (checks rowCount),Y (Redux remove),N,FW
Pipeline,LeftSidebar,Open pipeline,dispatch openTab,—,—,—,—,—,Y (opens PipelineWorkspace),N,FW
Pipeline,PipelineWorkspace,Save pipeline (canvas),auto-save on change,PUT /api/pipelines/:id,api.savePipeline,nodes+edges+uiLayout+changeSummary,none,Y,Y (new version created),Partial,FW
Pipeline,OverviewSubTab,Inline save name/desc,setEditing(false) ONLY,NONE,NONE,NOTHING SENT,API CALL MISSING,N,N,N,DEAD
Pipeline,OverviewSubTab,Run pipeline,api.runPipeline,POST /api/pipelines/:id/run,—,pipelineId,environment/technology options not sent from overview,Y (gets runId),Y (refreshes runs list after 1.5s),N,PW
Pipeline,OverviewSubTab,Schedule,No onClick,NONE,NONE,—,ENTIRE ACTION MISSING,N,N,N,DEAD
Pipeline,OverviewSubTab,Clone,No onClick,NONE,NONE,—,ENTIRE ACTION MISSING,N,N,N,DEAD
Pipeline,ExecutionHistorySubTab,List runs,useEffect on mount+filter change,GET /api/executions/pipeline-runs,api.getPipelineRuns,pipelineId+all filters+pagination,none,Y,Y,N,FW
Pipeline,ExecutionHistorySubTab,Retry run,api.retryPipelineRun,POST /api/executions/pipeline-runs/:runId/retry,—,runId,none,Y,Y (reload after 600ms),N,FW
Pipeline,ExecutionHistorySubTab,Cancel run,api.cancelPipelineRun,POST /api/executions/pipeline-runs/:runId/cancel,—,runId,none,Y,Y (reload after 500ms),N,FW
Pipeline,ExecutionHistorySubTab,Open run detail,dispatch openTab,—,—,—,—,—,Y (opens ExecutionDetailTab),N,FW
Pipeline,ExecutionHistorySubTab,Export CSV,client-side blob,NONE (client-only),—,—,none,Y,N/A,N,FW
Pipeline,ExecutionSubTab,Run pipeline,api.runPipeline,POST /api/pipelines/:id/run,—,pipelineId+environment+technology,none,Y,Y (polls for status),N,PW
Pipeline,ExecutionSubTab,Stop run,api.cancelPipelineRun,POST /api/executions/pipeline-runs/:runId/cancel,—,runId,none,Y,Y,N,FW
Pipeline,ValidationSubTab,Validate,api.validatePipeline,POST /api/pipelines/:id/validate,ctrl.validate,pipelineId,none,Y (issues array),Y,N,FW
Pipeline,PipelineCodeSubTab,Generate code,api.generateCode,POST /api/pipelines/:id/generate,ctrl.generate,pipelineId+technology,none,BROKEN (wrong field),N (shows placeholder),N,BROKEN
Pipeline,PipelineCodeSubTab,Copy code,navigator.clipboard,NONE,—,code string,none,N/A,N/A,N,FW
Pipeline,PipelineCodeSubTab,Download code,client-side blob,NONE,—,code string,none,N/A,N/A,N,FW
Pipeline,PipelinePropertiesSubTab,Save properties,NO SAVE BUTTON,NONE,NONE,NOTHING,API+SAVE MISSING,N,N,N,STUB
Pipeline,PipelineParametersSubTab,Add parameter,setParams(local),NONE,NONE,—,ENTIRE PERSISTENCE MISSING,N,N,N,STUB
Pipeline,PipelineParametersSubTab,Remove parameter,setParams(local),NONE,NONE,—,—,N,N,N,STUB
Pipeline,PipelineParametersSubTab,Edit parameter,setParams(local),NONE,NONE,—,—,N,N,N,STUB
Pipeline,PipelineActivitySubTab,View activity,—,NONE,NONE,—,ALWAYS EMPTY ARRAY,N,N,N,STUB
Pipeline,PipelineAlertsSubTab,Add alert rule,setRules(local),NONE,NONE,—,ENTIRE PERSISTENCE MISSING,N,N,N,STUB
Pipeline,PipelineAlertsSubTab,Toggle alert rule,setRules(local),NONE,NONE,—,—,N,N,N,STUB
Pipeline,PipelineAlertsSubTab,Delete alert rule,setRules(local),NONE,NONE,—,—,N,N,N,STUB
Pipeline,LineageSubTab,View lineage,api.getLineage,GET /api/pipelines/:id/lineage,—,pipelineId,none,Y (but stub data),Y (single node only),N,PW
Pipeline,LineageSubTab,Impact analysis,No onClick,NONE,NONE,—,—,N,N,N,DEAD
Pipeline,LineageSubTab,Export lineage,No onClick,NONE,NONE,—,—,N,N,N,DEAD
Pipeline,PermissionsSubTab,Load permissions,api.getPipelinePermissions,GET /api/pipelines/:id/permissions,—,pipelineId,none,Y (always empty stub),Y (empty),N,PW
Pipeline,PermissionsSubTab,Add grant,api.updatePipelinePermissions,PUT /api/pipelines/:id/permissions,—,grants+inheritFromProject,none,Y (stub returns success),N (no real persist),N,PW
Pipeline,PermissionsSubTab,Remove grant,api.updatePipelinePermissions,PUT /api/pipelines/:id/permissions,—,grants,none,Y (stub),N,N,PW
Pipeline,PermissionsSubTab,Change role,api.updatePipelinePermissions,PUT /api/pipelines/:id/permissions,—,grants,none,Y (stub),N,N,PW
Pipeline,AuditLogsSubTab,Load audit logs,api.getPipelineAuditLogs,GET /api/pipelines/:id/audit-logs,—,pipelineId+limit+offset,none,Y,Y,N,FW
Pipeline,PipelineMetricsSubTab,Load metrics,api.getPipelineRuns,GET /api/executions/pipeline-runs,—,pipelineId+pageSize:30,none,Y,Y (computed stats),N,FW
Pipeline,PipelineDependenciesSubTab,View dependencies,—,NONE,NONE,—,ALWAYS EMPTY ARRAY,N,N,N,STUB
Pipeline,OptimizeSubTab,View optimize,—,NONE,NONE,—,HARDCODED MOCK DATA,N,N,N,STUB
Orchestrator,LeftSidebar,Create orchestrator,CreateOrchestratorDialog,POST /api/orchestrators,createOrchestrator thunk,projectId+orchDisplayName+orchDescText+folderId,none,Y,Y,N,FW
Orchestrator,LeftSidebar,Rename orchestrator,InlineRename,PUT /api/orchestrators/:id,renameOrchestrator thunk,orchDisplayName,none,N,Y,N,FW
Orchestrator,LeftSidebar,Delete orchestrator,window.confirm,DELETE /api/orchestrators/:id,deleteOrchestrator thunk,id,none,N,Y,N,FW
Orchestrator,OrchestratorWorkspace,Run orchestrator,—,POST /api/orchestrators/:id/run,—,orchId,none,Y (orchRunId returned),Y (inserts PENDING row only),N,PW
Orchestrator,—,Schedule orchestrator,—,NONE,NONE,—,ENTIRE MISSING,—,—,—,MISS
Orchestrator,—,Clone orchestrator,—,NONE,NONE,—,ENTIRE MISSING,—,—,—,MISS
Connection,LeftSidebar,List connections,fetchConnectors on expand,GET /api/connections,fetchConnectors thunk,none,none,Y,Y,N,FW
Connection,LeftSidebar,Create connection (sidebar +),dispatch openCreateConnection,POST /api/connections,createConnector thunk,connectorDisplayName+connectorTypeCode+connConfig+connSecrets,none,Y,Y (Redux push),N,FW
Connection,ConnectionsManager,New Connection button,NO onClick,NONE,NONE,—,onClick MISSING,N,N,N,DEAD
Connection,ConnectionsManager,List connections,api.getConnections,GET /api/connections,—,none,none,BROKEN (wrong response field),CRASH,N,BROKEN
Connection,ConnectionWorkspace,Test connection,—,POST /api/connections/:id/test,connectionsService.testConnector,connectorId,none,Y,Y,N,FW
Connection,ConnectionWorkspace,Update connection,—,PUT /api/connections/:id,connectionsService.updateConnector,all config fields,none,Y,Y?,N,PW
Connection,ConnectionWorkspace,Delete connection,—,DELETE /api/connections/:id,connectionsService.deleteConnector,id,none,Y,Y?,N,PW
Connection,ConnectionWorkspace,Browse databases,api.listDatabases,GET /api/connections/:id/databases,—,connectorId,none,Y,Y,N,FW
Connection,ConnectionWorkspace,Browse schemas,api.listSchemas,GET /api/connections/:id/schemas,—,connectorId+database,none,Y,Y,N,FW
Connection,ConnectionWorkspace,Browse tables,api.listTables,GET /api/connections/:id/tables,—,connectorId+database+schema,none,Y,Y,N,FW
Execution,MonitorView,List pipeline runs,loadData on mount+filter change,GET /api/executions/pipeline-runs,api.getPipelineRuns,all filter params+pagination,none,Y,Y,N,FW
Execution,MonitorView,List orchestrator runs,loadData,GET /api/executions/orchestrator-runs,api.getOrchestratorRuns,filter params,none,Y,Y,N,FW
Execution,MonitorView,View KPIs,loadData,GET /api/executions/kpis,api.getMonitorKpis,date+project filters,none,Y,Y,N,FW
Execution,MonitorView,Retry run,api.retryPipelineRun,POST /api/executions/pipeline-runs/:runId/retry,—,runId,none,Y,Y (reload),N,FW
Execution,MonitorView,Cancel run,api.cancelPipelineRun,POST /api/executions/pipeline-runs/:runId/cancel,—,runId,none,Y,Y (reload),N,FW
Execution,MonitorView,Bulk retry,Promise.allSettled,POST /api/executions/pipeline-runs/:runId/retry (x N),—,selectedRunIds,none,Y,Y,N,FW
Execution,MonitorView,Bulk cancel,Promise.allSettled,POST /api/executions/pipeline-runs/:runId/cancel (x N),—,selectedRunIds,none,Y,Y,N,FW
Execution,MonitorView,Export CSV,client-side blob,NONE,—,selected run data,none,N/A,N/A,N,FW
Execution,MonitorView,Auto-refresh,setInterval,all data endpoints,—,all filters,none,Y,Y,N,FW
Execution,ExecutionDetailTab,View run detail,api.getPipelineRunDetail,GET /api/executions/pipeline-runs/:runId,—,runId,none,Y,Y,N,FW
Execution,ExecutionDetailTab,View run logs,api.getPipelineRunLogs,GET /api/executions/pipeline-runs/:runId/logs,—,runId+offset+limit,none,Y,Y,N,FW
Execution,ExecutionDetailTab,View run nodes,api.getPipelineRunNodes,GET /api/executions/pipeline-runs/:runId/nodes,—,runId,none,Y,Y,N,FW
Governance,LeftSidebar,List users (sidebar),api.getUsers on expand,GET /api/governance/users,—,none,none,Y,Y,N,FW
Governance,LeftSidebar,List roles (sidebar),api.getRoles on expand,GET /api/governance/roles,—,none,none,Y,Y,N,FW
Governance,GovernanceView,List users (main page),—,NONE (uses mockUsers),—,—,API CALL MISSING,N,N (shows mock data),N,STUB
Governance,GovernanceView,Invite user button,No onClick,NONE,—,—,—,N,N,N,DEAD
Governance,GovernanceView,Audit log tab,AuditLogsSubTab (no pipelineId),GET /api/pipelines/:id/audit-logs,—,MISSING pipelineId,pipelineId,N (guard fires),N (always empty),N,BROKEN
Governance,UserWorkspace,Load user profile,—,NONE,—,—,API CALL MISSING,N,N (defaults only),N,STUB
Governance,UserWorkspace,Save user profile,setIsSaving+setTimeout,NONE,—,—,API CALL IS setTimeout,N,N,N,STUB
Governance,UserWorkspace,Reset password,No onClick,NONE,—,—,—,N,N,N,DEAD
Governance,UserWorkspace,Deactivate user,No onClick,NONE,—,—,—,N,N,N,DEAD
Auth,LoginPage,Login,form submit,POST /api/auth/login,—,email+password,none,Y (token+user),Y (auth state),Y,FW
Auth,SettingsView,Change password,form submit,POST /api/auth/change-password,—,currentPassword+newPassword,none,Y,Y,Y,FW
Settings,SettingsView,Interface density,setOn local,NONE,—,—,PERSISTENCE MISSING,N,N,N,STUB
Settings,SettingsView,Notification prefs,setOn local,NONE,—,—,PERSISTENCE MISSING,N,N,N,STUB
Settings,SettingsView,Manage access tokens,No onClick,NONE,—,—,—,N,N,N,DEAD
Dashboard,DashboardView,Load KPIs,dispatch fetchKpis,GET /api/executions/kpis,fetchKpis thunk,none,none,Y,Y,N,FW
Dashboard,DashboardView,Refresh,dispatch fetchKpis,GET /api/executions/kpis,—,none,none,Y,Y,N,FW
Dashboard,DashboardView,Compute metrics,—,NONE (fake arithmetic),—,—,NO REAL CLUSTER DATA,N/A,N/A,N,STUB
Dashboard,DashboardView,Data Freshness,—,NONE (hardcoded 92.5),—,—,—,N,N,N,STUB
Schedule,OverviewSubTab,Schedule pipeline,No onClick,NONE,—,—,ENTIRE FEATURE MISSING,N,N,N,DEAD
Lineage,LineageExplorer,View platform lineage,—,NONE,—,—,NO API,N,N,N,MISS
Global Pipelines,LeftSidebar,Create global pipeline,/* TODO */,NONE,—,—,—,N,N,N,DEAD
Global Orchs,LeftSidebar,Create global orchestrator,/* TODO */,NONE,—,—,—,N,N,N,DEAD
```

---

## 4. FIELD TRACEABILITY MATRIX

> Static=field value is hardcoded/not from API. Mock=field uses demo placeholder data.

```
Module,Screen,Field,Display Source,Input Source,API Field Name,Backend DB Column,Static/Mock?,Persisted?,Reloaded Correctly?,Validation?,Status
Project,CreateProjectDialog,Project name,user input,form field,projectDisplayName,project_display_name,N,Y,Y,Y (required + duplicate check),OK
Project,CreateProjectDialog,Description,user input,form field,projectDescText,project_desc_text,N,Y,Y,N,OK
Project,LeftSidebar,Project display name,Redux state,API response,projectDisplayName,project_display_name,N,Y,Y,N,OK
Project,LeftSidebar,Project created date,Redux state,API response,createdDtm,created_dtm,N,Y,Y,N,OK
Pipeline,OverviewSubTab,Pipeline name (edit form),activePipeline.name,local draftName state,pipelineDisplayName,pipeline_display_name,N,NO (no save API call),N,N,DEFECT
Pipeline,OverviewSubTab,Pipeline description (edit),activePipeline.description,local draftDesc state,pipelineDescText,pipeline_desc_text,N,NO,N,N,DEFECT
Pipeline,OverviewSubTab,Nodes count,Redux pipelineSlice.nodes,canvas state,—,—,N,N/A,Y,N,OK
Pipeline,OverviewSubTab,Success rate,computed from runs array,api.getPipelineRuns,—,—,N,N/A,Y,N,OK
Pipeline,OverviewSubTab,Last run time,runs[0].startDtm,API response,startDtm,start_dtm,N,N/A,Y,N,OK
Pipeline,OverviewSubTab,Version,activePipeline.version,Redux load,—,version_num_seq,N,N/A,Y,N,OK
Pipeline,PipelinePropertiesSubTab,Pipeline ID,pipelineId prop,prop,—,pipeline_id,N,N/A,Y,N,OK
Pipeline,PipelinePropertiesSubTab,Pipeline Name,activePipeline.name,local state,—,pipeline_display_name,N,NO (no save),N,N,DEFECT
Pipeline,PipelinePropertiesSubTab,Description,activePipeline.description,local state,—,pipeline_desc_text,N,NO,N,N,DEFECT
Pipeline,PipelinePropertiesSubTab,Project,HARDCODED '',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Folder,HARDCODED '',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Status,HARDCODED 'draft',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Owner,HARDCODED '',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Tags,local state,user input,—,—,N,NO,N,N,DEFECT
Pipeline,PipelinePropertiesSubTab,Labels,local state,user input,—,—,N,NO,N,N,DEFECT
Pipeline,PipelinePropertiesSubTab,Runtime Engine,HARDCODED 'Spark',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Execution Mode,HARDCODED 'batch',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Retry Policy,HARDCODED '3 retries 60s delay',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Timeout,HARDCODED '4 hours',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Logging Level,HARDCODED 'INFO',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Published State,HARDCODED 'draft',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Lock State,HARDCODED 'Unlocked',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Created By,HARDCODED '—',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Created On,activePipeline.createdAt,Redux (loaded),—,created_dtm,N,N/A,Y (partially),N,OK
Pipeline,PipelinePropertiesSubTab,Updated By,HARDCODED '—',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Updated On,activePipeline.updatedAt,Redux (loaded),—,updated_dtm,N,N/A,Y (partially),N,OK
Pipeline,PipelinePropertiesSubTab,Last Opened By,HARDCODED '—',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Last Opened On,HARDCODED '—',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Last Executed By,HARDCODED '—',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Last Executed On,HARDCODED '—',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Last Success On,HARDCODED '—',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Last Failed On,HARDCODED '—',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,PipelinePropertiesSubTab,Version,activePipeline.version,Redux,—,version_num_seq,N,N/A,Y,N,OK
Pipeline,PipelineParametersSubTab,Name,local state,user input,—,— (no table),N,NO,N,N,DEFECT (stub)
Pipeline,PipelineParametersSubTab,Data Type,local state,user select,—,—,N,NO,N,N,DEFECT (stub)
Pipeline,PipelineParametersSubTab,Required flag,local state,user checkbox,—,—,N,NO,N,N,DEFECT (stub)
Pipeline,PipelineParametersSubTab,Default Value,local state,user input,—,—,N,NO,N,N,DEFECT (stub)
Pipeline,PipelineParametersSubTab,Sensitive flag,local state,user checkbox,—,—,N,NO,N,N,DEFECT (stub)
Pipeline,PipelineParametersSubTab,Scope,local state,user select,—,—,N,NO,N,N,DEFECT (stub)
Pipeline,PipelineParametersSubTab,Description,local state,user input,—,—,N,NO,N,N,DEFECT (stub)
Pipeline,PipelineAlertsSubTab,Rule name,local state / hardcoded init,user input,—,—,STATIC init,NO,N,N,DEFECT (stub)
Pipeline,PipelineAlertsSubTab,Alert event,local state / hardcoded init,user select,—,—,STATIC init,NO,N,N,DEFECT (stub)
Pipeline,PipelineAlertsSubTab,Channel,local state / hardcoded init,user select,—,—,STATIC init,NO,N,N,DEFECT (stub)
Pipeline,PipelineAlertsSubTab,Target,HARDCODED 'team@example.com' / '#data-alerts',user input,—,—,STATIC,NO,N,N,DEFECT (mock)
Pipeline,PipelineAlertsSubTab,Silence minutes,local state,user input,—,—,N,NO,N,N,DEFECT (stub)
Pipeline,OptimizeSubTab,Source technology,HARDCODED 'PostgreSQL',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,OptimizeSubTab,Target technology,HARDCODED 'Snowflake',—,—,—,STATIC,N,N,N,DEFECT (mock)
Pipeline,ExecutionHistorySubTab,Run ID,API,GET /api/executions/pipeline-runs,pipelineRunId,pipeline_run_id,N,N/A,Y,N,OK
Pipeline,ExecutionHistorySubTab,Status,API,GET /api/executions/pipeline-runs,runStatus,run_status_code,N,N/A,Y,N,OK
Pipeline,ExecutionHistorySubTab,Start Time,API,GET /api/executions/pipeline-runs,startDtm,start_dtm,N,N/A,Y,N,OK
Pipeline,ExecutionHistorySubTab,Duration,API,GET /api/executions/pipeline-runs,durationMs,run_duration_ms,N,N/A,Y,N,OK
Pipeline,ExecutionHistorySubTab,Rows Out,HARDCODED fmtNum(null),—,—,— (not in API type),STATIC null,N/A,N,N,DEFECT (missing field)
Pipeline,ExecutionHistorySubTab,Rows Failed,HARDCODED fmtNum(null),—,—,— (not in API type),STATIC null,N/A,N,N,DEFECT (missing field)
Pipeline,ExecutionHistorySubTab,Env,HARDCODED '—',—,—,— (not in API),STATIC,N/A,N,N,DEFECT (missing field)
Connection,CreateConnectionDialog,Connection name,user input,form field,connectorDisplayName,connector_display_name,N,Y,Y,Y (required),OK
Connection,CreateConnectionDialog,Config fields,user input (dynamic),dynamic from schema,config.*,conn_config_json,N,Y (encrypted),N (secrets hidden by design),Y (per schema),OK
Connection,ConnectionsManager,Status,HARDCODED 'active',—,—,— (health_status_code ignored),STATIC,N/A,N,N,DEFECT (mock)
Connection,ConnectionsManager,Last Tested,HARDCODED new Date(),—,—,— (last_tested_dtm ignored),STATIC,N/A,N,N,DEFECT (mock)
Execution,MonitorView,Total Today,API,GET /api/executions/kpis,totalToday,COUNT(*),N,N/A,Y,N,OK
Execution,MonitorView,Running Now,API,GET /api/executions/kpis,runningNow,COUNT FILTER RUNNING,N,N/A,Y,N,OK
Execution,MonitorView,Success Rate,API,GET /api/executions/kpis,successRateToday,computed in SQL,N,N/A,Y,N,OK
Execution,MonitorView,SLA Breaches,API,GET /api/executions/kpis,slaBreachesToday,sla_status_code,N,N/A,Y,N,OK
Dashboard,DashboardView,CPU Utilization,FAKE: runningNow*15+12,—,—,—,STATIC formula,N/A,N,N,DEFECT (mock)
Dashboard,DashboardView,Memory Usage,FAKE: runningNow*10+34,—,—,—,STATIC formula,N/A,N,N,DEFECT (mock)
Dashboard,DashboardView,Disk I/O,FAKE: dataVolumeGb*2+5,—,—,—,STATIC formula,N/A,N,N,DEFECT (mock)
Dashboard,DashboardView,Network Egress,FAKE: dataVolumeGb*3+18,—,—,—,STATIC formula,N/A,N,N,DEFECT (mock)
Dashboard,DashboardView,Data Freshness,HARDCODED 92.5,—,—,—,STATIC,N/A,N,N,DEFECT (mock)
Dashboard,DashboardView,Active Pipelines,kpis?.activePipelines (undefined),GET /api/executions/kpis,activePipelines,NOT IN QUERY,MISSING FIELD,N/A,N,N,DEFECT
Governance,GovernanceView,User: name,mockUsers hardcoded array,—,—,—,STATIC,N,N,N,DEFECT (mock)
Governance,GovernanceView,User: email,mockUsers hardcoded array,—,—,—,STATIC,N,N,N,DEFECT (mock)
Governance,GovernanceView,User: role,mockUsers hardcoded array,—,—,—,STATIC,N,N,N,DEFECT (mock)
Governance,GovernanceView,User: status,mockUsers hardcoded array,—,—,—,STATIC,N,N,N,DEFECT (mock)
Governance,UserWorkspace,Username,tab.objectName (from sidebar),—,—,—,PARTIAL (name only),NO (save is fake),N,N,DEFECT
Governance,UserWorkspace,Email,HARDCODED '',—,—,—,STATIC,NO,N,N,DEFECT
Governance,UserWorkspace,User Type,HARDCODED 'standard',—,—,—,STATIC,NO,N,N,DEFECT
Governance,UserWorkspace,MFA Status,HARDCODED 'Disabled',—,—,—,STATIC,NO,N,N,DEFECT
Governance,UserWorkspace,Created By,HARDCODED '—',—,—,—,STATIC,NO,N,N,DEFECT
Governance,UserWorkspace,Last Login,HARDCODED '—',—,—,—,STATIC,NO,N,N,DEFECT
Governance,UserWorkspace,Roles list,HARDCODED [] empty array,—,—,—,STATIC,NO,N,N,DEFECT
Settings,SettingsView,Interface Density,local useState,—,—,—,N,NO,N,N,STUB
Settings,SettingsView,Email notification on/off,local useState,—,—,—,N,NO,N,N,STUB
Settings,SettingsView,Mobile push on/off,local useState,—,—,—,N,NO,N,N,STUB
```

---

## 5. STUB / FAKE WIRING REPORT

| # | Location | Why It Is a Stub | Proof | What Should Have Happened | Suggested Fix |
|---|---|---|---|---|---|
| 1 | `PipelineParametersSubTab.tsx` | Local state only; zero API calls | No import of api.*, useState only | POST /api/pipelines/:id/parameters on save; GET on load | Add parameters API + Redux thunk |
| 2 | `PipelinePropertiesSubTab.tsx` | All fields hardcoded defaults; no save | `retryPolicy:'3 retries, 60s delay'` in useState init | PUT /api/pipelines/:id with all fields; GET to load | Create properties API endpoint |
| 3 | `PipelineActivitySubTab.tsx` | `const events = []` with comment "will load when ready" | Line 15, permanent empty array | GET /api/pipelines/:id/activity-log | Wire to audit-logs or create activity endpoint |
| 4 | `PipelineDependenciesSubTab.tsx` | `const deps = []` with stub comment | Line 11 | GET /api/pipelines/:id/lineage to derive deps | Wire to lineage endpoint when built |
| 5 | `PipelineAlertsSubTab.tsx` | Init with team@example.com; no API | useState init with demo data | POST/GET/DELETE /api/pipelines/:id/alerts | Create alerts CRUD API |
| 6 | `OptimizeSubTab.tsx` | Hardcoded PostgreSQL/Snowflake mockSequence | `const mockSequence = useMemo(...)` with 4 static steps | Read pipeline.nodes from Redux slice | Replace with `useAppSelector(s => s.pipeline.nodes)` |
| 7 | `OverviewSubTab.tsx` Save button | `onClick={() => setEditing(false)}` | No api.savePipeline() call | Call api.savePipeline with pipelineDisplayName+pipelineDescText | Add api.savePipeline call |
| 8 | `OverviewSubTab.tsx` Schedule | No onClick | `<Button size="sm" variant="ghost">Schedule</Button>` | Open schedule dialog | Create schedule feature |
| 9 | `OverviewSubTab.tsx` Clone | No onClick | `<Button size="sm" variant="ghost">Clone</Button>` | POST /api/pipelines/:id/clone | Create clone endpoint |
| 10 | `ConnectionsManager.tsx` New Connection | No onClick | Button has no onClick prop | dispatch(openCreateConnection()) | Add onClick handler |
| 11 | `ConnectionsManager.tsx` API mapping | `response.data.map(...)` crashes | TypeError on non-array | `response.data.data.map(...)` | Fix response mapping |
| 12 | `GovernanceView.tsx` mockUsers | 4 hardcoded users displayed | `const mockUsers = [...]` array | GET /api/governance/users → render real users | Replace with api.getUsers() call |
| 13 | `UserWorkspace.tsx` handleSave | setTimeout only | `await new Promise(r => setTimeout(r, 300))` | PUT /api/governance/users/:id | Implement user update API + call |
| 14 | `UserWorkspace.tsx` form data | All fields default/empty | No useEffect loading real data | GET /api/governance/users/:id on mount | Add data load useEffect |
| 15 | `pipeline.routes.ts` lineage | Returns 1-node static graph | `nodes:[{id,label:'This Pipeline'}],edges:[]` | Build real lineage from execution + node runs | Implement lineage service |
| 16 | `pipeline.routes.ts` permissions GET | Returns `{grants:[],inheritFromProject:true}` | Static inline object | SELECT from gov.pipeline_permissions | Implement permissions DB table + query |
| 17 | `pipeline.routes.ts` permissions PUT | Returns `{success:true}` | No DB operation | INSERT/UPDATE gov.pipeline_permissions | Implement DB write |
| 18 | `orchestrators.routes.ts` permissions GET | Same static stub | Identical pattern | Same as pipeline | Same fix |
| 19 | `orchestrators.routes.ts` permissions PUT | Same | Same | Same | Same |
| 20 | `DashboardView.tsx` compute metrics | Formula-based fake gauges | `runningNow * 15 + 12` etc. | Real cluster metrics API (Prometheus/Spark UI) | Connect to real metrics source |
| 21 | `DashboardView.tsx` Data Freshness | Hardcoded 92.5 | `value: 92.5` in qualityMetrics array | Real data quality score from DB | Implement DQ scoring API |
| 22 | `LeftSidebar.tsx` Global Pipelines + | `/* TODO */` | Explicit TODO comment | dispatch(openCreatePipeline({projectId:null})) | Replace TODO with dispatch call |
| 23 | `LeftSidebar.tsx` Global Orchestrators + | `/* TODO */` | Explicit TODO comment | dispatch(openCreateOrchestrator({projectId:null})) | Same |
| 24 | `ExecutionSubTab.tsx` step timeline | 5 static step names hardcoded | `steps: [{name:'Validate pipeline',...}]` init | Derive from actual pipeline node structure | Map pipeline.nodes to steps |
| 25 | `executions.routes.ts` run detail nodes | `nodes: []` hardcoded | Explicit empty array in response | JOIN execution.pipeline_node_runs | Fetch and include node run data |
| 26 | `GovernanceView.tsx` audit tab | AuditLogsSubTab missing pipelineId | No prop passed | Pass a global audit endpoint or fix component | Create system-level audit endpoint |
| 27 | `SettingsView.tsx` notification prefs | Local state toggles | `useState(enabled)` never persisted | POST /api/users/:id/preferences | Create user preferences API |
| 28 | `UserWorkspace.tsx` Reset Password button | No onClick | Raw `<button>` element without onClick | POST /api/auth/admin/reset-password/:userId | Add handler + API |
| 29 | `UserWorkspace.tsx` Deactivate button | No onClick | Raw `<button>` without onClick | PATCH /api/governance/users/:id { isActive: false } | Add handler + API |
| 30 | `PipelineAlertsSubTab.tsx` init data | `team@example.com` and `#data-alerts` hardcoded | Initial useState value | Load from API; show empty if none | Remove hardcoded init; load from API |
| 31 | `executions.routes.ts` KPI unused variable | `projectFilter` built but never referenced | `const projectFilter = ...` dead variable | Remove or use it | Delete dead variable |

---

## 6. PROCEDURE / FUNCTION MAPPING AUDIT

| Module | Action | Expected Proc/Query | Actual Proc/Query Called | Correct? | Notes |
|---|---|---|---|---|---|
| Project | Create | INSERT etl.projects | `INSERT INTO etl.projects (project_display_name, ...)` inline SQL | Y | Direct inline SQL, no stored proc |
| Project | Update | UPDATE etl.projects | `UPDATE etl.projects SET ... COALESCE` | Y | |
| Project | Delete | DELETE etl.projects | `DELETE FROM etl.projects WHERE project_id=$1` | Y | No row-count check |
| Project | List | SELECT etl.projects | `SELECT ... FROM etl.projects ORDER BY project_display_name` | Y | |
| Folder | Create | INSERT etl.folders | INSERT with ltree path computation | Y | ltree slug computation correct |
| Folder | Rename | UPDATE etl.folders | `UPDATE etl.folders SET folder_display_name=$2` | Y | Note: ltree path NOT updated on rename — stale path |
| Folder | Delete | DELETE etl.folders | `DELETE FROM etl.folders WHERE folder_id=$1` | Y | FK cascade expected |
| Pipeline | Create | INSERT catalog.pipelines | Inline INSERT — correct table, correct columns | Y | |
| Pipeline | Save/Versioned Update | INSERT pipeline_versions + INSERT pipeline_contents + UPDATE pipelines | Full 3-step versioned save | Y | Correct version management |
| Pipeline | Rename | UPDATE catalog.pipelines SET pipeline_display_name | isRename branch in PUT handler | Y | |
| Pipeline | Delete | DELETE catalog.pipelines | DELETE with rowCount check | Y | |
| Pipeline | Run | INSERT execution.pipeline_runs | Inserts PENDING row | PARTIAL | No engine reads this table |
| Pipeline | Validate | codegenService.validate() | Called via ctrl.validate() | Y | Works if pipeline has proper IR |
| Pipeline | Generate | codegenService.generate() + artifactRepository.save() | Called in ctrl.generate() | Y | BUT UI can't read the artifact (field mismatch — P-009) |
| Pipeline | Audit logs | SELECT history.pipelines_history | `SELECT h.hist_id, h.hist_action_dtm...` | Y | Reads trigger-generated history |
| Pipeline | Permissions GET | SELECT gov.pipeline_permissions | NONE — returns static stub | N | Table/query missing |
| Pipeline | Permissions PUT | UPDATE/INSERT gov.pipeline_permissions | NONE — returns static success | N | No DB operation |
| Pipeline | Lineage | SELECT execution data | Returns hardcoded 1-node graph | N | No real query |
| Orchestrator | Run | INSERT execution.orchestrator_runs | Inserts PENDING row | PARTIAL | No engine |
| Connection | Create | INSERT connections.connectors | Via connectionsService | Y | Full service layer |
| Connection | Test | Execute test query via plugin | Via connectionsService.testConnector | Y | |
| Execution | List runs | SELECT execution.pipeline_runs | Complex multi-join query | Y | |
| Execution | KPI | SELECT aggregated from pipeline_runs | Multi-aggregate query | Y | `activePipelines` field missing |
| Execution | Retry | INSERT execution.pipeline_runs (new row) | Inserts new PENDING row with retry_count+1 | Y | But engine doesn't execute it |
| Governance | List users | SELECT etl.users | Full user query with last_login | Y | |
| Governance | Assign role | INSERT gov.user_roles | ON CONFLICT DO NOTHING | Y | |
| Governance | Project members | SELECT/INSERT/DELETE gov.project_user_roles | Full CRUD | Y | But no UI triggers add/remove |
| Folder | Rename ltree path | UPDATE ltree path | MISSING — only display name updated | N | Stale hierarchical_path_ltree after rename |

**DEFECT DB-001 (Medium) — Folder rename does not update ltree path**
`PUT /api/folders/:id/rename` updates only `folder_display_name`. `hierarchical_path_ltree` is NOT updated. All child queries using ltree path will return stale/incorrect results after a folder rename.

---
