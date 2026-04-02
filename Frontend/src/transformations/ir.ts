/**
 * Intermediate Representation (IR) Layer
 * 
 * Provides engine-neutral serialization for transform sequences.
 * This is the format stored in the database and used for code generation.
 */

import { TransformPrimitive } from '../registry/TransformRegistry';

/**
 * Error handling policy for a transformation step
 */
export type ErrorPolicy = 'FAIL' | 'RETURN_NULL' | 'USE_DEFAULT';

/**
 * Single transformation step in a sequence
 */
export interface TransformStep {
  stepId: string; // UUID, unique within the sequence
  type: string; // Reference to TransformRegistry ID (e.g., 'to_number')
  params: Record<string, any>; // Configuration for this step
  enabled: boolean; // If false, excluded from execution
  onError: ErrorPolicy; // How to handle failures
  defaultValue?: any; // Value to use if RETURN_NULL policy
  metadata?: {
    label?: string; // User-provided label for this step
    description?: string;
    executionOrder?: number; // Position in the chain
    lineNumber?: number; // For error reporting
  };
  children?: TransformStep[]; // Nested steps (for blocks, conditionals)
}

/**
 * Root sequence—represents the entire transformation for a column
 */
export interface TransformSequence {
  id: string; // UUID, unique across the platform
  name: string; // User-friendly name
  description?: string;
  enabled?: boolean;

  // Which column this reads from and writes to
  columnId: string; // ID of the output column in the dataset
  columnName: string; // Output/display column name
  sourceColumn?: string; // Upstream input column name

  // Target engine(s) for code generation
  targetEngine: 'spark' | 'postgresql' | 'redshift';

  // Steps
  steps: TransformStep[];

  // Metadata
  pipelineId: string; // Which pipeline this belongs to
  datasetId: string; // Which dataset/table this operates on
  author: string; // User who created it
  createdAt: Date;
  updatedAt: Date;

  // Versioning
  currentVersionId: string; // UUID of the current version
  versions?: TransformVersion[];
}

/**
 * Immutable version snapshot
 */
export interface TransformVersion {
  versionId: string; // UUID
  sequenceId: string; // Reference back to parent
  versionNumber: number; // 1, 2, 3...
  name: string;
  steps: TransformStep[]; // Full copy of steps at this version
  author: string;
  createdAt: Date;
  changeNote?: string; // User-provided change description
  previewSample?: PreviewSample; // Sample data from when this was saved
  diffSummary?: string; // Human-readable summary of changes from previous version
}

/**
 * Sample data for preview functionality
 */
export interface PreviewSample {
  rowCount: number;
  sampleType: 'FIRST' | 'RANDOM' | 'FILTERED';
  sampleFilter?: string; // SQL WHERE clause if filtered
  rows: Array<{
    rowId: number;
    original: Record<string, any>;
    afterStep: Record<string, TransformStep>; // Result after each step
    final: any; // Final transformed value
  }>;
  executionTime: number; // Milliseconds
}

/**
 * Audit record—tracks who did what and when
 */
export interface TransformAuditEntry {
  id: string;
  sequenceId: string;
  versionId: string;
  action: 'CREATED' | 'MODIFIED' | 'APPLIED' | 'REVERTED' | 'DELETED' | 'PREVIEWED';
  userId: string;
  timestamp: Date;
  changes?: {
    added?: TransformStep[];
    removed?: TransformStep[];
    modified?: TransformStep[];
  };
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
  };
}

// ============ FACTORIES & UTILITIES ============

/**
 * Create a new transform step with sensible defaults
 */
export function createStep(
  type: string,
  params: Record<string, any> = {},
  overrides?: Partial<TransformStep>
): TransformStep {
  return {
    stepId: crypto.getRandomValues(new Uint8Array(16)).toString(),
    type,
    params,
    enabled: true,
    onError: 'RETURN_NULL',
    metadata: {
      executionOrder: 0,
    },
    ...overrides,
  };
}

/**
 * Create a new sequence
 */
export function createSequence(
  columnId: string,
  columnName: string,
  pipelineId: string,
  datasetId: string,
  targetEngine: 'spark' | 'postgresql' | 'redshift'
): TransformSequence {
  const sequenceId = `seq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const versionId = `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  return {
    id: sequenceId,
    name: `Transform ${columnName}`,
    enabled: true,
    columnId,
    columnName,
    sourceColumn: columnName,
    targetEngine,
    steps: [],
    pipelineId,
    datasetId,
    author: 'system', // Should be set by caller
    createdAt: new Date(),
    updatedAt: new Date(),
    currentVersionId: versionId,
    versions: [],
  };
}

/**
 * Serialize a sequence to JSON (for storage)
 */
export function serializeSequence(seq: TransformSequence): string {
  return JSON.stringify(seq, null, 2);
}

/**
 * Deserialize a sequence from JSON
 */
export function deserializeSequence(json: string): TransformSequence {
  const data = JSON.parse(json);
  // Reconstruct Date objects
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    versions: (data.versions || []).map((v: any) => ({
      ...v,
      createdAt: new Date(v.createdAt),
    })),
  };
}

/**
 * Validate a step against a primitive definition
 */
export function validateStep(step: TransformStep, primitive: TransformPrimitive): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check all required parameters are present
  for (const paramDef of primitive.parameters) {
    if (paramDef.required && !(paramDef.id in step.params)) {
      errors.push(`Missing required parameter: ${paramDef.label}`);
    }
  }

  // Run custom validators
  for (const paramDef of primitive.parameters) {
    if (paramDef.id in step.params && paramDef.validation) {
      const result = paramDef.validation(step.params[paramDef.id]);
      if (!result.valid && result.error) {
        errors.push(`${paramDef.label}: ${result.error}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a sequence
 */
export function validateSequence(
  seq: TransformSequence,
  registry: Record<string, TransformPrimitive>
): { valid: boolean; errors: Map<string, string[]> } {
  const errors = new Map<string, string[]>();

  for (const step of seq.steps) {
    if (!step.enabled) continue;

    const primitive = registry[step.type];
    if (!primitive) {
      errors.set(step.stepId, [`Unknown step type: ${step.type}`]);
      continue;
    }

    const result = validateStep(step, primitive);
    if (!result.valid) {
      errors.set(step.stepId, result.errors);
    }
  }

  return {
    valid: errors.size === 0,
    errors,
  };
}

/**
 * Create a version snapshot (called when user clicks Save)
 */
export function createVersionSnapshot(
  sequence: TransformSequence,
  changeNote: string = ''
): TransformVersion {
  const versionNumber = (sequence.versions?.length || 0) + 1;
  const versionId = `v${versionNumber}_${Date.now()}`;

  return {
    versionId,
    sequenceId: sequence.id,
    versionNumber,
    name: sequence.name,
    steps: JSON.parse(JSON.stringify(sequence.steps)), // Deep copy
    author: sequence.author,
    createdAt: new Date(),
    changeNote,
  };
}

/**
 * Revert sequence to a specific version
 */
export function revertToVersion(sequence: TransformSequence, versionId: string): TransformSequence {
  const version = sequence.versions?.find(v => v.versionId === versionId);
  if (!version) {
    throw new Error(`Version not found: ${versionId}`);
  }

  return {
    ...sequence,
    steps: JSON.parse(JSON.stringify(version.steps)), // Deep copy
    currentVersionId: versionId,
    updatedAt: new Date(),
  };
}

/**
 * Diff two versions to produce a summary
 */
export function diffVersions(oldVersion: TransformVersion, newVersion: TransformVersion): string {
  const oldCount = oldVersion.steps.filter(s => s.enabled).length;
  const newCount = newVersion.steps.filter(s => s.enabled).length;
  const added = newCount - oldCount;
  const verbSteps = newCount === 1 ? 'step' : 'steps';
  const verbChange = added > 0 ? `Added ${added} step(s)` : added < 0 ? `Removed ${Math.abs(added)} step(s)` : 'Modified steps';

  return `${newCount} ${verbSteps} total. ${verbChange}`;
}
