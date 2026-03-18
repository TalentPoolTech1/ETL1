import React, { useEffect, useState, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { openTab } from '@/store/slices/tabsSlice';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import api from '@/services/api';
import type { PipelineRunSummary, RunStatus } from '@/types';

const STATUS_COLOR: Record<RunStatus, string> = {
  PENDING:              'bg-neutral-100 text-neutral-600',
  QUEUED:               'bg-blue-100 text-blue-700',
  RUNNING:              'bg-blue-100 text-blue-800',
  SUCCESS:              'bg-green-100 text-green-700',
  FAILED:               'bg-red-100 text-red-700',
  CANCELLED:            'bg-orange-100 text-orange-700',
  SKIPPED:              'bg-neutral-100 text-neutral-500',
  RETRYING:             'bg-yellow-100 text-yellow-700',
  TIMED_OUT:            'bg-red-200 text-red-900',
  PARTIALLY_COMPLETED:  'bg-amber-100 text-amber-700',
};

function fmtDuration(ms: number | null): string {
  if (ms === null) return '—';
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
  const nodes = useAppSelector(s => s.pipeline.nodes);

  const [runs, setRuns] = useState<PipelineRunSummary[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');

  const loadRuns = useCallback(async () => {
    if (!pipelineId) return;
    setLoadingRuns(true);
    try {
      const res = await api.getPipelineRuns({ pipelineId, pageSize: 5 });
      const data = res.data.data ?? res.data;
      setRuns(data.items ?? data ?? []);
    } catch {
      /* silently degrade — pipeline may have no runs yet */
    } finally {
      setLoadingRuns(false);
    }
  }, [pipelineId]);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  const handleRun = async () => {
    if (!pipelineId) return;
    try {
      await api.runPipeline(pipelineId);
      setTimeout(loadRuns, 1500);
    } catch (err: unknown) {
      alert((err as any)?.response?.data?.userMessage ?? 'Failed to trigger run');
    }
  };

  if (!pipeline) {
    return <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">Loading pipeline…</div>;
  }

  const nodeCount = Object.keys(nodes).length;
  const successCount = runs.filter(r => r.runStatus === 'SUCCESS').length;
  const successRate = runs.length ? Math.round((successCount / runs.length) * 100) : '—';

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input value={draftName} onChange={e => setDraftName(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <textarea value={draftDesc} onChange={e => setDraftDesc(e.target.value)}
                rows={2} className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setEditing(false)}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-neutral-900 truncate">{pipeline.name}</h2>
                <button onClick={() => { setDraftName(pipeline.name); setDraftDesc(pipeline.description); setEditing(true); }}
                  className="text-neutral-400 hover:text-neutral-600 text-xs">✎</button>
              </div>
              <p className="text-sm text-neutral-500 mt-0.5">{pipeline.description || <span className="italic">No description</span>}</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" onClick={handleRun}>▶ Run</Button>
          <Button size="sm" variant="ghost">Schedule</Button>
          <Button size="sm" variant="ghost">Clone</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Nodes',        value: nodeCount },
          { label: 'Success rate', value: `${successRate}%` },
          { label: 'Last run',     value: runs[0] ? fmtDatetime(runs[0].startDtm) : '—' },
          { label: 'Version',      value: `v${pipeline.version}` },
        ].map(stat => (
          <div key={stat.label} className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-neutral-900">{stat.value}</div>
            <div className="text-xs text-neutral-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent runs */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Recent runs</h3>
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                {['Run ID', 'Started', 'Duration', 'Status', 'Triggered by'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-neutral-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loadingRuns && (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-neutral-400 text-xs">Loading…</td></tr>
              )}
              {!loadingRuns && runs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-400 text-sm">No runs yet.</td></tr>
              )}
              {runs.map(run => (
                <tr key={run.pipelineRunId}
                  className="hover:bg-neutral-50 cursor-pointer"
                  onClick={() => dispatch(openTab({
                    id: `execution-${run.pipelineRunId}`,
                    type: 'execution',
                    objectId: run.pipelineRunId,
                    objectName: `Run: ${run.pipelineName}`,
                    unsaved: false, isDirty: false, executionKind: 'pipeline',
                  }))}
                >
                  <td className="px-4 py-2 font-mono text-xs text-primary-600">{run.pipelineRunId.slice(0, 8)}…</td>
                  <td className="px-4 py-2 text-neutral-600">{fmtDatetime(run.startDtm)}</td>
                  <td className="px-4 py-2 text-neutral-600">{fmtDuration(run.durationMs)}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[run.runStatus]}`}>
                      {run.runStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-neutral-500 capitalize">{run.triggerType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
