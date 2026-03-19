// Types for project and pipeline objects

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pipeline {
  id: string;
  projectId: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  version: number;
  createdAt: string;
  updatedAt: string;
  unsavedChanges: boolean;
}

export interface Node {
  id: string;
  type:
    | 'source'
    | 'transform'
    | 'target'
    | 'join'
    | 'aggregate'
    | 'aggregation'
    | 'filter'
    | 'custom'
    | 'custom_sql'
    | 'union';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  config: Record<string, unknown>;
  inputs: Port[];
  outputs: Port[];
  version: number;
  createdAt?: string;
  updatedAt?: string;
  isDragging?: boolean;
}

export interface Port {
  id: string;
  name: string;
  type: string;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  sourcePort: string;
  targetPort: string;
}

// ─── Tab types ────────────────────────────────────────────────────────────────

export type TabType =
  | 'pipeline'
  | 'orchestrator'
  | 'monitor'
  | 'execution'
  | 'project'
  | 'folder'
  | 'connection'
  | 'connections'
  | 'metadata'
  | 'user'
  | 'role'
  | 'table'
  | 'sql'
  | 'dashboard'
  | 'lineage'
  | 'governance'
  | 'settings';

export interface Tab {
  id: string;
  type: TabType;
  objectId: string;
  objectName: string;
  unsaved: boolean;
  isDirty: boolean;
  /** Full ancestor path, e.g. "Projects → ProjectA → Folder1 → Pipeline_X" */
  hierarchyPath?: string;
  /** Whether tab is pinned (survives close-all) */
  isPinned?: boolean;
  /** For execution tabs: 'pipeline' | 'orchestrator' */
  executionKind?: 'pipeline' | 'orchestrator';
}

// ─── Sub-tab types ────────────────────────────────────────────────────────────

export type PipelineSubTab =
  | 'editor'
  | 'properties'
  | 'parameters'
  | 'validation'
  | 'history'
  | 'executions'
  | 'metrics'
  | 'code'
  | 'alerts'
  | 'logs'
  | 'dependencies'
  | 'permissions'
  | 'activity';

// PipelineSubTab covers all ids used across old + new sub-tabs
export type PipelineSubTabLegacy = PipelineSubTab | 'overview' | 'execution-history' | 'lineage' | 'audit-logs' | 'execution';

export type OrchestratorSubTab =
  | 'editor'
  | 'properties'
  | 'schedule'
  | 'parameters'
  | 'history'
  | 'runs'
  | 'dependencies'
  | 'permissions'
  | 'activity'
  | 'overview'
  | 'execution-history'
  | 'audit-logs'
  | 'execution';

export type ProjectSubTab =
  | 'overview'
  | 'properties'
  | 'history'
  | 'permissions'
  | 'activity';

export type FolderSubTab =
  | 'overview'
  | 'properties'
  | 'contents'
  | 'history'
  | 'permissions';

export type ConnectionSubTab =
  | 'properties'
  | 'usage'
  | 'history'
  | 'permissions'
  | 'import';

export type MetadataSubTab =
  | 'overview'
  | 'structure'
  | 'profiling'
  | 'lineage'
  | 'history'
  | 'permissions';

export type UserSubTab =
  | 'profile'
  | 'access'
  | 'activity'
  | 'audit'
  | 'sessions'
  | 'preferences';

export type RoleSubTab =
  | 'properties'
  | 'members'
  | 'permissions'
  | 'scope'
  | 'history'
  | 'audit';

export interface TreeNode {
  id: string;
  name: string;
  type: 'technology' | 'connection' | 'schema' | 'table' | 'column';
  icon?: string;
  children?: TreeNode[];
  metadata?: Record<string, unknown>;
  isExpanded?: boolean;
}

export interface DataPreviewRow {
  [key: string]: unknown;
}

export interface DataPreview {
  columns: string[];
  rows: DataPreviewRow[];
  totalRows: number;
  schema: Record<string, string>;
}

// ─── Monitor / Execution types ─────────────────────────────────────────────

export type RunStatus =
  | 'PENDING' | 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED'
  | 'CANCELLED' | 'SKIPPED' | 'RETRYING' | 'TIMED_OUT' | 'PARTIALLY_COMPLETED';

export type TriggerType = 'MANUAL' | 'SCHEDULED' | 'API' | 'ORCHESTRATOR';
export type SlaStatus = 'ON_TIME' | 'AT_RISK' | 'BREACHED' | 'N_A';
export type MonitorScope = 'global' | 'project';

export interface PipelineRunSummary {
  pipelineRunId: string;
  pipelineName: string;
  pipelineId: string;
  projectId: string | null;
  projectName: string | null;
  versionLabel: string;
  runStatus: RunStatus;
  triggerType: TriggerType;
  submittedBy: string | null;
  startDtm: string | null;
  endDtm: string | null;
  durationMs: number | null;
  rowsProcessed: number | null;
  bytesRead: number | null;
  bytesWritten: number | null;
  errorCategory: string | null;
  retryCount: number;
  slaStatus: SlaStatus;
  tags: string[];
}

export interface OrchestratorRunSummary {
  orchRunId: string;
  orchestratorName: string;
  orchestratorId: string;
  projectId: string | null;
  projectName: string | null;
  runStatus: RunStatus;
  triggerType: TriggerType;
  startDtm: string | null;
  endDtm: string | null;
  durationMs: number | null;
  pipelineRuns: PipelineRunSummary[];
}

export interface NodeRunDetail {
  nodeRunId: string;
  nodeIdInIrText: string;
  nodeDisplayName: string;
  runStatus: RunStatus;
  startDtm: string | null;
  endDtm: string | null;
  durationMs: number | null;
  rowsIn: number | null;
  rowsOut: number | null;
  errorMessage: string | null;
  metrics: Record<string, unknown>;
}

export interface MonitorKpis {
  totalToday: number;
  runningNow: number;
  successRateToday: number;
  failedToday: number;
  avgDurationMsToday: number | null;
  slaBreachesToday: number;
  dataVolumeGbToday: number;
  activePipelines: number;
}

export interface MonitorFilters {
  scope: MonitorScope;
  projectId: string | null;
  status: RunStatus | null;
  triggerType: TriggerType | null;
  dateFrom: string | null;
  dateTo: string | null;
  search: string;
  objectType: 'all' | 'pipeline' | 'orchestrator';
  myJobsOnly: boolean;
}

// ─── Object status ─────────────────────────────────────────────────────────

export type ObjectStatus =
  | 'draft'
  | 'published'
  | 'running'
  | 'failed'
  | 'success'
  | 'warning'
  | 'disabled'
  | 'locked'
  | 'archived';
