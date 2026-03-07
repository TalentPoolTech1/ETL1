/**
 * Execution Point State Management
 * 
 * Manages user's execution point choices per segment/step:
 * - Source DB (pushdown)
 * - PySpark (deliberate user choice)
 * - Forced PySpark (locked due to ineligibility)
 */

import { TransformSequence, TransformStep } from '../ir';
import {
  SegmentEligibility,
  ExecutionPoint,
  EligibilityAnalysis,
} from './PushdownEligibilityEngine';

/**
 * Execution point choice for a step or segment
 */
export interface ExecutionPointChoice {
  stepId: string;
  choice: ExecutionPoint;
  isUserChosen: boolean; // false = automatic/locked
  changedAt: Date;
  reason?: string; // e.g., "Function not supported in MySQL"
}

/**
 * Impact preview when switching execution point
 */
export interface ExecutionPointSwitchImpact {
  valid: boolean;
  warnings: string[];
  affectedSteps: string[]; // Steps that would be forced to PySpark
  affectedColumns: string[]; // Columns that would become PYSPARK_DERIVED
  dataMovementRequired: boolean;
  estimatedPerformanceImpact?: 'high' | 'medium' | 'low';
}

/**
 * Execution Point State Manager
 */
export class ExecutionPointStateManager {
  private choices: Map<string, ExecutionPointChoice> = new Map();
  private eligibilityAnalysis: EligibilityAnalysis | null = null;

  /**
   * Initialize state for a pipeline
   */
  public initialize(analysis: EligibilityAnalysis): void {
    this.eligibilityAnalysis = analysis;
    this.choices.clear();

    // Pre-populate with segment recommendations
    for (const segment of analysis.segments) {
      const choice: ExecutionPointChoice = {
        stepId: segment.segmentId,
        choice: segment.suggestedExecutionPoint,
        isUserChosen: segment.suggestedExecutionPoint !== 'forced_pyspark',
        changedAt: new Date(),
        reason: segment.suggestedExecutionPoint === 'forced_pyspark'
          ? segment.ineligibilityReasons?.[0]
          : undefined,
      };
      this.choices.set(segment.segmentId, choice);
    }
  }

  /**
   * Get current execution point for a step/segment
   */
  public getExecutionPoint(stepId: string): ExecutionPoint | null {
    return this.choices.get(stepId)?.choice ?? null;
  }

  /**
   * Get all current choices
   */
  public getAllChoices(): Map<string, ExecutionPointChoice> {
    return new Map(this.choices);
  }

  /**
   * Validate and preview a switch before applying
   */
  public previewSwitch(
    stepId: string,
    newExecutionPoint: ExecutionPoint,
    sequence: TransformSequence
  ): ExecutionPointSwitchImpact {
    if (!this.eligibilityAnalysis) {
      return { valid: false, warnings: ['No eligibility analysis available'], affectedSteps: [], affectedColumns: [] };
    }

    const currentChoice = this.choices.get(stepId);
    if (!currentChoice) {
      return { valid: false, warnings: ['Step not found'], affectedSteps: [], affectedColumns: [] };
    }

    const warnings: string[] = [];
    const affectedSteps: string[] = [];
    const affectedColumns: string[] = [];

    // Check if switching away from forced PySpark
    if (currentChoice.choice === 'forced_pyspark' && newExecutionPoint !== 'forced_pyspark') {
      warnings.push('Cannot override forced PySpark execution');
      return {
        valid: false,
        warnings,
        affectedSteps: [],
        affectedColumns: [],
        dataMovementRequired: false,
      };
    }

    // If switching TO PySpark
    if (newExecutionPoint === 'pyspark' && currentChoice.choice !== 'pyspark') {
      warnings.push('This step and all dependent steps will now execute in PySpark');
      affectedSteps.push(stepId);

      // Find downstream steps that depend on this one
      const stepIdx = sequence.steps.findIndex(s => s.stepId === stepId);
      if (stepIdx >= 0) {
        for (let i = stepIdx + 1; i < sequence.steps.length; i++) {
          const downstreamStep = sequence.steps[i];
          const downstreamChoice = this.choices.get(downstreamStep.stepId);
          if (downstreamChoice?.choice === 'source') {
            // Could be affected
            affectedSteps.push(downstreamStep.stepId);
          }
        }
      }
    }

    // If switching FROM PySpark back to source
    if (newExecutionPoint === 'source' && currentChoice.choice === 'pyspark') {
      // This is allowed but may lose benefits
      warnings.push('Switching back to source execution may cause lineage breaks if downstream steps reference this output');
    }

    // Check for cross-source boundary
    const segment = this.eligibilityAnalysis.segments.find(s => s.segmentId === stepId);
    if (newExecutionPoint === 'source' && segment && segment.sourceTechnologies.length > 1) {
      warnings.push('Cannot push down across multiple source technologies');
      return {
        valid: false,
        warnings,
        affectedSteps: [],
        affectedColumns: [],
        dataMovementRequired: false,
      };
    }

    const dataMovementRequired = newExecutionPoint === 'pyspark' && currentChoice.choice === 'source';
    const estimatedPerformanceImpact = this.estimatePerformanceImpact(stepId, newExecutionPoint, affectedSteps.length);

    return {
      valid: true,
      warnings,
      affectedSteps,
      affectedColumns,
      dataMovementRequired,
      estimatedPerformanceImpact,
    };
  }

  /**
   * Apply an execution point change
   */
  public applyExecutionPointChange(
    stepId: string,
    newExecutionPoint: ExecutionPoint,
    sequence: TransformSequence
  ): { success: boolean; errors: string[] } {
    const impact = this.previewSwitch(stepId, newExecutionPoint, sequence);

    if (!impact.valid) {
      return {
        success: false,
        errors: impact.warnings,
      };
    }

    // Apply change to this step
    const currentChoice = this.choices.get(stepId);
    if (currentChoice) {
      currentChoice.choice = newExecutionPoint;
      currentChoice.isUserChosen = true;
      currentChoice.changedAt = new Date();
    }

    // Cascade to affected steps if switching to PySpark
    if (newExecutionPoint === 'pyspark') {
      const stepIdx = sequence.steps.findIndex(s => s.stepId === stepId);
      if (stepIdx >= 0) {
        for (let i = stepIdx + 1; i < sequence.steps.length; i++) {
          const downstreamStep = sequence.steps[i];
          const downstreamChoice = this.choices.get(downstreamStep.stepId);
          if (downstreamChoice && downstreamChoice.choice === 'source') {
            // Mark as affected but don't auto-change (user decision)
            // Just track that it could be affected
            impact.affectedSteps.push(downstreamStep.stepId);
          }
        }
      }
    }

    return { success: true, errors: [] };
  }

  /**
   * Get execution boundary points
   */
  public getBoundaries(sequence: TransformSequence): Array<{
    position: number; // step index after which boundary occurs
    from: ExecutionPoint;
    to: ExecutionPoint;
    reason: string;
  }> {
    const boundaries: Array<{
      position: number;
      from: ExecutionPoint;
      to: ExecutionPoint;
      reason: string;
    }> = [];

    for (let i = 0; i < sequence.steps.length - 1; i++) {
      const currentStep = sequence.steps[i];
      const nextStep = sequence.steps[i + 1];

      const currentExec = this.getExecutionPoint(currentStep.stepId) ?? 'pyspark';
      const nextExec = this.getExecutionPoint(nextStep.stepId) ?? 'pyspark';

      if (currentExec !== nextExec) {
        const reasons = [];
        if (currentExec === 'source' && nextExec === 'pyspark') {
          reasons.push('Switching to PySpark (user choice)');
        } else if (currentExec === 'pyspark' && nextExec === 'source') {
          reasons.push('Returning to source DB execution');
        } else if (nextExec === 'forced_pyspark') {
          reasons.push('Forced to PySpark (ineligible)');
        }

        boundaries.push({
          position: i,
          from: currentExec,
          to: nextExec,
          reason: reasons.join('; '),
        });
      }
    }

    return boundaries;
  }

  /**
   * Estimate performance impact of switching segments
   */
  private estimatePerformanceImpact(
    stepId: string,
    newExecutionPoint: ExecutionPoint,
    affectedStepCount: number
  ): 'high' | 'medium' | 'low' {
    if (newExecutionPoint === 'pyspark') {
      if (affectedStepCount > 5) return 'high';
      if (affectedStepCount > 2) return 'medium';
      return 'low';
    }
    return 'low';
  }

  /**
   * Get segment execution status summary
   */
  public getSummary(): {
    totalSteps: number;
    pushdownCount: number;
    pysparkCount: number;
    forcedCount: number;
  } {
    let pushdownCount = 0;
    let pysparkCount = 0;
    let forcedCount = 0;

    for (const choice of this.choices.values()) {
      if (choice.choice === 'source') pushdownCount++;
      else if (choice.choice === 'pyspark' && choice.isUserChosen) pysparkCount++;
      else if (choice.choice === 'forced_pyspark') forcedCount++;
    }

    return {
      totalSteps: this.choices.size,
      pushdownCount,
      pysparkCount,
      forcedCount,
    };
  }

  /**
   * Export execution point configuration for code generation
   */
  public exportConfiguration(): Record<string, ExecutionPoint> {
    const config: Record<string, ExecutionPoint> = {};
    for (const [stepId, choice] of this.choices) {
      config[stepId] = choice.choice;
    }
    return config;
  }

  /**
   * Import execution point configuration (e.g., from saved pipeline)
   */
  public importConfiguration(config: Record<string, ExecutionPoint>): void {
    for (const [stepId, executionPoint] of Object.entries(config)) {
      const choice = this.choices.get(stepId);
      if (choice) {
        choice.choice = executionPoint;
        choice.isUserChosen = true;
        choice.changedAt = new Date();
      }
    }
  }

  /**
   * Reset all user choices to automatic recommendations
   */
  public resetToDefaults(analysis: EligibilityAnalysis): void {
    this.initialize(analysis);
  }
}

/**
 * Helper function to create state manager
 */
export function createExecutionPointStateManager(): ExecutionPointStateManager {
  return new ExecutionPointStateManager();
}
