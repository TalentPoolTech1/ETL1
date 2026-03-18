import React, { useMemo } from 'react';
import { PushdownStrategyEditor } from '../../transformations/PushdownStrategyEditor';
import { useAppSelector } from '@/store/hooks';
import { TransformSequence } from '../../transformations/ir';

export function OptimizeSubTab() {
  const nodes = useAppSelector(s => s.pipeline.activePipeline?.nodes ?? []);

  const sequence: TransformSequence = useMemo(() => {
    if (!nodes || nodes.length === 0) {
      return { steps: [] };
    }
    return {
      steps: nodes.map((node: any, idx: number) => ({
        stepId: node.id ?? `step_${idx}`,
        operation: node.type ?? 'transform',
        sourceTechnology: node.config?.technology ?? undefined,
        config: node.config ?? {},
        outputSchema: node.config?.outputSchema ?? undefined,
        inputStepIds: idx > 0 ? [nodes[idx - 1].id ?? `step_${idx - 1}`] : [],
      })),
    };
  }, [nodes]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {nodes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
          <p>Add nodes to the pipeline canvas to enable optimization analysis.</p>
        </div>
      ) : (
        <PushdownStrategyEditor 
          sequence={sequence} 
        />
      )}
    </div>
  );
}
