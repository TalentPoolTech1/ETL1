/**
 * Pipeline > Activity sub-tab
 * Wired to the audit logs API to show real pipeline activity.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import api from '@/services/api';

const EVENT_COLORS: Record<string, string> = {
  OPENED: 'text-slate-400', SAVED: 'text-emerald-400', VALIDATED: 'text-violet-400',
  EXECUTION_STARTED: 'text-blue-400', EXECUTION_SUCCEEDED: 'text-emerald-400',
  EXECUTION_FAILED: 'text-red-400', PUBLISHED: 'text-teal-400', PERMISSION_CHANGED: 'text-orange-400',
  PIPELINE_SAVED: 'text-emerald-400', RUN_STARTED: 'text-blue-400', RUN_COMPLETED: 'text-emerald-400',
  RUN_FAILED: 'text-red-400',
};

interface ActivityEvent {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  detail?: string;
}

export function PipelineActivitySubTab({ pipelineId }: { pipelineId: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const res = await api.getPipelineAuditLogs(pipelineId);
      const data = res.data?.data ?? res.data ?? [];
      const mapped = (Array.isArray(data) ? data : []).map((e: any) => ({
        id:        e.id ?? e.hist_id ?? crypto.randomUUID(),
        action:    e.action ?? e.hist_action_cd ?? 'UNKNOWN',
        actor:     e.user ?? e.hist_action_by ?? 'system',
        timestamp: e.timestamp ?? e.hist_action_dtm ?? '',
        detail:    e.summary ?? e.detail ?? '',
      }));
      setEvents(mapped);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-slate-400" />
        <span className="text-[12px] font-medium text-slate-300">Pipeline Activity</span>
        <button onClick={load} className="ml-auto text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 border border-slate-700 px-2 py-1 rounded transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center h-40 text-slate-600">
          <p className="text-sm">Loading activity…</p>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-slate-600">
          <Activity className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">No activity recorded yet for this pipeline.</p>
        </div>
      ) : (
        <div className="max-w-2xl space-y-0">
          {events.map(e => (
            <div key={e.id} className="flex items-start gap-3 py-2.5 border-b border-slate-800/50">
              <div className="text-[11px] text-slate-600 font-mono w-32 flex-shrink-0 mt-0.5">{e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}</div>
              <span className={`text-[12px] font-medium ${EVENT_COLORS[e.action] ?? 'text-slate-400'}`}>{(e.action ?? '').replace(/_/g, ' ')}</span>
              <span className="text-[12px] text-slate-400">{e.actor}</span>
              {e.detail && <span className="text-[11px] text-slate-600 ml-auto">{e.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
