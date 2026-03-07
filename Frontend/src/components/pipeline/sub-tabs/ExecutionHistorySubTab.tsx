import React, { useState } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';

type RunStatus = 'success' | 'failed' | 'running' | 'cancelled' | 'pending';

interface ExecutionRow {
  runId: string;
  start: string;
  end: string;
  duration: string;
  status: RunStatus;
  triggeredBy: string;
  orchestrator: string;
  logUrl: string;
}

const STATUS_STYLE: Record<RunStatus, string> = {
  success:   'bg-success-100 text-success-800',
  failed:    'bg-danger-100  text-danger-800',
  running:   'bg-primary-100 text-primary-800',
  cancelled: 'bg-neutral-100 text-neutral-600',
  pending:   'bg-warning-100 text-warning-800',
};

const MOCK_EXECUTIONS: ExecutionRow[] = [
  { runId: 'run-001', start: '2026-03-02 14:22', end: '2026-03-02 14:25', duration: '3m 12s', status: 'success',   triggeredBy: 'schedule',  orchestrator: 'daily-etl',    logUrl: '#' },
  { runId: 'run-002', start: '2026-03-02 10:05', end: '2026-03-02 10:08', duration: '2m 58s', status: 'failed',    triggeredBy: 'manual',    orchestrator: '—',            logUrl: '#' },
  { runId: 'run-003', start: '2026-03-01 22:00', end: '2026-03-01 22:03', duration: '3m 04s', status: 'success',   triggeredBy: 'schedule',  orchestrator: 'daily-etl',    logUrl: '#' },
  { runId: 'run-004', start: '2026-03-01 18:30', end: '2026-03-01 18:32', duration: '1m 44s', status: 'success',   triggeredBy: 'api',       orchestrator: 'on-demand',    logUrl: '#' },
  { runId: 'run-005', start: '2026-03-01 10:00', end: '—',                duration: '—',      status: 'cancelled', triggeredBy: 'manual',    orchestrator: '—',            logUrl: '#' },
  { runId: 'run-006', start: '2026-02-29 22:00', end: '2026-02-29 22:04', duration: '4m 01s', status: 'success',   triggeredBy: 'schedule',  orchestrator: 'daily-etl',    logUrl: '#' },
];

export function ExecutionHistorySubTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RunStatus | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = MOCK_EXECUTIONS.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search && !r.runId.includes(search) && !r.triggeredBy.includes(search)) return false;
    return true;
  });

  const toggleSelect = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 bg-white flex-shrink-0">
        <Input
          placeholder="Search run ID or trigger..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-56"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="px-2 py-1.5 border border-neutral-300 rounded-md text-sm bg-white"
        >
          <option value="all">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="flex-1" />
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">{selected.size} selected</span>
            <Button size="sm" variant="ghost">Retry</Button>
            <Button size="sm" variant="ghost">Export</Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 sticky top-0 z-10">
            <tr>
              <th className="w-10 px-4 py-2" />
              {['Run ID', 'Started', 'Ended', 'Duration', 'Status', 'Triggered by', 'Orchestrator', 'Logs'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-neutral-500 border-b border-neutral-200">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map(row => (
              <tr key={row.runId} className="hover:bg-neutral-50 transition-colors">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(row.runId)}
                    onChange={() => toggleSelect(row.runId)}
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-2 font-mono text-xs text-primary-600 cursor-pointer hover:underline">{row.runId}</td>
                <td className="px-4 py-2 text-neutral-600">{row.start}</td>
                <td className="px-4 py-2 text-neutral-600">{row.end}</td>
                <td className="px-4 py-2 text-neutral-600">{row.duration}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[row.status]}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-neutral-500 capitalize">{row.triggeredBy}</td>
                <td className="px-4 py-2 text-neutral-500">{row.orchestrator}</td>
                <td className="px-4 py-2">
                  <a href={row.logUrl} className="text-xs text-primary-600 hover:underline font-medium">
                    View log ↗
                  </a>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-neutral-400 text-sm">
                  No execution records match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
