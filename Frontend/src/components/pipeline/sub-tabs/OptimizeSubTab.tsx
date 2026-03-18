import React, { useMemo } from 'react';
import { PushdownStrategyEditor } from '../../transformations/PushdownStrategyEditor';
import { useAppSelector } from '@/store/hooks';
import { TransformSequence } from '@/transformations/ir';

export function OptimizeSubTab() {
  const nodes = useAppSelector(s => s.pipeline.activePipeline?.nodes ?? []);

  const sequence: TransformSequence = useMemo(() => {
    return {
      id: 'optimize-sequence',
      name: 'Optimization Sequence',
      columnId: 'pipeline',
      columnName: 'pipeline',
      targetEngine: 'spark',
      steps: nodes.map((node: any, idx: number) => ({
        stepId: node.id ?? `step_${idx}`,
        type: node.type ?? 'transform',
        params: node.config ?? {},
        enabled: true,
        onError: 'RETURN_NULL' as const,
      })),
      pipelineId: 'pipeline',
      datasetId: 'dataset',
      author: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      currentVersionId: 'v1',
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
          sourceTables={[]}
        />
      )}
    </div>
  );
}
