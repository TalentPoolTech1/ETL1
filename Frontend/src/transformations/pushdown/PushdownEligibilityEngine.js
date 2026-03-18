/**
 * Pushdown Eligibility Engine
 *
 * Analyzes the pipeline graph to determine:
 * - Which segments are pushdown-eligible
 * - Lineage (SOURCE_DIRECT vs PYSPARK_DERIVED)
 * - Execution boundaries
 * - Cross-source joins
 */
import { isNativeFunctionSupport, getCapability } from './CapabilityMatrix';
/**
 * Pushdown Eligibility Engine
 */
export class PushdownEligibilityEngine {
    constructor() {
        Object.defineProperty(this, "sourceTablesMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "columnLineageMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "pysparkSteps", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "transformRegistry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.transformRegistry = new Map();
    }
    /**
     * Analyze a pipeline for pushdown eligibility
     */
    analyze(sourceTables, sequence, userExecutionPointChoices = new Map()) {
        // Initialize
        this.sourceTablesMap.clear();
        this.columnLineageMap.clear();
        this.pysparkSteps.clear();
        sourceTables.forEach(t => this.sourceTablesMap.set(t.id, t));
        // Initialize column lineage for all source columns
        sourceTables.forEach(table => {
            // Simplified: assume columns inherit from source table
            const colName = `${table.name}.*`;
            this.columnLineageMap.set(colName, {
                columnName: colName,
                origin: 'SOURCE_DIRECT',
                sourceTable: table,
                transformedAt: [],
            });
        });
        // Track user's execution point choices
        for (const [stepId, choice] of userExecutionPointChoices) {
            if (choice === 'pyspark') {
                this.pysparkSteps.add(stepId);
            }
        }
        // Propagate lineage breaks due to user PySpark choices
        this.propagateLineageBreaks(sequence);
        // Analyze each segment for eligibility
        const segments = this.analyzeSegments(sequence);
        // Detect execution boundaries
        const executionBoundaries = this.detectBoundaries(segments);
        // Detect cross-source joins
        const crossSourceJoins = this.detectCrossSourceJoins(sequence);
        return {
            segments,
            columnLineage: this.columnLineageMap,
            executionBoundaries,
            crossSourceJoins,
        };
    }
    /**
     * Check if two steps can be in the same pushdown segment
     */
    areInSameSegment(step1, step2) {
        // If either is forced to PySpark, they can't be in same segment
        if (this.pysparkSteps.has(step1.stepId) || this.pysparkSteps.has(step2.stepId)) {
            return false;
        }
        // Both must have the same source technology
        // (This is simplified; full implementation would track source per step)
        return true;
    }
    /**
     * Propagate lineage breaks from user PySpark selections
     */
    propagateLineageBreaks(sequence) {
        for (let i = 0; i < sequence.steps.length; i++) {
            const step = sequence.steps[i];
            // If this step is in PySpark, mark any columns it produces as PYSPARK_DERIVED
            if (this.pysparkSteps.has(step.stepId)) {
                // For simplicity, mark all columns as potentially derived
                for (const [colName, lineage] of this.columnLineageMap) {
                    if (lineage.transformedAt.includes(step.stepId)) {
                        lineage.origin = 'PYSPARK_DERIVED';
                        lineage.pysparkIntroducedAt = step.stepId;
                    }
                }
                // Force all downstream steps to PySpark if they reference PYSPARK_DERIVED columns
                for (let j = i + 1; j < sequence.steps.length; j++) {
                    const downstreamStep = sequence.steps[j];
                    const stepInputCols = this.getStepInputColumns(downstreamStep);
                    if (stepInputCols.some(col => {
                        const lineage = this.columnLineageMap.get(col);
                        return lineage?.origin === 'PYSPARK_DERIVED';
                    })) {
                        this.pysparkSteps.add(downstreamStep.stepId);
                    }
                }
            }
            // Track which columns this step transformed
            const outputCols = this.getStepOutputColumns(step);
            outputCols.forEach(col => {
                if (!this.columnLineageMap.has(col)) {
                    this.columnLineageMap.set(col, {
                        columnName: col,
                        origin: 'SOURCE_DIRECT',
                        transformedAt: [],
                    });
                }
                const lineage = this.columnLineageMap.get(col);
                lineage.transformedAt.push(step.stepId);
            });
        }
    }
    /**
     * Analyze each segment for pushdown eligibility
     */
    analyzeSegments(sequence) {
        const segments = [];
        let currentSegmentStart = 0;
        for (let i = 0; i < sequence.steps.length; i++) {
            const step = sequence.steps[i];
            const isLastStep = i === sequence.steps.length - 1;
            // Check if segment should continue or break
            const canContinueSegment = !this.pysparkSteps.has(step.stepId) && this.isStepEligibleForPushdown(step);
            if (!canContinueSegment || isLastStep) {
                // End current segment
                const segmentEnd = isLastStep && canContinueSegment ? i : i - 1;
                if (segmentEnd >= currentSegmentStart) {
                    const segEligibility = this.analyzeSegmentSteps(sequence.steps.slice(currentSegmentStart, segmentEnd + 1), currentSegmentStart, segmentEnd);
                    segments.push(segEligibility);
                }
                if (!canContinueSegment) {
                    // Start new segment from this step
                    currentSegmentStart = i;
                    if (isLastStep) {
                        segments.push(this.analyzeSegmentSteps([step], i, i));
                    }
                }
            }
        }
        return segments;
    }
    /**
     * Analyze a specific segment's eligibility
     */
    analyzeSegmentSteps(steps, startIdx, endIdx) {
        const segmentId = `segment_${startIdx}_${endIdx}`;
        const reasons = [];
        const ineligibilityReasons = [];
        let eligible = true;
        // Check if all steps are forced to PySpark
        const allForcedPySpark = steps.every(s => this.pysparkSteps.has(s.stepId));
        if (allForcedPySpark) {
            eligible = false;
            ineligibilityReasons.push('All steps in this segment are locked to PySpark');
        }
        // Check source technology homogeneity
        const sourceTechs = this.detectSourceTechnologies(steps);
        if (sourceTechs.length > 1) {
            eligible = false;
            ineligibilityReasons.push(`Mixed source technologies: ${sourceTechs.join(', ')}`);
        }
        else if (sourceTechs.length === 1) {
            reasons.push(`All tables use ${sourceTechs[0]}`);
        }
        // Check function support
        const tech = sourceTechs[0];
        if (tech && tech !== 'pyspark') {
            for (const step of steps) {
                if (!isNativeFunctionSupport(step.type, tech)) {
                    eligible = false;
                    const cap = getCapability(step.type, tech);
                    if (cap?.availability === 'alternative') {
                        ineligibilityReasons.push(`${step.type} is not natively supported in ${tech} (alternative available)`);
                    }
                    else {
                        ineligibilityReasons.push(`${step.type} is not supported in ${tech}`);
                    }
                }
            }
        }
        // Check for lineage breaks
        for (const step of steps) {
            const inputCols = this.getStepInputColumns(step);
            for (const col of inputCols) {
                const lineage = this.columnLineageMap.get(col);
                if (lineage?.origin === 'PYSPARK_DERIVED') {
                    eligible = false;
                    ineligibilityReasons.push(`Column "${col}" was computed by PySpark and cannot be used in pushdown`);
                }
            }
        }
        const affectedColumns = this.getSegmentColumns(steps);
        const suggestedExecutionPoint = eligible ? 'source' : 'forced_pyspark';
        return {
            segmentId,
            stepRange: `Step ${startIdx + 1}-${endIdx + 1}`,
            eligible: eligible && !allForcedPySpark,
            reasons,
            ineligibilityReasons: ineligibilityReasons.length > 0 ? ineligibilityReasons : undefined,
            ineligibilityType: this.determineIneligibilityType(steps),
            suggestedExecutionPoint,
            affectedColumns,
            sourceTechnologies: sourceTechs,
        };
    }
    /**
     * Check if a step is eligible for pushdown (ignoring segment context)
     */
    isStepEligibleForPushdown(step) {
        // Custom SQL might not be eligible; everything else depends on context
        return true;
    }
    /**
     * Detect source technologies used in a set of steps
     */
    detectSourceTechnologies(steps) {
        const techs = new Set();
        for (const table of this.sourceTablesMap.values()) {
            techs.add(table.technology);
        }
        return Array.from(techs);
    }
    /**
     * Get input columns for a step (simplified)
     */
    getStepInputColumns(step) {
        // Simplified: return all columns mentioned in params
        const cols = [];
        for (const val of Object.values(step.params)) {
            if (typeof val === 'string' && val.match(/^[a-zA-Z_]/)) {
                cols.push(val);
            }
        }
        return cols;
    }
    /**
     * Get output columns for a step (simplified)
     */
    getStepOutputColumns(step) {
        // In reality, this comes from transform metadata
        return this.getStepInputColumns(step);
    }
    /**
     * Get all columns touched by a segment
     */
    getSegmentColumns(steps) {
        const cols = new Set();
        for (const step of steps) {
            this.getStepInputColumns(step).forEach(c => cols.add(c));
            this.getStepOutputColumns(step).forEach(c => cols.add(c));
        }
        return Array.from(cols);
    }
    /**
     * Detect execution boundaries between segments
     */
    detectBoundaries(segments) {
        const boundaries = [];
        for (let i = 0; i < segments.length - 1; i++) {
            const current = segments[i];
            const next = segments[i + 1];
            if (current.sourceTechnologies[0] !== next.sourceTechnologies[0]) {
                boundaries.push({
                    before: current.stepRange,
                    after: next.stepRange,
                    reason: `Switching from ${current.sourceTechnologies[0]} to ${next.sourceTechnologies[0]} requires data movement`,
                });
            }
        }
        return boundaries;
    }
    /**
     * Detect cross-source joins
     */
    detectCrossSourceJoins(sequence) {
        const joins = [];
        // Simplified detection — would need join metadata in real implementation
        for (const step of sequence.steps) {
            if (step.type === 'join' || step.metadata?.label?.toLowerCase().includes('join')) {
                // Check the two sides of the join
                const tables = Array.from(this.sourceTablesMap.values());
                if (tables.length >= 2) {
                    const tech1 = tables[0].technology;
                    const tech2 = tables[1].technology;
                    if (tech1 !== tech2) {
                        joins.push({ stepId: step.stepId, tech1, tech2 });
                    }
                }
            }
        }
        return joins;
    }
    /**
     * Determine why a segment is ineligible
     */
    determineIneligibilityType(steps) {
        // Check for each issue type
        for (const step of steps) {
            if (step.type === 'join')
                return 'cross_source';
        }
        for (const col of this.columnLineageMap.values()) {
            if (col.origin === 'PYSPARK_DERIVED')
                return 'lineage_break';
        }
        const techs = this.detectSourceTechnologies(steps);
        if (techs.length > 1)
            return 'mixed_sources';
        return 'function_unsupported';
    }
}
/**
 * Helper function to create eligibility checker
 */
export function createEligibilityEngine() {
    return new PushdownEligibilityEngine();
}
