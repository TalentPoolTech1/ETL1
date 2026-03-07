import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { updateNode } from '@/store/slices/pipelineSlice';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';

const RUN_STATUS_COLOR: Record<string, string> = {
  success: 'bg-success-100 text-success-800',
  failed:  'bg-danger-100  text-danger-800',
  running: 'bg-primary-100 text-primary-800',
  pending: 'bg-neutral-100 text-neutral-600',
};

// Placeholder recent-runs row
interface RunRow { id: string; start: string; duration: string; status: string; triggeredBy: string; }

const MOCK_RUNS: RunRow[] = [
  { id: 'run-001', start: '2026-03-02 14:22', duration: '3m 12s', status: 'success',  triggeredBy: 'schedule' },
  { id: 'run-002', start: '2026-03-02 10:05', duration: '2m 58s', status: 'failed',   triggeredBy: 'manual'   },
  { id: 'run-003', start: '2026-03-01 22:00', duration: '3m 04s', status: 'success',  triggeredBy: 'schedule' },
  { id: 'run-004', start: '2026-03-01 18:30', duration: '1m 44s', status: 'success',  triggeredBy: 'api'      },
  { id: 'run-005', start: '2026-03-01 10:00', duration: '—',      status: 'pending',  triggeredBy: 'manual'   },
];

export function OverviewSubTab() {
  const pipeline = useAppSelector(s => s.pipeline.activePipeline);
  const nodes    = useAppSelector(s => s.pipeline.nodes);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(pipeline?.name ?? '');
  const [draftDesc, setDraftDesc] = useState(pipeline?.description ?? '');

  if (!pipeline) {
    return <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">No pipeline loaded.</div>;
  }

  const successRate = Math.round((MOCK_RUNS.filter(r => r.status === 'success').length / MOCK_RUNS.length) * 100);
  const nodeCount   = Object.keys(nodes).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <Input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder="Pipeline name"
                className="text-xl font-semibold"
              />
              <textarea
                value={draftDesc}
                onChange={e => setDraftDesc(e.target.value)}
                placeholder="Description"
                rows={2}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
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
          <Button size="sm">▶ Run</Button>
          <Button size="sm" variant="ghost">Schedule</Button>
          <Button size="sm" variant="ghost">Clone</Button>
          <Button size="sm" variant="ghost">Export</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Nodes',        value: nodeCount },
          { label: 'Success rate', value: `${successRate}%` },
          { label: 'Last run',     value: MOCK_RUNS[0]?.start ?? '—' },
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
              {MOCK_RUNS.map(run => (
                <tr key={run.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-neutral-600">{run.id}</td>
                  <td className="px-4 py-2 text-neutral-600">{run.start}</td>
                  <td className="px-4 py-2 text-neutral-600">{run.duration}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RUN_STATUS_COLOR[run.status] ?? ''}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-neutral-500 capitalize">{run.triggeredBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
