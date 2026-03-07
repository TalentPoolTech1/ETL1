/**
 * Transformations Module Index
 * 
 * Central export point for all transformation-related utilities, types, and components.
 * Simplifies imports throughout the application.
 */

// ============ REGISTRY ============
export {
  TRANSFORM_REGISTRY,
  getTransform,
  getTransformsInCategory,
  getSupportedTransforms,
  isNativelySupported,
  type TransformCategory,
  type ErrorPolicy,
  type ParameterType,
  type ParameterDef,
  type TransformPrimitive,
} from '../registry/TransformRegistry';

// ============ INTERMEDIATE REPRESENTATION ============
export {
  createStep,
  createSequence,
  serializeSequence,
  deserializeSequence,
  validateStep,
  validateSequence,
  createVersionSnapshot,
  revertToVersion,
  diffVersions,
  type TransformStep,
  type TransformSequence,
  type TransformVersion,
  type TransformAuditEntry,
  type PreviewSample,
  type ErrorPolicy as IRErrorPolicy,
} from './ir';

// ============ CODE GENERATION ============
export {
  getCodeGenerator,
  compileStep,
  compileSequence,
  BaseCodeGenerator,
  SparkSQLGenerator,
  PostgreSQLGenerator,
  RedshiftCodeGenerator,
  type CodeGenerationResult,
  type CodeGenContext,
} from './codegen';

// ============ UI COMPONENTS ============
export { ParameterPanel, useParameterPanel, type ParameterPanelProps } from '../components/transformations/ParameterPanel';

export { ConditionBuilder, conditionToSQL, type ComplexCondition, type ConditionGroup, type ConditionClause } from '../components/transformations/ConditionBuilder';

export { PatternWizard, type PatternWizardResult } from '../components/transformations/PatternWizard';

export { TransformStepEditor, StepList, type TransformStepEditorProps } from '../components/transformations/TransformStepEditor';

// ============ UTILITIES ============

/**
 * Get all available transform categories
 */
export function getCategories(): string[] {
  return Array.from(new Set(Object.values(TRANSFORM_REGISTRY).map(t => t.category)));
}

/**
 * Check if two transform sequences are equivalent
 */
export function sequencesAreEqual(seq1: TransformSequence, seq2: TransformSequence): boolean {
  return JSON.stringify(seq1.steps) === JSON.stringify(seq2.steps);
}

/**
 * Count enabled steps in a sequence
 */
export function countEnabledSteps(sequence: TransformSequence): number {
  return sequence.steps.filter(s => s.enabled).length;
}

/**
 * Get all failed steps in validation
 */
export function getFailedStepsFromValidation(
  validation: ReturnType<typeof validateSequence>
): string[] {
  return Array.from(validation.errors.keys());
}

/**
 * Create an audit entry (for logging)
 */
export function createAuditEntry(
  sequenceId: string,
  versionId: string,
  action: 'CREATED' | 'MODIFIED' | 'APPLIED' | 'REVERTED' | 'DELETED',
  userId: string,
  changes?: any
): TransformAuditEntry {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    sequenceId,
    versionId,
    action,
    userId,
    timestamp: new Date(),
    changes,
  };
}
