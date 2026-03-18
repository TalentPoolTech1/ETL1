/**
 * ObjectHistoryGrid — reusable history/audit grid component.
 * Shows field-level change history for any auditable object.
 */
import React, { useState } from 'react';
import { Search, Download, Filter } from 'lucide-react';

export interface HistoryRow {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  objectArea?: string;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  version?: string | number;
  comment?: string;
  correlationId?: string;
}

interface ObjectHistoryGridProps {
  rows: HistoryRow[];
  loading?: boolean;
  emptyMessage?: string;
}

const ACTION_COLORS: Record<string, string> = {
  CREATED: 'text-emerald-400',
  UPDATED: 'text-blue-400',
  RENAMED: 'text-sky-400',
  DELETED: 'text-red-400',
  MOVED: 'text-amber-400',
  SAVED: 'text-emerald-400',
  VALIDATED: 'text-violet-400',
  EXECUTION_STARTED: 'text-blue-400',
  EXECUTION_SUCCEEDED: 'text-emerald-400',
  EXECUTION_FAILED: 'text-red-400',
  EXECUTION_CANCELLED: 'text-orange-400',
  PUBLISHED: 'text-emerald-400',
  PERMISSION_GRANTED: 'text-teal-400',
  PERMISSION_REVOKED: 'text-orange-400',
  ROLE_ASSIGNED: 'text-violet-400',
  CONNECTION_TESTED: 'text-sky-400',
};

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? 'text-slate-400';
  return <span className={`font-medium text-[11px] ${color}`}>{action}</span>;
}

export function ObjectHistoryGrid({ rows, loading, emptyMessage = 'No history records' }: ObjectHistoryGridProps) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const filtered = rows.filter(r => {
    const s = search.toLowerCase();
    const matchSearch = !s || r.actor.toLowerCase().includes(s) || r.action.toLowerCase().includes(s)
      || (r.fieldChanged ?? '').toLowerCase().includes(s) || (r.comment ?? '').toLowerCase().includes(s);
    const matchAction = !actionFilter || r.action === actionFilter;
    return matchSearch && matchAction;
  });

  const uniqueActions = [...new Set(rows.map(r => r.action))].sort();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search history…"
            className="w-full h-7 pl-7 pr-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-600 focus:ring-0"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="h-7 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-300 outline-none focus:border-blue-600 px-1.5"
          >
            <option value="">All Actions</option>
            {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button
          title="Export history"
          className="h-7 px-2 flex items-center gap-1 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <Download className="w-3 h-3" /> Export
        </button>
        <span className="text-[11px] text-slate-600 ml-auto">{filtered.length} records</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-sm text-slate-500">Loading history…</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-slate-600">{emptyMessage}</div>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 bg-[#0a0c15] z-10">
              <tr className="text-left text-[11px] text-slate-500 border-b border-slate-800">
                <th className="px-3 py-2 font-medium">Timestamp</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Area / Field</th>
                <th className="px-3 py-2 font-medium">Old Value</th>
                <th className="px-3 py-2 font-medium">New Value</th>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Comment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-b border-slate-800/50 hover:bg-slate-800/30 ${i % 2 === 0 ? '' : 'bg-slate-900/20'}`}
                >
                  <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">{row.timestamp}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap"><ActionBadge action={row.action} /></td>
                  <td className="px-3 py-1.5 text-slate-300">{row.actor}</td>
                  <td className="px-3 py-1.5 text-slate-400">{row.objectArea ?? row.fieldChanged ?? '—'}</td>
                  <td className="px-3 py-1.5 text-red-400/80 max-w-[150px] truncate" title={row.oldValue}>{row.oldValue ?? '—'}</td>
                  <td className="px-3 py-1.5 text-emerald-400/80 max-w-[150px] truncate" title={row.newValue}>{row.newValue ?? '—'}</td>
                  <td className="px-3 py-1.5 text-slate-500">{row.version ?? '—'}</td>
                  <td className="px-3 py-1.5 text-slate-500 max-w-[200px] truncate" title={row.comment}>{row.comment ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
