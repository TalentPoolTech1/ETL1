/**
 * usePushdownStrategy Hook
 *
 * Complete state management for pushdown strategy in a pipeline.
 * Integrates eligibility engine, execution point state, and function filtering.
 */
import { useCallback, useState, useMemo } from 'react';
import { PushdownEligibilityEngine, } from './PushdownEligibilityEngine';
import { ExecutionPointStateManager, } from './ExecutionPointState';
import { FunctionAvailabilityFilter, } from './FunctionAvailabilityFilter';
/**
 * Hook for managing pushdown strategy
 */
export function usePushdownStrategy() {
    const [state, setState] = useState({
        analysis: null,
        executionPoints: new Map(),
        functionPalettes: new Map(),
        isAnalyzing: false,
        isValid: false,
    });
    // Create managers
    const eligibilityEngine = useMemo(() => new PushdownEligibilityEngine(), []);
    const executionPointManager = useMemo(() => new ExecutionPointStateManager(), []);
    const functionFilter = useMemo(() => new FunctionAvailabilityFilter(), []);
    /**
     * Analyze pipeline for pushdown eligibility
     */
    const analyzeEligibility = useCallback(async (sourceTables, sequence) => {
        setState(prev => ({ ...prev, isAnalyzing: true, errorMessage: undefined }));
        try {
            const analysis = eligibilityEngine.analyze(sourceTables, sequence);
            executionPointManager.initialize(analysis);
            // Build function palettes for each step
            const palettes = new Map();
            for (const step of sequence.steps) {
                const execPoint = executionPointManager.getExecutionPoint(step.stepId) ?? 'pyspark';
                const tech = sourceTables[0]?.technology ?? 'pyspark';
                const palette = functionFilter.filterFunctions(tech, execPoint);
                palettes.set(step.stepId, palette);
            }
            setState({
                analysis,
                executionPoints: new Map(executionPointManager.getAllChoices()),
                functionPalettes: palettes,
                isAnalyzing: false,
                isValid: true,
            });
        }
        catch (error) {
            setState(prev => ({
                ...prev,
                isAnalyzing: false,
                isValid: false,
                errorMessage: error instanceof Error ? error.message : 'Analysis failed',
            }));
        }
    }, [eligibilityEngine, executionPointManager, functionFilter]);
    /**
     * Change execution point for a step
     */
    const changeExecutionPoint = useCallback((stepId, newPoint) => {
        if (!state.analysis)
            return;
        const result = executionPointManager.applyExecutionPointChange(stepId, newPoint, { steps: [] } // Simplified; would need actual sequence
        );
        if (result.success) {
            // Update execution points and invalidate function palettes
            setState(prev => ({
                ...prev,
                executionPoints: new Map(executionPointManager.getAllChoices()),
                isValid: false, // Revalidate on next analysis
            }));
        }
    }, [state.analysis, executionPointManager]);
    /**
     * Get function palette for a step
     */
    const getFunctionPalette = useCallback((stepId) => {
        return state.functionPalettes.get(stepId) ?? null;
    }, [state.functionPalettes]);
    /**
     * Check if pipeline has issues
     */
    const hasIssues = useCallback(() => {
        if (!state.analysis)
            return false;
        return state.analysis.segments.some(seg => !seg.eligible || (seg.ineligibilityReasons && seg.ineligibilityReasons.length > 0));
    }, [state.analysis]);
    /**
     * Get total issue count
     */
    const getIssueCount = useCallback(() => {
        if (!state.analysis)
            return 0;
        return state.analysis.segments.reduce((count, seg) => {
            return count + (seg.ineligibilityReasons?.length ?? 0);
        }, 0);
    }, [state.analysis]);
    /**
     * Export strategy configuration
     */
    const exportStrategy = useCallback(() => {
        const executionPointsRecord = {};
        for (const [stepId, choice] of state.executionPoints) {
            executionPointsRecord[stepId] = choice.choice ?? 'pyspark';
        }
        const functionAvailability = {};
        for (const [stepId, palette] of state.functionPalettes) {
            functionAvailability[stepId] = { palette };
        }
        return {
            analysis: state.analysis,
            executionPoints: executionPointsRecord,
            functionAvailability,
        };
    }, [state.analysis, state.executionPoints, state.functionPalettes]);
    /**
     * Import strategy configuration
     */
    const importStrategy = useCallback((config) => {
        const points = new Map();
        for (const [stepId, point] of Object.entries(config.executionPoints)) {
            points.set(stepId, point);
        }
        setState(prev => ({
            ...prev,
            analysis: config.analysis,
            executionPoints: points,
            isValid: true,
        }));
    }, []);
    /**
     * Reset to initial state
     */
    const reset = useCallback(() => {
        setState({
            analysis: null,
            executionPoints: new Map(),
            functionPalettes: new Map(),
            isAnalyzing: false,
            isValid: false,
        });
    }, []);
    return {
        // State
        state,
        // Actions
        analyzeEligibility,
        changeExecutionPoint,
        getFunctionPalette,
        hasIssues,
        getIssueCount,
        exportStrategy,
        importStrategy,
        reset,
        // Managers
        eligibilityEngine,
        executionPointManager,
        functionFilter,
    };
}
export default usePushdownStrategy;
