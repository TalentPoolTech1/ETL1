import React from 'react';

/**
 * Placeholder for the orchestrator DAG designer.
 * Will be replaced with the full orchestrator canvas implementation.
 */
export function OrchestratorEditorSubTab() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-neutral-50 gap-4 text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center text-3xl">
        🔗
      </div>
      <div>
        <h3 className="text-lg font-semibold text-neutral-800">Orchestrator Designer</h3>
        <p className="text-sm text-neutral-500 mt-1 max-w-sm">
          The orchestrator DAG editor is coming soon.
          It will let you sequence pipelines, set triggers, define dependencies, and configure retry policies.
        </p>
      </div>
    </div>
  );
}
