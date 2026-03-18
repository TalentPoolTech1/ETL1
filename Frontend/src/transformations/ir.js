/**
 * Intermediate Representation (IR) Layer
 *
 * Provides engine-neutral serialization for transform sequences.
 * This is the format stored in the database and used for code generation.
 */
// ============ FACTORIES & UTILITIES ============
/**
 * Create a new transform step with sensible defaults
 */
export function createStep(type, params = {}, overrides) {
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
export function createSequence(columnId, columnName, pipelineId, datasetId, targetEngine) {
    const sequenceId = `seq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const versionId = `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    return {
        id: sequenceId,
        name: `Transform ${columnName}`,
        columnId,
        columnName,
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
export function serializeSequence(seq) {
    return JSON.stringify(seq, null, 2);
}
/**
 * Deserialize a sequence from JSON
 */
export function deserializeSequence(json) {
    const data = JSON.parse(json);
    // Reconstruct Date objects
    return {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        versions: (data.versions || []).map((v) => ({
            ...v,
            createdAt: new Date(v.createdAt),
        })),
    };
}
/**
 * Validate a step against a primitive definition
 */
export function validateStep(step, primitive) {
    const errors = [];
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
export function validateSequence(seq, registry) {
    const errors = new Map();
    for (const step of seq.steps) {
        if (!step.enabled)
            continue;
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
export function createVersionSnapshot(sequence, changeNote = '') {
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
export function revertToVersion(sequence, versionId) {
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
export function diffVersions(oldVersion, newVersion) {
    const oldCount = oldVersion.steps.filter(s => s.enabled).length;
    const newCount = newVersion.steps.filter(s => s.enabled).length;
    const added = newCount - oldCount;
    const verbSteps = newCount === 1 ? 'step' : 'steps';
    const verbChange = added > 0 ? `Added ${added} step(s)` : added < 0 ? `Removed ${Math.abs(added)} step(s)` : 'Modified steps';
    return `${newCount} ${verbSteps} total. ${verbChange}`;
}
