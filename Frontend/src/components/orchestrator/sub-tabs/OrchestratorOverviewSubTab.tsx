import React, { useState } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';

const RUN_STATUS_COLOR: Record<string, string> = {
  success:   'bg-success-100 text-success-800',
  failed:    'bg-danger-100  text-danger-800',
  running:   'bg-primary-100 text-primary-800',
  pending:   'bg-warning-100 text-warning-800',
  cancelled: 'bg-neutral-100 text-neutral-600',
};

interface RunRow { id: string; start: string; duration: string; status: string; triggeredBy: string; }

const MOCK_RUNS: RunRow[] = [
  { id: 'orch-run-001', start: '2026-03-02 14:20', duration: '12m 34s', status: 'success',  triggeredBy: 'schedule' },
  { id: 'orch-run-002', start: '2026-03-02 10:00', duration: '9m 18s',  status: 'failed',   triggeredBy: 'manual'   },
  { id: 'orch-run-003', start: '2026-03-01 22:00', duration: '11m 52s', status: 'success',  triggeredBy: 'schedule' },
  { id: 'orch-run-004', start: '2026-03-01 18:30', duration: '—',       status: 'running',  triggeredBy: 'api'      },
  { id: 'orch-run-005', start: '2026-03-01 10:00', duration: '—',       status: 'pending',  triggeredBy: 'manual'   },
];

const MOCK_PIPELINES = [
  { id: 'p-1', name: 'ingest-customers',     status: 'active' },
  { id: 'p-2', name: 'transform-orders',     status: 'active' },
  { id: 'p-3', name: 'aggregate-daily-kpis', status: 'active' },
  { id: 'p-4', name: 'load-data-warehouse',  status: 'draft'  },
];

export function OrchestratorOverviewSubTab() {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('daily-etl-orchestrator');
  const [draftDesc, setDraftDesc] = useState('Orchestrates the daily ETL batch across customer, order, and KPI pipelines.');

  const successRate = Math.round(
    (MOCK_RUNS.filter(r => r.status === 'success').length / MOCK_RUNS.filter(r => r.status !== 'pending' && r.status !== 'running').length) * 100
  );

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
                placeholder="Orchestrator name"
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
                <h2 className="text-xl font-semibold text-neutral-900 truncate">{draftName}</h2>
                <button
                  onClick={() => setEditing(true)}
                  className="text-neutral-400 hover:text-neutral-600 text-xs"
                >
                  ✎
                </button>
              </div>
              <p className="text-sm text-neutral-500 mt-0.5">{draftDesc || <span className="italic">No description</span>}</p>
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
          { label: 'Pipelines',    value: MOCK_PIPELINES.length },
          { label: 'Success rate', value: `${successRate}%` },
          { label: 'Last run',     value: MOCK_RUNS[0]?.start ?? '—' },
          { label: 'Schedule',     value: 'Daily 22:00 UTC' },
        ].map(stat => (
          <div key={stat.label} className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-neutral-900">{stat.value}</div>
            <div className="text-xs text-neutral-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Pipelines in DAG */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Pipelines in this orchestrator</h3>
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                {['Pipeline', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-neutral-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {MOCK_PIPELINES.map(p => (
                <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-2 text-neutral-800 font-medium">{p.name}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'active' ? 'bg-success-100 text-success-800' : 'bg-neutral-100 text-neutral-600'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-xs text-primary-600 hover:underline">Open ↗</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                  <td className="px-4 py-2 font-mono text-xs text-primary-600 cursor-pointer hover:underline">{run.id}</td>
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
