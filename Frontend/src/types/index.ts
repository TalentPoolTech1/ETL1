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
  type: 'source' | 'transform' | 'target' | 'join' | 'aggregate' | 'filter' | 'custom';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  config: Record<string, any>;
  inputs: Port[];
  outputs: Port[];
  version: number;
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

export interface Tab {
  id: string;
  type: 'pipeline' | 'orchestrator' | 'monitor' | 'execution' | 'table' | 'sql' | 'dashboard';
  objectId: string;
  objectName: string;
  unsaved: boolean;
  isDirty: boolean;
  /** For execution tabs: 'pipeline' | 'orchestrator' */
  executionKind?: 'pipeline' | 'orchestrator';
}

export type PipelineSubTab =
  | 'editor'
  | 'overview'
  | 'execution-history'
  | 'lineage'
  | 'permissions'
  | 'audit-logs'
  | 'execution';

export type OrchestratorSubTab =
  | 'editor'
  | 'overview'
  | 'execution-history'
  | 'permissions'
  | 'audit-logs'
  | 'execution';

export interface TreeNode {
  id: string;
  name: string;
  type: 'technology' | 'connection' | 'schema' | 'table' | 'column';
  icon?: string;
  children?: TreeNode[];
  metadata?: Record<string, any>;
  isExpanded?: boolean;
}

export interface DataPreviewRow {
  [key: string]: any;
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
