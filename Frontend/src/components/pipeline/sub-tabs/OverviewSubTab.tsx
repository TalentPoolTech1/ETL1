/**
 * Pipeline > Overview sub-tab — dark theme
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { openTab } from '@/store/slices/tabsSlice';
import { Play, Clock, RefreshCw } from 'lucide-react';
import api from '@/services/api';
import type { PipelineRunSummary, RunStatus } from '@/types';

const STATUS_DOT: Record<RunStatus, string> = {
  PENDING:             'bg-slate-500',
  QUEUED:              'bg-blue-400',
  RUNNING:             'bg-blue-400 animate-pulse',
  SUCCESS:             'bg-emerald-400',
  FAILED:              'bg-red-400',
  CANCELLED:           'bg-orange-400',
  SKIPPED:             'bg-slate-500',
  RETRYING:            'bg-yellow-400',
  TIMED_OUT:           'bg-red-500',
  PARTIALLY_COMPLETED: 'bg-amber-400',
};

const STATUS_TEXT: Record<RunStatus, string> = {
  PENDING: 'text-slate-400', QUEUED: 'text-blue-300', RUNNING: 'text-blue-300',
  SUCCESS: 'text-emerald-300', FAILED: 'text-red-300', CANCELLED: 'text-orange-300',
  SKIPPED: 'text-slate-400', RETRYING: 'text-yellow-300', TIMED_OUT: 'text-red-400',
  PARTIALLY_COMPLETED: 'text-amber-300',
};

function fmtDuration(ms: number | null): string {
  if (ms == null) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function fmtDatetime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

interface Props { pipelineId: string; }

export function OverviewSubTab({ pipelineId }: Props) {
  const dispatch = useAppDispatch();
  const pipeline = useAppSelector(s => s.pipeline.activePipeline);
  const nodes    = useAppSelector(s => s.pipeline.nodes);

  const [runs,        setRuns]        = useState<PipelineRunSummary[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [running,     setRunning]     = useState(false);

  const loadRuns = useCallback(async () => {
    if (!pipelineId) return;
    setLoadingRuns(true);
    try {
      const res = await api.getPipelineRuns({ pipelineId, pageSize: 5 });
      const data = res.data?.data ?? res.data;
      setRuns(data?.items ?? data ?? []);
    } catch { /* degrade */ }
    finally { setLoadingRuns(false); }
  }, [pipelineId]);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  const handleRun = async () => {
    if (!pipelineId || running) return;
    setRunning(true);
    try {
      await api.runPipeline(pipelineId);
      setTimeout(loadRuns, 1500);
    } catch (err: unknown) {
      alert((err as any)?.response?.data?.userMessage ?? 'Failed to trigger run');
    } finally { setRunning(false); }
  };

  if (!pipeline) {
    return <div className="flex-1 flex items-center justify-center text-slate-500 text-[13px] bg-[#0d0f1a]">Loading pipeline…</div>;
  }

  const nodeCount   = Object.keys(nodes).length;
  const successCount = runs.filter(r => r.runStatus === 'SUCCESS').length;
  const successRate  = runs.length ? Math.round((successCount / runs.length) * 100) : null;

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-[#0d0f1a] space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-semibold text-slate-100 truncate">{pipeline.name}</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">{pipeline.description || <span className="italic">No description</span>}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={handleRun} disabled={running}
            className="h-8 px-3 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[12px] font-medium flex items-center gap-1.5 transition-colors">
            <Play className="w-3 h-3" />{running ? 'Queuing…' : 'Run'}
          </button>
          <button onClick={loadRuns}
            className="h-8 px-2.5 rounded border border-slate-700 bg-[#1e2035] text-slate-400 hover:text-slate-200 text-[12px] flex items-center gap-1 transition-colors">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Canvas nodes',  value: nodeCount },
          { label: 'Success rate',  value: successRate != null ? `${successRate}%` : '—' },
          { label: 'Last run',      value: runs[0] ? fmtDatetime(runs[0].startDtm) : '—' },
          { label: 'Version',       value: `v${pipeline.version}` },
        ].map(stat => (
          <div key={stat.label} className="bg-[#13152a] border border-slate-800 rounded-lg p-4">
            <div className="text-[20px] font-bold text-slate-100 truncate">{stat.value}</div>
            <div className="text-[11px] text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent runs */}
      <div>
        <h3 className="text-[12px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Recent runs</h3>
        <div className="bg-[#13152a] border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-800">
                {['Run ID', 'Started', 'Duration', 'Status', 'Triggered by'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loadingRuns && (
                <tr><td colSpan={5} className="px-4 py-5 text-center text-slate-600 text-[12px]">Loading…</td></tr>
              )}
              {!loadingRuns && runs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-600 text-[12px]">
                  <Clock className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  No runs yet.
                </td></tr>
              )}
              {runs.map(run => (
                <tr key={run.pipelineRunId}
                  className="hover:bg-[#1e2035] cursor-pointer transition-colors"
                  onClick={() => dispatch(openTab({
                    id: `execution-${run.pipelineRunId}`,
                    type: 'execution',
                    objectId: run.pipelineRunId,
                    objectName: `Run: ${run.pipelineName}`,
                    unsaved: false, isDirty: false, executionKind: 'pipeline',
                  }))}
                >
                  <td className="px-4 py-2.5 font-mono text-[11px] text-blue-400">{run.pipelineRunId.slice(0, 8)}…</td>
                  <td className="px-4 py-2.5 text-slate-400">{fmtDatetime(run.startDtm)}</td>
                  <td className="px-4 py-2.5 text-slate-400">{fmtDuration(run.durationMs)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${STATUS_TEXT[run.runStatus]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[run.runStatus]}`} />
                      {run.runStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 capitalize">{run.triggerType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
