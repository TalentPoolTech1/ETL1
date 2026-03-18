/**
 * Orchestrator > Activity sub-tab
 */
import React from 'react';
import { Activity } from 'lucide-react';

export function OrchestratorActivitySubTab({ orchId }: { orchId: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-5">
      <Activity className="w-8 h-8 mb-2 opacity-30" />
      <p className="text-sm">No activity recorded yet for this orchestrator.</p>
    </div>
  );
}
