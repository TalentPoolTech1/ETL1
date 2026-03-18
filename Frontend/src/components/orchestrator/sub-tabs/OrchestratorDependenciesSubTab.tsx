/**
 * Orchestrator > Dependencies sub-tab
 */
import React from 'react';
import { Workflow, GitMerge, ArrowRight, ArrowLeft } from 'lucide-react';

export function OrchestratorDependenciesSubTab({ orchId }: { orchId: string }) {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
        <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">
            <ArrowRight className="w-3.5 h-3.5 text-purple-400" /> Pipelines Invoked
          </div>
          <p className="text-[12px] text-slate-600">No pipeline invocations configured.</p>
        </div>
        <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" /> Parent Orchestrators
          </div>
          <p className="text-[12px] text-slate-600">Not invoked by any other orchestrators.</p>
        </div>
      </div>
      <p className="text-[11px] text-slate-600 mt-4">Dependencies are derived from the orchestrator designer. Add pipeline nodes to see them here.</p>
    </div>
  );
}
