import { jsx as _jsx } from "react/jsx-runtime";
import { useMemo } from 'react';
import { PushdownStrategyEditor } from '../../transformations/PushdownStrategyEditor';
import { useAppSelector } from '@/store/hooks';
export function OptimizeSubTab() {
    const nodes = useAppSelector(s => s.pipeline.activePipeline?.nodes ?? []);
    const sequence = useMemo(() => {
        if (!nodes || nodes.length === 0) {
            return { steps: [] };
        }
        return {
            steps: nodes.map((node, idx) => ({
                stepId: node.id ?? `step_${idx}`,
                operation: node.type ?? 'transform',
                sourceTechnology: node.config?.technology ?? undefined,
                config: node.config ?? {},
                outputSchema: node.config?.outputSchema ?? undefined,
                inputStepIds: idx > 0 ? [nodes[idx - 1].id ?? `step_${idx - 1}`] : [],
            })),
        };
    }, [nodes]);
    return (_jsx("div", { className: "flex-1 overflow-hidden flex flex-col", children: nodes.length === 0 ? (_jsx("div", { className: "flex-1 flex items-center justify-center text-slate-600 text-sm", children: _jsx("p", { children: "Add nodes to the pipeline canvas to enable optimization analysis." }) })) : (_jsx(PushdownStrategyEditor, { sequence: sequence })) }));
}
