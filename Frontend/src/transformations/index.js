/**
 * Transformations Module Index
 *
 * Central export point for all transformation-related utilities, types, and components.
 * Simplifies imports throughout the application.
 */
// ============ REGISTRY ============
export { TRANSFORM_REGISTRY, getTransform, getTransformsInCategory, getSupportedTransforms, isNativelySupported, } from '../registry/TransformRegistry';
// ============ INTERMEDIATE REPRESENTATION ============
export { createStep, createSequence, serializeSequence, deserializeSequence, validateStep, validateSequence, createVersionSnapshot, revertToVersion, diffVersions, } from './ir';
// ============ CODE GENERATION ============
export { getCodeGenerator, compileStep, compileSequence, BaseCodeGenerator, SparkSQLGenerator, PostgreSQLGenerator, RedshiftCodeGenerator, } from './codegen';
// ============ UI COMPONENTS ============
export { ParameterPanel, useParameterPanel } from '../components/transformations/ParameterPanel';
export { ConditionBuilder, conditionToSQL } from '../components/transformations/ConditionBuilder';
export { PatternWizard } from '../components/transformations/PatternWizard';
export { TransformStepEditor, StepList } from '../components/transformations/TransformStepEditor';
// ============ UTILITIES ============
/**
 * Get all available transform categories
 */
export function getCategories() {
    return Array.from(new Set(Object.values(TRANSFORM_REGISTRY).map(t => t.category)));
}
/**
 * Check if two transform sequences are equivalent
 */
export function sequencesAreEqual(seq1, seq2) {
    return JSON.stringify(seq1.steps) === JSON.stringify(seq2.steps);
}
/**
 * Count enabled steps in a sequence
 */
export function countEnabledSteps(sequence) {
    return sequence.steps.filter(s => s.enabled).length;
}
/**
 * Get all failed steps in validation
 */
export function getFailedStepsFromValidation(validation) {
    return Array.from(validation.errors.keys());
}
/**
 * Create an audit entry (for logging)
 */
export function createAuditEntry(sequenceId, versionId, action, userId, changes) {
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
