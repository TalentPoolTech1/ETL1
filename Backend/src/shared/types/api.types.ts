// ─── Shared API Types ──────────────────────────────────────────────────────────
// These types are shared between the backend API and the React frontend.
// Import from this file in the frontend to stay in sync with the API contract.

import type { PipelineDefinition, TechnologyType } from '../../codegen/core/types/pipeline.types';
import type { GeneratedArtifact, GenerationOptions } from '../../codegen/core/interfaces/engine.interfaces';

export type { PipelineDefinition, PipelineNode, NodeType, TechnologyType, SparkVersion } from '../../codegen/core/types/pipeline.types';
export type { GeneratedArtifact, ValidationResult, GenerationOptions, CodeFile } from '../../codegen/core/interfaces/engine.interfaces';

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data?: T;
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
  requestId?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Pipeline API ─────────────────────────────────────────────────────────────

export interface PipelineSummary {
  id: string;
  name: string;
  version: string;
  description: string | null;
  technology: string;
  sparkVersion: string | null;
  tags: Record<string, string> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineListResponse {
  rows: PipelineSummary[];
  total: number;
}

export interface ProjectHierarchyNode {
  id: string;
  name: string;
  type: 'PROJECT' | 'FOLDER' | 'PIPELINE' | 'ORCHESTRATOR';
  children?: ProjectHierarchyNode[];
}

export interface PipelineRun {
  runId: string;
  pipelineId: string;
  versionId?: string | null;
  status: string;
  triggerType: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export interface NodeRun {
  nodeRunId: string;
  pipelineRunId: string;
  nodeId: string;
  status: string;
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface GenerateRequest {
  options?: GenerationOptions;
}

export interface GenerateResponse {
  artifactId: string;
  artifact: GeneratedArtifact;
}

// ─── Artifact API ─────────────────────────────────────────────────────────────

export interface ArtifactSummary {
  id: string;
  pipelineId: string;
  pipelineVersion: string;
  technology: string;
  sparkVersion: string | null;
  warningCount: number;
  errorCount: number;
  generatedBy: string | null;
  generatedAt: string;
}

// ─── Node Template API ────────────────────────────────────────────────────────

export interface NodeTemplate {
  id: string;
  name: string;
  category: string | null;
  subType: string | null;
  technology: string | null;
  description: string | null;
  configTemplate: Record<string, unknown>;
  tags: Record<string, string> | null;
  isPublic: boolean;
  createdAt: string;
}

// ─── Codegen Preview API ──────────────────────────────────────────────────────

export interface PreviewRequest {
  pipeline: PipelineDefinition;
  options?: GenerationOptions;
}

export interface PreviewResponse {
  preview: string;
  language: string;
  warnings: Array<{ code: string; message: string; severity: string }>;
}

// ─── Technology Metadata ──────────────────────────────────────────────────────

export interface TechnologyInfo {
  id: TechnologyType;
  label: string;
  language: string;
  description: string;
  supportedVersions: string[];
  features: string[];
}

export const TECHNOLOGY_INFO: TechnologyInfo[] = [
  {
    id: 'pyspark',
    label: 'PySpark',
    language: 'Python',
    description: 'Apache Spark with Python API',
    supportedVersions: ['3.1', '3.2', '3.3', '3.4', '3.5'],
    features: ['Delta Lake', 'Iceberg', 'Hudi', 'Kafka', 'JDBC', 'Streaming'],
  },
  {
    id: 'scala-spark',
    label: 'Scala Spark',
    language: 'Scala',
    description: 'Apache Spark with Scala API',
    supportedVersions: ['3.2', '3.3', '3.4', '3.5'],
    features: ['Delta Lake', 'Iceberg', 'Kafka', 'JDBC'],
  },
];
